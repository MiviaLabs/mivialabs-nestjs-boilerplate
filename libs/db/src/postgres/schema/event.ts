import {
  pgTable,
  text,
  uuid,
  jsonb,
  integer,
  index,
  pgPolicy,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { timestamps } from '../helpers';
import { organization } from './organization';
import { authenticatedRole, systemAdminRole } from './rls-roles';
import type { EventPayload } from '@events';

export const event = pgTable(
  'event',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Event identification
    eventType: text('event_type').notNull(), // e.g., 'UserCreatedEvent', 'UserLoggedInEvent'
    eventVersion: text('event_version').notNull().default('1.0'), // For event schema versioning

    // Aggregate information
    aggregateId: uuid('aggregate_id').notNull(), // ID of the entity the event relates to (e.g., userId)
    aggregateType: text('aggregate_type').notNull(), // e.g., 'User', 'Order', 'Product'
    aggregateVersion: integer('aggregate_version').notNull().default(1), // Version of the aggregate

    // Event data
    eventData: jsonb('event_data').$type<EventPayload>().notNull(), // The actual event payload as JSON
    metadata: jsonb('metadata'), // Additional metadata (IP, user agent, correlation ID, etc.)

    // Event sourcing fields
    sequenceNumber: integer('sequence_number').notNull(), // Order of events for the aggregate
    causationId: uuid('causation_id'), // ID of the command that caused this event
    correlationId: uuid('correlation_id'), // ID to correlate related events across aggregates

    // Organization context (optional for system-wide events)
    organizationId: uuid('organization_id').references(() => organization.id, {
      onDelete: 'cascade',
    }),

    // Audit fields
    userId: uuid('user_id'), // User who triggered the event (if applicable)
    sessionId: text('session_id'), // Session that triggered the event

    ...timestamps,
  },
  (table) => [
    // Unique constraint for event sourcing - ensures no duplicate sequence numbers per aggregate
    uniqueIndex('event_aggregate_sequence_unique').on(
      table.aggregateId,
      table.sequenceNumber,
    ),

    // Indexes for efficient querying
    index('event_aggregate_id_idx').on(table.aggregateId),
    index('event_type_idx').on(table.eventType),
    index('event_aggregate_type_idx').on(table.aggregateType),
    index('event_correlation_id_idx').on(table.correlationId),
    index('event_created_at_idx').on(table.createdAt),
    index('event_organization_id_idx').on(table.organizationId),

    // Composite indexes for common queries
    index('event_aggregate_events_idx').on(
      table.aggregateId,
      table.aggregateType,
      table.sequenceNumber,
    ),
    index('event_type_time_idx').on(table.eventType, table.createdAt),

    // RLS Policies
    pgPolicy('event_select_organization', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.organizationId} IS NULL OR ${table.organizationId} = current_setting('app.current_organization_id')::uuid`,
    }),

    pgPolicy('event_insert_organization', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${table.organizationId} IS NULL OR ${table.organizationId} = current_setting('app.current_organization_id')::uuid`,
    }),

    pgPolicy('event_system_admin_full_access', {
      for: 'all',
      to: systemAdminRole,
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
).enableRLS();

export type Event = typeof event.$inferSelect;
export type NewEvent = typeof event.$inferInsert;
