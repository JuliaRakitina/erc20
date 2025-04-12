import { Injectable } from '@nestjs/common';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import { abi } from './abi/jtoken-abi';
import * as dotenv from 'dotenv';
import { CONTRACT_ADDRESS } from '../utils/constants';

dotenv.config();

const contractAddress = CONTRACT_ADDRESS;

@Injectable()
export class TokenService {
  private readonly publicClient = createPublicClient({
    chain: hardhat,
    transport: http(),
  });

  async getTokenInfo() {
    const [name, symbol, totalSupply] = await Promise.all([
      this.publicClient.readContract({
        abi,
        address: contractAddress,
        functionName: 'name',
      }),
      this.publicClient.readContract({
        abi,
        address: contractAddress,
        functionName: 'symbol',
      }),
      this.publicClient.readContract({
        abi,
        address: contractAddress,
        functionName: 'totalSupply',
      }),
    ]);

    return { name, symbol, totalSupply };
  }

  async getBalanceOf(address: `0x${string}`) {
    return await this.publicClient.readContract({
      abi,
      address: contractAddress,
      functionName: 'balanceOf',
      args: [address],
    });
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
      functionName: 'transfer',
      args: [to, parseUnits(amount, 18)],
    });

    return { hash };
  }
}
