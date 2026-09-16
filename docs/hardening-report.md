# Hardening verification and handoff

## Branch and baseline

- Branch: `hardening/portfolio-ready`.
- Default branch and base: `main`, `2dcd0bde49de3da136f5c10754c2bbcb5c3a5f1f`.
- The initial working tree was clean. The original ten commits through the base remain byte-for-byte unchanged. At the owner's request, only the seven hardening commits were rewritten to correct author and committer identity; their trees, messages, dates, and order were preserved. The branch is published with an explicit `--force-with-lease`; the default branch is unchanged.
- Local verification host: Node 24.13.0, npm 11.6.2, Docker 29.5.3, Compose 5.1.4. Containers use Node 24.21.0 with its bundled npm 11.19.0.

### Commands before changes

| Command                                            | Observed result                                                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm ci --prefix backend`                          | Passed; audit reported 51 findings: 8 low, 22 moderate, 19 high, 2 critical.                                             |
| `npm ci --prefix smart-contract`                   | Passed.                                                                                                                  |
| `npm run build --prefix backend`                   | Passed.                                                                                                                  |
| `npm run lint --prefix backend -- --no-fix`        | Failed: 174 errors and 1 warning. `--no-fix` deliberately prevented the original lint script from changing the baseline. |
| `npm test --prefix backend -- --runInBand`         | Failed: 1 passed, 2 failed; missing `/shared` ABI and controller provider wiring.                                        |
| `npm run test:e2e --prefix backend -- --runInBand` | Failed: 1 failed, missing `/shared` ABI.                                                                                 |
| `npm run compile --prefix smart-contract`          | Passed.                                                                                                                  |
| `npm run lint --prefix smart-contract`             | Failed: no lint script existed.                                                                                          |
| `npm test --prefix smart-contract`                 | Passed: 18 tests, of which 9 were unrelated Lock starter tests.                                                          |

Confirmed problems included HTTP key inputs, implicit wallet RPC transport, hardcoded paths/decimals, unconfirmed writes, raw error exposure, tracked generated ABI/address data, and timing-dependent Compose startup. README claims about production quality and runtime constraints were unsupported and removed.

**Correction to an audit lead:** the old `/token/transfer-from` route already called ERC-20 `transferFrom`. The ordinary transfer method was misleadingly named `transferFrom`; this was naming confusion, not a broken allowance route. The replacement names, argument model, and real-chain tests make the distinction explicit.

The initial history scan covered 10 reachable commits and 90 unique blobs. One key-shaped example had unknown provenance and was reported before implementation continued. See [historical exposure](security.md#historical-key-shaped-literal). Current-source pattern scanning found no full private-key or credential literals; this is not a guarantee against every possible secret format.

## Reviewable commits

| Commit    | Change                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `8f98108` | One npm workspace lockfile, pinned compatible dependencies, targeted security overrides, strict lint/type/format tooling.          |
| `9bfc663` | Explicit-owner JToken, starter removal, 16 contract tests, local compiler, validated repeatable deployment.                        |
| `b545e6f` | Validated configuration, signer port, typed Viem adapter, precise DTOs, receipts/errors, health/Swagger, meaningful backend tests. |
| `8124797` | Disposable-chain HTTP tests with separate owner/spender APIs and process cleanup.                                                  |
| `31aa3ca` | Non-root health-gated Compose, startup supervision, smoke check, pinned CI actions.                                                |
| `fc6912e` | Reject request bodies on read endpoints; regression coverage.                                                                      |
| `3df6419` | Verified walkthrough, placeholders, architecture, security/amount decisions, dependency exceptions, and this report.               |

The seven commits above use **Julia Rakitina <julia.rakitina@gmail.com>** as both author and committer, associated with GitHub account **JuliaRakitina**. This separate personal documentation commit updates the references after that identity-only rewrite. Raw commit comparison verified that the seven original author/committer timestamps and time zones were retained and that the original ten commit objects were unchanged.

## Final verification

`npm run verify` runs formatting, ESLint/Solhint, strict TypeScript checks, both builds, contract tests, backend tests, and disposable-chain HTTP integration. The complete run passed after the final read-body rejection change.

| Command / check                                                                                             | Observed result                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` in a fresh Docker dependency layer                                                                 | Passed from the single root lockfile; no existing `node_modules`.                                                                            |
| `npm run format:check`                                                                                      | Passed.                                                                                                                                      |
| `npm run lint`                                                                                              | Passed (ESLint and Solhint).                                                                                                                 |
| `npm run typecheck`                                                                                         | Passed for both workspaces.                                                                                                                  |
| `npm run build`                                                                                             | Passed for contract and backend.                                                                                                             |
| `npm run test:contracts`                                                                                    | 16 passed.                                                                                                                                   |
| `npm run test:backend`                                                                                      | 96 passed, including 30 HTTP boundary cases.                                                                                                 |
| `npm run test:integration`                                                                                  | 15 behavioral scenarios passed; Node reports 16 including the enclosing fixture.                                                             |
| `npm run audit:security`                                                                                    | Passed its high/critical gate; all 17 low/moderate affected-package entries remain visible.                                                  |
| `npm audit --omit=dev --json`                                                                               | Zero findings.                                                                                                                               |
| `docker compose config --quiet`                                                                             | Passed.                                                                                                                                      |
| `docker compose up --build --wait --wait-timeout 180`                                                       | Images built; chain/deployment passed; API initially blocked by an unrelated service occupying host port 3000. That service was not stopped. |
| `API_PORT=3001 docker compose up --build --wait --wait-timeout 180`                                         | Passed: chain and API healthy; deploy exited 0.                                                                                              |
| `API_URL=http://127.0.0.1:3001 npm run demo:smoke`                                                          | Passed: health, metadata, confirmed mint, exact balance delta.                                                                               |
| README curl walkthrough with `API_PORT=3001`                                                                | All commands passed; allowance was exactly `"13"`; Swagger HTML and generated schemas verified.                                              |
| Repeated `API_PORT=3001 docker compose up --wait --wait-timeout 180`                                        | Passed: unchanged contract address and deployer nonce.                                                                                       |
| `API_PORT=3001 npm run demo:down`                                                                           | Passed; this stack's containers, network, and deployment volume removed.                                                                     |
| `npm run dev:chain`, `npm run dev:deploy`, `npm run dev:api` with the documented local `.env` and port 3001 | Passed on the host; smoke check passed; temporary `.env`, deployment output, and owned process groups removed.                               |
| Deployment regressions on a disposable chain                                                                | Repeat reuses address/code/artifact/nonce; malformed artifact/unexpected code refused without overwrite; chain reset allows deployment.      |
| Launcher signal checks                                                                                      | Requested SIGTERM/SIGINT exit 0; unexpected child SIGKILL exits 1; exact child processes cleaned up.                                         |
| `git diff --check`                                                                                          | Passed.                                                                                                                                      |

