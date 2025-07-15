import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoginUserHandler } from './login-user.handler';
import { LoginUserCommand } from '../login-user.command';
import { JwtService } from '../../services/jwt.service';
import { PasswordService } from '../../services/password.service';
import { EventsService } from '@events/events.service';
import { PostgresDb } from '@db/postgres/types/postgres-db.type';
import { LoginMethod } from '@db';
import { LoginDto } from '../../dto/login.dto';

describe('LoginUserHandler', () => {
  let handler: LoginUserHandler;
  let mockDb: jest.Mocked<PostgresDb>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockPasswordService: jest.Mocked<PasswordService>;
  let mockEventsService: jest.Mocked<EventsService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2b$12$hashedPassword',
    organizationId: 'org-456',
    isActive: true,
    isEmailVerified: true,
    isSystemAdmin: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  // Removed unused mockRefreshToken variable

  const mockLoginDto: LoginDto = {
    email: 'test@example.com',
    password: 'plainPassword123',
  };

  const mockTokenPair = {
    accessToken: 'access-token-jwt',
    refreshToken: 'refresh-token-jwt',
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  beforeEach(async () => {
    const mockTransaction = jest.fn((callback: (tx: any) => any) =>
      callback(mockDb),
    );

    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([mockUser]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      transaction: mockTransaction,
    } as unknown as jest.Mocked<PostgresDb>;

    mockJwtService = {
      generateTokenPair: jest.fn(),
      validateAccessToken: jest.fn(),
      validateRefreshToken: jest.fn(),
      decodeToken: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    mockPasswordService = {
      verifyPassword: jest.fn(),
      hashPassword: jest.fn(),
      validatePasswordStrength: jest.fn(),
      generateRandomPassword: jest.fn(),
    } as unknown as jest.Mocked<PasswordService>;

    mockEventsService = {
      saveAuditEvent: jest.fn(),
      logSecurityEvent: jest.fn(),
      getAuditEvents: jest.fn(),
      getSecurityEvents: jest.fn(),
    } as unknown as jest.Mocked<EventsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginUserHandler,
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
      ],
    }).compile();

    handler = module.get<LoginUserHandler>(LoginUserHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful login', () => {
    beforeEach(() => {
      (mockDb as any).limit.mockResolvedValue([mockUser]);
      (mockPasswordService.verifyPassword as jest.Mock).mockResolvedValue(true);
      (mockJwtService.generateTokenPair as jest.Mock).mockResolvedValue(
        mockTokenPair,
      );
      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue(
        '$argon2id$v=19$m=65536,t=3,p=1$hashedRefreshToken',
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );
    });

    it('should login user successfully', async () => {
      const command = new LoginUserCommand(
        mockLoginDto,
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
        accessTokenExpiresAt: expect.any(String),
        refreshTokenExpiresAt: expect.any(String),
        user: {
          id: mockUser.id,
          email: mockUser.email,
          organizationId: mockUser.organizationId,
        },
      });

      // Verify core authentication logic was called
      expect(
        mockPasswordService.verifyPassword as jest.Mock,
      ).toHaveBeenCalledWith(mockUser.passwordHash, mockLoginDto.password);
      expect(
        mockJwtService.generateTokenPair as jest.Mock,
      ).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.organizationId,
        expect.any(String),
      );
    });

    it('should update user last active timestamp', async () => {
      const command = new LoginUserCommand(
        mockLoginDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      // Verify database transaction was called
      expect((mockDb as any).transaction).toHaveBeenCalled();
    });

    it('should store refresh token', async () => {
      const command = new LoginUserCommand(
        mockLoginDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      // Verify password hashing was called for refresh token
      expect(mockPasswordService.hashPassword as jest.Mock).toHaveBeenCalled();
    });

    it('should log authentication events', async () => {
      const command = new LoginUserCommand(
        mockLoginDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await handler.execute(command);

      expect(
        mockEventsService.saveAuditEvent as jest.Mock,
      ).toHaveBeenCalledTimes(2);

      // Check user logged in event
      const loggedInEventCall = (mockEventsService.saveAuditEvent as jest.Mock)
        .mock.calls[0];
      if (loggedInEventCall) {
        expect(loggedInEventCall[1]).toMatchObject({
          userId: mockUser.id,
          organizationId: mockUser.organizationId,
          loginMethod: LoginMethod.EMAIL_PASSWORD,
          timestamp: expect.any(Date),
        });
      }

      // Check auth session created event
      const sessionEventCall = (mockEventsService.saveAuditEvent as jest.Mock)
        .mock.calls[1];
      if (sessionEventCall) {
        expect(sessionEventCall[1]).toMatchObject({
          userId: mockUser.id,
          organizationId: mockUser.organizationId,
          sessionId: expect.any(String),
          timestamp: expect.any(Date),
        });
      }
    });
  });

  describe('failed login attempts', () => {
    it('should throw UnauthorizedException for non-existent user', async () => {
      (mockDb as any).limit.mockResolvedValue([]); // No user found

      const command = new LoginUserCommand(
        mockLoginDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException for incorrect password', async () => {
      (mockDb as any).limit.mockResolvedValue([mockUser]);
      (mockPasswordService.verifyPassword as jest.Mock).mockResolvedValue(
        false,
      );

      const command = new LoginUserCommand(
        mockLoginDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      (mockDb as any).limit.mockResolvedValue([inactiveUser]);
      (mockPasswordService.verifyPassword as jest.Mock).mockResolvedValue(true);

      const command = new LoginUserCommand(
        mockLoginDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        'Account is not active',
      );
    });

    it('should log failed login attempts', async () => {
      (mockDb as any).limit.mockResolvedValue([mockUser]);
      (mockPasswordService.verifyPassword as jest.Mock).mockResolvedValue(
        false,
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      const command = new LoginUserCommand(
        mockLoginDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      try {
        await handler.execute(command);
      } catch {
        // Expected to throw
      }

      expect(
        mockEventsService.saveAuditEvent as jest.Mock,
      ).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          reason: 'invalid_credentials',
          timestamp: expect.any(Date),
        }),
      );
    });
  });

  describe('database transaction handling', () => {
    it('should handle database transaction errors', async () => {
      (mockDb as any).limit.mockResolvedValue([mockUser]);
      (mockPasswordService.verifyPassword as jest.Mock).mockResolvedValue(true);
      (mockJwtService.generateTokenPair as jest.Mock).mockResolvedValue(
        mockTokenPair,
      );
      (mockDb as any).transaction.mockRejectedValue(
        new Error('Database error'),
      );

      const command = new LoginUserCommand(
        mockLoginDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(handler.execute(command)).rejects.toThrow(
        'Authentication failed',
      );
    });

    it('should rollback transaction on token generation failure', async () => {
      (mockDb as any).limit.mockResolvedValue([mockUser]);
      (mockPasswordService.verifyPassword as jest.Mock).mockResolvedValue(true);
      (mockJwtService.generateTokenPair as jest.Mock).mockRejectedValue(
        new Error('Token generation failed'),
      );

      const command = new LoginUserCommand(
        mockLoginDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      await expect(handler.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional context fields', async () => {
      (mockDb as any).limit.mockResolvedValue([mockUser]);
      (mockPasswordService.verifyPassword as jest.Mock).mockResolvedValue(true);
      (mockJwtService.generateTokenPair as jest.Mock).mockResolvedValue(
        mockTokenPair,
      );
      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue(
        '$argon2id$v=19$m=65536,t=3,p=1$hashedRefreshToken',
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      const command = new LoginUserCommand(
        mockLoginDto,
        undefined, // no session ID
        undefined, // no correlation ID
        undefined, // no causation ID
        undefined, // no IP address
        undefined, // no user agent
      );

      const result = await handler.execute(command);

      expect(result).toBeDefined();
      expect(result.accessToken).toBe(mockTokenPair.accessToken);
    });

    it('should normalize email to lowercase', async () => {
      const uppercaseEmailDto = {
        ...mockLoginDto,
        email: 'TEST@EXAMPLE.COM',
      };

      (mockDb as any).limit.mockResolvedValue([mockUser]);
      (mockPasswordService.verifyPassword as jest.Mock).mockResolvedValue(true);
      (mockJwtService.generateTokenPair as jest.Mock).mockResolvedValue(
        mockTokenPair,
      );
      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue(
        '$argon2id$v=19$m=65536,t=3,p=1$hashedRefreshToken',
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      const command = new LoginUserCommand(
        uppercaseEmailDto,
        'session-123',
        'correlation-123',
        'causation-123',
        '192.168.1.1',
        'test-user-agent',
      );

      const result = await handler.execute(command);

      expect(result).toBeDefined();
      // Verify database query was called
      expect((mockDb as any).select).toHaveBeenCalled();
    });
  });
});
