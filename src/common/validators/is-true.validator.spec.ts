import { validate } from 'class-validator';
import { IsTrue } from './is-true.validator';

describe('IsTrue Validator', () => {
  class TestDto {
    @IsTrue()
    termsAccepted!: boolean;

    @IsTrue({ message: 'You must accept the privacy policy' })
    privacyPolicyAccepted!: boolean;

    @IsTrue({ message: 'Custom error message for $property' })
    customField!: boolean;
  }

  describe('validation behavior', () => {
    it('should pass validation when value is true', async () => {
      const dto = new TestDto();
      dto.termsAccepted = true;
      dto.privacyPolicyAccepted = true;
      dto.customField = true;

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when value is false', async () => {
      const dto = new TestDto();
      dto.termsAccepted = false;
      dto.privacyPolicyAccepted = false;
      dto.customField = false;

      const errors = await validate(dto);

      expect(errors).toHaveLength(3);

      const termsError = errors.find(
        (error) => error.property === 'termsAccepted',
      );
      const privacyError = errors.find(
        (error) => error.property === 'privacyPolicyAccepted',
      );
      const customError = errors.find(
        (error) => error.property === 'customField',
      );

      expect(termsError).toBeDefined();
      expect(privacyError).toBeDefined();
      expect(customError).toBeDefined();
    });

    it('should fail validation when value is undefined', async () => {
      const dto = new TestDto();
      // Leave all fields undefined

      const errors = await validate(dto);

      expect(errors).toHaveLength(3);

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isTrue');
      });
    });

    it('should fail validation when value is null', async () => {
      const dto = new TestDto();
      dto.termsAccepted = null as unknown as boolean;
      dto.privacyPolicyAccepted = null as unknown as boolean;
      dto.customField = null as unknown as boolean;

      const errors = await validate(dto);

      expect(errors).toHaveLength(3);

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isTrue');
      });
    });

    it('should fail validation for non-boolean values', async () => {
      const dto = new TestDto();
      dto.termsAccepted = 'true' as unknown as boolean;
      dto.privacyPolicyAccepted = 1 as unknown as boolean;
      dto.customField = {} as unknown as boolean;

      const errors = await validate(dto);

      expect(errors).toHaveLength(3);

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isTrue');
      });
    });

    it('should fail validation for truthy values that are not exactly true', async () => {
      const dto = new TestDto();
      dto.termsAccepted = 'yes' as unknown as boolean;
      dto.privacyPolicyAccepted = 1 as unknown as boolean;
      dto.customField = [] as unknown as boolean;

      const errors = await validate(dto);

      expect(errors).toHaveLength(3);

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isTrue');
      });
    });
  });

  describe('error messages', () => {
    it('should use default error message when no custom message provided', async () => {
      const dto = new TestDto();
      dto.termsAccepted = false;
      dto.privacyPolicyAccepted = true;
      dto.customField = true;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);

      const termsError = errors.find(
        (error) => error.property === 'termsAccepted',
      );
      expect(termsError?.constraints?.isTrue).toBe(
        'termsAccepted must be true',
      );
    });

    it('should use custom error message when provided', async () => {
      const dto = new TestDto();
      dto.termsAccepted = true;
      dto.privacyPolicyAccepted = false;
      dto.customField = true;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);

      const privacyError = errors.find(
        (error) => error.property === 'privacyPolicyAccepted',
      );
      expect(privacyError?.constraints?.isTrue).toBe(
        'You must accept the privacy policy',
      );
    });

    it('should support property placeholder in custom message', async () => {
      const dto = new TestDto();
      dto.termsAccepted = true;
      dto.privacyPolicyAccepted = true;
      dto.customField = false;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);

      const customError = errors.find(
        (error) => error.property === 'customField',
      );
      expect(customError?.constraints?.isTrue).toBe(
        'Custom error message for customField',
      );
    });

    it('should handle multiple validation failures with correct messages', async () => {
      const dto = new TestDto();
      dto.termsAccepted = false;
      dto.privacyPolicyAccepted = false;
      dto.customField = false;

      const errors = await validate(dto);

      expect(errors).toHaveLength(3);

      const termsError = errors.find(
        (error) => error.property === 'termsAccepted',
      );
      const privacyError = errors.find(
        (error) => error.property === 'privacyPolicyAccepted',
      );
      const customError = errors.find(
        (error) => error.property === 'customField',
      );

      expect(termsError?.constraints?.isTrue).toBe(
        'termsAccepted must be true',
      );
      expect(privacyError?.constraints?.isTrue).toBe(
        'You must accept the privacy policy',
      );
      expect(customError?.constraints?.isTrue).toBe(
        'Custom error message for customField',
      );
    });
  });

  describe('real-world use cases', () => {
    class RegistrationDto {
      @IsTrue({ message: 'You must accept the terms and conditions' })
      acceptTerms!: boolean;

      @IsTrue({ message: 'You must accept the privacy policy' })
      acceptPrivacy!: boolean;

      @IsTrue({ message: 'You must be 18 or older' })
      ageConfirmation!: boolean;
    }

    it('should validate registration form with all required acceptances', async () => {
      const registration = new RegistrationDto();
      registration.acceptTerms = true;
      registration.acceptPrivacy = true;
      registration.ageConfirmation = true;

      const errors = await validate(registration);

      expect(errors).toHaveLength(0);
    });

    it('should fail registration when terms are not accepted', async () => {
      const registration = new RegistrationDto();
      registration.acceptTerms = false;
      registration.acceptPrivacy = true;
      registration.ageConfirmation = true;

      const errors = await validate(registration);

      expect(errors).toHaveLength(1);
      expect(errors[0]?.property).toBe('acceptTerms');
      expect(errors[0]?.constraints?.isTrue).toBe(
        'You must accept the terms and conditions',
      );
    });

    it('should fail registration when multiple acceptances are missing', async () => {
      const registration = new RegistrationDto();
      registration.acceptTerms = false;
      registration.acceptPrivacy = false;
      registration.ageConfirmation = true;

      const errors = await validate(registration);

      expect(errors).toHaveLength(2);

      const errorMessages = errors.map((error) => error.constraints?.isTrue);
      expect(errorMessages).toContain(
        'You must accept the terms and conditions',
      );
      expect(errorMessages).toContain('You must accept the privacy policy');
    });
  });

  describe('edge cases', () => {
    class EdgeCaseDto {
      @IsTrue()
      booleanField!: boolean;
    }

    it('should handle empty object', async () => {
      const dto = new EdgeCaseDto();

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0]?.constraints?.isTrue).toBe('booleanField must be true');
    });

    it('should handle object with extra properties', async () => {
      const dto = new EdgeCaseDto();
      dto.booleanField = true;
      (dto as unknown as Record<string, unknown>).extraProperty =
        'should be ignored';

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should work with inheritance', async () => {
      class BaseDto {
        @IsTrue()
        baseField!: boolean;
      }

      class ExtendedDto extends BaseDto {
        @IsTrue()
        extendedField!: boolean;
      }

      const dto = new ExtendedDto();
      dto.baseField = true;
      dto.extendedField = false;

      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0]?.property).toBe('extendedField');
    });
  });

  describe('validator function behavior', () => {
    it('should handle various falsy values correctly', async () => {
      const falsyValues = [false, 0, '', null, undefined, NaN];

      for (const value of falsyValues) {
        // Create a fresh DTO class for each test to avoid cross-contamination
        class FreshTestDto {
          @IsTrue()
          termsAccepted!: boolean;

          @IsTrue()
          privacyPolicyAccepted!: boolean;

          @IsTrue()
          customField!: boolean;
        }

        const dto = new FreshTestDto();
        dto.termsAccepted = value as boolean;
        dto.privacyPolicyAccepted = true;
        dto.customField = true;

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.property).toBe('termsAccepted');
      }
    });

    it('should handle various truthy values that are not true correctly', async () => {
      const truthyValues = [1, 'true', 'yes', [], {}, 'false'];

      for (const value of truthyValues) {
        // Create a fresh DTO class for each test to avoid cross-contamination
        class FreshTestDto {
          @IsTrue()
          termsAccepted!: boolean;

          @IsTrue()
          privacyPolicyAccepted!: boolean;

          @IsTrue()
          customField!: boolean;
        }

        const dto = new FreshTestDto();
        dto.termsAccepted = value as boolean;
        dto.privacyPolicyAccepted = true;
        dto.customField = true;

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.property).toBe('termsAccepted');
      }
    });

    it('should create validator decorator without throwing', () => {
      // Test that the decorator factory can be created without throwing
      expect(() => {
        const decorator = IsTrue();
        expect(decorator).toBeInstanceOf(Function);
      }).not.toThrow();
    });
  });

  describe('validation options', () => {
    class ValidationOptionsDto {
      @IsTrue({ each: true })
      arrayField!: boolean[];
    }

    it('should work with array validation when each is true', async () => {
      const dto = new ValidationOptionsDto();
      dto.arrayField = [true, false, true];

      const errors = await validate(dto);

      // Should have one error for the false value in the array
      expect(errors).toHaveLength(1);
      expect(errors[0]?.property).toBe('arrayField');
    });

    it('should work with empty array', async () => {
      const dto = new ValidationOptionsDto();
      dto.arrayField = [];

      const errors = await validate(dto);

      // Empty array should not have validation errors
      expect(errors).toHaveLength(0);
    });

    it('should work with all true values in array', async () => {
      const dto = new ValidationOptionsDto();
      dto.arrayField = [true, true, true];

      const errors = await validate(dto);

      // All true values should pass validation
      expect(errors).toHaveLength(0);
    });
  });
});
