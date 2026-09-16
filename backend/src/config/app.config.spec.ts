import { contractAddress } from '../../test/fixtures';
import { tokenAbi } from '../token/token.abi';
import { loadConfig } from './app.config';

const env: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  LOCAL_DEMO: 'true',
  SIGNER_MODE: 'hardhat-local',
  CHAIN_ID: '31337',
  RPC_URL: 'http://127.0.0.1:8545',
  DEPLOYMENT_FILE: './shared/deployment.json',
};
const artifact = { chainId: 31337, address: contractAddress, abi: tokenAbi };

describe('local demo configuration', () => {
  it('loads valid local deployment configuration without contacting the node', () => {
    const config = loadConfig(env, () => JSON.stringify(artifact));
    expect(config).toMatchObject({
      contractAddress,
      chainId: 31337,
      signerAccountIndex: 0,
      host: '127.0.0.1',
      rpcUrl: 'http://127.0.0.1:8545/',
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it.each([
    { NODE_ENV: 'production' },
    { NODE_ENV: undefined },
    { LOCAL_DEMO: undefined },
    { LOCAL_DEMO: 'false' },
    { SIGNER_MODE: 'private-key' },
    { CHAIN_ID: '1' },
    { RPC_URL: 'https://example.com' },
    { RPC_URL: 'http://localhost.example.com' },
    { RPC_URL: 'file:///tmp/node' },
    { RPC_URL: 'http://user:untrusted-marker@localhost:8545' },
    { RPC_URL: 'http://localhost:8545?token=untrusted-marker' },
    { RPC_URL: undefined },
    { DEPLOYMENT_FILE: undefined },
    { SIGNER_ACCOUNT_INDEX: '-1' },
    { SIGNER_ACCOUNT_INDEX: '20' },
    { PORT: '65536' },
    { HOST: 'example.com' },
  ])('rejects unsafe or malformed configuration: %j', (override) => {
    expect(() =>
      loadConfig({ ...env, ...override }, () => JSON.stringify(artifact)),
    ).toThrow('Invalid configuration');
  });

  it('accepts explicit Compose networking and a second signer', () => {
    expect(
      loadConfig(
        {
          ...env,
          RPC_URL: 'http://chain:8545',
          HOST: '0.0.0.0',
          SIGNER_ACCOUNT_INDEX: '1',
        },
        () => JSON.stringify(artifact),
      ),
    ).toMatchObject({
      host: '0.0.0.0',
      signerAccountIndex: 1,
      rpcUrl: 'http://chain:8545/',
    });
  });

  it.each([
    '{malformed-json',
    JSON.stringify({ ...artifact, chainId: 1 }),
    JSON.stringify({ ...artifact, address: 'bad-address' }),
    JSON.stringify({ ...artifact, address: `0x${'0'.repeat(40)}` }),
    JSON.stringify({ ...artifact, abi: [] }),
    JSON.stringify({ ...artifact, abi: [{ type: 'function', name: 'mint' }] }),
  ])('rejects malformed or incompatible deployment artifact %#', (value) => {
    expect(() => loadConfig(env, () => value)).toThrow('Invalid configuration');
  });

  it('does not expose filesystem errors or artifact contents', () => {
    expect(() =>
      loadConfig(env, () => {
        throw new Error('untrusted-marker');
      }),
    ).toThrow(
      'Invalid configuration: DEPLOYMENT_FILE must contain readable JSON',
    );
  });
});
