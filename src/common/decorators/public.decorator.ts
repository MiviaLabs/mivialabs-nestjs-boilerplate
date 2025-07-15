import { SetMetadata } from '@nestjs/common';

/**
 * Public decorator key for identifying routes that should skip authentication
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public decorator
 *
 * Use this decorator to mark routes that should be accessible without authentication.
 * This decorator sets metadata that can be read by guards to skip authentication checks.
 *
 * @example
 * ```typescript
 * @Controller('auth')
 * export class AuthController {
 *   @Public()
 *   @Post('login')
 *   async login(@Body() loginDto: LoginDto) {
 *     // This endpoint will skip authentication
 *   }
 * }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
