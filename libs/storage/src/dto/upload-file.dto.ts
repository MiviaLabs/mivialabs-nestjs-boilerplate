import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({
    description: 'The bucket name where the file will be stored',
    example: 'user-uploads',
  })
  @IsString()
  @IsNotEmpty()
  bucket!: string;

  @ApiProperty({
    description: 'The path/key for the file in storage',
    example: 'documents/report-2024.pdf',
  })
  @IsString()
  @IsNotEmpty()
  path!: string;

  @ApiProperty({
    description: 'The original filename',
    example: 'annual-report.pdf',
  })
  @IsString()
  @IsNotEmpty()
  originalName!: string;

  @ApiProperty({
    description: 'The MIME type of the file',
    example: 'application/pdf',
  })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiPropertyOptional({
    description: 'Whether the file should be publicly accessible',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean = false;

  @ApiPropertyOptional({
    description: 'Additional metadata for the file',
    example: { department: 'finance', year: '2024' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;
}

export class DeleteFileDto {
  @ApiProperty({
    description: 'The bucket name where the file is stored',
    example: 'user-uploads',
  })
  @IsString()
  @IsNotEmpty()
  bucket!: string;

  @ApiProperty({
    description: 'The path/key of the file to delete',
    example: 'documents/report-2024.pdf',
  })
  @IsString()
  @IsNotEmpty()
  path!: string;
}

export class FileUploadResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the uploaded file',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'The bucket where the file is stored',
    example: 'user-uploads',
  })
  bucket!: string;

  @ApiProperty({
    description: 'The path/key of the uploaded file',
    example: 'documents/report-2024.pdf',
  })
  path!: string;

  @ApiProperty({
    description: 'The original filename',
    example: 'annual-report.pdf',
  })
  originalName!: string;

  @ApiProperty({
    description: 'The MIME type of the file',
    example: 'application/pdf',
  })
  mimeType!: string;

  @ApiProperty({
    description: 'The size of the file in bytes',
    example: 1048576,
  })
  size!: number;

  @ApiPropertyOptional({
    description: 'File checksum for integrity verification',
    example: 'sha256:a1b2c3d4...',
  })
  checksum?: string;

  @ApiPropertyOptional({
    description: 'Public URL for the file (if public)',
    example: 'https://cdn.example.com/user-uploads/documents/report-2024.pdf',
  })
  url?: string;

  @ApiProperty({
    description: 'Whether the file is publicly accessible',
    example: false,
  })
  isPublic!: boolean;

  @ApiProperty({
    description: 'When the file was uploaded',
    example: '2024-07-15T10:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'When the file record was last updated',
    example: '2024-07-15T10:30:00.000Z',
  })
  updatedAt!: Date;
}
