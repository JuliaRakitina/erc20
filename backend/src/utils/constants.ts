import path from 'path';
import fs from 'fs';

const filePath = path.join(__dirname, '../../../smart-contract/deployed/contract-address.json');

let address: string;
export const DEFAULT_ADDRESS = '0x0000000000000000000000000000000000000000'

if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    address = parsed.address;
} else {
    console.warn('[WARN] Contract address file not found. Did you forget to deploy the contract?');
    address = DEFAULT_ADDRESS;
}


export const CONTRACT_ADDRESS = address as `0x${string}`;

export const TOKEN_FUNCTIONS = {
    NAME: 'name',
    SYMBOL: 'symbol',
    TOTAL_SUPPLY: 'totalSupply',
    BALANCE_OF: 'balanceOf',
    TRANSFER: 'transfer',
};

export const ERROR_MESSAGES = {
    CONTRACT_MISSING: 'Token contract is not deployed or address is missing.',
};