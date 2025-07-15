import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Injectable,
  Inject,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, sql } from 'drizzle-orm';
import { PostgresDb } from '@db/postgres/types/postgres-db.type';
import { refreshToken } from '@db/postgres/schema/refresh-token';
import { user, User } from '@db/postgres/schema/user';
import { EventsService, EventContext } from '@events';
import { JwtService } from '../../services/jwt.service';
import { PasswordService } from '../../services/password.service';
import { LogoutUserCommand } from '../logout-user.command';
import { LogoutReason } from '@db';
import {
  UserLogoutEventPayload,
  RefreshTokenRevokedEventPayload,
  AuthSessionEndedEventPayload,
} from '@events';

@CommandHandler(LogoutUserCommand)
@Injectable()
export class LogoutUserHandler implements ICommandHandler<LogoutUserCommand> {
  private readonly logger = new Logger(LogoutUserHandler.name);

  constructor(
    @Inject('DB') private readonly db: PostgresDb,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly eventsService: EventsService,
  ) {}

  async execute(
    command: LogoutUserCommand,
  ): Promise<{ success: boolean; message: string }> {
    const {
      refreshToken: refreshTokenValue,
      sessionId,
      correlationId,
      causationId,
      ipAddress,
      userAgent,
    } = command;
    const internalCorrelationId = correlationId || uuidv4();

    const context: Omit<EventContext, 'userId' | 'organizationId'> = {
      sessionId,
      correlationId: internalCorrelationId,
      causationId,
      ipAddress,
      userAgent,
    };

    try {
      // Validate and decode the refresh token
      const tokenValidation =
        await this.jwtService.validateRefreshToken(refreshTokenValue);

      if (
        !tokenValidation.isValid ||
        !tokenValidation.userId ||
        !tokenValidation.organizationId ||
        !tokenValidation.tokenId
      ) {
        this.logger.warn('Invalid refresh token provided for logout');
        throw new UnauthorizedException('Invalid refresh token');
      }

      const { userId, organizationId, tokenId } = tokenValidation;

      // Find the refresh token in database
      const storedTokens = await this.db
        .select()
        .from(refreshToken)
        .where(
          and(
            eq(refreshToken.id, tokenId),
            eq(refreshToken.userId, userId),
            sql`${refreshToken.isRevoked} IS NULL`,
          ),
        )
        .limit(1);

      if (storedTokens.length === 0) {
        this.logger.warn(
          `Refresh token not found or already revoked for user ${userId}`,
        );
        throw new UnauthorizedException(
          'Refresh token not found or already revoked',
        );
      }

      // Get user information for event logging
      const users = await this.db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (users.length === 0) {
        this.logger.warn(`User not found during logout: ${userId}`);
        throw new UnauthorizedException('User not found');
      }

      const userData = users[0]!; // We already checked that users.length > 0
      const contextWithIds: EventContext = {
        ...context,
        userId,
        organizationId,
      };

      // Revoke all user tokens (logout from all devices) - atomic operation
      const revokedTokens = await this.db.transaction(async (tx) => {
        // Get all active tokens for the user
        const userTokens = await tx
          .select()
          .from(refreshToken)
          .where(
            and(
              eq(refreshToken.userId, userId),
              sql`${refreshToken.isRevoked} IS NULL`,
            ),
          );

        // Revoke all tokens
        await tx
          .update(refreshToken)
          .set({
            isRevoked: new Date(),
          })
          .where(
            and(
              eq(refreshToken.userId, userId),
              sql`${refreshToken.isRevoked} IS NULL`,
            ),
          );

        return userTokens;
      });

      // Log events (non-blocking)
      try {
        await Promise.all([
          this.logUserLogout(userData, contextWithIds),
          this.logAuthSessionEnded(userData, contextWithIds),
          ...revokedTokens.map((token) =>
            this.logTokenRevoked(
              token.id,
              userId,
              organizationId,
              'user_logout',
              contextWithIds,
            ),
          ),
        ]);
      } catch (error) {
        this.logger.error(
          'Failed to log logout events - continuing operation',
          error,
        );
      }

      this.logger.log(`User logout successful for user ID: ${userData.id}`);

      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Unexpected error during logout', error);
      throw new UnauthorizedException('Logout failed');
    }
  }

  private async logUserLogout(
    userData: User,
    context: EventContext,
  ): Promise<void> {
    const logoutEvent: UserLogoutEventPayload = {
      userId: userData.id,
      organizationId: userData.organizationId || undefined,
      sessionId: context.sessionId,
      reason: LogoutReason.USER_LOGOUT,
      ipAddress: context.ipAddress
        ? await this.hashData(context.ipAddress)
        : undefined,
      userAgent: context.userAgent
        ? await this.hashData(context.userAgent)
        : undefined,
      timestamp: new Date(),
    };

    try {
      await this.eventsService.saveAuditEvent(context, logoutEvent);
    } catch (error) {
      this.logger.error('Failed to log user logout event', error);
    }
  }

  private async logTokenRevoked(
    tokenId: string,
    userId: string,
    organizationId: string,
    reason: string,
    context: EventContext,
  ): Promise<void> {
    const revokedEvent: RefreshTokenRevokedEventPayload = {
      userId,
      organizationId,
      tokenId,
      reason: reason === 'user_logout' ? 'logout' : 'cleanup',
      ipAddress: context.ipAddress
        ? await this.hashData(context.ipAddress)
        : undefined,
      userAgent: context.userAgent
        ? await this.hashData(context.userAgent)
        : undefined,
      timestamp: new Date(),
    };

    try {
      await this.eventsService.saveAuditEvent(context, revokedEvent);
    } catch (error) {
      this.logger.error('Failed to log token revoked event', error);
    }
  }

  private async logAuthSessionEnded(
    userData: User,
    context: EventContext,
  ): Promise<void> {
    const sessionEndedEvent: AuthSessionEndedEventPayload = {
      userId: userData.id,
      organizationId: userData.organizationId || undefined,
      sessionId: context.sessionId || 'unknown',
      reason: LogoutReason.USER_LOGOUT,
      duration: undefined, // TODO: Calculate from session start
      ipAddress: context.ipAddress
        ? await this.hashData(context.ipAddress)
        : undefined,
      userAgent: context.userAgent
        ? await this.hashData(context.userAgent)
        : undefined,
      timestamp: new Date(),
    };

    try {
      await this.eventsService.saveAuditEvent(context, sessionEndedEvent);
    } catch (error) {
      this.logger.error('Failed to log auth session ended event', error);
    }
  }

  private async hashData(data: string): Promise<string> {
    return this.passwordService.hashPassword(data);
  }
}
