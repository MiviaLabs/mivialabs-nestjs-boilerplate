import { Injectable, Logger } from '@nestjs/common';
import { EmailAdapter } from '../interfaces/email-adapter.interface';
import { EmailProvider } from '../enums/email-provider.enum';
import { EmailProviderConfigUnion } from '../types/email-provider-config.types';
import { AwsSesAdapter } from '../adapters/aws-ses.adapter';
import { ResendAdapter } from '../adapters/resend.adapter';
import { AwsSesConfig } from '../interfaces/aws-ses-config.interface';
import { ResendConfig } from '../interfaces/resend-config.interface';

/**
 * Factory service for creating email provider adapters
 * Handles provider instantiation and configuration validation
 */
@Injectable()
export class EmailAdapterFactory {
  private readonly logger = new Logger(EmailAdapterFactory.name);
  private readonly adapterCache = new Map<string, EmailAdapter>();

  /**
   * Create an email adapter for the specified provider
   * @param provider Email provider to create adapter for
   * @param config Provider-specific configuration
   * @returns Configured email adapter instance
   */
  createAdapter(
    provider: EmailProvider,
    config: EmailProviderConfigUnion,
  ): EmailAdapter {
    const cacheKey = this.getCacheKey(provider, config);

    // Return cached adapter if available
    if (this.adapterCache.has(cacheKey)) {
      this.logger.debug(`Returning cached adapter for provider: ${provider}`);
      return this.adapterCache.get(cacheKey)!;
    }

    this.logger.debug(`Creating new adapter for provider: ${provider}`);

    let adapter: EmailAdapter;

    switch (provider) {
      case EmailProvider.AWS_SES:
        this.validateAwsSesConfig(config as AwsSesConfig);
        adapter = new AwsSesAdapter(config as AwsSesConfig);
        break;

      case EmailProvider.RESEND:
        this.validateResendConfig(config as ResendConfig);
        adapter = new ResendAdapter(config as ResendConfig);
        break;

      default:
        throw new Error(`Unsupported email provider: ${String(provider)}`);
    }

    // Cache the adapter for reuse
    this.adapterCache.set(cacheKey, adapter);

    return adapter;
  }

  /**
   * Validate all configured adapters
   * @param providers Array of provider configurations to validate
   * @returns Promise that resolves to validation results
   */
  async validateAdapters(
    providers: Array<{
      provider: EmailProvider;
      config: EmailProviderConfigUnion;
    }>,
  ): Promise<
    Array<{ provider: EmailProvider; valid: boolean; error?: string }>
  > {
    const results = [];

    for (const { provider, config } of providers) {
      try {
        const adapter = this.createAdapter(provider, config);
        const isValid = await adapter.validateConfiguration();

        results.push({
          provider,
          valid: isValid,
        });
      } catch (error) {
        results.push({
          provider,
          valid: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Clear adapter cache (useful for testing or config changes)
   */
  clearCache(): void {
    this.adapterCache.clear();
    this.logger.debug('Adapter cache cleared');
  }

  private getCacheKey(
    provider: EmailProvider,
    config: EmailProviderConfigUnion,
  ): string {
    // Create a cache key based on provider and essential config properties
    const configHash = this.hashConfig(config);
    return `${provider}:${configHash}`;
  }

  private hashConfig(config: EmailProviderConfigUnion): string {
    // Simple hash of config for cache key generation
    const configString = JSON.stringify(config, Object.keys(config).sort());
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  private validateAwsSesConfig(config: AwsSesConfig): void {
    if (!config.region) {
      throw new Error('AWS SES region is required');
    }

    // If access keys are provided, both must be present
    if (config.accessKeyId && !config.secretAccessKey) {
      throw new Error(
        'AWS SES secret access key is required when access key ID is provided',
      );
    }

    if (config.secretAccessKey && !config.accessKeyId) {
      throw new Error(
        'AWS SES access key ID is required when secret access key is provided',
      );
    }

    // Validate region format
    const regionPattern = /^[a-z0-9-]+$/;
    if (!regionPattern.test(config.region)) {
      throw new Error(`Invalid AWS region format: ${config.region}`);
    }
  }

  private validateResendConfig(config: ResendConfig): void {
    if (!config.apiKey) {
      throw new Error('Resend API key is required');
    }

    // Validate API key format (Resend keys start with 're_')
    if (!config.apiKey.startsWith('re_')) {
      throw new Error('Invalid Resend API key format');
    }

    // Validate timeout if provided
    if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
      throw new Error('Resend timeout must be between 1000ms and 300000ms');
    }
  }
}
