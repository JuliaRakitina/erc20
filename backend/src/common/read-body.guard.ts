import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { validationError } from './api-error';

@Injectable()
export class ReadBodyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const isRead = request.method === 'GET' || request.method === 'HEAD';
    const hasBody =
      Number(request.headers['content-length'] ?? 0) > 0 ||
      request.headers['transfer-encoding'] !== undefined;
    if (isRead && hasBody) throw validationError();
    return true;
  }
}
