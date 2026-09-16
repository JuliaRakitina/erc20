try {
  const chain = process.argv[2] === 'chain';
  const response = await fetch(
    chain ? 'http://127.0.0.1:8545' : 'http://127.0.0.1:3000/health/ready',
    chain
      ? {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_chainId',
            params: [],
          }),
          signal: AbortSignal.timeout(3000),
        }
      : { signal: AbortSignal.timeout(3000) },
  );
  if (!response.ok) process.exitCode = 1;
  if (chain && (await response.json()).result !== '0x7a69')
    process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
