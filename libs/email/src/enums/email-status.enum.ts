/**
 * Email sending status enumeration
 * Represents the current state of an email in the sending process
 */
export enum EmailStatus {
  /** Email is queued for sending */
  PENDING = 'pending',
  /** Email has been successfully sent */
  SENT = 'sent',
  /** Email sending failed */
  FAILED = 'failed',
  /** Email is being retried after failure */
  RETRYING = 'retrying',
}
