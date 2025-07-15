import { LoginMethod } from '@db/postgres/types/login-method.enum';

export interface UserLoggedInEventPayload {
  userId: string;
  organizationId?: string;
  loginMethod: LoginMethod;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  timestamp: Date;
}
