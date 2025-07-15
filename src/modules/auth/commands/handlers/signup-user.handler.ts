import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { PostgresDb } from '@db/postgres/types/postgres-db.type';
import { user, User } from '@db/postgres/schema/user';
import { organization, Organization } from '@db/postgres/schema/organization';
import { refreshToken } from '@db/postgres/schema/refresh-token';
import { EventsService, EventContext } from '@events';
import { JwtService } from '../../services/jwt.service';
import { PasswordService } from '../../services/password.service';
import { SignupUserCommand } from '../signup-user.command';
import { SignupDto } from '../../dto/signup.dto';
import { JwtTokenPair } from '../../interfaces/jwt-token-pair.interface';
import { CheckOrganizationSlugAvailabilityQuery } from '../../queries/check-organization-slug-availability.query';
import { AuthResponseDto } from '../../dto/auth-response.dto';
import { OrganizationSlugAvailabilityResult } from '../../interfaces/organization-slug-availability-result.interface';
import {
  OrganizationSignupCompletedEventPayload,
  AuthSessionCreatedEventPayload,
} from '@events';

@CommandHandler(SignupUserCommand)
@Injectable()
export class SignupUserHandler implements ICommandHandler<SignupUserCommand> {
  private readonly logger = new Logger(SignupUserHandler.name);

  constructor(
    @Inject('DB') private readonly db: PostgresDb,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly eventsService: EventsService,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(command: SignupUserCommand): Promise<AuthResponseDto> {
    const {
      signupDto,
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
      // Start database transaction
      const result = await this.db.transaction(async (tx) => {
        // 1. Validate organization slug availability
        const slugQueryResult: unknown = await this.queryBus.execute(
          new CheckOrganizationSlugAvailabilityQuery(
            signupDto.organizationSlug,
          ),
        );
        const slugAvailability =
          slugQueryResult as OrganizationSlugAvailabilityResult;

        if (!slugAvailability.isAvailable) {
          throw new ConflictException({
            message: 'Organization slug is not available',
            errors: slugAvailability.errors || [],
            suggestions: slugAvailability.suggestions || [],
          });
        }

        // 2. Check if user email already exists
        const existingUsers = await tx
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, signupDto.email.toLowerCase()))
          .limit(1);

        if (existingUsers.length > 0) {
          throw new ConflictException('User with this email already exists');
        }

        // 3. Hash password
        const hashedPassword = await this.passwordService.hashPassword(
          signupDto.password,
        );

        // 4. Create organization
        const organizationId = uuidv4();
        const organizationData = {
          id: organizationId,
          name: signupDto.organizationName,
          slug: signupDto.organizationSlug.toLowerCase(),
          description: signupDto.organizationDescription || null,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await tx.insert(organization).values(organizationData);

        // 5. Create user
        const userId = uuidv4();
        const userData = {
          id: userId,
          organizationId,
          email: signupDto.email.toLowerCase(),
          passwordHash: hashedPassword,
          isActive: true,
          isEmailVerified: false,
          isSystemAdmin: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await tx.insert(user).values(userData);

        // 6. Generate JWT token pair
        const refreshTokenId = uuidv4();
        const tokenPair = await this.jwtService.generateTokenPair(
          userId,
          organizationId,
          refreshTokenId,
        );

        // 7. Store refresh token
        await this.storeRefreshToken(
          tx,
          refreshTokenId,
          userId,
          organizationId,
          tokenPair.refreshToken,
        );

        return {
          organization: organizationData,
          user: userData,
          tokenPair,
          refreshTokenId,
        };
      });

      const {
        organization: orgData,
        user: userData,
        tokenPair,
        refreshTokenId,
      } = result;

      const contextWithIds: EventContext = {
        ...context,
        userId: userData.id,
        organizationId: orgData.id,
      };

      // 8. Log events (outside transaction to avoid blocking)
      await Promise.all([
        this.logOrganizationCreated(orgData, signupDto, contextWithIds),
        this.logUserCreated(userData, contextWithIds),
        this.logUserSignedUp(userData, orgData, signupDto, contextWithIds),
        this.logAuthSessionCreated(
          userData,
          tokenPair,
          refreshTokenId,
          contextWithIds,
        ),
      ]);

      this.logger.log(
        `User signup successful for user ID: ${userData.id} in organization: ${orgData.slug}`,
      );

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
          organizationId: userData.organizationId,
        },
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error('Unexpected error during signup', error);
      throw new BadRequestException('Signup failed');
    }
  }

  private async storeRefreshToken(
    tx: Parameters<Parameters<PostgresDb['transaction']>[0]>[0],
    tokenId: string,
    userId: string,
    organizationId: string,
    token: string,
  ): Promise<void> {
    const tokenHash = await this.passwordService.hashPassword(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await tx.insert(refreshToken).values({
      id: tokenId,
      userId,
      organizationId,
      tokenHash,
      expiresAt,
      isRevoked: null,
    });
  }

  private logOrganizationCreated(
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    orgData: unknown,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    signupDto: unknown,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    context: EventContext,
  ): Promise<void> {
    // TODO: Fix event interface compatibility
    return Promise.resolve();
  }

  private logUserCreated(
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    userData: User,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    context: EventContext,
  ): Promise<void> {
    // TODO: Fix event interface compatibility
    return Promise.resolve();
  }

  private async logUserSignedUp(
    userData: User,
    orgData: Organization,
    signupDto: SignupDto,
    context: EventContext,
  ): Promise<void> {
    const signupEvent: OrganizationSignupCompletedEventPayload = {
      userId: userData.id,
      organizationId: userData.organizationId!,
      organizationName: (signupDto as { organizationName: string })
        .organizationName,
      organizationSlug: orgData.slug || undefined,
      userRole: 'owner', // Default role for organization creator
      signupMethod: 'email_password',
      ipAddress: context.ipAddress
        ? await this.hashData(context.ipAddress)
        : undefined,
      userAgent: context.userAgent
        ? await this.hashData(context.userAgent)
        : undefined,
      timestamp: new Date(),
    };

    try {
      await this.eventsService.saveAuditEvent(context, signupEvent);
    } catch (error) {
      this.logger.error('Failed to log user signed up event', error);
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
      accessTokenId: undefined, // Not tracking access token IDs currently
      refreshTokenId,
      ipAddress: context.ipAddress
        ? await this.hashData(context.ipAddress)
        : undefined,
      userAgent: context.userAgent
        ? await this.hashData(context.userAgent)
        : undefined,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
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
