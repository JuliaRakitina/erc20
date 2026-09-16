import { Inject, Injectable } from '@nestjs/common';
import { createPublicClient, createWalletClient, http } from 'viem';
import { hardhat } from 'viem/chains';
import { APP_CONFIG, type AppConfig } from '../config/app.config';

@Injectable()
export class ChainClients {
  readonly public;
  readonly wallet;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    const options = { timeout: 5_000, retryCount: 0 } as const;
    this.public = createPublicClient({
      chain: hardhat,
      transport: http(config.rpcUrl, options),
      pollingInterval: 250,
    });
    this.wallet = createWalletClient({
      chain: hardhat,
      transport: http(config.rpcUrl, options),
    });
  }
}
