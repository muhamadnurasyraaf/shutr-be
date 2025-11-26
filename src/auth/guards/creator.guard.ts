// src/auth/guards/creator.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class CreatorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (user.type !== 'Creator') {
      throw new ForbiddenException(
        'Access denied. Only creators can access this resource.',
      );
    }

    return true;
  }
}
