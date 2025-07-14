import { EmailProvider } from '../enums/email-provider.enum';
import { AwsSesConfig } from '../interfaces/aws-ses-config.interface';
import { ResendConfig } from '../interfaces/resend-config.interface';

/**
 * Union type for provider-specific configurations
 */
export type EmailProviderConfig = AwsSesConfig | ResendConfig;

/**
 * Union type for all supported email provider configurations
 */
export type EmailProviderConfigUnion = AwsSesConfig | ResendConfig;

/**
 * Mapped type for provider-specific configurations
 */
export type EmailProviderConfigMap = {
  [EmailProvider.AWS_SES]: AwsSesConfig;
  [EmailProvider.RESEND]: ResendConfig;
};

/**
 * Helper type to get configuration type for a specific provider
 */
export type ConfigForProvider<T extends EmailProvider> =
  EmailProviderConfigMap[T];
