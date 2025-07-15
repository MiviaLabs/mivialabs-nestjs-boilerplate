import { boolean, pgTable, text, uuid, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { timestamps } from '../helpers';
import { organization } from './organization';
import { authenticatedRole, systemAdminRole, systemRole } from './rls-roles';

export const user = pgTable(
  'user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'cascade',
    }),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').default(sql`NULL`), // For hashed passwords
    isActive: boolean('is_active').notNull().default(false),
    isEmailVerified: boolean('is_email_verified').notNull().default(false),
    isSystemAdmin: boolean('is_system_admin').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    // RLS Policies
    // Users can only see users from their organization
    pgPolicy('user_select_organization', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid`,
    }),

    // Users can only update their own profile (except system admins)
    pgPolicy('user_update_self', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${table.id} = current_setting('app.current_user_id')::uuid`,
      withCheck: sql`${table.id} = current_setting('app.current_user_id')::uuid`,
    }),

    // Only system can create users (during registration/invitation process)
    pgPolicy('user_insert_system_only', {
      for: 'insert',
      to: systemRole,
      withCheck: sql`true`,
    }),

    // System admins have full access
    pgPolicy('user_system_admin_full_access', {
      for: 'all',
      to: systemAdminRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();

export type User = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;
