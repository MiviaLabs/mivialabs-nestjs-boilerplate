import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailAdapter } from '../interfaces/email-adapter.interface';
import { EmailSendOptions } from '../interfaces/email-send-options.interface';
import { EmailSendResult } from '../interfaces/email-send-result.interface';
import { ResendConfig } from '../interfaces/resend-config.interface';
import { EmailProvider } from '../enums/email-provider.enum';

/**
 * Resend implementation of the EmailAdapter interface
 * Handles email sending through the Resend service
 */
@Injectable()
export class ResendAdapter implements EmailAdapter {
  private readonly logger = new Logger(ResendAdapter.name);
  private readonly resendClient: Resend;

  constructor(private readonly config: ResendConfig) {
    this.resendClient = new Resend(config.apiKey);
  }

  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    try {
      this.logger.debug(`Sending email via Resend: ${options.subject}`);

      // Build the request options first to apply defaults
      const resendOptions = {
        from: options.from || this.config.defaultFromAddress!,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        text: options.text || ' ', // Provide default text if not provided
        html: options.html,
        reply_to: options.replyTo || this.config.defaultReplyTo,
        cc: options.cc
          ? Array.isArray(options.cc)
            ? options.cc
            : [options.cc]
          : undefined,
        bcc: options.bcc
          ? Array.isArray(options.bcc)
            ? options.bcc
            : [options.bcc]
          : undefined,
        attachments: options.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          type: attachment.contentType,
          disposition: attachment.disposition,
        })),
        headers: options.headers,
      };

      // Validate email addresses if enabled (after applying defaults)
      if (this.config.validateEmailAddresses) {
        this.validateEmailAddresses({
          ...options,
          from: resendOptions.from,
        });
      }

      const response = await this.resendClient.emails.send(resendOptions);

      if (response.error) {
        throw new Error(`Resend API error: ${response.error.message}`);
      }

      this.logger.debug(
        `Email sent successfully via Resend: ${response.data?.id}`,
      );

      return {
        success: true,
        messageId: response.data?.id,
        providerResponse: response.data as unknown as Record<string, unknown>,
        timestamp: new Date(),
        provider: EmailProvider.RESEND,
      };
    } catch (error) {
      this.logger.error('Failed to send email via Resend', error);

      return {
        success: false,
        error: {
          code:
            error instanceof Error && 'code' in error
              ? (error as Error & { code: string }).code
              : 'RESEND_ERROR',
          message:
            error instanceof Error ? error.message : 'Failed to send email',
          details: { originalError: error },
          retryable: this.isRetryableError(error),
        },
        timestamp: new Date(),
        provider: EmailProvider.RESEND,
      };
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      // Test Resend API connectivity by listing domains
      await this.resendClient.domains.list();
      return true;
    } catch (error) {
      this.logger.error('Resend configuration validation failed', error);
      return false;
    }
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    provider: string;
    timestamp: Date;
    details?: Record<string, unknown>;
  }> {
    try {
      // Check API connectivity
      const domains = await this.resendClient.domains.list();

      return {
        healthy: true,
        provider: 'Resend',
        timestamp: new Date(),
        details: {
          apiKeyValid: true,
          domainsCount: Array.isArray(domains.data) ? domains.data.length : 0,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        provider: 'Resend',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private validateEmailAddresses(options: EmailSendOptions): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validateEmail = (email: string): boolean => emailRegex.test(email);

    if (!options.from || !validateEmail(options.from)) {
      throw new Error(`Invalid from email address: ${options.from}`);
    }

    const toEmails = Array.isArray(options.to) ? options.to : [options.to];
    for (const email of toEmails) {
      if (!validateEmail(email)) {
        throw new Error(`Invalid to email address: ${email}`);
      }
    }

    if (options.replyTo && !validateEmail(options.replyTo)) {
      throw new Error(`Invalid reply-to email address: ${options.replyTo}`);
    }
  }

  private isRetryableError(error: unknown): boolean {
    // Resend specific retryable error conditions
    const retryableStatusCodes = [429, 500, 502, 503, 504];
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as { status?: number; code?: string };
      return (
        retryableStatusCodes.includes(errorObj.status || 0) ||
        errorObj.code === 'ECONNRESET'
      );
    }

    return false;
  }
}
