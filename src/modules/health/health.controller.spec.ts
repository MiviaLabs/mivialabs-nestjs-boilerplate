import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { RabbitMQHealthIndicator } from './indicators/rabbitmq.health-indicator';
import { StorageHealthIndicator } from './indicators/storage.health-indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let databaseHealthIndicator: DatabaseHealthIndicator;
  let redisHealthIndicator: RedisHealthIndicator;
  let rabbitMQHealthIndicator: RabbitMQHealthIndicator;
  let storageHealthIndicator: StorageHealthIndicator;

  beforeEach(async () => {
    const mockHealthCheckService = {
      check: jest.fn(),
    };

    const mockDatabaseHealthIndicator = {
      isHealthy: jest.fn(),
    };

    const mockRedisHealthIndicator = {
      isHealthy: jest.fn(),
    };

    const mockRabbitMQHealthIndicator = {
      isHealthy: jest.fn(),
    };

    const mockStorageHealthIndicator = {
      isHealthy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: DatabaseHealthIndicator,
          useValue: mockDatabaseHealthIndicator,
        },
        {
          provide: RedisHealthIndicator,
          useValue: mockRedisHealthIndicator,
        },
        {
          provide: RabbitMQHealthIndicator,
          useValue: mockRabbitMQHealthIndicator,
        },
        {
          provide: StorageHealthIndicator,
          useValue: mockStorageHealthIndicator,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    databaseHealthIndicator = module.get<DatabaseHealthIndicator>(
      DatabaseHealthIndicator,
    );
    redisHealthIndicator =
      module.get<RedisHealthIndicator>(RedisHealthIndicator);
    rabbitMQHealthIndicator = module.get<RabbitMQHealthIndicator>(
      RabbitMQHealthIndicator,
    );
    storageHealthIndicator = module.get<StorageHealthIndicator>(
      StorageHealthIndicator,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should call health check service with all indicators', async () => {
      const mockResult: HealthCheckResult = {
        status: 'ok',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
          rabbitmq: { status: 'up' },
          storage: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
          rabbitmq: { status: 'up' },
          storage: { status: 'up' },
        },
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(jest.mocked(healthCheckService.check)).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
      expect(result).toEqual(mockResult);
    });

    it('should handle health check failures gracefully', async () => {
      const mockResult: HealthCheckResult = {
        status: 'error',
        info: {
          redis: { status: 'up' },
          rabbitmq: { status: 'up' },
          storage: { status: 'up' },
        },
        error: {
          database: { status: 'down', message: 'Connection failed' },
        },
        details: {
          database: { status: 'down', message: 'Connection failed' },
          redis: { status: 'up' },
          rabbitmq: { status: 'up' },
          storage: { status: 'up' },
        },
      };

      jest.spyOn(healthCheckService, 'check').mockResolvedValue(mockResult);

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('database');
    });

    it('should call all health indicators when check functions are executed', async () => {
      const mockHealthChecks = [
        jest.fn().mockResolvedValue({ database: { status: 'up' } }),
        jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
        jest.fn().mockResolvedValue({ rabbitmq: { status: 'up' } }),
        jest.fn().mockResolvedValue({ storage: { status: 'up' } }),
      ];

      jest
        .spyOn(healthCheckService, 'check')
        .mockImplementation(async (checks) => {
          // Execute all provided check functions
          for (const check of checks) {
            await check();
          }
          return {
            status: 'ok',
            info: {},
            error: {},
            details: {},
          };
        });

      jest
        .spyOn(databaseHealthIndicator, 'isHealthy')
        .mockImplementation(mockHealthChecks[0]);
      jest
        .spyOn(redisHealthIndicator, 'isHealthy')
        .mockImplementation(mockHealthChecks[1]);
      jest
        .spyOn(rabbitMQHealthIndicator, 'isHealthy')
        .mockImplementation(mockHealthChecks[2]);
      jest
        .spyOn(storageHealthIndicator, 'isHealthy')
        .mockImplementation(mockHealthChecks[3]);

      await controller.check();

      expect(
        jest.mocked(databaseHealthIndicator.isHealthy),
      ).toHaveBeenCalledWith('database');
      expect(jest.mocked(redisHealthIndicator.isHealthy)).toHaveBeenCalledWith(
        'redis',
      );
      expect(
        jest.mocked(rabbitMQHealthIndicator.isHealthy),
      ).toHaveBeenCalledWith('rabbitmq');
      expect(
        jest.mocked(storageHealthIndicator.isHealthy),
      ).toHaveBeenCalledWith('storage');
    });
  });
});
