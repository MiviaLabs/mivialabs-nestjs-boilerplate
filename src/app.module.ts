import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DrizzlePostgresModule } from '@knaadh/nestjs-drizzle-postgres';

import * as schema from '@db/postgres/schema';
import { EmailModule, EmailProvider, EmailModuleConfig } from '@email';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
