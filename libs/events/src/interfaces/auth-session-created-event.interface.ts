export interface AuthSessionCreatedEventPayload {
  userId: string;
  organizationId?: string;
  sessionId: string;
  accessTokenId?: string;
  refreshTokenId?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  timestamp: Date;
}
