import * as argon2 from 'argon2';
import { hashPassword } from './hash-password';

// Mock the entire argon2 module
jest.mock('argon2', () => ({
  hash: jest.fn(),
  verify: jest.fn(),
  argon2id: 2, // Mock the constant
}));

describe('hashPassword', () => {
  let mockArgon2Hash: jest.MockedFunction<typeof argon2.hash>;

  beforeEach(() => {
    mockArgon2Hash = argon2.hash as jest.MockedFunction<typeof argon2.hash>;

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should hash a password successfully', async () => {
      // Arrange
      const password = 'testPassword123';
      const expectedHash = '$argon2id$v=19$m=524288,t=5,p=1$mockSalt$mockHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(password);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledTimes(1);
      expect(mockArgon2Hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 19, // 512 MB
        timeCost: 5,
        parallelism: 1,
        secret: undefined,
      });
    });

    it('should call argon2.hash with correct parameters', async () => {
      // Arrange
      const password = 'testPassword123';
      const expectedHash = '$argon2id$v=19$m=524288,t=5,p=1$mockSalt$mockHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      await hashPassword(password);

      // Assert
      expect(mockArgon2Hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 524288, // 2^19
        timeCost: 5,
        parallelism: 1,
        secret: undefined,
      });
    });

    it('should return the hash from argon2.hash', async () => {
      // Arrange
      const password = 'testPassword123';
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$differentSalt$differentHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(password);

      // Assert
      expect(result).toBe(expectedHash);
    });

    it('should hash password with secret hashing key', async () => {
      // Arrange
      const password = 'testPassword123';
      const secretKey = 'mySecretKey123';
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$secretSalt$secretHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(password, secretKey);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 524288,
        timeCost: 5,
        parallelism: 1,
        secret: expect.any(Buffer) as Buffer,
      });

      // Verify the secret buffer content
      const call = mockArgon2Hash.mock.calls[0];
      const options = call?.[1] as { secret?: Buffer };
      expect(options.secret).toEqual(expect.any(Buffer));
      // The secret is created from base64, so we verify the base64 decoding
      expect(options.secret).toEqual(Buffer.from(secretKey, 'base64'));
    });
  });

  describe('password variations', () => {
    it('should handle short passwords', async () => {
      // Arrange
      const shortPassword = '123';
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$shortSalt$shortHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(shortPassword);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledWith(
        shortPassword,
        expect.any(Object),
      );
    });

    it('should handle long passwords', async () => {
      // Arrange
      const longPassword = 'a'.repeat(1000);
      const expectedHash = '$argon2id$v=19$m=524288,t=5,p=1$longSalt$longHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(longPassword);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledWith(
        longPassword,
        expect.any(Object),
      );
    });

    it('should handle passwords with special characters', async () => {
      // Arrange
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?`~';
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$specialSalt$specialHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(specialPassword);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledWith(
        specialPassword,
        expect.any(Object),
      );
    });

    it('should handle passwords with unicode characters', async () => {
      // Arrange
      const unicodePassword = 'пароль123🔒🛡️';
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$unicodeSalt$unicodeHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(unicodePassword);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledWith(
        unicodePassword,
        expect.any(Object),
      );
    });

    it('should handle empty string password', async () => {
      // Arrange
      const emptyPassword = '';
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$emptySalt$emptyHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(emptyPassword);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledWith(
        emptyPassword,
        expect.any(Object),
      );
    });

    it('should handle passwords with whitespace', async () => {
      // Arrange
      const whitespacePassword = '  password with spaces  ';
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$whitespaceSalt$whitespaceHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(whitespacePassword);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledWith(
        whitespacePassword,
        expect.any(Object),
      );
    });
  });

  describe('secret hashing key functionality', () => {
    it('should use secret when provided', async () => {
      // Arrange
      const password = 'testPassword123';
      const secretKey = 'mySecretHashingKey';
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$secretSalt$secretHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(password, secretKey);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 524288,
        timeCost: 5,
        parallelism: 1,
        secret: expect.any(Buffer) as Buffer,
      });

      // Verify the secret buffer content
      const call = mockArgon2Hash.mock.calls[0];
      const options = call?.[1] as { secret?: Buffer };
      expect(options.secret).toEqual(expect.any(Buffer));
      // The secret is created from base64, so we verify the base64 decoding
      expect(options.secret).toEqual(Buffer.from(secretKey, 'base64'));
    });

    it('should not use secret when not provided', async () => {
      // Arrange
      const password = 'testPassword123';
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$noSecretSalt$noSecretHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(password);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 524288,
        timeCost: 5,
        parallelism: 1,
        secret: undefined,
      });
    });

    it('should handle empty secret key', async () => {
      // Arrange
      const password = 'testPassword123';
      const secretKey = ''; // Empty string
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$c29tZXNhbHQ$hashedpassword';

      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = await hashPassword(password, secretKey);

      // Assert
      expect(result).toBe(expectedHash);
      expect(mockArgon2Hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 524288,
        timeCost: 5,
        parallelism: 1,
        secret: undefined, // Empty string is falsy, so function returns undefined
      });
      expect(mockArgon2Hash).toHaveBeenCalledTimes(1);
    });
  });

  describe('argon2 configuration', () => {
    it('should use argon2id algorithm', async () => {
      // Arrange
      const password = 'testPassword123';
      const expectedHash = '$argon2id$v=19$m=524288,t=5,p=1$mockSalt$mockHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      await hashPassword(password);

      // Assert
      expect(mockArgon2Hash).toHaveBeenCalledWith(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 19, // 512 MB
        timeCost: 5,
        parallelism: 1,
        secret: undefined,
      });
    });

    it('should use correct memory cost (512 MB)', async () => {
      // Arrange
      const password = 'testPassword123';
      const expectedHash = '$argon2id$v=19$m=524288,t=5,p=1$mockSalt$mockHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      await hashPassword(password);

      // Assert
      expect(mockArgon2Hash).toHaveBeenCalledWith(
        password,
        expect.objectContaining({
          memoryCost: 524288, // 2^19 = 524288
        }),
      );
    });

    it('should use correct time cost', async () => {
      // Arrange
      const password = 'testPassword123';
      const expectedHash = '$argon2id$v=19$m=524288,t=5,p=1$mockSalt$mockHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      await hashPassword(password);

      // Assert
      expect(mockArgon2Hash).toHaveBeenCalledWith(
        password,
        expect.objectContaining({
          timeCost: 5,
        }),
      );
    });

    it('should use single thread parallelism', async () => {
      // Arrange
      const password = 'testPassword123';
      const expectedHash = '$argon2id$v=19$m=524288,t=5,p=1$mockSalt$mockHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      await hashPassword(password);

      // Assert
      expect(mockArgon2Hash).toHaveBeenCalledWith(
        password,
        expect.objectContaining({
          parallelism: 1,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should propagate argon2 errors', async () => {
      // Arrange
      const password = 'testPassword123';
      const expectedError = new Error('Argon2 error');
      mockArgon2Hash.mockRejectedValue(expectedError);

      // Act & Assert
      await expect(hashPassword(password)).rejects.toThrow('Argon2 error');
      expect(mockArgon2Hash).toHaveBeenCalledWith(password, expect.any(Object));
    });

    it('should propagate specific argon2 errors', async () => {
      // Arrange
      const password = 'testPassword123';
      const specificError = new Error('Memory allocation failed');
      mockArgon2Hash.mockRejectedValue(specificError);

      // Act & Assert
      await expect(hashPassword(password)).rejects.toThrow(
        'Memory allocation failed',
      );
      expect(mockArgon2Hash).toHaveBeenCalledWith(password, expect.any(Object));
    });

    it('should handle unexpected errors', async () => {
      // Arrange
      const password = 'testPassword123';
      const unexpectedError = new TypeError('Unexpected error');
      mockArgon2Hash.mockRejectedValue(unexpectedError);

      // Act & Assert
      await expect(hashPassword(password)).rejects.toThrow('Unexpected error');
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent hash operations', async () => {
      // Arrange
      const passwords = ['password1', 'password2', 'password3'];
      const expectedHashes = [
        '$argon2id$v=19$m=524288,t=5,p=1$salt1$hash1',
        '$argon2id$v=19$m=524288,t=5,p=1$salt2$hash2',
        '$argon2id$v=19$m=524288,t=5,p=1$salt3$hash3',
      ];

      // Mock each call to return different hashes
      mockArgon2Hash
        .mockResolvedValueOnce(expectedHashes[0]!)
        .mockResolvedValueOnce(expectedHashes[1]!)
        .mockResolvedValueOnce(expectedHashes[2]!);

      // Act
      const hashPromises = passwords.map((p) => hashPassword(p));
      const results = await Promise.all(hashPromises);

      // Assert
      expect(results).toEqual(expectedHashes);
      expect(mockArgon2Hash).toHaveBeenCalledTimes(3);
      passwords.forEach((password, index) => {
        expect(mockArgon2Hash).toHaveBeenNthCalledWith(
          index + 1,
          password,
          expect.any(Object),
        );
      });
    });
  });

  describe('type safety', () => {
    it('should accept string input and return Promise<string>', async () => {
      // Arrange
      const password: string = 'typedPassword123';
      const expectedHash =
        '$argon2id$v=19$m=524288,t=5,p=1$typedSalt$typedHash';
      mockArgon2Hash.mockResolvedValue(expectedHash);

      // Act
      const result = hashPassword(password);

      // Assert
      expect(result).toBeInstanceOf(Promise);
      const resolvedResult = await result;
      expect(typeof resolvedResult).toBe('string');
      expect(resolvedResult).toBe(expectedHash);
    });

    it('should work with different string types', async () => {
      // Arrange
      const passwords = [
        'regular string',
        String('constructed string'),
        `template string`,
      ];
      const expectedHashes = [
        '$argon2id$v=19$m=524288,t=5,p=1$salt1$hash1',
        '$argon2id$v=19$m=524288,t=5,p=1$salt2$hash2',
        '$argon2id$v=19$m=524288,t=5,p=1$salt3$hash3',
      ];

      mockArgon2Hash
        .mockResolvedValueOnce(expectedHashes[0]!)
        .mockResolvedValueOnce(expectedHashes[1]!)
        .mockResolvedValueOnce(expectedHashes[2]!);

      // Act & Assert
      for (let i = 0; i < passwords.length; i++) {
        const result = await hashPassword(passwords[i]!);
        expect(result).toBe(expectedHashes[i]);
      }
    });
  });
});
