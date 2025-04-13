import { IsEthereumAddress, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsDecimalString } from '../../utils/validators/is-decimal-string.validator';

export class TransferFromDto {
    @ApiProperty({
        example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        description: 'Owner address (who owns the tokens)',
    })
    @IsEthereumAddress()
    from: string;

    @ApiProperty({
        example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        description: 'Recipient address (who will receive the tokens)',
    })
    @IsEthereumAddress()
    to: string;

    @ApiProperty({ example: '10', description: 'Amount of tokens to transfer' })
    @IsString()
    @IsNotEmpty()
    @IsDecimalString()
    amount: string;

    @ApiProperty({
        example:
            '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
        description: 'Private key of the spender (who was approved)',
    })
    @IsString()
    @IsNotEmpty()
    privateKey: string;
}
