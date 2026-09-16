import { HttpException } from '@nestjs/common';
import {
  BaseError,
  ChainMismatchError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  ExecutionRevertedError,
  HttpRequestError,
  RpcRequestError,
  TimeoutError,
  type Hash,
} from 'viem';

export class ApiError extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    transactionHash?: Hash,
  ) {
    super(
      {
        error: {
          code,
          message,
          ...(transactionHash ? { transactionHash } : {}),
        },
      },
      status,
    );
  }
}

export function validationError(): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed');
}

export function unavailable(): ApiError {
  return new ApiError(
    503,
    'CHAIN_UNAVAILABLE',
    'Local token service is not ready',
  );
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && 'type' in error && 'status' in error) {
    if (error.type === 'entity.too.large' && error.status === 413) {
      return new ApiError(
        413,
        'PAYLOAD_TOO_LARGE',
        'Request body is too large',
      );
    }
    if (error.type === 'entity.parse.failed' && error.status === 400) {
      return validationError();
    }
  }
  if (error instanceof BaseError) {
    const reverted = error.walk(
      (cause) => cause instanceof ContractFunctionRevertedError,
    );
    if (reverted instanceof ContractFunctionRevertedError) {
      if (reverted.data?.errorName === 'OwnableUnauthorizedAccount') {
        return new ApiError(
          403,
          'FORBIDDEN',
          'Configured signer is not the token owner',
        );
      }
      const code = reverted.data?.errorName;
      const message =
        code === 'ERC20InsufficientAllowance'
          ? 'Insufficient token allowance'
          : code === 'ERC20InsufficientBalance'
            ? 'Insufficient token balance'
            : 'Token transaction reverted';
      return new ApiError(422, 'TRANSACTION_REVERTED', message);
    }
    if (
      error.walk((cause) => cause instanceof ExecutionRevertedError) instanceof
      ExecutionRevertedError
    ) {
      return new ApiError(
        422,
        'TRANSACTION_REVERTED',
        'Token transaction reverted',
      );
    }
    const transport = error.walk(
      (cause) =>
        cause instanceof HttpRequestError ||
        cause instanceof RpcRequestError ||
        cause instanceof TimeoutError ||
        cause instanceof ChainMismatchError ||
        cause instanceof ContractFunctionZeroDataError,
    );
    if (
      transport instanceof HttpRequestError ||
      transport instanceof RpcRequestError ||
      transport instanceof TimeoutError ||
      transport instanceof ChainMismatchError ||
      transport instanceof ContractFunctionZeroDataError
    ) {
      return unavailable();
    }
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    if (status === 400) return validationError();
    if (status === 404) {
      return new ApiError(404, 'NOT_FOUND', 'Route not found');
    }
    if (status === 413) {
      return new ApiError(
        413,
        'PAYLOAD_TOO_LARGE',
        'Request body is too large',
      );
    }
  }
  return new ApiError(500, 'INTERNAL_ERROR', 'Unexpected service error');
}
