<div align="center">

<img src="./public/icon.svg" alt="Logo mycode-database" width="96" />

# mycode-database

**Rumah online untuk kode Anda — folder sendiri, editor di browser, dan compiler Java bawaan, di perangkat apa pun.**

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![Compiler](https://img.shields.io/badge/Compiler-onlinecompiler.io-1F6FEB)
![Node](https://img.shields.io/badge/Node-%E2%89%A5%2022-339933?logo=nodedotjs&logoColor=white)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)

[Fitur](#-fitur) · [Arsitektur](#-arsitektur) · [Mulai Cepat](#-mulai-cepat) · [Konfigurasi](#-konfigurasi) · [API](#-referensi-api) · [Keamanan](#-keamanan) · [Peta Jalan](#-peta-jalan--batasan-yang-diketahui) · [Hak Cipta](#-hak-cipta)

</div>

---

## Ringkasan

mycode-database adalah aplikasi web untuk menyimpan, mengedit, dan menjalankan kode, terutama bagi pelajar. Setiap pengguna memiliki ruang kerja (*workspace*) pribadi berisi folder dan file Java; admin mengelola pengguna, peran, dan pendaftaran.

Prinsip rancangan:

| Prinsip | Penerapan |
|---|---|
| **Firestore untuk kode dan metadata** | Pohon folder (`nodes`) dipisah dari isi kode (`fileContents`) agar daftar file tetap ringan. |
| **Kode tidak dijalankan di Vercel** | Vercel tidak memiliki JDK. Eksekusi dikirim oleh server ke layanan compiler eksternal. |
| **Server sebagai penjaga** | Pembatasan pendaftaran, penghapusan akun, dan eksekusi kode ditegakkan di server, bukan hanya di UI. |
| **Aman secara bawaan** | Admin masuk dalam *safe mode* (hanya-baca) sampai sengaja dimatikan. |

> **Hak cipta:** kode sumber ini dipublikasikan agar dapat **dilihat dan dipelajari**. Tidak ada lisensi yang memberi izin menyalin, memodifikasi, atau menyebarkannya tanpa izin tertulis pemilik. Lihat [Hak Cipta](#-hak-cipta). Panduan teknis di bawah ditujukan bagi pemilik/pengelola proyek.

---

## ✨ Fitur

### Tampilan di ponsel & tablet
- Tata letak menyesuaikan layar (iOS dan Android): tidak ada halaman yang lebih lebar dari layar, dan sidebar editor menjadi panel geser.
- Teks satu baris yang terlalu panjang (nama file/folder, tab, nama pengguna, email, kontak) dipotong dengan “…”; paragraf tetap membungkus dan kata panjang dipecah agar tidak melebar.
- Kolom input dan editor memakai ukuran 16 px di layar sentuh sehingga iOS tidak memperbesar halaman saat kolom difokuskan; target sentuh dibuat seukuran jari; area aman (notch dan indikator Home) dihormati.

### Workspace
- **Folder bersarang** (hingga kedalaman 12): buat, ganti nama, pindah, hapus.
- **Pindah dengan drag and drop**, atau lewat menu **Move to…** (praktis di ponsel).
- **Template awal** saat membuat file: *Empty class*, *Hello, World!*, *Variables & types*, *Loops*, *Read input (Scanner)*.

### Editor
- CodeMirror 6 dengan tema One Dark: sorotan sintaks Java, nomor baris, lipat kode, dan autocompletion.
- **Autosave** 900 ms setelah berhenti mengetik; `Ctrl+S` menyimpan seketika.
- Banyak tab, penanda perubahan belum tersimpan, dan peringatan sebelum menutup halaman.

### Menjalankan kode
- **Run** atau `Ctrl+Enter` mengompilasi dan menjalankan file yang sedang terbuka. **OOP lintas file:** class yang dipakai dari file lain (di folder yang sama atau subfoldernya) ikut diambil otomatis; lihat [Menjalankan beberapa file](#menjalankan-beberapa-file-oop-lintas-file).
- Panel bergaya terminal: tab **Output** (stdout, stderr, kode keluar, durasi) dan tab **Input** (stdin untuk program ber-`Scanner`).

### Import & Export
Tersedia di menu titik tiga Explorer.
- **Folder:** *Import files here…* (`.java` atau `.zip`, struktur folder terjaga) dan *Export folder (.zip)*.
- **File:** *Download file*.
- Aturan impor sama ketatnya dengan "New file/folder": nama valid, ukuran, kedalaman, dan teks UTF-8. File yang bentrok nama **dilewati**, tidak menimpa. Ringkasan hasil ditampilkan setelah impor.

### Akun & administrasi
- Login **Email + Password** dan **Google**; username unik; lupa kata sandi lewat tautan reset.
- **Foto profil:** unggah dan ganti di Dashboard → Account (JPG/PNG/WebP, dipotong persegi dan dikecilkan ke 256×256 di browser). Foto tampil di menu profil. Sengaja tidak ada fitur hapus foto.
- Dashboard: *Overview* (jumlah folder/file, ukuran kode, 5 file terakhir), *Account*, *Settings* (ukuran font, word wrap, kurangi animasi).
- Panel admin: daftar pengguna (lengkap dengan foto profil di kolom User), buka workspace pengguna, ubah peran, hapus akun, dan **saklar buka/tutup pendaftaran** (ditegakkan di server). Tombol **Manage in Admin** di editor langsung membuka tab Admin (`/dashboard?tab=admin`).
- **Izin menjalankan kode:** saklar *Allow everyone to run code*. Saat dimatikan, hanya pengguna yang dipilih lewat tombol **Edit** (di samping saklar) yang bisa Run; yang lain melihat pesan, dan server menolak permintaannya (`403 run-disabled`). Admin tidak dikecualikan otomatis.
- **Menu Contact** (paling bawah di dashboard, tampilan mengikuti proyek Gramofon): semua pengguna melihat daftar kontak dan tautannya, dan perubahan admin langsung terlihat tanpa memuat ulang. Admin mengedit **per kontak** lewat ikon pensil di samping nama (popup berisi *Nama jenis kontak*, *Judul kontak* opsional, dan *Tautan / isi*, dengan tombol Hapus), menambah lewat **+ Tambah kontak**, dan mengubah teks **deskripsi**. Nama atau tautan yang kosong tampil sebagai “-”. Email, nomor telepon, dan domain tanpa skema (mis. `github.com/nama`) otomatis menjadi tautan; skema berbahaya seperti `javascript:` tidak pernah dijadikan tautan.
- **Safe mode** admin: melihat kode pengguna lain boleh, mengubahnya hanya setelah safe mode dimatikan.
- Akun yang dinonaktifkan atau dicabut di Firebase otomatis dikeluarkan dari sesi (diperiksa tiap 15 detik).

---

## 🏗 Arsitektur

```mermaid
flowchart LR
    B[Browser] -->|SDK klien + Security Rules| FS[(Firestore)]
    B -->|SDK klien| FA[Firebase Auth]
    B -->|"/api/* + ID token"| API[Next.js Route Handlers]
    API -->|Admin SDK| FS
    API -->|Admin SDK| FA
    API -->|"kode + stdin (kunci API di server)"| CC[(onlinecompiler.io)]
```

**Alur menjalankan kode**

```mermaid
sequenceDiagram
    participant U as Browser
    participant S as Server (/api/run)
    participant C as Layanan compiler
    U->>S: 1. Run (kode, stdin, ID token)
    S->>S: Verifikasi sesi & profil, validasi nama file dan ukuran
    S->>C: 2. Kirim kode (kunci API hanya di server)
    alt layanan menjawab
        C-->>S: stdout, stderr, kode keluar
        S-->>U: 3. Hasil untuk panel Output
    else kunci ditolak / sibuk / timeout
        S-->>U: Galat 502 / 429 / 504 dengan pesan yang terbaca
    end
```

**Alur gerbang pendaftaran**

```mermaid
sequenceDiagram
    participant U as Browser
    participant A as Firebase Auth
    participant S as Server (/api/auth/gate)
    U->>A: 1. Buat akun (email atau Google)
    U->>S: 2. Minta izin membuat profil (ID token)
    S->>S: Profil sudah ada? Pendaftaran terbuka?
    alt pendaftaran ditutup
        S->>A: Hapus akun baru
        S-->>U: 403 registration-closed
        U->>U: Keluar dan tampilkan pesan
    else terbuka
        S-->>U: OK
        U->>U: 3. Buat profil (Security Rules memeriksa ulang)
    end
```

Kunci admin Firebase dan kunci API compiler **tidak pernah** meninggalkan server.

### Teknologi

| Lapisan | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Bahasa | TypeScript (mode `strict`) |
| Autentikasi & data | Firebase Authentication, Cloud Firestore |
| Server | Route Handlers Next.js, Firebase Admin SDK |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Zip | `fflate` |
| Compiler | onlinecompiler.io (utama); Piston (opsional, belum diuji) |
| Hosting | Vercel (disarankan) |

---

## 🚀 Mulai Cepat

**Prasyarat:** Node.js ≥ 22, npm, akun Firebase, dan (agar Run aktif) kunci API onlinecompiler.io.

```bash
npm install
cp .env.local.example .env.local   # lalu isi nilainya (lihat Konfigurasi)
npm run dev
```

Buka <http://localhost:3000>.

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm run start` | Jalankan hasil build |
| `npm run typecheck` | Pemeriksaan tipe TypeScript |

> Sebelum mencoba login atau Run, selesaikan [Konfigurasi](#-konfigurasi) dan publikasikan `firestore.rules`.

---

## ⚙️ Konfigurasi

### Variabel lingkungan

Salin `.env.local.example` → `.env.local`. **Jangan meng-commit** berkas ini (sudah ada di `.gitignore`).

| Variabel | Lingkup | Sumber |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Publik | Firebase → Project settings → Your apps |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Publik | idem |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Publik | idem |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Publik | idem |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Publik | idem |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Publik | idem |
| `FIREBASE_ADMIN_PROJECT_ID` | 🔒 Server | Service account (JSON) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | 🔒 Server | Service account (JSON) |
| `FIREBASE_ADMIN_PRIVATE_KEY` | 🔒 Server | Service account (JSON), termasuk `\n`, dibungkus tanda kutip ganda |
| `RUNNER_PROVIDER` | 🔒 Server | `onlinecompiler` atau `piston`; kosong = Run dinonaktifkan |
| `ONLINECOMPILER_API_KEY` | 🔒 Server | Halaman API keys onlinecompiler.io |
| `ONLINECOMPILER_JAVA_COMPILER` | 🔒 Server | Opsional; mengganti id compiler Java (bawaan `openjdk-25`) |
| `PISTON_URL`, `PISTON_API_KEY` | 🔒 Server | Opsional; server Piston milik sendiri (belum diuji) |

> Konfigurasi web Firebase (`NEXT_PUBLIC_*`) memang publik. Data dilindungi oleh **Security Rules** dan **Authorized domains**, bukan oleh kerahasiaan nilai ini. Rahasia **tidak boleh** diberi awalan `NEXT_PUBLIC_`.

> Perubahan variabel lingkungan di Vercel baru berlaku setelah **redeploy**.

### Firebase

1. Buat project Firebase.
2. **Authentication:** aktifkan *Email/Password* dan *Google*.
3. **Firestore:** buat database (mode production).
4. Isi `NEXT_PUBLIC_FIREBASE_*` dari *Project settings → Your apps*.
5. **Service account:** *Project settings → Service accounts → Generate new private key*; isi tiga variabel `FIREBASE_ADMIN_*`. Jangan simpan berkas JSON di repositori.
6. **Security Rules:** salin seluruh isi [`firestore.rules`](./firestore.rules) ke *Firestore → Rules*, lalu **Publish** (atau `npx firebase-tools deploy --only firestore:rules`).
   > Rules **tidak ter-deploy otomatis** bersama aplikasi. Publikasikan ulang setiap kali berkas berubah.
7. **Authorized domains:** daftarkan `localhost` dan domain produksi di *Authentication → Settings*.

### Compiler

1. Buat kunci API di onlinecompiler.io, lalu isi `ONLINECOMPILER_API_KEY`.
2. Setel `RUNNER_PROVIDER=onlinecompiler`. Tanpa ini, tombol Run menampilkan "Not available yet".
3. Id compiler Java bawaan adalah `openjdk-25`. Daftar id yang tersedia ada di `GET https://api.onlinecompiler.io/api/compilers/`; bila berbeda, isi `ONLINECOMPILER_JAVA_COMPILER`.
4. Paket gratis memiliki kuota bulanan dari penyedia. Pantau di akun onlinecompiler.io.

Batas eksekusi: hanya Java. File yang dijalankan beserta file lain yang dirujuknya dikirim sebagai satu permintaan (lihat bagian berikut). Waktu tunggu server 25 detik.

### Akun admin pertama

Peran admin sengaja tidak bisa diberikan lewat pendaftaran:

1. Daftar akun lewat aplikasi.
2. Firestore → koleksi `users` → dokumen akun Anda.
3. Ubah field `role` menjadi `admin`.

Admin baru mulai dengan **safe mode ON**.

### Deploy ke Vercel

1. Dorong repositori ke GitHub, lalu **Import** di Vercel.
2. Isi semua variabel lingkungan di *Settings → Environment Variables*.
3. Deploy, lalu tambahkan domain Vercel ke *Authorized domains* Firebase.
4. Pastikan `firestore.rules` terbaru sudah dipublikasikan.

> ⚠️ Blok `overrides` di `package.json` (`jwks-rsa` → `jose@4.15.9`) diperlukan agar `firebase-admin` kompatibel dengan runtime serverless Vercel. Menghapusnya, atau tidak meng-commit `package-lock.json`, dapat memunculkan `ERR_REQUIRE_ESM`.

---

## 🗂 Model Data

Firestore menyimpan kode dan metadata.

| Koleksi / dokumen | Isi utama |
|---|---|
| `users/{uid}` | `email`, `username`, `displayName`, `role`, `settings` (font, word wrap, kurangi animasi), `adminSafeMode` (admin) |
| `usernames/{username}` | pemetaan username unik → uid |
| `settings/app` | saklar pendaftaran (`registrationOpen`) |
| `nodes/{id}` | folder dan metadata file: `ownerUid`, `parentId`, `type`, `name`, `size`, waktu |
| `fileContents/{id}` | isi kode (maksimal 200.000 karakter); id sama dengan node file |
| `avatars/{uid}` | foto profil: `dataUrl` (JPEG, ≤ 120.000 karakter); pemilik bisa menambah/mengganti, tidak bisa menghapus |
| `settings/run` | `allowAll` (false = hanya pengguna terpilih yang boleh Run); ditulis server saja |
| `settings/contacts` | `items`: daftar `{ id, type, title, link }` (maks. 20) dan `description` (maks. 500 karakter); ditulis server saja |
| `users/{uid}.runAllowed` | `true` = pengguna ini boleh Run saat `allowAll` mati; hanya diubah admin lewat server |

Aturan nama: username 3–20 karakter (`a-z 0-9 _`); nama file/folder maksimal 64 karakter; nama file harus pengenal Java yang sah berakhiran `.java` (nama file = nama class).

---

## 🔌 Referensi API

Semua endpoint memakai `POST` dengan header `Authorization: Bearer <Firebase ID token>`. Token diverifikasi di server beserta pengecekan pencabutan sesi. Galat berformat `{ "error": "...", "code": "..." }`.

| Endpoint | Akses | Fungsi |
|---|---|---|
| `/api/auth/gate` | Pengguna | Menolak profil baru (dan menghapus akun Auth barunya) saat pendaftaran ditutup |
| `/api/auth/session` | Pengguna | Validasi sesi (dipakai pemeriksaan berkala klien) |
| `/api/run` | Pengguna (diizinkan Run) | Kompilasi dan jalankan file Java (opsional bersama file lain yang dirujuknya) |
| `/api/admin/run-access` | Admin | Atur `allowAll` dan daftar pengguna yang boleh Run |
| `/api/admin/contacts` | Admin | Simpan daftar kontak (maks. 20; panjang dibatasi) |
| `/api/admin/delete-user` | Admin, safe mode OFF | Hapus akun Authentication beserta seluruh datanya |

**`POST /api/run`**

```json
// Permintaan
{ "language": "java", "fileName": "Main.java", "code": "...", "stdin": "...",
  "files": [ { "name": "Dog.java", "code": "..." } ] }   // "files" opsional (maks. 30)

// Respons 200
{ "phase": "run", "stdout": "...", "stderr": "...", "exitCode": 0, "durationMs": 812,
  "bundled": ["Dog.java"] }   // "bundled" hanya ada bila ada file tambahan
```

Validasi: `language` harus `"java"`; `fileName` cocok `^[A-Za-z_][A-Za-z0-9_]{0,63}\.java$`; `code` ≤ 200.000 karakter; `stdin` ≤ 10.000 karakter; `files` maks. 30 entri, tiap `name` mengikuti aturan `fileName`, tiap `code` ≤ 200.000 karakter, dan gabungan seluruhnya ≤ 500.000 karakter.

| Status | `code` | Arti |
|---|---|---|
| 400 | `bad-language` / tanpa kode | Masukan tidak valid |
| 401 | `no-token`, `invalid-session`, `session-revoked` | Sesi tidak valid |
| 403 | `no-profile` | Akun Auth tanpa profil |
| 403 | `run-disabled` | Run dimatikan untuk akun ini oleh admin |
| 429 | `runner-error` | Compiler sibuk atau kuota habis |
| 502 | `runner-error` | Kunci ditolak atau layanan tidak terjangkau |
| 503 | `runner-unavailable` | `RUNNER_PROVIDER` belum diatur |
| 504 | `runner-timeout` | Compiler terlalu lama menjawab |

---

## Menjalankan beberapa file (OOP lintas file)

Layanan compiler hanya menerima **satu** sumber per permintaan dan menjalankannya dengan *source launcher* Java (`java Main.java`): tidak ada langkah kompilasi terpisah, nama class bebas, dan beberapa class tingkat-atas (termasuk yang `public`) boleh berada dalam satu file. Karena itu, saat Anda menekan Run:

1. **Editor mencari file yang dibutuhkan.** Mulai dari file yang dijalankan, setiap nama class yang cocok dengan **nama file lain** (`Dog` ↔ `Dog.java`) diikuti, lalu nama-nama yang dipakai file itu, dan seterusnya. Pencarian hanya melihat kode sebenarnya (komentar dan string diabaikan) dan memakai isi editor terbaru, termasuk yang belum tersimpan.
2. **Server menggabungkan** file-file itu menjadi satu sumber dengan **file yang dijalankan di urutan pertama**. Deklarasi `package` dihapus, `import` dikumpulkan di atas, import ke paket milik proyek dibuang, nama lengkap seperti `models.Dog` disederhanakan menjadi `Dog`, dan `public` pada class tingkat-atas dilepas (tidak berpengaruh dalam satu paket).
3. **Nomor baris dipetakan kembali.** Pesan error dan stack trace ditampilkan dengan nama dan baris file aslinya, mis. `Dog.java:7`, bukan baris di sumber gabungan.

**Lingkup:** folder file yang dijalankan beserta subfoldernya. Jika file itu mendeklarasikan `package` yang sesuai dengan nama folder (mis. `src/app/Main.java` dengan `package app;`), lingkupnya naik ke folder di atas paket (`src/`), sehingga `src/models/` ikut terjangkau. File yang tidak dirujuk, termasuk `Main.java` lain di folder berbeda, tidak pernah ikut.

**Aturan dan batas:** maksimal 30 file tambahan dan 500.000 karakter total. Bila ada beberapa file bernama sama, yang dipilih adalah yang cocok dengan `import`, lalu yang sefolder, lalu yang paling dekat ke akar.

**Batasan yang perlu diketahui:**
- File ditemukan lewat **nama file = nama class** (konvensi Java). Class tambahan yang dideklarasikan di file lain dengan nama berbeda tidak akan ditemukan, kecuali file itu ikut karena alasan lain.
- `import static` ke class milik proyek tidak didukung setelah penggabungan.
- Class pertama di file yang dijalankan harus berisi `main`, sama seperti aturan `java File.java`.
- *Compact source file* Java 25 (`void main()` tanpa class) tidak dirancang untuk digabung dengan class lain.
- Hanya `stderr` yang dipetakan ulang nomor barisnya; keluaran biasa program tidak pernah diubah.

---

## 🔐 Keamanan

| Area | Penerapan |
|---|---|
| Autentikasi | ID token diverifikasi di server dengan `checkRevoked`; akun nonaktif/dicabut ditolak seketika |
| Otorisasi | Peran admin dibaca ulang dari Firestore di server; Security Rules mencegah pengguna mengubah `role` sendiri |
| Safe mode | Admin tidak dapat mengubah kode, peran, atau menghapus akun orang lain selama safe mode ON; ditegakkan oleh Rules dan server |
| Pendaftaran | Saklar ditegakkan tiga lapis: UI, gerbang server, dan Security Rules; termasuk pendaftaran Google |
| Gagal-tertutup | Jika gerbang pendaftaran gagal, akun baru dihapus dan sesi ditutup (tidak ada akun/sesi tanpa profil) |
| Eksekusi kode | Wajib login dan berprofil; izin Run diperiksa di server (bukan hanya tombol); nama file dan ukuran divalidasi; kunci compiler hanya dibaca server |
| Pengaturan admin | Izin Run dan kontak ditulis lewat server setelah peran admin diperiksa ulang; klien tidak punya aturan tulis untuk dokumen ini |
| Foto profil | Dikecilkan di browser; Rules membatasi prefiks `data:image/jpeg;base64` dan ukuran; antarmuka memvalidasi ulang sebelum menampilkan |
| Tautan kontak | Hanya skema aman yang dijadikan tautan (`rel="noopener noreferrer nofollow"`); `javascript:` dan sejenisnya tampil sebagai teks biasa |
| Import | Nama, ukuran, kedalaman, dan encoding divalidasi; entri tersembunyi dan path berbahaya (`../`) diabaikan |
| Rahasia | Kunci admin Firebase dan kunci compiler hanya dibaca server |
| Header HTTP | HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` |
| Dependensi | `npm audit` melaporkan 0 kerentanan saat dokumen ini ditulis; jalankan berkala |

Pelaporan celah keamanan: lihat [SECURITY.md](./SECURITY.md).

<details>
<summary><b>Daftar periksa bagi pengelola (sebelum rilis)</b></summary>

- [ ] `.env.local` dan berkas JSON *service account* tidak pernah ter-commit (`git log --all -- .env.local`, dan cari nama berkas rahasia lain di riwayat).
- [ ] Jika ada rahasia yang pernah ter-commit, **putar (rotate)**: buat ulang private key Firebase dan kunci API compiler. Menghapus berkas tidak cukup karena tetap ada di riwayat.
- [ ] `firestore.rules` terbaru sudah dipublikasikan di Firebase Console.
- [ ] *Authorized domains* Firebase hanya berisi domain yang dipakai.
- [ ] Kuota/penggunaan akun compiler dipantau.
- [ ] Akun Authentication tanpa profil (sisa pendaftaran yang gagal) dibersihkan di Firebase Console → Authentication.
- [ ] *Dependabot alerts*, *Private vulnerability reporting*, dan (bila tersedia) *Secret scanning* aktif di GitHub.

</details>

---

## 📱 Catatan Perangkat Mobile

- Explorer dibuka lewat tombol menu di bilah atas; memilih file menutupnya otomatis.
- Memindahkan di layar sentuh: gunakan menu titik tiga → **Move to…** (drag and drop dirancang untuk mouse).
- Impor memakai pemilih berkas bawaan perangkat; ekspor mengunduh `.zip`/`.java` lewat pengunduhan browser.

---

## 🧭 Peta Jalan & Batasan yang Diketahui

Transparan soal kondisi saat ini:

| Status | Item |
|---|---|
| ⚠️ Belum ada | Tes otomatis dan CI |
| ⚠️ Belum ada | Pembatasan laju (*rate limit*) pada `/api/run`; setiap pengguna yang masuk memakai kuota compiler yang sama |
| ⚠️ Sebagian | CSP masih *Report-Only* dan memperbolehkan `'unsafe-inline'` untuk skrip |
| ⚠️ Sebagian | Security Rules dipublikasikan manual dan belum diuji dengan Firebase Emulator |
| ⚠️ Sebagian | Impor banyak file menulis dalam batch 100 operasi; batasnya terhadap rules belum diuji di proyek asli |
| ⚠️ Sebagian | Rules baru (`avatars`, `settings/run`, `settings/contacts`) belum diuji di emulator atau proyek Firebase asli |
| ⚠️ Sebagian | Provider Piston ditulis dari dokumentasi dan belum diuji ke server nyata |
| ⚠️ Terbatas | Hanya Java; eksekusi multi-file memakai penggabungan sumber (lihat batasannya di bagian Menjalankan beberapa file) |
| ⚠️ Belum ada | Verifikasi email dan fitur hapus akun oleh pengguna sendiri |
| 🔧 Rencana | Menegakkan CSP, menambah tes untuk API dan rules, rate limit per pengguna, otomatisasi deploy rules |
| 🔧 Rencana | Dukungan bahasa tambahan |

---

## 🧰 Pemecahan Masalah

| Gejala | Penyebab & solusi |
|---|---|
| `auth/unauthorized-domain` saat login Google | Tambahkan domain ke *Authorized domains* Firebase |
| `permission-denied` | `firestore.rules` belum dipublikasikan ulang, atau mengedit milik orang lain saat safe mode ON |
| Semua `/api/*` menjawab 500 "Server error." | Periksa `FIREBASE_ADMIN_*` di Vercel, redeploy, lihat log fungsi |
| `ERR_REQUIRE_ESM` di log | Pastikan blok `overrides` di `package.json` ada dan `package-lock.json` ter-commit |
| Run: "Not available yet" | `RUNNER_PROVIDER` kosong; setel `onlinecompiler` lalu redeploy |
| Run: "rejected the API key" | Periksa/ganti `ONLINECOMPILER_API_KEY` |
| Run: "busy or the monthly limit" | HTTP 429 dari layanan; tunggu atau cek kuota |
| Run: `Compiler service error (HTTP 4xx): …` | Mis. id compiler tidak dikenal; cek daftar id dan isi `ONLINECOMPILER_JAVA_COMPILER` |
| Impor banyak file gagal "permission-denied" | Kecilkan `IMPORT_BATCH` di `src/lib/fs.ts` |
| Daftar ditolak "Sign-ups are currently closed" | Saklar pendaftaran OFF (perilaku yang benar); nyalakan di Dashboard → Admin |

---

## 🗃 Struktur Proyek

```text
src/
├─ app/
│  ├─ page.tsx              Landing page
│  ├─ login/ · register/    Autentikasi
│  ├─ dashboard/            Overview, Account, Settings, Admin
│  ├─ app/                  Editor (Explorer, tab, editor, terminal)
│  └─ api/                  Route Handlers: auth/gate, auth/session, run, admin/delete-user
├─ components/
│  ├─ ide/                  Ide, FileTree, NodeDialogs, Terminal
│  ├─ tabs/                 Tab dashboard
│  └─ landing/              Nav, EditorMock, AuthRedirect
└─ lib/
   ├─ runner/               Pemilih provider compiler (onlinecompiler, piston)
   ├─ fs.ts · tree.ts       Akses Firestore dan fungsi murni pohon file
   ├─ transfer.ts           Logika import/export
   ├─ java-bundle.ts        Penggabungan beberapa file Java + pemetaan baris error
   ├─ java-scope.ts         Menentukan lingkup file yang boleh dipakai
   ├─ avatar.ts             Foto profil (crop, kecilkan, simpan)
   ├─ run-access.ts         Izin Run (hook klien + pemanggil API admin)
   ├─ contacts.ts           Data kontak + pembersih tautan
   └─ server-auth.ts · firebase-admin.ts   Verifikasi token, cek admin (server)
firestore.rules             Security Rules Firestore
next.config.mjs             Header keamanan & CSP
.env.local.example          Templat variabel lingkungan (tanpa nilai)
SECURITY.md                 Kebijakan pelaporan celah keamanan
CONTRIBUTING.md             Panduan kontribusi
```

---

## 🤝 Kontribusi

Saran dan laporan bug sangat dihargai lewat *Issues*. Saat ini proyek **tidak menerima Pull Request**. Detail ada di [CONTRIBUTING.md](./CONTRIBUTING.md).

## 📄 Hak Cipta

**© 2026 gillandghaz. Seluruh hak dilindungi (All Rights Reserved).**

Repositori ini **tidak memakai lisensi sumber terbuka**. Kode sumber dipublikasikan agar dapat dilihat dan dipelajari. Menyalin, memodifikasi, menjalankan sebagai layanan, atau mendistribusikan ulang kode sumber memerlukan **izin tertulis dari pemilik**. Untuk meminta izin, hubungi pemilik lewat profil GitHub.

Dependensi pihak ketiga (mis. Next.js, React, Firebase SDK, CodeMirror, fflate) tetap tunduk pada lisensinya masing-masing.
