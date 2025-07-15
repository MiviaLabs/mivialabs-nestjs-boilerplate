import { UserRole } from '@db';

export interface AuthenticatedUser {
  id: string;
  organizationId: string | null;
  email: string;
  isSystemAdmin: boolean;
  isActive: boolean;
  isEmailVerified: boolean;
  role?: UserRole;
}
