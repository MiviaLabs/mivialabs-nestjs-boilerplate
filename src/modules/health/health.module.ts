import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.health-indicator';
import { RedisHealthIndicator } from './indicators/redis.health-indicator';
import { RabbitMQHealthIndicator } from './indicators/rabbitmq.health-indicator';
import { StorageHealthIndicator } from './indicators/storage.health-indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    RabbitMQHealthIndicator,
    StorageHealthIndicator,
  ],
})
export class HealthModule {}
