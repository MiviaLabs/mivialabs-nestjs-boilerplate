import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../../common/decorators';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@ApiTags('User Profile')
@Controller('user')
@UseGuards(AuthGuard('jwt')) // Protect all routes in this controller
@ApiBearerAuth() // Add JWT authorization to Swagger
export class UserProfileController {
  @Get('profile')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: 'uuid-string' },
        email: { type: 'string', example: 'user@example.com' },
        organizationId: { type: 'string', example: 'org-uuid-string' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return {
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
    };
  }

  @Get('id')
  @ApiOperation({
    summary: 'Get current user ID',
    description: 'Returns only the authenticated user ID',
  })
  @ApiResponse({
    status: 200,
    description: 'User ID retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: 'uuid-string' },
      },
    },
  })
  getUserId(@CurrentUser('id') userId: string) {
    return { userId };
  }

  @Get('organization')
  @ApiOperation({
    summary: 'Get user organization info',
    description: 'Returns the authenticated user organization information',
  })
  @ApiResponse({
    status: 200,
    description: 'Organization info retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', example: 'org-uuid-string' },
        userId: { type: 'string', example: 'uuid-string' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Organization access denied',
  })
  getOrganizationInfo(@CurrentUser() user: AuthenticatedUser) {
    return {
      organizationId: user.organizationId,
      userId: user.id,
    };
  }
}
