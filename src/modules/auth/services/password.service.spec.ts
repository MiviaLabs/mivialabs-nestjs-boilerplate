import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';
import * as argon2 from 'argon2';

// Mock argon2 module
jest.mock('argon2');
const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('PasswordService', () => {
  let service: PasswordService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
    configService = module.get(ConfigService);

    // Setup default config values
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        ARGON2_MEMORY_COST: 65536, // 64MB
        ARGON2_TIME_COST: 3,
        ARGON2_PARALLELISM: 1,
        ARGON2_HASH_LENGTH: 32,
      };
      return config[key as keyof typeof config] || defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with configured argon2 options', async () => {
      const password = 'testPassword123';
      const hashedPassword =
        '$argon2id$v=19$m=65536,t=3,p=1$hashedPasswordResult';

      mockedArgon2.hash.mockResolvedValue(hashedPassword);

      const result = await service.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedArgon2.hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
        hashLength: 32,
      });
    });

    it('should use default argon2 options when config is not available', async () => {
      configService.get.mockReturnValue(undefined);

      const password = 'testPassword123';
      const hashedPassword = '$argon2id$v=19$m=65536,t=3,p=1$defaultHashResult';

      mockedArgon2.hash.mockResolvedValue(hashedPassword);

      const result = await service.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedArgon2.hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
        hashLength: 32,
      });
    });

    it('should handle argon2 errors', async () => {
      const password = 'testPassword123';
      const error = new Error('Argon2 hashing failed');

      mockedArgon2.hash.mockRejectedValue(error);

      await expect(service.hashPassword(password)).rejects.toThrow(
        'Failed to hash password: Argon2 hashing failed',
      );
    });

    it('should handle empty password', async () => {
      const password = '';
      const hashedPassword = '$argon2id$v=19$m=65536,t=3,p=1$emptyPasswordHash';

      mockedArgon2.hash.mockResolvedValue(hashedPassword);

      const result = await service.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedArgon2.hash).toHaveBeenCalledWith('', expect.any(Object));
    });
  });

  describe('verifyPassword', () => {
    it('should return true for matching passwords', async () => {
      const hashedPassword =
        '$argon2id$v=19$m=65536,t=3,p=1$hashedPasswordResult';
      const plainPassword = 'testPassword123';

      mockedArgon2.verify.mockResolvedValue(true);

      const result = await service.verifyPassword(
        hashedPassword,
        plainPassword,
      );

      expect(result).toBe(true);
      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        hashedPassword,
        plainPassword,
      );
    });

    it('should return false for non-matching passwords', async () => {
      const hashedPassword =
        '$argon2id$v=19$m=65536,t=3,p=1$hashedPasswordResult';
      const plainPassword = 'wrongPassword';

      mockedArgon2.verify.mockResolvedValue(false);

      const result = await service.verifyPassword(
        hashedPassword,
        plainPassword,
      );

      expect(result).toBe(false);
      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        hashedPassword,
        plainPassword,
      );
    });

    it('should return false for argon2 verification errors', async () => {
      const hashedPassword =
        '$argon2id$v=19$m=65536,t=3,p=1$hashedPasswordResult';
      const plainPassword = 'testPassword123';
      const error = new Error('Argon2 verification failed');

      mockedArgon2.verify.mockRejectedValue(error);

      const result = await service.verifyPassword(
        hashedPassword,
        plainPassword,
      );

      expect(result).toBe(false);
      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        hashedPassword,
        plainPassword,
      );
    });

    it('should return false for malformed hash', async () => {
      const plainPassword = 'testPassword123';
      const malformedHash = 'not-a-valid-argon2-hash';

      mockedArgon2.verify.mockRejectedValue(new Error('Invalid hash format'));

      const result = await service.verifyPassword(malformedHash, plainPassword);

      expect(result).toBe(false);
    });
  });

  describe('generateRandomPassword', () => {
    it('should generate password of specified length', () => {
      const length = 16;
      const password = service.generateRandomPassword(length);

      expect(password).toHaveLength(length);
    });

    it('should generate different passwords on multiple calls', () => {
      const password1 = service.generateRandomPassword(16);
      const password2 = service.generateRandomPassword(16);

      expect(password1).not.toBe(password2);
      expect(password1).toHaveLength(16);
      expect(password2).toHaveLength(16);
    });

    it('should include characters from all required categories', () => {
      const password = service.generateRandomPassword(20);

      expect(password).toMatch(/[a-z]/); // lowercase
      expect(password).toMatch(/[A-Z]/); // uppercase
      expect(password).toMatch(/\d/); // numbers
      expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/); // symbols
    });

    it('should handle minimum length requirements', () => {
      const password = service.generateRandomPassword(4);
      expect(password).toHaveLength(4);
    });

    it('should handle large password lengths', () => {
      const password = service.generateRandomPassword(50);
      expect(password).toHaveLength(50);
    });

    it('should use default length when no length specified', () => {
      const password = service.generateRandomPassword();
      expect(password).toHaveLength(16);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong passwords', () => {
      const strongPasswords = [
        'ComplexGood123!',
        'AnotherGood1@',
        'Secure#Hash2024',
        'MyStr0ng!P4ss',
      ];

      strongPasswords.forEach((password) => {
        const result = service.validatePasswordStrength(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });
    });

    it('should reject passwords that are too short', () => {
      const shortPassword = 'Short1!';
      const result = service.validatePasswordStrength(shortPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long',
      );
    });

    it('should reject passwords without uppercase letters', () => {
      const password = 'nouppercasepassword123!';
      const result = service.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter',
      );
    });

    it('should reject passwords without lowercase letters', () => {
      const password = 'NOLOWERCASEPASSWORD123!';
      const result = service.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter',
      );
    });

    it('should reject passwords without numbers', () => {
      const password = 'NoNumbersPassword!';
      const result = service.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number',
      );
    });

    it('should reject passwords without special characters', () => {
      const password = 'NoSpecialChars123';
      const result = service.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one special character',
      );
    });

    it('should accumulate multiple errors', () => {
      const weakPassword = 'weak';
      const result = service.validatePasswordStrength(weakPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long',
      );
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter',
      );
      expect(result.errors).toContain(
        'Password must contain at least one number',
      );
      expect(result.errors).toContain(
        'Password must contain at least one special character',
      );
    });

    it('should handle empty password', () => {
      const result = service.validatePasswordStrength('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters long',
      );
    });

    it('should handle very long passwords', () => {
      const longPassword = 'A'.repeat(130) + 'a1!';
      const result = service.validatePasswordStrength(longPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Password must not exceed 128 characters',
      );
    });

    it('should reject passwords with common patterns', () => {
      const commonPasswords = [
        'Password123456!',
        'MyPassword123!',
        'Welcome123!',
        'Admin123!',
      ];

      commonPasswords.forEach((password) => {
        const result = service.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Password contains common patterns and is not secure',
        );
      });
    });
  });
});