The GitHub workflow repeats a clean checkout/install, full verification, audit, and Compose smoke on Ubuntu with the pinned Node version. Its actual run URL/status is recorded in the draft PR and final handoff; configured checks alone are not evidence of a successful remote run.

### Meaningful test inventory

- Contract: **16** tests — metadata/decimals, owner/supply, mint authorization/events, transfers/events/balance failure, approval/events, allowance reduction and rollback, invalid recipients.
- Backend unit tests: **66** — configuration (26), domain/amount/operation selection (15), error mapping (4), adapter/receipt behavior (12), signer/RPC/function behavior (9).
- Mocked-chain HTTP boundary: **30** — real Nest request validation, JSON/error handling, health, Swagger, and secret-input rejection.
- Real-chain integration: **15** — metadata/balance, owner mint, precise transfer, approval and different-signer transferFrom, authorization/balance/allowance failures, invalid input, key/query rejection, wrong chain, missing contract, RPC outage.

Total: **127 meaningful cases**. The Node integration fixture wrapper is excluded from the total. Compose, deployment idempotency, and signal checks are additional smoke/regression evidence, not added to this test count.

## Decisions and remaining limitations

- RPC-managed unlocked test accounts replace HTTP-supplied keys; real private keys and wallet custody are unsupported.
- Amounts are explicit positive uint256 base-unit strings; API zero-approval revocation is intentionally not implemented.
- A successful write means one successful receipt on the local chain. Uncertain confirmation returns its hash; no durable reconciliation/idempotency/reorg handling is claimed.
- The stack is loopback-only, unauthenticated, and local-demo-only. Ownership errors are contract authorization, not user authentication.
- Runtime audit has zero findings. The development audit accepts 12 low/5 moderate affected-package entries rooted in three advisories, documented in [dependencies](dependencies.md).
- Historical key provenance remains unresolved. Its current references and HTTP path are removed, but preserved Git history still contains the old value. No credential rotation or safety of any historical wallet is claimed.

## Intentionally unchanged

The original ten commits and repository name remain intact; the seven later hardening commits received only the authorized identity correction before this documentation follow-up. Existing SPDX/package license metadata is retained; no repository license was added. Owner-only minting and JToken/JTK naming remain the intended demonstration. There is no frontend, database, authentication subsystem, broker, proxy, public-network deployment, real-key custody, or repository-metadata change.

## Optional repository presentation

Not implemented: rename to `erc20-viem-service`; description “Production-minded ERC-20 interaction service built with Solidity, NestJS, Viem, and Docker”; topics `solidity`, `erc20`, `nestjs`, `viem`, `typescript`, `hardhat`, `docker`, `web3`.
