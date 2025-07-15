import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CheckSlugAvailabilityDto {
  @ApiProperty({
    description: 'Organization slug to check availability',
    example: 'acme-corp',
  })
  @IsString({ message: 'Organization slug must be a string' })
  @IsNotEmpty({ message: 'Organization slug is required' })
  @MinLength(2, {
    message: 'Organization slug must be at least 2 characters long',
  })
  @MaxLength(50, {
    message: 'Organization slug must be no more than 50 characters long',
  })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Organization slug can only contain lowercase letters, numbers, and hyphens (no consecutive hyphens)',
  })
  slug!: string;
}
