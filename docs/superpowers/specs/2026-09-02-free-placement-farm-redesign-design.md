# Desain Redesign Empat Lahan dan Penanaman Bebas

**Tanggal:** 2026-09-02
**Status:** Implemented and verified

> Catatan verifikasi 2026-09-03: lint, typecheck, unit tests (54 file / 873 tes), dan build lulus pada output aktual.
> Batas environment: Playwright E2E tidak dapat dijalankan di Termux/Android (`Unsupported platform: android`), dan
> Supabase CLI tidak tersedia sehingga smoke test migration/RPC (`supabase db reset` + dua call `farm_plant_at`
> konkuren) belum dijalankan — migration 0007 bersifat statically reviewed. Pemeriksaan visual desktop/mobile
> belum dapat dilakukan pada environment ini.
**Referensi visual:** `Screenshot_20260901-180931.jpg`
**Implementasi saat ini:** commit `6ca9e37`

## Ringkasan

Kebun akan diubah dari 64 tile tanah yang terlihat menjadi empat bed tanah besar dalam susunan 2x2. Koridor tengah berbentuk tanda tambah memisahkan keempat bed, sedangkan satu pagar luar mengelilingi keseluruhan kebun tanpa menyentuh bed. Pemain menanam langsung pada titik tanah yang diklik atau diketuk. Tidak ada lagi proses mencangkul atau tool Till.

Sistem tetap memakai maksimal 64 record tanaman agar progres lama, simulasi pertumbuhan, dan model multiplayer dapat dimigrasikan tanpa kehilangan data. Record tersebut menjadi slot logis yang tidak menentukan posisi visual. Posisi tanaman ditentukan oleh koordinat lokal pada salah satu dari empat bed.

## Masalah Saat Ini dan Akar Penyebab

Commit terakhir menggeser kolom plot secara langsung di `SoilGrid.tsx`: kolom kiri mendapat offset X `-1.8`, sedangkan kolom kanan mendapat offset X `+1.8`. Transformasi tersebut hanya terjadi di renderer.

Akibatnya:

- pusat kolom terluar berpindah ke X `-7.225` dan `+7.225`, sedangkan mesh tanah mencapai X `-7.925` dan `+7.925`;
- pagar barat dan timur tetap berada di X `-6.8` dan `+6.8`, sehingga pagar memotong bed serta plot;
- `targetPlotFinder.ts`, farming command, dan pet masih memakai `getPlotPosition()` tanpa offset renderer;
- posisi yang terlihat, posisi interaksi, collider, dan pengecualian stud rumput tidak mempunyai sumber geometri yang sama.

Test yang ada hanya menguji grid lama dan tidak merender offset baru, sehingga regresi geometris tersebut lolos.

## Sasaran

1. Membentuk empat bed besar seperti referensi Growden.io: 2 kolom x 2 baris dengan koridor silang yang jelas.
2. Menjamin bed, bingkai, pagar, gerbang, collider, dan properti lingkungan tidak saling menembus.
3. Menanam langsung dan persis pada titik klik/tap di permukaan tanah.
4. Menolak penanaman yang terlalu dekat dengan tanaman lain tanpa mengurangi benih.
5. Mempertahankan batas maksimal 64 tanaman aktif.
6. Menyimpan posisi yang sama setelah reload dan saat bermain melalui backend multiplayer.
7. Menghapus fitur Till dari seluruh alur yang dapat dimainkan.
8. Memigrasikan save dan tanaman lama tanpa kehilangan jenis tanaman, progres, mutasi, hidrasi, koin, atau inventaris.

## Bukan Sasaran

- Mengganti sistem pertumbuhan, ekonomi dasar, mutasi, cuaca, atau model crop.
- Menambah jenis crop baru.
- Membuat editor tata lahan atau memindahkan tanaman setelah ditanam.
- Membuat jumlah tanaman tanpa batas.
- Mengubah gaya visual dunia di luar area kebun kecuali penyesuaian yang diperlukan untuk memberi jarak aman.

## Tata Lahan

### Sumber geometri tunggal

