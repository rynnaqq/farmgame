# Handoff: Free-Placement Farm Redesign

Tanggal handoff: 2026-09-03

Status: desain dan rencana implementasi sudah disetujui serta di-commit. Belum ada perubahan kode produksi; lanjutkan dari Task 1.

## Mulai dari sini

Gunakan worktree yang sudah siap berikut. Jangan membuat worktree baru.

```sh
cd /data/data/com.termux/files/home/farmgemini/.worktrees/free-placement-farm
git status --short --branch
git log -4 --oneline
```

- Branch: `codex/free-placement-farm`
- Base commit: `339fb20 chore: ignore local worktrees`
- Dependency: `node_modules` sudah terpasang melalui `npm install`
- Kondisi worktree fitur saat handoff: bersih

Baca dua dokumen otoritatif ini sebelum mengubah kode:

1. [Spesifikasi desain](../specs/2026-09-02-free-placement-farm-redesign-design.md)
2. [Rencana implementasi](../plans/2026-09-03-free-placement-farm-redesign.md)

Spesifikasi adalah sumber keputusan produk. Rencana adalah urutan kerja, daftar file, contoh tes, perintah verifikasi, dan Definition of Done. Jangan menduplikasi atau mengubah kontrak di luar kedua dokumen itu tanpa persetujuan pengguna.

## Permintaan pengguna yang tidak boleh berubah

- Tata lahan harus berupa empat bed besar dalam susunan 2 x 2, dipisahkan jalur silang seperti referensi Growden.io.
- Bed, pagar, collider, targeting, pet, dan tanaman harus memakai satu sumber geometri; tidak boleh ada offset visual khusus renderer.
- Tanaman muncul persis pada titik tanah yang diketuk atau diklik, tanpa grid snapping dan tanpa dipindahkan otomatis.
- Titik baru ditolak apabila terlalu dekat dengan tanaman lain; jarak minimum pusat tanaman adalah `1.1`.
- Fitur Till harus dihapus sepenuhnya, termasuk tombol, shortcut, command, tutorial, audio, model, dan ekspansi shop terkait.
- Batas tanaman aktif tetap 64.

## Akar masalah yang sudah dikonfirmasi

`src/game/world/SoilGrid.tsx` menggeser kolom kiri `-1.8` pada sumbu X dan kolom kanan `+1.8` hanya saat render. Pagar di `GardenIsland.tsx` tetap berada pada sekitar `x/z = +/-6.8`, sedangkan tepi tanah visual mencapai sekitar `+/-7.925`, sehingga saling beririsan. Targeting, farming, dan pet tetap memakai koordinat grid lama dari `getPlotPosition`, jadi lokasi visual dan interaksi juga tidak konsisten.

## Langkah berikutnya

1. Jalankan Task 1 dari rencana dengan test-driven development.
2. Buat tes RED `src/game/world/farmLayout.test.ts`, lalu jalankan hanya tes tersebut dan pastikan gagal karena modul belum ada.
3. Implementasikan `src/game/world/farmLayout.ts` sebagai satu-satunya sumber geometri empat bed, pagar, batas tanam, dan konversi koordinat.
4. Jalankan tes Task 1 sampai hijau, review diff, lalu commit hanya path yang terkait Task 1.
5. Lanjutkan Task 2 sampai Task 9 secara berurutan. Pertahankan red-green-refactor dan commit per task.
6. Pada Task 5 dan Task 9, lakukan pemeriksaan visual desktop serta mobile terhadap kedua screenshot referensi di checkout utama.

Kontrak geometri awal yang sudah disetujui:

- Bed ID: `north-west`, `north-east`, `south-west`, `south-east`
- Ukuran luar tiap bed: `6.0 x 5.4`
- Pusat bed: X `+/-3.8`, Z `+/-3.5`
- Lebar koridor silang: `1.6`
- Inset area tanam: `0.45`
- Batas lokal tanam: X `[-2.55, 2.55]`, Z `[-2.25, 2.25]`
- Pusat collider pagar: X `+/-7.95`, Z `+/-7.35`; ketebalan `0.24`
- Lebar gerbang depan: `2.2`

## Baseline pengujian

Sebelum implementasi, suite penuh menghasilkan 50 file lolos dan 1 file gagal; 887 tes lolos dan 2 tes gagal. Kedua kegagalan hanya berasal dari `src/app/App.test.tsx` karena environment Supabase tidak tersedia di worktree.

Tes App lolos dengan environment dummy:

```sh
VITE_SUPABASE_URL=https://example.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test \
npm test -- --run src/app/App.test.tsx
```

Hasilnya: 1 file dan 15 tes lolos. Peringatan jsdom tentang beberapa instance Three.js dan custom React Three Fiber tags adalah baseline, bukan kegagalan.

Verifikasi akhir yang wajib dijalankan:

```sh
VITE_SUPABASE_URL=https://example.supabase.co \
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test \
npm test -- --run
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Smoke test migrasi Supabase memerlukan environment Supabase lokal yang nyata; jangan mengklaim bagian itu lolos bila tidak dijalankan.

## Guardrails penting

- Validasi bounds dan collision harus selesai sebelum benih dikurangi.
- Bila posisi bertabrakan, tampilkan `Terlalu dekat dengan tanaman lain` dan jangan menggeser posisi.
- Simpan placement sebagai `{ bedId, localX, localZ }` dengan tiga angka desimal.
- Save parser harus tetap membaca schema v1, tetapi runtime dan save v2 tidak lagi memiliki `tilled`.
- Sinkronisasi hydration multiplayer di luar placement/patch contract tetap di luar scope sesuai spesifikasi.
- Jangan stage atau mengubah file milik pengguna di checkout utama: `.env.example`, `bugfixes&update.md`, dan dua screenshot referensi.

Pekerjaan selesai hanya apabila seluruh Definition of Done pada rencana terpenuhi dan hasil verifikasi terakhir dicatat berdasarkan output aktual.
