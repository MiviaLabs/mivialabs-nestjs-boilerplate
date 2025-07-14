import { pgRole } from 'drizzle-orm/pg-core';

// Define roles for RLS
export const authenticatedRole = pgRole('authenticated');
export const systemAdminRole = pgRole('system_admin');
