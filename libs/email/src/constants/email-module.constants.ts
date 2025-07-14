/**
 * Dependency injection token for email module configuration
 */
export const EMAIL_MODULE_CONFIG = Symbol('EMAIL_MODULE_CONFIG');

/**
 * Dependency injection token for email module options
 */
export const EMAIL_MODULE_OPTIONS = Symbol('EMAIL_MODULE_OPTIONS');

/**
 * Default email module configuration values
 */
export const DEFAULT_EMAIL_CONFIG = {
  debug: false,
  globalSettings: {
    enableTracking: false,
    rateLimiting: {
      maxEmailsPerMinute: 60,
      maxEmailsPerHour: 1000,
    },
  },
};

/**
 * Email module error messages
 */
export const EMAIL_MODULE_ERRORS = {
  INVALID_PROVIDER: 'Invalid email provider specified',
  MISSING_CONFIG: 'Email module configuration is missing',
  INVALID_CONFIG: 'Email module configuration is invalid',
  PROVIDER_NOT_CONFIGURED: 'Email provider is not properly configured',
  SEND_FAILED: 'Failed to send email',
  VALIDATION_FAILED: 'Email validation failed',
} as const;

/**
 * Email module validation rules
 */
export const EMAIL_VALIDATION_RULES = {
  MAX_RECIPIENTS: 100,
  MAX_SUBJECT_LENGTH: 998,
  MAX_ATTACHMENT_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_ATTACHMENTS: 10,
  SUPPORTED_ATTACHMENT_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/html',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
} as const;
