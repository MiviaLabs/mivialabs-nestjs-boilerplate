import { EmailProvider } from '../enums/email-provider.enum';

/**
 * DTO for email sending response
 * Standardized response format for API endpoints
 */
export class EmailResponseDto {
  /** Whether the email was sent successfully */
  success!: boolean;

  /** Unique message ID from the provider */
  messageId?: string;

  /** Error message if sending failed */
  errorMessage?: string;

  /** Error code if sending failed */
  errorCode?: string;

  /** Timestamp when the email was sent */
  timestamp!: Date;

  /** Provider that handled the email */
  provider!: EmailProvider;

  /** Whether the error is retryable (if applicable) */
  retryable?: boolean;
}
