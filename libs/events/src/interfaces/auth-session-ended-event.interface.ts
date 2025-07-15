import { LogoutReason } from '@db/postgres/types/logout-reason.enum';

export interface AuthSessionEndedEventPayload {
  userId: string;
  organizationId?: string;
  sessionId: string;
  reason: LogoutReason;
  duration?: number; // session duration in seconds
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
