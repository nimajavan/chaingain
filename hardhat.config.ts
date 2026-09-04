import { defineConfig } from "hardhat/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  solidity: {
    type: "solc",
    version: "0.8.20",
    path: fileURLToPath(new URL("./node_modules/solc/soljson.js", import.meta.url)),
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "istanbul",
    },
  },
});
