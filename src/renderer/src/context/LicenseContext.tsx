/**
 * LicenseContext.tsx — shim untuk backwards compatibility
 * Semua logic sudah pindah ke SablierContext.tsx
 * File ini hanya re-export agar import lama tidak perlu diubah.
 */
export {
  useLicense,
  LicenseProvider,
  FEATURE_TIERS,
  RECIPIENT_ADDRESS,
  type Feature,
} from './SablierContext';
