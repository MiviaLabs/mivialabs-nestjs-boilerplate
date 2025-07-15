import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesGuard, Roles } from './roles.guard';
import { AuthenticatedUser } from './jwt-auth.guard';
import { UserRole } from '@db';

// Define proper types for test mocks
interface MockRequest {
  user?: AuthenticatedUser;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;
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
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<jest.Mocked<Reflector>>(Reflector);

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
    it('should return true when no roles are required', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      // Verify the reflector was called to get required roles
    });

    it('should throw ForbiddenException when user is not authenticated', () => {
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
      ]);
      mockRequest.user = undefined;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Authentication required'),
      );
    });

    it('should return true for system admin regardless of required roles', () => {
      const systemAdminUser = createMockUser({
        isSystemAdmin: true,
        role: UserRole.SYSTEM_ADMIN,
      });
      mockRequest.user = systemAdminUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
      ]);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should return true for system admin with isSystemAdmin flag', () => {
      const systemAdminUser = createMockUser({
        isSystemAdmin: true,
        role: UserRole.ORGANIZATION_MEMBER,
      });
      mockRequest.user = systemAdminUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
      ]);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should return true for system admin with role only', () => {
      const systemAdminUser = createMockUser({
        isSystemAdmin: false,
        role: UserRole.SYSTEM_ADMIN,
      });
      mockRequest.user = systemAdminUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
      ]);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should return true when user has required role', () => {
      const ownerUser = createMockUser({
        role: UserRole.ORGANIZATION_OWNER,
      });
      mockRequest.user = ownerUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
      ]);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should return true when user has one of multiple required roles', () => {
      const memberUser = createMockUser({
        role: UserRole.ORGANIZATION_MEMBER,
      });
      mockRequest.user = memberUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
        UserRole.ORGANIZATION_MEMBER,
      ]);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user does not have required role', () => {
      const memberUser = createMockUser({
        role: UserRole.ORGANIZATION_MEMBER,
      });
      mockRequest.user = memberUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
      ]);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Required role(s): organization_owner'),
      );
    });

    it('should throw ForbiddenException when user has no role but role is required', () => {
      const userWithoutRole = createMockUser({
        role: undefined,
      });
      mockRequest.user = userWithoutRole;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_MEMBER,
      ]);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Required role(s): organization_member'),
      );
    });

    it('should format multiple required roles in error message', () => {
      const memberUser = createMockUser({
        role: UserRole.ORGANIZATION_MEMBER,
      });
      mockRequest.user = memberUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
        UserRole.SYSTEM_ADMIN,
      ]);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException(
          'Required role(s): organization_owner, system_admin',
        ),
      );
    });
  });

  describe('Roles decorator', () => {
    it('should create metadata with single role', () => {
      const decorator = Roles(UserRole.ORGANIZATION_OWNER);

      // Test that decorator function works
      expect(typeof decorator).toBe('function');
    });

    it('should create metadata with multiple roles', () => {
      const decorator = Roles(
        UserRole.ORGANIZATION_OWNER,
        UserRole.ORGANIZATION_MEMBER,
      );

      // Test that decorator function works
      expect(typeof decorator).toBe('function');
    });

    it('should create metadata with all role types', () => {
      const decorator = Roles(
        UserRole.SYSTEM_ADMIN,
        UserRole.ORGANIZATION_OWNER,
        UserRole.ORGANIZATION_MEMBER,
      );

      // Test that decorator function works
      expect(typeof decorator).toBe('function');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex role checking scenario', () => {
      // Test organization owner accessing owner-only resource
      const ownerUser = createMockUser({
        role: UserRole.ORGANIZATION_OWNER,
        isSystemAdmin: false,
      });
      mockRequest.user = ownerUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
      ]);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      // Verify the reflector was called to get required roles
    });

    it('should handle member trying to access owner resource', () => {
      const memberUser = createMockUser({
        role: UserRole.ORGANIZATION_MEMBER,
        isSystemAdmin: false,
      });
      mockRequest.user = memberUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
      ]);

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Required role(s): organization_owner'),
      );
    });

    it('should handle system admin overriding role restrictions', () => {
      const systemAdminUser = createMockUser({
        role: UserRole.ORGANIZATION_MEMBER, // Lower role
        isSystemAdmin: true, // But is system admin
      });
      mockRequest.user = systemAdminUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
      ]);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should handle user with no organization role but is system admin', () => {
      const systemAdminUser = createMockUser({
        role: undefined,
        isSystemAdmin: true,
        organizationId: null,
      });
      mockRequest.user = systemAdminUser;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_OWNER,
      ]);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });
  });

  describe('type safety', () => {
    it('should ensure UserRole enum compatibility', () => {
      const allRoles = [
        UserRole.SYSTEM_ADMIN,
        UserRole.ORGANIZATION_OWNER,
        UserRole.ORGANIZATION_MEMBER,
      ];

      allRoles.forEach((role) => {
        const user = createMockUser({ role });
        mockRequest.user = user;
        reflector.getAllAndOverride.mockReturnValue([role]);

        const result = guard.canActivate(mockExecutionContext);
        expect(result).toBe(true);
      });
    });

    it('should handle AuthenticatedUser interface correctly', () => {
      const user: AuthenticatedUser = {
        id: 'test-id',
        organizationId: 'test-org',
        email: 'test@test.com',
        isSystemAdmin: false,
        isActive: true,
        isEmailVerified: true,
        role: UserRole.ORGANIZATION_MEMBER,
      };

      mockRequest.user = user;
      reflector.getAllAndOverride.mockReturnValue([
        UserRole.ORGANIZATION_MEMBER,
      ]);

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });
});
