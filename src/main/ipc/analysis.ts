import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import type { BrowserWindow } from 'electron';

//  Security pattern definitions 
interface SecurityRule {
  test: RegExp | string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  recommendation: string;
}

const LINE_RULES: SecurityRule[] = [
  { test: 'tx.origin', severity: 'high', title: 'tx.origin Usage', recommendation: 'Use msg.sender instead' },
  { test: 'selfdestruct', severity: 'critical', title: 'Selfdestruct', recommendation: 'Remove selfdestruct or add strict access control' },
  { test: 'suicide', severity: 'critical', title: 'Selfdestruct (alias)', recommendation: 'Remove selfdestruct or add strict access control' },
  { test: /\.call\s*\{/, severity: 'medium', title: 'Low-level call', recommendation: 'Check return value and add reentrancy guard' },
  { test: 'block.timestamp', severity: 'low', title: 'Timestamp Dependency', recommendation: 'Avoid relying on block.timestamp for critical logic' },
  { test: 'now', severity: 'low', title: 'Timestamp Dependency', recommendation: 'Avoid relying on block.timestamp for critical logic' },
  { test: /\.transfer\s*\(/, severity: 'medium', title: 'transfer/send Usage', recommendation: 'Use call{value:...}() with reentrancy guard instead' },
  { test: /\.send\s*\(/, severity: 'medium', title: 'transfer/send Usage', recommendation: 'Use call{value:...}() with reentrancy guard instead' },
  { test: 'delegatecall', severity: 'high', title: 'Delegatecall', recommendation: 'Ensure delegatecall target is trusted and not upgradeable' },
];

function matchRule(line: string, rule: SecurityRule): boolean {
  return typeof rule.test === 'string'
    ? line.includes(rule.test)
    : rule.test.test(line);
}

//  Storage type sizes (bytes) 
const TYPE_SIZES: Record<string, number> = {
  bool: 1, address: 20, bytes: 32, string: 32,
  uint8: 1, int8: 1, uint16: 2, int16: 2, uint32: 4, int32: 4,
  uint64: 8, int64: 8, uint128: 16, int128: 16,
  uint256: 32, int256: 32, uint: 32, int: 32,
  bytes1: 1, bytes2: 2, bytes4: 4, bytes8: 8,
  bytes16: 16, bytes20: 20, bytes32: 32,
};

//  EVM opcode table 
interface Opcode { name: string; gas: number; operandBytes?: number; }

function buildOpcodeTable(): Record<number, Opcode> {
  const t: Record<number, Opcode> = {
    0x00: { name: 'STOP', gas: 0 },
    0x01: { name: 'ADD', gas: 3 },
    0x02: { name: 'MUL', gas: 5 },
    0x03: { name: 'SUB', gas: 3 },
    0x04: { name: 'DIV', gas: 5 },
    0x05: { name: 'SDIV', gas: 5 },
    0x06: { name: 'MOD', gas: 5 },
    0x07: { name: 'SMOD', gas: 5 },
    0x08: { name: 'ADDMOD', gas: 8 },
    0x09: { name: 'MULMOD', gas: 8 },
    0x0a: { name: 'EXP', gas: 10 },
    0x0b: { name: 'SIGNEXTEND', gas: 5 },
    0x10: { name: 'LT', gas: 3 },
    0x11: { name: 'GT', gas: 3 },
    0x12: { name: 'SLT', gas: 3 },
    0x13: { name: 'SGT', gas: 3 },
    0x14: { name: 'EQ', gas: 3 },
    0x15: { name: 'ISZERO', gas: 3 },
    0x16: { name: 'AND', gas: 3 },
    0x17: { name: 'OR', gas: 3 },
    0x18: { name: 'XOR', gas: 3 },
    0x19: { name: 'NOT', gas: 3 },
    0x1a: { name: 'BYTE', gas: 3 },
    0x1b: { name: 'SHL', gas: 3 },
    0x1c: { name: 'SHR', gas: 3 },
    0x1d: { name: 'SAR', gas: 3 },
    0x20: { name: 'SHA3', gas: 30 },
    0x30: { name: 'ADDRESS', gas: 2 },
    0x31: { name: 'BALANCE', gas: 100 },
    0x32: { name: 'ORIGIN', gas: 2 },
    0x33: { name: 'CALLER', gas: 2 },
    0x34: { name: 'CALLVALUE', gas: 2 },
    0x35: { name: 'CALLDATALOAD', gas: 3 },
    0x36: { name: 'CALLDATASIZE', gas: 2 },
    0x37: { name: 'CALLDATACOPY', gas: 3 },
    0x38: { name: 'CODESIZE', gas: 2 },
    0x39: { name: 'CODECOPY', gas: 3 },
    0x3a: { name: 'GASPRICE', gas: 2 },
    0x3b: { name: 'EXTCODESIZE', gas: 100 },
    0x3c: { name: 'EXTCODECOPY', gas: 100 },
    0x3d: { name: 'RETURNDATASIZE', gas: 2 },
    0x3e: { name: 'RETURNDATACOPY', gas: 3 },
    0x3f: { name: 'EXTCODEHASH', gas: 100 },
    0x40: { name: 'BLOCKHASH', gas: 20 },
    0x41: { name: 'COINBASE', gas: 2 },
    0x42: { name: 'TIMESTAMP', gas: 2 },
    0x43: { name: 'NUMBER', gas: 2 },
    0x44: { name: 'DIFFICULTY', gas: 2 },
    0x45: { name: 'GASLIMIT', gas: 2 },
    0x46: { name: 'CHAINID', gas: 2 },
    0x47: { name: 'SELFBALANCE', gas: 5 },
    0x50: { name: 'POP', gas: 2 },
    0x51: { name: 'MLOAD', gas: 3 },
    0x52: { name: 'MSTORE', gas: 3 },
    0x53: { name: 'MSTORE8', gas: 3 },
    0x54: { name: 'SLOAD', gas: 100 },
    0x55: { name: 'SSTORE', gas: 100 },
    0x56: { name: 'JUMP', gas: 8 },
    0x57: { name: 'JUMPI', gas: 10 },
    0x58: { name: 'PC', gas: 2 },
    0x59: { name: 'MSIZE', gas: 2 },
    0x5a: { name: 'GAS', gas: 2 },
    0x5b: { name: 'JUMPDEST', gas: 1 },
    0xf0: { name: 'CREATE', gas: 32000 },
    0xf1: { name: 'CALL', gas: 100 },
    0xf2: { name: 'CALLCODE', gas: 100 },
    0xf3: { name: 'RETURN', gas: 0 },
    0xf4: { name: 'DELEGATECALL', gas: 100 },
    0xf5: { name: 'CREATE2', gas: 32000 },
    0xfa: { name: 'STATICCALL', gas: 100 },
    0xfd: { name: 'REVERT', gas: 0 },
    0xfe: { name: 'INVALID', gas: 0 },
    0xff: { name: 'SELFDESTRUCT', gas: 5000 },
  };
  for (let i = 0; i < 32; i++) t[0x60 + i] = { name: `PUSH${i + 1}`, gas: 3, operandBytes: i + 1 };
  for (let i = 0; i < 16; i++) t[0x80 + i] = { name: `DUP${i + 1}`, gas: 3 };
  for (let i = 0; i < 16; i++) t[0x90 + i] = { name: `SWAP${i + 1}`, gas: 3 };
  for (let i = 0; i < 5; i++) t[0xa0 + i] = { name: `LOG${i}`, gas: 375 };
  return t;
}

const OPCODES = buildOpcodeTable();

//  IPC Handlers 
export function registerAnalysisHandlers(getWin: () => BrowserWindow | null): void {

  //  Security scan 
  ipcMain.handle('analyze-security', async (
    _,
    { folderPath }: { folderPath: string; },
  ) => {
    const findings: unknown[] = [];

    const scan = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.name === 'node_modules') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) { scan(full); continue; }
          if (!entry.name.endsWith('.sol')) continue;

          try {
            const content = fs.readFileSync(full, 'utf-8');
            const lines = content.split('\n');

            // Line-level rules
            lines.forEach((line, i) => {
              LINE_RULES.forEach(rule => {
                if (matchRule(line, rule)) {
                  findings.push({
                    severity: rule.severity,
                    title: rule.title,
                    description: `${rule.title} in ${entry.name}:${i + 1}`,
                    line: i + 1,
                    recommendation: rule.recommendation,
                  });
                }
              });
            });

            // File-level rules
            if (!content.includes('pragma solidity') || content.match(/pragma solidity\s+\^0\.[0-7]/)) {
              findings.push({ severity: 'medium', title: 'Outdated Solidity', description: `${entry.name} may use outdated compiler`, recommendation: 'Use solidity 0.8.x or later' });
            }
            if (!content.includes('Ownable') && !content.includes('AccessControl') && content.includes('onlyOwner')) {
              findings.push({ severity: 'low', title: 'Custom Access Control', description: `Custom access control in ${entry.name}`, recommendation: 'Use OpenZeppelin Ownable or AccessControl' });
            }
          } catch { /* skip unreadable file */ }
        }
      } catch { /* skip unreadable dir */ }
    };

    const contractsDir = path.join(folderPath, 'contracts');
    scan(fs.existsSync(contractsDir) ? contractsDir : folderPath);
    return findings;
  });

  //  Storage layout (heuristic) 
  ipcMain.handle('analyze-storage-layout', async (
    _,
    { folderPath, contractName }: { folderPath: string; contractName: string; },
  ) => {
    const slots: unknown[] = [];
    const VAR_RE = /^\s*(uint\d*|int\d*|bool|address|bytes\d*|string|bytes|mapping[^;]+|[A-Z]\w+)\s+(?:public\s+|private\s+|internal\s+|immutable\s+|constant\s+)*(\w+)\s*[;=]/gm;

    const scan = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { scan(full); continue; }
        if (!entry.name.endsWith('.sol')) continue;

        try {
          const src = fs.readFileSync(full, 'utf-8');
          const match = new RegExp(`contract\\s+${contractName}[^{]*\\{([\\s\\S]*?)^\\}`, 'm').exec(src);
          if (!match) continue;

          let slotNum = 0, byteOffset = 0;
          let m: RegExpExecArray | null;

          while ((m = VAR_RE.exec(match[1])) !== null) {
            const typeName = m[1].trim().split(/\s+/)[0];
            const varName = m[2];
            if (varName === 'constant' || varName === 'immutable') continue;

            const bytes = TYPE_SIZES[typeName] ?? 32;
            if (byteOffset + bytes > 32) { slotNum++; byteOffset = 0; }

            slots.push({ slot: slotNum, name: varName, type: typeName, bytes, offset: byteOffset });
            byteOffset += bytes;
            if (byteOffset >= 32) { slotNum++; byteOffset = 0; }
          }
        } catch { /* skip */ }
      }
    }

      ;[path.join(folderPath, 'contracts'), folderPath].forEach(scan);
    return slots;
  });

  //  Decode bytecode to opcodes 
  ipcMain.handle('decode-opcodes', async (_, bytecode: string) => {
    const hex = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    const bytes = Buffer.from(hex, 'hex');
    const result: unknown[] = [];

    let i = 0;
    while (i < bytes.length && result.length < 2_000) {
      const byte = bytes[i];
      const op = OPCODES[byte] ?? { name: `0x${byte.toString(16).padStart(2, '0')}`, gas: 0 };
      const opLen = op.operandBytes ?? 0;
      const operand = opLen > 0 && i + opLen < bytes.length
        ? '0x' + bytes.slice(i + 1, i + 1 + opLen).toString('hex')
        : undefined;

      result.push({ offset: i, opcode: op.name, operand, gasCost: op.gas });
      i += 1 + opLen;
    }

    return result;
  });

  //  Generate Obsidian markdown docs 
  type AbiItem = {
    type: string;
    name?: string;
    inputs?: Array<{ name: string; type: string; }>;
    outputs?: Array<{ name: string; type: string; }>;
    stateMutability?: string;
  };
  type AbiEntry = { contractName: string; abi: AbiItem[]; sourceName?: string; };

  ipcMain.handle('generate-docs', async (
    _,
    { abis, projectName, outputPath }: {
      abis: AbiEntry[];
      projectName: string;
      outputPath?: string;
    },
  ) => {
    const outDir = outputPath ?? (await dialog.showOpenDialog(getWin()!, {
      properties: ['openDirectory'],
      title: 'Select Obsidian Vault or Output Folder',
    })).filePaths?.[0];
    if (!outDir) return false;

    try {
      const docsDir = path.join(outDir, projectName);
      fs.mkdirSync(docsDir, { recursive: true });

      for (const contract of abis) {
        const fns = contract.abi.filter(i => i.type === 'function');
        const events = contract.abi.filter(i => i.type === 'event');

        const sig = (item: AbiItem) =>
          `${item.name}(${(item.inputs ?? []).map(i => `${i.type} ${i.name}`).join(', ')})`;

        let doc = `# ${contract.contractName}\n\n`;
        doc += `> Source: \`${contract.sourceName ?? 'unknown'}\`\n\n`;
        doc += `## Functions\n\n`;

        for (const fn of fns) {
          doc += `### \`${sig(fn)}\`\n`;
          doc += `- **Mutability**: \`${fn.stateMutability}\`\n`;
          if (fn.outputs?.length) doc += `- **Returns**: \`${fn.outputs.map(o => o.type).join(', ')}\`\n`;
          doc += '\n';
        }

        if (events.length) {
          doc += `## Events\n\n`;
          events.forEach(ev => { doc += `### \`${sig(ev)}\`\n\n`; });
        }

        fs.writeFileSync(path.join(docsDir, `${contract.contractName}.md`), doc, 'utf-8');
      }

      // Index
      const index = `# ${projectName} - Contract Index\n\n` +
        abis.map(a => `- [[${a.contractName}]]`).join('\n');
      fs.writeFileSync(path.join(docsDir, 'INDEX.md'), index, 'utf-8');

      return true;
    } catch { return false; }
  });
}
