import { Injectable, Logger } from '@nestjs/common';
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
  GetAccountSendingEnabledCommand,
  GetSendQuotaCommand,
} from '@aws-sdk/client-ses';
import { EmailAdapter } from '../interfaces/email-adapter.interface';
import { EmailSendOptions } from '../interfaces/email-send-options.interface';
import { EmailSendResult } from '../interfaces/email-send-result.interface';
import { AwsSesConfig } from '../interfaces/aws-ses-config.interface';
import { EmailProvider } from '../enums/email-provider.enum';

/**
 * AWS SES implementation of the EmailAdapter interface
 * Handles email sending through Amazon Simple Email Service
 */
@Injectable()
export class AwsSesAdapter implements EmailAdapter {
  private readonly logger = new Logger(AwsSesAdapter.name);
  private readonly sesClient: SESClient;

  constructor(private readonly config: AwsSesConfig) {
    this.sesClient = new SESClient({
      region: config.region,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
              sessionToken: config.sessionToken,
            }
          : undefined,
      endpoint: config.endpoint,
      maxAttempts: config.maxAttempts || 3,
      requestHandler: {
        requestTimeout: config.requestTimeout || 30000,
        connectionTimeout: config.connectionTimeout || 5000,
      },
      useFipsEndpoint: config.useFipsEndpoint,
      useDualstackEndpoint: config.useDualstackEndpoint,
    });
  }

  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    try {
      this.logger.debug(`Sending email via AWS SES: ${options.subject}`);

      const sesInput: SendEmailCommandInput = {
        Source: options.from,
        Destination: {
          ToAddresses: Array.isArray(options.to) ? options.to : [options.to],
          CcAddresses: options.cc
            ? Array.isArray(options.cc)
              ? options.cc
              : [options.cc]
            : undefined,
          BccAddresses: options.bcc
            ? Array.isArray(options.bcc)
              ? options.bcc
              : [options.bcc]
            : undefined,
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: options.html
              ? {
                  Data: options.html,
                  Charset: 'UTF-8',
                }
              : undefined,
            Text: options.text
              ? {
                  Data: options.text,
                  Charset: 'UTF-8',
                }
              : undefined,
          },
        },
        ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
        ConfigurationSetName: this.config.configurationSetName,
        SourceArn: this.config.sourceArn,
      };

      const command = new SendEmailCommand(sesInput);
      const response = await this.sesClient.send(command);

      this.logger.debug(
        `Email sent successfully via AWS SES: ${response.MessageId}`,
      );

      return {
        success: true,
        messageId: response.MessageId,
        providerResponse: response as unknown as Record<string, unknown>,
        timestamp: new Date(),
        provider: EmailProvider.AWS_SES,
      };
    } catch (error) {
      this.logger.error('Failed to send email via AWS SES', error);

      return {
        success: false,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message:
            error instanceof Error ? error.message : 'Failed to send email',
          details: { originalError: error },
          retryable: this.isRetryableError(error),
        },
        timestamp: new Date(),
        provider: EmailProvider.AWS_SES,
      };
    }
  }

  async validateConfiguration(): Promise<boolean> {
    try {
      // Test SES connectivity by getting account sending enabled status
      await this.sesClient.send(new GetAccountSendingEnabledCommand({}));
      return true;
    } catch (error) {
      this.logger.error('AWS SES configuration validation failed', error);
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
      const sendingQuota = await this.sesClient.send(
        new GetSendQuotaCommand({}),
      );

      return {
        healthy: true,
        provider: 'AWS SES',
        timestamp: new Date(),
        details: {
          region: this.config.region,
          maxSendRate: sendingQuota.MaxSendRate,
          sentLast24Hours: sendingQuota.SentLast24Hours,
          max24HourSend: sendingQuota.Max24HourSend,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        provider: 'AWS SES',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private isRetryableError(error: unknown): boolean {
    // AWS SES specific retryable error codes
    const retryableErrors = [
      'Throttling',
      'ServiceUnavailable',
      'InternalServerError',
      'RequestTimeout',
    ];

    if (error instanceof Error) {
      return retryableErrors.includes(error.name);
    }

    if (typeof error === 'object' && error !== null && 'retryable' in error) {
      return (error as { retryable: boolean }).retryable === true;
    }

    return false;
  }
}
