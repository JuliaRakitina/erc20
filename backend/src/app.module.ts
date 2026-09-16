import { Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from './config/app.config';
import { HealthController } from './health.controller';
import { ChainClients } from './token/chain-clients';
import { HardhatLocalSigner } from './token/hardhat-local.signer';
import { TokenController } from './token/token.controller';
import { SignerPort, TokenChainPort } from './token/token.port';
import { TokenService } from './token/token.service';
import { ViemTokenAdapter } from './token/viem-token.adapter';

@Module({
  controllers: [TokenController, HealthController],
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    ChainClients,
    { provide: SignerPort, useClass: HardhatLocalSigner },
    { provide: TokenChainPort, useClass: ViemTokenAdapter },
    TokenService,
  ],
})
export class AppModule {}
