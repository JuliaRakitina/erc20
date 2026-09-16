import {
  WaitForTransactionReceiptTimeoutError,
  type TransactionReceipt,
} from 'viem';
import {
  config,
  confirmation,
  owner,
  receipt,
  recipient,
  transactionHash,
} from '../../test/fixtures';
import { ChainClients } from './chain-clients';
import { SignerPort } from './token.port';
import { ViemTokenAdapter } from './viem-token.adapter';

describe('Viem token adapter', () => {
  let clients: ChainClients;
  let signer: jest.Mocked<SignerPort>;
  let adapter: ViemTokenAdapter;

  beforeEach(() => {
    clients = new ChainClients(config);
    signer = {
      getAddress: jest.fn().mockResolvedValue(owner),
      send: jest.fn().mockResolvedValue(transactionHash),
    };
    adapter = new ViemTokenAdapter(config, clients, signer);
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses the same explicit configured URL for both clients', () => {
    expect(clients.public.transport.url).toBe(config.rpcUrl);
    expect(clients.wallet.transport.url).toBe(config.rpcUrl);
  });

  it('reads actual decimals and serializes total supply exactly', async () => {
    jest
      .spyOn(clients.public, 'readContract')
      .mockResolvedValueOnce('JToken')
      .mockResolvedValueOnce('JTK')
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(9007199254740993123456n);
    await expect(adapter.metadata()).resolves.toMatchObject({
      name: 'JToken',
      symbol: 'JTK',
      decimals: 6,
      totalSupplyBaseUnits: '9007199254740993123456',
      signerAddress: owner,
    });
  });

  it('selects balanceOf and allowance with correct address ordering', async () => {
    const read = jest
      .spyOn(clients.public, 'readContract')
      .mockResolvedValue(100n);
    await expect(adapter.balance(recipient)).resolves.toBe(100n);
    await expect(adapter.allowance(owner, recipient)).resolves.toBe(100n);
    expect(read).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: 'balanceOf', args: [recipient] }),
    );
    expect(read).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        functionName: 'allowance',
        args: [owner, recipient],
      }),
    );
  });

  it('waits for a successful receipt before returning a confirmed response', async () => {
    let finish!: (value: TransactionReceipt) => void;
    const pending = new Promise<TransactionReceipt>((resolve) => {
      finish = resolve;
    });
    const wait = jest
      .spyOn(clients.public, 'waitForTransactionReceipt')
      .mockReturnValue(pending);
    let settled = false;
    const result = adapter
      .execute({ functionName: 'transfer', args: [recipient, 1n] })
      .then((value) => {
        settled = true;
        return value;
      });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);
    expect(wait).toHaveBeenCalledWith({
      hash: transactionHash,
      confirmations: 1,
      timeout: 30000,
    });
    finish(receipt);
    await expect(result).resolves.toEqual(confirmation);
  });

  it('rejects a reverted receipt rather than reporting success', async () => {
    jest
      .spyOn(clients.public, 'waitForTransactionReceipt')
      .mockResolvedValue({ ...receipt, status: 'reverted' });
    await expect(
      adapter.execute({ functionName: 'mint', args: [recipient, 1n] }),
    ).rejects.toMatchObject({
      status: 422,
      response: { error: { code: 'TRANSACTION_REVERTED', transactionHash } },
    });
  });

  it('returns the submitted hash when confirmation times out', async () => {
    jest
      .spyOn(clients.public, 'waitForTransactionReceipt')
      .mockRejectedValue(
        new WaitForTransactionReceiptTimeoutError({ hash: transactionHash }),
      );
    await expect(
      adapter.execute({ functionName: 'mint', args: [recipient, 1n] }),
    ).rejects.toMatchObject({
      status: 504,
      response: { error: { code: 'CONFIRMATION_UNKNOWN', transactionHash } },
    });
  });

  it('retains the submitted hash if the provider fails while confirming', async () => {
    jest
      .spyOn(clients.public, 'waitForTransactionReceipt')
      .mockRejectedValue(new Error('untrusted-marker'));
    await expect(
      adapter.execute({ functionName: 'mint', args: [recipient, 1n] }),
    ).rejects.toMatchObject({
      status: 503,
      response: { error: { code: 'CONFIRMATION_UNKNOWN', transactionHash } },
    });
  });

  it('does not wait for a receipt when signer submission fails', async () => {
    signer.send.mockRejectedValue(new Error('submission failed'));
    const wait = jest.spyOn(clients.public, 'waitForTransactionReceipt');
    await expect(
      adapter.execute({ functionName: 'mint', args: [recipient, 1n] }),
    ).rejects.toThrow('submission failed');
    expect(wait).not.toHaveBeenCalled();
  });

  it('readiness checks chain, deployed code and contract reads', async () => {
    jest.spyOn(clients.public, 'getChainId').mockResolvedValue(31337);
    const code = jest
      .spyOn(clients.public, 'getCode')
      .mockResolvedValue('0x6000');
    const metadata = jest.spyOn(adapter, 'metadata').mockResolvedValue({
      name: 'JToken',
      symbol: 'JTK',
      decimals: 18,
      totalSupplyBaseUnits: '0',
      chainId: 31337,
      contractAddress: config.contractAddress,
      signerAddress: owner,
    });
    await expect(adapter.ready()).resolves.toBeUndefined();
    expect(code).toHaveBeenCalledWith({ address: config.contractAddress });
    expect(metadata).toHaveBeenCalledTimes(1);
  });

  it.each([
    { chainId: 1, code: '0x6000' as const },
    { chainId: 31337, code: '0x' as const },
    { chainId: 31337, code: undefined },
  ])('rejects readiness on chain or deployment mismatch %#', async (state) => {
    jest.spyOn(clients.public, 'getChainId').mockResolvedValue(state.chainId);
    jest.spyOn(clients.public, 'getCode').mockResolvedValue(state.code);
    await expect(adapter.ready()).rejects.toMatchObject({ status: 503 });
  });
});
