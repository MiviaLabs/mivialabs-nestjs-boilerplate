import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { TestEnvironment, ContainerPorts } from './test-environment.interface';

export class TestContainerFactory {
  private static containers: StartedTestContainer[] = [];
  private static environment: TestEnvironment | null = null;

  static async setupAll(): Promise<TestEnvironment> {
    if (this.environment) {
      return this.environment;
    }

    console.log('🚀 Starting test containers...');

    const startTime = Date.now();

    // Start containers in parallel
    const [postgres, redis, rabbitmq, minio] = await Promise.all([
      this.setupPostgres(),
      this.setupRedis(),
      this.setupRabbitMQ(),
      this.setupMinIO(),
    ]);

    const ports: ContainerPorts = {
      postgres: postgres.getMappedPort(5432),
      redis: redis.getMappedPort(6379),
      rabbitmq: rabbitmq.getMappedPort(5672),
      rabbitmqManagement: rabbitmq.getMappedPort(15672),
      minio: minio.getMappedPort(9000),
      minioConsole: minio.getMappedPort(9001),
    };

    this.environment = {
      postgres,
      redis,
      rabbitmq,
      minio,
      databaseUrl: `postgresql://postgres:test_password@localhost:${ports.postgres}/test_db`,
      redisUrl: `redis://:test_redis_password@localhost:${ports.redis}`,
      redisPassword: 'test_redis_password',
      rabbitmqUrl: `amqp://test_user:test_password@localhost:${ports.rabbitmq}`,
      minioUrl: `http://localhost:${ports.minio}`,
    };

    this.containers = [postgres, redis, rabbitmq, minio];

    const duration = Date.now() - startTime;
    console.log(`✅ All containers started in ${duration}ms`);
    console.log(`📊 Container ports:`, ports);

    return this.environment;
  }

  private static async setupPostgres(): Promise<StartedTestContainer> {
    console.log('🐘 Starting PostgreSQL container...');

    const container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'test_db',
        POSTGRES_USER: 'postgres',
        POSTGRES_PASSWORD: 'test_password',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage('database system is ready to accept connections', 2),
      )
      .withStartupTimeout(60000)
      .start();

    console.log(
      `🐘 PostgreSQL started on port ${container.getMappedPort(5432)}`,
    );
    return container;
  }

  private static async setupRedis(): Promise<StartedTestContainer> {
    console.log('🔴 Starting Redis container...');

    const container = await new GenericContainer('redis:7-alpine')
      .withCommand([
        'redis-server',
        '--appendonly',
        'yes',
        '--requirepass',
        'test_redis_password',
      ])
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .withStartupTimeout(30000)
      .start();

    console.log(`🔴 Redis started on port ${container.getMappedPort(6379)}`);
    return container;
  }

  private static async setupRabbitMQ(): Promise<StartedTestContainer> {
    console.log('🐰 Starting RabbitMQ container...');

    const container = await new GenericContainer('rabbitmq:3.13-management')
      .withEnvironment({
        RABBITMQ_DEFAULT_USER: 'test_user',
        RABBITMQ_DEFAULT_PASS: 'test_password',
      })
      .withExposedPorts(5672, 15672)
      .withWaitStrategy(Wait.forLogMessage('completed with'))
      .withStartupTimeout(60000)
      .start();

    console.log(
      `🐰 RabbitMQ started on port ${container.getMappedPort(5672)} (management: ${container.getMappedPort(15672)})`,
    );
    return container;
  }

  private static async setupMinIO(): Promise<StartedTestContainer> {
    console.log('📦 Starting MinIO container...');

    const container = await new GenericContainer('minio/minio:latest')
      .withCommand(['server', '/data', '--console-address', ':9001'])
      .withEnvironment({
        MINIO_ROOT_USER: 'test_minio_user',
        MINIO_ROOT_PASSWORD: 'test_minio_password_123',
      })
      .withExposedPorts(9000, 9001)
      .withWaitStrategy(Wait.forListeningPorts())
      .withStartupTimeout(30000)
      .start();

    console.log(
      `📦 MinIO started on port ${container.getMappedPort(9000)} (console: ${container.getMappedPort(9001)})`,
    );
    return container;
  }

  static async teardownAll(): Promise<void> {
    if (this.containers.length === 0) {
      return;
    }

    console.log('🧹 Stopping test containers...');

    const startTime = Date.now();

    // Stop containers in parallel
    await Promise.all(
      this.containers.map(async (container) => {
        try {
          await container.stop();
        } catch (error) {
          console.warn(
            `Warning: Failed to stop container ${container.getId()}:`,
            error,
          );
        }
      }),
    );

    this.containers = [];
    this.environment = null;

    const duration = Date.now() - startTime;
    console.log(`✅ All containers stopped in ${duration}ms`);
  }

  static getEnvironment(): TestEnvironment | null {
    return this.environment;
  }

  static isReady(): boolean {
    return this.environment !== null;
  }
}
