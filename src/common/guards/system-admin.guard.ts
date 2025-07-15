import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from './jwt-auth.guard';
import { UserRole } from '@db';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class SystemAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user has admin role
    if (user.role !== UserRole.SYSTEM_ADMIN) {
      throw new ForbiddenException('System Admin privileges required');
    }

    return true;
  }
}
