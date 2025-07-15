import { LogoutReason } from '@db/postgres/types/logout-reason.enum';

export interface UserLogoutEventPayload {
  userId: string;
  organizationId?: string;
  sessionId?: string;
  reason: LogoutReason;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
