export interface RefreshTokenRevokedEventPayload {
  userId: string;
  organizationId?: string;
  tokenId: string;
  reason: string;
  revokedBy?: string; // userId of admin who revoked it, if applicable
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
