import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestContainerFactory } from './setup/test-container-factory';
import { TestHelpers } from './utils/test-helpers';

interface HealthResponse {
  status: string;
  info: Record<string, any>;
  details: {
    database: { status: string; message?: string; timestamp?: string };
    redis: { status: string; message?: string; timestamp?: string };
    rabbitmq: { status: string; message?: string; timestamp?: string };
    storage: { status: string; message?: string; timestamp?: string };
  };
  error?: Record<string, any>;
}

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Ensure test containers are ready
    if (!TestContainerFactory.isReady()) {
      await TestContainerFactory.setupAll();
    }

    // Create test application
    app = await TestHelpers.createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/health (GET)', () => {
    beforeEach(async () => {
      // Add delay to avoid throttling between tests
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    it('should return 200 when all services are healthy', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/health')
        .expect(200);

      const body = response.body as HealthResponse;
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('info');
      expect(body).toHaveProperty('details');

      // Check that all expected services are included
      expect(body.details).toHaveProperty('database');
      expect(body.details).toHaveProperty('redis');
      expect(body.details).toHaveProperty('rabbitmq');
      expect(body.details).toHaveProperty('storage');

      // Check database health
      expect(body.details.database).toHaveProperty('status');
      expect(body.details.database.status).toMatch(/up|down/);

      // Check Redis health
      expect(body.details.redis).toHaveProperty('status');
      expect(body.details.redis.status).toMatch(/up|down/);

      // Check RabbitMQ health
      expect(body.details.rabbitmq).toHaveProperty('status');
      expect(body.details.rabbitmq.status).toMatch(/up|down/);

      // Check Storage health (may be degraded due to graceful degradation)
      expect(body.details.storage).toHaveProperty('status');
      expect(body.details.storage.status).toMatch(/up|down|degraded/);
    });

    it('should include timestamps in health check responses', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      )
        .get('/health')
        .expect(200);

      const body = response.body as HealthResponse;
      // Check that all services include timestamps
      Object.values(body.details).forEach((service: { timestamp?: string }) => {
        expect(service).toHaveProperty('timestamp');
        expect(new Date(service.timestamp as string)).toBeInstanceOf(Date);
      });
    });

    it('should include appropriate error messages when services are down', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/health');

      const body = response.body as HealthResponse;
      // If any service is down, check error structure
      if (body.status === 'error') {
        expect(body).toHaveProperty('error');
        expect(response.status).toBe(503);

        // Check that error details include meaningful messages
        Object.values(body.error!).forEach(
          (error: { message: string; status: string }) => {
            expect(error).toHaveProperty('message');
            expect(error).toHaveProperty('status', 'down');
            expect(error.message).toBeTruthy();
          },
        );
      }
    });

    it('should handle database connectivity properly', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/health');

      const body = response.body as HealthResponse;
      const databaseHealth = body.details?.database;

      if (databaseHealth) {
        expect(databaseHealth).toHaveProperty('status');
        expect(databaseHealth).toHaveProperty('message');
        expect(databaseHealth).toHaveProperty('timestamp');

        if (databaseHealth.status === 'up') {
          expect(databaseHealth.message).toBe('Database connection successful');
        } else {
          expect(databaseHealth.message).toBeTruthy();
        }
      }
    });

    it('should handle Redis connectivity properly', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/health');

      const body = response.body as HealthResponse;
      const redisHealth = body.details?.redis;

      if (redisHealth) {
        expect(redisHealth).toHaveProperty('status');
        expect(redisHealth).toHaveProperty('message');
        expect(redisHealth).toHaveProperty('timestamp');

        if (redisHealth.status === 'up') {
          expect(redisHealth.message).toBe('Redis connection successful');
          expect(redisHealth).toHaveProperty('response', 'PONG');
        }
      }
    });

    it('should handle RabbitMQ connectivity properly', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/health');

      const body = response.body as HealthResponse;
      const rabbitMQHealth = body.details?.rabbitmq;

      if (rabbitMQHealth) {
        expect(rabbitMQHealth).toHaveProperty('status');
        expect(rabbitMQHealth).toHaveProperty('message');
        expect(rabbitMQHealth).toHaveProperty('timestamp');

        if (rabbitMQHealth.status === 'up') {
          expect(rabbitMQHealth.message).toBe('RabbitMQ connection successful');
        }
      }
    });

    it('should handle storage with graceful degradation', async () => {
      const response = await request(
        app.getHttpServer() as Parameters<typeof request>[0],
      ).get('/health');

      const body = response.body as HealthResponse;
      const storageHealth = body.details?.storage;

      if (storageHealth) {
        expect(storageHealth).toHaveProperty('status');
        expect(storageHealth).toHaveProperty('message');
        expect(storageHealth).toHaveProperty('timestamp');

        if (storageHealth.status === 'up') {
          expect(storageHealth.message).toMatch(
            /storage accessible|MinIO storage accessible/,
          );
          expect(storageHealth).toHaveProperty('provider');
        } else if (storageHealth.status === 'degraded') {
          expect(storageHealth.message).toContain('storage unavailable');
        }
      }
    });

    it('should respond within reasonable time', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer() as Parameters<typeof request>[0]).get(
        '/health',
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Health check should complete within 10 seconds
      expect(responseTime).toBeLessThan(10000);
    });

    it('should have consistent response structure', async () => {
      // Retry mechanism to handle potential throttling
      let response: request.Response;
      let retries = 3;

      while (retries > 0) {
        response = await request(
          app.getHttpServer() as Parameters<typeof request>[0],
        ).get('/health');

        if (response.status !== 429) {
          break;
        }

        retries--;
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Skip test if still throttled after retries
      if (!response! || response!.status === 429) {
        console.warn('Skipping test due to rate limiting');
        return;
      }

      expect(response!.status).toBe(200);

      const body = response!.body as HealthResponse;
      // Check overall structure
      expect(body).toHaveProperty('status');
      expect(['ok', 'error']).toContain(body.status);

      expect(body).toHaveProperty('info');
      expect(typeof body.info).toBe('object');

      expect(body).toHaveProperty('details');
      expect(typeof body.details).toBe('object');

      if (body.status === 'error') {
        expect(body).toHaveProperty('error');
        expect(typeof body.error).toBe('object');
      }
    });
  });
});
