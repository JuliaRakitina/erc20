import { IsEthereumAddress } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetAllowanceDto {
    @ApiProperty({
        example: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        description: 'Token owner address',
    })
    @IsEthereumAddress()
    owner: string;

    @ApiProperty({
        example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        description: 'Spender address',
    })
    @IsEthereumAddress()
    spender: string;
}
