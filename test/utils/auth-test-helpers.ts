import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelpers } from './test-helpers';
import { AuthTestDataFactory, TestUser } from '../fixtures/auth-test-data';
import { SignupDto } from '../../src/modules/auth/dto/signup.dto';
import { LoginDto } from '../../src/modules/auth/dto/login.dto';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: {
    id: string;
    email: string;
    organizationId: string;
  };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export class AuthTestHelpers extends TestHelpers {
  /**
   * Perform user signup and return the response
   */
  static async performSignup(
    app: INestApplication,
    signupData: SignupDto,
    expectedStatus: number = 201,
  ): Promise<{ response: request.Response; body: AuthResponse }> {
    const correlationId = AuthTestDataFactory.generateCorrelationId();

    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .set(AuthTestDataFactory.generateTestHeaders(correlationId))
      .send(signupData)
      .expect(expectedStatus);

    return { response, body: response.body as AuthResponse };
  }

  /**
   * Perform user login and return the response
   */
  static async performLogin(
    app: INestApplication,
    loginData: LoginDto,
    expectedStatus: number = 200,
  ): Promise<{ response: request.Response; body: AuthResponse }> {
    const correlationId = AuthTestDataFactory.generateCorrelationId();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set(AuthTestDataFactory.generateTestHeaders(correlationId))
      .send(loginData)
      .expect(expectedStatus);

    return { response, body: response.body as AuthResponse };
  }

  /**
   * Refresh JWT tokens
   */
  static async refreshTokens(
    app: INestApplication,
    refreshToken: string,
    expectedStatus: number = 200,
  ): Promise<{ response: request.Response; body: RefreshResponse }> {
    const correlationId = AuthTestDataFactory.generateCorrelationId();

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set(AuthTestDataFactory.generateTestHeaders(correlationId))
      .send({ refreshToken })
      .expect(expectedStatus);

    return { response, body: response.body as RefreshResponse };
  }

  /**
   * Logout user and invalidate tokens
   */
  static async logout(
    app: INestApplication,
    refreshToken: string,
    expectedStatus: number = 200,
  ): Promise<{ response: request.Response; body: LogoutResponse }> {
    const correlationId = AuthTestDataFactory.generateCorrelationId();

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set(AuthTestDataFactory.generateTestHeaders(correlationId))
      .send({ refreshToken })
      .expect(expectedStatus);

    return { response, body: response.body as LogoutResponse };
  }

  /**
   * Make authenticated request to protected endpoints
   */
  static async makeAuthenticatedRequest(
    app: INestApplication,
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    accessToken: string,
    body?: any,
    expectedStatus?: number,
  ): Promise<request.Response> {
    const correlationId = AuthTestDataFactory.generateCorrelationId();
    let req = request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${accessToken}`)
      .set(AuthTestDataFactory.generateTestHeaders(correlationId));

    if (body) {
      req = req.send(body);
    }

    if (expectedStatus !== undefined) {
      req = req.expect(expectedStatus);
    }

    return req;
  }

  /**
   * Get user profile using access token
   */
  static async getUserProfile(
    app: INestApplication,
    accessToken: string,
    expectedStatus: number = 200,
  ): Promise<request.Response> {
    return this.makeAuthenticatedRequest(
      app,
      'get',
      '/user/profile',
      accessToken,
      undefined,
      expectedStatus,
    );
  }

  /**
   * Get user ID using access token
   */
  static async getUserId(
    app: INestApplication,
    accessToken: string,
    expectedStatus: number = 200,
  ): Promise<request.Response> {
    return this.makeAuthenticatedRequest(
      app,
      'get',
      '/user/id',
      accessToken,
      undefined,
      expectedStatus,
    );
  }

  /**
   * Get user organization info using access token
   */
  static async getUserOrganization(
    app: INestApplication,
    accessToken: string,
    expectedStatus: number = 200,
  ): Promise<request.Response> {
    return this.makeAuthenticatedRequest(
      app,
      'get',
      '/user/organization',
      accessToken,
      undefined,
      expectedStatus,
    );
  }

  /**
   * Complete signup flow and return user with tokens
   */
  static async createAuthenticatedUser(
    app: INestApplication,
    signupData?: Partial<SignupDto>,
  ): Promise<{ user: TestUser; tokens: AuthResponse }> {
    const userData = AuthTestDataFactory.generateSignupData(signupData);
    const { body: authResponse } = await this.performSignup(app, userData);

    const testUser: TestUser = {
      id: authResponse.user.id,
      email: authResponse.user.email,
      password: userData.password,
      organizationId: authResponse.user.organizationId,
      organizationSlug: userData.organizationSlug,
      isActive: true,
      tokens: {
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
      },
    };

    return { user: testUser, tokens: authResponse };
  }

  /**
   * Test with different account activation configurations
   */
  static async testWithAccountActivation<T>(
    activationValue: boolean,
    testFunction: () => Promise<T>,
  ): Promise<T> {
    // Note: In a real scenario, you might need to modify the configuration
    // For testing purposes, we'll simulate this behavior
    const originalValue = process.env.APP_ACCOUNT_ACTIVE_AFTER_SIGNUP;
    process.env.APP_ACCOUNT_ACTIVE_AFTER_SIGNUP = activationValue.toString();

    try {
      return await testFunction();
    } finally {
      // Restore original value
      if (originalValue !== undefined) {
        process.env.APP_ACCOUNT_ACTIVE_AFTER_SIGNUP = originalValue;
      } else {
        delete process.env.APP_ACCOUNT_ACTIVE_AFTER_SIGNUP;
      }
    }
  }

  /**
   * Validate JWT token structure without decoding
   */
  static validateTokenStructure(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // JWT should have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Each part should be base64 encoded (allowing URL-safe characters)
    const base64Pattern = /^[A-Za-z0-9_-]+$/;
    return parts.every((part) => part.length > 0 && base64Pattern.test(part));
  }

  /**
   * Validate auth response structure
   */
  static validateAuthResponse(response: any): response is AuthResponse {
    return (
      response &&
      typeof response.accessToken === 'string' &&
      typeof response.refreshToken === 'string' &&
      typeof response.accessTokenExpiresAt === 'string' &&
      typeof response.refreshTokenExpiresAt === 'string' &&
      response.user &&
      typeof response.user.id === 'string' &&
      typeof response.user.email === 'string' &&
      typeof response.user.organizationId === 'string' &&
      this.validateTokenStructure(response.accessToken) &&
      this.validateTokenStructure(response.refreshToken)
    );
  }

  /**
   * Validate error response structure
   */
  static validateErrorResponse(
    response: any,
    expectedStatus: number,
    expectedMessage?: string,
  ): boolean {
    // Handle standard NestJS error response format
    const isStandardError =
      response &&
      typeof response.statusCode === 'number' &&
      (typeof response.message === 'string' ||
        Array.isArray(response.message)) &&
      (typeof response.error === 'string' || response.error === undefined);

    // Handle custom error response format (like organization slug conflicts)
    const isCustomError =
      response &&
      typeof response.message === 'string' &&
      (Array.isArray(response.errors) || response.errors === undefined);

    if (!isStandardError && !isCustomError) {
      return false;
    }

    // For standard errors, check statusCode
    if (isStandardError && response.statusCode !== expectedStatus) {
      return false;
    }

    // For custom errors, we assume the HTTP status code was already validated by the test

    if (expectedMessage) {
      const messageText = Array.isArray(response.message)
        ? response.message.join(', ')
        : response.message;

      if (messageText !== expectedMessage) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get message text from error response (handles both string and array formats)
   */
  static getErrorMessageText(response: any): string {
    if (Array.isArray(response.message)) {
      return response.message.join(', ');
    }
    return response.message || '';
  }

  /**
   * Wait for rate limiting to reset
   */
  static async waitForRateLimitReset(
    windowSizeMs: number,
    additionalDelayMs: number = 1000,
  ): Promise<void> {
    const totalWait = windowSizeMs + additionalDelayMs;
    console.log(`Waiting ${totalWait}ms for rate limit reset...`);
    await this.sleep(totalWait);
  }

  /**
   * Perform rapid requests to test rate limiting
   */
  static async performRapidRequests<T>(
    requests: (() => Promise<T>)[],
    concurrency: number = 5,
  ): Promise<T[]> {
    const chunks = [];
    for (let i = 0; i < requests.length; i += concurrency) {
      chunks.push(requests.slice(i, i + concurrency));
    }

    const results: T[] = [];
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map((req) => req()));
      results.push(...chunkResults);

      // Small delay between chunks to avoid overwhelming the server
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.sleep(10);
      }
    }

    return results;
  }

  /**
   * Validate JWT token expiration times
   */
  static validateTokenExpiration(
    authResponse: AuthResponse,
    expectedAccessTokenMinutes: number = 15,
    expectedRefreshTokenDays: number = 7,
  ): boolean {
    const now = new Date();
    const accessExpiry = new Date(authResponse.accessTokenExpiresAt);
    const refreshExpiry = new Date(authResponse.refreshTokenExpiresAt);

    // Access token should expire in approximately 15 minutes
    const accessDiffMinutes =
      (accessExpiry.getTime() - now.getTime()) / (1000 * 60);
    const accessTokenValid =
      accessDiffMinutes > expectedAccessTokenMinutes - 1 &&
      accessDiffMinutes < expectedAccessTokenMinutes + 1;

    // Refresh token should expire in approximately 7 days
    const refreshDiffDays =
      (refreshExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    const refreshTokenValid =
      refreshDiffDays > expectedRefreshTokenDays - 0.1 &&
      refreshDiffDays < expectedRefreshTokenDays + 0.1;

    return accessTokenValid && refreshTokenValid;
  }

  /**
   * Create an expired access token for testing (simulation)
   */
  static createExpiredToken(): string {
    // This is a mock expired token for testing purposes
    // In real testing, you might need to create actual expired tokens
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.expired';
  }

  /**
   * Generate test request with custom headers
   */
  static createTestRequest(
    app: INestApplication,
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
  ): request.Test {
    const correlationId = AuthTestDataFactory.generateCorrelationId();
    return request(app.getHttpServer())
      [method](path)
      .set(AuthTestDataFactory.generateTestHeaders(correlationId));
  }
}
