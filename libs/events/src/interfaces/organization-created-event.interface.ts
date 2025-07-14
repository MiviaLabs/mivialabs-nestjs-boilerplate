import { BaseEventPayload } from './base-event-payload.interface';

export interface OrganizationCreatedEventPayload extends BaseEventPayload {
  eventType: 'OrganizationCreatedEvent';
  aggregateType: 'Organization';
  data: {
    organizationId: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdBy: string;
  };
}
