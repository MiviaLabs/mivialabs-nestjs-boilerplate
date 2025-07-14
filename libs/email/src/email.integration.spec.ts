import { Test, TestingModule } from '@nestjs/testing';
import { EmailModule } from './email.module';
import { EmailService } from './services/email.service';
import { EmailAdapterFactory } from './services/email-adapter-factory.service';
import { EmailProvider } from './enums/email-provider.enum';
import { AwsSesConfig } from './interfaces/aws-ses-config.interface';
import { ResendConfig } from './interfaces/resend-config.interface';
import { EmailModuleConfig } from './interfaces/email-module-config.interface';
import { EMAIL_MODULE_CONFIG } from './constants/email-module.constants';

// Mock the actual providers
jest.mock('@aws-sdk/client-ses');
jest.mock('resend');

describe('EmailModule Integration', () => {
  describe('forRoot', () => {
    it('should create module with Resend configuration', async () => {
      const config: EmailModuleConfig = {
        provider: EmailProvider.RESEND,
        config: {
          apiKey: 're_test-resend-key',
        } as ResendConfig,
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [EmailModule.forRoot(config)],
      }).compile();

      const emailService = module.get<EmailService>(EmailService);
      const adapterFactory = module.get<EmailAdapterFactory>(EmailAdapterFactory);
      const moduleConfig = module.get<EmailModuleConfig>(EMAIL_MODULE_CONFIG);

      expect(emailService).toBeDefined();
      expect(adapterFactory).toBeDefined();
      expect(moduleConfig.provider).toBe(EmailProvider.RESEND);
      expect((moduleConfig.config as ResendConfig).apiKey).toBe('re_test-resend-key');
    });

    it('should create module with AWS SES configuration', async () => {
      const config: EmailModuleConfig = {
        provider: EmailProvider.AWS_SES,
        config: {
          region: 'us-east-1',
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        } as AwsSesConfig,
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [EmailModule.forRoot(config)],
      }).compile();

      const emailService = module.get<EmailService>(EmailService);
      const adapterFactory = module.get<EmailAdapterFactory>(EmailAdapterFactory);
      const moduleConfig = module.get<EmailModuleConfig>(EMAIL_MODULE_CONFIG);

      expect(emailService).toBeDefined();
      expect(adapterFactory).toBeDefined();
      expect(moduleConfig.provider).toBe(EmailProvider.AWS_SES);
      expect((moduleConfig.config as AwsSesConfig).region).toBe('us-east-1');
    });

    it('should create module with global settings', async () => {
      const config: EmailModuleConfig = {
        provider: EmailProvider.RESEND,
        config: {
          apiKey: 're_test-resend-key',
        } as ResendConfig,
        globalSettings: {
          defaultFromAddress: 'noreply@example.com',
          defaultReplyTo: 'support@example.com',
          enableTracking: true,
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [EmailModule.forRoot(config)],
      }).compile();

      const moduleConfig = module.get<EmailModuleConfig>(EMAIL_MODULE_CONFIG);

      expect(moduleConfig.globalSettings?.defaultFromAddress).toBe('noreply@example.com');
      expect(moduleConfig.globalSettings?.defaultReplyTo).toBe('support@example.com');
      expect(moduleConfig.globalSettings?.enableTracking).toBe(true);
    });
  });

  describe('forFeature', () => {
    it('should create feature module with different provider', async () => {
      const featureConfig: EmailModuleConfig = {
        provider: EmailProvider.AWS_SES,
        config: {
          region: 'eu-west-1',
          configurationSetName: 'feature-config',
        } as AwsSesConfig,
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [EmailModule.forFeature(featureConfig)],
      }).compile();

      const emailService = module.get<EmailService>(EmailService);
      const adapterFactory = module.get<EmailAdapterFactory>(EmailAdapterFactory);

      expect(emailService).toBeDefined();
      expect(adapterFactory).toBeDefined();
    });

    it('should create feature module with debug enabled', async () => {
      const featureConfig: EmailModuleConfig = {
        provider: EmailProvider.RESEND,
        config: {
          apiKey: 're_test-key',
        } as ResendConfig,
        debug: true,
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [EmailModule.forFeature(featureConfig)],
      }).compile();

      const moduleConfig = module.get<EmailModuleConfig>(EMAIL_MODULE_CONFIG);

      expect(moduleConfig.debug).toBe(true);
    });
  });

  describe('forRootAsync', () => {
    it('should create module with async configuration using useFactory', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          EmailModule.forRootAsync({
            useFactory: (): EmailModuleConfig => ({
              provider: EmailProvider.RESEND,
              config: {
                apiKey: 're_async-test-key',
              } as ResendConfig,
            }),
          }),
        ],
      }).compile();

      const emailService = module.get<EmailService>(EmailService);
      const moduleConfig = module.get<EmailModuleConfig>(EMAIL_MODULE_CONFIG);

      expect(emailService).toBeDefined();
      expect(moduleConfig.provider).toBe(EmailProvider.RESEND);
      expect((moduleConfig.config as ResendConfig).apiKey).toBe('re_async-test-key');
    });

    it('should create module with async configuration using useClass', async () => {
      class EmailConfigService {
        createEmailConfig(): EmailModuleConfig {
          return {
            provider: EmailProvider.AWS_SES,
            config: {
              region: 'us-west-2',
            } as AwsSesConfig,
          };
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          EmailModule.forRootAsync({
            useFactory: () => new EmailConfigService().createEmailConfig(),
          }),
        ],
      }).compile();

      const emailService = module.get<EmailService>(EmailService);
      const moduleConfig = module.get<EmailModuleConfig>(EMAIL_MODULE_CONFIG);

      expect(emailService).toBeDefined();
      expect(moduleConfig.provider).toBe(EmailProvider.AWS_SES);
      expect((moduleConfig.config as AwsSesConfig).region).toBe('us-west-2');
    });
  });

  describe('forFeatureAsync', () => {
    it('should create feature module with async configuration', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          EmailModule.forFeatureAsync({
            useFactory: (): EmailModuleConfig => ({
              provider: EmailProvider.RESEND,
              config: {
                apiKey: 're_feature-async-key',
              } as ResendConfig,
            }),
          }),
        ],
      }).compile();

      const emailService = module.get<EmailService>(EmailService);
      const moduleConfig = module.get<EmailModuleConfig>(EMAIL_MODULE_CONFIG);

      expect(emailService).toBeDefined();
      expect(moduleConfig.provider).toBe(EmailProvider.RESEND);
      expect((moduleConfig.config as ResendConfig).apiKey).toBe('re_feature-async-key');
    });
  });

  describe('Service Integration', () => {
    let module: TestingModule;
    let emailService: EmailService;
    let config: EmailModuleConfig;

    beforeEach(async () => {
      config = {
        provider: EmailProvider.RESEND,
        config: {
          apiKey: 're_test-key',
        } as ResendConfig,
      };

      module = await Test.createTestingModule({
        imports: [EmailModule.forRoot(config)],
      }).compile();

      emailService = module.get<EmailService>(EmailService);
    });

    afterEach(async () => {
      if (module) {
        await module.close();
      }
    });

    it('should provide EmailService with proper dependencies', () => {
      expect(emailService).toBeDefined();
      expect(typeof emailService.sendEmail).toBe('function');
      expect(typeof emailService.sendBatchEmails).toBe('function');
      expect(typeof emailService.getHealthStatus).toBe('function');
      expect(typeof emailService.validateConfiguration).toBe('function');
    });

    it('should be able to get health status', async () => {
      // Mock the adapter's health status
      const adapterFactory = module.get<EmailAdapterFactory>(EmailAdapterFactory);
      const adapter = adapterFactory.createAdapter(
        EmailProvider.RESEND,
        config.config as ResendConfig,
      );
      const getHealthStatusSpy = jest.spyOn(adapter, 'getHealthStatus');
      getHealthStatusSpy.mockResolvedValue({
        healthy: true,
        provider: 'Resend',
        timestamp: new Date(),
      });

      const healthStatus = await emailService.getHealthStatus();

      expect(healthStatus.healthy).toBe(true);
      expect(healthStatus.provider).toBe('Resend');
    });

    it('should be able to validate configuration', async () => {
      // Mock the adapter's configuration validation
      const adapterFactory = module.get<EmailAdapterFactory>(EmailAdapterFactory);
      const adapter = adapterFactory.createAdapter(
        EmailProvider.RESEND,
        config.config as ResendConfig,
      );
      const validateConfigSpy = jest.spyOn(adapter, 'validateConfiguration');
      validateConfigSpy.mockResolvedValue(true);

      const isValid = await emailService.validateConfiguration();

      expect(isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid provider configuration', async () => {
      const invalidConfig = {
        provider: 'invalid-provider' as EmailProvider,
        config: {},
      };

      await expect(
        Test.createTestingModule({
          imports: [EmailModule.forRoot(invalidConfig as EmailModuleConfig)],
        }).compile(),
      ).rejects.toThrow();
    });

    it('should handle missing configuration', async () => {
      await expect(
        Test.createTestingModule({
          imports: [EmailModule.forRoot(null as unknown as EmailModuleConfig)],
        }).compile(),
      ).rejects.toThrow();
    });
  });

  describe('Multiple Module Instances', () => {
    it('should support multiple module instances with different configurations', async () => {
      const rootModule: TestingModule = await Test.createTestingModule({
        imports: [
          EmailModule.forRoot({
            provider: EmailProvider.RESEND,
            config: {
              apiKey: 're_root-key',
            } as ResendConfig,
          }),
        ],
      }).compile();

      const featureModule: TestingModule = await Test.createTestingModule({
        imports: [
          EmailModule.forFeature({
            provider: EmailProvider.AWS_SES,
            config: {
              region: 'us-east-1',
            } as AwsSesConfig,
          }),
        ],
      }).compile();

      const rootEmailService = rootModule.get<EmailService>(EmailService);
      const featureEmailService = featureModule.get<EmailService>(EmailService);

      expect(rootEmailService).toBeDefined();
      expect(featureEmailService).toBeDefined();

      await rootModule.close();
      await featureModule.close();
    });
  });
});
