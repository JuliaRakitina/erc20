import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from './token/dto/token-response.dto';
import { TokenChainPort } from './token/token.port';
import { EmptyQueryGuard } from './common/empty-query.guard';

@ApiTags('Health')
@Controller('health')
@UseGuards(EmptyQueryGuard)
export class HealthController {
  constructor(private readonly chain: TokenChainPort) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness; no chain dependency' })
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({
    summary:
      'Verify live chain ID, deployed token code, token reads and signer availability',
  })
  @ApiResponse({ status: 503, type: ErrorResponseDto })
  async ready() {
    await this.chain.ready();
    return { status: 'ready' };
  }
}
