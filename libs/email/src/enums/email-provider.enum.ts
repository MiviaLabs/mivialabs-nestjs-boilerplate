/**
 * Supported email providers for the email module
 * @enum {string}
 */
export enum EmailProvider {
  /** Amazon Simple Email Service */
  AWS_SES = 'aws-ses',
  /** Resend Email Service */
  RESEND = 'resend',
}

/**
 * Union type of all provider values
 */
export type EmailProviderValue = `${EmailProvider}`;
