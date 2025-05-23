import path from 'path';
import fs from 'fs';

const filePath = path.join(
  __dirname,
  '../../../smart-contract/deployed/contract-address.json',
);

let address: string;
export const DEFAULT_ADDRESS = '0x0000000000000000000000000000000000000000';

if (fs.existsSync(filePath)) {
  const data = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(data);
  address = parsed.address;
} else {
  console.warn(
    '[WARN] Contract address file not found. Did you forget to deploy the contract?',
  );
  address = DEFAULT_ADDRESS;
}

export const PUBLIC_CLIENT_URL = 'http://smart-contract:8545';

export const TOKEN_FUNCTIONS = {
  NAME: 'name',
  SYMBOL: 'symbol',
  TOTAL_SUPPLY: 'totalSupply',
  BALANCE_OF: 'balanceOf',
  TRANSFER: 'transfer',
  MINT: 'mint',
  APPROVE: 'approve',
  ALLOWANCE: 'allowance',
  TRANSFER_FROM: 'transferFrom',
};

export const ERROR_MESSAGES = {
  CONTRACT_MISSING: 'Token contract is not deployed or address is missing.',
  INVALID_PRIVATE_KEY: 'Invalid private key format',
  SAME_ADDRESS_TRANSFER: 'Cannot transfer to the same address',
  AMOUNT_ZERO_OR_NEGATIVE: 'Amount must be greater than zero',
  INSUFFICIENT_BALANCE: 'Sender does not have enough tokens',
  TRANSFER_FAILED: 'Transfer failed',
  MINT_FAILED: 'Mint failed',
  ALLOWANCE_TOO_LOW: 'Allowance to low',
  ABI_NOT_FOUND: 'ABI not found. Make sure contract is deployed.',
  CONTRACT_ADDRESS_MISSING: 'Contract address not found.',
  NOT_ENOUGH_TOKENS: 'Owner does not have enough tokens',
  INVALID_ADDRESS: (address: string) =>
    `Invalid or unrecognized address: ${address}`,
};

export const SHARED_PATH = '/shared';
export const ABI_FILE = 'abi.json';
export const CONTRACT_ADDRESS_FILE = 'contract-address.json';
