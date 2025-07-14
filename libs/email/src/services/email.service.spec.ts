import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { EmailAdapterFactory } from './email-adapter-factory.service';
import { EMAIL_MODULE_CONFIG } from '../constants/email-module.constants';
import { EmailProvider } from '../enums/email-provider.enum';
import { EmailAdapter } from '../interfaces/email-adapter.interface';
import { EmailSendOptions } from '../interfaces/email-send-options.interface';
import { EmailSendResult } from '../interfaces/email-send-result.interface';
import { SendEmailDto } from '../dto/send-email.dto';

describe('EmailService', () => {
  let service: EmailService;
  let adapterFactory: EmailAdapterFactory;
  let mockAdapter: jest.Mocked<EmailAdapter>;

  const mockConfig = {
    provider: EmailProvider.RESEND,
    config: { apiKey: 'test-key' },
    globalSettings: {
      defaultFromAddress: 'default@example.com',
      defaultReplyTo: 'reply@example.com',
      defaultTags: { environment: 'test' },
      rateLimiting: {
        maxEmailsPerMinute: 60,
        maxEmailsPerHour: 1000,
      },
    },
  };

  beforeEach(async () => {
    mockAdapter = {
      sendEmail: jest.fn(),
      validateConfiguration: jest.fn(),
      getHealthStatus: jest.fn(),
    };

    const mockAdapterFactory = {
      createAdapter: jest.fn().mockReturnValue(mockAdapter),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: EmailAdapterFactory,
          useValue: mockAdapterFactory,
        },
        {
          provide: EMAIL_MODULE_CONFIG,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    adapterFactory = module.get<EmailAdapterFactory>(EmailAdapterFactory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should create adapter using factory', () => {
      const createAdapterSpy = jest.spyOn(adapterFactory, 'createAdapter');
      expect(createAdapterSpy).toHaveBeenCalledWith(
        mockConfig.provider,
        mockConfig.config,
      );
    });
  });

  describe('sendEmail', () => {
    const emailOptions: EmailSendOptions = {
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test Email',
      html: '<p>Test content</p>',
    };

    it('should send email successfully', async () => {
      const expectedResult: EmailSendResult = {
        success: true,
        messageId: 'test-message-id',
        timestamp: new Date(),
        provider: EmailProvider.RESEND,
      };

      const sendEmailSpy = jest.spyOn(mockAdapter, 'sendEmail');
      mockAdapter.sendEmail.mockResolvedValue(expectedResult);

      const result = await service.sendEmail(emailOptions);

      expect(result).toEqual(expectedResult);
      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ...emailOptions,
          providerOptions: {
            tags: { environment: 'test' },
          },
        }),
      );
    });

    it('should apply global settings when no from address provided', async () => {
      const optionsWithoutFrom: Partial<EmailSendOptions> = { ...emailOptions };
      delete (
        optionsWithoutFrom as Partial<EmailSendOptions> & { from?: unknown }
      ).from;

      const expectedResult: EmailSendResult = {
        success: true,
        messageId: 'test-message-id',
        timestamp: new Date(),
        provider: EmailProvider.RESEND,
      };

      mockAdapter.sendEmail.mockResolvedValue(expectedResult);

      const sendEmailSpy = jest.spyOn(mockAdapter, 'sendEmail');
      await service.sendEmail(optionsWithoutFrom as EmailSendOptions);

      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'default@example.com',
          replyTo: 'reply@example.com',
        }),
      );
    });

    it('should handle email sending errors from adapter', async () => {
      const expectedError: EmailSendResult = {
        success: false,
        error: {
          code: 'SEND_ERROR',
          message: 'Failed to send',
          details: {},
          retryable: true,
        },
        timestamp: new Date(),
        provider: EmailProvider.RESEND,
      };

      mockAdapter.sendEmail.mockResolvedValue(expectedError);

      const result = await service.sendEmail(emailOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('SEND_ERROR');
    });

    it('should handle exceptions during email sending', async () => {
      const error = new Error('Network error');
      mockAdapter.sendEmail.mockRejectedValue(error);

      const result = await service.sendEmail(emailOptions);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMAIL_SERVICE_ERROR');
      expect(result.error?.message).toBe('Network error');
      expect(result.error?.retryable).toBe(false);
    });

    it('should validate required fields - missing from', async () => {
      // Create a service without default settings to test validation
      const configWithoutDefaults = {
        provider: EmailProvider.RESEND,
        config: { apiKey: 'test-key' },
      };

      const testModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: EmailAdapterFactory,
            useValue: { createAdapter: jest.fn().mockReturnValue(mockAdapter) },
          },
          {
            provide: EMAIL_MODULE_CONFIG,
            useValue: configWithoutDefaults,
          },
        ],
      }).compile();

      const testService = testModule.get<EmailService>(EmailService);

      const invalidOptions: Partial<EmailSendOptions> = { ...emailOptions };
      delete (invalidOptions as Partial<EmailSendOptions> & { from?: unknown })
        .from;

      const result = await testService.sendEmail(
        invalidOptions as EmailSendOptions,
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('From address is required');

      await testModule.close();
    });

    it('should validate required fields - missing to', async () => {
      const invalidOptions: Partial<EmailSendOptions> = { ...emailOptions };
      delete (invalidOptions as Partial<EmailSendOptions> & { to?: unknown })
        .to;

      const result = await service.sendEmail(
        invalidOptions as EmailSendOptions,
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(
        'At least one recipient is required',
      );
    });

    it('should require at least one recipient', async () => {
      const invalidOptions = { ...emailOptions, to: [] };

      const result = await service.sendEmail(invalidOptions);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(
        'At least one recipient is required',
      );
    });

    it('should require subject', async () => {
      const invalidOptions: Partial<EmailSendOptions> = { ...emailOptions };
      delete (
        invalidOptions as Partial<EmailSendOptions> & { subject?: unknown }
      ).subject;

      const result = await service.sendEmail(
        invalidOptions as EmailSendOptions,
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Subject is required');
    });

    it('should require either HTML or text content', async () => {
      const invalidOptions: Partial<EmailSendOptions> = { ...emailOptions };
      delete (invalidOptions as Partial<EmailSendOptions> & { html?: unknown })
        .html;

      const result = await service.sendEmail(
        invalidOptions as EmailSendOptions,
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain(
        'Either HTML or text content is required',
      );
    });
  });

  describe('sendEmailFromDto', () => {
    it('should convert DTO to EmailSendOptions and send email', async () => {
      const emailDto: SendEmailDto = {
        from: 'test@example.com',
        to: ['recipient@example.com'],
        subject: 'Test Email',
        html: '<p>Test content</p>',
        attachments: [
          {
            filename: 'test.txt',
            content: 'dGVzdCBjb250ZW50', // base64 encoded "test content"
            contentType: 'text/plain',
          },
        ],
      };

      const expectedResult: EmailSendResult = {
        success: true,
        messageId: 'test-message-id',
        timestamp: new Date(),
        provider: EmailProvider.RESEND,
      };

      mockAdapter.sendEmail.mockResolvedValue(expectedResult);

      const sendEmailSpy = jest.spyOn(mockAdapter, 'sendEmail');
      const result = await service.sendEmailFromDto(emailDto);

      expect(result).toEqual(expectedResult);
      expect(sendEmailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: emailDto.from,
          to: emailDto.to,
          subject: emailDto.subject,
          html: emailDto.html,
          attachments: [
            {
              filename: 'test.txt',
              content: Buffer.from('dGVzdCBjb250ZW50', 'base64'),
              contentType: 'text/plain',
            },
          ],
        }),
      );
    });
  });

  describe('sendBatchEmails', () => {
    const emailOptions1: EmailSendOptions = {
      from: 'test@example.com',
      to: 'recipient1@example.com',
      subject: 'Test Email 1',
      html: '<p>Test content 1</p>',
    };

    const emailOptions2: EmailSendOptions = {
      from: 'test@example.com',
      to: 'recipient2@example.com',
      subject: 'Test Email 2',
      html: '<p>Test content 2</p>',
    };

    it('should send multiple emails successfully', async () => {
      const expectedResults = [
        {
          success: true,
          messageId: 'test-message-id-1',
          timestamp: new Date(),
          provider: EmailProvider.RESEND,
        },
        {
          success: true,
          messageId: 'test-message-id-2',
          timestamp: new Date(),
          provider: EmailProvider.RESEND,
        },
      ];

      mockAdapter.sendEmail
        .mockResolvedValueOnce(expectedResults[0]!)
        .mockResolvedValueOnce(expectedResults[1]!);

      const results = await service.sendBatchEmails([
        emailOptions1,
        emailOptions2,
      ]);

      expect(results).toHaveLength(2);
      const sendEmailSpy = jest.spyOn(mockAdapter, 'sendEmail');
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(true);
      expect(sendEmailSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle partial failures in batch', async () => {
      const successResult = {
        success: true,
        messageId: 'test-message-id-1',
        timestamp: new Date(),
        provider: EmailProvider.RESEND,
      };

      const errorResult = {
        success: false,
        error: {
          code: 'SEND_ERROR',
          message: 'Failed to send',
          details: {},
          retryable: true,
        },
        timestamp: new Date(),
        provider: EmailProvider.RESEND,
      };

      mockAdapter.sendEmail
        .mockResolvedValueOnce(successResult)
        .mockResolvedValueOnce(errorResult);

      const results = await service.sendBatchEmails([
        emailOptions1,
        emailOptions2,
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(false);
    });

    it('should handle exceptions in batch emails', async () => {
      const successResult = {
        success: true,
        messageId: 'test-message-id-1',
        timestamp: new Date(),
        provider: EmailProvider.RESEND,
      };

      mockAdapter.sendEmail
        .mockResolvedValueOnce(successResult)
        .mockRejectedValueOnce(new Error('Network error'));

      const results = await service.sendBatchEmails([
        emailOptions1,
        emailOptions2,
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(false);
      expect(results[1]!.error?.code).toBe('EMAIL_SERVICE_ERROR');
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status from adapter', async () => {
      const expectedStatus = {
        healthy: true,
        provider: 'Resend',
        timestamp: new Date(),
        details: { apiKeyValid: true },
      };

      mockAdapter.getHealthStatus.mockResolvedValue(expectedStatus);

      const result = await service.getHealthStatus();

      const getHealthStatusSpy = jest.spyOn(mockAdapter, 'getHealthStatus');
      expect(result).toEqual(expectedStatus);
      expect(getHealthStatusSpy).toHaveBeenCalled();
    });

    it('should handle health check errors', async () => {
      const error = new Error('Health check failed');
      mockAdapter.getHealthStatus.mockRejectedValue(error);

      const result = await service.getHealthStatus();

      expect(result.healthy).toBe(false);
      expect(result.provider).toBe(EmailProvider.RESEND);
      expect(result.details?.error).toBe('Health check failed');
    });
  });

  describe('validateConfiguration', () => {
    it('should return validation result from adapter', async () => {
      const validateConfigurationSpy = jest.spyOn(
        mockAdapter,
        'validateConfiguration',
      );
      mockAdapter.validateConfiguration.mockResolvedValue(true);

      const result = await service.validateConfiguration();

      expect(result).toBe(true);
      expect(validateConfigurationSpy).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      mockAdapter.validateConfiguration.mockRejectedValue(error);

      const result = await service.validateConfiguration();

      expect(result).toBe(false);
    });
  });

  describe('applyGlobalSettings', () => {
    it('should work without global settings', async () => {
      const serviceWithoutGlobalSettings = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: EmailAdapterFactory,
            useValue: { createAdapter: jest.fn().mockReturnValue(mockAdapter) },
          },
          {
            provide: EMAIL_MODULE_CONFIG,
            useValue: {
              provider: EmailProvider.RESEND,
              config: { apiKey: 'test' },
            },
          },
        ],
      })
        .compile()
        .then((module) => module.get<EmailService>(EmailService));

      const emailOptions: EmailSendOptions = {
        from: 'test@example.com',
        to: 'recipient@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const expectedResult: EmailSendResult = {
        success: true,
        messageId: 'test-message-id',
        timestamp: new Date(),
        provider: EmailProvider.RESEND,
      };

      mockAdapter.sendEmail.mockResolvedValue(expectedResult);

      const result = await serviceWithoutGlobalSettings.sendEmail(emailOptions);

      const sendEmailSpy = jest.spyOn(mockAdapter, 'sendEmail');
      expect(result.success).toBe(true);
      expect(sendEmailSpy).toHaveBeenCalledWith(emailOptions);
    });
  });
});
