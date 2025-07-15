import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  HeadBucketCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';

type StorageProvider = 'minio' | 'aws-s3' | 'cloudflare-r2' | 's3-compatible';

@Injectable()
export class StorageHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    let provider: string = 'unknown';

    try {
      provider = this.getStorageProvider();

      let healthData;

      switch (provider) {
        case 'minio':
          healthData = await this.checkMinIOHealth();
          break;
        case 'aws-s3':
          healthData = await this.checkS3Health('AWS S3');
          break;
        case 'cloudflare-r2':
          healthData = await this.checkS3Health('Cloudflare R2');
          break;
        case 's3-compatible':
          healthData = await this.checkS3Health('S3-compatible storage');
          break;
        default:
          throw new Error(`Unsupported storage provider: ${provider}`);
      }

      return this.getStatus(key, true, healthData);
    } catch (error: unknown) {
      // If provider is still 'unknown', try to get the raw config value safely
      if (provider === 'unknown') {
        provider = this.configService.get<string>('STORAGE_PROVIDER', 'minio');
      }

      // Storage is optional service - provide graceful degradation
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown storage error';

      const healthData = {
        status: 'degraded',
        message: `Storage unavailable: ${errorMessage}`,
        impact: 'File uploads may be affected',
        provider: provider,
        timestamp: new Date().toISOString(),
      };

      // Return as healthy with degraded status instead of throwing error
      // This allows the overall health check to pass even if storage is down
      return this.getStatus(key, true, healthData);
    }
  }

  private async checkMinIOHealth() {
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

    return {
      status: 'up',
      message: 'MinIO storage accessible',
      provider: 'minio',
      httpStatus: response.status,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkS3Health(providerName: string) {
    const s3Client = this.createS3Client();
    const bucketName = this.configService.get<string>(
      'STORAGE_HEALTH_CHECK_BUCKET',
    );

    try {
      if (bucketName) {
        // Use HeadBucket for specific bucket health check (lightweight)
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));

        return {
          status: 'up',
          message: `${providerName} accessible (bucket check)`,
          provider: this.getStorageProvider(),
          bucket: bucketName,
          timestamp: new Date().toISOString(),
        };
      } else {
        // Fallback to ListBuckets (checks general S3 access)
        await s3Client.send(new ListBucketsCommand({}));

        return {
          status: 'up',
          message: `${providerName} accessible (list buckets)`,
          provider: this.getStorageProvider(),
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      throw new Error(
        `${providerName} health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private createS3Client(): S3Client {
    const provider = this.getStorageProvider();

    const accessKeyId = this.configService.get<string>('STORAGE_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'STORAGE_SECRET_ACCESS_KEY',
    );

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Storage credentials not configured');
    }

    const config: any = {
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    switch (provider) {
      case 'aws-s3':
        config.region = this.configService.get<string>(
          'STORAGE_REGION',
          'us-east-1',
        );
        break;

      case 'cloudflare-r2': {
        const accountId = this.configService.get<string>(
          'CLOUDFLARE_ACCOUNT_ID',
        );
        if (!accountId) {
          throw new Error(
            'CLOUDFLARE_ACCOUNT_ID is required for Cloudflare R2',
          );
        }
        config.endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
        config.region = 'auto';
        break;
      }

      case 's3-compatible': {
        const endpoint = this.configService.get<string>('STORAGE_ENDPOINT');
        if (!endpoint) {
          throw new Error(
            'STORAGE_ENDPOINT is required for S3-compatible storage',
          );
        }
        config.endpoint = endpoint;
        config.region = this.configService.get<string>(
          'STORAGE_REGION',
          'us-east-1',
        );
        config.forcePathStyle = true; // Required for MinIO and other S3-compatible services
        break;
      }

      default:
        throw new Error(`Unsupported S3 provider: ${provider}`);
    }

    return new S3Client(config);
  }

  private getStorageProvider(): StorageProvider {
    const provider = this.configService.get<string>(
      'STORAGE_PROVIDER',
      'minio',
    );

    if (
      !['minio', 'aws-s3', 'cloudflare-r2', 's3-compatible'].includes(provider)
    ) {
      throw new Error(
        `Invalid storage provider: ${provider}. Must be one of: minio, aws-s3, cloudflare-r2, s3-compatible`,
      );
    }

    return provider as StorageProvider;
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
