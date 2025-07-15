import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from '../../src/app.module';
import { TestEnvironment, TestConfig } from './test-environment.interface';

export class TestAppFactory {
  static async create(environment: TestEnvironment): Promise<INestApplication> {
    console.log('🏗️ Creating test NestJS application...');

    const testConfig = this.createTestConfig(environment);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: <T = any>(key: string, defaultValue?: T): T => {
          const value = testConfig[key as keyof TestConfig];
          return (value !== undefined ? value : defaultValue) as T;
        },
        getOrThrow: (key: string) => {
          const value = testConfig[key as keyof TestConfig];
          if (value === undefined) {
            throw new Error(`Configuration key "${key}" not found`);
          }
          return value;
        },
      })
      .compile();

    const app = moduleFixture.createNestApplication();

    // Apply the same configuration as main.ts
    this.applySecurityConfig(app);
    this.applyValidationConfig(app);
    this.applyCorsConfig(app);
    this.applySwaggerConfig(app);

    await app.init();

    console.log('✅ Test application created and initialized');
    return app;
  }

  private static createTestConfig(environment: TestEnvironment): TestConfig {
    return {
      DATABASE_URL: environment.databaseUrl,
      REDIS_URL: environment.redisUrl,
      REDIS_PASSWORD: environment.redisPassword,
      RABBITMQ_URL: environment.rabbitmqUrl,
      RABBITMQ_DEFAULT_USER: 'test_user',
      RABBITMQ_DEFAULT_PASS: 'test_password',
      NODE_ENV: 'test',
      PORT: '0', // Let the test framework assign a port
      HOST: '127.0.0.1',
      JWT_SECRET: 'test-jwt-secret-key-for-e2e-tests-only',
      JWT_EXPIRES_IN: '1h',
      ENCRYPTION_KEY: 'test-encryption-key-32-chars-long!',
      CORS_ALLOWED_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000',
      // Email service config (using mock Resend for tests)
      EMAIL_PROVIDER: 'resend',
      EMAIL_FROM: 'test@example.com',
      DEFAULT_FROM_EMAIL: 'test@example.com',
      DEFAULT_REPLY_TO: 'test@example.com',
      RESEND_API_KEY: 're_test_api_key',
      // Storage config (using real MinIO container)
      STORAGE_PROVIDER: 'minio',
      STORAGE_ACCESS_KEY_ID: 'test_minio_user',
      STORAGE_SECRET_ACCESS_KEY: 'test_minio_password_123',
      STORAGE_REGION: 'us-east-1',
      MINIO_HOST: 'localhost',
      MINIO_PORT: environment.minio.getMappedPort(9000).toString(),
      STORAGE_FORCE_PATH_STYLE: 'true',
    };
  }

  private static applySecurityConfig(app: INestApplication): void {
    // Apply the same security headers as main.ts
    app.use(
      helmet({
        // Content Security Policy
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
            ],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        // HTTP Strict Transport Security
        hsts: {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },
        // X-Frame-Options
        frameguard: {
          action: 'deny',
        },
        // X-Content-Type-Options
        noSniff: true,
        // X-XSS-Protection (legacy but still useful)
        xssFilter: true,
        // Referrer Policy
        referrerPolicy: {
          policy: 'strict-origin-when-cross-origin',
        },
        // Hide X-Powered-By header
        hidePoweredBy: true,
      }),
    );
  }

  private static applyValidationConfig(app: INestApplication): void {
    // Apply the same validation pipes as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
  }

  private static applyCorsConfig(app: INestApplication): void {
    // Test environment CORS configuration
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001', // Allow additional test ports
      'http://127.0.0.1:3001',
    ];

    app.enableCors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-api-key',
        'X-Correlation-ID',
        'X-Request-ID',
        'Accept',
        'User-Agent',
      ],
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
  }

  private static applySwaggerConfig(app: INestApplication): void {
    // Apply the same Swagger configuration as main.ts (for testing purposes)
    const config = new DocumentBuilder()
      .setTitle('API (Test)')
      .setDescription('Official API - Test Environment')
      .setVersion('1.0.0-test')
      .addTag('api')
      .build();

    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, documentFactory);
  }

  static async close(app: INestApplication): Promise<void> {
    if (app) {
      console.log('🔌 Closing test application...');
      await app.close();
      console.log('✅ Test application closed');
    }
  }
}
