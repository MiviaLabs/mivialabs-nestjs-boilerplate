import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { RabbitMQHealthIndicator } from './indicators/rabbitmq.health-indicator';
import { MinIOHealthIndicator } from './indicators/minio.health-indicator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly databaseHealthIndicator: DatabaseHealthIndicator,
    private readonly redisHealthIndicator: RedisHealthIndicator,
    private readonly rabbitMQHealthIndicator: RabbitMQHealthIndicator,
    private readonly minioHealthIndicator: MinIOHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Check application and infrastructure health',
    description: `
Performs comprehensive health checks on all critical infrastructure components:
- **Database**: PostgreSQL connectivity and query execution
- **Cache**: Redis connectivity with authentication
- **Message Broker**: RabbitMQ connection and channel creation
- **Object Storage**: MinIO accessibility (with graceful degradation)

Returns detailed status information for monitoring and alerting systems.
    `.trim(),
  })
  @ApiOkResponse({
    description: 'All services are healthy',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['ok'],
          description: 'Overall health status',
        },
        info: {
          type: 'object',
          description: 'Details of healthy services',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                message: {
                  type: 'string',
                  example: 'Database connection successful',
                },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
            redis: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                message: {
                  type: 'string',
                  example: 'Redis connection successful',
                },
                response: { type: 'string', example: 'PONG' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
            rabbitmq: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'up' },
                message: {
                  type: 'string',
                  example: 'RabbitMQ connection successful',
                },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
            minio: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['up', 'degraded'] },
                message: {
                  type: 'string',
                  example: 'MinIO storage accessible',
                },
                httpStatus: { type: 'number', example: 200 },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        error: {
          type: 'object',
          description: 'Details of failed services (empty when all healthy)',
        },
        details: {
          type: 'object',
          description: 'Combined info and error details',
        },
      },
      example: {
        status: 'ok',
        info: {
          database: {
            status: 'up',
            message: 'Database connection successful',
            timestamp: '2025-07-13T10:30:00.000Z',
          },
          redis: {
            status: 'up',
            message: 'Redis connection successful',
            response: 'PONG',
            timestamp: '2025-07-13T10:30:00.100Z',
          },
          rabbitmq: {
            status: 'up',
            message: 'RabbitMQ connection successful',
            timestamp: '2025-07-13T10:30:00.200Z',
          },
          minio: {
            status: 'up',
            message: 'MinIO storage accessible',
            httpStatus: 200,
            timestamp: '2025-07-13T10:30:00.300Z',
          },
        },
        error: {},
        details: {
          database: {
            status: 'up',
            message: 'Database connection successful',
            timestamp: '2025-07-13T10:30:00.000Z',
          },
          redis: {
            status: 'up',
            message: 'Redis connection successful',
            response: 'PONG',
            timestamp: '2025-07-13T10:30:00.100Z',
          },
          rabbitmq: {
            status: 'up',
            message: 'RabbitMQ connection successful',
            timestamp: '2025-07-13T10:30:00.200Z',
          },
          minio: {
            status: 'up',
            message: 'MinIO storage accessible',
            httpStatus: 200,
            timestamp: '2025-07-13T10:30:00.300Z',
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'One or more services are unhealthy',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['error'],
          description: 'Overall health status indicating failures',
        },
        info: {
          type: 'object',
          description: 'Details of healthy services',
        },
        error: {
          type: 'object',
          description: 'Details of failed services',
          properties: {
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'down' },
                message: { type: 'string', example: 'Connection timeout' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        details: {
          type: 'object',
          description: 'Combined info and error details',
        },
      },
      example: {
        status: 'error',
        info: {
          redis: {
            status: 'up',
            message: 'Redis connection successful',
            response: 'PONG',
            timestamp: '2025-07-13T10:30:00.100Z',
          },
        },
        error: {
          database: {
            status: 'down',
            message: 'Connection timeout',
            timestamp: '2025-07-13T10:30:00.000Z',
          },
        },
        details: {
          database: {
            status: 'down',
            message: 'Connection timeout',
            timestamp: '2025-07-13T10:30:00.000Z',
          },
          redis: {
            status: 'up',
            message: 'Redis connection successful',
            response: 'PONG',
            timestamp: '2025-07-13T10:30:00.100Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests - Rate limit exceeded',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'ThrottlerException: Too Many Requests',
        },
        statusCode: { type: 'number', example: 429 },
      },
    },
  })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.databaseHealthIndicator.isHealthy('database'),
      () => this.redisHealthIndicator.isHealthy('redis'),
      () => this.rabbitMQHealthIndicator.isHealthy('rabbitmq'),
      () => this.minioHealthIndicator.isHealthy('minio'),
    ]);
  }
}
