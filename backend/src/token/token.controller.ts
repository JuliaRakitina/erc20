import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AllowanceQueryDto,
  ApproveDto,
  BalanceQueryDto,
  MintDto,
  TransferDto,
  TransferFromDto,
} from './dto/token.dto';
import {
  AllowanceResponseDto,
  BalanceResponseDto,
  ErrorResponseDto,
  MetadataResponseDto,
  TransactionResponseDto,
} from './dto/token-response.dto';
import { TokenService } from './token.service';
import { EmptyQueryGuard } from '../common/empty-query.guard';

@ApiTags('Local demo token')
@ApiResponse({
  status: 400,
  type: ErrorResponseDto,
  description: 'Invalid request',
})
@ApiResponse({
  status: 403,
  type: ErrorResponseDto,
  description: 'Signer is not the contract owner',
})
@ApiResponse({
  status: 422,
  type: ErrorResponseDto,
  description: 'Contract rejected transaction',
})
@ApiResponse({
  status: 503,
  type: ErrorResponseDto,
  description:
    'Local chain unavailable; a submitted transaction hash may be included',
})
@ApiResponse({
  status: 504,
  type: ErrorResponseDto,
  description:
    'Confirmation timed out; reconcile returned transaction hash before retrying',
})
@Controller('api/v1/token')
export class TokenController {
  constructor(private readonly service: TokenService) {}

  @Get('metadata')
  @UseGuards(EmptyQueryGuard)
  @ApiOperation({ summary: 'Read token metadata and configured demo signer' })
  @ApiResponse({ status: 200, type: MetadataResponseDto })
  metadata() {
    return this.service.metadata();
  }

  @Get('balance')
  @ApiOperation({ summary: 'Read balance in base units' })
  @ApiResponse({ status: 200, type: BalanceResponseDto })
  balance(@Query() query: BalanceQueryDto) {
    return this.service.balance(query.address);
  }

  @Get('allowance')
  @ApiOperation({ summary: 'Read allowance in base units' })
  @ApiResponse({ status: 200, type: AllowanceResponseDto })
  allowance(@Query() query: AllowanceQueryDto) {
    return this.service.allowance(query.owner, query.spender);
  }

  @Post('transfer')
  @UseGuards(EmptyQueryGuard)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Transfer from the configured demo signer; await confirmation',
  })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  transfer(@Body() dto: TransferDto) {
    return this.service.transfer(dto);
  }

  @Post('mint')
  @UseGuards(EmptyQueryGuard)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Mint as the configured demo signer (owner required); await confirmation',
  })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  mint(@Body() dto: MintDto) {
    return this.service.mint(dto);
  }

  @Post('approve')
  @UseGuards(EmptyQueryGuard)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Approve spending from the configured demo signer; await confirmation',
  })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  approve(@Body() dto: ApproveDto) {
    return this.service.approve(dto);
  }

  @Post('transfer-from')
  @UseGuards(EmptyQueryGuard)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Spend allowance as configured spender, from owner to recipient; await confirmation',
  })
  @ApiResponse({ status: 200, type: TransactionResponseDto })
  transferFrom(@Body() dto: TransferFromDto) {
    return this.service.transferFrom(dto);
  }
}
