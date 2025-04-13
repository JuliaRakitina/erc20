import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {IsDecimalString} from "../../utils/validators/is-decimal-string.validator";

export class MintDto {
    @ApiProperty({
        example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        description: 'Recipient address',
    })
    @IsEthereumAddress()
    to: string;

    @ApiProperty({ example: '100', description: 'Amount of tokens to mint' })
    @IsDecimalString({ message: 'Amount must be a valid number string' })
    @IsString()
    @IsNotEmpty()
    amount: string;

    @ApiProperty({
        example:
            '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
        description: 'Private key of the contract owner',
    })
    @IsString()
    @IsNotEmpty()
    privateKey: string;
}
