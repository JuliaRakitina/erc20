import { Inject, Injectable } from '@nestjs/common';
import { getAddress, type Address, type Hash } from 'viem';
import { APP_CONFIG, type AppConfig } from '../config/app.config';
import { unavailable } from '../common/api-error';
import { ChainClients } from './chain-clients';
import { tokenAbi } from './token.abi';
import { SignerPort, type TokenWrite } from './token.port';

@Injectable()
export class HardhatLocalSigner extends SignerPort {
  private account: Address | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clients: ChainClients,
  ) {
    super();
  }

  async getAddress(): Promise<Address> {
    if (this.account) return this.account;
    const accounts = await this.clients.wallet.getAddresses();
    const account = accounts[this.config.signerAccountIndex];
    if (!account) throw unavailable();
    this.account = getAddress(account);
    return this.account;
  }

  async send(command: TokenWrite): Promise<Hash> {
    const [chainId, code] = await Promise.all([
      this.clients.public.getChainId(),
      this.clients.public.getCode({ address: this.config.contractAddress }),
    ]);
    if (chainId !== this.config.chainId || !code || code === '0x') {
      throw unavailable();
    }
    const account = await this.getAddress();
    const parameters = {
      address: this.config.contractAddress,
      abi: tokenAbi,
      account,
    };
    // Simulation decodes contract custom errors before submission. The JSON-RPC
    // node signs with its unlocked demo account; this process never receives keys.
    if (command.functionName === 'transferFrom') {
      await this.clients.public.simulateContract({ ...parameters, ...command });
      return this.clients.wallet.writeContract({ ...parameters, ...command });
    }
    await this.clients.public.simulateContract({ ...parameters, ...command });
    return this.clients.wallet.writeContract({ ...parameters, ...command });
  }
}
