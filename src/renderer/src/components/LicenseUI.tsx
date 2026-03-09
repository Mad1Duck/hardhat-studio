/**
 * LicenseUI.tsx — shim untuk backwards compatibility
 * Semua komponen sudah pindah ke SablierUI.tsx
 * File ini hanya re-export agar import lama di App.tsx / Sidebar.tsx tidak perlu diubah.
 */
export { LicenseGate, LicenseModal, LicenseBadge } from './SablierUI';
