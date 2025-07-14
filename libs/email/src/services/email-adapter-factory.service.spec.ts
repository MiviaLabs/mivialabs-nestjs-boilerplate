import { Test, TestingModule } from '@nestjs/testing';
import { EmailAdapterFactory } from './email-adapter-factory.service';
import { EmailProvider } from '../enums/email-provider.enum';
import { AwsSesConfig } from '../interfaces/aws-ses-config.interface';
import { ResendConfig } from '../interfaces/resend-config.interface';
import { AwsSesAdapter } from '../adapters/aws-ses.adapter';
import { ResendAdapter } from '../adapters/resend.adapter';

// Mock the adapters
jest.mock('../adapters/aws-ses.adapter');
jest.mock('../adapters/resend.adapter');

describe('EmailAdapterFactory', () => {
  let service: EmailAdapterFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailAdapterFactory],
    }).compile();

    service = module.get<EmailAdapterFactory>(EmailAdapterFactory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAdapter', () => {
    it('should create AWS SES adapter with valid configuration', () => {
      const config: AwsSesConfig = {
        region: 'us-east-1',
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      };

      const adapter = service.createAdapter(EmailProvider.AWS_SES, config);

      expect(adapter).toBeInstanceOf(AwsSesAdapter);
      expect(AwsSesAdapter).toHaveBeenCalledWith(config);
    });

    it('should create Resend adapter with valid configuration', () => {
      const config: ResendConfig = {
        apiKey: 're_test-resend-key',
      };

      const adapter = service.createAdapter(EmailProvider.RESEND, config);

      expect(adapter).toBeInstanceOf(ResendAdapter);
      expect(ResendAdapter).toHaveBeenCalledWith(config);
    });

    it('should cache and reuse adapters with same configuration', () => {
      const config: ResendConfig = {
        apiKey: 're_test-resend-key',
      };

      const adapter1 = service.createAdapter(EmailProvider.RESEND, config);
      const adapter2 = service.createAdapter(EmailProvider.RESEND, config);

      expect(adapter1).toBe(adapter2);
      expect(ResendAdapter).toHaveBeenCalledTimes(1);
    });

    it('should create different adapters for different configurations', () => {
      const config1: ResendConfig = {
        apiKey: 're_test-resend-key-1',
      };

      const config2: ResendConfig = {
        apiKey: 're_test-resend-key-2',
      };

      const adapter1 = service.createAdapter(EmailProvider.RESEND, config1);
      const adapter2 = service.createAdapter(EmailProvider.RESEND, config2);

      expect(adapter1).not.toBe(adapter2);
      expect(ResendAdapter).toHaveBeenCalledTimes(2);
    });

    it('should throw error for unsupported provider', () => {
      const config = { apiKey: 'invalid-key' } as ResendConfig;

      expect(() => {
        service.createAdapter('INVALID_PROVIDER' as EmailProvider, config);
      }).toThrow('Unsupported email provider: INVALID_PROVIDER');
    });
  });

  describe('validateAdapters', () => {
    it('should validate multiple adapter configurations', async () => {
      const providers = [
        {
          provider: EmailProvider.AWS_SES,
          config: { region: 'us-east-1' } as AwsSesConfig,
        },
        {
          provider: EmailProvider.RESEND,
          config: { apiKey: 're_test-key' } as ResendConfig,
        },
      ];

      const results = await service.validateAdapters(providers);

      expect(results).toHaveLength(2);
      expect(results[0]?.provider).toBe(EmailProvider.AWS_SES);
      expect(results[1]?.provider).toBe(EmailProvider.RESEND);
    });
  });

  describe('cache management', () => {
    it('should clear cache when requested', () => {
      const config: ResendConfig = {
        apiKey: 're_test-resend-key',
      };

      // Create adapter to populate cache
      service.createAdapter(EmailProvider.RESEND, config);
      expect(ResendAdapter).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearCache();

      // Create adapter again should call constructor again
      service.createAdapter(EmailProvider.RESEND, config);
      expect(ResendAdapter).toHaveBeenCalledTimes(2);
    });

    it('should generate different cache keys for different providers', () => {
      const awsConfig: AwsSesConfig = {
        region: 'us-east-1',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      };

      const resendConfig: ResendConfig = {
        apiKey: 're_test-key',
      };

      const awsAdapter = service.createAdapter(EmailProvider.AWS_SES, awsConfig);
      const resendAdapter = service.createAdapter(EmailProvider.RESEND, resendConfig);

      expect(awsAdapter).toBeInstanceOf(AwsSesAdapter);
      expect(resendAdapter).toBeInstanceOf(ResendAdapter);
      expect(awsAdapter).not.toBe(resendAdapter);
    });
  });
});
