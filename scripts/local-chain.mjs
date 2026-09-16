import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [
    require.resolve('hardhat/internal/cli/cli'),
    'node',
    '--hostname',
    process.env.CHAIN_HOST ?? '127.0.0.1',
    '--port',
    process.env.CHAIN_PORT ?? '8545',
  ],
  {
    cwd: fileURLToPath(new URL('../smart-contract/', import.meta.url)),
    // Hardhat's startup banner prints test private keys. Never forward it.
    stdio: 'ignore',
    env: { ...process.env, HARDHAT_DISABLE_TELEMETRY_PROMPT: 'true' },
  },
);

console.info(
  JSON.stringify({ event: 'local_chain_starting', localDemoOnly: true }),
);
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    stopping = true;
    child.kill(signal);
  });
}
child.on('error', () => {
  console.error(JSON.stringify({ event: 'local_chain_start_failed' }));
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  console.info(JSON.stringify({ event: 'local_chain_stopped', code, signal }));
  process.exitCode = signal ? (stopping ? 0 : 1) : (code ?? 1);
});
