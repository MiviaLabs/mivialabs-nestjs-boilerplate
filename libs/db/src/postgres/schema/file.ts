import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  index,
  uniqueIndex,
  pgPolicy,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organization } from './organization';
import { timestamps } from '../helpers';
import { authenticatedRole, systemAdminRole } from './rls-roles';
import { user } from './user';

export const file = pgTable(
  'file',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organization.id, { onDelete: 'restrict' })
      .notNull(),
    bucket: text('bucket').notNull(),
    path: text('path').notNull(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    checksum: text('checksum'), // For file integrity verification
    isPublic: boolean('is_public').notNull().default(false),
    uploadedBy: uuid('uploaded_by')
      .references(() => user.id, {
        onDelete: 'set null',
      })
      .default(sql`NULL`), // Track who uploaded the file
    ...timestamps,
  },
  (table) => [
    index('file_organization_id_idx').on(table.organizationId),
    index('file_bucket_idx').on(table.bucket),
    index('file_mime_type_idx').on(table.mimeType),
    index('file_created_at_idx').on(table.createdAt),
    index('file_uploaded_by_idx').on(table.uploadedBy),
    index('file_public_idx').on(table.isPublic),

    uniqueIndex('file_organization_bucket_path_unique').on(
      table.organizationId,
      table.bucket,
      table.path,
    ),

    // RLS Policies
    pgPolicy('file_select_organization', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid`,
    }),

    pgPolicy('file_insert_organization', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid`,
    }),

    pgPolicy('file_update_organization', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid`,
    }),

    pgPolicy('file_delete_organization', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`${table.organizationId} = current_setting('app.current_organization_id')::uuid`,
    }),

    // Public files can be viewed by anyone (for CDN/public assets)
    pgPolicy('file_select_public', {
      for: 'select',
      to: 'public',
      using: sql`${table.isPublic} = true`,
    }),

    pgPolicy('file_system_admin_full_access', {
      for: 'all',
      to: systemAdminRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();

export type File = typeof file.$inferSelect;
export type FileInsert = typeof file.$inferInsert;
