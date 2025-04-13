import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
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

dotenv.config();

const contractAddress = CONTRACT_ADDRESS;

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
      throw new BadRequestException(
          `Invalid or unrecognized address: ${address}`,
      );
    }
  }

  async transferFrom({
    from,
    to,
    amount,
    privateKey,
  }: {
    from: `0x${string}`;
    to: `0x${string}`;
    amount: string;
    privateKey: `0x${string}`;
  }) {
    const account = privateKeyToAccount(privateKey);

    const walletClient = createWalletClient({
      account,
      chain: hardhat,
      transport: http(),
    });

    const hash = await walletClient.writeContract({
      abi,
      address: contractAddress,
      functionName: TOKEN_FUNCTIONS.TRANSFER,
      args: [to, parseUnits(amount, 18)],
    });

    return { hash };
  }
}
