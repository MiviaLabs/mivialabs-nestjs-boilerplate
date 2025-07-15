import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import {
  PostgresDb,
  user,
  organization,
  userOrganizationRole,
  UserRole,
} from '@db';
import { TokenType } from '../../modules/auth/enums/token-type.enum';

/**
 * JWT Payload interface
 */
export interface JwtPayload {
  sub: string; // User ID
  email?: string;
  organizationId?: string;
  role?: UserRole;
  isSystemAdmin?: boolean;
  iat: number;
  exp: number;
  type?: TokenType; // Token type for validation
}

/**
 * Authenticated User interface - same as in jwt-auth.guard.ts for consistency
 */
export interface AuthenticatedUser {
  id: string;
  organizationId: string | null;
  email: string;
  isSystemAdmin: boolean;
  isActive: boolean;
  isEmailVerified: boolean;
  role?: UserRole;
}

/**
 * JWT Strategy using Passport
 *
 * This strategy validates JWT tokens and ensures both user and organization are active.
 * It fetches user details from the database and validates their status.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject('DB') private readonly db: PostgresDb,
    private readonly configService: ConfigService,
  ) {
    // Use JWT_SECRET for all JWT operations
    const jwtSecret = configService.getOrThrow<string>('JWT_SECRET');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validates the JWT payload and returns the authenticated user
   *
   * @param payload - JWT payload containing user information
   * @returns Promise<AuthenticatedUser> - The authenticated user object
   * @throws UnauthorizedException if validation fails
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const userId = payload.sub;

    if (!userId) {
      throw new UnauthorizedException('Invalid token: missing user ID');
    }

    // Validate that this is an access token, not a refresh token
    if (payload.type && payload.type !== TokenType.ACCESS) {
      throw new UnauthorizedException(
        'Invalid token type: only access tokens are accepted',
      );
    }

    try {
      // Fetch user details from database
      const userResult = await this.db
        .select({
          id: user.id,
          email: user.email,
          organizationId: user.organizationId,
          isActive: user.isActive,
          isEmailVerified: user.isEmailVerified,
          isSystemAdmin: user.isSystemAdmin,
          // Organization details
          orgIsActive: organization.isActive,
          orgName: organization.name,
        })
        .from(user)
        .leftJoin(organization, eq(user.organizationId, organization.id))
        .where(eq(user.id, userId))
        .limit(1);

      const dbUser = userResult[0];

      if (!dbUser) {
        throw new UnauthorizedException('User not found');
      }

      // Validate user is active
      if (!dbUser.isActive) {
        throw new UnauthorizedException('User account is inactive');
      }

      // Validate organization is active (if user belongs to an organization)
      if (dbUser.organizationId && !dbUser.orgIsActive) {
        throw new UnauthorizedException('Organization is inactive');
      }

      // Get user role in organization (if user has an organization)
      let userRole: UserRole | undefined;
      if (dbUser.organizationId) {
        const roleResult = await this.db
          .select({
            role: userOrganizationRole.role,
          })
          .from(userOrganizationRole)
          .where(
            and(
              eq(userOrganizationRole.userId, userId),

              eq(userOrganizationRole.organizationId, dbUser.organizationId),
            ),
          )
          .limit(1);

        userRole = roleResult[0]?.role as UserRole;
      }

      // System admins have implicit SYSTEM_ADMIN role
      if (dbUser.isSystemAdmin) {
        userRole = UserRole.SYSTEM_ADMIN;
      }

      // Create authenticated user object
      const authenticatedUser: AuthenticatedUser = {
        id: dbUser.id,
        organizationId: dbUser.organizationId,
        email: dbUser.email,
        isSystemAdmin: dbUser.isSystemAdmin,
        isActive: dbUser.isActive,
        isEmailVerified: dbUser.isEmailVerified,
        role: userRole,
      };

      return authenticatedUser;
    } catch (error) {
      // Log error for debugging but don't expose internal details
      console.error('JWT Strategy validation error:', error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Authentication failed');
    }
  }
}
