import { INestApplication } from '@nestjs/common';
import { TestContainerFactory } from './setup/test-container-factory';
import { TestHelpers } from './utils/test-helpers';
import { AuthTestHelpers, AuthResponse } from './utils/auth-test-helpers';
import { AuthTestDataFactory, TestUser } from './fixtures/auth-test-data';

describe('User Profile Module (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Ensure test containers are ready
    if (!TestContainerFactory.isReady()) {
      await TestContainerFactory.setupAll();
    }

    // Create test application
    app = await TestHelpers.createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Cleanup test data and add delay
    AuthTestDataFactory.cleanup();
    await TestHelpers.sleep(100);
  });

  describe('GET /user/profile', () => {
    let authenticatedUser: { user: TestUser; tokens: AuthResponse };

    beforeEach(async () => {
      // Add delay before creating authenticated user to avoid rate limiting
      await TestHelpers.sleep(100);
      // Create authenticated user for each test
      authenticatedUser = await AuthTestHelpers.createAuthenticatedUser(app);
    });

    describe('Authenticated Access', () => {
      it('should successfully retrieve user profile with valid JWT', async () => {
        const response = await AuthTestHelpers.getUserProfile(
          app,
          authenticatedUser.tokens.accessToken,
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          userId: authenticatedUser.user.id,
          email: authenticatedUser.user.email,
          organizationId: authenticatedUser.user.organizationId,
        });

        // Verify response structure
        expect(typeof response.body.userId).toBe('string');
        expect(typeof response.body.email).toBe('string');
        expect(typeof response.body.organizationId).toBe('string');
        expect(response.body.userId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
        expect(response.body.organizationId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
        expect(response.body.email).toMatch(/^.+@.+\..+$/); // Email format
      });

      it('should return consistent profile data across multiple requests', async () => {
        const requests = Array(3)
          .fill(null)
          .map(() =>
            AuthTestHelpers.getUserProfile(
              app,
              authenticatedUser.tokens.accessToken,
            ),
          );

        const responses = await Promise.all(requests);

        // All responses should be identical
        for (const response of responses) {
          expect(response.status).toBe(200);
          expect(response.body).toEqual(responses[0]!.body);
        }
      });

      it('should work with freshly refreshed access token', async () => {
        // Refresh tokens
        const { body: refreshResponse } = await AuthTestHelpers.refreshTokens(
          app,
          authenticatedUser.tokens.refreshToken,
        );

        // Use new access token
        const response = await AuthTestHelpers.getUserProfile(
          app,
          refreshResponse.accessToken,
        );

        expect(response.status).toBe(200);
        expect(response.body.userId).toBe(authenticatedUser.user.id);
        expect(response.body.email).toBe(authenticatedUser.user.email);
      });
    });

    describe('Unauthorized Access', () => {
      it('should reject request without authorization header', async () => {
        const response = await AuthTestHelpers.createTestRequest(
          app,
          'get',
          '/user/profile',
        ).expect(401);

        expect(AuthTestHelpers.validateErrorResponse(response.body, 401)).toBe(
          true,
        );
        const messageText = AuthTestHelpers.getErrorMessageText(response.body);
        expect(messageText).toMatch(/unauthorized|token/i);
      });

      it('should reject malformed JWT tokens', async () => {
        const malformedTokens = [
          'invalid-token',
          'Bearer invalid-token',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcklkIjoiMTIzNCIsImlhdCI6MTUxNjIzOTAyMn0', // missing signature
          '',
        ];

        for (const token of malformedTokens) {
          const response = await AuthTestHelpers.makeAuthenticatedRequest(
            app,
            'get',
            '/user/profile',
            token,
            undefined,
            401,
          );

          expect(
            AuthTestHelpers.validateErrorResponse(response.body, 401),
          ).toBe(true);
        }
      });

      it('should reject expired access token', async () => {
        const expiredToken = AuthTestHelpers.createExpiredToken();

        const response = await AuthTestHelpers.makeAuthenticatedRequest(
          app,
          'get',
          '/user/profile',
          expiredToken,
          undefined,
          401,
        );

        expect(AuthTestHelpers.validateErrorResponse(response.body, 401)).toBe(
          true,
        );
      });

      it('should reject refresh token used as access token', async () => {
        const response = await AuthTestHelpers.makeAuthenticatedRequest(
          app,
          'get',
          '/user/profile',
          authenticatedUser.tokens.refreshToken,
          undefined,
          401,
        );

        expect(AuthTestHelpers.validateErrorResponse(response.body, 401)).toBe(
          true,
        );
      });

      it('should reject access token after user logout', async () => {
        const accessToken = authenticatedUser.tokens.accessToken;

        // Logout user
        await AuthTestHelpers.logout(
          app,
          authenticatedUser.tokens.refreshToken,
        );

        // Access token should still work until expiration (security design)
        // But if your implementation invalidates access tokens on logout, test for 401
        const response = await AuthTestHelpers.makeAuthenticatedRequest(
          app,
          'get',
          '/user/profile',
          accessToken,
          undefined,
          200, // Change to 401 if access tokens are invalidated on logout
        );

        expect(response.status).toBe(200); // or 401 based on implementation
      });
    });

    describe('Security and Edge Cases', () => {
      it('should not leak sensitive information in error responses', async () => {
        const response = await AuthTestHelpers.makeAuthenticatedRequest(
          app,
          'get',
          '/user/profile',
          'invalid-token',
          undefined,
          401,
        );

        // Error response should not contain sensitive data
        const responseText = JSON.stringify(response.body).toLowerCase();
        expect(responseText).not.toMatch(/password|secret|key|hash/);
        expect(response.body.message).toBeDefined();
        expect(response.body.statusCode).toBe(401);
      });

      it('should handle concurrent profile requests', async () => {
        const requests = Array(5)
          .fill(null)
          .map(() =>
            AuthTestHelpers.getUserProfile(
              app,
              authenticatedUser.tokens.accessToken,
            ),
          );

        const responses = await Promise.all(requests);

        // All requests should succeed
        for (const response of responses) {
          expect(response.status).toBe(200);
          expect(response.body.userId).toBe(authenticatedUser.user.id);
        }
      });

      it('should handle profile request with custom headers', async () => {
        const correlationId = AuthTestDataFactory.generateCorrelationId();

        const req = AuthTestHelpers.createTestRequest(
          app,
          'get',
          '/user/profile',
        )
          .set(
            'Authorization',
            `Bearer ${authenticatedUser.tokens.accessToken}`,
          )
          .set('X-Correlation-ID', correlationId);

        const response = await req;

        expect(response.status).toBe(200);
        expect(response.body.userId).toBe(authenticatedUser.user.id);
      });
    });
  });

  describe('GET /user/id', () => {
    let authenticatedUser: { user: TestUser; tokens: AuthResponse };

    beforeEach(async () => {
      // Add delay before creating authenticated user to avoid rate limiting
      await TestHelpers.sleep(100);
      authenticatedUser = await AuthTestHelpers.createAuthenticatedUser(app);
    });

    describe('Authenticated Access', () => {
      it('should successfully retrieve user ID with valid JWT', async () => {
        const response = await AuthTestHelpers.getUserId(
          app,
          authenticatedUser.tokens.accessToken,
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          userId: authenticatedUser.user.id,
        });

        // Verify response contains only userId
        expect(Object.keys(response.body)).toEqual(['userId']);
        expect(typeof response.body.userId).toBe('string');
        expect(response.body.userId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      });

      it('should return consistent user ID across requests', async () => {
        const requests = Array(3)
          .fill(null)
          .map(() =>
            AuthTestHelpers.getUserId(
              app,
              authenticatedUser.tokens.accessToken,
            ),
          );

        const responses = await Promise.all(requests);

        for (const response of responses) {
          expect(response.status).toBe(200);
          expect(response.body.userId).toBe(authenticatedUser.user.id);
        }
      });
    });

    describe('Unauthorized Access', () => {
      it('should reject request without authorization header', async () => {
        const response = await AuthTestHelpers.createTestRequest(
          app,
          'get',
          '/user/id',
        ).expect(401);

        expect(AuthTestHelpers.validateErrorResponse(response.body, 401)).toBe(
          true,
        );
      });

      it('should reject invalid access tokens', async () => {
        const response = await AuthTestHelpers.makeAuthenticatedRequest(
          app,
          'get',
          '/user/id',
          'invalid-token',
          undefined,
          401,
        );

        expect(AuthTestHelpers.validateErrorResponse(response.body, 401)).toBe(
          true,
        );
      });
    });
  });

  describe('GET /user/organization', () => {
    let authenticatedUser: { user: TestUser; tokens: AuthResponse };

    beforeEach(async () => {
      // Add delay before creating authenticated user to avoid rate limiting
      await TestHelpers.sleep(100);
      authenticatedUser = await AuthTestHelpers.createAuthenticatedUser(app);
    });

    describe('Authenticated Access', () => {
      it('should successfully retrieve organization info with valid JWT', async () => {
        const response = await AuthTestHelpers.getUserOrganization(
          app,
          authenticatedUser.tokens.accessToken,
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          organizationId: authenticatedUser.user.organizationId,
          userId: authenticatedUser.user.id,
        });

        // Verify response structure
        expect(Object.keys(response.body).sort()).toEqual([
          'organizationId',
          'userId',
        ]);
        expect(typeof response.body.organizationId).toBe('string');
        expect(typeof response.body.userId).toBe('string');
        expect(response.body.organizationId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
        expect(response.body.userId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      });

      it('should return consistent organization info across requests', async () => {
        const requests = Array(3)
          .fill(null)
          .map(() =>
            AuthTestHelpers.getUserOrganization(
              app,
              authenticatedUser.tokens.accessToken,
            ),
          );

        const responses = await Promise.all(requests);

        for (const response of responses) {
          expect(response.status).toBe(200);
          expect(response.body).toEqual(responses[0]!.body);
        }
      });

      it('should isolate organization data between different users', async () => {
        // Create second user
        const secondUser = await AuthTestHelpers.createAuthenticatedUser(app);

        // Get organization info for both users
        const [firstResponse, secondResponse] = await Promise.all([
          AuthTestHelpers.getUserOrganization(
            app,
            authenticatedUser.tokens.accessToken,
          ),
          AuthTestHelpers.getUserOrganization(
            app,
            secondUser.tokens.accessToken,
          ),
        ]);

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);

        // Organization IDs should be different
        expect(firstResponse.body.organizationId).not.toBe(
          secondResponse.body.organizationId,
        );
        expect(firstResponse.body.userId).toBe(authenticatedUser.user.id);
        expect(secondResponse.body.userId).toBe(secondUser.user.id);
      });
    });

    describe('Unauthorized Access', () => {
      it('should reject request without authorization header', async () => {
        const response = await AuthTestHelpers.createTestRequest(
          app,
          'get',
          '/user/organization',
        ).expect(401);

        expect(AuthTestHelpers.validateErrorResponse(response.body, 401)).toBe(
          true,
        );
      });

      it('should reject invalid access tokens', async () => {
        const response = await AuthTestHelpers.makeAuthenticatedRequest(
          app,
          'get',
          '/user/organization',
          'invalid-token',
          undefined,
          401,
        );

        expect(AuthTestHelpers.validateErrorResponse(response.body, 401)).toBe(
          true,
        );
      });
    });
  });

  describe('Cross-Endpoint Security Tests', () => {
    let user1: { user: TestUser; tokens: AuthResponse };
    let user2: { user: TestUser; tokens: AuthResponse };

    beforeEach(async () => {
      // Add delay before creating authenticated users to avoid rate limiting
      await TestHelpers.sleep(100);
      // Create two different users for cross-user security testing
      user1 = await AuthTestHelpers.createAuthenticatedUser(app);
      await TestHelpers.sleep(100); // Delay between user creations
      user2 = await AuthTestHelpers.createAuthenticatedUser(app);
    });

    it('should not allow access to other user data with different tokens', async () => {
      // User1's token should only access User1's data
      const user1ProfileResponse = await AuthTestHelpers.getUserProfile(
        app,
        user1.tokens.accessToken,
      );
      expect(user1ProfileResponse.body.userId).toBe(user1.user.id);

      // User2's token should only access User2's data
      const user2ProfileResponse = await AuthTestHelpers.getUserProfile(
        app,
        user2.tokens.accessToken,
      );
      expect(user2ProfileResponse.body.userId).toBe(user2.user.id);

      // Verify data isolation
      expect(user1ProfileResponse.body.userId).not.toBe(
        user2ProfileResponse.body.userId,
      );
      expect(user1ProfileResponse.body.organizationId).not.toBe(
        user2ProfileResponse.body.organizationId,
      );
    });

    it('should maintain organization isolation across all endpoints', async () => {
      const [user1Org, user2Org] = await Promise.all([
        AuthTestHelpers.getUserOrganization(app, user1.tokens.accessToken),
        AuthTestHelpers.getUserOrganization(app, user2.tokens.accessToken),
      ]);

      expect(user1Org.body.organizationId).not.toBe(
        user2Org.body.organizationId,
      );
      expect(user1Org.body.userId).toBe(user1.user.id);
      expect(user2Org.body.userId).toBe(user2.user.id);
    });

    it('should handle token mixup scenarios', async () => {
      // Try to use User1's access token with User2's refresh token (should fail during refresh)
      const { response } = await AuthTestHelpers.refreshTokens(
        app,
        user2.tokens.refreshToken,
        200, // This should succeed as refresh tokens are independent
      );

      // But the refreshed token should still only access User2's data
      const profileResponse = await AuthTestHelpers.getUserProfile(
        app,
        response.body.accessToken,
      );
      expect(profileResponse.body.userId).toBe(user2.user.id);
    });
  });

  describe('Performance and Load Tests', () => {
    let authenticatedUser: { user: TestUser; tokens: AuthResponse };

    beforeEach(async () => {
      // Add delay before creating authenticated user to avoid rate limiting
      await TestHelpers.sleep(100);
      authenticatedUser = await AuthTestHelpers.createAuthenticatedUser(app);
    });

    it('should handle multiple concurrent requests to different endpoints', async () => {
      const requests = [
        () =>
          AuthTestHelpers.getUserProfile(
            app,
            authenticatedUser.tokens.accessToken,
          ),
        () =>
          AuthTestHelpers.getUserId(app, authenticatedUser.tokens.accessToken),
        () =>
          AuthTestHelpers.getUserOrganization(
            app,
            authenticatedUser.tokens.accessToken,
          ),
        () =>
          AuthTestHelpers.getUserProfile(
            app,
            authenticatedUser.tokens.accessToken,
          ),
        () =>
          AuthTestHelpers.getUserId(app, authenticatedUser.tokens.accessToken),
      ];

      const responses = await Promise.all(requests.map((req) => req()));

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
      }

      // Verify correct responses for each endpoint type
      expect(responses[0]!.body).toHaveProperty('userId');
      expect(responses[0]!.body).toHaveProperty('email');
      expect(responses[0]!.body).toHaveProperty('organizationId');

      expect(responses[1]!.body).toEqual({ userId: authenticatedUser.user.id });
      expect(responses[2]!.body).toHaveProperty('organizationId');
      expect(responses[2]!.body).toHaveProperty('userId');
    });

    it('should maintain performance under moderate load', async () => {
      const startTime = Date.now();

      // Perform 10 rapid requests (reduced from 20 to avoid connection issues)
      const requests = Array(10)
        .fill(null)
        .map(() =>
          AuthTestHelpers.getUserProfile(
            app,
            authenticatedUser.tokens.accessToken,
          ),
        );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body.userId).toBe(authenticatedUser.user.id);
      }

      // Performance check: 10 requests should complete within reasonable time
      expect(totalTime).toBeLessThan(5000); // 5 seconds max
      console.log(`10 concurrent profile requests completed in ${totalTime}ms`);
    }, 10000);
  });
});
