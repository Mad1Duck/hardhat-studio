# WalletConnect Setup Guide

## Cara Kerja
- WalletConnect SDK (`@walletconnect/sign-client`) berjalan di **main process** (Node.js) — bukan di browser popup
- Popup HTML hanya me-render QR code dari URI yang dikirim via IPC
- Ini menghindari semua masalah CDN/ESM di Electron browser context

## Setup (WAJIB sebelum QR bisa muncul)

### 1. Install dependency
```bash
npm install
```

### 2. Dapat Project ID GRATIS
- Buka https://dashboard.reown.com (WalletConnect = Reown)
- Daftar/login → Create Project → copy Project ID

### 3. Set di .env
```
VITE_WC_PROJECT_ID=paste_project_id_kamu_disini
```

### 4. Run app
```bash
npm run dev
# atau
npm start
```

## Tanpa Project ID
Popup tetap bisa digunakan dengan **input manual** (paste alamat wallet).
QR code section akan menampilkan pesan error yang jelas.

## Troubleshooting
- QR stuck loading → cek apakah `@walletconnect/sign-client` terinstall (`npm install`)
- QR error "NO_PROJECT_ID" → set `VITE_WC_PROJECT_ID` di `.env`
- MetaMask "N/A" → normal, MetaMask browser extension tidak inject ke Electron window
