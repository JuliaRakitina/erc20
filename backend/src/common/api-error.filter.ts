import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { toApiError } from './api-error';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const error = toApiError(exception);
    // Log only our own bounded status code, never bodies, URLs, provider errors,
    // stack traces, or signed transaction data supplied by another system.
    this.logger.warn(
      JSON.stringify({ event: 'request_failed', status: error.getStatus() }),
    );
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(error.getStatus())
      .json(error.getResponse());
  }
}
