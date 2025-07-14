import { EmailProvider } from '../enums/email-provider.enum';
import { EmailProviderConfig } from '../types/email-provider-config.types';
import { GlobalEmailSettings } from './global-email-settings.interface';

/**
 * Configuration for the email module
 * Supports both global and feature-specific configuration
 */
export interface EmailModuleConfig {
  /** Email provider to use */
  provider: EmailProvider;

  /** Provider-specific configuration */
  config: EmailProviderConfig;

  /** Whether to enable debug logging */
  debug?: boolean;

  /** Global email settings */
  globalSettings?: GlobalEmailSettings;
}
