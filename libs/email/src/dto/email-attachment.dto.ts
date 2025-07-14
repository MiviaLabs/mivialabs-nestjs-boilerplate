import { IsString, IsOptional } from 'class-validator';

/**
 * DTO for email attachment validation
 */
export class EmailAttachmentDto {
  @IsString({ message: 'Filename must be a string' })
  filename!: string;

  @IsString({ message: 'Content must be provided' })
  content!: string;

  @IsOptional()
  @IsString({ message: 'Content type must be a string' })
  contentType?: string;

  @IsOptional()
  @IsString({ message: 'Disposition must be either "attachment" or "inline"' })
  disposition?: 'attachment' | 'inline';

  @IsOptional()
  @IsString({ message: 'Content ID must be a string' })
  cid?: string;
}
