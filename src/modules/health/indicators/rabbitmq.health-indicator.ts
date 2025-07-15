import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;

    try {
      const rabbitMQUrl = this.getRabbitMQUrl();
      // Test RabbitMQ connectivity

      connection = await amqp.connect(rabbitMQUrl, {
        timeout: 5000,
      });

      // Test basic channel creation to ensure broker is responsive
      const channel = await connection.createChannel();
      await channel.close();

      const healthData = {
        status: 'up',
        message: 'RabbitMQ connection successful',
        timestamp: new Date().toISOString(),
      };

      return this.getStatus(key, true, healthData);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown RabbitMQ error';

      const healthData = {
        status: 'down',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      };

      throw new HealthCheckError(
        'RabbitMQ health check failed',
        this.getStatus(key, false, healthData),
      );
    } finally {
      // Clean up connection
      if (connection) {
        try {
          await connection.close();
        } catch {
          // Ignore close errors during cleanup
        }
      }
    }
  }

  private getRabbitMQUrl(): string {
    // Check for RABBITMQ_URL first (test environment)
    const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL');
    if (rabbitmqUrl) {
      return rabbitmqUrl;
    }

    // Fallback to individual configuration values
    const host = this.configService.get<string>('RABBITMQ_HOST', 'localhost');
    const port = this.configService.get<number>('RABBITMQ_PORT', 5672);
    const username = this.configService.get<string>(
      'RABBITMQ_DEFAULT_USER',
      'guest',
    );
    const password = this.configService.get<string>(
      'RABBITMQ_DEFAULT_PASS',
      'guest',
    );

    return `amqp://${username}:${password}@${host}:${port}`;
  }
}
