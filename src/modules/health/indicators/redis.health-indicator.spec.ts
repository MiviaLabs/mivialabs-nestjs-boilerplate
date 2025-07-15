import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health-indicator';

// Mock IORedis with better implementation
const mockRedisInstance = {
  ping: jest.fn(),
  disconnect: jest.fn(),
};

// Mock both default and named exports
jest.mock('ioredis', () => {
  const mockConstructor = jest.fn().mockImplementation(() => mockRedisInstance);
  return {
    __esModule: true,
    default: mockConstructor,
    Redis: mockConstructor,
  };
});

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockRedisInstance.ping.mockResolvedValue('PONG');

    // @ts-expect-error - Mocking ConfigService for testing purposes
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          REDIS_HOST: 'localhost',
          REDIS_PORT: 6379,
          REDIS_PASSWORD: 'test_password',
        };
        return (config[key] || defaultValue) as string | number;
      }),
    } as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  describe('isHealthy', () => {
    it('should return healthy status when Redis ping succeeds', async () => {
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const result = await indicator.isHealthy('redis');

      expect(result).toEqual({
        redis: {
          status: 'up',
          message: 'Redis connection successful',
          response: 'PONG',
          timestamp: expect.any(String) as string,
        },
      });
      expect(mockRedisInstance.ping).toHaveBeenCalled();
    });

    it('should throw HealthCheckError when Redis ping fails', async () => {
      const error = new Error('Connection failed');
      mockRedisInstance.ping.mockRejectedValue(error);

      await expect(indicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );
      expect(mockRedisInstance.ping).toHaveBeenCalled();
    });

    it('should throw HealthCheckError when ping returns unexpected result', async () => {
      mockRedisInstance.ping.mockResolvedValue('UNEXPECTED');

      await expect(indicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );
      expect(mockRedisInstance.ping).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockRedisInstance.ping.mockRejectedValue('String error');

      await expect(indicator.isHealthy('redis')).rejects.toThrow(
        HealthCheckError,
      );
    });

    it('should include timestamp in health data', async () => {
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const result = await indicator.isHealthy('redis');

      expect(result.redis?.timestamp).toBeDefined();
      expect(new Date(result.redis!.timestamp as string)).toBeInstanceOf(Date);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Redis client', () => {
      indicator.onModuleDestroy();

      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
    });

    it('should handle module destroy gracefully', () => {
      expect(() => indicator.onModuleDestroy()).not.toThrow();
    });
  });
});
