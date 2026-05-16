# Flow Helper Desktop Workflow

## Tujuan
Dokumen ini menjelaskan alur operator desktop untuk Flow execution, termasuk hubungan antara batch manifest, Windows Helper, Chrome profile, staging image, i2i, dan i2v.

Ini adalah SOP operasional, bukan spesifikasi kode.

Phase 1 keeps `/controller` frozen and redirected to `/products/new`; this SOP describes the retained desktop workflow when the controller surface is available.

## Dibaca Setelah

Urutan baca yang disarankan:

1. `docs/PROMPT_PIPELINE_LOCK.md`
2. `docs/FLOW_BATCH_BRIDGE_LOCK.md`
3. Dokumen ini

## Aktor

| Aktor | Tugas |
|---|---|
| Operator | memilih akun Flow, membuka profile, menjalankan ekstensi, memverifikasi output |
| App | source of truth untuk batch, prompt pack, status, dan histori |
| Windows Helper | translator lokal dari manifest ke input native ekstensi, pengelola staging, pengunggah output |
| Chrome profile | container sesi lokal untuk satu Flow account |
| Flow extension | executor browser yang membaca prompt dan image dari UI Flow |

## Istilah Kunci

| Istilah | Arti |
|---|---|
| Batch manifest | file JSON per batch yang diekspor dari app untuk helper |
| Staging image | salinan lokal sementara dari reference image yang dipakai saat eksekusi Flow |
| i2i TXT | file prompt teks per clip untuk tahap image generation |
| i2v TXT | file prompt teks per clip untuk tahap video generation |
| StartFrame | frame awal yang dipakai sebagai anchor video |
| LastFrame | frame akhir yang dipakai sebagai anchor video |
| Chrome profile | profil browser lokal yang memegang sesi Flow untuk satu akun |

## Prinsip Operasi

- App tetap source of truth.
- Helper hanya menerjemahkan manifest menjadi input native ekstensi.
- Chrome profile dipakai ulang selama sesi Flow masih valid.
- Manifest dibuat ulang per batch, bukan per profile.
- Staging image hanya file kerja lokal, bukan data permanen.
- Jangan bergantung pada tab background, minimize, atau sleep untuk mempertahankan run.
- Untuk retry yang jelas, pisahkan prompt per clip dan per mode.

## Artefak Yang Harus Ada

### 1. Batch manifest

Export dari controller surface dan minimal memuat:

- `batch_code`
- `flow_account_code`
- `flow_url`
- `helper_output_folder_key`
- `rename_pattern`
- `jobs[]`

### 2. Prompt files

Untuk kontrak operator yang jelas, helper menulis file terpisah:

- `clip_1_i2i.txt`
- `clip_2_i2i.txt`
- `clip_1_i2v.txt`
- `clip_2_i2v.txt`

Satu file per clip per mode membuat retry atomic dan memudahkan matching.

Untuk manifest v2, helper boleh menulis file yang lebih spesifik dari `stage_jobs[]`:

- `clip_1_i2i_first_frame.txt`
- `clip_1_i2i_last_frame.txt`
- `clip_1_i2v.txt`
- `clip_2_i2i_first_frame.txt`
- `clip_2_i2i_last_frame.txt`
- `clip_2_i2v.txt`

Nama lama tetap kompatibel sebagai grouping per mode, tetapi status app harus mengikuti stage `FIRST_FRAME`, `LAST_FRAME`, dan `VIDEO`.

### 3. Staging images

Helper menyalin reference image yang dibutuhkan batch ke folder kerja lokal.

Staging images bisa berasal dari:

- image bytes hasil intake yang sudah tersimpan di Drive
- profile-owned character lock asset
- profile-owned environment lock asset

Jika profile mengunci `seed_character` dan `environment`, helper harus mengambil reference asset yang sesuai dari Drive metadata. Jangan invent slot asset baru di luar dua lock itu.

Catatan:

- Jumlah staging image bukan angka universal.
- Dalam kasus yang umum, operator bisa melihat 3 reference image yang perlu disiapkan sebelum i2i dimulai.
- Angka final mengikuti active profile lock set dan kebutuhan batch, bukan asumsi tetap.

## Alur Desktop Operator

### A. Batch siap diproses

1. Operator menyelesaikan intake dan prompt pack di app.
2. Operator menekan `Tandai Siap Flow`.
3. Di controller surface, operator memilih rekomendasi akun Flow jika sesuai.
4. Operator mengekspor manifest batch.

### B. Helper menyiapkan local working set

1. Helper membaca manifest JSON.
2. Helper memetakan `flow_account_code` ke `chrome_profile_path` dari local config.
3. Helper memetakan `helper_output_folder_key` ke local output folder.
4. Helper membuat folder kerja lokal per batch.
5. Helper menyiapkan staging images.
6. Helper menulis prompt files per clip dan per mode.

Contoh struktur kerja lokal:

```text
local_output_folder/
  batch_code/
    manifest/
    staging/
      i2i/
      i2v/
    downloads/
    imported/
```

### C. Chrome profile dibuka

