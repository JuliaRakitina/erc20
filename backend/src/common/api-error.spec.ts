import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  HttpRequestError,
} from 'viem';
import { owner } from '../../test/fixtures';
import { tokenAbi } from '../token/token.abi';
import { toApiError } from './api-error';

describe('sanitized error mapping', () => {
  it('maps decoded owner authorization failure to 403', () => {
    const cause = new ContractFunctionRevertedError({
      abi: tokenAbi,
      functionName: 'mint',
      data: encodeErrorResult({
        abi: tokenAbi,
        errorName: 'OwnableUnauthorizedAccount',
        args: [owner],
      }),
    });
    const error = new ContractFunctionExecutionError(cause, {
      abi: tokenAbi,
      functionName: 'mint',
      args: [owner, 1n],
    });
    const result = toApiError(error);
    expect(result.getStatus()).toBe(403);
    expect(result.getResponse()).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'Configured signer is not the token owner',
      },
    });
  });

  it('maps decoded insufficient allowance to 422', () => {
    const error = new ContractFunctionRevertedError({
      abi: tokenAbi,
      functionName: 'transferFrom',
      data: encodeErrorResult({
        abi: tokenAbi,
        errorName: 'ERC20InsufficientAllowance',
        args: [owner, 1n, 2n],
      }),
    });
    expect(toApiError(error).getStatus()).toBe(422);
    expect(toApiError(error).getResponse()).toEqual({
      error: {
        code: 'TRANSACTION_REVERTED',
        message: 'Insufficient token allowance',
      },
    });
  });

  it('maps transport failures through Viem wrappers without revealing provider details', () => {
    const error = new BaseError('untrusted-marker', {
      cause: new HttpRequestError({
        url: 'http://provider.invalid/untrusted-marker',
        details: 'untrusted-marker',
      }),
    });
    const result = toApiError(error);
    expect(result.getStatus()).toBe(503);
    expect(JSON.stringify(result.getResponse())).not.toContain(
      'untrusted-marker',
    );
  });

  it('does not expose arbitrary errors or stack traces', () => {
    const result = toApiError(new Error('untrusted-marker'));
    expect(result.getStatus()).toBe(500);
    expect(result.getResponse()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected service error' },
    });
  });
});
