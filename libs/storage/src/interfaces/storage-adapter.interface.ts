import {
  UploadFileOptions,
  DeleteFileOptions,
  FileUploadResult,
  StorageFileInfo,
} from '../types/storage-provider.types';

export interface IStorageAdapter {
  /**
   * Upload a file to storage
   */
  uploadFile(options: UploadFileOptions): Promise<FileUploadResult>;

  /**
   * Delete a file from storage
   */
  deleteFile(options: DeleteFileOptions): Promise<void>;

  /**
   * Check if a file exists in storage
   */
  fileExists(bucket: string, path: string): Promise<boolean>;

  /**
   * Get file information from storage
   */
  getFileInfo(bucket: string, path: string): Promise<StorageFileInfo>;

  /**
   * Generate a presigned URL for file access (optional)
   */
  getPresignedUrl?(
    bucket: string,
    path: string,
    expiresInSeconds?: number,
  ): Promise<string>;

  /**
   * Generate a presigned URL for file upload (optional)
   */
  getPresignedUploadUrl?(
    bucket: string,
    path: string,
    expiresInSeconds?: number,
  ): Promise<string>;
}