File baru `src/game/world/farmLayout.ts` menjadi satu-satunya sumber kebenaran untuk:

- identitas empat bed;
- pusat, lebar, kedalaman, tinggi tanah, dan inset area tanam setiap bed;
- lebar koridor horizontal dan vertikal;
- batas luar kebun;
- posisi pagar, collider pagar, gerbang, dan ramp;
- konversi koordinat dunia ke koordinat lokal bed dan sebaliknya;
- pemeriksaan apakah sebuah titik berada di area tanam;
- area yang harus dikecualikan dari stud rumput dan dekorasi.

Renderer, hit-testing, farming command, target mobile, pet, dan test tidak boleh memiliki offset kebun sendiri.

### Komposisi visual

- Empat bed berukuran sama disusun pada kuadran north-west, north-east, south-west, dan south-east.
- Setiap bed memiliki satu permukaan tanah kontinu. Garis tile individual dan bingkai kayu per tile dihapus.
- Setiap bed mempunyai bingkai kayu rendah pada keempat sisinya.
- Koridor berbentuk `+` memiliki lebar yang cukup untuk karakter dan pet lewat tanpa menyentuh bingkai.
- Pagar hanya berada di perimeter keseluruhan kebun. Jarak kosong minimal antara bagian luar bingkai bed dan collider pagar adalah `0.9` world unit.
- Gerbang utama berada di sisi depan kebun dan mengarah ke koridor vertikal.
- Merchant atau dekorasi di luar kebun harus memiliki jarak minimal `1.0` world unit dari pagar/collider.
- Permukaan tanah memakai warna cokelat hangat seperti referensi, dengan furrow halus yang tidak terlihat sebagai grid penempatan.

Ukuran numerik final ditetapkan dalam `farmLayout.ts`, bukan tersebar sebagai literal JSX:

- ukuran luar setiap bed: `6.0 x 5.4` world unit;
- pusat kolom bed: X `-3.8` dan `+3.8`;
- pusat baris bed: Z `-3.5` dan `+3.5`;
- lebar kedua koridor tengah: `1.6`;
- inset area tanam dari tepi luar bed: `0.45`, sehingga batas placement lokal adalah X `[-2.55, 2.55]` dan Z `[-2.25, 2.25]`;
- pusat collider pagar barat/timur: X `-7.95` dan `+7.95`;
- pusat collider pagar utara/selatan: Z `-7.35` dan `+7.35`;
- tebal collider pagar: `0.24`, sehingga jarak dari frame bed ke sisi dalam collider adalah `1.03`;
- bukaan gerbang depan: `2.2`, tepat di tengah koridor vertikal.

Penyesuaian artistik hanya boleh mengubah ketebalan/tinggi mesh yang tidak memengaruhi footprint. Perubahan footprint harus mengubah konfigurasi dan test clearance dalam commit yang sama.

## Model Domain

### Identitas slot

Sebanyak 64 `PlotData` lama tetap digunakan sebagai record/slot logis. `id`, `row`, dan `col` dipertahankan untuk kompatibilitas dan urutan deterministik, tetapi `row` serta `col` tidak lagi menentukan posisi visual.

Semua 64 slot tersedia sejak awal. `gridSize` lama dinormalisasi menjadi 8 saat migrasi, dan upgrade perluasan 4x4/6x6 dihapus dari shop karena tidak lagi mempunyai arti visual.

### Posisi tanaman

`CropData` mendapat placement wajib pada schema baru:

```ts
type FarmBedId = 'north-west' | 'north-east' | 'south-west' | 'south-east';

interface CropPlacement {
  bedId: FarmBedId;
  localX: number;
  localZ: number;
}
```

`localX` dan `localZ` adalah jarak dalam world unit dari pusat permukaan tanah bed. Penyimpanan memakai presisi tiga angka desimal untuk hasil deterministik tanpa melakukan snap ke slot. Pada skala dunia sekarang, pembulatan tersebut mempertahankan posisi klik hingga satu milimeter world unit.

Posisi menempel pada lifecycle crop. Ketika crop dipanen, crop beserta placement dihapus dan lokasi tersebut kembali bebas.

