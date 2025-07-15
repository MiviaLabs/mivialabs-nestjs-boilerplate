# Storage Library

A comprehensive, customizable NestJS storage library that supports multiple S3-compatible providers with database integration for file tracking.

## Features

- 🔌 **Multi-Provider Support**: AWS S3, MinIO, Cloudflare R2, and any S3-compatible storage
- 🗄️ **Database Integration**: Automatic file metadata tracking with PostgreSQL and Drizzle ORM
- 🛡️ **Row Level Security**: Organization-scoped file access with RLS policies
- 📦 **Dynamic Module**: Configurable NestJS module with sync/async registration
- 🔐 **Security**: File integrity verification with checksums and presigned URLs
- ✅ **Validation**: Comprehensive input validation with class-validator
- 🧪 **Well Tested**: Complete test coverage with Jest
- 📝 **TypeScript**: Full type safety throughout the library

## Installation

```bash
# The library is already included in this project
# External dependencies are handled by package.json
```

## Quick Start

### 1. Module Registration

#### Synchronous Registration

```typescript
import { Module } from '@nestjs/common';
import { StorageModule } from '@libs/storage';

@Module({
  imports: [
    StorageModule.forRoot({
      isGlobal: true, // Optional: make it globally available
      config: {
        provider: 'minio',
        accessKeyId: 'your-access-key',
        secretAccessKey: 'your-secret-key',
        minioHost: 'localhost',
        minioPort: 9000,
      },
    }),
  ],
})
export class AppModule {}
```

#### Asynchronous Registration (Recommended)

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageModule, StorageConfig } from '@libs/storage';

