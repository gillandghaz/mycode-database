# Kebijakan Keamanan

Keamanan pengguna dan datanya adalah prioritas. Terima kasih sudah membantu menjaga mycode-database tetap aman.

## Melaporkan kerentanan

**Jangan membuka *issue* publik** untuk masalah keamanan. Laporkan secara privat lewat salah satu cara berikut:

1. **Disarankan:** gunakan [*Report a vulnerability*](../../security/advisories/new) di tab **Security** repositori ini (GitHub *Private vulnerability reporting*).
2. Jika cara di atas tidak tersedia, hubungi pemilik repositori lewat kontak yang tercantum pada profil GitHub, dan **jangan** menuliskan rincian teknis di tempat publik.

Mohon sertakan:

- deskripsi masalah dan dampaknya,
- langkah untuk mereproduksi,
- versi/commit atau deployment yang diuji, dan lingkungan (browser/perangkat),
- bukti konsep seminimal mungkin.

### Yang kami harapkan dari pelapor

- Uji hanya dengan akun Anda sendiri. **Jangan mengakses, mengubah, atau menghapus kode atau data pengguna lain.**
- Jangan melakukan serangan yang mengganggu ketersediaan layanan (mis. banjir permintaan/DoS), spam, atau rekayasa sosial.
- **Jangan menyalahgunakan fitur Run**: tidak untuk menghabiskan kuota layanan compiler, menyerang pihak lain dari kode yang dijalankan, atau mencoba keluar dari lingkungan eksekusi layanan pihak ketiga.
- Jangan menyebarkan temuan sebelum diperbaiki; beri waktu yang wajar.

### Yang bisa Anda harapkan dari kami

- Laporan ditanggapi dengan upaya terbaik, dan perkembangannya akan dikabarkan.
- Pelapor yang beritikad baik dan mengikuti panduan di atas tidak akan dipersulit.
- Atribusi/ucapan terima kasih bila Anda menghendakinya.

## Versi yang didukung

Hanya kode terbaru di cabang `main` dan deployment produksi yang bersumber darinya.

## Cakupan

**Dalam cakupan:** kode aplikasi, Route Handlers `/api/*` (`auth/gate`, `auth/session`, `run`, `admin/delete-user`), logika pendaftaran, safe mode admin, import/export, dan `firestore.rules`.

**Di luar cakupan:** layanan pihak ketiga (Firebase, Vercel, GitHub, serta layanan compiler onlinecompiler.io atau Piston yang menjalankan kode), serangan yang memerlukan akses fisik ke perangkat korban, rekayasa sosial, serta laporan otomatis tanpa dampak keamanan nyata (mis. temuan *scanner* tanpa bukti eksploitasi).

> Kode yang diketik pengguna dijalankan di infrastruktur layanan compiler eksternal, bukan di server aplikasi ini. Kelemahan pada lingkungan eksekusi tersebut sebaiknya dilaporkan langsung ke penyedia layanannya.

## Praktik bagi pengelola

- Jangan pernah meng-commit `.env.local` atau berkas *service account*.
- Putar (rotate) kunci jika dicurigai bocor: private key Firebase dan kunci API compiler (`ONLINECOMPILER_API_KEY`). Setelah memutar, perbarui nilainya di Vercel dan **redeploy**.
- Publikasikan ulang `firestore.rules` setiap kali berubah (tidak ter-deploy otomatis).
- Biarkan admin dalam **safe mode** kecuali sedang melakukan perubahan yang memang perlu; nyalakan kembali setelah selesai.
- Bersihkan berkala akun Firebase Authentication yang tidak memiliki profil (sisa pendaftaran yang gagal atau dibuat langsung lewat API Firebase saat pendaftaran ditutup).
- Jalankan `npm audit` secara berkala dan tanggapi peringatan Dependabot.
- Uji pembaruan dependensi secara manual sebelum menggabungkannya, terutama paket yang diatur lewat blok `overrides` di `package.json` (saat ini `jwks-rsa` → `jose@4.15.9`). Jangan lupa meng-commit `package-lock.json`.
