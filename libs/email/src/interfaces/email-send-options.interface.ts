import { EmailAttachment } from './email-attachment.interface';

/**
 * Options for sending an email
 * Common interface used across all providers
 */
export interface EmailSendOptions {
  /** Sender email address */
  from: string;

  /** Recipient email address(es) */
  to: string | string[];

  /** Email subject line */
  subject: string;

  /** HTML content of the email */
  html?: string;

  /** Plain text content of the email */
  text?: string;

  /** Reply-to email address */
  replyTo?: string;

  /** CC recipients */
  cc?: string | string[];

  /** BCC recipients */
  bcc?: string | string[];

  /** Email attachments */
  attachments?: EmailAttachment[];

  /** Custom headers */
  headers?: Record<string, string>;

  /** Provider-specific options */
  providerOptions?: Record<string, unknown>;
}
