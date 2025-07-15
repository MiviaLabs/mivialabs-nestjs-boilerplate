import {
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { timestamps } from '../helpers';
import { user } from './user';
import { organization } from './organization';
import { authenticatedRole, systemAdminRole, systemRole } from './rls-roles';

export const refreshToken = pgTable(
  'refresh_token',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organization.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    isRevoked: timestamp('is_revoked', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // Performance indexes
    index('refresh_token_user_id_idx').on(table.userId),
    index('refresh_token_organization_id_idx').on(table.organizationId),
    index('refresh_token_expires_at_idx').on(table.expiresAt),
    index('refresh_token_token_hash_idx').on(table.tokenHash),

    // RLS Policies - tokens are tied to specific users within organizations
    pgPolicy('refresh_token_select_organization', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid AND ${table.userId} = current_setting('app.current_user_id')::uuid`,
    }),

    pgPolicy('refresh_token_insert_organization', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid AND ${table.userId} = current_setting('app.current_user_id')::uuid`,
    }),

    pgPolicy('refresh_token_update_organization', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid AND ${table.userId} = current_setting('app.current_user_id')::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid AND ${table.userId} = current_setting('app.current_user_id')::uuid`,
    }),

    pgPolicy('refresh_token_delete_organization', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid AND ${table.userId} = current_setting('app.current_user_id')::uuid`,
    }),

    // System admin full access for maintenance operations
    pgPolicy('refresh_token_system_admin_full_access', {
      for: 'all',
      to: systemAdminRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),

    // Allow system role access for authentication operations (safer than public)
    pgPolicy('refresh_token_system_auth_access', {
      for: 'select',
      to: systemRole,
      using: sql`true`,
    }),
  ],
).enableRLS();

export type RefreshToken = typeof refreshToken.$inferSelect;
export type RefreshTokenInsert = typeof refreshToken.$inferInsert;
