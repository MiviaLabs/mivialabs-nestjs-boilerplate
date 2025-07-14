import {
  IsEmail,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EmailAttachmentDto } from './email-attachment.dto';

/**
 * DTO for email sending validation
 * Ensures all required fields are present and valid
 */
export class SendEmailDto {
  @IsEmail({}, { message: 'From address must be a valid email' })
  from!: string;

  @IsEmail(
    {},
    { each: true, message: 'All recipient addresses must be valid emails' },
  )
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? (value as string[]) : [value as string],
  )
  to!: string[];

  @IsString({ message: 'Subject must be a string' })
  subject!: string;

  @IsOptional()
  @IsString({ message: 'HTML content must be a string' })
  html?: string;

  @IsOptional()
  @IsString({ message: 'Text content must be a string' })
  text?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Reply-to must be a valid email address' })
  replyTo?: string;

  @IsOptional()
  @IsEmail({}, { each: true, message: 'All CC addresses must be valid emails' })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? (value as string[]) : [value as string],
  )
  cc?: string[];

  @IsOptional()
  @IsEmail(
    {},
    { each: true, message: 'All BCC addresses must be valid emails' },
  )
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? (value as string[]) : [value as string],
  )
  bcc?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDto)
  attachments?: EmailAttachmentDto[];
}
