# LottoChain contracts

This directory contains the first auditable contract slice for the TRON lottery.

The current internal review and unresolved Mainnet gates are documented in
[`docs/security-audit-2026-09-04.md`](../docs/security-audit-2026-09-04.md).
The native TRON 2-of-3 admin and treasury procedure is documented in
[`docs/multisig-runbook.md`](../docs/multisig-runbook.md).

## Safety status

The contract is **not audited and must not hold real funds yet**. Unit tests run in
an EVM-compatible local simulator. Before a TRON deployment, compile and test the
same pinned Solidity source with TronBox/TRE, connect a reviewed WINkLink adapter,
and complete an independent security audit.

## Invariants implemented

- fixed payment token, treasury, ticket price, minimum players, and wallet limit;
- exact `transferFrom` accounting rejects fee-on-transfer behavior;
- 70% winner / 30% treasury allocation with no rounding remainder;
- pull-based payouts so a rejecting recipient cannot block oracle settlement;
- only the configured oracle can fulfill a matching randomness request;
- permissionless refunds if the oracle misses its configured response deadline;
- exact pull-based refunds when minimum participation is missed;
- reentrancy protection and checks-effects-interactions ordering;
- two-step admin transfer and blocked oracle changes during active draws.

## Commands

```sh
npm run contracts:compile
npm run contracts:test
```

The production WINkLink adapter and network deployment scripts are intentionally
deferred until the official coordinator, fee token, key hash, and callback ABI for
the selected TRON network are confirmed.
