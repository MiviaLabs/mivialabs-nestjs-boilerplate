import { BaseEventPayload } from './base-event-payload.interface';

export interface UserCreatedEventPayload extends BaseEventPayload {
  eventType: 'UserCreatedEvent';
  aggregateType: 'User';
  data: {
    userId: string;
    organizationId: string;
    email: string;
    isActive: boolean;
    isEmailVerified: boolean;
    isSystemAdmin: boolean;
    timestamp: Date;
  };
}
