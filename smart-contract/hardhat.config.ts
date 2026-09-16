import { createRequire } from 'node:module';
import { HardhatUserConfig, subtask } from 'hardhat/config';
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from 'hardhat/builtin-tasks/task-names';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';

const compilerVersion = '0.8.28';
const loadCompiler = createRequire(__filename);

// Use the lockfile-pinned compiler so a clean build needs no compiler download.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(
  ({ solcVersion }: { solcVersion: string }) => {
    const solc = loadCompiler('solc') as { version(): string };
    const longVersion = solc.version();
    if (
      solcVersion !== compilerVersion ||
      !longVersion.startsWith(`${compilerVersion}+`)
    ) {
      throw new Error(
        'The installed Solidity compiler must be version 0.8.28.',
      );
    }

    return Promise.resolve({
      compilerPath: loadCompiler.resolve('solc/soljson.js'),
      isSolcJs: true,
      version: solcVersion,
      longVersion,
    });
  },
);

const config: HardhatUserConfig = {
  solidity: {
    version: compilerVersion,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
    },
  },
  networks: {
    hardhat: { chainId: 31337, hardfork: 'cancun' },
    localhost: {
      url: process.env.RPC_URL || 'http://127.0.0.1:8545',
      chainId: 31337,
    },
  },
};

export default config;
