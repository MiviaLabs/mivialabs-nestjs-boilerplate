export type StorageProvider =
  | 'minio'
  | 'aws-s3'
  | 'cloudflare-r2'
  | 's3-compatible';

export interface StorageConfig {
  provider: StorageProvider;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  endpoint?: string;

  // MinIO specific
  minioEndpoint?: string;
  minioHost?: string;
  minioPort?: number;

  // Cloudflare R2 specific
  cloudflareAccountId?: string;

  // Additional options
  forcePathStyle?: boolean;
}

export interface UploadFileOptions {
  bucket: string;
  path: string;
  file: Buffer;
  originalName: string;
  mimeType: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

export interface DeleteFileOptions {
  bucket: string;
  path: string;
}

export interface FileUploadResult {
  id: string;
  bucket: string;
  path: string;
  originalName: string;
  mimeType: string;
  size: number;
  checksum?: string;
  url?: string;
  isPublic: boolean;
}

export interface StorageFileInfo {
  bucket: string;
  path: string;
  size: number;
  lastModified?: Date;
  etag?: string;
}
