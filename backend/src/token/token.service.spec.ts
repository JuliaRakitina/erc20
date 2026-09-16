import { maxUint256 } from 'viem';
import { chainMock, confirmation, owner, recipient } from '../../test/fixtures';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const preciseAmount = '9007199254740993123456789';
  let chain: ReturnType<typeof chainMock>;
  let service: TokenService;

  beforeEach(() => {
    chain = chainMock();
    service = new TokenService(chain);
  });

  it('serializes large balance and allowance values without numeric conversion', async () => {
    await expect(service.balance(owner.toLowerCase())).resolves.toEqual({
      address: owner,
      balanceBaseUnits: '90071992547409930000001',
    });
    await expect(service.allowance(owner, recipient)).resolves.toEqual({
      owner,
      spender: recipient,
      allowanceBaseUnits: '90071992547409930000002',
    });
  });

  it.each(['transfer', 'mint'] as const)(
    'executes %s with normalized recipient and exact base units',
    async (operation) => {
      await expect(
        service[operation]({
          to: recipient.toLowerCase(),
          amountBaseUnits: preciseAmount,
        }),
      ).resolves.toEqual({
        ...confirmation,
        to: recipient,
        amountBaseUnits: preciseAmount,
      });
      expect(chain.execute).toHaveBeenCalledWith({
        functionName: operation,
        args: [recipient, BigInt(preciseAmount)],
      });
    },
  );

  it('approves the requested spender from the configured actor', async () => {
    await expect(
      service.approve({ spender: recipient, amountBaseUnits: preciseAmount }),
    ).resolves.toEqual({
      ...confirmation,
      spender: recipient,
      amountBaseUnits: preciseAmount,
    });
    expect(chain.execute).toHaveBeenCalledWith({
      functionName: 'approve',
      args: [recipient, BigInt(preciseAmount)],
    });
  });

  it('executes real transferFrom with owner, recipient, and exact amount', async () => {
    await expect(
      service.transferFrom({
        from: owner,
        to: recipient,
        amountBaseUnits: preciseAmount,
      }),
    ).resolves.toEqual({
      ...confirmation,
      from: owner,
      to: recipient,
      amountBaseUnits: preciseAmount,
    });
    expect(chain.execute).toHaveBeenCalledWith({
      functionName: 'transferFrom',
      args: [owner, recipient, BigInt(preciseAmount)],
    });
  });

  it.each([
    '0',
    '-1',
    '1.1',
    '01',
    '1e18',
    ' 1',
    '',
    (maxUint256 + 1n).toString(),
  ])(
    'rejects invalid amount %s before invoking chain',
    async (amountBaseUnits) => {
      await expect(
        service.transfer({ to: recipient, amountBaseUnits }),
      ).rejects.toMatchObject({ status: 400 });
      expect(chain.execute).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid addresses before invoking chain', async () => {
    await expect(service.balance('bad-address')).rejects.toMatchObject({
      status: 400,
    });
    expect(chain.balance).not.toHaveBeenCalled();
  });

  it('does not return success before the chain adapter confirms', async () => {
    chain.execute.mockRejectedValue(new Error('confirmation failure'));
    await expect(
      service.mint({ to: recipient, amountBaseUnits: '1' }),
    ).rejects.toThrow('confirmation failure');
  });
});
