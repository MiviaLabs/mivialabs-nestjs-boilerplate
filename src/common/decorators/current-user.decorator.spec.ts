import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from '../guards/jwt-auth.guard';
import { UserRole } from '@db';

// Type for the decorator factory function
type DecoratorFactory = (
  data: keyof AuthenticatedUser | undefined,
  ctx: ExecutionContext,
) => unknown;

// Helper function to get the decorator factory
function getParamDecoratorFactory(
  decorator: (...args: any[]) => ParameterDecorator,
): DecoratorFactory {
  class TestDecorator {
    public test(@decorator() _value: unknown) {
      // This parameter is required for the decorator but not used in the test
      return _value;
    }
  }

  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestDecorator,
    'test',
  ) as Record<string, { factory: DecoratorFactory }>;
  const firstKey = Object.keys(args)[0];
  if (!firstKey) {
    throw new Error('No metadata found for decorator');
  }
  const factory = args[firstKey]?.factory;
  if (!factory) {
    throw new Error('No factory found for decorator');
  }
  return factory;
}

describe('CurrentUser Decorator', () => {
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: { user?: AuthenticatedUser };

  const mockUser: AuthenticatedUser = {
    id: 'user123',
    organizationId: 'org123',
    email: 'test@example.com',
    isSystemAdmin: false,
    isActive: true,
    isEmailVerified: true,
    role: UserRole.ORGANIZATION_MEMBER,
  };

  // Helper function to call the decorator's factory function
  const callDecorator = (data?: keyof AuthenticatedUser): unknown => {
    const factory = getParamDecoratorFactory(CurrentUser);
    return factory(data, mockExecutionContext);
  };

  beforeEach(() => {
    mockRequest = {};

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as jest.Mocked<ExecutionContext>;
  });

  describe('when user is authenticated', () => {
    beforeEach(() => {
      mockRequest.user = mockUser;
    });

    it('should return the entire user object when no property is specified', () => {
      const result = callDecorator();

      expect(result).toEqual(mockUser);
      expect(result).toHaveProperty('id', 'user123');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('organizationId', 'org123');
      expect(result).toHaveProperty('isSystemAdmin', false);
      expect(result).toHaveProperty('isActive', true);
      expect(result).toHaveProperty('isEmailVerified', true);
      expect(result).toHaveProperty('role', UserRole.ORGANIZATION_MEMBER);
    });

    it('should return specific property when property name is provided', () => {
      expect(callDecorator('id')).toBe('user123');
      expect(callDecorator('email')).toBe('test@example.com');
      expect(callDecorator('organizationId')).toBe('org123');
      expect(callDecorator('isSystemAdmin')).toBe(false);
      expect(callDecorator('isActive')).toBe(true);
      expect(callDecorator('isEmailVerified')).toBe(true);
      expect(callDecorator('role')).toBe(UserRole.ORGANIZATION_MEMBER);
    });

    it('should return boolean values correctly', () => {
      const systemAdminUser: AuthenticatedUser = {
        ...mockUser,
        isSystemAdmin: true,
        isActive: false,
        isEmailVerified: false,
      };
      mockRequest.user = systemAdminUser;

      expect(callDecorator('isSystemAdmin')).toBe(true);
      expect(callDecorator('isActive')).toBe(false);
      expect(callDecorator('isEmailVerified')).toBe(false);
    });

    it('should return undefined for optional role when not set', () => {
      const userWithoutRole: AuthenticatedUser = {
        id: 'user456',
        organizationId: 'org456',
        email: 'user@example.com',
        isSystemAdmin: false,
        isActive: true,
        isEmailVerified: true,
        role: undefined,
      };
      mockRequest.user = userWithoutRole;

      expect(callDecorator('role')).toBeUndefined();
    });

    it('should handle user with null organization', () => {
      const userWithoutOrg: AuthenticatedUser = {
        id: 'global-user',
        organizationId: null,
        email: 'global@example.com',
        isSystemAdmin: true,
        isActive: true,
        isEmailVerified: true,
        role: UserRole.SYSTEM_ADMIN,
      };
      mockRequest.user = userWithoutOrg;

      expect(callDecorator('organizationId')).toBeNull();
      expect(callDecorator('isSystemAdmin')).toBe(true);
      expect(callDecorator('role')).toBe(UserRole.SYSTEM_ADMIN);
    });

    it('should handle user with minimal required fields', () => {
      const minimalUser: AuthenticatedUser = {
        id: 'minimal-user',
        organizationId: 'org-minimal',
        email: 'minimal@example.com',
        isSystemAdmin: false,
        isActive: true,
        isEmailVerified: false,
      };
      mockRequest.user = minimalUser;

      const result = callDecorator();
      expect(result).toEqual(minimalUser);
      expect((result as AuthenticatedUser).id).toBe('minimal-user');
      expect((result as AuthenticatedUser).role).toBeUndefined();
    });
  });

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      mockRequest.user = undefined;
    });

    it('should return null when no user is present and no property is specified', () => {
      const result = callDecorator();
      expect(result).toBeNull();
    });

    it('should return null when no user is present and property is specified', () => {
      expect(callDecorator('id')).toBeNull();
      expect(callDecorator('email')).toBeNull();
      expect(callDecorator('organizationId')).toBeNull();
      expect(callDecorator('isSystemAdmin')).toBeNull();
      expect(callDecorator('isActive')).toBeNull();
      expect(callDecorator('isEmailVerified')).toBeNull();
      expect(callDecorator('role')).toBeNull();
    });
  });

  describe('execution context handling', () => {
    it('should properly extract request from HTTP context', () => {
      mockRequest.user = mockUser;

      const result = callDecorator();

      expect(result).toEqual(mockUser);
      // The decorator should successfully extract the user from the request
      expect(result).toHaveProperty('id', 'user123');
      expect(result).toHaveProperty('email', 'test@example.com');
    });

    it('should handle different execution contexts', () => {
      const alternativeRequest = { user: mockUser };
      const getRequestMock = jest.fn().mockReturnValue(alternativeRequest);
      const switchToHttpMock = jest.fn().mockReturnValue({
        getRequest: getRequestMock,
      });
      const alternativeContext = {
        switchToHttp: switchToHttpMock,
      } as unknown as jest.Mocked<ExecutionContext>;

      const factory = getParamDecoratorFactory(CurrentUser);
      const result = factory('id', alternativeContext);

      expect(result).toBe('user123');
      expect(switchToHttpMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('type safety', () => {
    it('should work with all valid AuthenticatedUser properties', () => {
      mockRequest.user = mockUser;

      // Test that all properties from AuthenticatedUser interface are accessible
      const validProperties: (keyof AuthenticatedUser)[] = [
        'id',
        'organizationId',
        'email',
        'isSystemAdmin',
        'isActive',
        'isEmailVerified',
        'role',
      ];

      validProperties.forEach((property) => {
        const result = callDecorator(property);
        // All properties should be defined for our mock user
        if (property === 'role') {
          expect(result).toBe(UserRole.ORGANIZATION_MEMBER);
        } else {
          expect(result).toBeDefined();
        }
      });
    });

    it('should maintain type safety for return values', () => {
      mockRequest.user = mockUser;

      // These should return strings
      const id = callDecorator('id');
      const email = callDecorator('email');

      expect(typeof id).toBe('string');
      expect(typeof email).toBe('string');

      // These should return booleans
      const isSystemAdmin = callDecorator('isSystemAdmin');
      const isActive = callDecorator('isActive');
      const isEmailVerified = callDecorator('isEmailVerified');

      expect(typeof isSystemAdmin).toBe('boolean');
      expect(typeof isActive).toBe('boolean');
      expect(typeof isEmailVerified).toBe('boolean');

      // Organization ID can be string or null
      const organizationId = callDecorator('organizationId');
      expect(
        typeof organizationId === 'string' || organizationId === null,
      ).toBe(true);

      // Role can be UserRole enum or undefined
      const role = callDecorator('role');
      expect(
        Object.values(UserRole).includes(role as UserRole) ||
          role === undefined,
      ).toBe(true);

      // Full user should be an object
      const fullUser = callDecorator();
      expect(typeof fullUser).toBe('object');
      expect(fullUser).not.toBeNull();
    });
  });

  describe('real-world usage scenarios', () => {
    it('should work in controller method context', () => {
      // Simulate how it would be used in a controller
      mockRequest.user = mockUser;

      // Getting full user for profile endpoint
      const profileData = callDecorator();
      expect(profileData).toEqual(mockUser);

      // Getting user ID for authorization
      const userId = callDecorator('id');
      expect(userId).toBe('user123');

      // Getting user role for permission checks
      const userRole = callDecorator('role');
      expect(userRole).toBe(UserRole.ORGANIZATION_MEMBER);

      // Getting organization ID for multi-tenant filtering
      const orgId = callDecorator('organizationId');
      expect(orgId).toBe('org123');
    });

    it('should handle user updates during request lifecycle', () => {
      // Initial user state
      mockRequest.user = mockUser;
      let result = callDecorator('email');
      expect(result).toBe('test@example.com');

      // User data updated during request
      mockRequest.user = {
        ...mockUser,
        email: 'updated@example.com',
      };
      result = callDecorator('email');
      expect(result).toBe('updated@example.com');
    });

    it('should work with different user roles and permissions', () => {
      const systemAdminUser: AuthenticatedUser = {
        id: 'admin1',
        organizationId: null,
        email: 'admin@example.com',
        isSystemAdmin: true,
        isActive: true,
        isEmailVerified: true,
        role: UserRole.SYSTEM_ADMIN,
      };

      const organizationOwnerUser: AuthenticatedUser = {
        id: 'owner1',
        organizationId: 'org-owner',
        email: 'owner@example.com',
        isSystemAdmin: false,
        isActive: true,
        isEmailVerified: true,
        role: UserRole.ORGANIZATION_OWNER,
      };

      const memberUser: AuthenticatedUser = {
        id: 'member1',
        organizationId: 'org-member',
        email: 'member@example.com',
        isSystemAdmin: false,
        isActive: true,
        isEmailVerified: true,
        role: UserRole.ORGANIZATION_MEMBER,
      };

      // Test system admin user
      mockRequest.user = systemAdminUser;
      expect(callDecorator('role')).toBe(UserRole.SYSTEM_ADMIN);
      expect(callDecorator('isSystemAdmin')).toBe(true);
      expect(callDecorator('organizationId')).toBeNull();

      // Test organization owner user
      mockRequest.user = organizationOwnerUser;
      expect(callDecorator('role')).toBe(UserRole.ORGANIZATION_OWNER);
      expect(callDecorator('isSystemAdmin')).toBe(false);
      expect(callDecorator('organizationId')).toBe('org-owner');

      // Test member user
      mockRequest.user = memberUser;
      expect(callDecorator('role')).toBe(UserRole.ORGANIZATION_MEMBER);
      expect(callDecorator('isSystemAdmin')).toBe(false);
      expect(callDecorator('organizationId')).toBe('org-member');
    });
  });

  describe('edge cases', () => {
    it('should handle request without user property', () => {
      const requestWithoutUser = {};
      mockExecutionContext.switchToHttp().getRequest = jest
        .fn()
        .mockReturnValue(requestWithoutUser);

      const result = callDecorator();
      expect(result).toBeNull();
    });

    it('should handle null user', () => {
      mockRequest.user = null as unknown as AuthenticatedUser;

      const result = callDecorator();
      expect(result).toBeNull();
    });

    it('should handle user with undefined optional properties', () => {
      const userWithUndefinedProps: AuthenticatedUser = {
        id: 'user789',
        organizationId: 'org789',
        email: 'user789@example.com',
        isSystemAdmin: false,
        isActive: true,
        isEmailVerified: false,
        role: undefined,
      };
      mockRequest.user = userWithUndefinedProps;

      expect(callDecorator('role')).toBeUndefined();
      expect(callDecorator('id')).toBe('user789');
      expect(callDecorator('isEmailVerified')).toBe(false);
    });

    it('should handle inactive and unverified users', () => {
      const inactiveUser: AuthenticatedUser = {
        id: 'inactive-user',
        organizationId: 'org-inactive',
        email: 'inactive@example.com',
        isSystemAdmin: false,
        isActive: false,
        isEmailVerified: false,
        role: UserRole.ORGANIZATION_MEMBER,
      };
      mockRequest.user = inactiveUser;

      expect(callDecorator('isActive')).toBe(false);
      expect(callDecorator('isEmailVerified')).toBe(false);
      expect(callDecorator('role')).toBe(UserRole.ORGANIZATION_MEMBER);
    });
  });

  describe('decorator factory behavior', () => {
    it('should be a createParamDecorator result', () => {
      expect(typeof CurrentUser).toBe('function');
      // The decorator should be a function (result of createParamDecorator)
      expect(CurrentUser).toBeInstanceOf(Function);
    });

    it('should work when called multiple times', () => {
      mockRequest.user = mockUser;

      const result1 = callDecorator('id');
      const result2 = callDecorator('email');
      const result3 = callDecorator();

      expect(result1).toBe('user123');
      expect(result2).toBe('test@example.com');
      expect(result3).toEqual(mockUser);
    });

    it('should not interfere with other decorator calls', () => {
      mockRequest.user = mockUser;

      // Simulate multiple decorators being used
      const userId = callDecorator('id');
      const userEmail = callDecorator('email');
      const userRole = callDecorator('role');
      const isSystemAdmin = callDecorator('isSystemAdmin');

      expect(userId).toBe('user123');
      expect(userEmail).toBe('test@example.com');
      expect(userRole).toBe(UserRole.ORGANIZATION_MEMBER);
      expect(isSystemAdmin).toBe(false);
    });
  });

  describe('role-based access scenarios', () => {
    it('should properly extract roles for authorization checks', () => {
      // Test with organization owner
      const ownerUser: AuthenticatedUser = {
        ...mockUser,
        role: UserRole.ORGANIZATION_OWNER,
      };
      mockRequest.user = ownerUser;

      expect(callDecorator('role')).toBe(UserRole.ORGANIZATION_OWNER);

      // Test with system admin
      const adminUser: AuthenticatedUser = {
        ...mockUser,
        isSystemAdmin: true,
        role: UserRole.SYSTEM_ADMIN,
      };
      mockRequest.user = adminUser;

      expect(callDecorator('role')).toBe(UserRole.SYSTEM_ADMIN);
      expect(callDecorator('isSystemAdmin')).toBe(true);
    });

    it('should handle multi-tenant scenarios', () => {
      // User with organization
      const orgUser: AuthenticatedUser = {
        ...mockUser,
        organizationId: 'tenant-123',
      };
      mockRequest.user = orgUser;

      expect(callDecorator('organizationId')).toBe('tenant-123');

      // Global user without organization
      const globalUser: AuthenticatedUser = {
        ...mockUser,
        organizationId: null,
        isSystemAdmin: true,
      };
      mockRequest.user = globalUser;

      expect(callDecorator('organizationId')).toBeNull();
      expect(callDecorator('isSystemAdmin')).toBe(true);
    });
  });
});
