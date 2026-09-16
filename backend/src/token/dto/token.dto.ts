import { ApiProperty } from '@nestjs/swagger';
import {
  IsEthereumAddress,
  IsString,
  registerDecorator,
} from 'class-validator';
import { maxUint256 } from 'viem';

export function isPositiveBaseUnits(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]{0,77}$/.test(value) &&
    BigInt(value) <= maxUint256
  );
}

function IsBaseUnits(): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isBaseUnits',
      target: target.constructor,
      propertyName: String(propertyKey),
      validator: {
        validate: isPositiveBaseUnits,
        defaultMessage: () => 'Invalid base-unit amount',
      },
    });
  };
}

export class AmountDto {
  @ApiProperty({
    type: String,
    example: '1000000000000000000',
    description:
      'Positive integer string in token base units (uint256). No decimals, exponent notation or leading zeros.',
    pattern: '^[1-9][0-9]{0,77}$',
    maxLength: 78,
  })
  @IsString()
  @IsBaseUnits()
  amountBaseUnits!: string;
}

export class TransferDto extends AmountDto {
  @ApiProperty({
    description: 'Recipient Ethereum address',
    example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  })
  @IsEthereumAddress()
  to!: string;
}

export class MintDto extends TransferDto {}

export class ApproveDto extends AmountDto {
  @ApiProperty({
    description: 'Spender Ethereum address',
    example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  })
  @IsEthereumAddress()
  spender!: string;
}

export class TransferFromDto extends TransferDto {
  @ApiProperty({
    description: 'Token owner who approved the configured signer',
    example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  })
  @IsEthereumAddress()
  from!: string;
}

export class BalanceQueryDto {
  @ApiProperty({
    description: 'Ethereum address to read',
    example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  })
  @IsEthereumAddress()
  address!: string;
}

export class AllowanceQueryDto {
  @ApiProperty({ description: 'Token owner Ethereum address' })
  @IsEthereumAddress()
  owner!: string;

  @ApiProperty({ description: 'Spender Ethereum address' })
  @IsEthereumAddress()
  spender!: string;
}
