import { Injectable } from '@nestjs/common';
import { getAddress, isAddress, type Address } from 'viem';
import { validationError } from '../common/api-error';
import {
  ApproveDto,
  isPositiveBaseUnits,
  MintDto,
  TransferDto,
  TransferFromDto,
} from './dto/token.dto';
import { TokenChainPort, type TokenWrite } from './token.port';

function address(value: string): Address {
  if (!isAddress(value, { strict: false })) throw validationError();
  return getAddress(value);
}

function amount(value: string): bigint {
  if (!isPositiveBaseUnits(value)) throw validationError();
  return BigInt(value);
}

@Injectable()
export class TokenService {
  constructor(private readonly chain: TokenChainPort) {}

  metadata() {
    return this.chain.metadata();
  }

  async balance(value: string) {
    const owner = address(value);
    const balance = await this.chain.balance(owner);
    return { address: owner, balanceBaseUnits: balance.toString() };
  }

  async allowance(ownerValue: string, spenderValue: string) {
    const owner = address(ownerValue);
    const spender = address(spenderValue);
    const allowance = await this.chain.allowance(owner, spender);
    return { owner, spender, allowanceBaseUnits: allowance.toString() };
  }

  async transfer(dto: TransferDto) {
    const to = address(dto.to);
    return this.write(
      { functionName: 'transfer', args: [to, amount(dto.amountBaseUnits)] },
      dto.amountBaseUnits,
      { to },
    );
  }

  async mint(dto: MintDto) {
    const to = address(dto.to);
    return this.write(
      { functionName: 'mint', args: [to, amount(dto.amountBaseUnits)] },
      dto.amountBaseUnits,
      { to },
    );
  }

  async approve(dto: ApproveDto) {
    const spender = address(dto.spender);
    return this.write(
      { functionName: 'approve', args: [spender, amount(dto.amountBaseUnits)] },
      dto.amountBaseUnits,
      { spender },
    );
  }

  async transferFrom(dto: TransferFromDto) {
    const from = address(dto.from);
    const to = address(dto.to);
    return this.write(
      {
        functionName: 'transferFrom',
        args: [from, to, amount(dto.amountBaseUnits)],
      },
      dto.amountBaseUnits,
      { from, to },
    );
  }

  private async write(
    command: TokenWrite,
    amountBaseUnits: string,
    addresses: { from?: Address; to?: Address; spender?: Address },
  ) {
    const confirmation = await this.chain.execute(command);
    return { ...confirmation, amountBaseUnits, ...addresses };
  }
}
