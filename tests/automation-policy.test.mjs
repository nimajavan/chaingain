import assert from "node:assert/strict";
import test from "node:test";
import { decideAutomationAction } from "../scripts/tron-automation.mjs";

test("closes only an expired open draw", () => {
  assert.equal(decideAutomationAction({ state: 1, closesAt: 99, randomnessRequestedAt: 0 }, 300n, 100), "closeDraw");
  assert.equal(decideAutomationAction({ state: 1, closesAt: 101, randomnessRequestedAt: 0 }, 300n, 100), null);
});

test("enables refunds only after the VRF timeout", () => {
  assert.equal(decideAutomationAction({ state: 2, closesAt: 1, randomnessRequestedAt: 100 }, 300n, 400), "enableRefundsAfterOracleTimeout");
  assert.equal(decideAutomationAction({ state: 2, closesAt: 1, randomnessRequestedAt: 100 }, 300n, 399), null);
});

test("never automates terminal draw states", () => {
  assert.equal(decideAutomationAction({ state: 3, closesAt: 1, randomnessRequestedAt: 1 }, 1n, 100), null);
  assert.equal(decideAutomationAction({ state: 4, closesAt: 1, randomnessRequestedAt: 1 }, 1n, 100), null);
});
