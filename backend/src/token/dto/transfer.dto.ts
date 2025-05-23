import {
    IsNotEmpty,
    IsString,
    IsEthereumAddress
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {IsDecimalString} from "../../utils/validators/is-decimal-string.validator";

export class TransferDto {
    @ApiProperty({
        example: '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835Cb2',
        description: 'Recipient address',
    })
    @IsEthereumAddress()
    to: string;

    @ApiProperty({ example: '100' })
    @IsDecimalString({ message: 'Amount must be a valid number string' })
    @IsString()
    @IsNotEmpty()
    @Transform(({ value }) => value.trim())
    amount: string;

    @ApiProperty({
        example:
            '0x59c6995e998f97a5a0044966f0945383f6e58f66a1a3c17f352ec9fcadc7f162',
        description: 'Private key of sender address',
    })
    @IsString()
    @IsNotEmpty()
    privateKey: string;
}

