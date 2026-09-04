#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, index]));

export const CONTRACT_TYPES = Object.freeze({
  TriggerSmartContract: 31,
});

const OFFICIAL_NODE_ORIGINS = Object.freeze({
  nile: "https://nile.trongrid.io",
  shasta: "https://api.shasta.trongrid.io",
  mainnet: "https://api.trongrid.io",
});

function sha256(value) {
  return createHash("sha256").update(value).digest();
}

export function decodeTronAddress(address) {
  if (typeof address !== "string" || address.length < 30 || address.length > 36) {
    throw new Error(`Invalid TRON address: ${String(address)}`);
  }

  let numericValue = 0n;
  for (const character of address) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) throw new Error(`Invalid TRON address: ${address}`);
    numericValue = numericValue * 58n + BigInt(digit);
  }

  const bytes = [];
  while (numericValue > 0n) {
    bytes.push(Number(numericValue & 0xffn));
    numericValue >>= 8n;
  }
  bytes.reverse();
  for (const character of address) {
    if (character !== "1") break;
    bytes.unshift(0);
  }

  const decoded = Buffer.from(bytes);
  if (decoded.length !== 25 || decoded[0] !== 0x41) {
    throw new Error(`Invalid TRON address: ${address}`);
  }

  const payload = decoded.subarray(0, 21);
  const expectedChecksum = sha256(sha256(payload)).subarray(0, 4);
  if (!decoded.subarray(21).equals(expectedChecksum)) {
    throw new Error(`Invalid TRON address checksum: ${address}`);
  }
  return decoded;
}

export function operationsBitmap(operationNames) {
  if (!Array.isArray(operationNames) || operationNames.length === 0) {
    throw new Error("An active permission must declare at least one operation");
  }

  const bitmap = Buffer.alloc(32);
  for (const operationName of operationNames) {
    const contractType = CONTRACT_TYPES[operationName];
    if (contractType === undefined) throw new Error(`Unsupported operation: ${operationName}`);
    bitmap[Math.floor(contractType / 8)] |= 1 << (contractType % 8);
  }
  return bitmap.toString("hex");
}

function validatePermission(permission, label, { active = false } = {}) {
  if (!permission || typeof permission !== "object") throw new Error(`${label} is required`);
  if (
    typeof permission.name !== "string" || permission.name.length === 0 ||
    Buffer.byteLength(permission.name, "utf8") > 32
  ) {
    throw new Error(`${label}.name must be a non-empty UTF-8 name of at most 32 bytes`);
  }
  if (!Number.isSafeInteger(permission.threshold) || permission.threshold < 2) {
    throw new Error(`${label}.threshold must be an integer of at least 2`);
  }
  if (!Array.isArray(permission.keys) || permission.keys.length < 3 || permission.keys.length > 5) {
    throw new Error(`${label}.keys must contain 3 to 5 signer keys`);
  }

  const addresses = new Set();
  let totalWeight = 0;
  let maximumSingleWeight = 0;
  for (const [index, key] of permission.keys.entries()) {
    decodeTronAddress(key?.address);
    if (!Number.isSafeInteger(key.weight) || key.weight <= 0) {
      throw new Error(`${label}.keys[${index}].weight must be a positive integer`);
    }
    if (addresses.has(key.address)) throw new Error(`${label} contains a duplicate signer address`);
    addresses.add(key.address);
    totalWeight += key.weight;
    maximumSingleWeight = Math.max(maximumSingleWeight, key.weight);
  }

  if (totalWeight < permission.threshold) throw new Error(`${label} cannot reach its threshold`);
  if (maximumSingleWeight >= permission.threshold) {
    throw new Error(`${label} is not multisig: one signer can reach the threshold`);
  }

  if (active) {
    const uniqueOperations = [...new Set(permission.operations ?? [])];
    if (uniqueOperations.length !== 1 || uniqueOperations[0] !== "TriggerSmartContract") {
      throw new Error(`${label} may only allow TriggerSmartContract`);
    }
    operationsBitmap(uniqueOperations);
  }
}

