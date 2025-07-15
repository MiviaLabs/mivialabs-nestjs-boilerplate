import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignupDto {
  // User Information
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password!: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
  })
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  firstName!: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
  })
  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
  lastName!: string;

  // Organization Information
  @ApiProperty({
    description: 'Organization name',
    example: 'Acme Corporation',
  })
  @IsString({ message: 'Organization name must be a string' })
  @IsNotEmpty({ message: 'Organization name is required' })
  @MaxLength(100, {
    message: 'Organization name must not exceed 100 characters',
  })
  organizationName!: string;

  @ApiProperty({
    description: 'Organization slug (URL-friendly identifier)',
    example: 'acme-corp',
  })
  @IsString({ message: 'Organization slug must be a string' })
  @IsNotEmpty({ message: 'Organization slug is required' })
  @MinLength(3, {
    message: 'Organization slug must be at least 3 characters long',
  })
  @MaxLength(50, { message: 'Organization slug must not exceed 50 characters' })
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'Organization slug can only contain lowercase letters, numbers, and hyphens',
  })
  organizationSlug!: string;

  @ApiProperty({
    description: 'Organization description',
    example: 'A leading technology company',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Organization description must be a string' })
  @MaxLength(500, {
    message: 'Organization description must not exceed 500 characters',
  })
  organizationDescription?: string;

  @ApiProperty({
    description: 'Organization website URL',
    example: 'https://acme.com',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Organization website must be a string' })
  @Matches(/^https?:\/\/.+/, {
    message:
      'Organization website must be a valid URL starting with http:// or https://',
  })
  organizationWebsite?: string;
}
