import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Account,
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import { abi } from './abi/jtoken-abi';
import { from, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import * as dotenv from 'dotenv';
import {
  CONTRACT_ADDRESS,
  DEFAULT_ADDRESS,
  ERROR_MESSAGES,
  TOKEN_FUNCTIONS,
} from '../utils/constants';
import { MintDto } from './dto/mint.dto';
import { ApproveDto } from './dto/approve.dto';

dotenv.config();

@Injectable()
export class TokenService {
  private readonly publicClient = createPublicClient({
    chain: hardhat,
    transport: http(),
  });

  private checkAddress() {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === DEFAULT_ADDRESS) {
      throw new NotFoundException(ERROR_MESSAGES.CONTRACT_MISSING);
    }
  }

  getTokenInfo() {
    this.checkAddress();

    const name$ = from(
      this.publicClient.readContract({
        abi,
        address: CONTRACT_ADDRESS!,
        functionName: TOKEN_FUNCTIONS.NAME,
      }),
    );

    const symbol$ = from(
      this.publicClient.readContract({
        abi,
        address: CONTRACT_ADDRESS!,
        functionName: TOKEN_FUNCTIONS.SYMBOL,
      }),
    );

    const supply$ = from(
      this.publicClient.readContract({
        abi,
        address: CONTRACT_ADDRESS!,
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
    this.checkAddress();

    try {
      const balance = await this.publicClient.readContract({
        abi,
        address: CONTRACT_ADDRESS!,
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
    this.checkAddress();

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
        abi,
        address: CONTRACT_ADDRESS!,
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
        abi,
        address: CONTRACT_ADDRESS!,
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
    this.checkAddress();

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
        abi,
        address: CONTRACT_ADDRESS!,
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
    this.checkAddress();

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
        abi,
        address: CONTRACT_ADDRESS!,
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
}
