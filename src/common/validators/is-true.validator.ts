import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Custom validator to ensure a boolean field is true
 * Useful for terms and conditions, privacy policy acceptance, etc.
 */
export function IsTrue(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTrue',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return value === true;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be true`;
        },
      },
    });
  };
}
