import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LogoutUserHandler } from './logout-user.handler';
import { LogoutUserCommand } from '../logout-user.command';
import { JwtService } from '../../services/jwt.service';
import { PasswordService } from '../../services/password.service';
import { EventsService } from '@events/events.service';
import { PostgresDb } from '@db/postgres/types/postgres-db.type';
import { TokenValidationResult } from '../../interfaces/token-validation-result.interface';

describe('LogoutUserHandler', () => {
  let handler: LogoutUserHandler;
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

  const mockRefreshToken = {
    id: 'token-123',
    userId: 'user-123',
    sessionId: 'session-123',
    hashedToken: 'hashed-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isRevoked: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validTokenValidation: TokenValidationResult = {
    isValid: true,
    userId: 'user-123',
    organizationId: 'org-456',
    tokenId: 'token-123',
  };

  const mockCommand = new LogoutUserCommand(
    'valid-refresh-token',
    'session-123',
    'correlation-123',
    'causation-123',
    '192.168.1.1',
    'Mozilla/5.0 (test)',
  );

  beforeEach(async () => {
    // Create a proper query chain mock
    const createQueryChain = () => {
      const queryChain = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockRefreshToken]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
      };

      // Make sure each method returns the same chain object
      queryChain.select.mockReturnValue(queryChain);
      queryChain.from.mockReturnValue(queryChain);
      queryChain.where.mockReturnValue(queryChain);
      queryChain.update.mockReturnValue(queryChain);
      queryChain.set.mockReturnValue(queryChain);

      return queryChain;
    };

    const queryChain = createQueryChain();

    // Create transaction mock that returns tokens
    const mockTransaction = jest.fn(async (callback: (tx: any) => any) => {
      // Mock the transaction context (tx)
      const txQueryChain = createQueryChain();
      const txMock = {
        select: jest.fn().mockReturnValue(txQueryChain),
        from: jest.fn().mockReturnValue(txQueryChain),
        where: jest.fn().mockReturnValue(txQueryChain),
        update: jest.fn().mockReturnValue(txQueryChain),
        set: jest.fn().mockReturnValue(txQueryChain),
      };

      // Execute the callback with the transaction mock
      return await callback(txMock);
    });

    mockDb = {
      select: jest.fn().mockReturnValue(queryChain),
      from: jest.fn().mockReturnValue(queryChain),
      where: jest.fn().mockReturnValue(queryChain),
      limit: jest.fn().mockResolvedValue([mockRefreshToken]),
      update: jest.fn().mockReturnValue(queryChain),
      set: jest.fn().mockReturnValue(queryChain),
      transaction: mockTransaction,
    } as unknown as jest.Mocked<PostgresDb>;

    mockJwtService = {
      validateRefreshToken: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    mockPasswordService = {
      hashPassword: jest.fn(),
    } as unknown as jest.Mocked<PasswordService>;

    mockEventsService = {
      saveAuditEvent: jest.fn(),
    } as unknown as jest.Mocked<EventsService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogoutUserHandler,
        { provide: 'DB', useValue: mockDb },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    handler = module.get<LogoutUserHandler>(LogoutUserHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should successfully logout user and revoke all tokens', async () => {
      // Arrange
      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );

      // Setup database calls: first call finds refresh token, second finds user
      const queryChain = mockDb.select();
      (queryChain as any).limit
        .mockResolvedValueOnce([mockRefreshToken]) // First call - find refresh token
        .mockResolvedValueOnce([mockUser]); // Second call - find user

      // Mock transaction to return tokens for event logging
      (mockDb.transaction as jest.Mock).mockImplementation(
        async (callback: (tx: any) => any) => {
          const txQueryChain = {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockResolvedValue([mockRefreshToken]),
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
          };

          const txMock = {
            select: jest.fn().mockReturnValue(txQueryChain),
            from: jest.fn().mockReturnValue(txQueryChain),
            where: jest.fn().mockReturnValue(txQueryChain),
            update: jest.fn().mockReturnValue(txQueryChain),
            set: jest.fn().mockReturnValue(txQueryChain),
          };

          return await callback(txMock);
        },
      );

      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue(
        'hashed-data',
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await handler.execute(mockCommand);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Logout successful',
      });

      expect(mockJwtService.validateRefreshToken).toHaveBeenCalledWith(
        'valid-refresh-token',
      );
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockEventsService.saveAuditEvent).toHaveBeenCalledTimes(3);
    });

    it('should throw UnauthorizedException when token validation fails', async () => {
      // Arrange
      const invalidTokenValidation: TokenValidationResult = {
        isValid: false,
        error: 'Invalid token',
      };
      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        invalidTokenValidation,
      );

      // Act & Assert
      await expect(handler.execute(mockCommand)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException when token validation is missing userId', async () => {
      // Arrange
      const incompleteTokenValidation: TokenValidationResult = {
        isValid: true,
        organizationId: 'org-456',
        tokenId: 'token-123',
      };
      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        incompleteTokenValidation,
      );

      // Act & Assert
      await expect(handler.execute(mockCommand)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException when token validation is missing organizationId', async () => {
      // Arrange
      const incompleteTokenValidation: TokenValidationResult = {
        isValid: true,
        userId: 'user-123',
        tokenId: 'token-123',
      };
      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        incompleteTokenValidation,
      );

      // Act & Assert
      await expect(handler.execute(mockCommand)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException when token validation is missing tokenId', async () => {
      // Arrange
      const incompleteTokenValidation: TokenValidationResult = {
        isValid: true,
        userId: 'user-123',
        organizationId: 'org-456',
      };
      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        incompleteTokenValidation,
      );

      // Act & Assert
      await expect(handler.execute(mockCommand)).rejects.toThrow(
        new UnauthorizedException('Invalid refresh token'),
      );
    });

    it('should throw UnauthorizedException when refresh token is not found in database', async () => {
      // Arrange
      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );

      // Mock the first database call to return empty array (no token found)
      const queryChain = mockDb.select();
      (queryChain as any).limit.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(handler.execute(mockCommand)).rejects.toThrow(
        new UnauthorizedException('Refresh token not found or already revoked'),
      );
    });

    it('should throw UnauthorizedException when user is not found in database', async () => {
      // Arrange
      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );

      // Mock first call to find token (success), second call to find user (fails)
      const queryChain = mockDb.select();
      (queryChain as any).limit
        .mockResolvedValueOnce([mockRefreshToken])
        .mockResolvedValueOnce([]);

      // Act & Assert
      await expect(handler.execute(mockCommand)).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });

    it('should continue operation when event logging fails', async () => {
      // Arrange
      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );
      (mockDb as any).limit
        .mockResolvedValueOnce([mockRefreshToken])
        .mockResolvedValueOnce([mockUser]);
      (mockDb as any).where.mockResolvedValueOnce([mockRefreshToken]);
      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue(
        'hashed-data',
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockRejectedValue(
        new Error('Event service error'),
      );

      // Act
      const result = await handler.execute(mockCommand);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Logout successful',
      });
    });

    it('should throw UnauthorizedException when database operation fails', async () => {
      // Arrange
      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );
      (mockDb as any).limit
        .mockResolvedValueOnce([mockRefreshToken])
        .mockResolvedValueOnce([mockUser]);
      (mockDb as any).transaction.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(handler.execute(mockCommand)).rejects.toThrow(
        new UnauthorizedException('Logout failed'),
      );
    });

    it('should handle multiple refresh tokens for the same user', async () => {
      // Arrange
      const multipleTokens = [
        { ...mockRefreshToken, id: 'token-1' },
        { ...mockRefreshToken, id: 'token-2' },
        { ...mockRefreshToken, id: 'token-3' },
      ];

      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );

      // Setup database calls: first call finds refresh token, second finds user
      const queryChain = mockDb.select();
      (queryChain as any).limit
        .mockResolvedValueOnce([mockRefreshToken])
        .mockResolvedValueOnce([mockUser]);

      // Mock transaction to return multiple tokens for event logging
      (mockDb.transaction as jest.Mock).mockImplementation(
        async (callback: (tx: any) => any) => {
          const txQueryChain = {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockResolvedValue(multipleTokens),
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
          };

          const txMock = {
            select: jest.fn().mockReturnValue(txQueryChain),
            from: jest.fn().mockReturnValue(txQueryChain),
            where: jest.fn().mockReturnValue(txQueryChain),
            update: jest.fn().mockReturnValue(txQueryChain),
            set: jest.fn().mockReturnValue(txQueryChain),
          };

          return await callback(txMock);
        },
      );

      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue(
        'hashed-data',
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await handler.execute(mockCommand);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Logout successful',
      });
      expect(mockEventsService.saveAuditEvent).toHaveBeenCalledTimes(5); // 2 user events + 3 token events
    });

    it('should generate correlation ID when not provided', async () => {
      // Arrange
      const commandWithoutCorrelationId = new LogoutUserCommand(
        'valid-refresh-token',
        'session-123',
        undefined,
        'causation-123',
        '192.168.1.1',
        'Mozilla/5.0 (test)',
      );

      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );
      (mockDb as any).limit
        .mockResolvedValueOnce([mockRefreshToken])
        .mockResolvedValueOnce([mockUser]);
      (mockDb as any).where.mockResolvedValueOnce([mockRefreshToken]);
      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue(
        'hashed-data',
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await handler.execute(commandWithoutCorrelationId);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Logout successful',
      });
    });

    it('should handle optional fields in command', async () => {
      // Arrange
      const commandWithOptionalFields = new LogoutUserCommand(
        'valid-refresh-token',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );
      (mockDb as any).limit
        .mockResolvedValueOnce([mockRefreshToken])
        .mockResolvedValueOnce([mockUser]);
      (mockDb as any).where.mockResolvedValueOnce([mockRefreshToken]);
      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue(
        'hashed-data',
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await handler.execute(commandWithOptionalFields);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Logout successful',
      });
    });

    it('should handle user with null organizationId', async () => {
      // Arrange
      const userWithNullOrg = {
        ...mockUser,
        organizationId: null,
      };

      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );
      (mockDb as any).limit
        .mockResolvedValueOnce([mockRefreshToken])
        .mockResolvedValueOnce([userWithNullOrg]);
      (mockDb as any).where.mockResolvedValueOnce([mockRefreshToken]);
      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue(
        'hashed-data',
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Act
      const result = await handler.execute(mockCommand);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Logout successful',
      });
    });
  });

  describe('private methods', () => {
    it('should hash IP address and user agent in events', async () => {
      // Arrange
      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );
      (mockDb as any).limit
        .mockResolvedValueOnce([mockRefreshToken])
        .mockResolvedValueOnce([mockUser]);
      (mockDb as any).where.mockResolvedValueOnce([mockRefreshToken]);
      (mockPasswordService.hashPassword as jest.Mock).mockResolvedValue(
        'hashed-data',
      );
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Act
      await handler.execute(mockCommand);

      // Assert
      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(
        '192.168.1.1',
      );
      expect(mockPasswordService.hashPassword).toHaveBeenCalledWith(
        'Mozilla/5.0 (test)',
      );
    });

    it('should not hash undefined IP address and user agent', async () => {
      // Arrange
      const commandWithoutOptionalData = new LogoutUserCommand(
        'valid-refresh-token',
        'session-123',
        'correlation-123',
        'causation-123',
        undefined,
        undefined,
      );

      (mockJwtService.validateRefreshToken as jest.Mock).mockResolvedValue(
        validTokenValidation,
      );
      (mockDb as any).limit
        .mockResolvedValueOnce([mockRefreshToken])
        .mockResolvedValueOnce([mockUser]);
      (mockDb as any).where.mockResolvedValueOnce([mockRefreshToken]);
      (mockEventsService.saveAuditEvent as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Act
      await handler.execute(commandWithoutOptionalData);

      // Assert
      expect(mockPasswordService.hashPassword).not.toHaveBeenCalled();
    });
  });
});
