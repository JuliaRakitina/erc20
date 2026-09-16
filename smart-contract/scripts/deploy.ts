import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { artifacts, ethers, network } from 'hardhat';

async function main(): Promise<void> {
  if (network.name !== 'localhost' || process.env.NODE_ENV === 'production') {
    throw new Error(
      'Deployment is restricted to the local development network.',
    );
  }

  const { chainId } = await ethers.provider.getNetwork();
  if (chainId !== 31337n) {
    throw new Error('Deployment requires the local development chain 31337.');
  }

  const [owner] = await ethers.getSigners();
  const { abi, deployedBytecode } = await artifacts.readArtifact('JToken');
  const outputFile = process.env.DEPLOYMENT_FILE
    ? path.resolve(process.env.DEPLOYMENT_FILE)
    : path.resolve(__dirname, '../../shared/deployment.json');

  let previous: string | undefined;
  try {
    previous = await readFile(outputFile, 'utf8');
  } catch (error) {
    if (!(
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    )) {
      throw error;
    }
  }

  if (previous !== undefined) {
    const deployment: unknown = JSON.parse(previous);
    if (
      typeof deployment !== 'object' ||
      deployment === null ||
      !('chainId' in deployment) ||
      deployment.chainId !== 31337 ||
      !('address' in deployment) ||
      typeof deployment.address !== 'string' ||
      !ethers.isAddress(deployment.address) ||
      deployment.address.toLowerCase() === ethers.ZeroAddress ||
      !('abi' in deployment) ||
      JSON.stringify(deployment.abi) !== JSON.stringify(abi)
    ) {
      throw new Error('The existing deployment artifact is incompatible.');
    }

    const address = ethers.getAddress(deployment.address);
    const code = await ethers.provider.getCode(address);
    if (code !== '0x') {
      if (code.toLowerCase() !== deployedBytecode.toLowerCase()) {
        throw new Error('The existing deployed contract has unexpected code.');
      }
      const existing = await ethers.getContractAt('JToken', address);
      const currentOwner: unknown = await existing.owner();
      if (currentOwner !== owner.address) {
        throw new Error(
          'The existing deployed contract has an unexpected owner.',
        );
      }

      console.log(
        JSON.stringify({
          event: 'token_deployment_reused',
          chainId: Number(chainId),
          address,
          owner: owner.address,
        }),
      );
      return;
    }
    // A restarted local chain has no code at the old address. Deploy again and
    // atomically replace its stale artifact after confirmation.
  }

  const factory = await ethers.getContractFactory('JToken', owner);
  const token = await factory.deploy(
    owner.address,
    ethers.parseUnits('1000', 18),
  );
  await token.waitForDeployment();

  const address = await token.getAddress();
  const temporaryFile = `${outputFile}.${randomUUID()}.tmp`;

  await mkdir(path.dirname(outputFile), { recursive: true });
  try {
    await writeFile(
      temporaryFile,
      `${JSON.stringify({ chainId: Number(chainId), address, abi }, null, 2)}\n`,
      { encoding: 'utf8', mode: 0o644, flag: 'wx' },
    );
    await rename(temporaryFile, outputFile);
  } finally {
    await rm(temporaryFile, { force: true });
  }

  console.log(
    JSON.stringify({
      event: 'token_deployed',
      chainId: Number(chainId),
      address,
      owner: owner.address,
    }),
  );
}

void main().catch(() => {
  console.error(
    JSON.stringify({
      event: 'deployment_failed',
      message: 'Check the local RPC connection and deployment configuration.',
    }),
  );
  process.exitCode = 1;
});
