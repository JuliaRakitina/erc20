import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAddress, isAddress, zeroAddress, type Address } from 'viem';
import { tokenAbi } from '../token/token.abi';

export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  readonly rpcUrl: string;
  readonly chainId: 31337;
  readonly contractAddress: Address;
  readonly signerAccountIndex: number;
  readonly port: number;
  readonly host: '127.0.0.1' | '0.0.0.0';
}

function invalid(field: string): never {
  // Never include an environment value or artifact contents in startup errors.
  throw new Error(`Invalid configuration: ${field}`);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function types(parameters: unknown): string | undefined {
  if (!Array.isArray(parameters)) return undefined;
  const entries: unknown[] = parameters;
  if (
    !entries.every((entry) => record(entry) && typeof entry.type === 'string')
  ) {
    return undefined;
  }
  return entries
    .map((entry) => (entry as Record<string, unknown>).type)
    .join(',');
}

function compatibleAbi(abi: unknown): boolean {
  if (!Array.isArray(abi)) return false;
  const entries: unknown[] = abi;
  return tokenAbi
    .filter((item) => item.type === 'function')
    .every((expected) =>
      entries.some(
        (item) =>
          record(item) &&
          item.type === 'function' &&
          item.name === expected.name &&
          item.stateMutability === expected.stateMutability &&
          types(item.inputs) === types(expected.inputs) &&
          types(item.outputs) === types(expected.outputs),
      ),
    );
}

export function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
  readArtifact: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): AppConfig {
  if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
    invalid('NODE_ENV must explicitly select development or test');
  }
  if (env.LOCAL_DEMO !== 'true') invalid('LOCAL_DEMO must be true');
  if (env.SIGNER_MODE !== 'hardhat-local') invalid('SIGNER_MODE');
  if (env.CHAIN_ID !== '31337') invalid('CHAIN_ID must be 31337');

  let rpc: URL;
  try {
    rpc = new URL(env.RPC_URL ?? '');
  } catch {
    invalid('RPC_URL');
  }
  if (
    !['http:', 'https:'].includes(rpc.protocol) ||
    !['127.0.0.1', 'localhost', 'chain'].includes(rpc.hostname) ||
    rpc.username ||
    rpc.password ||
    rpc.search ||
    rpc.hash
  ) {
    invalid('RPC_URL must target a local demo node without credentials');
  }

  const index = env.SIGNER_ACCOUNT_INDEX ?? '0';
  if (!/^(?:[0-9]|1[0-9])$/.test(index)) invalid('SIGNER_ACCOUNT_INDEX');
  const port = env.PORT ?? '3000';
  if (!/^[1-9][0-9]{0,4}$/.test(port) || Number(port) > 65535) invalid('PORT');
  const host = env.HOST ?? '127.0.0.1';
  if (host !== '127.0.0.1' && host !== '0.0.0.0') invalid('HOST');

  if (!env.DEPLOYMENT_FILE?.trim()) invalid('DEPLOYMENT_FILE');
  let deployment: unknown;
  try {
    deployment = JSON.parse(readArtifact(resolve(env.DEPLOYMENT_FILE)));
  } catch {
    invalid('DEPLOYMENT_FILE must contain readable JSON');
  }
  if (
    !record(deployment) ||
    deployment.chainId !== 31337 ||
    typeof deployment.address !== 'string' ||
    !isAddress(deployment.address, { strict: false }) ||
    deployment.address.toLowerCase() === zeroAddress ||
    !compatibleAbi(deployment.abi)
  ) {
    invalid('deployment chain, address or token ABI');
  }

  return Object.freeze({
    rpcUrl: rpc.toString(),
    chainId: 31337,
    contractAddress: getAddress(deployment.address),
    signerAccountIndex: Number(index),
    port: Number(port),
    host,
  });
}
