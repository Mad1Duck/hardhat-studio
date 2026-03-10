# Cara Install Patch WalletConnect Inline QR

## Jika kamu menjalankan dengan `npm run dev` (source mode):
Semua source files sudah diupdate. Tinggal:
```bash
npm install                          # install @walletconnect/sign-client
echo "VITE_WC_PROJECT_ID=xxx" >> .env  # ganti xxx dengan project ID dari dashboard.reown.com
npm run dev
```

## Jika kamu menjalankan dari folder `out/` (compiled/packaged):
Copy file-file ini dari zip ke project kamu:
- `out/main/index.js`    ← main process dengan wc-get-uri handler
- `out/preload/index.js` ← preload dengan wcGetUri + onWcApproved
- `src/renderer/src/components/SablierUI.tsx` ← UI dengan inline QR component

Kemudian rebuild renderer:
```bash
npm install
npm run build
```

## Dapat Project ID WalletConnect (GRATIS):
1. Buka https://dashboard.reown.com
2. Daftar / login
3. New Project → copy Project ID
4. Set di `.env`: `VITE_WC_PROJECT_ID=your_project_id`

## Tanpa Project ID:
QR section menampilkan pesan error — tetap bisa pakai input manual di bawahnya.
