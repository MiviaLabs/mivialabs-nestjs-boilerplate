import { BaseEventPayload } from './base-event-payload.interface';

export interface OrganizationUpdatedEventPayload extends BaseEventPayload {
  eventType: 'OrganizationUpdatedEvent';
  aggregateType: 'Organization';
  data: {
    organizationId: string;
    previousValues: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
    };
    updatedValues: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
    };
    updatedBy: string;
  };
}
