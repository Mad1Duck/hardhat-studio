/**
 * LicenseContext.tsx — shim untuk backwards compatibility
 * Semua logic sudah pindah ke SablierContext.tsx
 * File ini hanya re-export agar import lama tidak perlu diubah.
 */
export {
  useLicense,
  useSablier,
  LicenseProvider,
  SablierProvider,
  FEATURE_TIERS,
  RECIPIENT_ADDRESS,
  type Feature,
  type LicenseStatus,
  type SubscriptionStatus,
  type StreamInfo,
} from './SablierContext';
