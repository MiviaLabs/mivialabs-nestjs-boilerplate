/* eslint-disable @typescript-eslint/no-require-imports */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageHealthIndicator } from './storage.health-indicator';

// Mock fetch globally
global.fetch = jest.fn();
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  HeadBucketCommand: jest.fn(),
  ListBucketsCommand: jest.fn(),
}));

describe('StorageHealthIndicator', () => {
  let indicator: StorageHealthIndicator;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockS3Client: any;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // @ts-expect-error - Mocking ConfigService for testing purposes
    mockConfigService = {
      get: jest.fn(),
    } as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageHealthIndicator,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    indicator = module.get<StorageHealthIndicator>(StorageHealthIndicator);

    // Setup S3Client mock
    const { S3Client } = require('@aws-sdk/client-s3');
    mockS3Client = {
      send: jest.fn(),
    };
    S3Client.mockImplementation(() => mockS3Client);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  describe('MinIO provider', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            STORAGE_PROVIDER: 'minio',
            MINIO_ENDPOINT: 'http://localhost:9000',
          };
          return config[key] || defaultValue;
        },
      );
    });

    it('should return healthy status when MinIO health endpoint responds ok', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };
      mockedFetch.mockResolvedValue(mockResponse as Response);

      const result = await indicator.isHealthy('storage');

      expect(result).toEqual({
        storage: {
          status: 'up',
          message: 'MinIO storage accessible',
          provider: 'minio',
          httpStatus: 200,
          timestamp: expect.any(String),
        },
      });
      expect(mockedFetch).toHaveBeenCalledWith(
        'http://localhost:9000/minio/health/live',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it('should return degraded status when MinIO health check fails', async () => {
      const mockResponse = {
        ok: false,
        status: 503,
      };
      mockedFetch.mockResolvedValue(mockResponse as Response);

      const result = await indicator.isHealthy('storage');

      expect(result).toEqual({
        storage: {
          status: 'degraded',
          message: expect.stringContaining('Storage unavailable'),
          impact: 'File uploads may be affected',
          provider: 'minio',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('AWS S3 provider', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            STORAGE_PROVIDER: 'aws-s3',
            STORAGE_ACCESS_KEY_ID: 'test-access-key',
            STORAGE_SECRET_ACCESS_KEY: 'test-secret-key',
            STORAGE_REGION: 'us-east-1',
            STORAGE_HEALTH_CHECK_BUCKET: 'test-bucket',
          };
          return config[key] || defaultValue;
        },
      );
    });

    it('should return healthy status when S3 bucket is accessible', async () => {
      mockS3Client.send.mockResolvedValue({});

      const result = await indicator.isHealthy('storage');

      expect(result).toEqual({
        storage: {
          status: 'up',
          message: 'AWS S3 accessible (bucket check)',
          provider: 'aws-s3',
          bucket: 'test-bucket',
          timestamp: expect.any(String),
        },
      });
      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it('should fallback to ListBuckets when no health check bucket is configured', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            STORAGE_PROVIDER: 'aws-s3',
            STORAGE_ACCESS_KEY_ID: 'test-access-key',
            STORAGE_SECRET_ACCESS_KEY: 'test-secret-key',
            STORAGE_REGION: 'us-east-1',
            // No STORAGE_HEALTH_CHECK_BUCKET
          };
          return config[key] || defaultValue;
        },
      );

      mockS3Client.send.mockResolvedValue({ Buckets: [] });

      const result = await indicator.isHealthy('storage');

      expect(result).toEqual({
        storage: {
          status: 'up',
          message: 'AWS S3 accessible (list buckets)',
          provider: 'aws-s3',
          timestamp: expect.any(String),
        },
      });
    });

    it('should return degraded status when S3 health check fails', async () => {
      mockS3Client.send.mockRejectedValue(new Error('Access denied'));

      const result = await indicator.isHealthy('storage');

      expect(result).toEqual({
        storage: {
          status: 'degraded',
          message: expect.stringContaining('Storage unavailable'),
          impact: 'File uploads may be affected',
          provider: 'aws-s3',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('Cloudflare R2 provider', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            STORAGE_PROVIDER: 'cloudflare-r2',
            STORAGE_ACCESS_KEY_ID: 'test-access-key',
            STORAGE_SECRET_ACCESS_KEY: 'test-secret-key',
            CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
          };
          return config[key] || defaultValue;
        },
      );
    });

    it('should return healthy status when R2 is accessible', async () => {
      mockS3Client.send.mockResolvedValue({ Buckets: [] });

      const result = await indicator.isHealthy('storage');

      expect(result).toEqual({
        storage: {
          status: 'up',
          message: 'Cloudflare R2 accessible (list buckets)',
          provider: 'cloudflare-r2',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('S3-compatible provider', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            STORAGE_PROVIDER: 's3-compatible',
            STORAGE_ACCESS_KEY_ID: 'test-access-key',
            STORAGE_SECRET_ACCESS_KEY: 'test-secret-key',
            STORAGE_ENDPOINT: 'https://s3.example.com',
            STORAGE_REGION: 'us-east-1',
          };
          return config[key] || defaultValue;
        },
      );
    });

    it('should return healthy status when S3-compatible storage is accessible', async () => {
      mockS3Client.send.mockResolvedValue({ Buckets: [] });

      const result = await indicator.isHealthy('storage');

      expect(result).toEqual({
        storage: {
          status: 'up',
          message: 'S3-compatible storage accessible (list buckets)',
          provider: 's3-compatible',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('error handling', () => {
    it('should return degraded status when storage provider is invalid', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            STORAGE_PROVIDER: 'invalid-provider',
          };
          return config[key] || defaultValue;
        },
      );

      const result = await indicator.isHealthy('storage');

      expect(result).toEqual({
        storage: {
          status: 'degraded',
          message: expect.stringContaining('Storage unavailable'),
          impact: 'File uploads may be affected',
          provider: 'invalid-provider',
          timestamp: expect.any(String),
        },
      });
    });

    it('should return degraded status when credentials are missing', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            STORAGE_PROVIDER: 'aws-s3',
            // Missing credentials
          };
          return config[key] || defaultValue;
        },
      );

      const result = await indicator.isHealthy('storage');

      expect(result).toEqual({
        storage: {
          status: 'degraded',
          message: expect.stringContaining('Storage unavailable'),
          impact: 'File uploads may be affected',
          provider: 'aws-s3',
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe('configuration', () => {
    it('should use MinIO host/port fallback when MINIO_ENDPOINT is not provided', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            STORAGE_PROVIDER: 'minio',
            MINIO_HOST: 'minio.example.com',
            MINIO_PORT: 9001,
          };
          return config[key] || defaultValue;
        },
      );

      const mockResponse = {
        ok: true,
        status: 200,
      };
      mockedFetch.mockResolvedValue(mockResponse as Response);

      await indicator.isHealthy('storage');

      expect(mockedFetch).toHaveBeenCalledWith(
        'http://minio.example.com:9001/minio/health/live',
        expect.any(Object),
      );
    });
  });
});
