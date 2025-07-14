/**
 * Global email settings applied to all emails
 */
export interface GlobalEmailSettings {
  /** Default from address if not specified */
  defaultFromAddress?: string;

  /** Default reply-to address */
  defaultReplyTo?: string;

  /** Whether to enable email tracking */
  enableTracking?: boolean;

  /** Default email tags */
  defaultTags?: Record<string, string>;

  /** Rate limiting settings */
  rateLimiting?: {
    /** Maximum emails per minute */
    maxEmailsPerMinute?: number;

    /** Maximum emails per hour */
    maxEmailsPerHour?: number;
  };
}
