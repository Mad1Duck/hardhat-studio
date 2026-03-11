import { ipcMain } from 'electron';

const LEMON_VALIDATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/validate';

interface LicenseValid {
  valid: true;
  email: string | null;
  expiresAt: string | null;
}

interface LicenseInvalid {
  valid: false;
  error: string;
}

type LicenseResult = LicenseValid | LicenseInvalid;

//  IPC Handlers 
export function registerLicenseHandlers(): void {
  ipcMain.handle('validate-license', async (_, key: string): Promise<LicenseResult> => {
    try {
      const res = await fetch(LEMON_VALIDATE_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: key }),
      });

      const data = (await res.json()) as any;

      if (data.valid) {
        return {
          valid: true,
          email: data.license_key?.user_email ?? null,
          expiresAt: data.license_key?.expires_at ?? null,
        };
      }

      return { valid: false, error: data.error ?? 'Invalid license key' };
    } catch (e) {
      return { valid: false, error: String(e) };
    }
  });
}
