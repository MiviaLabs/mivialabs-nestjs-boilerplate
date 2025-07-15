import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtPayload, AuthenticatedUser } from './jwt-strategy';
import { UserRole } from '@db';

// Mock the entire database module
jest.mock('@db', () => ({
  user: { id: 'id', email: 'email', organizationId: 'organizationId' },
  organization: { id: 'id', name: 'name', isActive: 'isActive' },
  userOrganizationRole: {
    userId: 'userId',
    organizationId: 'organizationId',
    role: 'role',
  },
  UserRole: {
    SYSTEM_ADMIN: 'system_admin',
    ORGANIZATION_OWNER: 'organization_owner',
    ORGANIZATION_MEMBER: 'organization_member',
  },
  eq: jest.fn(),
  and: jest.fn(),
}));

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockDb: any;

  const JWT_SECRET = 'test-jwt-secret';

  const mockActiveUser = {
    id: 'user-123',
    email: 'test@example.com',
    organizationId: 'org-123',
    isActive: true,
    isEmailVerified: true,
    isSystemAdmin: false,
    orgIsActive: true,
    orgName: 'Test Organization',
  };

  const mockPayload: JwtPayload = {
    sub: 'user-123',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(async () => {
    // Set environment variable
    process.env.JWT_SECRET = JWT_SECRET;

    // Create mock database
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: 'DB',
          useValue: mockDb,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.JWT_SECRET;
  });

  describe('validate', () => {
    it('should validate and return authenticated user successfully', async () => {
      // Mock user query
      mockDb.limit.mockResolvedValueOnce([mockActiveUser]);
      // Mock role query
      mockDb.limit.mockResolvedValueOnce([
        { role: UserRole.ORGANIZATION_MEMBER },
      ]);

      const result: AuthenticatedUser = await strategy.validate(mockPayload);

      expect(result).toEqual({
        id: 'user-123',
        organizationId: 'org-123',
        email: 'test@example.com',
        isSystemAdmin: false,
        isActive: true,
        isEmailVerified: true,
        role: UserRole.ORGANIZATION_MEMBER,
      });
    });

    it('should validate system admin without organization', async () => {
      const systemAdminUser = {
        ...mockActiveUser,
        organizationId: null,
        isSystemAdmin: true,
        orgIsActive: null,
        orgName: null,
      };

      mockDb.limit.mockResolvedValue([systemAdminUser]);

      const result: AuthenticatedUser = await strategy.validate(mockPayload);

      expect(result).toEqual({
        id: 'user-123',
        organizationId: null,
        email: 'test@example.com',
        isSystemAdmin: true,
        isActive: true,
        isEmailVerified: true,
        role: UserRole.SYSTEM_ADMIN,
      });
    });

    it('should throw UnauthorizedException when user ID is missing', async () => {
      const invalidPayload: JwtPayload = {
        sub: '',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid token: missing user ID'),
      );
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const inactiveUser = {
        ...mockActiveUser,
        isActive: false,
      };

      mockDb.limit.mockResolvedValue([inactiveUser]);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('User account is inactive'),
      );
    });

    it('should throw UnauthorizedException when organization is inactive', async () => {
      const userWithInactiveOrg = {
        ...mockActiveUser,
        orgIsActive: false,
      };

      mockDb.limit.mockResolvedValue([userWithInactiveOrg]);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('Organization is inactive'),
      );
    });

    it('should handle user without organization role', async () => {
      mockDb.limit.mockResolvedValueOnce([mockActiveUser]);
      mockDb.limit.mockResolvedValueOnce([]); // Empty role result

      const result: AuthenticatedUser = await strategy.validate(mockPayload);

      expect(result.role).toBeUndefined();
      expect(result.organizationId).toBe('org-123');
    });

    it('should handle user without organization', async () => {
      const userWithoutOrg = {
        ...mockActiveUser,
        organizationId: null,
        orgIsActive: null,
        orgName: null,
      };

      mockDb.limit.mockResolvedValue([userWithoutOrg]);

      const result: AuthenticatedUser = await strategy.validate(mockPayload);

      expect(result.organizationId).toBeNull();
      expect(result.role).toBeUndefined();
    });

    it('should validate organization owner role', async () => {
      mockDb.limit.mockResolvedValueOnce([mockActiveUser]);
      mockDb.limit.mockResolvedValueOnce([
        { role: UserRole.ORGANIZATION_OWNER },
      ]);

      const result: AuthenticatedUser = await strategy.validate(mockPayload);

      expect(result.role).toBe(UserRole.ORGANIZATION_OWNER);
    });

    it('should handle system admin with organization role', async () => {
      const systemAdminWithOrg = {
        ...mockActiveUser,
        isSystemAdmin: true,
      };

      mockDb.limit.mockResolvedValueOnce([systemAdminWithOrg]);
      mockDb.limit.mockResolvedValueOnce([
        { role: UserRole.ORGANIZATION_OWNER },
      ]);

      const result: AuthenticatedUser = await strategy.validate(mockPayload);

      expect(result.isSystemAdmin).toBe(true);
      expect(result.role).toBe(UserRole.SYSTEM_ADMIN); // System admin role takes precedence
    });

    it('should handle database errors gracefully', async () => {
      mockDb.limit.mockRejectedValue(new Error('Database connection failed'));

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });

    it('should handle user with unverified email', async () => {
      const unverifiedUser = {
        ...mockActiveUser,
        isEmailVerified: false,
      };

      mockDb.limit.mockResolvedValueOnce([unverifiedUser]);
      mockDb.limit.mockResolvedValueOnce([
        { role: UserRole.ORGANIZATION_MEMBER },
      ]);

      const result: AuthenticatedUser = await strategy.validate(mockPayload);

      expect(result.isEmailVerified).toBe(false);
      expect(result.isActive).toBe(true);
    });
  });

  describe('constructor and configuration', () => {
    it('should initialize with correct JWT configuration', () => {
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(JwtStrategy);
    });

    it('should use JWT_SECRET from environment', () => {
      const testSecret = 'different-secret';
      process.env.JWT_SECRET = testSecret;

      const newStrategy = new JwtStrategy(mockDb);

      expect(newStrategy).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should log errors while maintaining security', async () => {
      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockDb.limit.mockRejectedValue(new Error('Database error'));

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'JWT Strategy validation error:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should preserve UnauthorizedException messages', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(strategy.validate(mockPayload)).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );
    });

    it('should handle undefined/null payload fields', async () => {
      const invalidPayload = {
        sub: undefined,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      } as any;

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid token: missing user ID'),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle very long user IDs', async () => {
      const longUserId = 'a'.repeat(100);
      const longPayload: JwtPayload = {
        sub: longUserId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const userWithLongId = {
        ...mockActiveUser,
        id: longUserId,
      };

      mockDb.limit.mockResolvedValueOnce([userWithLongId]);
      mockDb.limit.mockResolvedValueOnce([]);

      const result: AuthenticatedUser = await strategy.validate(longPayload);

      expect(result.id).toBe(longUserId);
    });

    it('should handle empty string user ID', async () => {
      const emptyPayload: JwtPayload = {
        sub: '',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await expect(strategy.validate(emptyPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid token: missing user ID'),
      );
    });

    it('should handle null sub field', async () => {
      const nullPayload = {
        sub: null,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      } as any;

      await expect(strategy.validate(nullPayload)).rejects.toThrow(
        new UnauthorizedException('Invalid token: missing user ID'),
      );
    });
  });

  describe('role priority logic', () => {
    it('should prioritize system admin role over organization role', async () => {
      const systemAdminUser = {
        ...mockActiveUser,
        isSystemAdmin: true,
      };

      mockDb.limit.mockResolvedValueOnce([systemAdminUser]);
      mockDb.limit.mockResolvedValueOnce([
        { role: UserRole.ORGANIZATION_MEMBER },
      ]);

      const result = await strategy.validate(mockPayload);

      expect(result.role).toBe(UserRole.SYSTEM_ADMIN);
    });

    it('should use organization role when user is not system admin', async () => {
      mockDb.limit.mockResolvedValueOnce([mockActiveUser]);
      mockDb.limit.mockResolvedValueOnce([
        { role: UserRole.ORGANIZATION_OWNER },
      ]);

      const result = await strategy.validate(mockPayload);

      expect(result.role).toBe(UserRole.ORGANIZATION_OWNER);
    });

    it('should handle system admin without organization role query', async () => {
      const systemAdminUser = {
        ...mockActiveUser,
        organizationId: null,
        isSystemAdmin: true,
        orgIsActive: null,
        orgName: null,
      };

      mockDb.limit.mockResolvedValue([systemAdminUser]);

      const result = await strategy.validate(mockPayload);

      expect(result.role).toBe(UserRole.SYSTEM_ADMIN);
      expect(result.organizationId).toBeNull();
    });
  });
});
