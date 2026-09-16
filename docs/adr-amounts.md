# ADR: Base-unit integer strings at the HTTP boundary

**Decision:** accept `amountBaseUnits` as a canonical positive decimal integer string within `uint256`. Return balances, allowances, supplies, and block numbers as strings. Token metadata separately reports `decimals`.

A value such as `"9007199254740993"` is exact even though JavaScript cannot represent it safely as a `number`. Validation rejects numbers, fractional syntax, exponent notation, signs, whitespace, leading zeroes, zero amounts, and uint256 overflow before chain interaction. Domain conversion uses `BigInt` directly; there is no intermediate floating-point arithmetic or assumed token decimals.

For JToken's 18 decimals, `"1000000000000000000"` means one JTK. Human-readable formatting belongs to the caller. This trades UI convenience for a small, unambiguous API. A different-decimal token would retain the same base-unit convention.

The demo API intentionally exposes only positive write amounts; ERC-20 itself still supports zero-value transfers and zero approvals. Consequently, approval revocation via zero is not an HTTP feature in this version. A production allowance-management API would need that operation and its own authorization policy.
