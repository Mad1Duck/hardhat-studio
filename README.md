# Hardhat Studio

> Professional Smart Contract Development Environment built with **Electron + Vite + React + shadcn/ui**

Hardhat Studio is a desktop developer tool designed to simplify smart contract development. It provides a visual interface for running Hardhat commands, exploring ABIs, deploying contracts, interacting with smart contracts, and debugging transactions.

---

## Quick Start

```bash
# clone repository
git clone https://github.com/Mad1Duck/hardhat-studio.git

# enter project folder
cd hardhat-studio

# install dependencies
npm install

# launch dev mode
npm run dev
```

---

## Build Production App

```bash
npm run dist
```

This will generate a production desktop installer for your platform.

---

## Requirements

* Node.js **18+**
* npm / yarn / pnpm

---

## Features

### ⬡ Commands Panel

* 6 configurable command slots (Node, Compile, Deploy, Test + custom)
* Inline editable commands
* Real‑time terminal output
* Log filtering by keyword
* Auto‑scroll toggle

### ◈ ABI Explorer

* Auto scans `artifacts/`, `artifacts/contracts/`, and `out/`
* Live reload when contracts are recompiled
* Filter by function, event, constructor
* Copy ABI to clipboard
* Quick jump to contract interaction

### ◉ Contract Interact

* Connect to any RPC endpoint
* Support private key or node accounts
* Read / Write smart contract functions
* Deploy contracts directly from UI
* Inline transaction results and error details

### ◆ Deployed Contracts

* Track contracts deployed through the UI
* Copy address or ABI instantly
* Jump back to interaction panel

### 🐛 Debug Panel

* Errors tab (stderr + error logs)
* Transactions history with hash, gas, block, args
* Unified log stream across processes
* Source file viewer

### 📚 Docs & References

Quick access to curated resources:

* Hardhat
* ethers.js
* Solidity
* OpenZeppelin
* Security resources

---

## Project Structure

```
src/
  main/index.ts        → Electron main process
  preload/index.ts     → Preload bridge
  renderer/
    index.html
    src/
      App.tsx
      types.ts
      lib/utils.ts
      components/
        ui/
        layout/
        panels/
```

---

## Troubleshooting

### node_modules not found

Run:

```bash
npm install
```

inside your Hardhat project folder.

---

### ABIs not showing

Run:

```bash
npx hardhat compile
```

ABIs are stored in the `artifacts/` directory.

---

### RPC connection failed

Make sure the Hardhat node is running before connecting.

---

### Commands fail silently

Ensure `npx` is available in your PATH.

Some environments may require:

```bash
./node_modules/.bin/hardhat
```

---

## Support the Project

If Hardhat Studio improves your development workflow, consider supporting the project.

```
ETH / USDC
0x2eaa041d966B6C2A12b4356b780a378f1342e8b1
```

Every donation helps keep the project maintained and improved.

---

## License

MIT License

---

## Author

Created and maintained by the Hardhat Studio project.
