import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DrizzlePostgresModule } from '@knaadh/nestjs-drizzle-postgres';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';

import * as schema from '@db/postgres/schema';
import { EmailModule, EmailProvider, EmailModuleConfig } from '@email';
import { EventsModule } from '@events';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { StorageConfig, StorageModule, StorageProvider } from '@storage';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute (default)
      },
    ]),
    JwtModule.registerAsync({
      global: true,
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m',
          issuer: configService.get<string>('JWT_ISSUER', 'mivialabs-api'),
        },
      }),
      inject: [ConfigService],
    }),
    DrizzlePostgresModule.registerAsync({
      tag: 'DB',
      useFactory(configService: ConfigService) {
        return {
          postgres: {
            url: configService.getOrThrow<string>('DATABASE_URL'),
            config: {
              prepare: false,
              ssl: false,
            },
          },
          config: {
            schema: { ...schema, relations: true },
            logger: false,
          },
        };
      },
      inject: [ConfigService],
    }),
    EmailModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (...args: unknown[]): EmailModuleConfig => {
        const configService = args[0] as ConfigService;
        const provider = configService.getOrThrow<string>(
          'EMAIL_PROVIDER',
        ) as EmailProvider;

        return {
          provider,
          config:
            provider === EmailProvider.AWS_SES
              ? {
                  accessKeyId:
                    configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
                  secretAccessKey: configService.getOrThrow<string>(
                    'AWS_SECRET_ACCESS_KEY',
                  ),
                  region: configService.getOrThrow<string>('AWS_SES_REGION'),
                  configurationSetName: configService.getOrThrow<string>(
                    'AWS_SES_CONFIGURATION_SET',
                  ),
                }
              : {
                  apiKey:
                    configService.getOrThrow<string>('RESEND_API_KEY') ||
                    're_test_api_key',
                },
          globalSettings: {
            defaultFromAddress:
              configService.getOrThrow<string>('DEFAULT_FROM_EMAIL'),
            defaultReplyTo:
              configService.getOrThrow<string>('DEFAULT_REPLY_TO'),
          },
        };
      },
      inject: [ConfigService],
    }),
    StorageModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): StorageConfig => ({
        provider: configService.get<StorageProvider>(
          'STORAGE_PROVIDER',
          'minio' as StorageProvider,
        ),
        accessKeyId: configService.get<string>('STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: configService.get<string>('STORAGE_SECRET_ACCESS_KEY'),
        region: configService.get<string>('STORAGE_REGION', 'us-east-1'),
        // MinIO specific
        minioHost: configService.get<string>('MINIO_HOST', 'localhost'),
        minioPort: configService.get<number>('MINIO_PORT', 9000),
        // Cloudflare R2 specific
        cloudflareAccountId: configService.get<string>('CLOUDFLARE_ACCOUNT_ID'),
        // Generic S3-compatible
        endpoint: configService.get<string>('STORAGE_ENDPOINT'),
        forcePathStyle: configService.get<boolean>(
          'STORAGE_FORCE_PATH_STYLE',
          true,
        ),
      }),
      inject: [ConfigService],
    }),
    EventsModule,
    HealthModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
