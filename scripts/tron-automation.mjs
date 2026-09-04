#!/usr/bin/env node
import { TronWeb } from "tronweb";

const NETWORKS = {
  nile: "https://nile.trongrid.io",
  shasta: "https://api.shasta.trongrid.io",
  mainnet: "https://api.trongrid.io",
};

const ABI = [
  { name: "currentDrawId", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "getDraw", type: "function", stateMutability: "view", inputs: [{ name: "drawId", type: "uint256" }], outputs: [{ type: "tuple", components: [
    { name: "openedAt", type: "uint64" }, { name: "closesAt", type: "uint64" }, { name: "totalTickets", type: "uint32" },
    { name: "uniquePlayers", type: "uint32" }, { name: "pool", type: "uint256" }, { name: "randomnessRequestedAt", type: "uint64" },
    { name: "state", type: "uint8" }, { name: "winner", type: "address" }, { name: "randomWord", type: "uint256" }, { name: "requestId", type: "bytes32" },
  ] }] },
  { name: "randomnessTimeout", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { name: "closeDraw", type: "function", stateMutability: "nonpayable", inputs: [{ name: "drawId", type: "uint256" }], outputs: [] },
  { name: "enableRefundsAfterOracleTimeout", type: "function", stateMutability: "nonpayable", inputs: [{ name: "drawId", type: "uint256" }], outputs: [] },
];

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

export function decideAutomationAction(draw, randomnessTimeout, nowSeconds) {
  const state = Number(draw.state ?? draw[6]);
  const closesAt = Number(draw.closesAt ?? draw[1]);
  const requestedAt = Number(draw.randomnessRequestedAt ?? draw[5]);
  if (state === 1 && nowSeconds >= closesAt) return "closeDraw";
  if (state === 2 && nowSeconds >= requestedAt + Number(randomnessTimeout)) return "enableRefundsAfterOracleTimeout";
  return null;
}

export async function runAutomation() {
  const network = required("TRON_NETWORK").toLowerCase();
  if (!(network in NETWORKS)) throw new Error("TRON_NETWORK must be nile, shasta, or mainnet");
  const contractAddress = required("TRON_LOTTERY_ADDRESS");
  const execute = process.env.AUTOMATION_EXECUTE === "true";
  const privateKey = process.env.TRON_AUTOMATION_PRIVATE_KEY?.trim();
  if (execute && !privateKey) throw new Error("TRON_AUTOMATION_PRIVATE_KEY is required when AUTOMATION_EXECUTE=true");
  const fullHost = process.env.TRON_FULL_HOST?.trim() || NETWORKS[network];
  const headers = process.env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY } : undefined;
  const tronWeb = new TronWeb({ fullHost, privateKey, headers });
  if (!TronWeb.isAddress(contractAddress)) throw new Error("TRON_LOTTERY_ADDRESS is invalid");
  const contract = tronWeb.contract(ABI, contractAddress);
  const drawId = BigInt((await contract.currentDrawId().call()).toString());
  if (drawId === 0n) return { status: "idle", reason: "no_draw" };
  const [draw, timeout] = await Promise.all([contract.getDraw(drawId).call(), contract.randomnessTimeout().call()]);
  const action = decideAutomationAction(draw, BigInt(timeout.toString()), Math.floor(Date.now() / 1000));
  if (!action) return { status: "idle", drawId: drawId.toString(), reason: "no_action_due" };
  if (!execute) return { status: "dry_run", drawId: drawId.toString(), action };

  const owner = tronWeb.defaultAddress.base58;
  const minimumTrx = Number(process.env.AUTOMATION_MIN_TRX ?? "20");
  const balanceSun = await tronWeb.trx.getBalance(owner);
  if (balanceSun < minimumTrx * 1_000_000) throw new Error("automation account TRX balance is below the configured safety floor");
  const feeLimit = Number(process.env.AUTOMATION_FEE_LIMIT_SUN ?? "150000000");
  const transactionId = await contract[action](drawId).send({ feeLimit, shouldPollResponse: true });
  return { status: "submitted", network, drawId: drawId.toString(), action, transactionId };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runAutomation().then((result) => console.log(JSON.stringify(result))).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
