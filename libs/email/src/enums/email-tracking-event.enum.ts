/**
 * Email tracking event enumeration
 * Represents different events that can occur during email lifecycle
 */
export enum EmailTrackingEvent {
  /** Email was successfully delivered to recipient's mailbox */
  DELIVERED = 'delivered',
  /** Email was opened by the recipient */
  OPENED = 'opened',
  /** Link in the email was clicked */
  CLICKED = 'clicked',
  /** Email bounced (delivery failed) */
  BOUNCED = 'bounced',
  /** Email was marked as spam/complaint */
  COMPLAINED = 'complained',
}
