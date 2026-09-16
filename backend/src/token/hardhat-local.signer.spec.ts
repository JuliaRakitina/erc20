import {
  config,
  contractAddress,
  owner,
  recipient,
  transactionHash,
} from '../../test/fixtures';
import { ChainClients } from './chain-clients';
import { HardhatLocalSigner } from './hardhat-local.signer';
import { tokenAbi } from './token.abi';
import type { TokenWrite } from './token.port';

describe('local signer boundary', () => {
  let clients: ChainClients;
  let signer: HardhatLocalSigner;

  beforeEach(() => {
    clients = new ChainClients(config);
    signer = new HardhatLocalSigner(
      { ...config, signerAccountIndex: 1 },
      clients,
    );
    jest.spyOn(clients.public, 'getChainId').mockResolvedValue(31337);
    jest.spyOn(clients.public, 'getCode').mockResolvedValue('0x6000');
    jest
      .spyOn(clients.wallet, 'getAddresses')
      .mockResolvedValue([owner, recipient]);
  });

  afterEach(() => jest.restoreAllMocks());

  it('selects the configured unlocked RPC account without handling signing keys', async () => {
    await expect(signer.getAddress()).resolves.toBe(recipient);
  });

  it('fails when configured unlocked account is unavailable', async () => {
    jest.spyOn(clients.wallet, 'getAddresses').mockResolvedValue([]);
    await expect(signer.getAddress()).rejects.toMatchObject({ status: 503 });
  });

  it('refuses writes if the RPC chain changes after startup', async () => {
    jest.spyOn(clients.public, 'getChainId').mockResolvedValue(1);
    const write = jest.spyOn(clients.wallet, 'writeContract');
    await expect(
      signer.send({ functionName: 'mint', args: [recipient, 1n] }),
    ).rejects.toMatchObject({ status: 503 });
    expect(write).not.toHaveBeenCalled();
  });

  it('refuses mint after a local chain restart removes deployed code', async () => {
    jest.spyOn(clients.public, 'getCode').mockResolvedValue('0x');
    const simulate = jest.spyOn(clients.public, 'simulateContract');
    const write = jest.spyOn(clients.wallet, 'writeContract');
    await expect(
      signer.send({ functionName: 'mint', args: [recipient, 1n] }),
    ).rejects.toMatchObject({ status: 503 });
    expect(simulate).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  const commands: TokenWrite[] = [
    { functionName: 'transfer', args: [owner, 7n] },
    { functionName: 'mint', args: [owner, 7n] },
    { functionName: 'approve', args: [owner, 7n] },
    { functionName: 'transferFrom', args: [owner, recipient, 7n] },
  ];

  it.each(commands)(
    'simulates and submits $functionName with configured actor',
    async (command) => {
      // This adapter deliberately ignores simulation output. Viem's generic
      // overload resolves to never in Jest's ReturnType extraction.
      const simulate = jest
        .spyOn(clients.public, 'simulateContract')
        .mockResolvedValue(undefined as never);
      const write = jest
        .spyOn(clients.wallet, 'writeContract')
        .mockResolvedValue(transactionHash);
      await expect(signer.send(command)).resolves.toBe(transactionHash);
      const expected = {
        abi: tokenAbi,
        address: contractAddress,
        account: recipient,
        ...command,
      };
      expect(simulate).toHaveBeenCalledWith(expected);
      expect(write).toHaveBeenCalledWith(expected);
      expect(simulate.mock.invocationCallOrder[0]).toBeLessThan(
        write.mock.invocationCallOrder[0] ?? 0,
      );
    },
  );

  it('does not submit a transaction when simulation rejects it', async () => {
    jest
      .spyOn(clients.public, 'simulateContract')
      .mockRejectedValue(new Error('reverted'));
    const write = jest.spyOn(clients.wallet, 'writeContract');
    await expect(
      signer.send({ functionName: 'mint', args: [owner, 1n] }),
    ).rejects.toThrow('reverted');
    expect(write).not.toHaveBeenCalled();
  });
});