export function validateMultisigConfig(config) {
  if (!config || typeof config !== "object") throw new Error("Configuration must be a JSON object");
  if (config.version !== 1) throw new Error("Unsupported multisig configuration version");
  if (!new Set(["nile", "shasta", "mainnet"]).has(config.network)) {
    throw new Error("network must be nile, shasta, or mainnet");
  }
  if (!new Set(["admin", "treasury"]).has(config.role)) {
    throw new Error("role must be admin or treasury");
  }
  decodeTronAddress(config.accountAddress);

  let parsedNodeUrl;
  try {
    parsedNodeUrl = new URL(config.nodeUrl);
  } catch {
    throw new Error("nodeUrl must be a valid HTTPS URL");
  }
  if (parsedNodeUrl.protocol !== "https:") throw new Error("nodeUrl must use HTTPS");
  if (parsedNodeUrl.username || parsedNodeUrl.password) throw new Error("nodeUrl must not contain credentials");
  if (parsedNodeUrl.pathname !== "/" || parsedNodeUrl.search || parsedNodeUrl.hash) {
    throw new Error("nodeUrl must be a bare node origin without a path, query, or fragment");
  }
  if (parsedNodeUrl.origin !== OFFICIAL_NODE_ORIGINS[config.network]) {
    throw new Error(`nodeUrl does not match the selected ${config.network} network`);
  }

  validatePermission(config.ownerPermission, "ownerPermission");
  if (!Array.isArray(config.activePermissions) || config.activePermissions.length !== 1) {
    throw new Error("Exactly one restricted active permission is required");
  }
  validatePermission(config.activePermissions[0], "activePermissions[0]", { active: true });
  return config;
}

function permissionKeys(keys) {
  return keys.map(({ address, weight }) => ({ address, weight }));
}

export function buildPermissionUpdatePayload(input) {
  const config = validateMultisigConfig(input);
  return {
    owner_address: config.accountAddress,
    owner: {
      type: 0,
      id: 0,
      permission_name: config.ownerPermission.name,
      threshold: config.ownerPermission.threshold,
      keys: permissionKeys(config.ownerPermission.keys),
    },
    actives: config.activePermissions.map((permission, index) => ({
      type: 2,
      id: index + 2,
      permission_name: permission.name,
      threshold: permission.threshold,
      parent_id: 0,
      operations: operationsBitmap(permission.operations),
      keys: permissionKeys(permission.keys),
    })),
    visible: true,
  };
}

function normalizedPermission(permission) {
  return {
    name: permission.permission_name,
    threshold: Number(permission.threshold),
    operations: permission.operations ?? null,
    keys: (permission.keys ?? [])
      .map(({ address, weight }) => ({ address, weight: Number(weight) }))
      .sort((left, right) => left.address.localeCompare(right.address)),
  };
}

export function compareOnChainPermissions(input, account) {
  const expected = buildPermissionUpdatePayload(input);
  const actualOwner = account.owner_permission ?? account.ownerPermission;
  const actualActives = account.active_permission ?? account.activePermission ?? [];
  if (!actualOwner) return { matches: false, differences: ["Owner permission is missing on-chain"] };

  const differences = [];
  if (JSON.stringify(normalizedPermission(expected.owner)) !== JSON.stringify(normalizedPermission(actualOwner))) {
    differences.push("Owner permission differs from the reviewed configuration");
  }
  if (actualActives.length !== expected.actives.length) {
    differences.push(`Expected ${expected.actives.length} active permission, found ${actualActives.length}`);
  } else {
    for (let index = 0; index < expected.actives.length; index += 1) {
      if (
        JSON.stringify(normalizedPermission(expected.actives[index])) !==
        JSON.stringify(normalizedPermission(actualActives[index]))
      ) {
        differences.push(`Active permission ${index + 2} differs from the reviewed configuration`);
      }
    }
  }
  return { matches: differences.length === 0, differences };
}

async function readConfig(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function headers() {
  const result = { "content-type": "application/json" };
  if (process.env.TRONGRID_API_KEY) result["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;
  return result;
}

async function postJson(url, body) {
  const response = await fetch(url, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || result.Error || result.code) {
    throw new Error(`TRON node rejected the request: ${JSON.stringify(result)}`);
  }
  return result;
}

async function main() {
  const [command, configPath] = process.argv.slice(2);
  if (!command || !configPath) {
    throw new Error("Usage: tron-multisig.mjs <validate|payload|unsigned|inspect> <config.json>");
  }
  const config = await readConfig(configPath);
  const payload = buildPermissionUpdatePayload(config);

  if (command === "validate") {
    console.log(`Valid ${config.role} 2-of-3 policy for ${config.network}: ${config.accountAddress}`);
    return;
  }
  if (command === "payload") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (command === "unsigned") {
    const transaction = await postJson(`${config.nodeUrl.replace(/\/$/, "")}/wallet/accountpermissionupdate`, payload);
    console.log(JSON.stringify(transaction, null, 2));
    return;
  }
  if (command === "inspect") {
    const account = await postJson(`${config.nodeUrl.replace(/\/$/, "")}/wallet/getaccount`, {
      address: config.accountAddress,
      visible: true,
    });
    const comparison = compareOnChainPermissions(config, account);
    console.log(JSON.stringify(comparison, null, 2));
    if (!comparison.matches) process.exitCode = 2;
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
