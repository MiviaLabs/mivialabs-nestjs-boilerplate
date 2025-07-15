import { BadRequestException } from '@nestjs/common';
import { UUIDValidationPipe } from './uuid-validation.pipe';

describe('UUIDValidationPipe', () => {
  let pipe: UUIDValidationPipe;

  beforeEach(() => {
    pipe = new UUIDValidationPipe();
  });

  describe('transform', () => {
    it('should pass valid UUID v4', () => {
      const validUUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      const result = pipe.transform(validUUID);

      expect(result).toBe(validUUID);
    });

    it('should pass valid UUID v1', () => {
      const validUUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

      const result = pipe.transform(validUUID);

      expect(result).toBe(validUUID);
    });

    it('should pass valid UUID v3', () => {
      const validUUID = '6fa459ea-ee8a-3ca4-894e-db77e160355e';

      const result = pipe.transform(validUUID);

      expect(result).toBe(validUUID);
    });

    it('should pass valid UUID v5', () => {
      const validUUID = '886313e1-3b8a-5372-9b90-0c9aee199e5d';

      const result = pipe.transform(validUUID);

      expect(result).toBe(validUUID);
    });

    it('should throw BadRequestException for empty string', () => {
      expect(() => pipe.transform('')).toThrow(
        new BadRequestException('UUID parameter is required'),
      );
    });

    it('should throw BadRequestException for undefined', () => {
      expect(() => pipe.transform(undefined as unknown as string)).toThrow(
        new BadRequestException('UUID parameter is required'),
      );
    });

    it('should throw BadRequestException for null', () => {
      expect(() => pipe.transform(null as unknown as string)).toThrow(
        new BadRequestException('UUID parameter is required'),
      );
    });

    it('should throw BadRequestException for invalid UUID format', () => {
      const invalidUUID = 'not-a-uuid';

      expect(() => pipe.transform(invalidUUID)).toThrow(
        new BadRequestException('Invalid UUID format'),
      );
    });

    it('should throw BadRequestException for UUID with wrong length', () => {
      const invalidUUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d4';

      expect(() => pipe.transform(invalidUUID)).toThrow(
        new BadRequestException('Invalid UUID format'),
      );
    });

    it('should throw BadRequestException for UUID with wrong format', () => {
      const invalidUUID = 'f47ac10b58cc4372a5670e02b2c3d479';

      expect(() => pipe.transform(invalidUUID)).toThrow(
        new BadRequestException('Invalid UUID format'),
      );
    });

    it('should throw BadRequestException for UUID with invalid characters', () => {
      const invalidUUID = 'g47ac10b-58cc-4372-a567-0e02b2c3d479';

      expect(() => pipe.transform(invalidUUID)).toThrow(
        new BadRequestException('Invalid UUID format'),
      );
    });

    it('should throw BadRequestException for number input', () => {
      expect(() => pipe.transform(123 as unknown as string)).toThrow(
        new BadRequestException('Invalid UUID format'),
      );
    });

    it('should throw BadRequestException for object input', () => {
      expect(() => pipe.transform({} as unknown as string)).toThrow(
        new BadRequestException('Invalid UUID format'),
      );
    });

    it('should throw BadRequestException for array input', () => {
      expect(() => pipe.transform([] as unknown as string)).toThrow(
        new BadRequestException('Invalid UUID format'),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle UUID with uppercase letters', () => {
      const upperCaseUUID = 'F47AC10B-58CC-4372-A567-0E02B2C3D479';

      const result = pipe.transform(upperCaseUUID);

      expect(result).toBe(upperCaseUUID);
    });

    it('should handle UUID with mixed case letters', () => {
      const mixedCaseUUID = 'f47AC10b-58Cc-4372-A567-0e02B2c3D479';

      const result = pipe.transform(mixedCaseUUID);

      expect(result).toBe(mixedCaseUUID);
    });

    it('should reject UUID with spaces', () => {
      const uuidWithSpaces = ' f47ac10b-58cc-4372-a567-0e02b2c3d479 ';

      expect(() => pipe.transform(uuidWithSpaces)).toThrow(
        new BadRequestException('Invalid UUID format'),
      );
    });

    it('should reject string that looks like UUID but has wrong version', () => {
      const almostValidUUID = 'f47ac10b-58cc-9372-a567-0e02b2c3d479';

      // UUID with version 9 (invalid) should be rejected
      expect(() => pipe.transform(almostValidUUID)).toThrow(
        new BadRequestException('Invalid UUID format'),
      );
    });
  });

  describe('performance', () => {
    it('should handle multiple UUID validations efficiently', () => {
      const validUUIDs = [
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        '6fa459ea-ee8a-3ca4-894e-db77e160355e',
        '886313e1-3b8a-5372-9b90-0c9aee199e5d',
      ];

      const startTime = performance.now();

      validUUIDs.forEach((uuid) => {
        const result = pipe.transform(uuid);
        expect(result).toBe(uuid);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 100ms for 4 UUIDs)
      expect(duration).toBeLessThan(100);
    });
  });

  describe('integration scenarios', () => {
    it('should work as expected in controller parameter context', () => {
      // Simulate how it would be used in a controller method parameter
      const userIds = [
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      ];

      userIds.forEach((userId) => {
        expect(() => pipe.transform(userId)).not.toThrow();
        expect(pipe.transform(userId)).toBe(userId);
      });
    });

    it('should properly reject common non-UUID inputs in real scenarios', () => {
      const commonInvalidInputs = [
        'user123',
        '123',
        'admin',
        'test',
        'abc-def-ghi',
        '00000000-0000-0000-0000-000000000000', // Nil UUID - should still be valid
      ];

      commonInvalidInputs.forEach((input) => {
        if (input === '00000000-0000-0000-0000-000000000000') {
          // Nil UUID should be valid
          expect(() => pipe.transform(input)).not.toThrow();
        } else {
          expect(() => pipe.transform(input)).toThrow(BadRequestException);
        }
      });
    });
  });

  describe('error messages', () => {
    it('should provide clear error message for missing UUID', () => {
      try {
        pipe.transform('');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe(
          'UUID parameter is required',
        );
      }
    });

    it('should provide clear error message for invalid UUID format', () => {
      try {
        pipe.transform('invalid-uuid');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toBe(
          'Invalid UUID format',
        );
      }
    });
  });
});
