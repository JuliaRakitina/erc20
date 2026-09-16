import { Inject, Injectable } from '@nestjs/common';
import { WaitForTransactionReceiptTimeoutError, type Address } from 'viem';
import { APP_CONFIG, type AppConfig } from '../config/app.config';
import { ApiError, unavailable } from '../common/api-error';
import { ChainClients } from './chain-clients';
import { tokenAbi } from './token.abi';
import {
  SignerPort,
  TokenChainPort,
  type Confirmation,
  type TokenMetadata,
  type TokenWrite,
} from './token.port';

@Injectable()
export class ViemTokenAdapter extends TokenChainPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clients: ChainClients,
    private readonly signer: SignerPort,
  ) {
    super();
  }

  async metadata(): Promise<TokenMetadata> {
    const parameters = { address: this.config.contractAddress, abi: tokenAbi };
    const [name, symbol, decimals, supply, signerAddress] = await Promise.all([
      this.clients.public.readContract({ ...parameters, functionName: 'name' }),
      this.clients.public.readContract({
        ...parameters,
        functionName: 'symbol',
      }),
      this.clients.public.readContract({
        ...parameters,
        functionName: 'decimals',
      }),
      this.clients.public.readContract({
        ...parameters,
        functionName: 'totalSupply',
      }),
      this.signer.getAddress(),
    ]);
    return {
      name,
      symbol,
      decimals,
      totalSupplyBaseUnits: supply.toString(),
      chainId: this.config.chainId,
      contractAddress: this.config.contractAddress,
      signerAddress,
    };
  }

  balance(address: Address): Promise<bigint> {
    return this.clients.public.readContract({
      address: this.config.contractAddress,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [address],
    });
  }

  allowance(owner: Address, spender: Address): Promise<bigint> {
    return this.clients.public.readContract({
      address: this.config.contractAddress,
      abi: tokenAbi,
      functionName: 'allowance',
      args: [owner, spender],
    });
  }

  async execute(command: TokenWrite): Promise<Confirmation> {
    const actor = await this.signer.getAddress();
    const transactionHash = await this.signer.send(command);
    try {
      const receipt = await this.clients.public.waitForTransactionReceipt({
        hash: transactionHash,
        confirmations: 1,
        timeout: 30_000,
      });
      if (receipt.status !== 'success') {
        throw new ApiError(
          422,
          'TRANSACTION_REVERTED',
          'Token transaction reverted',
          transactionHash,
        );
      }
      return {
        transactionHash: receipt.transactionHash,
        status: 'success',
        blockNumber: receipt.blockNumber.toString(),
        actor,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // Submission may already have changed chain state. Always return its hash
      // when confirmation fails so the caller can reconcile before retrying.
      throw new ApiError(
        error instanceof WaitForTransactionReceiptTimeoutError ? 504 : 503,
        'CONFIRMATION_UNKNOWN',
        'Transaction submitted; confirmation unavailable. Check the hash before retrying',
        transactionHash,
      );
    }
  }

  async ready(): Promise<void> {
    try {
      const [chainId, code] = await Promise.all([
        this.clients.public.getChainId(),
        this.clients.public.getCode({ address: this.config.contractAddress }),
      ]);
      if (chainId !== this.config.chainId || !code || code === '0x')
        throw unavailable();
      await this.metadata();
    } catch {
      throw unavailable();
    }
  }
}
