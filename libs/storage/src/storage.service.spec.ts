import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StorageService } from './services/storage.service';
import { IStorageAdapter } from './interfaces/storage-adapter.interface';
import { UploadFileDto, DeleteFileDto } from './dto/upload-file.dto';

describe('StorageService', () => {
  let service: StorageService;
  let mockAdapter: jest.Mocked<IStorageAdapter>;
  let mockDb: any;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockAdapter = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      fileExists: jest.fn(),
      getFileInfo: jest.fn(),
      getPresignedUrl: jest.fn(),
      getPresignedUploadUrl: jest.fn(),
    };

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    mockConfigService = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: 'STORAGE_ADAPTER',
          useValue: mockAdapter,
        },
        {
          provide: 'DB',
          useValue: mockDb,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    const uploadDto: UploadFileDto = {
      bucket: 'test-bucket',
      path: 'test/file.txt',
      originalName: 'file.txt',
      mimeType: 'text/plain',
      isPublic: false,
    };

    const fileBuffer = Buffer.from('test content');
    const organizationId = 'org-123';
    const uploadedBy = 'user-123';

    it('should upload file successfully', async () => {
      // Mock database check for existing file (select query)
      mockDb.limit.mockResolvedValueOnce([]);

      // Mock storage adapter response
      mockAdapter.uploadFile.mockResolvedValue({
        id: '',
        bucket: 'test-bucket',
        path: 'test/file.txt',
        originalName: 'file.txt',
        mimeType: 'text/plain',
        size: 12,
        checksum: 'sha256:abc123',
        isPublic: false,
      });

      // Mock database insert (returning query)
      mockDb.returning.mockResolvedValueOnce([
        {
          id: 'file-123',
          organizationId,
          bucket: 'test-bucket',
          path: 'test/file.txt',
          originalName: 'file.txt',
          mimeType: 'text/plain',
          size: 12,
          checksum: 'sha256:abc123',
          isPublic: false,
          uploadedBy,
          createdAt: '2024-07-15T10:30:00.000Z',
          updatedAt: '2024-07-15T10:30:00.000Z',
        },
      ]);

      const result = await service.uploadFile(
        uploadDto,
        fileBuffer,
        organizationId,
        uploadedBy,
      );

      expect(result).toEqual({
        id: 'file-123',
        bucket: 'test-bucket',
        path: 'test/file.txt',
        originalName: 'file.txt',
        mimeType: 'text/plain',
        size: 12,
        checksum: 'sha256:abc123',
        isPublic: false,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(mockAdapter.uploadFile).toHaveBeenCalledWith({
        bucket: 'test-bucket',
        path: 'test/file.txt',
        file: fileBuffer,
        originalName: 'file.txt',
        mimeType: 'text/plain',
        isPublic: false,
        metadata: undefined,
      });
    });

    it('should throw error if file already exists', async () => {
      // Mock existing file in database - the first query returns an existing file
      mockDb.limit.mockResolvedValueOnce([{ id: 'existing-file' }]);

      await expect(
        service.uploadFile(uploadDto, fileBuffer, organizationId, uploadedBy),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if storage upload fails', async () => {
      // Mock no existing file
      mockDb.limit.mockResolvedValueOnce([]);

      // Mock storage adapter error
      mockAdapter.uploadFile.mockRejectedValue(new Error('Storage error'));

      await expect(
        service.uploadFile(uploadDto, fileBuffer, organizationId, uploadedBy),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteFile', () => {
    const deleteDto: DeleteFileDto = {
      bucket: 'test-bucket',
      path: 'test/file.txt',
    };
    const organizationId = 'org-123';

    it('should delete file successfully', async () => {
      // Mock existing file in database
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'file-123',
          bucket: 'test-bucket',
          path: 'test/file.txt',
        },
      ]);

      mockAdapter.deleteFile.mockResolvedValue(undefined);

      await service.deleteFile(deleteDto, organizationId);

      expect(mockAdapter.deleteFile).toHaveBeenCalledWith({
        bucket: 'test-bucket',
        path: 'test/file.txt',
      });
    });

    it('should throw error if file not found', async () => {
      // Mock no file in database
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(
        service.deleteFile(deleteDto, organizationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists in both database and storage', async () => {
      const bucket = 'test-bucket';
      const path = 'test/file.txt';
      const organizationId = 'org-123';

      // Mock file exists in database
      mockDb.limit.mockResolvedValueOnce([{ id: 'file-123' }]);

      // Mock file exists in storage
      mockAdapter.fileExists.mockResolvedValue(true);

      const result = await service.fileExists(bucket, path, organizationId);

      expect(result).toBe(true);
      expect(mockAdapter.fileExists).toHaveBeenCalledWith(bucket, path);
    });

    it('should return false if file does not exist in database', async () => {
      const bucket = 'test-bucket';
      const path = 'test/file.txt';
      const organizationId = 'org-123';

      // Mock file does not exist in database
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await service.fileExists(bucket, path, organizationId);

      expect(result).toBe(false);
      expect(mockAdapter.fileExists).not.toHaveBeenCalled();
    });
  });
});
