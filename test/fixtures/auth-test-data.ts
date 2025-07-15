import { SignupDto } from '../../src/modules/auth/dto/signup.dto';
import { LoginDto } from '../../src/modules/auth/dto/login.dto';
import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  organizationId: string;
  organizationSlug: string;
  isActive: boolean;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}

export class AuthTestDataFactory {
  private static readonly TEST_PASSWORD = 'TestPassword123!';
  private static usedEmails = new Set<string>();
  private static usedSlugs = new Set<string>();

  /**
   * Generate unique signup data with optional overrides
   */
  static generateSignupData(overrides: Partial<SignupDto> = {}): SignupDto {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);

    const baseEmail = `test-${timestamp}-${randomSuffix}@example.com`;
    const baseSlug = `test-org-${timestamp}-${randomSuffix}`;

    // Ensure uniqueness
    let email = baseEmail;
    let slug = baseSlug;
    let counter = 1;

    while (this.usedEmails.has(email)) {
      email = `test-${timestamp}-${randomSuffix}-${counter}@example.com`;
      counter++;
    }

    counter = 1;
    while (this.usedSlugs.has(slug)) {
      slug = `test-org-${timestamp}-${randomSuffix}-${counter}`;
      counter++;
    }

    this.usedEmails.add(email);
    this.usedSlugs.add(slug);

    return {
      email,
      password: this.TEST_PASSWORD,
      firstName: 'Test',
      lastName: 'User',
      organizationName: `Test Organization ${timestamp}`,
      organizationSlug: slug,
      organizationDescription: 'A test organization for e2e testing',
      organizationWebsite: 'https://test-org.example.com',
      ...overrides,
    };
  }

  /**
   * Generate login data for existing users
   */
  static generateLoginData(overrides: Partial<LoginDto> = {}): LoginDto {
    return {
      email: 'test@example.com',
      password: this.TEST_PASSWORD,
      ...overrides,
    };
  }

  /**
   * Generate invalid signup data for validation testing
   */
  static generateInvalidSignupData(): {
    invalidEmail: SignupDto[];
    invalidPassword: SignupDto[];
    invalidNames: SignupDto[];
    invalidOrganization: SignupDto[];
  } {
    const baseData = this.generateSignupData();

    return {
      invalidEmail: [
        { ...baseData, email: 'invalid-email' },
        { ...baseData, email: 'user@' },
        { ...baseData, email: '@domain.com' },
        { ...baseData, email: '' },
      ],
      invalidPassword: [
        { ...baseData, password: 'short' },
        { ...baseData, password: '' },
      ],
      invalidNames: [
        { ...baseData, firstName: '' },
        { ...baseData, lastName: '' },
        { ...baseData, firstName: 'a'.repeat(51) },
        { ...baseData, lastName: 'a'.repeat(51) },
      ],
      invalidOrganization: [
        { ...baseData, organizationName: '' },
        { ...baseData, organizationSlug: '' },
        { ...baseData, organizationSlug: 'ab' }, // too short
        { ...baseData, organizationSlug: 'a'.repeat(51) }, // too long
        { ...baseData, organizationSlug: 'Invalid-Slug' }, // uppercase
        { ...baseData, organizationSlug: 'invalid slug' }, // spaces
        { ...baseData, organizationSlug: 'invalid@slug' }, // special chars
        { ...baseData, organizationName: 'a'.repeat(101) }, // too long
        { ...baseData, organizationDescription: 'a'.repeat(501) }, // too long
        { ...baseData, organizationWebsite: 'invalid-url' },
        { ...baseData, organizationWebsite: 'ftp://invalid-protocol.com' },
      ],
    };
  }

  /**
   * Generate invalid login data for validation testing
   */
  static generateInvalidLoginData(): {
    invalidEmail: LoginDto[];
    invalidPassword: LoginDto[];
    missing: Partial<LoginDto>[];
  } {
    return {
      invalidEmail: [
        { email: 'invalid-email', password: this.TEST_PASSWORD },
        { email: '', password: this.TEST_PASSWORD },
        { email: 'user@', password: this.TEST_PASSWORD },
      ],
      invalidPassword: [
        { email: 'test@example.com', password: 'short' },
        { email: 'test@example.com', password: '' },
      ],
      missing: [
        { password: this.TEST_PASSWORD }, // missing email
        { email: 'test@example.com' }, // missing password
        {}, // missing both
      ],
    };
  }

  /**
   * Generate data for rate limiting tests
   */
  static generateRateLimitTestData(count: number): SignupDto[] {
    return Array.from({ length: count }, () => this.generateSignupData());
  }

  /**
   * Generate test data for organization slug conflicts
   */
  static generateConflictTestData(existingSlug: string): SignupDto {
    return this.generateSignupData({
      organizationSlug: existingSlug,
    });
  }

  /**
   * Generate test data for email conflicts
   */
  static generateEmailConflictData(existingEmail: string): SignupDto {
    return this.generateSignupData({
      email: existingEmail,
    });
  }

  /**
   * Create mock user data for testing
   */
  static createMockUser(overrides: Partial<TestUser> = {}): TestUser {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);

    return {
      id: uuidv4(),
      email: `mock-user-${timestamp}@example.com`,
      password: this.TEST_PASSWORD,
      organizationId: uuidv4(),
      organizationSlug: `mock-org-${timestamp}-${randomSuffix}`,
      isActive: true,
      ...overrides,
    };
  }

  /**
   * Create test users with different activation states
   */
  static createTestUsersForActivation(): {
    activeUser: TestUser;
    inactiveUser: TestUser;
    activeUserInactiveOrg: TestUser;
  } {
    return {
      activeUser: this.createMockUser({ isActive: true }),
      inactiveUser: this.createMockUser({ isActive: false }),
      activeUserInactiveOrg: this.createMockUser({
        isActive: true,
        // This will be handled by setting organization.isActive = false
      }),
    };
  }

  /**
   * Clean up test data tracking
   */
  static cleanup(): void {
    this.usedEmails.clear();
    this.usedSlugs.clear();
  }

  /**
   * Get the standard test password
   */
  static getTestPassword(): string {
    return this.TEST_PASSWORD;
  }

  /**
   * Generate correlation ID for test requests
   */
  static generateCorrelationId(): string {
    return uuidv4();
  }

  /**
   * Generate invalid refresh token data (malformed - should return 400)
   */
  static generateMalformedRefreshTokens(): string[] {
    return [
      '', // empty
      'invalid-token', // malformed
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid', // malformed JWT
      'a'.repeat(10), // too short but valid format
      'token-with-invalid-chars!@#$%', // invalid characters
    ];
  }

  /**
   * Generate invalid refresh token data (well-formed but invalid - should return 401)
   */
  static generateInvalidRefreshTokens(): string[] {
    return [
      // These are well-formed but invalid JWT tokens that should return 401
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // valid JWT but not from our system
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.4Adoxfwq8JqBgC7KFV2_bHKxGG_gfyKBP4qFZQIiUhKo', // expired but valid format
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWtlLXVzZXItaWQiLCJpYXQiOjE1MTYyMzkwMjIsInR5cGUiOiJyZWZyZXNoIn0.fakesignature123456789fakesignature123456789', // fake refresh token
    ];
  }

  /**
   * Generate test headers for requests
   */
  static generateTestHeaders(correlationId?: string): Record<string, string> {
    return {
      'X-Correlation-ID': correlationId || this.generateCorrelationId(),
      'X-Request-ID': this.generateCorrelationId(),
      'User-Agent': 'Auth-E2E-Tests/1.0',
      'Content-Type': 'application/json',
    };
  }
}
