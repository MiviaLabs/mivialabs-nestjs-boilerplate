import { Injectable, Inject } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@db/postgres/schema';
import { sql } from 'drizzle-orm';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(
    @Inject('DB')
    private readonly db: NodePgDatabase<typeof schema>,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Test basic connectivity and database responsiveness
      const result = (await this.db.execute(
        sql`SELECT 1 as health_check`,
      )) as unknown[];

      const isHealthy = result && result.length > 0;

      if (!isHealthy) {
        throw new Error('Database query returned unexpected result');
      }

      const healthData = {
        status: 'up',
        message: 'Database connection successful',
        timestamp: new Date().toISOString(),
      };

      return this.getStatus(key, true, healthData);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Database connection failed';

      const healthData = {
        status: 'down',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      };

      throw new HealthCheckError(
        'Database health check failed',
        this.getStatus(key, false, healthData),
      );
    }
  }
}
