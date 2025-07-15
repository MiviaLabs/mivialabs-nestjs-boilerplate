import { pgRole } from 'drizzle-orm/pg-core';

// Define roles for RLS
// All authenticated users (ORGANIZATION_OWNER, ORGANIZATION_MEMBER) use 'authenticated' role
// Only SYSTEM_ADMIN users use 'system_admin' role
// System processes use 'system' role for event sourcing writes
export const authenticatedRole = pgRole('authenticated');
export const systemAdminRole = pgRole('system_admin');
export const systemRole = pgRole('system');
