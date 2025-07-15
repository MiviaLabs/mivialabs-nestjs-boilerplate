import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class SlugAvailabilityResponseDto {
  @ApiProperty({
    description: 'Whether the slug is available',
    example: true,
  })
  @IsBoolean({ message: 'Available status must be a boolean' })
  @IsNotEmpty({ message: 'Available status is required' })
  available!: boolean;

  @ApiProperty({
    description: 'The requested slug',
    example: 'acme-corp',
  })
  @IsString({ message: 'Slug must be a string' })
  @IsNotEmpty({ message: 'Slug is required' })
  slug!: string;

  @ApiProperty({
    description: 'Alternative slug suggestions if not available',
    example: ['acme-corp-1', 'acme-corp-2024', 'acme-corporation'],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'Suggestions must be an array' })
  @IsString({ each: true, message: 'Each suggestion must be a string' })
  @ArrayMinSize(0, { message: 'Suggestions array can be empty' })
  suggestions?: string[];
}
