import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryBus } from '@nestjs/cqrs';
import { SignupUserHandler } from './signup-user.handler';
import { SignupUserCommand } from '../signup-user.command';
import { JwtService } from '../../services/jwt.service';
import { PasswordService } from '../../services/password.service';
import { EventsService } from '@events/events.service';
import { PostgresDb } from '@db/postgres/types/postgres-db.type';
import { SignupDto } from '../../dto/signup.dto';
import { UserRole } from '@db';

describe('SignupUserHandler', () => {
  let handler: SignupUserHandler;
  let mockDb: jest.Mocked<PostgresDb>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockPasswordService: jest.Mocked<PasswordService>;
  let mockEventsService: jest.Mocked<EventsService>;
  let mockQueryBus: jest.Mocked<QueryBus>;
  let mockConfigService: jest.Mocked<ConfigService>;

  const mockSignupDto: SignupDto = {
    email: 'test@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe',
    organizationName: 'Test Organization',
    organizationSlug: 'test-org',
    organizationDescription: 'Test organization description',
  };

  const mockTokenPair = {
    accessToken: 'access-token-jwt',
    refreshToken: 'refresh-token-jwt',
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  const mockSlugAvailability = {
    isAvailable: true,
    errors: [],
    suggestions: [],
  };

  beforeEach(async () => {
    const mockTransaction = jest.fn((callback: (tx: any) => any) =>
      callback(mockDb),
    );

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockResolvedValue(undefined),
      transaction: mockTransaction,
    } as unknown as jest.Mocked<PostgresDb>;

    mockJwtService = {
      generateTokenPair: jest.fn().mockResolvedValue(mockTokenPair),
      validateAccessToken: jest.fn(),
      validateRefreshToken: jest.fn(),
      decodeToken: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    mockPasswordService = {
      hashPassword: jest.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=1$hashedPassword'),
      verifyPassword: jest.fn(),
      validatePasswordStrength: jest.fn(),
      generateRandomPassword: jest.fn(),
    } as unknown as jest.Mocked<PasswordService>;

    mockEventsService = {
      saveAuditEvent: jest.fn().mockResolvedValue(undefined),
      logSecurityEvent: jest.fn(),
      getAuditEvents: jest.fn(),
      getSecurityEvents: jest.fn(),
    } as unknown as jest.Mocked<EventsService>;

    mockQueryBus = {
      execute: jest.fn().mockResolvedValue(mockSlugAvailability),
    } as unknown as jest.Mocked<QueryBus>;

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'APP_ACCOUNT_ACTIVE_AFTER_SIGNUP') return 'true';
        if (key === 'JWT_REFRESH_TOKEN_EXPIRATION') return '7d';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignupUserHandler,
        {
          provide: 'DB',
          useValue: mockDb,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: PasswordService,
          useValue: mockPasswordService,
        },
        {
          provide: EventsService,
          useValue: mockEventsService,
        },
        {
          provide: QueryBus,
          useValue: mockQueryBus,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    handler = module.get<SignupUserHandler>(SignupUserHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful signup', () => {
    beforeEach(() => {
      (mockDb as any).limit.mockResolvedValue([]);
      (mockQueryBus.execute as jest.Mock).mockResolvedValue(mockSlugAvailability);
      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=1$hashedPassword');
      (mockJwtService.generateTokenPair as jest.Mock).mockResolvedValue(mockTokenPair);
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(undefined);
    });

    it('should create user and organization successfully', async () => {
      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result).toEqual({
        accessToken: mockTokenPair.accessToken,
        refreshToken: mockTokenPair.refreshToken,
        accessTokenExpiresAt: mockTokenPair.accessTokenExpiresAt.toISOString(),
        refreshTokenExpiresAt: mockTokenPair.refreshTokenExpiresAt.toISOString(),
        user: {
          id: expect.any(String),
          email: mockSignupDto.email,
          organizationId: expect.any(String),
        },
      });

      expect(mockQueryBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: mockSignupDto.organizationSlug,
        }),
      );
      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(mockSignupDto.password);
      expect(mockJwtService.generateTokenPair).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should create organization with correct data', async () => {
      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      expect((mockDb as any).insert).toHaveBeenCalledTimes(3);
      expect((mockDb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: mockSignupDto.organizationName,
          slug: mockSignupDto.organizationSlug.toLowerCase(),
          description: mockSignupDto.organizationDescription,
          isActive: true,
        }),
      );
    });

    it('should create user with correct data', async () => {
      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      expect((mockDb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockSignupDto.email.toLowerCase(),
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$hashedPassword',
          isActive: true,
          isEmailVerified: false,
          isSystemAdmin: false,
        }),
      );
    });

    it('should store refresh token with proper hashing', async () => {
      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(mockTokenPair.refreshToken);
      expect((mockDb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: '$argon2id$v=19$m=65536,t=3,p=1$hashedPassword',
          isRevoked: null,
        }),
      );
    });

    it('should log all required events', async () => {
      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      expect(mockEventsService.saveAuditEvent).toHaveBeenCalledTimes(4);

      const eventCalls = (mockEventsService.saveAuditEvent as jest.Mock).mock.calls;
      expect(eventCalls[0][1]).toMatchObject({
        eventType: 'OrganizationCreatedEvent',
        aggregateType: 'Organization',
      });
      expect(eventCalls[1][1]).toMatchObject({
        eventType: 'UserCreatedEvent',
        aggregateType: 'User',
      });
      expect(eventCalls[2][1]).toMatchObject({
        organizationName: mockSignupDto.organizationName,
        userRole: UserRole.ORGANIZATION_OWNER,
        signupMethod: 'email_password',
      });
      expect(eventCalls[3][1]).toMatchObject({
        userId: expect.any(String),
        organizationId: expect.any(String),
        sessionId: 'session-123',
      });
    });

    it('should handle accounts being inactive after signup', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'APP_ACCOUNT_ACTIVE_AFTER_SIGNUP') return 'false';
        if (key === 'JWT_REFRESH_TOKEN_EXPIRATION') return '7d';
        return undefined;
      });

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      expect((mockDb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });

    it('should normalize email to lowercase', async () => {
      const uppercaseEmailDto = {
        ...mockSignupDto,
        email: 'TEST@EXAMPLE.COM',
      };

      const command = new SignupUserCommand(
        uppercaseEmailDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result.user.email).toBe('test@example.com');
      expect((mockDb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        }),
      );
    });

    it('should normalize organization slug to lowercase', async () => {
      const uppercaseSlugDto = {
        ...mockSignupDto,
        organizationSlug: 'TEST-ORG',
      };

      const command = new SignupUserCommand(
        uppercaseSlugDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      expect((mockDb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'test-org',
        }),
      );
    });

    it('should generate UUIDs for organization and user', async () => {
      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(result.user.organizationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should handle missing optional organization description', async () => {
      const dtoWithoutDescription = {
        ...mockSignupDto,
        organizationDescription: undefined,
      };

      const command = new SignupUserCommand(
        dtoWithoutDescription,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      expect((mockDb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
        }),
      );
    });

    it('should generate correlation ID if not provided', async () => {
      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        undefined,
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result).toBeDefined();
      expect(mockEventsService.saveAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: expect.any(String),
        }),
        expect.any(Object),
      );
    });
  });

  describe('failed signup attempts', () => {
    it('should throw ConflictException when organization slug is unavailable', async () => {
      const unavailableSlugResult = {
        isAvailable: false,
        errors: ['Slug is already taken'],
        suggestions: ['test-org-1', 'test-org-2'],
      };
      
      (mockQueryBus.execute as jest.Mock).mockResolvedValue(unavailableSlugResult);

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow('Organization slug is not available');
    });

    it('should throw ConflictException when user email already exists', async () => {
      const existingUser = {
        id: 'existing-user-id',
        email: mockSignupDto.email,
      };

      (mockDb as any).limit.mockResolvedValue([existingUser]);

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow('User with this email already exists');
    });

    it('should throw BadRequestException on unexpected database error', async () => {
      (mockDb as any).limit.mockResolvedValue([]);
      (mockDb as any).transaction.mockRejectedValue(new Error('Database connection failed'));

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      await expect(handler.execute(command)).rejects.toThrow('Signup failed');
    });

    it('should throw BadRequestException on password hashing failure', async () => {
      (mockDb as any).limit.mockResolvedValue([]);
      (mockPasswordService.hashPassword as jest.Mock).mockRejectedValue(new Error('Hashing failed'));

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      await expect(handler.execute(command)).rejects.toThrow('Signup failed');
    });

    it('should throw BadRequestException on JWT token generation failure', async () => {
      (mockDb as any).limit.mockResolvedValue([]);
      (mockJwtService.generateTokenPair as jest.Mock).mockRejectedValue(new Error('Token generation failed'));

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      await expect(handler.execute(command)).rejects.toThrow('Signup failed');
    });

    it('should preserve ConflictException when slug check fails', async () => {
      const conflictError = new ConflictException('Slug validation failed');
      (mockQueryBus.execute as jest.Mock).mockRejectedValue(conflictError);

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(ConflictException);
      await expect(handler.execute(command)).rejects.toThrow('Slug validation failed');
    });
  });

  describe('database transaction handling', () => {
    it('should rollback transaction on organization creation failure', async () => {
      (mockDb as any).limit.mockResolvedValue([]);
      const organizationInsertError = new Error('Organization insert failed');
      (mockDb as any).values.mockRejectedValueOnce(organizationInsertError);

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      expect((mockDb as any).transaction).toHaveBeenCalled();
    });

    it('should rollback transaction on user creation failure', async () => {
      (mockDb as any).limit.mockResolvedValue([]);
      (mockDb as any).values
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('User insert failed'));

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      expect((mockDb as any).transaction).toHaveBeenCalled();
    });

    it('should rollback transaction on refresh token storage failure', async () => {
      (mockDb as any).limit.mockResolvedValue([]);
      (mockDb as any).values
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Refresh token insert failed'));

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
      expect((mockDb as any).transaction).toHaveBeenCalled();
    });

    it('should complete transaction when all operations succeed', async () => {
      (mockDb as any).limit.mockResolvedValue([]);
      (mockDb as any).values.mockResolvedValue(undefined);

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result).toBeDefined();
      expect((mockDb as any).transaction).toHaveBeenCalled();
      expect((mockDb as any).values).toHaveBeenCalledTimes(3);
    });
  });

  describe('event logging', () => {
    beforeEach(() => {
      (mockDb as any).limit.mockResolvedValue([]);
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(undefined);
    });

    it('should continue execution even if event logging fails', async () => {
      (mockEventsService.saveAuditEvent as jest.Mock).mockRejectedValue(new Error('Event logging failed'));

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe(mockTokenPair.accessToken);
    });

    it('should hash sensitive data in events', async () => {
      (mockPasswordService.hashPassword as jest.Mock)
        .mockResolvedValueOnce('$argon2id$v=19$m=65536,t=3,p=1$hashedPassword')
        .mockResolvedValueOnce('$argon2id$v=19$m=65536,t=3,p=1$hashedToken')
        .mockResolvedValueOnce('$argon2id$v=19$m=65536,t=3,p=1$hashedEmail')
        .mockResolvedValueOnce('$argon2id$v=19$m=65536,t=3,p=1$hashedIP')
        .mockResolvedValueOnce('$argon2id$v=19$m=65536,t=3,p=1$hashedUserAgent');

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(mockSignupDto.password);
      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(mockTokenPair.refreshToken);
      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(mockSignupDto.email);
      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith('192.168.1.1');
      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith('test-user-agent');
    });
  });

  describe('expiration parsing', () => {
    it('should parse seconds correctly', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_TOKEN_EXPIRATION') return '30s';
        return 'true';
      });

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result).toBeDefined();
      expect((mockDb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('should parse minutes correctly', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_TOKEN_EXPIRATION') return '15m';
        return 'true';
      });

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result).toBeDefined();
    });

    it('should parse hours correctly', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_TOKEN_EXPIRATION') return '2h';
        return 'true';
      });

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result).toBeDefined();
    });

    it('should use default expiration for invalid format', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_TOKEN_EXPIRATION') return 'invalid';
        return 'true';
      });

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional context fields', async () => {
      (mockDb as any).limit.mockResolvedValue([]);

      const command = new SignupUserCommand(
        mockSignupDto,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      const result = await handler.execute(command);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe(mockTokenPair.accessToken);
    });

    it('should handle empty organization description', async () => {
      const dtoWithEmptyDescription = {
        ...mockSignupDto,
        organizationDescription: '',
      };

      const command = new SignupUserCommand(
        dtoWithEmptyDescription,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      expect((mockDb as any).values).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
        }),
      );
    });

    it('should handle query bus returning null', async () => {
      (mockQueryBus.execute as jest.Mock).mockResolvedValue(null);

      const command = new SignupUserCommand(
        mockSignupDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
    });
  });
});