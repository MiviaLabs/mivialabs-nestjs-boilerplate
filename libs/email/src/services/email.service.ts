import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmailAdapter } from '../interfaces/email-adapter.interface';
import { EmailSendOptions } from '../interfaces/email-send-options.interface';
import { EmailSendResult } from '../interfaces/email-send-result.interface';
import { EmailAdapterFactory } from './email-adapter-factory.service';
import { EmailModuleConfig } from '../interfaces/email-module-config.interface';
import { EMAIL_MODULE_CONFIG } from '../constants/email-module.constants';
import { SendEmailDto } from '../dto/send-email.dto';

/**
 * Main email service that provides the public API for sending emails
 * Uses the configured adapter to send emails through the selected provider
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailAdapter: EmailAdapter;

  constructor(
    @Inject(EMAIL_MODULE_CONFIG) private readonly config: EmailModuleConfig,
    private readonly adapterFactory: EmailAdapterFactory,
  ) {
    // Create the email adapter based on configuration
    this.emailAdapter = this.adapterFactory.createAdapter(
      this.config.provider,
      this.config.config,
    );

    this.logger.log(
      `Email service initialized with provider: ${this.config.provider}`,
    );
  }

  /**
   * Send an email using the configured provider
   * @param options Email sending options
   * @returns Promise that resolves to send result
   */
  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    this.logger.debug(
      `Sending email: ${options.subject} to ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`,
    );

    try {
      // Apply global settings if configured
      const enhancedOptions = this.applyGlobalSettings(options);

      // Validate the email options
      this.validateEmailOptions(enhancedOptions);

      // Send the email using the adapter
      const result = await this.emailAdapter.sendEmail(enhancedOptions);

      // Log the result
      if (result.success) {
        this.logger.log(`Email sent successfully: ${result.messageId}`);
      } else {
        this.logger.error(`Email sending failed: ${result.error?.message}`);
      }

      return result;
    } catch (error) {
      this.logger.error('Error in email service', error);

      return {
        success: false,
        error: {
          code: 'EMAIL_SERVICE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: { originalError: error },
          retryable: false,
        },
        timestamp: new Date(),
        provider: this.config.provider,
      };
    }
  }

  /**
   * Send an email using validated DTO
   * @param emailDto Validated email DTO
   * @returns Promise that resolves to send result
   */
  async sendEmailFromDto(emailDto: SendEmailDto): Promise<EmailSendResult> {
    const options: EmailSendOptions = {
      from: emailDto.from,
      to: emailDto.to,
      subject: emailDto.subject,
      html: emailDto.html,
      text: emailDto.text,
      replyTo: emailDto.replyTo,
      cc: emailDto.cc,
      bcc: emailDto.bcc,
      attachments: emailDto.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.content, 'base64'),
        contentType: attachment.contentType,
        disposition: attachment.disposition,
        cid: attachment.cid,
      })),
    };

    return this.sendEmail(options);
  }

  /**
   * Send multiple emails in batch
   * @param emailOptions Array of email options
   * @returns Promise that resolves to array of send results
   */
  async sendBatchEmails(
    emailOptions: EmailSendOptions[],
  ): Promise<EmailSendResult[]> {
    this.logger.debug(`Sending batch of ${emailOptions.length} emails`);

    const results = await Promise.allSettled(
      emailOptions.map((options) => this.sendEmail(options)),
    );

    return results.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : {
            success: false,
            error: {
              code: 'BATCH_EMAIL_ERROR',
              message:
                result.reason instanceof Error
                  ? result.reason.message
                  : 'Unknown error',
              details: { originalError: result.reason },
              retryable: false,
            },
            timestamp: new Date(),
            provider: this.config.provider,
          },
    );
  }

  /**
   * Get health status of the email service
   * @returns Promise that resolves to health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    provider: string;
    timestamp: Date;
    details?: Record<string, unknown>;
  }> {
    try {
      return await this.emailAdapter.getHealthStatus();
    } catch (error) {
      return {
        healthy: false,
        provider: this.config.provider,
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Validate adapter configuration
   * @returns Promise that resolves to validation result
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      return await this.emailAdapter.validateConfiguration();
    } catch (error) {
      this.logger.error('Configuration validation failed', error);
      return false;
    }
  }

  private applyGlobalSettings(options: EmailSendOptions): EmailSendOptions {
    const globalSettings = this.config.globalSettings;
    if (!globalSettings) {
      return options;
    }

    return {
      ...options,
      from: options.from || globalSettings.defaultFromAddress || options.from,
      replyTo: options.replyTo || globalSettings.defaultReplyTo,
      // Apply default tags if provider supports them
      providerOptions: {
        ...options.providerOptions,
        tags: {
          ...(globalSettings.defaultTags || {}),
          ...(options.providerOptions?.tags || {}),
        },
      },
    };
  }

  private validateEmailOptions(options: EmailSendOptions): void {
    // Basic validation
    if (!options.from) {
      throw new Error('From address is required');
    }

    if (!options.to || (Array.isArray(options.to) && options.to.length === 0)) {
      throw new Error('At least one recipient is required');
    }

    if (!options.subject) {
      throw new Error('Subject is required');
    }

    if (!options.html && !options.text) {
      throw new Error('Either HTML or text content is required');
    }

    // Rate limiting validation
    const rateLimiting = this.config.globalSettings?.rateLimiting;
    if (rateLimiting) {
      // Implementation would depend on a rate limiting service
      // This is a placeholder for rate limiting validation
      this.logger.debug('Rate limiting validation would be performed here');
    }
  }
}
