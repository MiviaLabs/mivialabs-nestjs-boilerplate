/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinIOHealthIndicator } from './minio.health-indicator';

// Mock fetch globally
global.fetch = jest.fn();
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock AbortSignal.timeout
Object.defineProperty(AbortSignal, 'timeout', {
  value: jest.fn(() => {
    const signal = new AbortController().signal;
    Object.defineProperty(signal, 'aborted', { value: false, writable: true });
    return signal;
  }),
  writable: true,
});

describe('MinIOHealthIndicator', () => {
  let indicator: MinIOHealthIndicator;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // @ts-expect-error - Mocking ConfigService for testing purposes
    mockConfigService = {
      get: jest.fn(),
    } as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinIOHealthIndicator,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    indicator = module.get<MinIOHealthIndicator>(MinIOHealthIndicator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  describe('isHealthy', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            MINIO_HOST: 'localhost',
            MINIO_PORT: 9000,
          };
          return config[key] || defaultValue;
        },
      );
    });

    it('should return healthy status when MinIO health check succeeds', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      } as Response;

      mockedFetch.mockResolvedValue(mockResponse);

      const result = await indicator.isHealthy('minio');

      expect(result).toEqual({
        minio: {
          status: 'up',
          message: 'MinIO storage accessible',
          httpStatus: 200,
          timestamp: expect.any(String) as string,
        },
      });

      expect(mockedFetch).toHaveBeenCalledWith(
        'http://localhost:9000/minio/health/live',
        {
          method: 'GET',
          signal: expect.any(Object) as AbortSignal,
        },
      );
    });

    it('should return degraded status when MinIO health check fails with HTTP error', async () => {
      const mockResponse = {
        ok: false,
        status: 503,
      } as Response;

      mockedFetch.mockResolvedValue(mockResponse);

      const result = await indicator.isHealthy('minio');

      expect(result).toEqual({
        minio: {
          status: 'degraded',
          message:
            'MinIO unavailable: MinIO health check failed with status: 503',
          impact: 'File uploads may be affected',
          timestamp: expect.any(String) as string,
        },
      });
    });

    it('should return degraded status when MinIO request throws error', async () => {
      const mockError = new Error('Connection timeout');
      mockedFetch.mockRejectedValue(mockError);

      const result = await indicator.isHealthy('minio');

      expect(result).toEqual({
        minio: {
          status: 'degraded',
          message: 'MinIO unavailable: Connection timeout',
          impact: 'File uploads may be affected',
          timestamp: expect.any(String) as string,
        },
      });
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockedFetch.mockRejectedValue('String error');

      const result = await indicator.isHealthy('minio');

      expect(result.minio!.message).toBe(
        'MinIO unavailable: Unknown MinIO error',
      );
      expect(result.minio!.status).toBe('degraded');
    });

    it('should include timestamp in health data', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      } as Response;

      mockedFetch.mockResolvedValue(mockResponse);

      const result = await indicator.isHealthy('minio');

      expect(result.minio!.timestamp).toBeDefined();
      expect(new Date(result.minio!.timestamp as string)).toBeInstanceOf(Date);
    });

    it('should use timeout for fetch request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      } as Response;

      mockedFetch.mockResolvedValue(mockResponse);

      await indicator.isHealthy('minio');

      expect(jest.mocked(AbortSignal.timeout)).toHaveBeenCalledWith(5000);
    });
  });

  describe('getMinIOHealthUrl', () => {
    it('should construct URL with default values', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => defaultValue,
      );

      // Access private method through any casting
      const url = (
        indicator as unknown as { getMinIOHealthUrl(): string }
      ).getMinIOHealthUrl();

      expect(url).toBe('http://localhost:9000/minio/health/live');
    });

    it('should construct URL with custom configuration', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config: Record<string, any> = {
            MINIO_HOST: 'custom-host',
            MINIO_PORT: 9001,
          };
          return config[key] || defaultValue;
        },
      );

      const url = (
        indicator as unknown as { getMinIOHealthUrl(): string }
      ).getMinIOHealthUrl();

      expect(url).toBe('http://custom-host:9001/minio/health/live');
    });
  });
});
