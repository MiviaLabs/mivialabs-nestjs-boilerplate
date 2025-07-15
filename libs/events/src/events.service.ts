import { Injectable } from '@nestjs/common';

import { EventRepository } from './repositories';
import { EventInsert, Tx, Event } from '@db';

@Injectable()
export class EventsService {
  constructor(private readonly eventRepository: EventRepository) {}

  async saveEvent(eventData: EventInsert, tx?: Tx): Promise<Event> {
    return this.eventRepository.saveEvent(eventData, tx);
  }
}
