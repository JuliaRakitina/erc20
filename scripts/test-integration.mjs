import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const requestTimeout = 5_000;
const startupTimeout = 45_000;

// Hardhat prints publicly known development keys. Never relay its raw banner,
// provider output, or 32-byte values to test logs, even after a failed startup.
function sanitize(value) {
  return String(value)
    .replace(/0x[0-9a-f]{64}/gi, '[redacted 32-byte value]')
    .replace(
      /((?:private.?key|mnemonic|secret)\s*[:=]\s*)[^\r\n]+/gi,
      '$1[redacted]',
    );
}

function startChild(label, command, args, env) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  const state = { label, child, logs: '', ended: false, error: null };
  const capture = (stream) => {
    let pending = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      pending += chunk;
      const lastNewline = pending.lastIndexOf('\n');
      if (lastNewline >= 0) {
        state.logs = (
          state.logs + sanitize(pending.slice(0, lastNewline + 1))
        ).slice(-8_000);
        pending = pending.slice(lastNewline + 1);
      }
      // Drop an unexpectedly huge unterminated line instead of retaining secrets.
      if (pending.length > 16_000) pending = '[oversized child log omitted]';
    });
    stream.on('end', () => {
      state.logs = (state.logs + sanitize(pending)).slice(-8_000);
    });
  };
  capture(child.stdout);
  capture(child.stderr);
  state.completion = new Promise((resolve) => {
    child.once('error', (error) => {
      state.error = sanitize(error.message);
      state.ended = true;
      resolve(-1);
    });
    child.once('close', (code) => {
      state.ended = true;
      resolve(code);
    });
  });
  return state;
}

function childFailure(state) {
  return `${state.label} exited before becoming ready. ${state.error ?? ''}\n${state.logs}`;
}

async function stopChild(state) {
  // npm can exit before its grandchildren. Signal the group even when the
  // direct child has already exited, so failed deployments cannot leave nodes.
  const signal = (name) => {
    if (!state.child.pid) return;
    try {
      process.kill(
        process.platform === 'win32' ? state.child.pid : -state.child.pid,
        name,
      );
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  signal('SIGTERM');
  await Promise.race([
    state.completion,
    delay(3_000, undefined, { ref: false }),
  ]);
  // Also remove grandchildren if their npm parent exited before they did.
  signal('SIGKILL');
  await Promise.race([
    state.completion,
    delay(1_000, undefined, { ref: false }),
  ]);
}

async function freePort() {
  const server = createTcpServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function eventually(description, probe, state, timeout = startupTimeout) {
  const deadline = Date.now() + timeout;
  do {
    if (state?.ended) throw new Error(childFailure(state));
    if (await probe()) return;
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error(
    `Timed out waiting for ${description}.\n${state?.logs ?? ''}`,
  );
}

async function rpc(url, method, params = []) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(requestTimeout),
  });
  assert.equal(response.status, 200, `RPC HTTP status for ${method}`);
  const body = await response.json();
  assert.equal(body.error, undefined, sanitize(JSON.stringify(body.error)));
  return body.result;
}

async function api(baseUrl, route, expectedStatus = 200, input) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: input === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    signal: AbortSignal.timeout(requestTimeout),
  });
  const body = await response.json();
  assert.equal(
    response.status,
    expectedStatus,
    `${route}: ${sanitize(JSON.stringify(body))}`,
  );
  return body;
}

async function httpStatus(baseUrl, route, status) {
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      signal: AbortSignal.timeout(requestTimeout),
    });
    await response.arrayBuffer();
    return response.status === status;
  } catch {
    return false;
  }
}

async function confirmed(rpcUrl, response, amount, actor) {
  assert.match(response.transactionHash, /^0x[0-9a-f]{64}$/i);
  assert.equal(response.status, 'success');
  assert.equal(response.amountBaseUnits, amount);
  assert.equal(response.actor.toLowerCase(), actor.toLowerCase());
  assert.equal(typeof response.blockNumber, 'string');
  assert.ok(BigInt(response.blockNumber) > 0n);
  const receipt = await rpc(rpcUrl, 'eth_getTransactionReceipt', [
    response.transactionHash,
  ]);
  assert.equal(receipt.status, '0x1');
  assert.equal(BigInt(receipt.blockNumber), BigInt(response.blockNumber));
  assert.equal(receipt.from.toLowerCase(), actor.toLowerCase());
}

