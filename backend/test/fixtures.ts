import type { Address, Hash, TransactionReceipt } from 'viem';
import type { AppConfig } from '../src/config/app.config';
import type {
  Confirmation,
  TokenMetadata,
  TokenWrite,
} from '../src/token/token.port';

export const owner: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
export const recipient: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
export const contractAddress: Address =
  '0x5FbDB2315678afecb367f032d93F642f64180aa3';
export const transactionHash: Hash = `0x${'ab'.repeat(32)}`;

export const config: AppConfig = {
  rpcUrl: 'http://127.0.0.1:8545/',
  chainId: 31337,
  contractAddress,
  signerAccountIndex: 0,
  port: 3000,
  host: '127.0.0.1',
};

export const metadata: TokenMetadata = {
  name: 'JToken',
  symbol: 'JTK',
  decimals: 18,
  totalSupplyBaseUnits: '0',
  chainId: 31337,
  contractAddress,
  signerAddress: owner,
};

export const confirmation: Confirmation = {
  transactionHash,
  status: 'success',
  blockNumber: '42',
  actor: owner,
};

export const receipt: TransactionReceipt = {
  blockHash: transactionHash,
  blockNumber: 42n,
  contractAddress: null,
  cumulativeGasUsed: 50000n,
  effectiveGasPrice: 1n,
  from: owner,
  gasUsed: 50000n,
  logs: [],
  logsBloom: '0x',
  status: 'success',
  to: contractAddress,
  transactionHash,
  transactionIndex: 0,
  type: 'eip1559',
};

export function chainMock() {
  return {
    metadata: jest.fn<Promise<TokenMetadata>, []>().mockResolvedValue(metadata),
    balance: jest
      .fn<Promise<bigint>, [Address]>()
      .mockResolvedValue(90071992547409930000001n),
    allowance: jest
      .fn<Promise<bigint>, [Address, Address]>()
      .mockResolvedValue(90071992547409930000002n),
    execute: jest
      .fn<Promise<Confirmation>, [TokenWrite]>()
      .mockResolvedValue(confirmation),
    ready: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  };
}
