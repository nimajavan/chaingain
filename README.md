# ChainGain / LottoChain TRON

Production-oriented TRON lottery with exact TRC-20 accounting, WINkLink VRF settlement, multisig administration, confirmed-event indexing, and a non-custodial web UI.

## Linux deployment (current default)

The default `build`, `start`, and `test` commands use native Next.js/Node 24 and local SQLite, not Cloudflare Workers. Follow [the Linux runbook](deploy/linux/README.fa.md) for migrations, isolated services, HTTPS and backups. Legacy Sites/Vite files are not used by this deployment path. Sales and transaction automation remain disabled by default; testnet acceptance and independent contract review are still required.

## Safety status

The code is ready for independent audit and Nile acceptance testing. It is **not approved for Mainnet real-money use** until an external audit and the legal/eligibility launch gates in `docs/production-runbook.md` are complete. Never commit or share private keys.

## Components

- `contracts/LottoChain.sol`: draws, exact ticket accounting, refund timeout, pull payouts, and 70/30 settlement.
- `contracts/WinkLinkVRFAdapter.sol`: authenticated direct-funding WINkLink wrapper adapter.
- `scripts/tron-multisig.mjs`: restricted 2-of-3 TRON permission payloads and drift checks.
- `scripts/tron-automation.mjs`: low-privilege permissionless close/refund keeper; dry-run unless explicitly enabled.
- `scripts/deploy-tron.mjs`: staged Nile/Shasta deployment with an explicit Mainnet lock.
- `worker/indexer.ts`: confirmed-only TronGrid event indexer with checkpointed, idempotent SQL writes.
- `worker/api.ts`: health, draw, activity, and wallet profile APIs.
- `server/`: local SQLite runtime, migration/backup commands and leased indexer runner.
- `deploy/linux/`: systemd units, Nginx template and deployment instructions.
- `drizzle/`: immutable SQLite migration history, originally created for D1.

## Verification

Use Node.js 24 (minimum supported version is 24.13).

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