// Keep the configured chain ID valid while the provider reports the wrong
// chain. This tests readiness independently of startup configuration parsing.
async function chainIdProxy(target) {
  const server = createServer(async (request, response) => {
    try {
      let raw = '';
      for await (const chunk of request) raw += chunk;
      const input = JSON.parse(raw);
      const batch = Array.isArray(input) ? input : [input];
      const output = await Promise.all(
        batch.map(async (item) => ({
          jsonrpc: '2.0',
          id: item.id,
          result:
            item.method === 'eth_chainId'
              ? '0x1'
              : await rpc(target, item.method, item.params),
        })),
      );
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(Array.isArray(input) ? output : output[0]));
    } catch {
      response.writeHead(503);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test(
  'HTTP API against a disposable deployed Hardhat chain',
  { timeout: 240_000 },
  async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'erc20-integration-'));
    const children = [];
    const servers = [];
    let cleanupPromise;
    const cleanup = () => {
      cleanupPromise ??= (async () => {
        const outcomes = await Promise.allSettled(
          children.toReversed().map(stopChild),
        );
        for (const server of servers) {
          server.closeAllConnections();
          await new Promise((resolve) => server.close(resolve));
        }
        await rm(directory, { recursive: true, force: true });
        const failed = outcomes.find(
          (outcome) => outcome.status === 'rejected',
        );
        if (failed) throw failed.reason;
      })();
      return cleanupPromise;
    };
    const onSignal = () => {
      void cleanup().finally(() => process.exit(1));
    };
    process.once('SIGTERM', onSignal);
    process.once('SIGINT', onSignal);
    t.after(cleanup);

    try {
      const rpcUrl = `http://127.0.0.1:${await freePort()}`;
      const chain = startChild(
        'Hardhat node',
        'npm',
        [
          'exec',
          '--workspace',
          'smart-contract',
          '--',
          'hardhat',
          'node',
          '--hostname',
          '127.0.0.1',
          '--port',
          new URL(rpcUrl).port,
        ],
        {},
      );
      children.push(chain);
      await eventually(
        'Hardhat RPC',
        async () => {
          try {
            return (await rpc(rpcUrl, 'eth_chainId')) === '0x7a69';
          } catch {
            return false;
          }
        },
        chain,
      );

      const deploymentFile = path.join(directory, 'deployment.json');
      const deployment = startChild(
        'contract deployment',
        'npm',
        ['run', 'deploy', '-w', 'smart-contract'],
        {
          NODE_ENV: 'test',
          RPC_URL: rpcUrl,
          DEPLOYMENT_FILE: deploymentFile,
        },
      );
      children.push(deployment);
      const deploymentCode = await Promise.race([
        deployment.completion,
        delay(startupTimeout, 'timeout', { ref: false }),
      ]);
      assert.equal(deploymentCode, 0, `Deployment failed.\n${deployment.logs}`);

      const startApi = async (accountIndex, overrides = {}, ready = true) => {
        const baseUrl = `http://127.0.0.1:${await freePort()}`;
        const state = startChild(
          `API signer ${accountIndex}`,
          process.execPath,
          ['backend/dist/main.js'],
          {
            NODE_ENV: 'test',
            LOCAL_DEMO: 'true',
            SIGNER_MODE: 'hardhat-local',
            SIGNER_ACCOUNT_INDEX: String(accountIndex),
            CHAIN_ID: '31337',
            RPC_URL: rpcUrl,
            DEPLOYMENT_FILE: deploymentFile,
            HOST: '127.0.0.1',
            PORT: new URL(baseUrl).port,
            ...overrides,
          },
        );
        children.push(state);
        await eventually(
          'API liveness',
          () => httpStatus(baseUrl, '/health/live', 200),
          state,
        );
        if (ready)
          await eventually(
            'API readiness',
            () => httpStatus(baseUrl, '/health/ready', 200),
            state,
          );
        return { baseUrl, state };
      };

      const ownerApi = await startApi(0);
      const spenderApi = await startApi(1);
      const [owner, spender, recipient] = await rpc(rpcUrl, 'eth_accounts');
      const token = '/api/v1/token';
      const balance = async (address) => {
        const value = (
          await api(ownerApi.baseUrl, `${token}/balance?address=${address}`)
        ).balanceBaseUnits;
        assert.equal(typeof value, 'string');
        return BigInt(value);
      };
      const allowance = async () => {
        const value = (
          await api(
            ownerApi.baseUrl,
            `${token}/allowance?owner=${owner}&spender=${spender}`,
          )
        ).allowanceBaseUnits;
        assert.equal(typeof value, 'string');
        return BigInt(value);
      };
      const metadata = await api(ownerApi.baseUrl, `${token}/metadata`);
      const exactAmount = '9007199254740993';
      const approvedAmount = (BigInt(exactAmount) * 3n).toString();
      const delegatedAmount = (BigInt(exactAmount) + 2n).toString();

      await t.test(
        'metadata, signer identities, liveness, and initial balances',
        async () => {
          assert.equal(metadata.name, 'JToken');
          assert.equal(metadata.symbol, 'JTK');
          assert.equal(metadata.decimals, 18);
          assert.equal(Number(metadata.chainId), 31337);
          assert.equal(
            metadata.signerAddress.toLowerCase(),
            owner.toLowerCase(),
          );
          assert.match(metadata.contractAddress, /^0x[0-9a-f]{40}$/i);
          assert.equal(typeof metadata.totalSupplyBaseUnits, 'string');
          assert.equal(
            await balance(owner),
            BigInt(metadata.totalSupplyBaseUnits),
          );
          assert.equal(await balance(recipient), 0n);
          const spenderMetadata = await api(
            spenderApi.baseUrl,
            `${token}/metadata`,
          );
          assert.equal(
            spenderMetadata.signerAddress.toLowerCase(),
            spender.toLowerCase(),
          );
          await api(ownerApi.baseUrl, '/health/live');
          await api(ownerApi.baseUrl, '/health/ready');
        },
      );

      await t.test(
        'owner mint confirms the receipt and increases supply and balance',
        async () => {
          const amount = '100000000000000000007';
          const before = await balance(recipient);
          const result = await api(ownerApi.baseUrl, `${token}/mint`, 200, {
            to: recipient,
            amountBaseUnits: amount,
          });
          await confirmed(rpcUrl, result, amount, owner);
          assert.equal(await balance(recipient), before + BigInt(amount));
          const after = await api(ownerApi.baseUrl, `${token}/metadata`);
          assert.equal(
            BigInt(after.totalSupplyBaseUnits),
            BigInt(metadata.totalSupplyBaseUnits) + BigInt(amount),
          );
        },
      );

      await t.test(
        'transfer preserves a base-unit amount greater than Number.MAX_SAFE_INTEGER',
        async () => {
          const beforeOwner = await balance(owner);
          const beforeRecipient = await balance(recipient);
          const result = await api(ownerApi.baseUrl, `${token}/transfer`, 200, {
            to: recipient,
            amountBaseUnits: exactAmount,
          });
          await confirmed(rpcUrl, result, exactAmount, owner);
          assert.equal(await balance(owner), beforeOwner - BigInt(exactAmount));
          assert.equal(
            await balance(recipient),
            beforeRecipient + BigInt(exactAmount),
          );
        },
      );

      await t.test(
        'approve sets an exact allowance for the second signer',
        async () => {
          const result = await api(ownerApi.baseUrl, `${token}/approve`, 200, {
            spender,
            amountBaseUnits: approvedAmount,
          });
          await confirmed(rpcUrl, result, approvedAmount, owner);
          assert.equal(await allowance(), BigInt(approvedAmount));
        },
      );

      await t.test(
        'the spender executes real transferFrom and reduces the owner allowance',
        async () => {
          const beforeOwner = await balance(owner);
          const beforeRecipient = await balance(recipient);
          const result = await api(
            spenderApi.baseUrl,
            `${token}/transfer-from`,
            200,
            {
              from: owner,
              to: recipient,
              amountBaseUnits: delegatedAmount,
            },
          );
          await confirmed(rpcUrl, result, delegatedAmount, spender);
          assert.equal(
            await balance(owner),
            beforeOwner - BigInt(delegatedAmount),
          );
          assert.equal(
            await balance(recipient),
            beforeRecipient + BigInt(delegatedAmount),
          );
          assert.equal(await balance(spender), 0n);
          assert.equal(
            await allowance(),
            BigInt(approvedAmount) - BigInt(delegatedAmount),
          );
        },
      );

      await t.test(
        'non-owner mint is forbidden and leaves supply unchanged',
        async () => {
          const before = await api(ownerApi.baseUrl, `${token}/metadata`);
          await api(spenderApi.baseUrl, `${token}/mint`, 403, {
            to: recipient,
            amountBaseUnits: '1',
          });
          const after = await api(ownerApi.baseUrl, `${token}/metadata`);
          assert.equal(after.totalSupplyBaseUnits, before.totalSupplyBaseUnits);
        },
      );

      await t.test(
        'insufficient allowance returns 422 without changing balance or allowance',
        async () => {
          const beforeAllowance = await allowance();
          const beforeBalance = await balance(owner);
          await api(spenderApi.baseUrl, `${token}/transfer-from`, 422, {
            from: owner,
            to: recipient,
            amountBaseUnits: (beforeAllowance + 1n).toString(),
          });
          assert.equal(await allowance(), beforeAllowance);
          assert.equal(await balance(owner), beforeBalance);
        },
      );

      await t.test('insufficient balance returns 422', async () => {
        await api(spenderApi.baseUrl, `${token}/transfer`, 422, {
          to: recipient,
          amountBaseUnits: '1',
        });
      });

      await t.test(
        'invalid addresses are rejected at the HTTP boundary',
        async () => {
          await api(
            ownerApi.baseUrl,
            `${token}/balance?address=not-an-address`,
            400,
          );
          await api(ownerApi.baseUrl, `${token}/transfer`, 400, {
            to: 'not-an-address',
            amountBaseUnits: '1',
          });
        },
      );

      await t.test(
        'invalid, missing, and numeric amounts are rejected',
        async () => {
          for (const amount of [
            '0',
            '-1',
            '1.5',
            '1e3',
            '',
            1,
            (2n ** 256n).toString(),
          ]) {
            await api(ownerApi.baseUrl, `${token}/transfer`, 400, {
              to: recipient,
              amountBaseUnits: amount,
            });
          }
          await api(ownerApi.baseUrl, `${token}/transfer`, 400, {
            to: recipient,
          });
        },
      );

      await t.test(
        'privateKey input is rejected without echoing its value',
        async () => {
          const sentinel = 'forbidden-input-value-do-not-echo';
          const response = await api(
            ownerApi.baseUrl,
            `${token}/transfer`,
            400,
            {
              to: recipient,
              amountBaseUnits: '1',
              privateKey: sentinel,
            },
          );
          assert.equal(JSON.stringify(response).includes(sentinel), false);
          const queryResponse = await api(
            ownerApi.baseUrl,
            `${token}/balance?address=${owner}&privateKey=${sentinel}`,
            400,
          );
          assert.equal(JSON.stringify(queryResponse).includes(sentinel), false);
          assert.equal(ownerApi.state.logs.includes(sentinel), false);
        },
      );

      await t.test(
        'metadata, health, and write routes reject extraneous query input',
        async () => {
          const sentinel = 'forbidden-query-value-do-not-echo';
          for (const route of [
            `${token}/metadata`,
            '/health/live',
            '/health/ready',
          ]) {
            const response = await api(
              ownerApi.baseUrl,
              `${route}?privateKey=${sentinel}`,
              400,
            );
            assert.equal(JSON.stringify(response).includes(sentinel), false);
          }
          const response = await api(
            ownerApi.baseUrl,
            `${token}/transfer?privateKey=${sentinel}`,
            400,
            { to: recipient, amountBaseUnits: '1' },
          );
          assert.equal(JSON.stringify(response).includes(sentinel), false);
          assert.equal(ownerApi.state.logs.includes(sentinel), false);
        },
      );

      await t.test(
        'a different RPC chain fails readiness while liveness stays healthy',
        async () => {
          const proxy = await chainIdProxy(rpcUrl);
          servers.push(proxy.server);
          const mismatched = await startApi(0, { RPC_URL: proxy.url }, false);
          await api(mismatched.baseUrl, '/health/live');
          await api(mismatched.baseUrl, '/health/ready', 503);
        },
      );

      await t.test(
        'missing deployed bytecode fails readiness and recovers after restoration',
        async () => {
          const originalCode = await rpc(rpcUrl, 'eth_getCode', [
            metadata.contractAddress,
            'latest',
          ]);
          assert.notEqual(originalCode, '0x');
          const nonceBefore = await rpc(rpcUrl, 'eth_getTransactionCount', [
            owner,
            'latest',
          ]);
          try {
            await rpc(rpcUrl, 'hardhat_setCode', [
              metadata.contractAddress,
              '0x',
            ]);
            await api(ownerApi.baseUrl, '/health/live');
            await api(ownerApi.baseUrl, '/health/ready', 503);
            await api(ownerApi.baseUrl, `${token}/mint`, 503, {
              to: recipient,
              amountBaseUnits: '1',
            });
            assert.equal(
              await rpc(rpcUrl, 'eth_getTransactionCount', [owner, 'latest']),
              nonceBefore,
              'A write to missing bytecode must not submit a successful no-op transaction',
            );
          } finally {
            await rpc(rpcUrl, 'hardhat_setCode', [
              metadata.contractAddress,
              originalCode,
            ]);
          }
          await eventually(
            'recovered readiness',
            () => httpStatus(ownerApi.baseUrl, '/health/ready', 200),
            ownerApi.state,
          );
        },
      );

      await t.test(
        'unavailable RPC fails readiness while liveness stays healthy',
        async () => {
          await stopChild(chain);
          await api(ownerApi.baseUrl, '/health/live');
          await api(ownerApi.baseUrl, '/health/ready', 503);
        },
      );
    } finally {
      process.removeListener('SIGTERM', onSignal);
      process.removeListener('SIGINT', onSignal);
      await cleanup();
    }
  },
);
