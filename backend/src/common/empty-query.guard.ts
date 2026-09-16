import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { validationError } from './api-error';

@Injectable()
export class EmptyQueryGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (Object.keys(request.query).length > 0) throw validationError();
    return true;
  }
}
