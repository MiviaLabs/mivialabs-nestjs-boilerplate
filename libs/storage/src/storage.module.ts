import { Module, DynamicModule, Provider, Type } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { StorageService } from './services/storage.service';
import { S3Adapter } from './adapters/s3-adapter';
import { IStorageAdapter } from './interfaces/storage-adapter.interface';
import { StorageConfig, StorageProvider } from './types/storage-provider.types';

export interface StorageModuleOptions {
  /**
   * Whether this is a global module (default: false)
   */
  isGlobal?: boolean;

  /**
   * Custom storage configuration
   * If not provided, will use ConfigService to load from environment
   */
  config?: StorageConfig;

  /**
   * Custom storage adapter instance
   * If provided, will override the default adapter selection
   */
  adapter?: IStorageAdapter;
}

export interface StorageModuleAsyncOptions {
  /**
   * Whether this is a global module (default: false)
   */
  isGlobal?: boolean;

  /**
   * Dependencies to inject
   */
  imports?: Array<Type<any> | DynamicModule>;

  /**
   * Factory function to create storage configuration
   */
  useFactory?: (...args: any[]) => StorageConfig | Promise<StorageConfig>;

  /**
   * Dependencies to inject into the factory function
   */
  inject?: any[];
}

@Module({})
export class StorageModule {
  /**
   * Register storage module synchronously
   */
  static forRoot(options: StorageModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: 'STORAGE_CONFIG',
        useFactory: (configService: ConfigService): StorageConfig => {
          if (options.config) {
            return options.config;
          }

          return this.createConfigFromEnvironment(configService);
        },
        inject: [ConfigService],
      },
      {
        provide: 'STORAGE_ADAPTER',
        useFactory: (config: StorageConfig): IStorageAdapter => {
          if (options.adapter) {
            return options.adapter;
          }

          return this.createAdapter(config);
        },
        inject: ['STORAGE_CONFIG'],
      },
      StorageService,
    ];

    return {
      module: StorageModule,
      global: options.isGlobal || false,
      imports: [ConfigModule],
      providers,
      exports: [StorageService, 'STORAGE_ADAPTER'],
    };
  }

  /**
   * Register storage module asynchronously
   */
  static forRootAsync(options: StorageModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: 'STORAGE_CONFIG',
        useFactory:
          options.useFactory ||
          (() => {
            throw new Error('useFactory is required');
          }),
        inject: options.inject || [],
      },
      {
        provide: 'STORAGE_ADAPTER',
        useFactory: (config: StorageConfig): IStorageAdapter => {
          return this.createAdapter(config);
        },
        inject: ['STORAGE_CONFIG'],
      },
      StorageService,
    ];

    return {
      module: StorageModule,
      global: options.isGlobal || false,
      imports: [
        ConfigModule,
        ...(Array.isArray(options.imports) ? options.imports : []),
      ],
      providers,
      exports: [StorageService, 'STORAGE_ADAPTER'],
    };
  }

  /**
   * Create storage configuration from environment variables
   */
  private static createConfigFromEnvironment(
    configService: ConfigService,
  ): StorageConfig {
    const provider = configService.get<StorageProvider>(
      'STORAGE_PROVIDER',
      'minio',
    );

    const config: StorageConfig = {
      provider,
      accessKeyId: configService.get<string>('STORAGE_ACCESS_KEY_ID'),
      secretAccessKey: configService.get<string>('STORAGE_SECRET_ACCESS_KEY'),
      region: configService.get<string>('STORAGE_REGION', 'us-east-1'),
      endpoint: configService.get<string>('STORAGE_ENDPOINT'),

      // MinIO specific
      minioEndpoint: configService.get<string>('MINIO_ENDPOINT'),
      minioHost: configService.get<string>('MINIO_HOST', 'localhost'),
      minioPort: configService.get<number>('MINIO_PORT', 9000),

      // Cloudflare R2 specific
      cloudflareAccountId: configService.get<string>('CLOUDFLARE_ACCOUNT_ID'),

      // Additional options
      forcePathStyle: configService.get<boolean>(
        'STORAGE_FORCE_PATH_STYLE',
        true,
      ),
    };

    // Validate required configuration based on provider
    this.validateConfig(config);

    return config;
  }

  /**
   * Create appropriate storage adapter based on configuration
   */
  private static createAdapter(config: StorageConfig): IStorageAdapter {
    switch (config.provider) {
      case 'minio':
      case 'aws-s3':
      case 'cloudflare-r2':
      case 's3-compatible':
        return new S3Adapter(config);

      default:
        throw new Error(
          `Unsupported storage provider: ${config.provider as string}`,
        );
    }
  }

  /**
   * Validate storage configuration
   */
  private static validateConfig(config: StorageConfig): void {
    const { provider } = config;

    switch (provider) {
      case 'minio': {
        // MinIO can use either MINIO_ACCESS_KEY/MINIO_SECRET_KEY or STORAGE_ACCESS_KEY_ID/STORAGE_SECRET_ACCESS_KEY
        const minioAccessKey =
          process.env.MINIO_ACCESS_KEY || config.accessKeyId;
        const minioSecretKey =
          process.env.MINIO_SECRET_KEY || config.secretAccessKey;

        if (!minioAccessKey || !minioSecretKey) {
          throw new Error(
            'MinIO requires access credentials. Please set MINIO_ACCESS_KEY/MINIO_SECRET_KEY or STORAGE_ACCESS_KEY_ID/STORAGE_SECRET_ACCESS_KEY',
          );
        }
        break;
      }

      case 'aws-s3':
        if (!config.accessKeyId || !config.secretAccessKey) {
          throw new Error(
            'AWS S3 requires STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY',
          );
        }
        break;

      case 'cloudflare-r2':
        if (!config.accessKeyId || !config.secretAccessKey) {
          throw new Error(
            'Cloudflare R2 requires STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY',
          );
        }
        if (!config.cloudflareAccountId) {
          throw new Error('Cloudflare R2 requires CLOUDFLARE_ACCOUNT_ID');
        }
        break;

      case 's3-compatible':
        if (!config.accessKeyId || !config.secretAccessKey) {
          throw new Error(
            'S3-compatible storage requires STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY',
          );
        }
        if (!config.endpoint) {
          throw new Error('S3-compatible storage requires STORAGE_ENDPOINT');
        }
        break;

      default:
        throw new Error(
          `Invalid storage provider: ${provider as string}. Supported providers: minio, aws-s3, cloudflare-r2, s3-compatible`,
        );
    }
  }
}
