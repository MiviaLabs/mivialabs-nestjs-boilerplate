export interface TokenRefreshedEventPayload {
  userId: string;
  organizationId?: string;
  oldTokenId: string;
  newTokenId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
