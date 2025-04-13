import { IsNotEmpty, IsString, IsEthereumAddress } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferDto {
    @ApiProperty({
        example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        description: 'Sender address (must start with 0x)',
    })
    @IsEthereumAddress()
    from: string;

    @ApiProperty({
        example: '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835Cb2',
        description: 'Recipient address (must start with 0x)',
    })
    @IsEthereumAddress()
    to: string;

    @ApiProperty({
        example: '100',
        description: 'Amount of tokens to transfer (as string, in whole tokens)',
    })
    @IsString()
    @IsNotEmpty()
    amount: string;

    @ApiProperty({
        example:
            '0x59c6995e998f97a5a0044966f0945383f6e58f66a1a3c17f352ec9fcadc7f162',
        description:
            'Private key of sender address (must start with 0x). Do not use in production!',
    })
    @IsString()
    @IsNotEmpty()
    privateKey: string;
}
