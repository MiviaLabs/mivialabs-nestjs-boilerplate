import { ExtractTablesWithRelations, sql } from 'drizzle-orm';
import { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import { Logger } from '@nestjs/common';

import { PostgresDb } from './types/postgres-db.type';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { UserRole } from './types/user-role.enum';
import * as schema from './schema';

const logger = new Logger('RLS-Transaction');

export interface RLSContext {
  organizationId: string;
  userId?: string;
  userRole?: UserRole;
  isSystemAdmin?: boolean;
  sessionId?: string;
}

/**
 * Execute a database transaction with Row Level Security context
 * Sets the current organization ID for RLS policies
 */
export const rlsTx = <T>(
  db: PostgresDb,
  context: RLSContext | string, // Support legacy string usage
  cb: (
    tx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
  ) => T | Promise<T>,
): Promise<T> => {
  // Handle legacy string parameter
  const rlsContext: RLSContext =
    typeof context === 'string' ? { organizationId: context } : context;

  return db.transaction(async (tx) => {
    try {
      // Set organization context for RLS policies
      await tx.execute(
        sql.raw(
          `SET app.current_organization_id = '${rlsContext.organizationId}'`,
        ),
      );

      // Set user context if provided (useful for audit trails)
      if (rlsContext.userId) {
        await tx.execute(
          sql.raw(`SET app.current_user_id = '${rlsContext.userId}'`),
        );
      }

      // Set user role context if provided
      if (rlsContext.userRole) {
        await tx.execute(
          sql.raw(`SET app.current_user_role = '${rlsContext.userRole}'`),
        );
      }

      // Set session context if provided
      if (rlsContext.sessionId) {
        await tx.execute(
          sql.raw(`SET app.current_session_id = '${rlsContext.sessionId}'`),
        );
      }

      // Set database role based on user role
      if (rlsContext.userRole === UserRole.SYSTEM_ADMIN) {
        await tx.execute(sql.raw(`SET ROLE system_admin`));
      } else if (rlsContext.userRole) {
        // All other roles are treated as authenticated
        await tx.execute(sql.raw(`SET ROLE authenticated`));
      }

      logger.debug(
        `RLS context set: org=${rlsContext.organizationId}, user=${rlsContext.userId}, role=${rlsContext.userRole}, admin=${rlsContext.isSystemAdmin}`,
      );

      return await cb(tx);
    } catch (error) {
      logger.error(
        `RLS transaction failed for org ${rlsContext.organizationId}:`,
        error,
      );
      throw error;
    }
  });
};

/**
 * Execute a database transaction as system admin (bypasses RLS)
 * Only use this for system-level operations like seeding data
 */
export const systemAdminTx = <T>(
  db: PostgresDb,
  cb: (
    tx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
  ) => T | Promise<T>,
): Promise<T> => {
  return db.transaction(async (tx) => {
    try {
      // Set role to system_admin to bypass RLS
      await tx.execute(sql.raw(`SET ROLE system_admin`));

      logger.debug('System admin transaction started (RLS bypassed)');

      const result = await cb(tx);

      // Reset role back to default
      await tx.execute(sql.raw(`RESET ROLE`));

      logger.debug('System admin transaction completed, role reset');

      return result;
    } catch (error) {
      // Don't try to reset role if transaction is already aborted
      // The role will be reset when the transaction is rolled back
      logger.error('System admin transaction failed:', error);
      throw error;
    }
  });
};

/**
 * Execute a database transaction as system (for event sourcing writes)
 * Only use this for internal system operations like event store writes
 */
export const systemTx = <T>(
  db: PostgresDb,
  cb: (
    tx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
  ) => T | Promise<T>,
): Promise<T> => {
  return db.transaction(async (tx) => {
    try {
      // Set role to system for event sourcing operations
      await tx.execute(sql.raw(`SET ROLE system`));

      logger.debug('System transaction started (for event sourcing)');

      const result = await cb(tx);

      // Reset role back to default
      await tx.execute(sql.raw(`RESET ROLE`));

      logger.debug('System transaction completed, role reset');

      return result;
    } catch (error) {
      // Don't try to reset role if transaction is already aborted
      // The role will be reset when the transaction is rolled back
      logger.error('System transaction failed:', error);
      throw error;
    }
  });
};

/**
 * Execute a database operation without RLS context (for public data)
 * Use this for operations that don't require organization isolation
 */
export const publicTx = <T>(
  db: PostgresDb,
  cb: (
    tx: PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >,
  ) => T | Promise<T>,
): Promise<T> => {
  return db.transaction(async (tx) => {
    try {
      // Clear any existing RLS context
      await tx.execute(sql.raw(`RESET app.current_organization_id`));
      await tx.execute(sql.raw(`RESET app.current_user_id`));
      await tx.execute(sql.raw(`RESET app.current_session_id`));

      logger.debug('Public transaction started (no RLS context)');

      return await cb(tx);
    } catch (error) {
      logger.error('Public transaction failed:', error);
      throw error;
    }
  });
};

/**
 * Helper function to get current RLS context from database session
 */
export const getCurrentRLSContext = async (
  db: PostgresDb,
): Promise<{
  organizationId?: string;
  userId?: string;
  sessionId?: string;
}> => {
  try {
    const [orgResult] = (await db.execute(
      sql.raw(
        `SELECT current_setting('app.current_organization_id', true) as org_id`,
      ),
    )) as Array<{ org_id: string }>;
    const [userResult] = (await db.execute(
      sql.raw(`SELECT current_setting('app.current_user_id', true) as user_id`),
    )) as Array<{ user_id: string }>;
    const [sessionResult] = (await db.execute(
      sql.raw(
        `SELECT current_setting('app.current_session_id', true) as session_id`,
      ),
    )) as Array<{ session_id: string }>;

    return {
      organizationId: orgResult?.org_id || undefined,
      userId: userResult?.user_id || undefined,
      sessionId: sessionResult?.session_id || undefined,
    };
  } catch (error) {
    logger.error('Failed to get RLS context:', error);
    return {};
  }
};
