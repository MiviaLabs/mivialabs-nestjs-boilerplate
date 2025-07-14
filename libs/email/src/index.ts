/**
 * @fileoverview Multi-Provider Email Module for NestJS
 *
 * This module provides a unified interface for sending emails through multiple
 * providers (AWS SES, Resend) using the adapter pattern. It supports dynamic
 * configuration, type-safe interfaces, and comprehensive error handling.
 *
 * @example Basic Usage
 * ```typescript
 * import { EmailModule, EmailProvider } from '@libs/email';
 *
 * @Module({
 *   imports: [
 *     EmailModule.forRoot({
 *       provider: EmailProvider.RESEND,
 *       config: { apiKey: 'your-api-key' }
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 *
 * @example Sending Emails
 * ```typescript
 * constructor(private emailService: EmailService) {}
 *
 * async sendWelcomeEmail() {
 *   const result = await this.emailService.sendEmail({
 *     from: 'welcome@company.com',
 *     to: 'user@example.com',
 *     subject: 'Welcome!',
 *     html: '<h1>Welcome to our platform!</h1>'
 *   });
 *
 *   if (result.success) {
 *     console.log('Email sent:', result.messageId);
 *   }
 * }
 * ```
 *
 * @version 1.0.0
 * @author MiviaLabs Development Team
 */

// Main module exports
export * from './email.module';

// Core services
export * from './services';

// Provider enums and types
export * from './enums';
export * from './types';

// Configuration interfaces
export * from './interfaces';

// Validation DTOs
export * from './dto';

// Provider adapters (for advanced usage)
export * from './adapters';

// Module constants and tokens
export * from './constants/email-module.constants';
