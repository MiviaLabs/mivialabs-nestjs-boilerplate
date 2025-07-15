import {
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { IStorageAdapter } from '../interfaces/storage-adapter.interface';
import {
  UploadFileOptions,
  DeleteFileOptions,
  FileUploadResult,
  StorageFileInfo,
  StorageConfig,
} from '../types/storage-provider.types';

@Injectable()
export class S3Adapter implements IStorageAdapter {
  private s3Client: S3Client;

  constructor(private readonly config: StorageConfig) {
    this.s3Client = this.createS3Client();
  }

  async uploadFile(options: UploadFileOptions): Promise<FileUploadResult> {
    const {
      bucket,
      path,
      file,
      originalName,
      mimeType,
      isPublic = false,
      metadata,
    } = options;

    // Generate checksum for file integrity
    const checksum = createHash('sha256').update(file).digest('hex');

    const putObjectCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: file,
      ContentType: mimeType,
      ContentLength: file.length,
      Metadata: {
        'original-name': originalName,
        'file-checksum': checksum,
        ...metadata,
      },
      ...(isPublic && { ACL: 'public-read' }),
    });

    await this.s3Client.send(putObjectCommand);

    return {
      id: '', // This will be filled by the service layer with DB ID
      bucket,
      path,
      originalName,
      mimeType,
      size: file.length,
      checksum: `sha256:${checksum}`,
      isPublic,
      url: isPublic ? this.generatePublicUrl(bucket, path) : undefined,
    };
  }

  async deleteFile(options: DeleteFileOptions): Promise<void> {
    const { bucket, path } = options;

    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: path,
    });

    await this.s3Client.send(deleteObjectCommand);
  }

  async fileExists(bucket: string, path: string): Promise<boolean> {
    try {
      const headObjectCommand = new HeadObjectCommand({
        Bucket: bucket,
        Key: path,
      });

      await this.s3Client.send(headObjectCommand);
      return true;
    } catch (error: unknown) {
      if (error && typeof error === 'object') {
        const awsError = error as {
          name?: string;
          $metadata?: { httpStatusCode?: number };
        };
        if (
          awsError.name === 'NotFound' ||
          awsError.$metadata?.httpStatusCode === 404
        ) {
          return false;
        }
      }
      throw error as Error;
    }
  }

  async getFileInfo(bucket: string, path: string): Promise<StorageFileInfo> {
    const headObjectCommand = new HeadObjectCommand({
      Bucket: bucket,
      Key: path,
    });

    const response = await this.s3Client.send(headObjectCommand);

    return {
      bucket,
      path,
      size: response.ContentLength || 0,
      lastModified: response.LastModified,
      etag: response.ETag,
    };
  }

  async getPresignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const getObjectCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: path,
    });

    return await getSignedUrl(this.s3Client, getObjectCommand, {
      expiresIn: expiresInSeconds,
    });
  }

  async getPresignedUploadUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const putObjectCommand = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
    });

    return await getSignedUrl(this.s3Client, putObjectCommand, {
      expiresIn: expiresInSeconds,
    });
  }

  private createS3Client(): S3Client {
    const { provider } = this.config;

    const clientConfig: S3ClientConfig = {
      credentials: {
        accessKeyId: this.getAccessKeyId(),
        secretAccessKey: this.getSecretAccessKey(),
      },
    };

    switch (provider) {
      case 'aws-s3':
        clientConfig.region = this.config.region || 'us-east-1';
        break;

      case 'cloudflare-r2': {
        if (!this.config.cloudflareAccountId) {
          throw new Error(
            'CLOUDFLARE_ACCOUNT_ID is required for Cloudflare R2',
          );
        }
        clientConfig.endpoint = `https://${this.config.cloudflareAccountId}.r2.cloudflarestorage.com`;
        clientConfig.region = 'auto';
        break;
      }

      case 'minio':
        clientConfig.endpoint = this.getMinIOEndpoint();
        clientConfig.region = this.config.region || 'us-east-1';
        clientConfig.forcePathStyle = true;
        break;

      case 's3-compatible': {
        if (!this.config.endpoint) {
          throw new Error(
            'STORAGE_ENDPOINT is required for S3-compatible storage',
          );
        }
        clientConfig.endpoint = this.config.endpoint;
        clientConfig.region = this.config.region || 'us-east-1';
        clientConfig.forcePathStyle = this.config.forcePathStyle || true;
        break;
      }

      default:
        throw new Error(`Unsupported storage provider: ${provider as string}`);
    }

    return new S3Client(clientConfig);
  }

  private getAccessKeyId(): string {
    if (this.config.provider === 'minio') {
      // For MinIO, prefer MINIO_ACCESS_KEY, fallback to STORAGE_ACCESS_KEY_ID
      return process.env.MINIO_ACCESS_KEY || this.config.accessKeyId || '';
    }
    return this.config.accessKeyId || '';
  }

  private getSecretAccessKey(): string {
    if (this.config.provider === 'minio') {
      // For MinIO, prefer MINIO_SECRET_KEY, fallback to STORAGE_SECRET_ACCESS_KEY
      return process.env.MINIO_SECRET_KEY || this.config.secretAccessKey || '';
    }
    return this.config.secretAccessKey || '';
  }

  private getMinIOEndpoint(): string {
    if (this.config.minioEndpoint) {
      return this.config.minioEndpoint;
    }

    const host = this.config.minioHost || 'localhost';
    const port = this.config.minioPort || 9000;
    return `http://${host}:${port}`;
  }

  private generatePublicUrl(bucket: string, path: string): string {
    const { provider } = this.config;

    switch (provider) {
      case 'aws-s3': {
        const region = this.config.region || 'us-east-1';
        return `https://${bucket}.s3.${region}.amazonaws.com/${path}`;
      }

      case 'cloudflare-r2': {
        if (!this.config.cloudflareAccountId) {
          throw new Error(
            'CLOUDFLARE_ACCOUNT_ID is required for Cloudflare R2',
          );
        }
        return `https://${this.config.cloudflareAccountId}.r2.cloudflarestorage.com/${bucket}/${path}`;
      }

      case 'minio': {
        const endpoint = this.getMinIOEndpoint();
        return `${endpoint}/${bucket}/${path}`;
      }

      case 's3-compatible': {
        if (!this.config.endpoint) {
          throw new Error(
            'STORAGE_ENDPOINT is required for S3-compatible storage',
          );
        }
        return `${this.config.endpoint}/${bucket}/${path}`;
      }

      default:
        throw new Error(`Unsupported storage provider: ${provider as string}`);
    }
  }
}
