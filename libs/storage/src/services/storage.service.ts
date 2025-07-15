import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { file, File, FileInsert } from '@db/postgres/schema/file';
import { IStorageAdapter } from '../interfaces/storage-adapter.interface';
import {
  UploadFileDto,
  DeleteFileDto,
  FileUploadResponseDto,
} from '../dto/upload-file.dto';
import {
  UploadFileOptions,
  DeleteFileOptions,
  FileUploadResult,
  StorageFileInfo,
} from '../types/storage-provider.types';
import { PostgresDb } from '@db';

@Injectable()
export class StorageService {
  constructor(
    @Inject('STORAGE_ADAPTER') private readonly storageAdapter: IStorageAdapter,
    @Inject('DB') private readonly db: PostgresDb,
    private readonly configService: ConfigService,
  ) {}

  async uploadFile(
    uploadDto: UploadFileDto,
    fileBuffer: Buffer,
    organizationId: string,
    uploadedBy?: string,
  ): Promise<FileUploadResponseDto> {
    const {
      bucket,
      path,
      originalName,
      mimeType,
      isPublic = false,
      metadata,
    } = uploadDto;

    // Check if file already exists in the database for this organization
    const existingFile = await this.db
      .select()
      .from(file)
      .where(
        and(
          eq(file.organizationId, organizationId),
          eq(file.bucket, bucket),
          eq(file.path, path),
        ),
      )
      .limit(1);

    if (existingFile.length > 0) {
      throw new BadRequestException(
        `File already exists at path: ${bucket}/${path}`,
      );
    }

    // Upload to storage provider
    const uploadOptions: UploadFileOptions = {
      bucket,
      path,
      file: fileBuffer,
      originalName,
      mimeType,
      isPublic,
      metadata,
    };

    let storageResult: FileUploadResult;
    try {
      storageResult = await this.storageAdapter.uploadFile(uploadOptions);
    } catch (error) {
      throw new BadRequestException(
        `Failed to upload file to storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Save file record to database
    const fileRecord: FileInsert = {
      organizationId,
      bucket,
      path,
      originalName,
      mimeType,
      size: storageResult.size,
      checksum: storageResult.checksum,
      isPublic,
      uploadedBy: uploadedBy || null,
    };

    const insertedFiles = await this.db
      .insert(file)
      .values(fileRecord)
      .returning();

    const insertedFile = insertedFiles[0];
    if (!insertedFile) {
      throw new BadRequestException('Failed to insert file record');
    }

    return {
      id: insertedFile.id,
      bucket: insertedFile.bucket,
      path: insertedFile.path,
      originalName: insertedFile.originalName,
      mimeType: insertedFile.mimeType,
      size: insertedFile.size,
      checksum: insertedFile.checksum || undefined,
      url: storageResult.url,
      isPublic: insertedFile.isPublic,
      createdAt: new Date(insertedFile.createdAt),
      updatedAt: new Date(insertedFile.updatedAt),
    };
  }

  async deleteFile(
    deleteDto: DeleteFileDto,
    organizationId: string,
  ): Promise<void> {
    const { bucket, path } = deleteDto;

    // Find file record in database
    const existingFiles = await this.db
      .select()
      .from(file)
      .where(
        and(
          eq(file.organizationId, organizationId),
          eq(file.bucket, bucket),
          eq(file.path, path),
        ),
      )
      .limit(1);

    if (existingFiles.length === 0) {
      throw new NotFoundException(`File not found at path: ${bucket}/${path}`);
    }

    // Delete from storage provider
    const deleteOptions: DeleteFileOptions = { bucket, path };

    try {
      await this.storageAdapter.deleteFile(deleteOptions);
    } catch (error) {
      // Log error but continue with database cleanup
      console.error(
        `Failed to delete file from storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Delete from database
    await this.db
      .delete(file)
      .where(
        and(
          eq(file.organizationId, organizationId),
          eq(file.bucket, bucket),
          eq(file.path, path),
        ),
      );
  }

  async deleteFileById(fileId: string, organizationId: string): Promise<void> {
    // Find file record in database
    const existingFiles = await this.db
      .select()
      .from(file)
      .where(and(eq(file.id, fileId), eq(file.organizationId, organizationId)))
      .limit(1);

    if (existingFiles.length === 0) {
      throw new NotFoundException(`File not found with ID: ${fileId}`);
    }

    const fileRecord = existingFiles[0];
    if (!fileRecord) {
      throw new NotFoundException(`File not found with ID: ${fileId}`);
    }

    // Delete from storage provider
    const deleteOptions: DeleteFileOptions = {
      bucket: fileRecord.bucket,
      path: fileRecord.path,
    };

    try {
      await this.storageAdapter.deleteFile(deleteOptions);
    } catch (error) {
      // Log error but continue with database cleanup
      console.error(
        `Failed to delete file from storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Delete from database
    await this.db.delete(file).where(eq(file.id, fileId));
  }

  async getFile(fileId: string, organizationId: string): Promise<File> {
    const existingFiles = await this.db
      .select()
      .from(file)
      .where(and(eq(file.id, fileId), eq(file.organizationId, organizationId)))
      .limit(1);

    if (existingFiles.length === 0) {
      throw new NotFoundException(`File not found with ID: ${fileId}`);
    }

    const fileRecord = existingFiles[0];
    if (!fileRecord) {
      throw new NotFoundException(`File not found with ID: ${fileId}`);
    }
    return fileRecord;
  }

  async getFileByPath(
    bucket: string,
    path: string,
    organizationId: string,
  ): Promise<File> {
    const existingFiles = await this.db
      .select()
      .from(file)
      .where(
        and(
          eq(file.organizationId, organizationId),
          eq(file.bucket, bucket),
          eq(file.path, path),
        ),
      )
      .limit(1);

    if (existingFiles.length === 0) {
      throw new NotFoundException(`File not found at path: ${bucket}/${path}`);
    }

    const fileRecord = existingFiles[0];
    if (!fileRecord) {
      throw new NotFoundException(`File not found at path: ${bucket}/${path}`);
    }
    return fileRecord;
  }

  async fileExists(
    bucket: string,
    path: string,
    organizationId: string,
  ): Promise<boolean> {
    // Check database first
    const dbFiles = await this.db
      .select({ id: file.id })
      .from(file)
      .where(
        and(
          eq(file.organizationId, organizationId),
          eq(file.bucket, bucket),
          eq(file.path, path),
        ),
      )
      .limit(1);

    if (dbFiles.length === 0) {
      return false;
    }

    // Check storage provider
    try {
      return await this.storageAdapter.fileExists(bucket, path);
    } catch (error) {
      console.error(
        `Failed to check file existence in storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  async getStorageFileInfo(
    bucket: string,
    path: string,
    organizationId: string,
  ): Promise<StorageFileInfo> {
    // Verify file exists in database first
    await this.getFileByPath(bucket, path, organizationId);

    // Get info from storage provider
    try {
      return await this.storageAdapter.getFileInfo(bucket, path);
    } catch (error) {
      throw new BadRequestException(
        `Failed to get file info from storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getPresignedUrl(
    fileId: string,
    organizationId: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const fileRecord = await this.getFile(fileId, organizationId);

    if (!this.storageAdapter.getPresignedUrl) {
      throw new BadRequestException(
        'Presigned URLs not supported by current storage provider',
      );
    }

    try {
      return await this.storageAdapter.getPresignedUrl(
        fileRecord.bucket,
        fileRecord.path,
        expiresInSeconds,
      );
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getPresignedUploadUrl(
    bucket: string,
    path: string,
    organizationId: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    // Check if file already exists
    const exists = await this.fileExists(bucket, path, organizationId);
    if (exists) {
      throw new BadRequestException(
        `File already exists at path: ${bucket}/${path}`,
      );
    }

    if (!this.storageAdapter.getPresignedUploadUrl) {
      throw new BadRequestException(
        'Presigned upload URLs not supported by current storage provider',
      );
    }

    try {
      return await this.storageAdapter.getPresignedUploadUrl(
        bucket,
        path,
        expiresInSeconds,
      );
    } catch (error) {
      throw new BadRequestException(
        `Failed to generate presigned upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async listFiles(
    organizationId: string,
    bucket?: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<File[]> {
    if (bucket) {
      return await this.db
        .select()
        .from(file)
        .where(
          and(eq(file.organizationId, organizationId), eq(file.bucket, bucket)),
        )
        .limit(limit)
        .offset(offset);
    } else {
      return await this.db
        .select()
        .from(file)
        .where(eq(file.organizationId, organizationId))
        .limit(limit)
        .offset(offset);
    }
  }
}
