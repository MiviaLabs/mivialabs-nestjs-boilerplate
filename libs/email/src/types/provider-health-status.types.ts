/**
 * Provider health status type
 * Represents the health and availability of an email provider
 */
export type ProviderHealthStatus = {
  /** Whether the provider is healthy and available */
  healthy: boolean;
  /** Name of the email provider */
  provider: string;
  /** Timestamp when health was checked */
  timestamp: Date;
  /** Additional provider-specific health details */
  details?: Record<string, unknown>;
};
