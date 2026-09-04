# LottoChain Internal Security Review

Date: 2026-09-04

Scope baseline: commit `6f166d20d38af90218c3bd3641fd17606741a5d9` plus the fixes documented here

Scope: `contracts/LottoChain.sol` and `test/LottoChain.t.sol`

## Status

This is an internal pre-audit review, not an independent audit or a Mainnet
approval. The reviewed contract must not hold real funds until every launch
blocker below is closed and an independent TRON-aware auditor has reviewed the
final bytecode-producing commit.

The local Solidity 0.8.20 build completes without compiler warnings. Fifteen
contract tests pass in the EVM-compatible Hardhat simulator. The optimized
creation bytecode is 8,691 bytes and runtime bytecode is 7,992 bytes. Automated
third-party static-analysis output is not yet included and remains a release
gate; the attempted local Solhint installation was blocked by registry failures.

## Security properties reviewed

- Ticket payments use an exact balance delta and reject fee-on-transfer input.
- Ticket ownership is selected from immutable cumulative purchase ranges.
- Only the configured oracle adapter can fulfill the matching request and draw.
- The winner/treasury split is fixed at 70/30 with no unallocated remainder.
- Winner and treasury payouts use a pull pattern and cannot block VRF settlement.
- Refunds are available after insufficient participation or oracle timeout.
- Refund and payout state is cleared before the external token transfer.
- Reentrancy protection covers every token-transfer path and the oracle request.
- A malicious-token callback regression test confirms purchase reentry is rejected.
- Oracle replacement is blocked while a draw is open or awaiting randomness.
- Administrative transfer requires acceptance by the new administrator.
- The administrator has no payment-token withdrawal function and cannot select a
  winner or change the payout split.

## Findings

### CG-01 — High — Push payments could block settlement — Resolved

The original VRF callback transferred tokens directly to the winner and treasury.
A reverting or restricted recipient could make the entire callback revert. The
callback now records claimable balances, and each beneficiary withdraws to a
chosen non-zero recipient. A regression test proves a blocked recipient cannot
prevent the draw from reaching `Settled`.

### CG-02 — High — Oracle outage could lock the pool — Resolved

A permissionless timeout transition now changes a stale `RandomnessPending` draw
to `Refundable`. Each participant can then recover their exact contribution.

### CG-03 — Medium — Non-standard payment token accounting — Resolved

Purchases compare the contract balance before and after `transferFrom`. Transfers
that deliver anything other than the exact ticket cost revert.

### CG-04 — Medium — Privileged key compromise — Mitigated, launch blocker

The code uses a two-step administrator transfer and separates the oracle address
from the administrator. Production must assign `admin` and `treasury` to reviewed
TRON multisig permissions with thresholds greater than one. An externally owned
single-key account is not acceptable for Mainnet.

### CG-05 — High — Production randomness adapter is absent — Open, launch blocker

The contract trusts `randomnessOracle` to verify the randomness proof. The final
WINkLink adapter, coordinator address, request parameters, funding model, callback
Energy limit, and retry behavior are not yet implemented or reviewed. A mock
oracle is used only for local testing.

### CG-06 — High — TVM deployment equivalence is unverified — Open, launch blocker

Tests currently run on an EVM-compatible simulator. The exact source must be
compiled with a TRON-aware tool, deployed to Nile or Shasta, exercised end to
end, and verified on TRONSCAN using identical compiler and optimizer settings.

### CG-07 — Medium — Independent audit is absent — Open, launch blocker

The authoring environment cannot issue an independent security attestation. A
third-party TRON-aware auditor must review the final commit, dependency lockfile,
compiler output, oracle adapter, deployment parameters, and operational runbook.

### CG-08 — Informational — Unique wallets are not unique people — Accepted

`minimumPlayers` counts addresses. One person can control multiple addresses.
This value is a liveness threshold, not proof of distinct human participation,
and product wording must not claim otherwise.

## Required Mainnet evidence

- Independent audit report referencing the exact release commit and bytecode.
- Zero unresolved critical or high findings; documented acceptance for lower risk.
- Reproducible TRON compiler settings and verified TRONSCAN source.
- Nile/Shasta evidence for purchase, close, VRF fulfillment, payout claim,
  insufficient-player refund, oracle-timeout refund, pause, and multisig actions.
- Verified official payment-token address and decimals for the selected network.
- Verified multisig members, thresholds, hardware-key custody, and recovery drill.
- Funded and monitored oracle/automation accounts with an incident runbook.
- Static-analysis results reviewed with TVM-specific false positives documented.

## References

- TRON Smart Contract Security: https://developers.tron.network/docs/smart-contract-security
- TRON Production Best Practices: https://developers.tron.network/docs/best-practices
- TRON Contract Verification: https://developers.tron.network/docs/contract-verification
- OpenZeppelin Access Control: https://docs.openzeppelin.com/contracts/5.x/access-control
