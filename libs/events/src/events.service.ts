import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { EventRepository } from './repositories';
import { EventInsert, Tx, Event, event, systemTx } from '@db';
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
    const aggregateId = eventPayload.aggregateId || context.userId;

    // Skip event creation if no valid aggregateId is available
    if (!aggregateId || aggregateId.trim() === '') {
      return {} as Event; // Return empty event object for non-critical events
    }

    // Retry mechanism for sequence conflicts
    const maxRetries = 5;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // If we already have a transaction, use it, otherwise create a new one
        // The sequence number query and event insert must happen in the same transaction
        // with the system role set
        if (tx) {
          // Ensure system role is set before any event table operations
          try {
            await tx.execute(sql.raw(`SET ROLE system`));
          } catch {
            throw new Error('Failed to set system role for event saving');
          }

          // We're already in a transaction, get sequence number and save event
          const sequenceNumber = await this.getNextSequenceNumber(
            aggregateId,
            tx,
          );

          const eventData: EventInsert = {
            organizationId: context.organizationId || null,
            eventType: eventPayload.eventType || 'audit_event',
            aggregateId,
            aggregateType: eventPayload.aggregateType || 'user',
            sequenceNumber,
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
        } else {
          // Use systemTx for proper role management in event sourcing
          const db = this.eventRepository['db'];
          return await systemTx(db, async (txn) => {
            // Get sequence number within the transaction
            const sequenceNumber = await this.getNextSequenceNumber(
              aggregateId,
              txn,
            );

            // Create event data
            const eventData: EventInsert = {
              organizationId: context.organizationId || null,
              eventType: eventPayload.eventType || 'audit_event',
              aggregateId,
              aggregateType: eventPayload.aggregateType || 'user',
              sequenceNumber,
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

            // Insert the event
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
      } catch (error) {
        lastError = error as Error;

        // Check if it's a sequence conflict error
        const isDuplicateSequence =
          (error as any)?.message?.includes(
            'event_aggregate_sequence_unique',
          ) || (error as any)?.code === '23505';

        if (isDuplicateSequence && attempt < maxRetries) {
          // Wait a bit before retrying with exponential backoff
          const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Failed to save event after all retries');
  }

  /**
   * Get the next sequence number for an aggregate
   * This ensures proper event ordering and prevents duplicate sequence numbers
   * Gets the current max sequence number for the aggregate and increments by 1
   * MUST be called within a transaction with system role already set
   */
  private async getNextSequenceNumber(
    aggregateId: string,
    tx: Tx,
  ): Promise<number> {
    // Validate aggregateId
    if (!aggregateId || aggregateId.trim() === '') {
      throw new Error(
        'Invalid aggregateId provided for sequence number generation',
      );
    }

    // Use a simple hash function to generate a consistent lock ID for each aggregateId
    // This ensures the same aggregateId always gets the same lock
    let hash = 0;
    for (let i = 0; i < aggregateId.length; i++) {
      const char = aggregateId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const lockId = Math.abs(hash) % 2147483647;

    // Use PostgreSQL advisory lock to ensure atomicity
    const result = await tx.execute(
      sql`
        WITH 
        advisory_lock AS (
          SELECT pg_advisory_xact_lock(${lockId})
        ),
        max_seq AS (
          SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_number
          FROM event 
          WHERE aggregate_id = ${aggregateId}
        )
        SELECT next_number FROM max_seq
      `,
    );

    const sequenceNumber =
      (result[0] as { next_number: number })?.next_number || 1;

    return sequenceNumber;
  }
}
