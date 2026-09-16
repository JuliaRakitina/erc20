import type { Address, Hash } from 'viem';

export type TokenWrite =
  | {
      functionName: 'transfer' | 'mint' | 'approve';
      args: readonly [Address, bigint];
    }
  | { functionName: 'transferFrom'; args: readonly [Address, Address, bigint] };

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  totalSupplyBaseUnits: string;
  chainId: number;
  contractAddress: Address;
  signerAddress: Address;
}

export interface Confirmation {
  transactionHash: Hash;
  status: 'success';
  blockNumber: string;
  actor: Address;
}

export abstract class SignerPort {
  abstract getAddress(): Promise<Address>;
  abstract send(command: TokenWrite): Promise<Hash>;
}

export abstract class TokenChainPort {
  abstract metadata(): Promise<TokenMetadata>;
  abstract balance(address: Address): Promise<bigint>;
  abstract allowance(owner: Address, spender: Address): Promise<bigint>;
  abstract execute(command: TokenWrite): Promise<Confirmation>;
  abstract ready(): Promise<void>;
}
