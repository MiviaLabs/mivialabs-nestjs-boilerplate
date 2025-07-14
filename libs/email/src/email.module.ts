import {
  DynamicModule,
  Module,
  Provider,
  Type,
  ForwardReference,
  InjectionToken,
  OptionalFactoryDependency,
} from '@nestjs/common';
import { EmailService } from './services/email.service';
import { EmailAdapterFactory } from './services/email-adapter-factory.service';
import { EmailModuleConfig } from './interfaces/email-module-config.interface';
import { EMAIL_MODULE_CONFIG } from './constants/email-module.constants';

/**
 * Dynamic NestJS module for email functionality
 * Supports both global and feature-specific configuration
 */
@Module({})
export class EmailModule {
  /**
   * Create module for global use with root configuration
   * Use this in your main AppModule for application-wide email configuration
   *
   * @param config Email module configuration
   * @returns Dynamic module for global use
   */
  static forRoot(config: EmailModuleConfig): DynamicModule {
    const configProvider: Provider = {
      provide: EMAIL_MODULE_CONFIG,
      useValue: config,
    };

    return {
      module: EmailModule,
      global: true,
      providers: [configProvider, EmailAdapterFactory, EmailService],
      exports: [EmailService],
    };
  }

  /**
   * Create module for feature-specific use
   * Use this in feature modules that need custom email configuration
   *
   * @param config Email module configuration
   * @returns Dynamic module for feature use
   */
  static forFeature(config: EmailModuleConfig): DynamicModule {
    const configProvider: Provider = {
      provide: EMAIL_MODULE_CONFIG,
      useValue: config,
    };

    return {
      module: EmailModule,
      providers: [configProvider, EmailAdapterFactory, EmailService],
      exports: [EmailService],
    };
  }

  /**
   * Create module with async configuration
   * Use this when configuration needs to be resolved asynchronously
   *
   * @param options Async configuration options
   * @returns Dynamic module with async configuration
   */
  static forRootAsync(options: {
    useFactory: (...args: unknown[]) => Promise<EmailModuleConfig> | EmailModuleConfig;
    inject?: (InjectionToken | OptionalFactoryDependency)[];
    imports?: (
      | DynamicModule
      | Type<unknown>
      | ForwardReference<unknown>
      | Promise<DynamicModule>
    )[];
  }): DynamicModule {
    const configProvider: Provider = {
      provide: EMAIL_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    return {
      module: EmailModule,
      global: true,
      imports: options.imports || [],
      providers: [configProvider, EmailAdapterFactory, EmailService],
      exports: [EmailService],
    };
  }

  /**
   * Create module with async feature configuration
   * Use this in feature modules with async configuration needs
   *
   * @param options Async configuration options
   * @returns Dynamic module with async configuration
   */
  static forFeatureAsync(options: {
    useFactory: (...args: unknown[]) => Promise<EmailModuleConfig> | EmailModuleConfig;
    inject?: (InjectionToken | OptionalFactoryDependency)[];
    imports?: (
      | DynamicModule
      | Type<unknown>
      | ForwardReference<unknown>
      | Promise<DynamicModule>
    )[];
  }): DynamicModule {
    const configProvider: Provider = {
      provide: EMAIL_MODULE_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    return {
      module: EmailModule,
      imports: options.imports || [],
      providers: [configProvider, EmailAdapterFactory, EmailService],
      exports: [EmailService],
    };
  }
}