### Penghapusan Till

- `trowel` dihapus dari `ToolType` dan semua pemilih tool.
- State runtime menjadi `empty | planted | watered | harvestable`; tidak ada `untilled` atau `tilled`.
- Field `tilled` hanya dikenali oleh parser schema versi 1 untuk migrasi. Field itu tidak hadir dalam schema/runtime versi 2.
- Empty tile lama, baik untilled maupun tilled, menjadi slot kosong yang siap ditanami.
- Hidrasi kosong dari save lama direset ke nol; hidrasi crop aktif dipertahankan.

## Alur Interaksi

### Menanam

1. Pemain memilih Seeds dan jenis benih.
2. Pointer/touch selesai pada mesh permukaan tanah. Drag kamera tidak dianggap sebagai klik tanam; toleransi gerakan maksimum adalah 6 CSS pixel.
3. Renderer mengubah `event.point` menjadi `CropPlacement` melalui `farmLayout.ts`.
4. `plantCropAt(placement, cropId, ...)` memvalidasi titik sebelum mengubah state.
5. Command memilih slot kosong pertama dalam urutan `row`, lalu `col`, untuk menjaga hasil deterministik.
6. Benih dikurangi dan crop dibuat hanya setelah seluruh validasi lolos.

Validasi dilakukan dalam urutan berikut:

1. koordinat finite dan bed dikenal;
2. titik berada di dalam inset area tanam, bukan pada bingkai atau koridor;
3. masih ada slot kosong dari total 64;
4. jarak pusat ke setiap crop aktif minimal `1.1` world unit;
5. inventaris memiliki benih yang dipilih.

Klik yang lolos tidak digeser. Crop muncul di titik yang sama dengan toleransi render maksimal `0.01` world unit.

### Menolak overlap

Jarak dihitung pada bidang XZ menggunakan koordinat dunia hasil konversi placement. Titik dengan jarak kurang dari `1.1` ditolak sebagai `occupied_position`. Titik tepat pada atau di atas batas diterima. Penolakan menampilkan pesan `Terlalu dekat dengan tanaman lain` dan tidak mengurangi benih.

### Water dan Harvest

- Water dan Harvest menargetkan mesh crop/slot yang diklik, bukan tile tanah.
- Tombol aksi mobile mencari crop valid terdekat berdasarkan placement aktual.
- Golden Watering Can memakai jarak spasial: crop yang dipilih ditambah maksimal delapan crop terdekat dalam radius `2.4` world unit. Ini mempertahankan manfaat maksimal sembilan target dari sistem 3x3 lama tanpa bergantung pada row/col.
- Dog auto-harvest bergerak ke posisi placement crop yang matang.
- Cuaca dan simulasi offline tetap memproses slot logis; keduanya tidak memerlukan koordinat kecuali untuk efek visual.

### Hotbar dan tutorial

- Slot Till dihapus.
- Shortcut utama menjadi `1 Water`, `2 Seeds`, dan `3 Harvest`; shortcut crop bergeser setelahnya.
- Saat Seeds aktif pada mobile, tombol konteks menampilkan petunjuk pasif `Tap Soil`; penanaman hanya terjadi dari titik tanah yang benar-benar disentuh.
- Tutorial dimulai dari memilih Seeds dan mengetuk tanah. Seluruh instruksi mencangkul dihapus.
- Shop tidak lagi menawarkan ekspansi grid 6x6 atau 8x8.

## Batas Modul dan Data Flow

### Modul geometri

`farmLayout.ts` adalah modul murni tanpa React atau Zustand. API publiknya mencakup konfigurasi bed/fence, `worldPointToPlacement`, `placementToWorldPoint`, `isPlacementInsideBed`, dan posisi migrasi legacy. Modul ini dapat diuji tanpa WebGL.

### Modul placement

File baru `src/game/farming/plantPlacement.ts` memiliki validasi jarak, pencarian slot kosong, pemilihan target crop terdekat, dan helper migrasi. Modul ini bergantung pada API publik `farmLayout.ts`, bukan pada JSX renderer.

