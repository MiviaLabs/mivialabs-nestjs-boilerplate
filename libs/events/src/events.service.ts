import { Injectable } from '@nestjs/common';
import { EventRepository } from './repositories';

@Injectable()
export class EventsService {
  constructor(private readonly eventRepository: EventRepository) {}
}
