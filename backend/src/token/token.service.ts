import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Account,
  Abi,
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import { from, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import * as fs from 'fs';
import * as path from 'path';

import {
  ABI_FILE,
  CONTRACT_ADDRESS_FILE,
  ERROR_MESSAGES,
  PUBLIC_CLIENT_URL,
  SHARED_PATH,
  TOKEN_FUNCTIONS,
} from '../utils/constants';

import { MintDto } from './dto/mint.dto';
import { ApproveDto } from './dto/approve.dto';
import { TransferFromDto } from './dto/transfer-from.dto';

@Injectable()
export class TokenService {
  private readonly sharedPath = SHARED_PATH;

  private readonly abi: Abi = this.loadAbi();
  private readonly contractAddress = this.loadAddress();

  private readonly publicClient = createPublicClient({
    chain: hardhat,
    transport: http(PUBLIC_CLIENT_URL),
  });

  private loadAbi() {
    const filePath = path.join(this.sharedPath, ABI_FILE);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(ERROR_MESSAGES.ABI_NOT_FOUND);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  private loadAddress(): `0x${string}` {
    const filePath = path.join(this.sharedPath, CONTRACT_ADDRESS_FILE);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(ERROR_MESSAGES.CONTRACT_ADDRESS_MISSING);
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data.address;
  }

  getTokenInfo() {
    const name$ = from(
      this.publicClient.readContract({
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.NAME,
      }),
    );

    const symbol$ = from(
      this.publicClient.readContract({
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.SYMBOL,
      }),
    );

    const supply$ = from(
      this.publicClient.readContract({
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.TOTAL_SUPPLY,
      }) as Promise<bigint>,
    );

    return combineLatest([name$, symbol$, supply$]).pipe(
      map(([name, symbol, totalSupply]) => ({
        name,
        symbol,
        totalSupply: totalSupply.toString(),
      })),
    );
  }

  async getBalanceOf(address: `0x${string}`) {
    try {
      const balance = await this.publicClient.readContract({
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.BALANCE_OF,
        args: [address],
      });

      return {
        balance: (balance as bigint).toString(),
      };
    } catch (error: any) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_ADDRESS(address));
    }
  }

  async transferFrom({
    to,
    amount,
    privateKey,
  }: {
    to: `0x${string}`;
    amount: string;
    privateKey: `0x${string}`;
  }) {
    try {
      const account = privateKeyToAccount(privateKey);
      const from = account.address;

      if (to.toLowerCase() === from.toLowerCase()) {
        throw new BadRequestException(ERROR_MESSAGES.SAME_ADDRESS_TRANSFER);
      }

      const parsedAmount = BigInt(parseUnits(amount, 18));
      if (parsedAmount <= 0n) {
        throw new BadRequestException(ERROR_MESSAGES.AMOUNT_ZERO_OR_NEGATIVE);
      }

      const balanceRaw = await this.publicClient.readContract({
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.BALANCE_OF,
        args: [from],
      });

      const senderBalance = balanceRaw as bigint;

      if (senderBalance < parsedAmount) {
        throw new BadRequestException(ERROR_MESSAGES.INSUFFICIENT_BALANCE);
      }

      const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http(),
      });

      const hash = await walletClient.writeContract({
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.TRANSFER,
        args: [to, parsedAmount],
      });

      return { hash };
    } catch (error: any) {
      console.error(error);
      throw new BadRequestException(
        `${ERROR_MESSAGES.TRANSFER_FAILED}: ${error?.shortMessage || error?.message}`,
      );
    }
  }

  async mint({ to, amount, privateKey }: MintDto) {
    let account: Account;
    try {
      account = privateKeyToAccount(privateKey as `0x${string}`);
    } catch (e: any) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_PRIVATE_KEY);
    }

    const walletClient = createWalletClient({
      account,
      chain: hardhat,
      transport: http(),
    });

    const parsedAmount = BigInt(parseUnits(amount, 18));
    if (parsedAmount <= 0n) {
      throw new BadRequestException(ERROR_MESSAGES.AMOUNT_ZERO_OR_NEGATIVE);
    }

    try {
      const hash = await walletClient.writeContract({
        account,
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.MINT,
        args: [to, parsedAmount],
      });

      return { hash };
    } catch (error: any) {
      console.error(error);
      throw new BadRequestException(
        `${ERROR_MESSAGES.MINT_FAILED}: ${error?.shortMessage || error?.message}`,
      );
    }
  }

  async approve({ spender, amount, privateKey }: ApproveDto) {
    let account: Account;
    try {
      account = privateKeyToAccount(privateKey as `0x${string}`);
    } catch {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_PRIVATE_KEY);
    }

    const parsedAmount = BigInt(parseUnits(amount, 18));
    if (parsedAmount <= 0n) {
      throw new BadRequestException(ERROR_MESSAGES.AMOUNT_ZERO_OR_NEGATIVE);
    }

    try {
      const walletClient = createWalletClient({
        account,
        chain: hardhat,
        transport: http(),
      });

      const hash = await walletClient.writeContract({
        account,
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.APPROVE,
        args: [spender, parsedAmount],
      });

      return { hash };
    } catch (error: any) {
      console.error(error);
      throw new BadRequestException(
        `${ERROR_MESSAGES.TRANSFER_FAILED}: ${error?.shortMessage || error?.message}`,
      );
    }
  }

  async getAllowance(owner: `0x${string}`, spender: `0x${string}`) {
    try {
      const allowance = await this.publicClient.readContract({
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.ALLOWANCE,
        args: [owner, spender],
      });

      return { allowance: (allowance as bigint).toString() };
    } catch (error: any) {
      console.error(error);
      throw new BadRequestException(
        ERROR_MESSAGES.INVALID_ADDRESS(`${owner}, ${spender}`),
      );
    }
  }

  async transferFromBySpender({
    from,
    to,
    amount,
    privateKey,
  }: TransferFromDto) {
    let spender: Account;
    try {
      spender = privateKeyToAccount(privateKey as `0x${string}`);
    } catch {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_PRIVATE_KEY);
    }

    const parsedAmount = BigInt(parseUnits(amount, 18));
    if (parsedAmount <= 0n) {
      throw new BadRequestException(ERROR_MESSAGES.AMOUNT_ZERO_OR_NEGATIVE);
    }

    const [allowance, ownerBalance] = await Promise.all([
      this.publicClient.readContract({
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.ALLOWANCE,
        args: [from, spender.address],
      }),
      this.publicClient.readContract({
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.BALANCE_OF,
        args: [from],
      }),
    ]);

    if ((allowance as bigint) < parsedAmount) {
      throw new BadRequestException(ERROR_MESSAGES.ALLOWANCE_TOO_LOW);
    }

    if ((ownerBalance as bigint) < parsedAmount) {
      throw new BadRequestException(ERROR_MESSAGES.NOT_ENOUGH_TOKENS);
    }

    const walletClient = createWalletClient({
      account: spender,
      chain: hardhat,
      transport: http(),
    });

    try {
      const hash = await walletClient.writeContract({
        account: spender,
        abi: this.abi,
        address: this.contractAddress,
        functionName: TOKEN_FUNCTIONS.TRANSFER_FROM,
        args: [from, to, parsedAmount],
      });

      return { hash };
    } catch (error: any) {
      throw new BadRequestException(
        `${ERROR_MESSAGES.TRANSFER_FAILED}: ${error?.shortMessage || error?.message}`,
      );
    }
  }
}
