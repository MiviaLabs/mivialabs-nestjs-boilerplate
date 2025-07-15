export interface SessionExpiredEventPayload {
  userId: string;
  organizationId?: string;
  sessionId: string;
  tokenId?: string;
  expiredAt: Date;
  lastActivity?: Date;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
