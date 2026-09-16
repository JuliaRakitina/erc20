# Dependency decisions

## Reproducible toolchain

One root npm workspace lockfile replaces the two independent lockfiles. Node 24.21.0 is pinned in `.nvmrc` and container tags; CI uses the same version. Node 24 is an [LTS release](https://nodejs.org/en/about/previous-releases). Major versions of the application stack remain NestJS 11, Viem 2, OpenZeppelin 5, and Hardhat 2. The current compatible patches were selected rather than migrating the whole stack at once. ESLint moves to supported version 10; the TypeScript ESLint package explicitly supports it.

Solidity is pinned to `solc` 0.8.28 from npm. Hardhat's compiler subtask selects that local compiler and checks its version. The ERC20 and explicit-owner constructor follow [OpenZeppelin 5](https://docs.openzeppelin.com/contracts/5.x/erc20).

## Targeted transitive overrides

The root manifest pins these replacements because the selected parent packages still request vulnerable transitive versions:

| Parent                | Replacement                            | Reason                                                                   |
| --------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| Nest platform-express | multer 2.4.0                           | Multipart denial-of-service fixes; no upload endpoints are exposed here. |
| Hardhat               | adm-zip 0.6.1                          | Crafted archive memory-allocation fix.                                   |
| Hardhat               | undici 6.28.1                          | HTTP/WebSocket/parser fixes absent from its Undici 5 range.              |
| solc                  | tmp 0.2.7                              | Temporary-file path/symlink fixes.                                       |
| Mocha                 | serialize-javascript 7.1.1, diff 8.0.3 | Serialization execution/DoS and patch parser DoS fixes.                  |

These overrides intentionally cross some parent-requested version ranges. Compilation, contract tests, real RPC deployment, backend integration, and Compose startup are the compatibility checks. Reassess and remove the overrides when upstream packages adopt patched dependencies; do not remove them solely to silence package-tree warnings. npm 11 can display these overridden workspace transitive packages as outside their parent's original ranges.

## Audit evidence and accepted findings

Measured on 2026-09-16:

- Baseline backend install: **51 findings**, including 19 high and 2 critical.
- Final complete workspace audit: **17 affected-package entries: 12 low, 5 moderate, 0 high, 0 critical**.
- Runtime dependencies (`npm audit --omit=dev`): **0 findings**.

The remaining package entries are propagated from three advisory roots in development-only Hardhat tooling, not 17 independent vulnerabilities:

| Advisory root                                                                           | Decision for this local demo                                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [uuid buffer bounds](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — moderate      | The advisory concerns v3/v5/v6 with output buffers; the inspected Hardhat analytics call uses v4 without a supplied buffer. Keep the development dependency pending a reviewed toolchain migration. |
| [cookie validation](https://github.com/advisories/GHSA-pxg6-pf52-xh8x) — low            | Present through Hardhat's development Sentry dependency; not in the API runtime dependency tree. No public deployment or untrusted cookie-generation feature is supported.                          |
| [elliptic implementation risk](https://github.com/advisories/GHSA-848j-6mx2-7j84) — low | Present in older Ethereum development dependencies. Only public test accounts and fake funds are allowed. Do not treat this exception as permission to sign real transactions.                      |

`npm run audit:security` prints all findings and fails for high or critical advisories. There is no blanket `continue-on-error` or suppressed audit result. New audit-service failures also fail the job. Advisory databases change; these counts describe the verified snapshot, not a permanent promise. An upgrade to Hardhat 3 is a separate ESM/plugin/toolchain migration rather than a blind `npm audit fix --force`.
