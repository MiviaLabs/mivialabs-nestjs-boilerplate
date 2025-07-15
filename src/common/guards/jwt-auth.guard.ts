import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { eq, sql, and } from 'drizzle-orm';
import { PostgresDb, user, User, userOrganizationRole, UserRole } from '@db';

export interface AuthenticatedUser {
  id: string;
  organizationId: string | null;
  email: string;
  isSystemAdmin: boolean;
  isActive: boolean;
  isEmailVerified: boolean;
  role?: UserRole;
}

interface JwtPayload {
  sub?: string;
  userId?: string;
  organizationId?: string;
  role?: UserRole;
  isSystemAdmin?: boolean;
  iat: number;
  exp: number;
}

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

/**
 * JWT Authentication Guard
 *
 * @description Guards routes that require JWT authentication and sets RLS context
 * @implements CanActivate from @nestjs/common
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject('DB') private readonly db: PostgresDb) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token not found');
    }

    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new UnauthorizedException('JWT secret not configured');
      }

      // Verify and decode the JWT token
      const payload = jwt.verify(token, jwtSecret) as JwtPayload;

      // Get user details from database
      const authenticatedUser = await this.getUserFromDatabase(payload);

      // Set RLS context if user has an organization
      if (authenticatedUser.organizationId) {
        await this.setRLSContext(
          authenticatedUser.organizationId,
          authenticatedUser.id,
          authenticatedUser.role,
        );
      }

      // Attach user to request object
      request.user = authenticatedUser;

      return true;
    } catch {
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Extract JWT token from Authorization header
   *
   * @param request - Express request object
   * @returns JWT token string or undefined
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }

    const token = authHeader.substring(7).trim();
    return token || undefined;
  }

  /**
   * Get user details from database using JWT payload
   *
   * @param payload - JWT payload
   * @returns Promise<AuthenticatedUser>
   */
  private async getUserFromDatabase(
    payload: JwtPayload,
  ): Promise<AuthenticatedUser> {
    const userId = payload.sub || payload.userId;

    if (!userId) {
      throw new UnauthorizedException('Authentication failed');
    }

    try {
      // Get user details
      const userResult = await this.db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      const dbUser: User | undefined = userResult[0];

      if (!dbUser) {
        throw new UnauthorizedException('User not found');
      }

      if (!dbUser.isActive) {
        throw new UnauthorizedException('User account is inactive');
      }

      // Get user role in organization (if user has an organization)
      let userRole: UserRole | undefined;
      if (dbUser.organizationId) {
        const roleResult = await this.db
          .select()
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

      // Map database user to AuthenticatedUser
      const authenticatedUser: AuthenticatedUser = {
        id: dbUser.id,
        organizationId: dbUser.organizationId,
        email: dbUser.email,
        isSystemAdmin: dbUser.isSystemAdmin,
        isActive: dbUser.isActive,
        isEmailVerified: dbUser.isEmailVerified,
        role:
          userRole ||
          (dbUser.isSystemAdmin ? UserRole.SYSTEM_ADMIN : undefined),
      };

      return authenticatedUser;
    } catch (error) {
      console.error('Database error during authentication:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Set RLS context for the current database connection
   * This allows RLS policies to work for the authenticated user
   *
   * @param organizationId - User's organization ID
   * @param userId - User's ID
   * @param userRole - User's role in the organization
   */
  private async setRLSContext(
    organizationId: string,
    userId: string,
    userRole?: UserRole,
  ): Promise<void> {
    try {
      // Set organization context for RLS policies
      await this.db.execute(
        sql`SET app.current_organization_id = ${organizationId}`,
      );

      // Set user context for audit trails
      await this.db.execute(sql`SET app.current_user_id = ${userId}`);

      // Set user role context for role-based policies
      if (userRole) {
        await this.db.execute(sql`SET app.current_user_role = ${userRole}`);
      }
    } catch (error) {
      // Log error but don't fail authentication - RLS context is nice-to-have
      console.error('Failed to set RLS context:', error);
    }
  }
}
