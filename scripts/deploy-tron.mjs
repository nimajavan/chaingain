#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { TronWeb } from "tronweb";

const NETWORKS = { nile: "https://nile.trongrid.io", shasta: "https://api.shasta.trongrid.io", mainnet: "https://api.trongrid.io" };
const required = (name) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value; };
const positiveInteger = (name) => { const value = BigInt(required(name)); if (value <= 0n) throw new Error(`${name} must be positive`); return value; };
const artifact = async (name) => JSON.parse(await readFile(new URL(`../artifacts/contracts/${name}.sol/${name}.json`, import.meta.url), "utf8"));

export async function deployTron() {
  const network = required("TRON_NETWORK").toLowerCase();
  if (!(network in NETWORKS)) throw new Error("TRON_NETWORK must be nile, shasta, or mainnet");
  if (network === "mainnet" && process.env.ALLOW_MAINNET_DEPLOY !== "I_UNDERSTAND_MAINNET_RISK") {
    throw new Error("Mainnet deployment is locked; complete Nile acceptance and set the explicit Mainnet acknowledgement");
  }
  const addresses = {
    token: required("TRON_PAYMENT_TOKEN_ADDRESS"), treasury: required("TRON_TREASURY_ADDRESS"), admin: required("TRON_ADMIN_ADDRESS"),
    wink: required("TRON_WINK_TOKEN_ADDRESS"), wrapper: required("TRON_WINK_WRAPPER_ADDRESS"),
  };
  for (const [name, address] of Object.entries(addresses)) if (!TronWeb.isAddress(address)) throw new Error(`${name} address is invalid`);
  const parameters = {
    ticketPrice: positiveInteger("LOTTERY_TICKET_PRICE"), minimumPlayers: positiveInteger("LOTTERY_MINIMUM_PLAYERS"),
    maximumTickets: positiveInteger("LOTTERY_MAXIMUM_TICKETS_PER_WALLET"), timeout: positiveInteger("LOTTERY_RANDOMNESS_TIMEOUT"),
    callbackGas: positiveInteger("WINK_CALLBACK_GAS_LIMIT"), confirmations: positiveInteger("WINK_REQUEST_CONFIRMATIONS"),
  };
  if (process.env.DEPLOY_EXECUTE !== "true") return { status: "dry_run", network, addresses, parameters: Object.fromEntries(Object.entries(parameters).map(([k, v]) => [k, v.toString()])) };

  const privateKey = required("TRON_DEPLOYER_PRIVATE_KEY");
  const headers = process.env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY } : undefined;
  const tronWeb = new TronWeb({ fullHost: process.env.TRON_FULL_HOST || NETWORKS[network], privateKey, headers });
  const deployer = tronWeb.defaultAddress.base58;
  if (!deployer) throw new Error("deployer address could not be derived");
  const feeLimit = Number(process.env.DEPLOY_FEE_LIMIT_SUN ?? "1000000000");
  const [lotteryArtifact, adapterArtifact] = await Promise.all([artifact("LottoChain"), artifact("WinkLinkVRFAdapter")]);

  // The deployer is a temporary oracle/admin only during atomic setup. Admin transfer is immediately initiated to multisig.
  const lottery = await tronWeb.contract().new({ abi: lotteryArtifact.abi, bytecode: lotteryArtifact.bytecode,
    parameters: [addresses.token, addresses.treasury, deployer, deployer, parameters.ticketPrice.toString(), parameters.minimumPlayers.toString(), parameters.maximumTickets.toString(), parameters.timeout.toString()], feeLimit });
  const adapter = await tronWeb.contract().new({ abi: adapterArtifact.abi, bytecode: adapterArtifact.bytecode,
    parameters: [addresses.wink, addresses.wrapper, lottery.address, addresses.admin, parameters.callbackGas.toString(), parameters.confirmations.toString()], feeLimit });
  await lottery.setRandomnessOracle(adapter.address).send({ feeLimit, shouldPollResponse: true });
  await lottery.transferAdmin(addresses.admin).send({ feeLimit, shouldPollResponse: true });
  return { status: "deployed", network, deployer, lottery: lottery.address, adapter: adapter.address,
    requiredNextAction: "Multisig must call acceptAdmin(), then verify both sources and fund the adapter with WIN." };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  deployTron().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
