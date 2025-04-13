import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { TokenService } from './token.service';
import { TransferDto } from './dto/transfer.dto';
import {ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery} from '@nestjs/swagger';
import { GetBalanceDto } from './dto/get-balance';
import { MintDto } from './dto/mint.dto';
import { ApproveDto } from './dto/approve.dto';
import {GetAllowanceDto} from "./dto/get-allowance.dto";

@ApiTags('Token')
@Controller('token')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Get('info')
  @ApiOperation({ summary: 'Get token name, symbol, and totalSupply' })
  @ApiResponse({ status: 200, description: 'Token info returned successfully' })
  getTokenInfo() {
    return this.tokenService.getTokenInfo();
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get token balance for an address' })
  @ApiResponse({
    status: 200,
    description: 'Returns token balance of the given address',
    schema: {
      example: {
        balance: '1000000000000000000000',
      },
    },
  })
  getBalance(
    @Query(new ValidationPipe({ transform: true })) query: GetBalanceDto,
  ) {
    return this.tokenService.getBalanceOf(query.address as `0x${string}`);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfer tokens from one address to another' })
  @ApiResponse({
    status: 200,
    description: 'Transfer successful',
    schema: {
      example: {
        hash: '0xabcdef1234567890deadbeef...',
      },
    },
  })
  @ApiBody({ type: TransferDto })
  transfer(
    @Body(new ValidationPipe({ transform: true }))
    dto: TransferDto,
  ) {
    return this.tokenService.transferFrom({
      to: dto.to as `0x${string}`,
      amount: dto.amount,
      privateKey: dto.privateKey as `0x${string}`,
    });
  }

  @Post('mint')
  @ApiOperation({ summary: 'Mint tokens (only owner)' })
  @ApiBody({ type: MintDto })
  @ApiResponse({
    status: 200,
    description: 'Mint successful',
    schema: {
      example: { hash: '0x123...' },
    },
  })
  mint(@Body(new ValidationPipe({ transform: true })) dto: MintDto) {
    return this.tokenService.mint(dto);
  }

  @Post('approve')
  @ApiOperation({ summary: 'Approve a spender to use tokens on your behalf' })
  @ApiBody({ type: ApproveDto })
  @ApiResponse({
    status: 200,
    description: 'Approval successful',
    schema: { example: { hash: '0x123...' } },
  })
  approve(
    @Body(new ValidationPipe({ transform: true }))
    dto: ApproveDto,
  ) {
    return this.tokenService.approve(dto);
  }

  @Get('allowance')
  @ApiOperation({ summary: 'Check how many tokens a spender is allowed to use' })
  @ApiResponse({
    status: 200,
    schema: {
      example: { allowance: '5000000000000000000' },
    },
  })
  getAllowance(
      @Query(new ValidationPipe({ transform: true })) query: GetAllowanceDto,
  ) {
    return this.tokenService.getAllowance(
        query.owner as `0x${string}`,
        query.spender as `0x${string}`,
    );
  }


}
