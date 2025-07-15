import { StartedTestContainer } from 'testcontainers';

export interface TestEnvironment {
  postgres: StartedTestContainer;
  redis: StartedTestContainer;
  rabbitmq: StartedTestContainer;
  minio: StartedTestContainer;
  databaseUrl: string;
  redisUrl: string;
  redisPassword?: string;
  rabbitmqUrl: string;
  minioUrl: string;
}

export interface ContainerPorts {
  postgres: number;
  redis: number;
  rabbitmq: number;
  rabbitmqManagement: number;
  minio: number;
  minioConsole: number;
}

export interface TestConfig {
  DATABASE_URL: string;
  REDIS_URL: string;
  REDIS_PASSWORD?: string;
  RABBITMQ_URL: string;
  RABBITMQ_DEFAULT_USER: string;
  RABBITMQ_DEFAULT_PASS: string;
  NODE_ENV: string;
  PORT: string;
  HOST: string;
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_EXPIRES_IN: string;
  ENCRYPTION_KEY: string;
  CORS_ALLOWED_ORIGINS: string;
  APP_ACCOUNT_ACTIVE_AFTER_SIGNUP: string;
  // Email service config
  EMAIL_PROVIDER: string;
  EMAIL_FROM: string;
  DEFAULT_FROM_EMAIL: string;
  DEFAULT_REPLY_TO: string;
  RESEND_API_KEY?: string;
  AWS_SES_REGION?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  // Storage config (S3 compatible)
  STORAGE_PROVIDER: string;
  STORAGE_ACCESS_KEY_ID?: string;
  STORAGE_SECRET_ACCESS_KEY?: string;
  STORAGE_REGION?: string;
  MINIO_HOST?: string;
  MINIO_PORT?: string;
  STORAGE_FORCE_PATH_STYLE?: string;
  AWS_S3_BUCKET?: string;
  AWS_S3_REGION?: string;
}
