import {
  pgEnum,
  pgTable,
  uuid,
  pgPolicy,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { organization } from './organization';
import { user } from './user';
import { UserRole } from '../types/user-role.enum';
import { authenticatedRole, systemAdminRole, systemRole } from './rls-roles';

export const userRoleEnum = pgEnum(
  'user_role',
  Object.values(UserRole) as [string, ...string[]],
);

export const userOrganizationRole = pgTable(
  'user_organization_role',
  {
    userId: uuid('user_id')
      .references(() => user.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organization.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    role: userRoleEnum('role').notNull(),
  },
  (table) => [
    // Composite primary key
    primaryKey({ columns: [table.userId, table.organizationId] }),

    // RLS Policies
    // Users can only see roles within their organization
    pgPolicy('user_org_role_select_organization', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid`,
    }),

    // Only organization owners can manage roles in their organization
    pgPolicy('user_org_role_manage_owner_only', {
      for: 'all',
      to: authenticatedRole,
      using: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid AND current_setting('app.current_user_role', true) = 'organization_owner'`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid AND current_setting('app.current_user_role', true) = 'organization_owner'`,
    }),

    // System can manage all roles (for invitation/registration process)
    pgPolicy('user_org_role_system_full_access', {
      for: 'all',
      to: systemRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),

    // System admins have full access
    pgPolicy('user_org_role_system_admin_full_access', {
      for: 'all',
      to: systemAdminRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();

export type UserOrganizationRole = typeof userOrganizationRole.$inferSelect;
export type UserOrganizationRoleInsert =
  typeof userOrganizationRole.$inferInsert;
