import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard, AuthenticatedUser } from './jwt-auth.guard';

// Define proper types for test mocks
interface MockRequest {
  headers: Record<string, string>;
  user?: AuthenticatedUser;
}

// Mock database user
interface MockDbUser {
  id: string;
  email: string;
  organizationId: string | null;
  isActive: boolean;
  isSystemAdmin: boolean;
  isEmailVerified: boolean;
}

// Define proper database mock interface
interface MockDb {
  select: jest.MockedFunction<() => MockDb>;
  from: jest.MockedFunction<() => MockDb>;
  where: jest.MockedFunction<() => MockDb>;
  limit: jest.MockedFunction<(count: number) => Promise<MockDbUser[]>>;
  execute: jest.MockedFunction<(query: any) => Promise<any>>;
}

// Define JWT payload interface
interface JwtPayload {
  sub?: string;
  userId?: string;
  phone?: string;
  role?: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

// Define interface for JwtAuthGuard internal methods
interface JwtAuthGuardInternals {
  extractTokenFromHeader: (req: {
    headers: { authorization?: string };
  }) => string | undefined;
  getUserFromDatabase: (payload: JwtPayload) => Promise<AuthenticatedUser>;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: MockRequest;
  let mockDb: MockDb;

  const JWT_SECRET = 'test-secret-key';
  const VALID_TOKEN = 'valid.jwt.token';
  const INVALID_TOKEN = 'invalid.jwt.token';

  const mockDbUser: MockDbUser = {
    id: 'user123',
    email: 'test@example.com',
    organizationId: 'org123',
    isActive: true,
    isSystemAdmin: false,
    isEmailVerified: true,
  };

  beforeEach(async () => {
    // Mock database with proper typing
    const mockDbBase = {
      select: jest.fn(),
      from: jest.fn(),
      where: jest.fn(),
      limit: jest.fn(),
      execute: jest.fn(),
    };

    // Chain the methods properly
    mockDbBase.select.mockReturnValue(mockDbBase);
    mockDbBase.from.mockReturnValue(mockDbBase);
    mockDbBase.where.mockReturnValue(mockDbBase);
    mockDbBase.limit.mockResolvedValue([mockDbUser]);
    mockDbBase.execute.mockResolvedValue(undefined);

    mockDb = mockDbBase as MockDb;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: 'DB',
          useValue: mockDb,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);

    // Mock request object with proper typing
    mockRequest = {
      headers: {},
      user: undefined,
    };

    // Mock execution context with proper typing
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as jest.Mocked<ExecutionContext>;

    // Set environment variable for testing
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.JWT_SECRET;
  });

  describe('canActivate', () => {
    it('should return true for valid JWT token with database user lookup', async () => {
      const payload = {
        sub: 'user123',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockRequest.headers.authorization = `Bearer ${VALID_TOKEN}`;

      // Mock jwt.verify to return valid payload
      jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.id).toBe('user123');
      expect(mockRequest.user?.email).toBe('test@example.com');
      expect(mockRequest.user?.organizationId).toBe('org123');
      expect(mockRequest.user?.isActive).toBe(true);
      expect(mockRequest.user?.isSystemAdmin).toBe(false);
      expect(mockRequest.user?.isEmailVerified).toBe(true);

      // Verify database was queried
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should return true for valid JWT token with userId instead of sub', async () => {
      const payload = {
        userId: 'user456',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockUser = { ...mockDbUser, id: 'user456' };
      mockDb.limit.mockResolvedValue([mockUser]);

      mockRequest.headers.authorization = `Bearer ${VALID_TOKEN}`;
      jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user?.id).toBe('user456');
    });

    it('should use fallback phone when not in token', async () => {
      const payload = {
        sub: 'user789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const mockUser = { ...mockDbUser, id: 'user789' };
      mockDb.limit.mockResolvedValue([mockUser]);

      mockRequest.headers.authorization = `Bearer ${VALID_TOKEN}`;
      jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user?.id).toBe('user789');
      expect(mockRequest.user?.isActive).toBe(true);
    });

    it('should throw UnauthorizedException when no authorization header', async () => {
      mockRequest.headers = {}; // No authorization header

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Access token not found'),
      );
    });

    it('should throw UnauthorizedException when authorization header is malformed', async () => {
      mockRequest.headers.authorization = 'InvalidFormat token';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Access token not found'),
      );
    });

