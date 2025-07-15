import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health-indicator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@db/postgres/schema';

describe('DatabaseHealthIndicator', () => {
  let indicator: DatabaseHealthIndicator;
  let mockDb: jest.Mocked<NodePgDatabase<typeof schema>>;

  beforeEach(async () => {
    // @ts-expect-error - Mocking database for testing purposes
    mockDb = {
      execute: jest.fn(),
    } as jest.Mocked<NodePgDatabase<typeof schema>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseHealthIndicator,
        {
          provide: 'DB',
          useValue: mockDb,
        },
      ],
    }).compile();

    indicator = module.get<DatabaseHealthIndicator>(DatabaseHealthIndicator);
  });

  it('should be defined', () => {
    expect(indicator).toBeDefined();
  });

  describe('isHealthy', () => {
    it('should return healthy status when database query succeeds', async () => {
      const mockResult = [{ health_check: 1 }];
      mockDb.execute.mockResolvedValue(mockResult);

      const result = await indicator.isHealthy('database');

      expect(result).toEqual({
        database: {
          status: 'up',
          message: 'Database connection successful',
          timestamp: expect.any(String) as string,
        },
      });
      expect(jest.mocked(mockDb.execute)).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.objectContaining({
              value: expect.arrayContaining([
                'SELECT 1 as health_check',
              ]) as string[],
            }),
          ]) as any[],
        }),
      );
    });

    it('should throw HealthCheckError when database query fails', async () => {
      const mockError = new Error('Connection timeout');
      mockDb.execute.mockRejectedValue(mockError);

      await expect(indicator.isHealthy('database')).rejects.toThrow(
        HealthCheckError,
      );

      try {
        await indicator.isHealthy('database');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        const healthError = error as HealthCheckError;
        expect(healthError.message).toBe('Database health check failed');
        expect(healthError.causes).toEqual({
          database: {
            status: 'down',
            message: 'Connection timeout',
            timestamp: expect.any(String) as string,
          },
        });
      }
    });

    it('should throw HealthCheckError when database query returns unexpected result', async () => {
      const mockResult: any[] = [];
      mockDb.execute.mockResolvedValue(mockResult);

      await expect(indicator.isHealthy('database')).rejects.toThrow(
        HealthCheckError,
      );

      try {
        await indicator.isHealthy('database');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        const healthError = error as HealthCheckError;
        expect(
          (
            healthError as HealthCheckError & {
              causes: { database: { message: string } };
            }
          ).causes.database.message,
        ).toBe('Database query returned unexpected result');
      }
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockDb.execute.mockRejectedValue('String error');

      await expect(indicator.isHealthy('database')).rejects.toThrow(
        HealthCheckError,
      );

      try {
        await indicator.isHealthy('database');
      } catch (error) {
        const healthError = error as HealthCheckError;
        expect(
          (
            healthError as HealthCheckError & {
              causes: { database: { message: string } };
            }
          ).causes.database.message,
        ).toBe('Database connection failed');
      }
    });

    it('should include timestamp in health data', async () => {
      const mockResult = [{ health_check: 1 }];
      mockDb.execute.mockResolvedValue(mockResult);

      const result = await indicator.isHealthy('database');

      expect(result.database!.timestamp).toBeDefined();
      expect(new Date(result.database!.timestamp as string)).toBeInstanceOf(
        Date,
      );
    });
  });
});
