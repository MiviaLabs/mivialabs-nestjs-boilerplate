import { boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from '../helpers';

export const organization = pgTable('organization', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps
});