### Rendering

`SoilGrid.tsx` dan `PlotMesh.tsx` diganti dengan komponen yang mencerminkan domain baru:

- `FarmBeds.tsx` merender empat surface, frame, hover feedback, dan event klik tanah;
- `PlacedCrop.tsx` merender crop pada placement dan menangani klik Water/Harvest;
- `GardenIsland.tsx` merender pagar dan collider dari konfigurasi `farmLayout.ts`.

`GameRuntime.tsx` hanya mengomposisikan komponen. Ia tidak menghitung koordinat.

### Command/UI

Callback aplikasi dipisah menjadi dua bentuk eksplisit:

- `onPlantAt(placement)` untuk klik tanah ketika Seeds aktif;
- `onCropInteract(slotId)` untuk Water/Harvest.

Pemisahan ini mencegah pemakaian `plotId` sebagai koordinat semu dan membuat klik tanah tidak ambigu.

## Persistence Lokal

`CURRENT_SCHEMA_VERSION` dinaikkan dari 1 menjadi 2.

Migrasi `1 -> 2`:

1. mempertahankan semua slot dan crop;
2. menghapus makna `tilled`;
3. mengatur `gridSize` menjadi 8;
4. memberi placement deterministik pada setiap crop lama;
5. mempertahankan crop id, waktu tanam, progres, mutasi, dan hidrasi;
6. memvalidasi hasil dengan schema Zod versi 2.

Placement legacy menggunakan kuadran grid lama: row `< 4`/`>= 4` menentukan utara/selatan dan col `< 4`/`>= 4` menentukan barat/timur. Posisi di dalam bed memakai indeks row/col modulo 4 pada pola 4x4. Dengan demikian maksimal 16 crop lama per bed tertata rapi, tidak overlap, dan orientasi relatif kebun lama tetap dikenali.

Migrasi bersifat idempotent: payload versi 2 tidak diposisikan ulang. Save versi 1 tidak pernah ditulis balik sebelum hasil migrasi lolos validasi penuh.

## Backend dan Multiplayer

Migration SQL baru menambah kolom nullable berikut pada `plot_tiles`:

- `bed_id smallint` dengan nilai 0 sampai 3;
- `position_x real`;
- `position_z real`.

Baris crop lama dibackfill menggunakan aturan kuadran 4x4 yang sama dengan migrasi lokal. Baris kosong mempertahankan ketiga kolom sebagai `NULL`.

RPC plant diubah menjadi satu tile/slot per permintaan dan menerima bed serta koordinat. Di dalam transaksi yang sama, server:

1. mengunci plot dan kandidat slot;
2. memvalidasi bounds bed;
3. memeriksa jarak kuadrat terhadap seluruh crop aktif milik plot tersebut;
4. memastikan slot kosong dan jumlah aktif belum mencapai 64;
5. memastikan inventaris benih cukup;
6. mengurangi benih lalu menulis crop dan placement;
7. memasukkan placement ke digest idempotency dan payload patch.

Server memakai konstanta bounds dan jarak yang sama nilainya dengan kontrak TypeScript. Test kontrak akan mendeteksi drift nilai. Aturan server adalah otoritas akhir; validasi klien hanya memberi respons cepat.

RPC Till tidak lagi dipanggil dan execute grant-nya dicabut pada migration baru. State database lama tetap dipahami selama backfill, tetapi plant baru tidak membutuhkan state tilled/watered. Broadcast farm patch dan room snapshot menyertakan placement agar semua klien merender posisi identik.

Jika dua permintaan konkuren memilih titik yang bertabrakan, hanya transaksi pertama yang dapat berhasil. Permintaan kedua mengembalikan `occupied_position` tanpa pengurangan benih.

## Penanganan Error

Command failure reason baru:

- `outside_planting_area`: tap berada pada frame, koridor, atau luar bed;
- `occupied_position`: titik kurang dari jarak minimum;
- `farm_full`: 64 slot sedang berisi crop;
- `invalid_placement`: koordinat tidak finite atau bed tidak dikenal.

