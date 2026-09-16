import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MetadataResponseDto {
  @ApiProperty() name!: string;
  @ApiProperty() symbol!: string;
  @ApiProperty({ example: 18 }) decimals!: number;
  @ApiProperty({ description: 'Integer string in base units' })
  totalSupplyBaseUnits!: string;
  @ApiProperty({ example: 31337 }) chainId!: number;
  @ApiProperty() contractAddress!: string;
  @ApiProperty({
    description: 'Configured local demo actor for all state changes',
  })
  signerAddress!: string;
}

export class BalanceResponseDto {
  @ApiProperty() address!: string;
  @ApiProperty({ description: 'Integer string in base units' })
  balanceBaseUnits!: string;
}

export class AllowanceResponseDto {
  @ApiProperty() owner!: string;
  @ApiProperty() spender!: string;
  @ApiProperty({ description: 'Integer string in base units' })
  allowanceBaseUnits!: string;
}

export class TransactionResponseDto {
  @ApiProperty() transactionHash!: string;
  @ApiProperty({ enum: ['success'] }) status!: 'success';
  @ApiProperty({ description: 'Confirmed block number as an integer string' })
  blockNumber!: string;
  @ApiProperty({ description: 'Configured demo signer address' })
  actor!: string;
  @ApiProperty({
    description: 'Requested positive integer string in base units',
  })
  amountBaseUnits!: string;
  @ApiPropertyOptional() from?: string;
  @ApiPropertyOptional() to?: string;
  @ApiPropertyOptional() spender?: string;
}

class ErrorDetailDto {
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiPropertyOptional({
    description:
      'Present if submitted; reconcile this transaction before retrying',
  })
  transactionHash?: string;
}

export class ErrorResponseDto {
  @ApiProperty({ type: ErrorDetailDto }) error!: ErrorDetailDto;
}