@Module({
  imports: [
    StorageModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): StorageConfig => ({
        provider: configService.get('STORAGE_PROVIDER', 'minio'),
        accessKeyId: configService.get('STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: configService.get('STORAGE_SECRET_ACCESS_KEY'),
        region: configService.get('STORAGE_REGION', 'us-east-1'),
        // MinIO specific
        minioHost: configService.get('MINIO_HOST', 'localhost'),
        minioPort: configService.get('MINIO_PORT', 9000),
        // Cloudflare R2 specific
        cloudflareAccountId: configService.get('CLOUDFLARE_ACCOUNT_ID'),
        // Generic S3-compatible
        endpoint: configService.get('STORAGE_ENDPOINT'),
        forcePathStyle: configService.get('STORAGE_FORCE_PATH_STYLE', true),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### 2. Environment Configuration

Create or update your `.env` file:

```bash
# Storage Provider (minio | aws-s3 | cloudflare-r2 | s3-compatible)
STORAGE_PROVIDER=minio

# General S3 Configuration
STORAGE_ACCESS_KEY_ID=your-access-key
STORAGE_SECRET_ACCESS_KEY=your-secret-key
STORAGE_REGION=us-east-1

# MinIO Specific (alternative credentials)
MINIO_ACCESS_KEY=minio-access-key
MINIO_SECRET_KEY=minio-secret-key
MINIO_HOST=localhost
MINIO_PORT=9000
MINIO_ENDPOINT=http://localhost:9000

# Cloudflare R2 Specific
CLOUDFLARE_ACCOUNT_ID=your-account-id

# S3-Compatible Storage
STORAGE_ENDPOINT=https://your-s3-compatible-endpoint.com
STORAGE_FORCE_PATH_STYLE=true
```

### 3. Using the Storage Service

```typescript
import { Injectable } from '@nestjs/common';
import { StorageService, UploadFileDto } from '@libs/storage';

@Injectable()
export class FileController {
  constructor(private readonly storageService: StorageService) {}

  async uploadFile(
    file: Express.Multer.File,
    organizationId: string,
    uploadedBy?: string,
  ) {
    const uploadDto: UploadFileDto = {
      bucket: 'user-uploads',
      path: `documents/${Date.now()}-${file.originalname}`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      isPublic: false,
      metadata: {
        department: 'finance',
        year: '2024',
      },
    };

    return await this.storageService.uploadFile(
      uploadDto,
      file.buffer,
      organizationId,
      uploadedBy,
    );
  }

  async deleteFile(bucket: string, path: string, organizationId: string) {
    const deleteDto = { bucket, path };
    await this.storageService.deleteFile(deleteDto, organizationId);
  }

  async checkFileExists(bucket: string, path: string, organizationId: string) {
    return await this.storageService.fileExists(bucket, path, organizationId);
  }

  async getPresignedUrl(bucket: string, path: string, organizationId: string) {
    return await this.storageService.getPresignedUrl(
      bucket,
      path,
      organizationId,
      3600, // 1 hour expiry
    );
  }
}
```

## API Reference

### StorageService Methods

#### `uploadFile(uploadDto, fileBuffer, organizationId, uploadedBy?)`

Uploads a file to storage and creates a database record.

**Parameters:**
- `uploadDto: UploadFileDto` - File upload configuration
- `fileBuffer: Buffer` - File content as buffer
- `organizationId: string` - Organization identifier for RLS
- `uploadedBy?: string` - Optional user identifier

**Returns:** `Promise<FileUploadResponseDto>`

#### `deleteFile(deleteDto, organizationId)`

Deletes a file from both storage and database.

**Parameters:**
- `deleteDto: DeleteFileDto` - File deletion configuration
- `organizationId: string` - Organization identifier for RLS

**Returns:** `Promise<void>`

#### `deleteFileById(fileId, organizationId)`

Deletes a file by database ID.

**Parameters:**
- `fileId: string` - Database file ID
- `organizationId: string` - Organization identifier for RLS

**Returns:** `Promise<void>`

#### `getFile(fileId, organizationId)`

Retrieves file metadata from database.

**Parameters:**
- `fileId: string` - Database file ID
- `organizationId: string` - Organization identifier for RLS

**Returns:** `Promise<FileUploadResponseDto>`

#### `fileExists(bucket, path, organizationId)`

Checks if file exists in both database and storage.

**Parameters:**
- `bucket: string` - Storage bucket name
- `path: string` - File path in storage
- `organizationId: string` - Organization identifier for RLS

**Returns:** `Promise<boolean>`

#### `listFiles(organizationId, limit?, offset?)`

Lists files for an organization with pagination.

**Parameters:**
- `organizationId: string` - Organization identifier for RLS
- `limit?: number` - Maximum number of files to return
- `offset?: number` - Number of files to skip

**Returns:** `Promise<FileUploadResponseDto[]>`

#### `getPresignedUrl(bucket, path, organizationId, expiresInSeconds?)`

Generates a presigned URL for secure file access.

**Parameters:**
- `bucket: string` - Storage bucket name
- `path: string` - File path in storage
- `organizationId: string` - Organization identifier for RLS
- `expiresInSeconds?: number` - URL expiry time (default: 3600)

**Returns:** `Promise<string>`

#### `getPresignedUploadUrl(bucket, path, organizationId, expiresInSeconds?)`

Generates a presigned URL for direct client uploads.

**Parameters:**
- `bucket: string` - Storage bucket name
- `path: string` - File path in storage
- `organizationId: string` - Organization identifier for RLS
- `expiresInSeconds?: number` - URL expiry time (default: 3600)

**Returns:** `Promise<string>`

## Provider-Specific Configuration

### AWS S3

```typescript
{
  provider: 'aws-s3',
  accessKeyId: 'AKIA...',
  secretAccessKey: 'your-secret-key',
  region: 'us-west-2',
}
```

### MinIO

```typescript
{
  provider: 'minio',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  minioHost: 'localhost',
  minioPort: 9000,
  // OR use minioEndpoint directly
  minioEndpoint: 'http://localhost:9000',
}
```

### Cloudflare R2

```typescript
{
  provider: 'cloudflare-r2',
  accessKeyId: 'your-access-key',
  secretAccessKey: 'your-secret-key',
  cloudflareAccountId: 'your-account-id',
}
```

### Generic S3-Compatible

```typescript
{
  provider: 's3-compatible',
  accessKeyId: 'your-access-key',
  secretAccessKey: 'your-secret-key',
  endpoint: 'https://your-storage-endpoint.com',
  region: 'us-east-1',
  forcePathStyle: true,
}
```

## DTOs and Types

### UploadFileDto

```typescript
class UploadFileDto {
  bucket: string;              // Storage bucket name
  path: string;               // File path/key in storage
  originalName: string;       // Original filename
  mimeType: string;          // MIME type
  isPublic?: boolean;        // Public accessibility (default: false)
  metadata?: Record<string, string>; // Additional metadata
}
```

### DeleteFileDto

```typescript
class DeleteFileDto {
  bucket: string;  // Storage bucket name
  path: string;    // File path/key in storage
}
```

### FileUploadResponseDto

```typescript
class FileUploadResponseDto {
  id: string;           // Database file ID
  bucket: string;       // Storage bucket name
  path: string;         // File path/key
  originalName: string; // Original filename
  mimeType: string;     // MIME type
  size: number;         // File size in bytes
  checksum?: string;    // File checksum for integrity
  url?: string;         // Public URL (if public)
  isPublic: boolean;    // Public accessibility
  createdAt: Date;      // Upload timestamp
  updatedAt: Date;      // Last update timestamp
}
```

## Examples

### Basic File Upload

```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadFile(
  @UploadedFile() file: Express.Multer.File,
  @Body('organizationId') organizationId: string,
  @Request() req,
) {
  const uploadDto: UploadFileDto = {
    bucket: 'user-documents',
    path: `uploads/${req.user.id}/${file.originalname}`,
    originalName: file.originalname,
    mimeType: file.mimetype,
    isPublic: false,
  };

  const result = await this.storageService.uploadFile(
    uploadDto,
    file.buffer,
    organizationId,
    req.user.id,
  );

  return {
    message: 'File uploaded successfully',
    file: result,
  };
}
```

### Direct Client Upload with Presigned URLs

```typescript
@Post('presigned-upload-url')
async getPresignedUploadUrl(
  @Body() body: { bucket: string; path: string; organizationId: string },
) {
  const { bucket, path, organizationId } = body;
  
  const presignedUrl = await this.storageService.getPresignedUploadUrl(
    bucket,
    path,
    organizationId,
    300, // 5 minutes
  );

  return {
    uploadUrl: presignedUrl,
    message: 'Upload directly to this URL',
  };
}
```

### File Listing with Pagination

```typescript
@Get('files')
async listFiles(
  @Query('organizationId') organizationId: string,
  @Query('page') page: number = 1,
  @Query('limit') limit: number = 10,
) {
  const offset = (page - 1) * limit;
  
  const files = await this.storageService.listFiles(
    organizationId,
    limit,
    offset,
  );

  return {
    files,
    pagination: {
      page,
      limit,
      total: files.length,
    },
  };
}
```

### Secure File Access

```typescript
@Get('download/:fileId')
async downloadFile(
  @Param('fileId') fileId: string,
  @Query('organizationId') organizationId: string,
) {
  // Get file metadata
  const file = await this.storageService.getFile(fileId, organizationId);
  
  // Generate presigned URL for secure access
  const downloadUrl = await this.storageService.getPresignedUrl(
    file.bucket,
    file.path,
    organizationId,
    3600, // 1 hour
  );

  return {
    downloadUrl,
    filename: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
  };
}
```

## Security Features

### Organization-Based Access Control

All file operations are scoped to organizations using Row Level Security (RLS):

```sql
-- Automatic RLS policy enforcement
SELECT * FROM files WHERE organization_id = current_user_organization_id();
```

### File Integrity Verification

All uploaded files include SHA-256 checksums:

```typescript
// Automatic checksum generation and verification
const result = await storageService.uploadFile(uploadDto, buffer, orgId);
console.log(result.checksum); // "sha256:a1b2c3d4..."
```

### Presigned URLs

Secure, temporary access to files without exposing credentials:

```typescript
// Generate temporary download link
const downloadUrl = await storageService.getPresignedUrl(
  bucket,
  path,
  organizationId,
  3600, // 1 hour expiry
);
```

## Error Handling

The library throws specific NestJS exceptions:

```typescript
import { BadRequestException, NotFoundException } from '@nestjs/common';

try {
  await storageService.uploadFile(dto, buffer, orgId);
} catch (error) {
  if (error instanceof BadRequestException) {
    // Handle validation or upload errors
  } else if (error instanceof NotFoundException) {
    // Handle file not found errors
  }
}
```

## Database Schema

The library integrates with the existing file schema:

```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  bucket VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  original_name VARCHAR NOT NULL,
  mime_type VARCHAR NOT NULL,
  size BIGINT NOT NULL,
  checksum VARCHAR,
  is_public BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Unique constraint per organization
  UNIQUE(organization_id, bucket, path)
);

-- RLS Policies
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
CREATE POLICY files_organization_isolation ON files
  FOR ALL TO authenticated
  USING (organization_id = current_user_organization_id());
```

## Testing

Run the storage library tests:

```bash
# Run storage library tests only
npm test libs/storage

# Run with coverage
npm test libs/storage -- --coverage
```

## Troubleshooting

### Common Issues

1. **Connection Errors**: Verify your storage provider credentials and endpoints
2. **Permission Errors**: Ensure your access keys have proper bucket permissions
3. **Upload Failures**: Check file size limits and bucket policies
4. **Database Errors**: Verify the file table exists and RLS policies are configured

### Debug Mode

Enable debug logging in your environment:

```bash
DEBUG=storage:*
LOG_LEVEL=debug
```

## License

This storage library is part of the Mivia Labs NestJS Boilerplate project.