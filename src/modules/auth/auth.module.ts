import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { UserProfileController } from './controllers/user-profile.controller';

// Services
import { JwtService as CustomJwtService } from './services/jwt.service';
import { PasswordService } from './services/password.service';

// Command Handlers
import { LoginUserHandler } from './commands/handlers/login-user.handler';
import { LogoutUserHandler } from './commands/handlers/logout-user.handler';
import { RefreshTokensHandler } from './commands/handlers/refresh-tokens.handler';
import { SignupUserHandler } from './commands/handlers/signup-user.handler';

// Query Handlers
import { CheckOrganizationSlugAvailabilityHandler } from './queries/handlers/check-organization-slug-availability.handler';
import { ValidateOrganizationSlugHandler } from './queries/handlers/validate-organization-slug.handler';

// External modules
import { EventsModule } from '@events';
// Database module is provided globally via app.module.ts

const commandHandlers = [
  LoginUserHandler,
  LogoutUserHandler,
  RefreshTokensHandler,
  SignupUserHandler,
];

const queryHandlers = [
  CheckOrganizationSlugAvailabilityHandler,
  ValidateOrganizationSlugHandler,
];

@Module({
  imports: [
    CqrsModule,
    ConfigModule,
    EventsModule,
    JwtModule.register({}),
    ThrottlerModule,
  ],
  controllers: [AuthController, UserProfileController],
  providers: [
    CustomJwtService,
    PasswordService,
    ...commandHandlers,
    ...queryHandlers,
  ],
  exports: [CustomJwtService, PasswordService],
})
export class AuthModule {}
