import {
  BaseEventPayload,
  OrganizationCreatedEventPayload,
  OrganizationUpdatedEventPayload,
  OrganizationDeletedEventPayload,
} from '../interfaces';

export type EventPayload =
  | BaseEventPayload
  | OrganizationCreatedEventPayload
  | OrganizationUpdatedEventPayload
  | OrganizationDeletedEventPayload;
