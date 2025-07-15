import { LoginFailureReason } from '@db/postgres/types/login-failure-reason.enum';

export interface UserLoginFailedEventPayload {
  email: string;
  organizationId?: string;
  reason: LoginFailureReason;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
