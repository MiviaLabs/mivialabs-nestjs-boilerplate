import { EmailProvider } from '../enums/email-provider.enum';
import { EmailSendError } from './email-send-error.interface';

/**
 * Result of an email send operation
 * Standardized response across all providers
 */
export interface EmailSendResult {
  /** Whether the email was sent successfully */
  success: boolean;

  /** Unique message ID from the provider */
  messageId?: string;

  /** Provider-specific response data */
  providerResponse?: Record<string, unknown>;

  /** Error details if sending failed */
  error?: EmailSendError;

  /** Timestamp when the email was sent */
  timestamp: Date;

  /** Provider that handled the email */
  provider: EmailProvider;
}