Semua kegagalan placement terjadi sebelum pengurangan benih. Pesan UI utama:

- `Tanam di area tanah`;
- `Terlalu dekat dengan tanaman lain`;
- `Kebun penuh (64/64)`;
- `Posisi tanam tidak valid`.

Kegagalan backend mengembalikan kode terstruktur yang dipetakan ke pesan yang sama. Klien melakukan refresh patch/snapshot setelah konflik agar state lokal kembali sinkron.

## Strategi Pengujian

### Pure unit tests

- Keempat bed tidak overlap dan dipisahkan koridor sesuai lebar konfigurasi.
- Seluruh collider pagar berada di luar frame bed dengan clearance minimal `0.9`.
- Konversi world -> local -> world round-trip memiliki error kurang dari `0.001`.
- Titik pada tanah diterima; titik pada frame, koridor, dan luar bed ditolak.
- Jarak `< 1.1` ditolak, sedangkan jarak `>= 1.1` diterima.
- Pemilihan slot kosong deterministik dan slot ke-65 ditolak.
- Target mobile, Golden Watering Can, dan dog memakai placement aktual.

### Command/store tests

- Plant direct tidak membutuhkan Till atau Water.
- Benih berkurang tepat satu hanya saat penanaman berhasil.
- Penolakan overlap/outside/full tidak mengubah inventory atau farm state.
- Harvest mengosongkan placement dan lokasi dapat dipakai kembali.
- Tidak ada jalur runtime yang menghasilkan state tilled/untilled.

### Migration tests

- Save v1 kosong menjadi save v2 valid.
- Semua crop v1 mendapat placement unik dengan jarak aman.
- Crop id, timestamp, progress, mutation, hydration, coins, inventory, pet, dan weather tidak berubah.
- Save v2 round-trip mempertahankan placement sampai tiga desimal.
- Backfill SQL dan helper TypeScript menghasilkan bed/koordinat yang sama untuk seluruh tile index 0 sampai 63.

### Component dan interaction tests

- Klik/tap bed meneruskan titik intersection yang benar.
- Drag kamera lebih dari 6 px tidak menanam.
- Klik crop menjalankan Water/Harvest pada slot yang benar.
- Hotbar, keyboard, mobile action, shop, dan tutorial tidak lagi mengekspos Till.
- Renderer menaruh crop pada placement, bukan pada `row/col`.

### Verifikasi akhir

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- smoke test migration/RPC pada environment Supabase yang tersedia
- screenshot desktop dan viewport mobile dari sudut depan serta samping untuk memastikan tidak ada penetrasi pagar

## Kriteria Penerimaan

1. Empat bed 2x2 dan koridor silang terbaca jelas seperti referensi.
2. Tidak ada mesh/collider pagar yang beririsan dengan bed pada seluruh sisi.
3. Tanaman muncul maksimal `0.01` world unit dari titik klik/tap yang sah.
4. Penanaman kedua pada jarak kurang dari `1.1` ditolak dan jumlah benih tidak berubah.
5. Tanaman ke-65 ditolak dengan pesan kebun penuh.
6. Posisi crop tidak berubah setelah save/reload atau patch multiplayer.
7. Save lama mempertahankan seluruh progres bernilai; hanya status Till yang sengaja dihapus.
8. Tidak ada tool, shortcut, tombol, tutorial, command aktif, atau upgrade shop terkait Till/grid expansion.
9. Water, Harvest, weather, offline growth, mutation, dan dog auto-harvest tetap bekerja pada posisi bebas.
10. Seluruh verifikasi otomatis yang relevan lulus dan pemeriksaan visual menunjukkan tata lahan sesuai referensi.

## Urutan Rollout

Implementasi harus dilakukan vertikal dan test-first: kontrak layout/placement, model domain dan migrasi lokal, renderer/interaksi, penghapusan Till, sistem spasial terkait, lalu backend migration/RPC. Migration SQL bersifat additive sebelum client baru dipakai. Client baru hanya dirilis setelah backend menerima payload placement, sehingga versi lama tetap dapat beroperasi selama transisi.
