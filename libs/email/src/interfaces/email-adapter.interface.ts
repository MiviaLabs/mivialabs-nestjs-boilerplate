import { EmailSendOptions } from './email-send-options.interface';
import { EmailSendResult } from './email-send-result.interface';

/**
 * Common interface that all email provider adapters must implement
 * Provides a unified API across different email providers
 */
export interface EmailAdapter {
  /**
   * Send an email using the configured provider
   * @param options Email sending options
   * @returns Promise that resolves to send result
   * @throws EmailSendError if sending fails
   */
  sendEmail(options: EmailSendOptions): Promise<EmailSendResult>;

  /**
   * Validate the adapter configuration
   * @returns Promise that resolves to true if configuration is valid
   * @throws ConfigurationError if configuration is invalid
   */
  validateConfiguration(): Promise<boolean>;

  /**
   * Get provider-specific health status
   * @returns Promise that resolves to health status
   */
  getHealthStatus(): Promise<{
    healthy: boolean;
    provider: string;
    timestamp: Date;
    details?: Record<string, unknown>;
  }>;
}
