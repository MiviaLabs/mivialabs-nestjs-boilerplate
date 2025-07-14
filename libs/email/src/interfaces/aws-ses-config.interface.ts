/**
 * Configuration options for AWS SES provider
 * Based on AWS SDK v3 SESClient configuration
 */
export interface AwsSesConfig {
  /** AWS region for SES operations */
  region: string;

  /** AWS access key ID (optional if using IAM roles) */
  accessKeyId?: string;

  /** AWS secret access key (optional if using IAM roles) */
  secretAccessKey?: string;

  /** AWS session token (for temporary credentials) */
  sessionToken?: string;

  /** AWS profile name (for credential file) */
  profile?: string;

  /** Custom endpoint URL (for testing/localstack) */
  endpoint?: string;

  /** Maximum number of retry attempts */
  maxAttempts?: number;

  /** Request timeout in milliseconds */
  requestTimeout?: number;

  /** Connection timeout in milliseconds */
  connectionTimeout?: number;

  /** Whether to use FIPS endpoints */
  useFipsEndpoint?: boolean;

  /** Whether to use dual-stack endpoints */
  useDualstackEndpoint?: boolean;

  /** Custom configuration set name */
  configurationSetName?: string;

  /** Default source ARN for sending */
  sourceArn?: string;
}
