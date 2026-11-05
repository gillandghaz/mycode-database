# Panduan Kontribusi

Terima kasih sudah tertarik pada mycode-database.

Saat ini proyek ini **tidak menerima Pull Request**. Masukan sangat dihargai lewat **Issues**.

> **Catatan hak cipta:** proyek ini tidak memakai lisensi sumber terbuka (lihat [README](./README.md#-hak-cipta)). Jika Anda menuliskan saran atau contoh kode di sebuah *Issue*, Anda menyatakan bahwa Anda berhak membagikannya dan mengizinkan pemilik repositori memakainya dalam proyek ini tanpa batas waktu.

## Cara memberi masukan

- **Bug:** buka *Issue* dan jelaskan langkah reproduksi, hasil yang diharapkan vs. yang terjadi, serta perangkat/OS/browser. Untuk masalah pada tombol **Run**, sebutkan juga pesan galat yang tampil di panel Output. Lampirkan tangkapan layar bila membantu, **tanpa data pribadi**.
- **Saran fitur atau perbaikan:** buka *Issue* dan jelaskan masalah yang ingin diselesaikan serta usulan Anda.
- **Masalah keamanan:** jangan lewat *Issue*. Ikuti [SECURITY.md](./SECURITY.md).

## Yang jangan disertakan

Jangan menyertakan rahasia (kunci API, *service account*, isi `.env*`), token, data pengguna, kode milik pengguna lain, atau tautan pribadi dalam *Issue*, tangkapan layar, maupun log. Bila perlu menunjukkan kode yang bermasalah, gunakan contoh sekecil mungkin yang Anda tulis sendiri.

## Untuk pengelola

- Operasi sensitif (otorisasi, pendaftaran, peran admin, safe mode, izin menjalankan kode, penghapusan akun, eksekusi kode) divalidasi di **server** dan di `firestore.rules`, bukan hanya di antarmuka.
- Firestore menyimpan kode dan metadata: pohon folder di `nodes`, isi kode di `fileContents`. Batas ukuran (`MAX_FILE_CHARS`) harus konsisten di `src/lib/tree.ts`, `firestore.rules`, dan `src/app/api/run/route.ts`.
- Kode pengguna dijalankan oleh layanan compiler eksternal lewat `src/lib/runner/`. Provider baru cukup mengimplementasikan `CodeRunner` dan didaftarkan di `getRunner()`.
- Pengaturan yang hanya boleh diubah admin (izin Run, kontak) ditulis lewat Route Handler dengan Admin SDK, bukan lewat aturan tulis di klien.
- `firestore.rules` dipublikasikan manual setiap kali berubah.
- Jaga agar `npm audit` tetap tanpa kerentanan; jangan menghapus blok `overrides` di `package.json` tanpa pengujian di Vercel, dan selalu commit `package-lock.json` bersama `package.json`.
- Sebelum menggabungkan perubahan, jalankan `npm run typecheck` dan `npm run build`.
- Pesan commit memakai format [Conventional Commits](https://www.conventionalcommits.org/), mis. `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`.
