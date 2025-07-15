import { Inject, Injectable } from '@nestjs/common';

import { EventInsert, PostgresDb, Tx, event, Event } from '@db';

@Injectable()
export class EventRepository {
  constructor(@Inject('DB') private readonly db: PostgresDb) {}

  async saveEvent(eventData: EventInsert, tx?: Tx): Promise<Event> {
    const db = tx || this.db;

    const [savedEvent] = await db.insert(event).values(eventData).returning();

    if (!savedEvent) {
      throw new Error('Failed to save event');
    }

    return savedEvent;
  }
}