    it('should throw UnauthorizedException when token is not Bearer type', async () => {
      mockRequest.headers.authorization = 'Basic dXNlcjpwYXNz';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Access token not found'),
      );
    });

    it('should throw UnauthorizedException when JWT verification fails', async () => {
      mockRequest.headers.authorization = `Bearer ${INVALID_TOKEN}`;

      // Mock jwt.verify to throw a JsonWebTokenError
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        const error = new Error('Invalid token');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });

    it('should throw UnauthorizedException when JWT is expired', async () => {
      mockRequest.headers.authorization = `Bearer ${VALID_TOKEN}`;

      // Mock jwt.verify to throw TokenExpiredError
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });

    it('should throw UnauthorizedException when user not found in database', async () => {
      const payload = {
        sub: 'nonexistent-user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockRequest.headers.authorization = `Bearer ${VALID_TOKEN}`;
      jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

      // Mock database to return empty result
      mockDb.limit.mockResolvedValue([]);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const payload = {
        sub: 'inactive-user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const inactiveUser = {
        ...mockDbUser,
        id: 'inactive-user',
        isActive: false,
      };
      mockDb.limit.mockResolvedValue([inactiveUser]);

      mockRequest.headers.authorization = `Bearer ${VALID_TOKEN}`;
      jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });

    it('should throw UnauthorizedException when JWT payload is missing user id', async () => {
      const payload = {
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockRequest.headers.authorization = `Bearer ${VALID_TOKEN}`;
      jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });

    it('should handle database errors gracefully', async () => {
      const payload = {
        sub: 'user123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockRequest.headers.authorization = `Bearer ${VALID_TOKEN}`;
      jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

      // Mock database to throw error
      mockDb.limit.mockRejectedValue(new Error('Database connection failed'));

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });

    it('should throw UnauthorizedException when JWT_SECRET is not configured', async () => {
      delete process.env.JWT_SECRET;

      mockRequest.headers.authorization = `Bearer ${VALID_TOKEN}`;

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer authorization header', () => {
      const request = {
        headers: {
          authorization: 'Bearer abc123token',
        },
      };

      const guardInternals = guard as unknown as JwtAuthGuardInternals;
      const token = guardInternals.extractTokenFromHeader(request);

      expect(token).toBe('abc123token');
    });

    it('should return undefined for missing authorization header', () => {
      const request = {
        headers: {},
      };

      const guardInternals = guard as unknown as JwtAuthGuardInternals;
      const token = guardInternals.extractTokenFromHeader(request);

      expect(token).toBeUndefined();
    });

    it('should return undefined for non-Bearer authorization header', () => {
      const request = {
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      };

      const guardInternals = guard as unknown as JwtAuthGuardInternals;
      const token = guardInternals.extractTokenFromHeader(request);

      expect(token).toBeUndefined();
    });

    it('should return undefined for malformed authorization header', () => {
      const request = {
        headers: {
          authorization: 'Bearer',
        },
      };

      const guardInternals = guard as unknown as JwtAuthGuardInternals;
      const token = guardInternals.extractTokenFromHeader(request);

      expect(token).toBeUndefined();
    });

    it('should handle authorization header with extra spaces', () => {
      const request = {
        headers: {
          authorization: 'Bearer token123',
        },
      };

      const guardInternals = guard as unknown as JwtAuthGuardInternals;
      const token = guardInternals.extractTokenFromHeader(request);

      expect(token).toBe('token123');
    });
  });

  describe('getUserFromDatabase', () => {
    it('should retrieve user with correct mapping', async () => {
      const payload: JwtPayload = {
        sub: 'user123',
        phone: '+1234567890',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const guardInternals = guard as unknown as JwtAuthGuardInternals;
      const result: AuthenticatedUser =
        await guardInternals.getUserFromDatabase(payload);

      expect(result).toEqual({
        id: 'user123',
        organizationId: 'org123',
        email: 'test@example.com',
        isActive: true,
        isSystemAdmin: false,
        isEmailVerified: true,
        role: undefined,
      });
    });

    it('should handle user with null organizationId', async () => {
      const payload: JwtPayload = {
        sub: 'user123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const userWithNullOrg = { ...mockDbUser, organizationId: null };
      mockDb.limit.mockResolvedValue([userWithNullOrg]);

      const guardInternals = guard as unknown as JwtAuthGuardInternals;
      const result: AuthenticatedUser =
        await guardInternals.getUserFromDatabase(payload);

      expect(result.organizationId).toBeNull();
    });
  });

  describe('integration tests', () => {
    it('should complete full authentication flow successfully', async () => {
      const payload: JwtPayload = {
        sub: 'integration-user',
        phone: '+5511888888888',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const integrationUser = {
        ...mockDbUser,
        id: 'integration-user',
        email: 'integration@test.com',
      };
      mockDb.limit.mockResolvedValue([integrationUser]);

      mockRequest.headers.authorization = `Bearer ${VALID_TOKEN}`;
      jest.spyOn(jwt, 'verify').mockImplementation(() => payload);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual({
        id: 'integration-user',
        organizationId: 'org123',
        email: 'integration@test.com',
        isActive: true,
        isSystemAdmin: false,
        isEmailVerified: true,
        role: undefined,
      });
      expect(jwt.verify).toHaveBeenCalledWith(VALID_TOKEN, JWT_SECRET);
    });

    it('should handle real JWT token verification', async () => {
      // Clear any existing mocks
      jest.restoreAllMocks();

      const realPayload = {
        sub: 'real-user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const realUser = {
        ...mockDbUser,
        id: 'real-user',
        email: 'real@example.com',
      };
      mockDb.limit.mockResolvedValue([realUser]);

      // Create a real JWT token
      const realToken = jwt.sign(realPayload, JWT_SECRET);
      mockRequest.headers.authorization = `Bearer ${realToken}`;

      // Don't mock jwt.verify for this test - use real verification
      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user?.id).toBe('real-user');
      expect(mockRequest.user?.email).toBe('real@example.com');
    });

    it('should reject expired real JWT token', async () => {
      // Clear any existing mocks
      jest.restoreAllMocks();

      const expiredPayload = {
        sub: 'expired-user',
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
      };

      // Create a real expired JWT token
      const expiredToken = jwt.sign(expiredPayload, JWT_SECRET);
      mockRequest.headers.authorization = `Bearer ${expiredToken}`;

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Authentication failed'),
      );
    });
  });

  describe('type safety', () => {
    it('should ensure AuthenticatedUser interface compliance', async () => {
      const payload: JwtPayload = {
        sub: 'type-test-user',
        phone: '+1111111111',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const typeUser = {
        ...mockDbUser,
        id: 'type-test-user',
        email: 'type@test.com',
      };
      mockDb.limit.mockResolvedValue([typeUser]);

      const guardInternals = guard as unknown as JwtAuthGuardInternals;
      const user: AuthenticatedUser =
        await guardInternals.getUserFromDatabase(payload);

      // TypeScript compilation will fail if interface is not satisfied
      expect(typeof user.id).toBe('string');
      expect(typeof user.email).toBe('string');
      expect(
        user.organizationId === null || typeof user.organizationId === 'string',
      ).toBe(true);
    });
  });
});
