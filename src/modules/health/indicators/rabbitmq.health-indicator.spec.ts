import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RabbitMQHealthIndicator } from './rabbitmq.health-indicator';

// Mock amqplib completely
jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

describe('RabbitMQHealthIndicator', () => {
  let indicator: RabbitMQHealthIndicator;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // @ts-expect-error - Mocking ConfigService for testing purposes
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          RABBITMQ_HOST: 'localhost',
          RABBITMQ_PORT: 5672,
          RABBITMQ_DEFAULT_USER: 'test_user',
          RABBITMQ_DEFAULT_PASS: 'test_pass',
        };
        return (config[key] || defaultValue) as string | number;
      }),
    } as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RabbitMQHealthIndicator,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    indicator = module.get<RabbitMQHealthIndicator>(RabbitMQHealthIndicator);
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  describe('getRabbitMQUrl', () => {
    it('should construct URL with default values', () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => defaultValue,
      );

      // @ts-expect-error - Access private method for testing
      const url = (indicator as { getRabbitMQUrl(): string }).getRabbitMQUrl();

      expect(url).toBe('amqp://guest:guest@localhost:5672');
    });

    it('should construct URL with custom configuration', () => {
      // @ts-expect-error - Access private method for testing
      const url = (indicator as { getRabbitMQUrl(): string }).getRabbitMQUrl();

      expect(url).toBe('amqp://test_user:test_pass@localhost:5672');
    });
  });
});
