import { defineConfig } from "hardhat/config";

export default defineConfig({
  solidity: {
    type: "solc",
    version: "0.8.20",
    path: "./node_modules/solc/soljson.js",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "istanbul",
    },
  },
});
