import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private redisClient: Redis;

  constructor(private readonly configService: ConfigService) {
    super();

    // Create Redis client with configuration from environment
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    // If REDIS_URL is provided (test environment), parse it
    if (redisUrl) {
      try {
        const url = new URL(redisUrl);
        this.redisClient = new Redis({
          host: url.hostname,
          port: parseInt(url.port) || 6379,
          // Only use password if it exists in URL or config
          ...(url.password && { password: url.password }),
          ...(redisPassword && !url.password && { password: redisPassword }),
          connectTimeout: 5000,
          lazyConnect: true,
        });
      } catch {
        // Fallback to host/port configuration
        this.redisClient = new Redis({
          host: redisHost,
          port: redisPort,
          ...(redisPassword && { password: redisPassword }),
          connectTimeout: 5000,
          lazyConnect: true,
        });
      }
    } else {
      // Use host/port configuration
      this.redisClient = new Redis({
        host: redisHost,
        port: redisPort,
        ...(redisPassword && { password: redisPassword }),
        connectTimeout: 5000,
        lazyConnect: true,
      });
    }
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Test Redis connectivity with ping command
      const pingResult = await this.redisClient.ping();

      const isHealthy = pingResult === 'PONG';

      if (!isHealthy) {
        throw new Error(
          `Redis ping returned unexpected result: ${String(pingResult)}`,
        );
      }

      const healthData = {
        status: 'up',
        message: 'Redis connection successful',
        response: pingResult,
        timestamp: new Date().toISOString(),
      };

      return this.getStatus(key, isHealthy, healthData);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown Redis error';

      const healthData = {
        status: 'down',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      };

      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, healthData),
      );
    }
  }

  onModuleDestroy(): void {
    // Clean up Redis connection when module is destroyed
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }
}
