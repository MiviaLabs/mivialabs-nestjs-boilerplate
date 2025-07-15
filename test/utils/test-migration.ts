import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Test migration utility
 * Runs database migrations for test environment
 */
export class TestMigration {
  private static sql: postgres.Sql | null = null;

  /**
   * Run migrations for test database
   */
  static async runMigrations(databaseUrl: string): Promise<void> {
    console.log('🔄 Running database migrations for tests...');

    try {
      // Create postgres connection for migrations
      this.sql = postgres(databaseUrl, {
        max: 1,
        connect_timeout: 60, // Increased timeout for test containers
        idle_timeout: 30,
        ssl: false,
        prepare: false, // Disable prepared statements for migrations
      });

      const db = drizzle(this.sql);

      // Run migrations
      await migrate(db, {
        migrationsFolder: './libs/db/src/postgres/migrations',
      });

      // Grant necessary permissions to postgres user to assume the system role
      await this.sql`GRANT system TO postgres`;
      await this.sql`GRANT authenticated TO postgres`;
      await this.sql`GRANT system_admin TO postgres`;

      console.log('✅ Database migrations completed successfully!');
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      throw error;
    }
  }

  /**
   * Close migration connection
   */
  static async closeMigrationConnection(): Promise<void> {
    if (this.sql) {
      console.log('🔌 Closing migration connection...');
      try {
        await this.sql.end();
        this.sql = null;
        console.log('✅ Migration connection closed');
      } catch (error) {
        console.warn('⚠️ Warning: Error closing migration connection:', error);
      }
    }
  }

  /**
   * Clean database (drop all tables) - for test cleanup
   * WARNING: This will drop ALL tables! Only use in test environment
   */
  static async cleanDatabase(databaseUrl: string): Promise<void> {
    console.log('🧹 Cleaning test database...');

    const sql = postgres(databaseUrl, {
      max: 1,
      connect_timeout: 30,
      idle_timeout: 30,
      ssl: false,
    });

    try {
      // Get all table names
      const tables = await sql<{ tablename: string }[]>`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
      `;

      if (tables.length > 0) {
        // Drop all tables
        const tableNames = tables.map((t) => t.tablename).join(', ');
        console.log(`🗑️ Dropping tables: ${tableNames}`);

        await sql.unsafe(`DROP TABLE IF EXISTS ${tableNames} CASCADE`);
        console.log('✅ Database cleaned successfully!');
      } else {
        console.log('ℹ️ No tables found to clean');
      }
    } catch (error) {
      console.error('❌ Database cleanup failed:', error);
      throw error;
    } finally {
      await sql.end();
    }
  }

  /**
   * Wait for database to be ready
   */
  static async waitForDatabase(
    databaseUrl: string,
    maxRetries: number = 30,
    delayMs: number = 1000,
  ): Promise<void> {
    console.log('⏳ Waiting for database to be ready...');

    for (let i = 0; i < maxRetries; i++) {
      try {
        const sql = postgres(databaseUrl, {
          max: 1,
          connect_timeout: 5,
          idle_timeout: 5,
          ssl: false,
        });

        // Simple connectivity test
        await sql`SELECT 1`;
        await sql.end();

        console.log('✅ Database is ready!');
        return;
      } catch (error) {
        console.log(
          `⏳ Database not ready yet, attempt ${i + 1}/${maxRetries}...`,
        );

        if (i === maxRetries - 1) {
          console.error('❌ Database failed to become ready:', error);
          throw new Error('Database connection timeout');
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Verify database schema (check if migrations ran successfully)
   */
  static async verifySchema(databaseUrl: string): Promise<boolean> {
    console.log('🔍 Verifying database schema...');

    const sql = postgres(databaseUrl, {
      max: 1,
      connect_timeout: 30,
      ssl: false,
    });

    try {
      // Check for essential tables that should exist after migrations
      const essentialTables = [
        'organization',
        'user',
        'refresh_token',
        'event',
      ];

      for (const tableName of essentialTables) {
        const tableExists = await sql<{ exists: boolean }[]>`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          ) as exists
        `;

        if (!tableExists[0]?.exists) {
          console.error(`❌ Table '${tableName}' does not exist`);
          return false;
        }
      }

      console.log('✅ Database schema verification passed!');
      return true;
    } catch (error) {
      console.error('❌ Schema verification failed:', error);
      return false;
    } finally {
      await sql.end();
    }
  }
}
