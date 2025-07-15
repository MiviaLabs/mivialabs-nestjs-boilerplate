// Main module
export {
  StorageModule,
  StorageModuleOptions,
  StorageModuleAsyncOptions,
} from './storage.module';

// Services
export { StorageService } from './services/storage.service';

// DTOs
export {
  UploadFileDto,
  DeleteFileDto,
  FileUploadResponseDto,
} from './dto/upload-file.dto';

// Types and interfaces
export {
  StorageProvider,
  StorageConfig,
  UploadFileOptions,
  DeleteFileOptions,
  FileUploadResult,
  StorageFileInfo,
} from './types/storage-provider.types';

export { IStorageAdapter } from './interfaces/storage-adapter.interface';

// Adapters
export { S3Adapter } from './adapters/s3-adapter';
