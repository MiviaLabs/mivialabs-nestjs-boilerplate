import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../../common/decorators';
import { LoginUserCommand } from '../commands/login-user.command';
import { RefreshTokensCommand } from '../commands/refresh-tokens.command';
import { LogoutUserCommand } from '../commands/logout-user.command';
import { SignupUserCommand } from '../commands/signup-user.command';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { SignupDto } from '../dto/signup.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import { JwtTokenPair } from '../interfaces/jwt-payload.interface';
import { AuthenticatedRequest } from '../interfaces/express-request.interface';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate user with email and password, returns JWT tokens',
  })
  @ApiBody({
    type: LoginDto,
    description: 'User login credentials',
    examples: {
      example1: {
        summary: 'Standard login',
        description: 'Login with email and password',
        value: {
          email: 'user@example.com',
          password: 'SecurePassword123!',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or account not active',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Invalid credentials',
        },
        error: {
          type: 'string',
          example: 'Unauthorized',
        },
        statusCode: {
          type: 'number',
          example: 401,
        },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many login attempts',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Too many requests',
        },
        error: {
          type: 'string',
          example: 'Too Many Requests',
        },
        statusCode: {
          type: 'number',
          example: 429,
        },
      },
    },
  })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<AuthResponseDto> {
    const command = new LoginUserCommand(
      loginDto,
      req.sessionID || req.headers['x-session-id'],
      req.headers['x-correlation-id'],
      req.headers['x-causation-id'],
      req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'],
      req.headers['user-agent'],
    );

    return await this.commandBus.execute(command);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Generate new access and refresh tokens using a valid refresh token',
  })
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Refresh token for generating new tokens',
    examples: {
      example1: {
        summary: 'Token refresh',
        description: 'Refresh tokens using existing refresh token',
        value: {
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token refresh successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        refreshToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        expiresIn: {
          type: 'number',
          example: 900,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Invalid refresh token',
        },
        error: {
          type: 'string',
          example: 'Unauthorized',
        },
        statusCode: {
          type: 'number',
          example: 401,
        },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many refresh attempts',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Too many requests',
        },
        error: {
          type: 'string',
          example: 'Too Many Requests',
        },
        statusCode: {
          type: 'number',
          example: 429,
        },
      },
    },
  })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<JwtTokenPair> {
    const command = new RefreshTokensCommand(
      refreshTokenDto.refreshToken,
      req.sessionID || req.headers['x-session-id'],
      req.headers['x-correlation-id'],
      req.headers['x-causation-id'],
      req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'],
      req.headers['user-agent'],
    );

    return await this.commandBus.execute(command);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User logout',
    description:
      'Logout user and invalidate all refresh tokens across all devices',
  })
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Refresh token to identify user session',
    examples: {
      example1: {
        summary: 'User logout',
        description: 'Logout and revoke all user tokens',
        value: {
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
        },
        message: {
          type: 'string',
          example: 'Logout successful',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Invalid refresh token',
        },
        error: {
          type: 'string',
          example: 'Unauthorized',
        },
        statusCode: {
          type: 'number',
          example: 401,
        },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many logout attempts',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Too many requests',
        },
        error: {
          type: 'string',
          example: 'Too Many Requests',
        },
        statusCode: {
          type: 'number',
          example: 429,
        },
      },
    },
  })
  async logout(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; message: string }> {
    const command = new LogoutUserCommand(
      refreshTokenDto.refreshToken,
      req.sessionID || req.headers['x-session-id'],
      req.headers['x-correlation-id'],
      req.headers['x-causation-id'],
      req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'],
      req.headers['user-agent'],
    );

    return await this.commandBus.execute(command);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 signup attempts per 5 minutes
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'User signup',
    description: 'Create new user account and organization, returns JWT tokens',
  })
  @ApiBody({
    type: SignupDto,
    description: 'User signup information including organization details',
    examples: {
      example1: {
        summary: 'Complete signup',
        description: 'Create user account with organization',
        value: {
          email: 'admin@acme.com',
          password: 'SecurePassword123!',
          firstName: 'John',
          lastName: 'Doe',
          organizationName: 'Acme Corporation',
          organizationSlug: 'acme-corp',
          organizationDescription: 'A leading technology company',
          organizationWebsite: 'https://acme.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Signup successful',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Validation failed',
        },
        error: {
          type: 'string',
          example: 'Bad Request',
        },
        statusCode: {
          type: 'number',
          example: 400,
        },
        details: {
          type: 'array',
          example: [
            'Password must contain at least one uppercase letter',
            'Organization slug can only contain lowercase letters, numbers, and hyphens',
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists or organization slug taken',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Organization slug is not available',
        },
        error: {
          type: 'string',
          example: 'Conflict',
        },
        statusCode: {
          type: 'number',
          example: 409,
        },
        errors: {
          type: 'array',
          example: ['Organization slug is already taken'],
        },
        suggestions: {
          type: 'array',
          example: ['acme-corp-1', 'acme-corp-2', 'acme-corp-inc'],
        },
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Too many signup attempts',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Too many requests',
        },
        error: {
          type: 'string',
          example: 'Too Many Requests',
        },
        statusCode: {
          type: 'number',
          example: 429,
        },
      },
    },
  })
  async signup(
    @Body() signupDto: SignupDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<AuthResponseDto> {
    const command = new SignupUserCommand(
      signupDto,
      req.sessionID || req.headers['x-session-id'],
      req.headers['x-correlation-id'],
      req.headers['x-causation-id'],
      req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'],
      req.headers['user-agent'],
    );

    return await this.commandBus.execute(command);
  }
}
