/**
 * Email sending error details
 */
export interface EmailSendError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Provider-specific error details */
  details?: Record<string, unknown>;

  /** Whether the error is retryable */
  retryable: boolean;
}
