# ChainGain / LottoChain TRON

Production-oriented TRON lottery with exact TRC-20 accounting, WINkLink VRF settlement, multisig administration, confirmed-event indexing, and a non-custodial web UI.

## Safety status

The code is ready for independent audit and Nile acceptance testing. It is **not approved for Mainnet real-money use** until an external audit and the legal/eligibility launch gates in `docs/production-runbook.md` are complete. Never commit or share private keys.

## Components

- `contracts/LottoChain.sol`: draws, exact ticket accounting, refund timeout, pull payouts, and 70/30 settlement.
- `contracts/WinkLinkVRFAdapter.sol`: authenticated direct-funding WINkLink wrapper adapter.
- `scripts/tron-multisig.mjs`: restricted 2-of-3 TRON permission payloads and drift checks.
- `scripts/tron-automation.mjs`: low-privilege permissionless close/refund keeper; dry-run unless explicitly enabled.
- `scripts/deploy-tron.mjs`: staged Nile/Shasta deployment with an explicit Mainnet lock.
- `worker/indexer.ts`: confirmed-only TronGrid event indexer with idempotent D1 writes.
- `worker/api.ts`: health, draw, activity, and wallet profile APIs.
- `drizzle/`: immutable D1 migration history.

## Verification

Use Node.js 24 (minimum supported version is 22.13).

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm run contracts:test
npm test
npm audit --omit=dev --audit-level=high
```

Copy `.env.example` to an ignored local environment file and fill only public Nile addresses first. Store API credentials and private keys in the deployment/GitHub secret manager. `DEPLOY_EXECUTE` and `AUTOMATION_EXECUTE` default to false.

Follow `docs/production-runbook.md` for deployment order and the mandatory Nile acceptance checklist.
