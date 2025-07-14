/**
 * Email validation result type
 * Contains validation outcome and any errors or warnings
 */
export type EmailValidationResult = {
  /** Whether the email passed validation */
  valid: boolean;
  /** Array of validation errors (if any) */
  errors?: string[];
  /** Array of validation warnings (if any) */
  warnings?: string[];
};
