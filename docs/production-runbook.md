# LottoChain production runbook

## Enforced launch order

1. CI, dependency audit, Solidity tests, TypeScript, lint, and UI tests are green.
2. Independent external audit findings are closed and the exact audited commit is tagged.
3. Admin and treasury are separate 2-of-3 TRON multisig accounts.
4. Verify the Nile WIN token and VRF wrapper addresses from the official WINkLink deployment page.
5. Deploy and fund `WinkLinkVRFAdapter` with only the WIN required for a small number of requests.
6. Deploy `LottoChain`, configure the adapter, verify source on Nile TRONSCAN, and transfer admin to multisig.
7. Configure D1 and the public indexer variables. Confirm `/api/health` reports `ready` and the expected Nile address.
8. Create a dedicated automation account with no admin or treasury permissions and a limited TRX balance. Store its key only in GitHub's `nile` environment secrets.
9. Run the complete Nile checklist below. Repeat failure and timeout scenarios.
10. Complete legal, geo, age, and responsible-play controls before any real-money Mainnet launch.

## Nile acceptance checklist

- [ ] Published source matches the audited commit and constructor arguments.
- [ ] Token, multisigs, adapter, wrapper, ticket price, limits, and timeout read back exactly.
- [ ] Two wallets purchase; exact pool accounting appears after confirmed events.
- [ ] The keeper closes an expired draw and one authenticated VRF callback settles it.
- [ ] Winner and treasury claim the exact 70/30 allocations.
- [ ] Below-minimum participation enables full refunds.
- [ ] Missing VRF response enables refunds only after `randomnessTimeout`.
- [ ] Duplicate/fake callback, over-limit purchase, early close, and non-admin mutation all fail.
- [ ] Indexer restart/backfill creates no duplicate purchase or claim rows.
- [ ] UI remains locked on a wrong network/address and unlocks only when `/api/health` matches.
- [ ] Keeper low-balance failure is visible and no privileged key exists in logs or artifacts.
- [ ] CI and production dependency audit pass on the release commit.

Mainnet requires a fresh deployment/configuration review; never reuse a Nile automation key.
