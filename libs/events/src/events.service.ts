import { Injectable } from '@nestjs/common';

import { EventRepository } from './repositories';
import { EventInsert, Tx, Event } from '@db';
import { EventContext } from './interfaces/event-context.interface';

export { EventContext };

@Injectable()
export class EventsService {
  constructor(private readonly eventRepository: EventRepository) {}

  async saveEvent(eventData: EventInsert, tx?: Tx): Promise<Event> {
    return this.eventRepository.saveEvent(eventData, tx);
  }

  /**
   * Save an audit event with context information
   * This method is used by auth handlers to log security-related events
   */
  async saveAuditEvent(
    context: EventContext,
    eventPayload: any,
    tx?: Tx,
  ): Promise<Event> {
    // Transform the event payload into EventInsert format
    const eventData: EventInsert = {
      organizationId: context.organizationId || null,
      eventType: eventPayload.eventType || 'audit_event',
      aggregateId: eventPayload.aggregateId || context.userId || '',
      aggregateType: eventPayload.aggregateType || 'user',
      sequenceNumber: 1, // For audit events, we'll use a simple sequence
      eventData: {
        ...eventPayload,
        context: {
          sessionId: context.sessionId,
          correlationId: context.correlationId,
          causationId: context.causationId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      },
      userId: context.userId || null,
      sessionId: context.sessionId || null,
      correlationId: context.correlationId || null,
      causationId: context.causationId || null,
    };

    return this.eventRepository.saveEvent(eventData, tx);
  }
}
