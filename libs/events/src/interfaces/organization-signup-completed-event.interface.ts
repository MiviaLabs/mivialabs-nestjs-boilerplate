export interface OrganizationSignupCompletedEventPayload {
  userId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug?: string;
  userRole: string;
  signupMethod: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
