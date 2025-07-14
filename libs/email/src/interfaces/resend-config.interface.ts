/**
 * Configuration options for Resend provider
 * Based on official Resend Node.js SDK
 */
export interface ResendConfig {
  /** Resend API key */
  apiKey: string;

  /** Custom API base URL (for testing) */
  baseUrl?: string;

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Maximum number of retry attempts */
  maxRetries?: number;

  /** Custom headers to include with requests */
  defaultHeaders?: Record<string, string>;

  /** Whether to validate email addresses */
  validateEmailAddresses?: boolean;

  /** Default from address for emails */
  defaultFromAddress?: string;

  /** Default reply-to address */
  defaultReplyTo?: string;
}
