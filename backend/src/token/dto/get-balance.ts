import {IsEthereumAddress, IsNotEmpty} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetBalanceDto {
    @ApiProperty({
        description: 'Ethereum address to get token balance for',
        example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    })
    @IsEthereumAddress()
    address: string;
}
