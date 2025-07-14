/**
 * Email attachment definition
 */
export interface EmailAttachment {
  /** Attachment filename */
  filename: string;

  /** Attachment content */
  content: Buffer | string;

  /** Content type (MIME type) */
  contentType?: string;

  /** Content disposition */
  disposition?: 'attachment' | 'inline';

  /** Content ID for inline attachments */
  cid?: string;
}
