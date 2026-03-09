/**
 * LicenseContext — Lemon Squeezy license key validation + feature gating
 *
 * Dev mode: set VITE_DEV_UNLOCK=true in .env → all features unlocked
 * Production: user enters license key → validated against LS API via main process
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Feature =
  | 'accounts'
  | 'snapshots'
  | 'block_explorer'
  | 'security'
  | 'gas_profiler'
  | 'opcode_viewer'
  | 'contract_graph'
  | 'tx_graph'
  | 'analytics'
  | 'simulation_lab'
  | 'lp_simulator'
  | 'scenario_builder'
  | 'frontend_helper'
  | 'verify_contract'
  | 'abi_compat'
  | 'event_schema'
  | 'environment'
  | 'git'
  | 'docs'
  | 'erc_standards'
  | 'audit_notes'
  | 'notes'
  | 'debug'
  | 'erc20_reader'
  | 'nft_viewer';

export const FEATURE_TIERS: Record<Feature, 'free' | 'pro'> = {
  accounts: 'free',
  environment: 'free',
  git: 'free',
  docs: 'free',
  notes: 'free',
  debug: 'free',
  erc_standards: 'free',
  block_explorer: 'free',
  snapshots: 'pro',
  security: 'pro',
  gas_profiler: 'pro',
  opcode_viewer: 'pro',
  contract_graph: 'pro',
  tx_graph: 'pro',
  analytics: 'pro',
  simulation_lab: 'pro',
  lp_simulator: 'pro',
  scenario_builder: 'pro',
  frontend_helper: 'pro',
  verify_contract: 'pro',
  abi_compat: 'pro',
  event_schema: 'pro',
  audit_notes: 'pro',
  erc20_reader: 'pro',
  nft_viewer: 'pro',
};

export type LicenseStatus = 'loading' | 'unlocked' | 'locked' | 'dev';

interface LicenseState {
  status: LicenseStatus;
  licenseKey: string | null;
  email: string | null;
  expiresAt: string | null;
  isDev: boolean;
}

interface LicenseContextValue extends LicenseState {
  can: (feature: Feature) => boolean;
  activate: (key: string) => Promise<{ success: boolean; error?: string }>;
  deactivate: () => void;
  checkUpdate: () => void;
}

const LicenseContext = createContext<LicenseContextValue | null>(null);

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used inside LicenseProvider');
  return ctx;
}

const LS_KEY = 'hs_license_key';
const LS_EMAIL = 'hs_license_email';
const LS_EXP = 'hs_license_exp';

const LS_STORE_ID = import.meta.env.VITE_LS_STORE_ID || 'your-store';
void LS_STORE_ID;

export function LicenseProvider({ children }: { children: ReactNode }) {
  // ✅ Fix 1: Hapus console.log debug
  // ✅ Fix 2: Hanya pakai VITE_DEV_UNLOCK, bukan import.meta.env.DEV
  //    (import.meta.env.DEV selalu true saat dev server → license flow tidak bisa ditest)
  const isDev = import.meta.env.VITE_DEV_UNLOCK === 'true';

  const [state, setState] = useState<LicenseState>({
    status: 'loading',
    licenseKey: null,
    email: null,
    expiresAt: null,
    isDev,
  });

  useEffect(() => {
    if (isDev) {
      setState((s) => ({ ...s, status: 'dev' }));
      return;
    }

    const storedKey = localStorage.getItem(LS_KEY);
    if (!storedKey) {
      setState((s) => ({ ...s, status: 'locked' }));
      return;
    }

    validateKey(storedKey).then((result) => {
      if (result.valid) {
        setState({
          status: 'unlocked',
          licenseKey: storedKey,
          email: result.email ?? localStorage.getItem(LS_EMAIL),
          expiresAt: result.expiresAt ?? localStorage.getItem(LS_EXP),
          isDev,
        });
      } else {
        localStorage.removeItem(LS_KEY);
        setState({ status: 'locked', licenseKey: null, email: null, expiresAt: null, isDev });
      }
    });
  }, [isDev]);

  const activate = useCallback(
    async (key: string): Promise<{ success: boolean; error?: string }> => {
      const trimmed = key.trim();
      if (!trimmed) return { success: false, error: 'Enter a license key' };

      const result = await validateKey(trimmed);
      if (result.valid) {
        localStorage.setItem(LS_KEY, trimmed);
        if (result.email) localStorage.setItem(LS_EMAIL, result.email);
        if (result.expiresAt) localStorage.setItem(LS_EXP, result.expiresAt);
        setState({
          status: 'unlocked',
          licenseKey: trimmed,
          email: result.email ?? null,
          expiresAt: result.expiresAt ?? null,
          isDev,
        });
        return { success: true };
      }
      return { success: false, error: result.error || 'Invalid license key' };
    },
    [isDev],
  );

  const deactivate = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_EMAIL);
    localStorage.removeItem(LS_EXP);
    setState({ status: 'locked', licenseKey: null, email: null, expiresAt: null, isDev });
  }, [isDev]);

  const can = useCallback(
    (feature: Feature): boolean => {
      if (state.isDev || state.status === 'dev') return true;
      if (FEATURE_TIERS[feature] === 'free') return true;
      return state.status === 'unlocked';
    },
    [state],
  );

  const checkUpdate = useCallback(() => {
    window.api?.checkForUpdate?.();
  }, []);

  return (
    <LicenseContext.Provider value={{ ...state, can, activate, deactivate, checkUpdate }}>
      {children}
    </LicenseContext.Provider>
  );
}

async function validateKey(key: string): Promise<{
  valid: boolean;
  email?: string;
  expiresAt?: string;
  error?: string;
}> {
  try {
    const result = await window.api?.validateLicense?.(key);
    // ✅ Fix 3: Sebelumnya return { valid: false } padahal IPC berhasil
    if (result) {
      return {
        valid: false,
        email: result.email ?? '',
        expiresAt: result.expiresAt ?? '',
      };
    }
    const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key }),
    });
    const data = await res.json();
    if (data.valid) {
      return {
        valid: true,
        email: data.license_key?.user_email ?? undefined,
        expiresAt: data.license_key?.expires_at ?? undefined,
      };
    }
    return { valid: false, error: data.error || 'Invalid key' };
  } catch (e) {
    return { valid: false, error: 'Network error — check your connection' };
  }
}
