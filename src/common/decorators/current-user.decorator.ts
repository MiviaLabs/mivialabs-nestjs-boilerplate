import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../guards/jwt-auth.guard';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

/**
 * CurrentUser Decorator
 *
 * @description Decorator to extract authenticated user data from request
 *
 * @example
 * ```typescript
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 *
 * // Extract specific property
 * @Get('user-id')
 * @UseGuards(JwtAuthGuard)
 * getUserId(@CurrentUser('id') userId: string) {
 *   return { userId };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      return null;
    }

    // If a specific property is requested, return only that property
    if (data) {
      return user[data];
    }

    // Return the entire user object
    return user;
  },
);
