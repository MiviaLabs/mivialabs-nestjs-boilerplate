import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Injectable,
  Inject,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, sql } from 'drizzle-orm';
import { PostgresDb } from '@db/postgres/types/postgres-db.type';
import { refreshToken } from '@db/postgres/schema/refresh-token';
import { user, User } from '@db/postgres/schema/user';
import { EventsService, EventContext } from '@events';
import { JwtService } from '../../services/jwt.service';
import { PasswordService } from '../../services/password.service';
import { RefreshTokensCommand } from '../refresh-tokens.command';
import { JwtTokenPair } from '../../interfaces/jwt-payload.interface';
import {
  TokenRefreshedEventPayload,
  RefreshTokenRevokedEventPayload,
  SessionExpiredEventPayload,
} from '@events';

@CommandHandler(RefreshTokensCommand)
@Injectable()
export class RefreshTokensHandler
  implements ICommandHandler<RefreshTokensCommand>
{
  private readonly logger = new Logger(RefreshTokensHandler.name);

  constructor(
    @Inject('DB') private readonly db: PostgresDb,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly eventsService: EventsService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: RefreshTokensCommand): Promise<JwtTokenPair> {
    const {
      refreshTokenValue,
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
        await this.logExpiredSession(
          'unknown',
          'Invalid refresh token',
          context,
        );
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
        await this.logExpiredSession(
          userId,
          'Refresh token not found or revoked',
          {
            ...context,
            userId,
            organizationId,
          },
        );
        throw new UnauthorizedException('Refresh token not found or revoked');
      }

      const storedToken = storedTokens[0]!; // We already checked that storedTokens.length > 0

      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        await this.revokeToken(
          tokenId,
          userId,
          organizationId,
          'Token expired',
          {
            ...context,
            userId,
            organizationId,
          },
        );
        throw new UnauthorizedException('Refresh token expired');
      }

      // Verify the token hash
      const isTokenValid = await this.passwordService.verifyPassword(
        storedToken.tokenHash,
        refreshTokenValue,
      );

      if (!isTokenValid) {
        await this.logExpiredSession(userId, 'Invalid token hash', {
          ...context,
          userId,
          organizationId,
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Get user information
      const users = await this.db
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (users.length === 0) {
        await this.logExpiredSession(userId, 'User not found', {
          ...context,
          userId,
          organizationId,
        });
        throw new UnauthorizedException('User not found');
      }

      const userData = users[0]!;

      // Perform atomic token rotation in transaction
      const { newTokenPair, newRefreshTokenId } = await this.db.transaction(
        async (tx) => {
          // Revoke the old refresh token
          await tx
            .update(refreshToken)
            .set({ isRevoked: new Date() })
            .where(
              and(
                eq(refreshToken.id, tokenId),
                eq(refreshToken.userId, userId),
                sql`${refreshToken.isRevoked} IS NULL`,
              ),
            );

          // Generate new token pair
          const newRefreshTokenId = uuidv4();
          const newTokenPair = await this.jwtService.generateTokenPair(
            userData.id,
            userData.organizationId!,
            newRefreshTokenId,
          );

          // Store new refresh token
          const tokenHash = await this.passwordService.hashPassword(
            newTokenPair.refreshToken,
          );
          const refreshTokenExpiration =
            this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') ||
            '7d';
          const expiresAt = new Date(
            Date.now() + this.parseExpirationToMs(refreshTokenExpiration),
          );

          await tx.insert(refreshToken).values({
            id: newRefreshTokenId,
            userId: userData.id,
            organizationId: userData.organizationId!,
            tokenHash,
            expiresAt,
            isRevoked: null,
          });

          return { newTokenPair, newRefreshTokenId };
        },
      );

      // Log token refresh event (non-blocking)
      try {
        await this.logTokenRefreshed(
          userData,
          newTokenPair,
          tokenId,
          newRefreshTokenId,
          {
            ...context,
            userId,
            organizationId,
          },
        );
      } catch (error) {
        this.logger.error(
          'Failed to log token refresh event - continuing operation',
          error,
        );
      }

      this.logger.log(`Tokens refreshed for user ID: ${userData.id}`);

      return newTokenPair;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Unexpected error during token refresh', error);
      await this.logExpiredSession(
        'unknown',
        'Internal server error during refresh',
        context,
      );
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  private async revokeToken(
    tokenId: string,
    userId: string,
    organizationId: string,
    reason: string,
    context: EventContext,
  ): Promise<void> {
    try {
      // Perform atomic token revocation
      await this.db.transaction(async (tx) => {
        // Update token to revoked status
        await tx
          .update(refreshToken)
          .set({
            isRevoked: new Date(),
          })
          .where(eq(refreshToken.id, tokenId));
      });

      // Log token revocation event (non-blocking)
      try {
        await this.logTokenRevoked(
          tokenId,
          userId,
          organizationId,
          reason,
          context,
        );
      } catch (error) {
        this.logger.error(
          'Failed to log token revocation event - continuing operation',
          error,
        );
      }

      this.logger.log(
        `Refresh token ${tokenId} revoked for user ${userId}: ${reason}`,
      );
    } catch (error) {
      this.logger.error('Failed to revoke refresh token', error);
      throw error;
    }
  }

  private async logTokenRefreshed(
    userData: User,
    tokenPair: JwtTokenPair,
    tokenId: string,
    newRefreshTokenId: string,
    context: EventContext,
  ): Promise<void> {
    const refreshEvent: TokenRefreshedEventPayload = {
      userId: userData.id,
      organizationId: userData.organizationId || undefined,
      oldTokenId: tokenId,
      newTokenId: newRefreshTokenId,
      sessionId: context.sessionId,
      ipAddress: context.ipAddress
        ? await this.hashData(context.ipAddress)
        : undefined,
      userAgent: context.userAgent
        ? await this.hashData(context.userAgent)
        : undefined,
      timestamp: new Date(),
    };

    try {
      await this.eventsService.saveAuditEvent(context, refreshEvent);
    } catch (error) {
      this.logger.error('Failed to log token refreshed event', error);
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
      reason: reason === 'user_logout' ? 'logout' : 'rotation',
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

  private async logExpiredSession(
    userId: string,
    reason: string,
    context: Omit<EventContext, 'userId' | 'organizationId'> | EventContext,
  ): Promise<void> {
    const expiredEvent: SessionExpiredEventPayload = {
      userId: ('userId' in context && context.userId) || userId,
      organizationId:
        ('organizationId' in context && context.organizationId) || undefined,
      sessionId: context.sessionId || 'unknown',
      tokenId: undefined, // Not available in this context
      expiredAt: new Date(),
      lastActivity: undefined, // Not tracked in this context
      ipAddress: context.ipAddress
        ? await this.hashData(context.ipAddress)
        : undefined,
      userAgent: context.userAgent
        ? await this.hashData(context.userAgent)
        : undefined,
      timestamp: new Date(),
    };

    try {
      await this.eventsService.saveAuditEvent(
        context as EventContext,
        expiredEvent,
      );
    } catch (error) {
      this.logger.error('Failed to log session expired event', error);
    }
  }

  private async hashData(data: string): Promise<string> {
    return this.passwordService.hashPassword(data);
  }

  private parseExpirationToMs(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1));

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000; // Default 7 days for refresh tokens
    }
  }
}
