import assert from 'node:assert/strict';

const base = process.env.API_URL ?? 'http://127.0.0.1:3000';
async function request(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(35_000),
  });
  assert.equal(response.status, 200, `Unexpected status for ${path}`);
  return response.json();
}

await request('/health/live');
await request('/health/ready');
const metadata = await request('/api/v1/token/metadata');
assert.equal(metadata.name, 'JToken');
assert.equal(metadata.decimals, 18);
const recipient = '0x0000000000000000000000000000000000000001';
const before = await request(`/api/v1/token/balance?address=${recipient}`);
const minted = await request('/api/v1/token/mint', {
  to: recipient,
  amountBaseUnits: '1',
});
assert.equal(minted.status, 'success');
assert.match(minted.transactionHash, /^0x[0-9a-fA-F]{64}$/);
const after = await request(`/api/v1/token/balance?address=${recipient}`);
assert.equal(
  BigInt(after.balanceBaseUnits),
  BigInt(before.balanceBaseUnits) + 1n,
);
console.info(
  'Compose smoke passed: liveness, chain/contract readiness, metadata, confirmed mint, exact balance delta.',
);
