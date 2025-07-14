import { BaseEventPayload } from './base-event-payload.interface';

export interface OrganizationDeletedEventPayload extends BaseEventPayload {
  eventType: 'OrganizationDeletedEvent';
  aggregateType: 'Organization';
  data: {
    organizationId: string;
    name: string;
    description: string | null;
    isActive: boolean;
    deletedBy: string;
    deletedAt: string;
  };
}
