import { boolean, pgTable, text, uuid, pgPolicy } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { timestamps } from '../helpers';
import { authenticatedRole, systemAdminRole } from './rls-roles';

export const organization = pgTable(
  'organization',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description').default(sql`NULL`),
    isActive: boolean('is_active').notNull().default(false),
    ...timestamps,
  },
  () => [
    // RLS Policies
    pgPolicy('organization_select_authenticated', {
      for: 'select',
      to: authenticatedRole,
      using: sql`true`, // Allow all authenticated users to select organizations
    }),

    pgPolicy('organization_update_owner_only', {
      for: 'update',
      to: authenticatedRole,
      using: sql`current_setting('app.current_user_role', true) = 'organization_owner'`,
      withCheck: sql`current_setting('app.current_user_role', true) = 'organization_owner'`,
    }),

    pgPolicy('organization_system_admin_full_access', {
      for: 'all',
      to: systemAdminRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();

export type Organization = typeof organization.$inferSelect;
export type OrganizationInsert = typeof organization.$inferInsert;
