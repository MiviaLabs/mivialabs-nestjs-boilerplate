/**
 * Email priority level enumeration
 * Determines the importance and processing order of emails
 */
export enum EmailPriority {
  /** Low priority email */
  LOW = 'low',
  /** Normal priority email (default) */
  NORMAL = 'normal',
  /** High priority email */
  HIGH = 'high',
  /** Urgent priority email */
  URGENT = 'urgent',
}
