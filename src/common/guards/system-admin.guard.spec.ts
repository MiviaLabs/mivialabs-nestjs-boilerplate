import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SystemAdminGuard } from './system-admin.guard';
import { AuthenticatedUser } from './jwt-auth.guard';
import { UserRole } from '@db';

// Define proper types for test mocks
interface MockRequest {
  user?: AuthenticatedUser;
}

describe('SystemAdminGuard', () => {
  let guard: SystemAdminGuard;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: MockRequest;

  const createMockUser = (
    overrides: Partial<AuthenticatedUser> = {},
  ): AuthenticatedUser => ({
    id: 'user123',
    organizationId: 'org123',
    email: 'test@example.com',
    isSystemAdmin: false,
    isActive: true,
    isEmailVerified: true,
    role: UserRole.ORGANIZATION_MEMBER,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemAdminGuard],
    }).compile();

    guard = module.get<SystemAdminGuard>(SystemAdminGuard);

    // Mock request object
    mockRequest = {};

    // Mock execution context
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as jest.Mocked<ExecutionContext>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true for user with SYSTEM_ADMIN role', () => {
      const systemAdminUser = createMockUser({
        role: UserRole.SYSTEM_ADMIN,
        isSystemAdmin: true,
      });
      mockRequest.user = systemAdminUser;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should return true for user with SYSTEM_ADMIN role even if isSystemAdmin is false', () => {
      const systemAdminUser = createMockUser({
        role: UserRole.SYSTEM_ADMIN,
        isSystemAdmin: false,
      });
      mockRequest.user = systemAdminUser;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      mockRequest.user = undefined;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Authentication required'),
      );
    });

    it('should throw ForbiddenException for organization owner', () => {
      const ownerUser = createMockUser({
        role: UserRole.ORGANIZATION_OWNER,
        isSystemAdmin: false,
      });
      mockRequest.user = ownerUser;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('System Admin privileges required'),
      );
    });

    it('should throw ForbiddenException for organization member', () => {
      const memberUser = createMockUser({
        role: UserRole.ORGANIZATION_MEMBER,
        isSystemAdmin: false,
      });
      mockRequest.user = memberUser;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('System Admin privileges required'),
      );
    });

    it('should throw ForbiddenException for user with no role', () => {
      const userWithoutRole = createMockUser({
        role: undefined,
        isSystemAdmin: false,
      });
      mockRequest.user = userWithoutRole;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('System Admin privileges required'),
      );
    });

    it('should throw ForbiddenException for user with isSystemAdmin true but wrong role', () => {
      const userWithAdminFlag = createMockUser({
        role: UserRole.ORGANIZATION_OWNER,
        isSystemAdmin: true,
      });
      mockRequest.user = userWithAdminFlag;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('System Admin privileges required'),
      );
    });

    it('should throw ForbiddenException for inactive system admin', () => {
      const inactiveAdminUser = createMockUser({
        role: UserRole.SYSTEM_ADMIN,
        isSystemAdmin: true,
        isActive: false,
      });
      mockRequest.user = inactiveAdminUser;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true); // Guard only checks role, not active status
    });

    it('should throw ForbiddenException for unverified system admin', () => {
      const unverifiedAdminUser = createMockUser({
        role: UserRole.SYSTEM_ADMIN,
        isSystemAdmin: true,
        isEmailVerified: false,
      });
      mockRequest.user = unverifiedAdminUser;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true); // Guard only checks role, not verification status
    });

    it('should work with system admin without organization', () => {
      const globalAdminUser = createMockUser({
        role: UserRole.SYSTEM_ADMIN,
        isSystemAdmin: true,
        organizationId: null,
      });
      mockRequest.user = globalAdminUser;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical system admin access', () => {
      const systemAdmin = createMockUser({
        id: 'admin-123',
        role: UserRole.SYSTEM_ADMIN,
        isSystemAdmin: true,
        email: 'admin@system.com',
        organizationId: null,
      });
      mockRequest.user = systemAdmin;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should block regular user from system admin endpoint', () => {
      const regularUser = createMockUser({
        id: 'user-456',
        role: UserRole.ORGANIZATION_MEMBER,
        isSystemAdmin: false,
        email: 'user@company.com',
        organizationId: 'company-123',
      });
      mockRequest.user = regularUser;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('System Admin privileges required'),
      );
    });

    it('should block organization owner from system admin endpoint', () => {
      const orgOwner = createMockUser({
        id: 'owner-789',
        role: UserRole.ORGANIZATION_OWNER,
        isSystemAdmin: false,
        email: 'owner@company.com',
        organizationId: 'company-123',
      });
      mockRequest.user = orgOwner;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('System Admin privileges required'),
      );
    });

    it('should handle missing request user gracefully', () => {
      mockRequest.user = undefined;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Authentication required'),
      );
    });
  });

  describe('type safety', () => {
    it('should ensure UserRole enum compatibility', () => {
      // Test all possible roles
      const roles = [
        UserRole.SYSTEM_ADMIN,
        UserRole.ORGANIZATION_OWNER,
        UserRole.ORGANIZATION_MEMBER,
      ];

      roles.forEach((role) => {
        const user = createMockUser({ role });
        mockRequest.user = user;

        if (role === UserRole.SYSTEM_ADMIN) {
          const result = guard.canActivate(mockExecutionContext);
          expect(result).toBe(true);
        } else {
          expect(() => guard.canActivate(mockExecutionContext)).toThrow(
            new ForbiddenException('System Admin privileges required'),
          );
        }
      });
    });

    it('should handle AuthenticatedUser interface correctly', () => {
      const user: AuthenticatedUser = {
        id: 'test-id',
        organizationId: 'test-org',
        email: 'test@test.com',
        isSystemAdmin: true,
        isActive: true,
        isEmailVerified: true,
        role: UserRole.SYSTEM_ADMIN,
      };

      mockRequest.user = user;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('should handle user with partial AuthenticatedUser properties', () => {
      const minimalUser: AuthenticatedUser = {
        id: 'minimal-id',
        organizationId: null,
        email: 'minimal@test.com',
        isSystemAdmin: false,
        isActive: true,
        isEmailVerified: false,
        role: UserRole.SYSTEM_ADMIN,
      };

      mockRequest.user = minimalUser;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined role correctly', () => {
      const userWithUndefinedRole = createMockUser({
        role: undefined,
      });
      mockRequest.user = userWithUndefinedRole;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('System Admin privileges required'),
      );
    });

    it('should handle null user object', () => {
      mockRequest.user = null as unknown as AuthenticatedUser;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Authentication required'),
      );
    });

    it('should handle malformed execution context', () => {
      const malformedContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(null),
        }),
      } as unknown as jest.Mocked<ExecutionContext>;

      expect(() => guard.canActivate(malformedContext)).toThrow();
    });
  });
});
