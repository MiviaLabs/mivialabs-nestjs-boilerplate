import { EmailResponseDto } from './email-response.dto';

/**
 * DTO for batch email sending response
 */
export class BatchEmailResponseDto {
  /** Total number of emails processed */
  totalEmails!: number;

  /** Number of emails sent successfully */
  successCount!: number;

  /** Number of emails that failed */
  failureCount!: number;

  /** Individual email results */
  results!: EmailResponseDto[];

  /** Timestamp when batch processing completed */
  timestamp!: Date;
}
