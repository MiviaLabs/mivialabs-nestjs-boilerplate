import * as argon2 from 'argon2';
import { verifyPassword } from './verify-password';

// Mock argon2
jest.mock('argon2');
const mockArgon2Verify = argon2.verify as jest.MockedFunction<
  typeof argon2.verify
>;

describe('verifyPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('successful verification', () => {
    it('should return true when password matches hash without secret', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      mockArgon2Verify.mockResolvedValue(true);

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(true);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: undefined,
      });
      expect(mockArgon2Verify).toHaveBeenCalledTimes(1);
    });

    it('should return true when password matches hash with secret', async () => {
      // Arrange
      const password = 'securePassword456';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      const secretKey = 'bXlTZWNyZXRLZXk='; // Base64 encoded 'mySecretKey'
      mockArgon2Verify.mockResolvedValue(true);

      // Act
      const result = await verifyPassword(password, hash, secretKey);

      // Assert
      expect(result).toBe(true);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: Buffer.from(secretKey, 'base64'),
      });
      expect(mockArgon2Verify).toHaveBeenCalledTimes(1);
    });

    it('should handle empty password', async () => {
      // Arrange
      const password = '';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      mockArgon2Verify.mockResolvedValue(true);

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(true);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: undefined,
      });
    });

    it('should handle very long password', async () => {
      // Arrange
      const password = 'a'.repeat(1000);
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      mockArgon2Verify.mockResolvedValue(true);

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(true);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: undefined,
      });
    });

    it('should handle password with special characters', async () => {
      // Arrange
      const password = 'P@ssw0rd!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      mockArgon2Verify.mockResolvedValue(true);

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(true);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: undefined,
      });
    });

    it('should handle unicode characters in password', async () => {
      // Arrange
      const password = 'пароль123🔒';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      mockArgon2Verify.mockResolvedValue(true);

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(true);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: undefined,
      });
    });
  });

  describe('failed verification', () => {
    it('should return false when password does not match hash', async () => {
      // Arrange
      const password = 'wrongPassword';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      mockArgon2Verify.mockResolvedValue(false);

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(false);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: undefined,
      });
      expect(mockArgon2Verify).toHaveBeenCalledTimes(1);
    });

    it('should return false when password does not match hash with secret', async () => {
      // Arrange
      const password = 'wrongPassword';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      const secretKey = 'bXlTZWNyZXRLZXk=';
      mockArgon2Verify.mockResolvedValue(false);

      // Act
      const result = await verifyPassword(password, hash, secretKey);

      // Assert
      expect(result).toBe(false);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: Buffer.from(secretKey, 'base64'),
      });
    });

    it('should return false when using wrong secret key', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      const wrongSecretKey = 'd3JvbmdTZWNyZXQ='; // Base64 encoded 'wrongSecret'
      mockArgon2Verify.mockResolvedValue(false);

      // Act
      const result = await verifyPassword(password, hash, wrongSecretKey);

      // Assert
      expect(result).toBe(false);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: Buffer.from(wrongSecretKey, 'base64'),
      });
    });
  });

  describe('error handling', () => {
    it('should return false when argon2.verify throws an error', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = 'invalid-hash-format';
      mockArgon2Verify.mockRejectedValue(new Error('Invalid hash format'));

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(false);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: undefined,
      });
      expect(mockArgon2Verify).toHaveBeenCalledTimes(1);
    });

    it('should return false when argon2.verify throws with secret key', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = 'invalid-hash-format';
      const secretKey = 'bXlTZWNyZXRLZXk=';
      mockArgon2Verify.mockRejectedValue(new Error('Invalid hash format'));

      // Act
      const result = await verifyPassword(password, hash, secretKey);

      // Assert
      expect(result).toBe(false);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: Buffer.from(secretKey, 'base64'),
      });
    });

    it('should return false with malformed hash', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = 'not-a-valid-argon2-hash';
      mockArgon2Verify.mockRejectedValue(new Error('Invalid hash'));

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false with empty hash', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = '';
      mockArgon2Verify.mockRejectedValue(new Error('Empty hash'));

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle argon2 library throwing unexpected errors', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      mockArgon2Verify.mockRejectedValue(new Error('Unexpected library error'));

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(false);
      expect(mockArgon2Verify).toHaveBeenCalledTimes(1);
    });
  });

  describe('secret key handling', () => {
    it('should properly decode base64 secret key', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      const secretKey = 'bXlTZWNyZXRLZXk='; // Base64 encoded 'mySecretKey'
      mockArgon2Verify.mockResolvedValue(true);

      // Act
      await verifyPassword(password, hash, secretKey);

      // Assert
      const call = mockArgon2Verify.mock.calls[0];
      const options = call?.[2] as { secret?: Buffer };
      expect(options.secret).toEqual(Buffer.from(secretKey, 'base64'));
      expect(options.secret?.toString()).toBe('mySecretKey');
    });

    it('should handle empty secret key as undefined', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      const secretKey = '';
      mockArgon2Verify.mockResolvedValue(true);

      // Act
      await verifyPassword(password, hash, secretKey);

      // Assert
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: undefined,
      });
    });

    it('should handle undefined secret key', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      mockArgon2Verify.mockResolvedValue(true);

      // Act
      await verifyPassword(password, hash, undefined);

      // Assert
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: undefined,
      });
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent verification operations', async () => {
      // Arrange
      const passwords = ['password1', 'password2', 'password3'];
      const hashes = [
        '$argon2id$v=19$m=524288,t=5,p=1$salt1$hash1',
        '$argon2id$v=19$m=524288,t=5,p=1$salt2$hash2',
        '$argon2id$v=19$m=524288,t=5,p=1$salt3$hash3',
      ];
      const expectedResults = [true, false, true];

      // Mock each call to return different results
      mockArgon2Verify
        .mockResolvedValueOnce(expectedResults[0]!)
        .mockResolvedValueOnce(expectedResults[1]!)
        .mockResolvedValueOnce(expectedResults[2]!);

      // Act
      const verifyPromises = passwords.map((p, i) =>
        verifyPassword(p, hashes[i]!),
      );
      const results = await Promise.all(verifyPromises);

      // Assert
      expect(results).toEqual(expectedResults);
      expect(mockArgon2Verify).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure in concurrent operations', async () => {
      // Arrange
      const passwords = ['correctPassword', 'wrongPassword', 'anotherCorrect'];
      const hashes = [
        '$argon2id$v=19$m=524288,t=5,p=1$salt1$hash1',
        '$argon2id$v=19$m=524288,t=5,p=1$salt2$hash2',
        '$argon2id$v=19$m=524288,t=5,p=1$salt3$hash3',
      ];

      mockArgon2Verify
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Verification failed'))
        .mockResolvedValueOnce(true);

      // Act
      const verifyPromises = passwords.map((p, i) =>
        verifyPassword(p, hashes[i]!),
      );
      const results = await Promise.all(verifyPromises);

      // Assert
      expect(results).toEqual([true, false, true]);
      expect(mockArgon2Verify).toHaveBeenCalledTimes(3);
    });
  });

  describe('edge cases', () => {
    it('should handle null-like values gracefully', async () => {
      // Arrange
      const password = 'testPassword123';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      mockArgon2Verify.mockRejectedValue(new Error('Invalid input'));

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle newlines and whitespace in password', async () => {
      // Arrange
      const password = 'password\nwith\twhitespace ';
      const hash = '$argon2id$v=19$m=524288,t=5,p=1$salt$hash';
      mockArgon2Verify.mockResolvedValue(true);

      // Act
      const result = await verifyPassword(password, hash);

      // Assert
      expect(result).toBe(true);
      expect(mockArgon2Verify).toHaveBeenCalledWith(hash, password, {
        secret: undefined,
      });
    });
  });
});
