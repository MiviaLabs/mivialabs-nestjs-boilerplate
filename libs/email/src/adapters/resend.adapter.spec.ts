import { ResendAdapter } from './resend.adapter';
import { ResendConfig } from '../interfaces/resend-config.interface';
import { EmailSendOptions } from '../interfaces/email-send-options.interface';
import { EmailProvider } from '../enums/email-provider.enum';
import { Resend } from 'resend';

// Mock Resend
const mockSend = jest.fn();
const mockDomainsList = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
    domains: {
      list: mockDomainsList,
    },
  })),
}));

describe('ResendAdapter', () => {
  let adapter: ResendAdapter;
  let config: ResendConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      apiKey: 'test-api-key',
      defaultFromAddress: 'test@example.com',
      validateEmailAddresses: true,
    };
    adapter = new ResendAdapter(config);
  });

  describe('constructor', () => {
    it('should create Resend client with API key', () => {
      const MockedResend = Resend as jest.MockedClass<typeof Resend>;
      expect(MockedResend).toHaveBeenCalledWith(config.apiKey);
    });

    it('should create Resend client without validation when disabled', () => {
      const configWithoutValidation: ResendConfig = {
        apiKey: 'test-api-key',
        validateEmailAddresses: false,
      };

      new ResendAdapter(configWithoutValidation);

      const MockedResend = Resend as jest.MockedClass<typeof Resend>;
      expect(MockedResend).toHaveBeenCalledWith(configWithoutValidation.apiKey);
    });
  });

  describe('sendEmail', () => {
    const emailOptions: EmailSendOptions = {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Test Subject',
      text: 'Test message',
      html: '<p>Test message</p>',
    };

    it('should send email successfully', async () => {
      const mockResponse = {
        data: { id: 'test-message-id' },
        error: null,
      };
      mockSend.mockResolvedValue(mockResponse);

      const result = await adapter.sendEmail(emailOptions);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.provider).toBe(EmailProvider.RESEND);
      expect(mockSend).toHaveBeenCalledWith({
        from: emailOptions.from,
        to: [emailOptions.to],
        subject: emailOptions.subject,
        text: emailOptions.text,
        html: emailOptions.html,
        reply_to: undefined,
        cc: undefined,
        bcc: undefined,
        attachments: undefined,
        headers: undefined,
      });
    });

    it('should use default from address when not provided', async () => {
      const optionsWithoutFrom: Omit<EmailSendOptions, 'from'> = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message',
      };

      const mockResponse = {
        data: { id: 'test-message-id' },
        error: null,
      };
      mockSend.mockResolvedValue(mockResponse);

      await adapter.sendEmail(optionsWithoutFrom as EmailSendOptions);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: config.defaultFromAddress,
        }),
      );
    });

    it('should handle multiple recipients and CC/BCC', async () => {
      const optionsWithMultipleRecipients: EmailSendOptions = {
        ...emailOptions,
        to: ['recipient1@example.com', 'recipient2@example.com'],
        cc: ['cc1@example.com', 'cc2@example.com'],
        bcc: 'bcc@example.com',
      };

      const mockResponse = {
        data: { id: 'test-message-id' },
        error: null,
      };
      mockSend.mockResolvedValue(mockResponse);

      const result = await adapter.sendEmail(optionsWithMultipleRecipients);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith({
        from: emailOptions.from,
        to: ['recipient1@example.com', 'recipient2@example.com'],
        subject: emailOptions.subject,
        text: emailOptions.text,
        html: emailOptions.html,
        reply_to: undefined,
        cc: ['cc1@example.com', 'cc2@example.com'],
        bcc: ['bcc@example.com'],
        attachments: undefined,
        headers: undefined,
      });
    });

    it('should handle attachments', async () => {
      const optionsWithAttachments: EmailSendOptions = {
        ...emailOptions,
        attachments: [
          {
            filename: 'test.pdf',
            content: Buffer.from('test content'),
            contentType: 'application/pdf',
          },
        ],
      };

      const mockResponse = {
        data: { id: 'test-message-id' },
        error: null,
      };
      mockSend.mockResolvedValue(mockResponse);

      await adapter.sendEmail(optionsWithAttachments);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [
            {
              filename: 'test.pdf',
              content: optionsWithAttachments.attachments?.[0]?.content,
              type: 'application/pdf',
              disposition: undefined,
            },
          ],
        }),
      );
    });

    it('should provide default text when not provided', async () => {
      const optionsWithoutText: EmailSendOptions = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>HTML only content</p>',
      };

      const mockResponse = {
        data: { id: 'test-message-id' },
        error: null,
      };
      mockSend.mockResolvedValue(mockResponse);

      await adapter.sendEmail(optionsWithoutText);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: ' ', // Default text value
        }),
      );
    });

    it('should handle validation errors when email validation is enabled', async () => {
      const optionsWithInvalidEmail: EmailSendOptions = {
        from: 'invalid-email',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message',
      };

      const result = await adapter.sendEmail(optionsWithInvalidEmail);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid from email address');
    });

    it('should handle Resend API errors', async () => {
      const mockResponse = {
        data: null,
        error: { message: 'API Rate Limit Exceeded' },
      };
      mockSend.mockResolvedValue(mockResponse);

      const result = await adapter.sendEmail(emailOptions);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('API Rate Limit Exceeded');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      mockSend.mockRejectedValue(error);

      const result = await adapter.sendEmail(emailOptions);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Network error');
      expect(result.provider).toBe(EmailProvider.RESEND);
    });
  });

  describe('validateConfiguration', () => {
    it('should return true when configuration is valid', async () => {
      mockDomainsList.mockResolvedValue({ data: [] });

      const result = await adapter.validateConfiguration();

      expect(result).toBe(true);
      expect(mockDomainsList).toHaveBeenCalled();
    });

    it('should return false when configuration is invalid', async () => {
      const error = new Error('Invalid API key');
      mockDomainsList.mockRejectedValue(error);

      const result = await adapter.validateConfiguration();

      expect(result).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status with domain information', async () => {
      const mockDomains = {
        data: [
          { name: 'example.com', status: 'verified' },
          { name: 'test.com', status: 'pending' },
        ],
      };
      mockDomainsList.mockResolvedValue(mockDomains);

      const result = await adapter.getHealthStatus();

      expect(result.healthy).toBe(true);
      expect(result.provider).toBe('Resend');
      expect(result.details).toEqual({
        apiKeyValid: true,
        domainsCount: 2,
      });
      expect(mockDomainsList).toHaveBeenCalled();
    });

    it('should return unhealthy status when domains check fails', async () => {
      const error = new Error('Unauthorized');
      mockDomainsList.mockRejectedValue(error);

      const result = await adapter.getHealthStatus();

      expect(result.healthy).toBe(false);
      expect(result.provider).toBe('Resend');
      expect(result.details?.error).toBe('Unauthorized');
    });

    it('should handle non-array domains response', async () => {
      const mockDomains = { data: null };
      mockDomainsList.mockResolvedValue(mockDomains);

      const result = await adapter.getHealthStatus();

      expect(result.healthy).toBe(true);
      expect(result.details?.domainsCount).toBe(0);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors correctly', () => {
      const retryableError = { status: 429, code: 'RATE_LIMITED' };
      const nonRetryableError = { status: 400, code: 'VALIDATION_ERROR' };

      // Access the private method for testing
      const isRetryableRetryable = (
        adapter as unknown as {
          isRetryableError: (error: unknown) => boolean;
        }
      ).isRetryableError(retryableError);

      const isRetryableNonRetryable = (
        adapter as unknown as {
          isRetryableError: (error: unknown) => boolean;
        }
      ).isRetryableError(nonRetryableError);

      expect(isRetryableRetryable).toBe(true);
      expect(isRetryableNonRetryable).toBe(false);
    });

    it('should handle connection errors as retryable', () => {
      const connectionError = { code: 'ECONNRESET' };

      const isRetryableConnection = (
        adapter as unknown as {
          isRetryableError: (error: unknown) => boolean;
        }
      ).isRetryableError(connectionError);

      expect(isRetryableConnection).toBe(true);
    });
  });

  describe('validateEmailAddresses', () => {
    it('should not validate when validation is disabled', async () => {
      const configWithoutValidation: ResendConfig = {
        apiKey: 'test-api-key',
        validateEmailAddresses: false,
      };

      const adapterWithoutValidation = new ResendAdapter(
        configWithoutValidation,
      );
      const optionsWithInvalidEmail: EmailSendOptions = {
        from: 'invalid-email',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test message',
      };

      const mockResponse = {
        data: { id: 'test-message-id' },
        error: null,
      };
      mockSend.mockResolvedValue(mockResponse);

      const result = await adapterWithoutValidation.sendEmail(
        optionsWithInvalidEmail,
      );

      expect(result.success).toBe(true); // Should succeed when validation is disabled
    });
  });
});
