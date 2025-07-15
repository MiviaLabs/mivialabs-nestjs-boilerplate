import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Injectable,
  Inject,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { PostgresDb } from '@db/postgres/types/postgres-db.type';
import { user, User } from '@db/postgres/schema/user';
import { organization } from '@db/postgres/schema/organization';
import { refreshToken } from '@db/postgres/schema/refresh-token';
import { EventsService, EventContext } from '@events/events.service';
import { JwtService } from '../../services/jwt.service';
import { PasswordService } from '../../services/password.service';
import { LoginUserCommand } from '../login-user.command';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { JwtTokenPair } from '../../interfaces/jwt-payload.interface';
import { LoginMethod, LoginFailureReason } from '@db';
import {
  UserLoggedInEventPayload,
  UserLoginFailedEventPayload,
  AuthSessionCreatedEventPayload,
} from '@events';

@CommandHandler(LoginUserCommand)
@Injectable()
export class LoginUserHandler implements ICommandHandler<LoginUserCommand> {
  private readonly logger = new Logger(LoginUserHandler.name);

  constructor(
    @Inject('DB') private readonly db: PostgresDb,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly eventsService: EventsService,
  ) {}

  async execute(command: LoginUserCommand): Promise<AuthResponseDto> {
    const {
      loginDto,
      sessionId,
      correlationId,
      causationId,
      ipAddress,
      userAgent,
    } = command;
    const { email, password } = loginDto;
    const internalCorrelationId = correlationId || uuidv4();

    const context: Omit<EventContext, 'userId' | 'organizationId'> = {
      sessionId,
      correlationId: internalCorrelationId,
      causationId,
      ipAddress,
      userAgent,
    };

    try {
      // Find user by email
      const foundUser = await this.db
        .select()
        .from(user)
        .where(eq(user.email, email))
        .limit(1);

      if (foundUser.length === 0) {
        await this.logLoginFailure(email, 'User not found', context);
        throw new UnauthorizedException('Invalid credentials');
      }

      const userData = foundUser[0]!; // We already checked that foundUser.length > 0

      // Check if user account is active
      if (!userData.isActive) {
        await this.logLoginFailure(email, `Account is not active`, {
          ...context,
          userId: userData.id,
          organizationId: userData.organizationId || undefined,
        });
        throw new UnauthorizedException('Account is not active');
      }

      // Check if organization is active
      if (userData.organizationId) {
        const foundOrganization = await this.db
          .select({ isActive: organization.isActive })
          .from(organization)
          .where(eq(organization.id, userData.organizationId))
          .limit(1);

        if (foundOrganization.length > 0 && !foundOrganization[0]!.isActive) {
          await this.logLoginFailure(email, `Organization is not active`, {
            ...context,
            userId: userData.id,
            organizationId: userData.organizationId,
          });
          throw new UnauthorizedException('Organization is not active');
        }
      }

      // Verify password
      if (!userData.passwordHash) {
        await this.logLoginFailure(email, 'No password set', {
          ...context,
          userId: userData.id,
          organizationId: userData.organizationId || undefined,
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await this.passwordService.verifyPassword(
        userData.passwordHash,
        password,
      );

      if (!isPasswordValid) {
        await this.logLoginFailure(email, 'Invalid password', {
          ...context,
          userId: userData.id,
          organizationId: userData.organizationId || undefined,
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate JWT token pair
      const refreshTokenId = uuidv4();
      const tokenPair = await this.jwtService.generateTokenPair(
        userData.id,
        userData.organizationId!,
        refreshTokenId,
      );

      // Store refresh token in database (atomic operation)
      await this.db.transaction(async (tx) => {
        const tokenHash = await this.passwordService.hashPassword(
          tokenPair.refreshToken,
        );
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await tx.insert(refreshToken).values({
          id: refreshTokenId,
          userId: userData.id,
          organizationId: userData.organizationId!,
          tokenHash,
          expiresAt,
          isRevoked: null,
        });
      });

      // Log events (non-blocking)
      const contextWithIds = {
        ...context,
        userId: userData.id,
        organizationId: userData.organizationId || '',
      };

      try {
        await Promise.all([
          this.logSuccessfulLogin(userData, contextWithIds),
          this.logAuthSessionCreated(
            userData,
            tokenPair,
            refreshTokenId,
            contextWithIds,
          ),
        ]);
      } catch (error) {
        this.logger.error(
          'Failed to log login events - continuing operation',
          error,
        );
      }

      this.logger.log(`User login successful for user ID: ${userData.id}`);

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        accessTokenExpiresAt: new Date(
          Date.now() + 15 * 60 * 1000,
        ).toISOString(),
        refreshTokenExpiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        user: {
          id: userData.id,
          email: userData.email,
          organizationId: userData.organizationId!,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error('Unexpected error during login', error);
      await this.logLoginFailure(email, 'Internal server error', context);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  private async logSuccessfulLogin(
    userData: User,
    context: EventContext,
  ): Promise<void> {
    const loginEvent: UserLoggedInEventPayload = {
      userId: userData.id,
      organizationId: userData.organizationId || undefined,
      loginMethod: LoginMethod.EMAIL_PASSWORD,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      timestamp: new Date(),
    };

    try {
      await this.eventsService.saveAuditEvent(context, loginEvent);
    } catch (error) {
      this.logger.error('Failed to log successful login event', error);
    }
  }

  private async logLoginFailure(
    email: string,
    reason: string,
    context: Partial<EventContext>,
  ): Promise<void> {
    const failureEvent: UserLoginFailedEventPayload = {
      email: await this.hashEmail(email),
      organizationId:
        ('organizationId' in context && context.organizationId) || undefined,
      reason: LoginFailureReason.INVALID_CREDENTIALS,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      timestamp: new Date(),
    };

    try {
      const eventContext: EventContext = {
        ...context,
        correlationId: context.correlationId || uuidv4(),
        userId: ('userId' in context && context.userId) || undefined,
        organizationId:
          ('organizationId' in context && context.organizationId) || undefined,
      };
      await this.eventsService.saveAuditEvent(eventContext, failureEvent);
    } catch (error) {
      this.logger.error('Failed to log login failure event', error);
    }
  }

  private async logAuthSessionCreated(
    userData: User,
    tokenPair: JwtTokenPair,
    refreshTokenId: string,
    context: EventContext,
  ): Promise<void> {
    const sessionEvent: AuthSessionCreatedEventPayload = {
      userId: userData.id,
      organizationId: userData.organizationId || undefined,
      sessionId: context.sessionId || uuidv4(),
      refreshTokenId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiresAt: tokenPair.refreshTokenExpiresAt,
      timestamp: new Date(),
    };

    try {
      await this.eventsService.saveAuditEvent(context, sessionEvent);
    } catch (error) {
      this.logger.error('Failed to log auth session created event', error);
    }
  }

  private async hashEmail(email: string): Promise<string> {
    return this.passwordService.hashPassword(email.toLowerCase());
  }

  private async hashData(data: string): Promise<string> {
    return this.passwordService.hashPassword(data);
  }
}
