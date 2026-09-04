# ChainGain TRON Multisig Runbook

## Production policy

Use two separate TRON accounts:

- `admin`: controls `startDraw`, pause state, oracle replacement, and admin handover;
- `treasury`: receives the 30% allocation and claims it from the lottery contract.

Each account uses a 2-of-3 Owner permission and a 2-of-3 Active permission. The
Active permission allows only `TriggerSmartContract` (contract type 31). It does
not permit direct TRX transfers, TRC-10 transfers, contract deployment, or
permission updates. Owner keys should be held on separate hardware wallets and
Owner permission ID 0 must be used only for permission recovery or rotation;
routine contract calls use the restricted Active permission ID 2.

TRON's operations bitmap restricts transaction types, not destination contract
addresses. `TriggerSmartContract` can call any smart contract, including a token
contract, so the 2-of-3 threshold remains mandatory for the Active permission.

Never use the lottery deployer, automation hot key, website, or CI environment as
a multisig signer. Prefer different signers for the admin and treasury accounts.

## Files and commands

Copy the example configurations to ignored local files and replace every
`T_REPLACE_...` value with a Base58 TRON address:

```text
config/multisig.admin.local.json
config/multisig.treasury.local.json
```

No private key, mnemonic, keystore password, or hardware-wallet recovery data
belongs in these files.

Validate both policies before contacting a node:

```sh
npm run multisig:validate -- config/multisig.admin.local.json
npm run multisig:validate -- config/multisig.treasury.local.json
```

Print the exact `AccountPermissionUpdateContract` payload for human review:

```sh
npm run multisig:payload -- config/multisig.admin.local.json
npm run multisig:payload -- config/multisig.treasury.local.json
```

Build an unsigned transaction from the selected network node:

```sh
npm run multisig:unsigned -- config/multisig.admin.local.json
npm run multisig:unsigned -- config/multisig.treasury.local.json
```

The tool never accepts private keys, signs transactions, or broadcasts them.
Sign the initial permission-update transaction with the account's current Owner
using TronLink or a reviewed hardware-wallet flow. Review the account address,
network, all signer addresses, weights, thresholds, and operations bitmap on a
separate device before signing. Unsigned TRON transactions expire quickly; build
the transaction only when the current Owner is ready to review and sign it.

After confirmation and solidification, verify that the on-chain permissions still
match the reviewed local policy:

```sh
npm run multisig:inspect -- config/multisig.admin.local.json
npm run multisig:inspect -- config/multisig.treasury.local.json
```

The command exits with code 2 if it detects permission drift.

## Deployment binding

Pass the admin account address—not an individual signer address—as the `admin_`
constructor argument. Pass the treasury account address as `treasury_`. Publish
both account addresses, their permission IDs, thresholds, and signer custody
policy in the deployment record.

The contract's restricted Active permission is normally ID 2. Every multisig
contract call must explicitly select the intended permission ID when signing.

## Launch drill

Complete this sequence on Nile before Mainnet:

1. Configure both accounts and wait for solidification.
2. Run `multisig:inspect` and archive the matching output.
3. Deploy LottoChain with the two multisig account addresses.
4. Use two admin signers to start and pause a test draw.
5. Use two treasury signers to claim a test payout.
6. Confirm a single signer cannot execute either action.
7. Rotate one signer on Nile and confirm the removed signer loses authority.
8. Record current permission-update and multisignature fees from chain parameters.

Do not activate Mainnet until at least two operators can independently complete
the signing procedure and the recovery drill has been witnessed and recorded.

## Incident response

If one signer is lost or suspected compromised, stop using it immediately. The
remaining threshold signers must submit a complete permission update that removes
the affected key while preserving every required Owner and Active permission.
Permission updates replace the full permission set; omitting an existing Active
permission deletes it.

If fewer than the threshold keys remain available, TRON cannot bypass the account
permission policy. Recovery then depends entirely on the custody process agreed
before launch.
