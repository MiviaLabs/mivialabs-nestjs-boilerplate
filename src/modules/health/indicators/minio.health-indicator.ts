import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinIOHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const minioUrl = this.getMinIOHealthUrl();

      // Use fetch API to check MinIO health endpoint
      const response = await fetch(minioUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const isHealthy = response.ok;

      if (!isHealthy) {
        throw new Error(
          `MinIO health check failed with status: ${response.status}`,
        );
      }

      const healthData = {
        status: 'up',
        message: 'MinIO storage accessible',
        httpStatus: response.status,
        timestamp: new Date().toISOString(),
      };

      return this.getStatus(key, isHealthy, healthData);
    } catch (error: unknown) {
      // MinIO is optional service - provide graceful degradation
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown MinIO error';

      const healthData = {
        status: 'degraded',
        message: `MinIO unavailable: ${errorMessage}`,
        impact: 'File uploads may be affected',
        timestamp: new Date().toISOString(),
      };

      // Return as healthy with degraded status instead of throwing error
      // This allows the overall health check to pass even if MinIO is down
      return this.getStatus(key, true, healthData);
    }
  }

  private getMinIOHealthUrl(): string {
    // Check for MINIO_ENDPOINT first
    const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT');
    if (minioEndpoint) {
      return `${minioEndpoint}/minio/health/live`;
    }

    // Fallback to individual configuration values
    const host = this.configService.get<string>('MINIO_HOST', 'localhost');
    const port = this.configService.get<number>('MINIO_PORT', 9000);

    return `http://${host}:${port}/minio/health/live`;
  }
}
