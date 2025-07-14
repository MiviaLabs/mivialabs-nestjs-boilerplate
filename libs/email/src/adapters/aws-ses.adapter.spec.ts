import { AwsSesAdapter } from './aws-ses.adapter';
import { AwsSesConfig } from '../interfaces/aws-ses-config.interface';
import { EmailSendOptions } from '../interfaces/email-send-options.interface';
import { EmailProvider } from '../enums/email-provider.enum';
import {
  SESClient,
  SendEmailCommand,
  GetAccountSendingEnabledCommand,
  GetSendQuotaCommand,
  type SendEmailCommandInput,
} from '@aws-sdk/client-ses';

// Mock AWS SDK
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-ses', () => {
  class MockSendEmailCommand {
    input: SendEmailCommandInput;
    constructor(input: SendEmailCommandInput) {
      this.input = input;
    }
  }

  class MockGetAccountSendingEnabledCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class MockGetSendQuotaCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  return {
    SESClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    SendEmailCommand: MockSendEmailCommand,
    GetAccountSendingEnabledCommand: MockGetAccountSendingEnabledCommand,
    GetSendQuotaCommand: MockGetSendQuotaCommand,
  };
});

describe('AwsSesAdapter', () => {
  let adapter: AwsSesAdapter;
  let config: AwsSesConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      region: 'us-east-1',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
    };
    adapter = new AwsSesAdapter(config);
  });

  describe('constructor', () => {
    it('should create SESClient with provided configuration', () => {
      const MockedSESClient = SESClient as jest.MockedClass<typeof SESClient>;
      expect(MockedSESClient).toHaveBeenCalledWith({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          sessionToken: undefined,
        },
        endpoint: undefined,
        maxAttempts: 3,
        requestHandler: {
          requestTimeout: 30000,
          connectionTimeout: 5000,
        },
        useFipsEndpoint: undefined,
        useDualstackEndpoint: undefined,
      });
    });

    it('should create SESClient without credentials when not provided', () => {
      const configWithoutCredentials: AwsSesConfig = {
        region: 'us-east-1',
      };

      new AwsSesAdapter(configWithoutCredentials);

      const MockedSESClient = SESClient as jest.MockedClass<typeof SESClient>;
      expect(MockedSESClient).toHaveBeenCalledWith({
        region: configWithoutCredentials.region,
        credentials: undefined,
        endpoint: undefined,
        maxAttempts: 3,
        requestHandler: {
          requestTimeout: 30000,
          connectionTimeout: 5000,
        },
        useFipsEndpoint: undefined,
        useDualstackEndpoint: undefined,
      });
    });

    it('should use custom configuration options', () => {
      const customConfig: AwsSesConfig = {
        region: 'us-west-2',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        sessionToken: 'test-token',
        endpoint: 'http://localhost:4566',
        maxAttempts: 5,
        requestTimeout: 60000,
        connectionTimeout: 10000,
        useFipsEndpoint: true,
        useDualstackEndpoint: true,
        configurationSetName: 'test-config-set',
        sourceArn: 'arn:aws:ses:us-west-2:123456789012:identity/example.com',
      };

      new AwsSesAdapter(customConfig);

      const MockedSESClient = SESClient as jest.MockedClass<typeof SESClient>;
      expect(MockedSESClient).toHaveBeenCalledWith({
        region: customConfig.region,
        credentials: {
          accessKeyId: customConfig.accessKeyId,
          secretAccessKey: customConfig.secretAccessKey,
          sessionToken: customConfig.sessionToken,
        },
        endpoint: customConfig.endpoint,
        maxAttempts: customConfig.maxAttempts,
        requestHandler: {
          requestTimeout: customConfig.requestTimeout,
          connectionTimeout: customConfig.connectionTimeout,
        },
        useFipsEndpoint: customConfig.useFipsEndpoint,
        useDualstackEndpoint: customConfig.useDualstackEndpoint,
      });
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
      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      const result = await adapter.sendEmail(emailOptions);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.provider).toBe(EmailProvider.AWS_SES);
      expect(mockSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });

    it('should handle multiple recipients and CC/BCC', async () => {
      const optionsWithMultipleRecipients: EmailSendOptions = {
        ...emailOptions,
        to: ['recipient1@example.com', 'recipient2@example.com'],
        cc: ['cc1@example.com', 'cc2@example.com'],
        bcc: 'bcc@example.com',
      };

      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      const result = await adapter.sendEmail(optionsWithMultipleRecipients);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });

    it('should handle reply-to address', async () => {
      const optionsWithReplyTo: EmailSendOptions = {
        ...emailOptions,
        replyTo: 'replyto@example.com',
      };

      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      await adapter.sendEmail(optionsWithReplyTo);

      expect(mockSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });

    it('should handle configuration set and source ARN', async () => {
      const configWithSettings: AwsSesConfig = {
        ...config,
        configurationSetName: 'test-config-set',
        sourceArn: 'arn:aws:ses:us-east-1:123456789012:identity/example.com',
      };

      const adapterWithSettings = new AwsSesAdapter(configWithSettings);
      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      await adapterWithSettings.sendEmail(emailOptions);

      expect(mockSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });

    it('should handle errors and return failed result', async () => {
      const error = new Error('SES API Error');
      mockSend.mockRejectedValue(error);

      const result = await adapter.sendEmail(emailOptions);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('SES API Error');
      expect(result.provider).toBe(EmailProvider.AWS_SES);
    });

    it('should handle HTML-only emails', async () => {
      const htmlOnlyOptions: EmailSendOptions = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>HTML only content</p>',
      };

      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      await adapter.sendEmail(htmlOnlyOptions);

      expect(mockSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });

    it('should handle text-only emails', async () => {
      const textOnlyOptions: EmailSendOptions = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Text only content',
      };

      const mockResponse = { MessageId: 'test-message-id' };
      mockSend.mockResolvedValue(mockResponse);

      await adapter.sendEmail(textOnlyOptions);

      expect(mockSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });
  });

  describe('validateConfiguration', () => {
    it('should return true when configuration is valid', async () => {
      mockSend.mockResolvedValue({ SendingEnabled: true });

      const result = await adapter.validateConfiguration();

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(GetAccountSendingEnabledCommand),
      );
    });

    it('should return false when configuration is invalid', async () => {
      const error = new Error('Invalid credentials');
      mockSend.mockRejectedValue(error);

      const result = await adapter.validateConfiguration();

      expect(result).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status with quota information', async () => {
      const mockQuota = {
        MaxSendRate: 200,
        SentLast24Hours: 50,
        Max24HourSend: 10000,
      };
      mockSend.mockResolvedValue(mockQuota);

      const result = await adapter.getHealthStatus();

      expect(result.healthy).toBe(true);
      expect(result.provider).toBe('AWS SES');
      expect(result.details).toEqual({
        region: config.region,
        maxSendRate: mockQuota.MaxSendRate,
        sentLast24Hours: mockQuota.SentLast24Hours,
        max24HourSend: mockQuota.Max24HourSend,
      });
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetSendQuotaCommand));
    });

    it('should return unhealthy status when quota check fails', async () => {
      const error = new Error('Access denied');
      mockSend.mockRejectedValue(error);

      const result = await adapter.getHealthStatus();

      expect(result.healthy).toBe(false);
      expect(result.provider).toBe('AWS SES');
      expect(result.details?.error).toBe('Access denied');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors correctly', () => {
      const retryableError = new Error('Throttling');
      retryableError.name = 'Throttling';

      const nonRetryableError = new Error('ValidationException');
      nonRetryableError.name = 'ValidationException';

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
  });
});
