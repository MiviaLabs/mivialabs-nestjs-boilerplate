import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { EventInsert, PostgresDb, Tx, event, Event } from '@db';

@Injectable()
export class EventRepository {
  constructor(@Inject('DB') public readonly db: PostgresDb) {}

  async saveEvent(eventData: EventInsert, tx?: Tx): Promise<Event> {
    if (tx) {
      const [savedEvent] = await tx.insert(event).values(eventData).returning();
      if (!savedEvent) {
        throw new Error('Failed to save event');
      }
      return savedEvent;
    } else {
      // Create a new transaction with system role
      return await this.db.transaction(async (txn) => {
        await txn.execute(sql`SET LOCAL ROLE system`);
        const [savedEvent] = await txn
          .insert(event)
          .values(eventData)
          .returning();
        if (!savedEvent) {
          throw new Error('Failed to save event');
        }
        return savedEvent;
      });
    }
  }
}
