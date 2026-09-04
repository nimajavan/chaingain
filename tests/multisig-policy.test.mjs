import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPermissionUpdatePayload,
  compareOnChainPermissions,
  decodeTronAddress,
  operationsBitmap,
  validateMultisigConfig,
} from "../scripts/tron-multisig.mjs";

const ACCOUNT = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
const SIGNERS = [
  "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
  "TJZuV6A9QRdtVeJBvewCF9fLF2qnRSEv3y",
  "TPswDDCAWhJAZGdHPidFg5nEf8TkNToDX1",
];

function config() {
  const keys = SIGNERS.map((address) => ({ address, weight: 1 }));
  return {
    version: 1,
    network: "nile",
    role: "treasury",
    nodeUrl: "https://nile.trongrid.io",
    accountAddress: ACCOUNT,
    ownerPermission: { name: "chaingain-owner", threshold: 2, keys },
    activePermissions: [
      {
        name: "chaingain-contracts",
        threshold: 2,
        operations: ["TriggerSmartContract"],
        keys,
      },
    ],
  };
}

test("validates Base58Check TRON addresses", () => {
  assert.equal(decodeTronAddress(ACCOUNT).length, 25);
  assert.throws(() => decodeTronAddress(`${ACCOUNT.slice(0, -1)}x`), /checksum|Invalid/);
});

test("encodes TriggerSmartContract as a little-endian operations bitmap", () => {
  const bitmap = operationsBitmap(["TriggerSmartContract"]);
  assert.equal(bitmap.length, 64);
  assert.equal(bitmap, `00000080${"00".repeat(28)}`);
});

test("builds a restricted 2-of-3 AccountPermissionUpdate payload", () => {
  const payload = buildPermissionUpdatePayload(config());
  assert.equal(payload.owner.threshold, 2);
  assert.equal(payload.owner.keys.length, 3);
  assert.equal(payload.actives[0].id, 2);
  assert.equal(payload.actives[0].operations, `00000080${"00".repeat(28)}`);
  assert.equal(payload.visible, true);
});

test("rejects a policy where one signer can act alone", () => {
  const unsafe = config();
  unsafe.ownerPermission.keys[0].weight = 2;
  assert.throws(() => validateMultisigConfig(unsafe), /one signer/);
});

test("rejects duplicate signers and over-privileged active permissions", () => {
  const duplicate = config();
  duplicate.ownerPermission.keys[1].address = duplicate.ownerPermission.keys[0].address;
  assert.throws(() => validateMultisigConfig(duplicate), /duplicate/);

  const overPrivileged = config();
  overPrivileged.activePermissions[0].operations.push("TransferContract");
  assert.throws(() => validateMultisigConfig(overPrivileged), /only allow TriggerSmartContract/);
});

test("rejects a node URL that does not match the selected network", () => {
  const wrongNetwork = config();
  wrongNetwork.network = "mainnet";
  assert.throws(() => validateMultisigConfig(wrongNetwork), /does not match/);
});

test("detects permission drift from the reviewed configuration", () => {
  const expected = buildPermissionUpdatePayload(config());
  const matchingAccount = {
    owner_permission: expected.owner,
    active_permission: expected.actives,
  };
  assert.deepEqual(compareOnChainPermissions(config(), matchingAccount), { matches: true, differences: [] });

  matchingAccount.active_permission[0].threshold = 1;
  const drift = compareOnChainPermissions(config(), matchingAccount);
  assert.equal(drift.matches, false);
  assert.match(drift.differences[0], /Active permission/);
});
