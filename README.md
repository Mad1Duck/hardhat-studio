# Hardhat Studio v2

> Professional Smart Contract Development Environment built with Electron + Vite + React + shadcn/ui

## Quick Start

```bash
# 1. Unzip & enter folder
cd hardhat-studio

# 2. Install dependencies
npm install

# 3. Launch in dev mode
npm run dev

# 4. Build production binary
npm run dist
```

## Requirements
- Node.js 18+
- npm (or yarn/pnpm)

## Features

### ⬡ Commands Panel
- **6 configurable command slots**: Node, Compile, Deploy, Test, + 2 custom scripts
- Click any command text to **edit inline** (while process is stopped)
- Real-time terminal output with color-coded log levels
- Filter terminal output by keyword
- Auto-scroll toggle

### ◈ ABI Explorer
- Auto-scans `artifacts/`, `artifacts/contracts/`, `out/` folders
- Live reload when you recompile (file watcher)
- Filter by function / event / error / constructor
- Copy ABI to clipboard
- Quick **Interact →** jump button

### ◉ Contract Interact
- Connect to any RPC endpoint (default: http://127.0.0.1:8545)
- Support private key or node accounts
- **Read tab**: call view/pure functions instantly
- **Write tab**: send transactions with configurable value & gas limit
- **Deploy tab**: deploy directly from UI with constructor args
- All results shown inline with error details

### ◆ Deployed Contracts
- Track all contracts deployed via the UI
- Copy address and ABI with one click
- Jump back to Interact panel for any deployed contract

### 🐛 Debug Panel
- **Errors tab**: All stderr and error-level logs across all processes
- **Transactions tab**: Full history with hash, gas, block, and args
- **All Logs tab**: Unified log stream from all processes with filtering
- **Source Files**: Browse, view, and open contract files in your editor

### 📚 Docs & References
- Quick access to: Hardhat, ethers.js, Solidity, OpenZeppelin, Tools, Security
- 24 curated links with search and category filtering
- Opens in your system browser

## Project Structure (for contributors)
```
src/
  main/index.ts        → Electron main process (IPC handlers, file system, child processes)
  preload/index.ts     → Preload bridge (exposes API to renderer)
  renderer/
    index.html         → Entry HTML
    src/
      App.tsx          → Root component + global state
      types.ts         → TypeScript type definitions
      lib/utils.ts     → Utility functions
      components/
        ui/            → shadcn/ui base components
        layout/        → Sidebar
        panels/        → All main panels
```

## Troubleshooting

**`node_modules` not found badge**: Run `npm install` in your Hardhat project folder first.

**ABIs not showing**: Make sure to run `npx hardhat compile` in your project. ABIs are stored in the `artifacts/` folder.

**RPC connection failed**: Make sure Hardhat node is running (`Run` the Node command) before connecting in the Interact panel.

**Commands fail silently**: Check that `npx` is available in your PATH. Some setups may need `./node_modules/.bin/hardhat` instead.


## Troubleshooting — Common Errors

### ❌ `failed to resolve "extends":"@electron-toolkit/tsconfig/..."`
This is now fixed. The tsconfigs are fully standalone — no `@electron-toolkit/tsconfig` package needed.

### ❌ `Cannot find module '@electron-toolkit/utils'`
Fixed — main process no longer imports this package.

### ❌ `Cannot find module '@electron-toolkit/preload'`  
Fixed — preload no longer imports this package.

### ❌ `An entry point is required in the electron vite main config`
Fixed — `electron.vite.config.ts` now explicitly sets `build.lib.entry` for both `main` and `preload`.

### ✅ Verified dependency list (no hidden packages)
Only these are required: `electron`, `electron-vite`, `@vitejs/plugin-react`, `react`, `react-dom`, 
`typescript`, `tailwindcss`, `postcss`, `autoprefixer`, `lucide-react`, `ethers`,
`clsx`, `tailwind-merge`, `class-variance-authority`, and the `@radix-ui/*` packages listed in package.json.
