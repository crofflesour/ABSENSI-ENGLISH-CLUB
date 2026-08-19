# Absensi English Club

Website recap absensi English Club — statis, jalan di GitHub Pages, data tersimpan
di browser (localStorage) dan bisa disinkron ke Google Sheets biar bisa diakses
dari HP/laptop manapun.

## Struktur file

```
index.html
assets/
  style.css
  data.js      ← daftar anggota & roadmap kegiatan, edit di sini kalau ada perubahan
  app.js
apps-script/
  Code.gs      ← kode yang di-paste ke Google Apps Script
```

## 1. Setup Google Sheets sebagai database (opsional tapi disarankan)

1. Buat Google Sheet baru, kasih nama misalnya **"Absensi English Club"**.
2. Rename sheet/tab pertama jadi **`Absensi`** (huruf besar-kecil harus sama persis).
3. Buka **Extensions → Apps Script**.
4. Hapus semua kode default, ganti dengan isi file `apps-script/Code.gs` (copy-paste).
5. Klik **Deploy → New deployment**.
   - Pilih tipe **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone**.
   - Klik **Deploy**, izinkan akses saat diminta (klik "Advanced" → "Go to project (unsafe)" kalau muncul warning — ini normal karena scriptnya punya sendiri).
6. Setelah deploy, copy **Web app URL**-nya (bentuknya `https://script.google.com/macros/s/xxxxx/exec`).
7. Buka website absensi, klik ikon gear (⚙️) di pojok kanan atas, tempel URL tadi, klik **Simpan & Sinkron**.

Setiap kali ada penambahan anggota BPH baru / deploy ulang, kamu **tidak perlu** ganti URL — URL yang sama tetap berlaku selama deployment-nya tidak dihapus. Kalau kamu edit `Code.gs`, klik **Deploy → Manage deployments → edit (pensil) → Deploy** lagi supaya perubahan aktif.

> Tanpa setup ini pun website tetap jalan — data hanya tersimpan di browser (localStorage) tempat kamu input absen. Begitu ganti device/browser, data itu tidak ikut pindah.

## 2. Hosting di GitHub Pages

1. Buat repo baru di GitHub, misalnya `absensi-english-club`.
2. Upload semua isi folder ini (`index.html`, folder `assets/`) ke root repo.
   (Folder `apps-script/` boleh ikut diupload untuk arsip, tidak memengaruhi web.)
3. Buka **Settings → Pages** di repo tersebut.
4. Source: pilih branch `main`, folder `/ (root)`.
5. Tunggu 1-2 menit, situs akan aktif di `https://<username-kamu>.github.io/absensi-english-club/`.

## 3. Update roster / roadmap

Edit langsung `assets/data.js` — tambah/ubah nama di `MEMBERS`, atau tambah
kegiatan baru di `ROADMAP` supaya muncul di dropdown form Input Absen.

## 4. Cara pakai sehari-hari

1. Setelah kumpulan selesai, buka website → tab **Input Absen**.
2. Pilih kegiatan dari roadmap (opsional, otomatis isi tanggal/nama/catatan) atau isi manual.
3. Centang status tiap anggota (default: Hadir).
4. Klik **Simpan Absen**.
5. Cek tab **Recap** untuk lihat rekap per kegiatan, atau **Statistik** untuk lihat persentase kehadiran tiap anggota dalam bentuk ledger titik-titik.

Data yang tersimpan sebelum Google Sheets tersambung akan otomatis coba
disinkronkan lagi setiap kali website dibuka ulang (asal URL Apps Script sudah diisi).
