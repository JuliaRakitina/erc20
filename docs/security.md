# Signing boundary and threat model

## Decision

Use an injectable `SignerPort` with one `HardhatLocalSigner` implementation. The API selects an unlocked **development** account by index from the configured RPC node. It never loads, derives, accepts, returns, or logs a private key or mnemonic. Deployments also use RPC accounts.

Both public and wallet Viem clients use the same explicit RPC URL. Before a write, the signer checks the actual chain ID and simulates the exact contract call. `transferFrom(from,to,amount)` is executed by the configured spender; it consumes an allowance granted by `from`.

Configuration requires `NODE_ENV=development` or `test`, `LOCAL_DEMO=true`, `SIGNER_MODE=hardhat-local`, and `CHAIN_ID=31337`. RPC hosts are restricted to loopback or the Compose `chain` service, without URL credentials. The deployment JSON must have the correct chain, a nonzero address, and a compatible token ABI. There is no production signer mode.

A future external wallet, unsigned-transaction builder, or KMS signer can replace the port. That work would also require user authorization, policy enforcement, transaction reconciliation, and a different deployment threat model; swapping an adapter alone does not make this custody-ready.

## Trust boundaries

| Boundary        | Enforcement / limitation                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| HTTP input      | Typed DTOs; reject unknown properties, invalid addresses, and noncanonical positive uint256 strings; bounded JSON body.            |
| Configuration   | Explicit local opt-in and production refusal; startup errors do not contain supplied values.                                       |
| RPC             | One configured transport; local host allowlist; real chain and bytecode readiness checks. The local node/operator remains trusted. |
| Transaction     | Simulate then submit; check receipt status; retain submitted hash if confirmation is unavailable.                                  |
| Errors and logs | Stable bounded messages and structured status logs; no request-body/provider-error dumps.                                          |
| Containers      | Non-root processes, loopback published ports, init/signal handling, read-only API deployment volume.                               |

Anyone who can reach the demo API can request actions from its configured account, including owner minting. HTTP 403 means **contract ownership failure**, not authenticated user authorization. There is intentionally no user authentication, rate limiting, custody policy, or balance reservation. Never expose this stack to an untrusted network. Hardhat RPC itself exposes unlocked test accounts and development methods.

One confirmation is enough only for this disposable chain. There is no reorg handling, durable transaction ledger, or idempotency key; on timeout, the transaction may already have executed. Simulation is useful error detection but is not an atomic guarantee about later chain state. All transactions use fake funds.

## Historical key-shaped literal

The baseline review inspected 10 reachable commits and 90 unique historical file blobs. A full key-shaped Swagger example in the former `backend/src/token/dto/transfer.dto.ts` could not be matched to standard Hardhat test keys. It first appeared in commit `13efd84674c4ed7105b17a05e545fadc33a26cff`. Its provenance remains unknown; the owner could not confirm whether it was a test example.

Implementation paused and reported this finding before proceeding. Current DTOs/examples contain no key material, and the signing path cannot use the historical value. Complete Git history is preserved as requested, so the old literal remains retrievable from history. Removal from the current tree does not revoke a credential. If it ever controlled real assets or services, its owner must treat it as exposed and retire it; no rotation or wallet safety has been verified here. The value is intentionally not reproduced in documentation or logs.

## Scope

This is an unaudited educational integration. Passing tests and automated dependency checks do not establish security for real assets. No mainnet/testnet deployment or secret-management service is included.