1. Helper membuka Chrome profile yang sesuai.
2. Helper membuka Google Flow URL dari manifest.
3. Operator memastikan profile yang terbuka benar untuk Flow account yang dipilih.
4. Jika sesi login sudah tidak valid, gunakan profile yang sama untuk login ulang. Jangan ganti profile di tengah batch.

### D. Stage i2i

1. Operator pindah ke mode `i2i` di ekstensi.
2. Operator memuat `clip_1_i2i.txt` dan `clip_2_i2i.txt`.
3. Untuk `I2I First Frame`, operator mengunggah tiga staging image: `@character`, `@environment`, dan product reference.
4. Untuk `I2I Last Frame`, operator memakai hasil First Frame sebagai satu-satunya input `@firstframe`; jangan unggah ulang tiga reference awal.
5. Operator menjalankan proses generate.
6. Sistem menghasilkan 4 image output total untuk 2 clip: `StartFrame` dan `LastFrame` per clip.
7. Helper atau operator mencocokkan hasil per `clip_code`.

### E. Stage i2v

1. Operator pindah ke mode `i2v` di ekstensi.
2. Operator memuat `clip_1_i2v.txt` dan `clip_2_i2v.txt`.
3. Operator mengunggah dua frame hasil i2i per clip: `@firstframe` dan `@lastframe`.
4. Operator menjalankan proses generate.
5. Setiap prompt i2v adalah 8 detik dengan 4 segmen timeline: `00:00-00:02`, `00:02-00:04`, `00:04-00:06`, `00:06-00:08`.
6. Sistem menghasilkan 2 video final, satu per clip.

### F. Import output

1. Helper memantau folder download local.
2. Helper menamai ulang file sesuai rename pattern yang sudah terkunci.
3. Helper mengunggah file final ke Google Drive.
4. Helper mengirim metadata callback ke app.
5. App mengubah status batch menjadi imported atau closed sesuai hasil.

Callback manifest v2 harus mengirim `stage` per file:

- `FIRST_FRAME` untuk hasil image frame awal.
- `LAST_FRAME` untuk hasil image frame akhir.
- `VIDEO` untuk video final.

Jika `stage` tidak dikirim, app memperlakukannya sebagai `VIDEO` agar helper lama tetap kompatibel.

## Kontrak Chrome Profile

- 1 Chrome profile = 1 Flow account.
- 1 profile hanya dipakai oleh 1 batch aktif pada satu waktu.
- Profile bersifat reusable lintas batch selama sesi masih valid.
- Profile path hanya hidup di local config helper.
- Profile path tidak boleh disimpan di Supabase.
- Jangan buat profile baru hanya karena batch baru dibuat.
- Jika sesi expired, buka profile yang sama lalu lanjutkan dari manifest terbaru.

## Kontrak Prompt File

- `i2i` dan `i2v` dipisah karena tujuan operasionalnya berbeda.
- `clip_x_i2i.txt` harus memisahkan instruksi First Frame dan Last Frame. First Frame memakai `@character`, `@environment`, dan product reference; Last Frame memakai `@firstframe` saja.
- `clip_x_i2v.txt` hanya boleh merujuk `@firstframe` dan `@lastframe`; jangan mencantumkan tiga reference image awal sebagai input i2v.
- Prompt rules dari Affiliate Profile adalah policy internal generator, bukan blok mentah yang disalin ke file prompt.
- File yang terpisah memudahkan retry per clip.
- File yang terpisah juga mencegah prompt image generation dan video generation tercampur.
- Jika satu clip gagal, ulangi hanya file mode dan clip itu.

## Failure And Retry

### Jika i2i gagal

- Retry hanya `clip_x_i2i.txt` yang gagal.
- Jangan regenerasi i2v sebelum frame anchor valid.

### Jika i2v gagal

- Pertahankan frame hasil i2i yang sudah valid.
- Retry hanya `clip_x_i2v.txt` yang gagal.

### Jika output mismatch

- Mark batch ke `NEED_MANUAL_MATCH`.
- Jangan paksa auto-import.

### Jika sesi profile expired

- Reopen profile yang sama.
- Re-auth manual bila perlu.
- Jangan pindah ke profile lain untuk batch yang sedang berjalan.

## Checklist Operator

Sebelum run:

- manifest sudah diekspor
- account Flow yang dipilih sudah benar
- Chrome profile yang terbuka cocok dengan `flow_account_code`
- staging images sudah lengkap
- `i2i` dan `i2v` TXT sudah dipisah
- output folder local sudah benar

Saat run:

- browser tetap aktif
- mode ekstensi sesuai tahap
- clip yang diproses cocok dengan batch code
- hasil setiap clip dicocokkan sebelum lanjut tahap berikutnya

Sesudah run:

- file final sudah di-rename
- file final sudah terupload ke Drive
- metadata callback sudah masuk ke app
- batch status sudah ter-update

## Batasan Yang Tetap Berlaku

- App tidak auto-click Google Flow.
- App tidak auto-submit prompt ke Google Flow.
- Helper tidak menyimpan Chrome profile path di Supabase.
- Helper tidak menyimpan OAuth token Drive di Supabase.
- Desktop tetap diperlukan untuk Flow Control dan eksekusi Flow.
