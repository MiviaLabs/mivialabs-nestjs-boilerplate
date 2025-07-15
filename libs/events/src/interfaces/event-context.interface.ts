export interface EventContext {
  sessionId?: string;
  correlationId: string;
  causationId?: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  organizationId?: string;
}
