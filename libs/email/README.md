# Multi-Provider Email Module

A comprehensive, type-safe email module for NestJS applications that supports multiple email providers through a unified adapter pattern. Switch between AWS SES and Resend seamlessly without changing your application code.

## 🚀 Features

- **Multi-Provider Support**: AWS SES and Resend with extensible architecture
- **Type-Safe**: Full TypeScript support with strict typing
- **Dynamic Configuration**: Runtime provider switching and configuration
- **Adapter Pattern**: Clean separation between providers and business logic
- **Comprehensive Error Handling**: Detailed error responses with retry logic
- **Health Monitoring**: Built-in health checks and status monitoring
- **Batch Operations**: Send multiple emails efficiently
- **Global Settings**: Default configurations and rate limiting support
- **Extensive Testing**: 100% test coverage with unit and integration tests

## 📦 Installation

```bash
npm install @aws-sdk/client-ses resend
```

## 🔧 Quick Start

### 1. Import the Module

```typescript
import { Module } from '@nestjs/common';
import { EmailModule, EmailProvider } from '@libs/email';

@Module({
  imports: [
    EmailModule.forRoot({
      provider: EmailProvider.RESEND,
      config: {
        apiKey: 'your-resend-api-key',
      },
    }),
  ],
})
export class AppModule {}
```

### 2. Use the Service

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@libs/email';

@Injectable()
export class NotificationService {
  constructor(private readonly emailService: EmailService) {}

