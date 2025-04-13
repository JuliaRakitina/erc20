import {Controller, Get, Post, Body, Query, ValidationPipe} from '@nestjs/common';
import { TokenService } from './token.service';
import { TransferDto } from './dto/transfer.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import {GetBalanceDto} from "./dto/get-balance";

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
  @ApiBody({ type: TransferDto })
  @ApiResponse({ status: 200, description: 'Transfer successful' })
  transfer(@Body() dto: TransferDto) {
    return this.tokenService.transferFrom({
      from: dto.from as `0x${string}`,
      to: dto.to as `0x${string}`,
      privateKey: dto.privateKey as `0x${string}`,
      amount: dto.amount,
    });
  }
}