  async sendWelcomeEmail(userEmail: string, userName: string) {
    const result = await this.emailService.sendEmail({
      from: 'welcome@yourapp.com',
      to: userEmail,
      subject: 'Welcome to Our Platform!',
      html: `<h1>Hello ${userName}!</h1><p>Welcome to our platform.</p>`,
      text: `Hello ${userName}! Welcome to our platform.`,
    });

    if (result.success) {
      console.log('Email sent successfully:', result.messageId);
    } else {
      console.error('Email failed:', result.error?.message);
    }

    return result;
  }
}
```

## 📖 Configuration

### Resend Configuration

```typescript
EmailModule.forRoot({
  provider: EmailProvider.RESEND,
  config: {
    apiKey: 'your-resend-api-key',
    defaultFromAddress: 'noreply@yourapp.com',
    defaultReplyTo: 'support@yourapp.com',
    validateEmailAddresses: true,
    timeout: 30000,
  },
  globalSettings: {
    defaultFromAddress: 'noreply@yourapp.com',
    defaultReplyTo: 'support@yourapp.com',
    enableTracking: true,
    rateLimiting: {
      maxEmailsPerMinute: 60,
      maxEmailsPerHour: 1000,
    },
  },
});
```

### AWS SES Configuration

```typescript
EmailModule.forRoot({
  provider: EmailProvider.AWS_SES,
  config: {
    region: 'us-east-1',
    accessKeyId: 'your-access-key-id',
    secretAccessKey: 'your-secret-access-key',
    configurationSetName: 'your-config-set',
    maxAttempts: 3,
    requestTimeout: 30000,
  },
});
```

### Async Configuration

```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot(),
    EmailModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        provider:
          configService.get('EMAIL_PROVIDER') === 'resend'
            ? EmailProvider.RESEND
            : EmailProvider.AWS_SES,
        config: {
          apiKey: configService.get('RESEND_API_KEY'),
          // or AWS SES config based on provider
        },
        globalSettings: {
          defaultFromAddress: configService.get('DEFAULT_FROM_EMAIL'),
          defaultReplyTo: configService.get('DEFAULT_REPLY_TO'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## 💡 Usage Examples

### Basic Email Sending

```typescript
// Simple text email
await emailService.sendEmail({
  from: 'sender@yourapp.com',
  to: 'recipient@example.com',
  subject: 'Hello World',
  text: 'This is a plain text email.',
});

// HTML email with attachments
await emailService.sendEmail({
  from: 'sender@yourapp.com',
  to: ['user1@example.com', 'user2@example.com'],
  subject: 'Newsletter',
  html: '<h1>Newsletter</h1><p>Latest updates...</p>',
  attachments: [
    {
      filename: 'report.pdf',
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
  ],
});
```

### Batch Email Sending

```typescript
const emailBatch = [
  {
    from: 'notifications@yourapp.com',
    to: 'user1@example.com',
    subject: 'Personal Message',
    html: '<p>Hello User 1!</p>',
  },
  {
    from: 'notifications@yourapp.com',
    to: 'user2@example.com',
    subject: 'Personal Message',
    html: '<p>Hello User 2!</p>',
  },
];

const results = await emailService.sendBatchEmails(emailBatch);

results.forEach((result, index) => {
  if (result.success) {
    console.log(`Email ${index + 1} sent: ${result.messageId}`);
  } else {
    console.error(`Email ${index + 1} failed: ${result.error?.message}`);
  }
});
```

### Using DTOs for Validation

```typescript
import { SendEmailDto } from '@libs/email';

@Controller('emails')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async sendEmail(@Body() emailDto: SendEmailDto) {
    return this.emailService.sendEmailFromDto(emailDto);
  }
}
```

### Health Monitoring

```typescript
@Injectable()
export class HealthService {
  constructor(private readonly emailService: EmailService) {}

  async checkEmailHealth() {
    const health = await this.emailService.getHealthStatus();

    return {
      email: {
        healthy: health.healthy,
        provider: health.provider,
        timestamp: health.timestamp,
        details: health.details,
      },
    };
  }
}
```

### Feature-Specific Configuration

```typescript
// In a specific feature module
@Module({
  imports: [
    EmailModule.forFeature({
      provider: EmailProvider.AWS_SES,
      config: {
        region: 'eu-west-1',
        configurationSetName: 'marketing-emails',
      },
    }),
  ],
  providers: [MarketingService],
})
export class MarketingModule {}
```

## 🔄 Provider Switching

Switch between providers by changing only the configuration:

```typescript
// Development: Use Resend
const devConfig = {
  provider: EmailProvider.RESEND,
  config: { apiKey: 'dev-key' },
};

// Production: Use AWS SES
const prodConfig = {
  provider: EmailProvider.AWS_SES,
  config: {
    region: 'us-east-1',
    // IAM role-based authentication
  },
};
```

## 🛡️ Error Handling

The module provides comprehensive error handling with detailed error information:

```typescript
const result = await emailService.sendEmail(emailOptions);

if (!result.success) {
  const error = result.error!;

  console.error('Email failed:', {
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    provider: result.provider,
    timestamp: result.timestamp,
  });

  if (error.retryable) {
    // Implement retry logic
    console.log('Error is retryable, scheduling retry...');
  }
}
```

## 📊 Environment Configuration

### Environment Variables

```bash
# Email Provider
EMAIL_PROVIDER=resend  # or aws-ses

# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxx

# AWS SES Configuration
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_SES_CONFIGURATION_SET=default

# Global Settings
DEFAULT_FROM_EMAIL=noreply@yourapp.com
DEFAULT_REPLY_TO=support@yourapp.com
```

### Configuration Service Integration

```typescript
@Injectable()
export class EmailConfigService {
  constructor(private configService: ConfigService) {}

  createEmailConfig(): EmailModuleConfig {
    const provider = this.configService.get('EMAIL_PROVIDER');

    if (provider === 'resend') {
      return {
        provider: EmailProvider.RESEND,
        config: {
          apiKey: this.configService.get('RESEND_API_KEY'),
        },
      };
    } else {
      return {
        provider: EmailProvider.AWS_SES,
        config: {
          region: this.configService.get('AWS_SES_REGION'),
          accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
        },
      };
    }
  }
}
```

## 🧪 Testing

The module includes comprehensive testing utilities:

```typescript
// Test with mock provider
import { Test } from '@nestjs/testing';
import { EmailModule, EmailService } from '@libs/email';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        EmailModule.forRoot({
          provider: EmailProvider.RESEND,
          config: { apiKey: 'test-key' },
        }),
      ],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
  });

  it('should send email successfully', async () => {
    const result = await emailService.sendEmail({
      from: 'test@example.com',
      to: 'recipient@example.com',
      subject: 'Test',
      text: 'Test message',
    });

    expect(result.success).toBe(true);
  });
});
```

## 📋 API Reference

### EmailService Methods

- `sendEmail(options: EmailSendOptions): Promise<EmailSendResult>`
- `sendEmailFromDto(dto: SendEmailDto): Promise<EmailSendResult>`
- `sendBatchEmails(emails: EmailSendOptions[]): Promise<EmailSendResult[]>`
- `getHealthStatus(): Promise<HealthStatus>`
- `validateConfiguration(): Promise<boolean>`

### Configuration Interfaces

- `EmailModuleConfig` - Main module configuration
- `AwsSesConfig` - AWS SES specific configuration
- `ResendConfig` - Resend specific configuration
- `GlobalEmailSettings` - Global email settings

### DTOs

- `SendEmailDto` - Email sending validation DTO
- `EmailAttachmentDto` - Email attachment validation DTO

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🔗 Links

- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [Resend Documentation](https://resend.com/docs)
- [NestJS Documentation](https://docs.nestjs.com/)

---
