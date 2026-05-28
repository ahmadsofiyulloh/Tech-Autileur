# Changelog

<!-- changelog:generated:start -->
## Riwayat commit aktual

Range: `origin/main..HEAD`

### 2026-05-26

- `087a117` feat(admin): add diagnostic dashboard and dashboard entrypoint
- `236d70a` feat(prompts): inline single-generate, remove queue
- `90b1f79` fix(share): prevent caption JSON truncation
- `6e489ab` feat(share): generation recovery and status polling
- `da38f2d` feat(db): diagnostic logs, share recovery, prompt variants
- `7193790` chore(scripts): add supabase CLI wrapper
- `753aff5` test(e2e): align specs with prompt and share refactors
<!-- changelog:generated:end -->

## 2026-05-28 - Next Typegen Route Reference Normalization

- Mengarahkan [next-env.d.ts](C:/Project%20Autiluer/next-env.d.ts) ke `.next/types/routes.d.ts` agar typecheck memakai output build yang stabil, bukan referensi `.next/dev` yang bisa berisi artefak generated rusak saat cache dev bergeser.

## 2026-05-28 - PERF-08 Shell Context Deferral

- Memindahkan lookup profile shell dari [src/app/layout.tsx](C:/Project%20Autiluer/src/app/layout.tsx) ke endpoint JSON baru [src/app/api/operator/shell-context/route.ts](C:/Project%20Autiluer/src/app/api/operator/shell-context/route.ts), sehingga root shell tidak lagi menunggu data profile sebelum route children dirender.
- Menambahkan fetch client-side pada [src/components/operator/topbar-global-controls.tsx](C:/Project%20Autiluer/src/components/operator/topbar-global-controls.tsx) agar avatar/menu profil tetap terisi setelah mount tanpa memblokir shell awal.
- Menjaga fallback shell tetap aman dengan `currentAffiliateProfile: null` saat data profile belum tersedia atau gagal dimuat.

## 2026-05-28 - PERF-07 Intake Preload Slimming

- Mengubah [src/app/products/new/page.tsx](C:/Project%20Autiluer/src/app/products/new/page.tsx) menjadi loader kondisional: jalur sesi terpilih hanya memuat data product-scope yang sempit, sedangkan jalur tanpa sesi baru memuat daftar draft yang memang dibutuhkan queue.
- Menurunkan preload limit pada affiliate profiles, Drive, intake sessions, products, dan marketplace sources supaya render awal `/products/new` tidak menarik dataset yang lebih besar dari kebutuhan frame aktif.
- Menjaga workflow capture, preview evidence, prompt readiness, dan draft queue tetap sama dari sisi UI.

## 2026-05-28 - PERF-06 Drive Thumbnail Pressure Reduction

- Menambahkan gate `deferUntilVisible` pada [src/components/operator/media-thumbnail-frame.tsx](C:/Project%20Autiluer/src/components/operator/media-thumbnail-frame.tsx) agar `<img>` thumbnail baru mount saat item benar-benar masuk viewport.
- Mengaktifkan gate itu hanya pada tile dan list row Drive di [src/app/drive/drive-visual-manager.tsx](C:/Project%20Autiluer/src/app/drive/drive-visual-manager.tsx), sementara preview drawer tetap memuat media seperti sebelumnya saat item dibuka.
- Mempertahankan fallback icon sehingga grid/list Drive tetap terasa stabil saat thumbnail belum aktif.

## 2026-05-27 - PROMPT-VOICEOVER-NONE-VALIDATION-01

- Memperbaiki parser kontrak prompt I2V agar `audio.voiceover_timing: "none"` diterima ketika `voiceover_text` kosong pada mode Voice Over nonaktif.
- Menjaga validasi tetap ketat untuk kombinasi `voiceover_text` aktif dengan timing selain `00:00-00:02`, termasuk `none`.
- Menambahkan regresi test untuk kasus Voice Over nonaktif pada clip I2V dan kombinasi timing `none` yang tetap invalid saat voiceover text terisi.

## 2026-05-25 - DIAGNOSTIC-DASHBOARD-01

- Menambahkan halaman `/admin/diagnostics` dengan 4 section: KPI summary (stuck tasks, key pool active, failed 24h, antrian real), stuck tasks table dengan bulk selection, key pool status, dan recent errors.
- Menambahkan 4 API endpoint diagnostik: `/api/admin/diagnostics/stuck-tasks`, `/api/admin/diagnostics/key-pool`, `/api/admin/diagnostics/recent-errors`, dan `/api/admin/recovery/mark-failed` untuk recovery manual per-task.
- Menambahkan server actions di `src/app/admin/diagnostics/actions.ts` yang query Supabase langsung via Promise.all untuk fetch data diagnostik dan mark-failed bulk action.
- Menambahkan tabel `diagnostic_logs` di Supabase dengan RLS owner-only untuk persistent audit trail generation lifecycle (start, success, fail, key selection, recovery).
- Mengintegrasikan logging di `src/lib/server/share-caption-task.ts` untuk WAITING_FOR_KEY warn log dan failure log di dalam `failShareCaptionTask`.
- Menambahkan CSS diagnostik di `src/styles/05-features/diagnostics.css` menggunakan semantic design tokens (surface-flat, border-flat, badge variants, spacing, typography) tanpa hardcoded values.

## 2026-05-25 - PROMPT-OUTPUT-MULTI-VARIANT-UI-01

- Memperbaiki tab Output drawer Prompt agar `output_variants_json` yang berisi lebih dari satu varian tampil sebagai pilihan varian eksplisit.
- Menambahkan tab varian di renderer output prompt sehingga operator bisa berpindah antara Varian 1-4 tanpa kehilangan copy-ready field per varian.

## 2026-05-25 - PROMPT-SHARE-FB-REGENERATE-RUNTIME-01

- Memperbaiki UX regenerate prompt agar versi `DRAFT`, `QUEUED`, `GENERATING`, `WAITING_FOR_KEY`, `RETRYING`, atau `ERROR` tidak dianggap output siap meskipun masih menyimpan field prompt lama dari versi sumber; drawer sekarang menampilkan skeleton polling saat pending/proses dan empty/error state saat output belum tersedia.
- Memperbaiki runtime Share Caption Facebook agar response Gemini yang sukses tetapi kurang field struktural dinormalisasi menjadi `main_caption`, `first_comment`, dan `image_prompt` fallback sesuai opsi yang dipilih, bukan langsung membakar retry key.
- Memperjelas klasifikasi error Share Caption: error JSON/validasi/runtime dan Gemini 400 sekarang disimpan sebagai kegagalan kontrak runtime/schema, sementara 429/5xx tetap mengikuti jalur quota/provider retry.

## 2026-05-25 - PROMPT-SHARE-POLLING-RECOVERY-01

- Memperbaiki polling prompt generate/regenerate agar membaca response API yang terbungkus, memprioritaskan output prompt yang sudah siap, dan mengganti skeleton lewat `router.refresh()` tanpa full reload.
- Menambahkan recovery Share Caption untuk generation yang orphan/stale melalui `share_generations.ai_task_id`, `updated_at`, dan status endpoint yang menandai antrean buntu sebagai `error`.
- Menambahkan kompensasi saat task/worker Share Caption gagal dibuat, preserve opsi regenerate/retry, dan validasi output Facebook first comment/image prompt agar kegagalan muncul sebagai error yang bisa diulang.

## 2026-05-25 - SUPABASE-LOCAL-TOKEN-WRAPPER-01

- Menambahkan wrapper repo-local `scripts/supabase.ps1` yang membaca token dari `.env.supabase.local` dan mengeksekusi `supabase-go.exe` tanpa menyimpan sesi global.
- Menambahkan command `set-token`, `login`, `clear-token`, dan `logout` pada wrapper untuk menyimpan atau menghapus token repo-local secara eksplisit.
- Memperbarui `docs/RELEASE_AND_DEPLOY_RUNBOOK.md` agar alur `link` dan `db push` memakai wrapper repo-local, bukan login session global.

## 2026-05-27 - PERF-02 Prompt Workbench Read Model

- Menambahkan `listPromptWorkbenchPageForUser` pada [src/lib/server/prompt-workbench.ts](C:/Project/Tech%20Autiluer/src/lib/server/prompt-workbench.ts) dan membuat helper itu mengembalikan konteks workspace serta affiliate profile yang dipakai UI.
- Menghapus query workspace dan affiliate profile yang diduplikasi dari [src/app/prompts/page.tsx](C:/Project/Tech%20Autiluer/src/app/prompts/page.tsx) dan [src/app/api/prompts/workbench/route.ts](C:/Project/Tech%20Autiluer/src/app/api/prompts/workbench/route.ts), sehingga page dan API route memakai satu hasil read model per request.
- Memperbaiki cleanup smoke test pada [tests/e2e/prompt-workbench.spec.ts](C:/Project/Tech%20Autiluer/tests/e2e/prompt-workbench.spec.ts) agar menghapus `contents`, `clip_jobs`, dan `generated_files` yang bergantung pada prompt pack sebelum prompt pack dihapus.
- Memecah `/prompts` menjadi shell cepat + Suspense section lewat [src/app/prompts/page.tsx](C:/Project/Tech%20Autiluer/src/app/prompts/page.tsx) dan [src/app/prompts/prompt-workbench-section.tsx](C:/Project/Tech%20Autiluer/src/app/prompts/prompt-workbench-section.tsx), serta menghapus angka count dari filter tabs supaya frame tidak menunggu read model penuh.

## 2026-05-27 - PERF-03 Product Detail Tab Streaming

- Memecah [src/app/products/product-detail-panel.tsx](C:/Project/Tech%20Autiluer/src/app/products/product-detail-panel.tsx) menjadi shell detail cepat + `Suspense`, sehingga rail tab tetap langsung tampil sementara konten tab aktif dirender terpisah.
- Memindahkan fetch dan render `Output`, `Metadata`, dan `History` ke helper per-tab, sehingga pembukaan atau pergantian tab hanya memuat data yang dibutuhkan tab aktif.
- Menambahkan loading state tab-spesifik yang menjaga layout detail tetap stabil saat data tab aktif masih diproses, tanpa memaksa tab lain ikut dimuat.
- Menyelaraskan smoke spec [tests/e2e/product-output-detail.spec.ts](C:/Project/Tech%20Autiluer/tests/e2e/product-output-detail.spec.ts) dengan label status UI Indonesia `Metadata Siap` dan mempersempit assertion nama produk ke panel detail yang visible, supaya verifikasi detail produk tetap mengikuti copy yang memang tampil di panel.

## 2026-05-27 - PERF-04 Prompt Detail Tab Streaming

- Memecah [src/app/prompts/prompt-detail-panel.tsx](C:/Project/Tech%20Autiluer/src/app/prompts/prompt-detail-panel.tsx) menjadi shell tab cepat + `Suspense`, sehingga rail tab prompt tetap langsung tampil sementara konten aktif dimuat per-tab.
- Memisahkan jalur fetch `Output`, `Generate`, dan `History` agar masing-masing tab hanya mengambil data yang diperlukan saat tab tersebut aktif, tanpa lagi menyalakan seluruh section prompt detail sekaligus.
- Menambahkan loading state per-tab untuk output, generate, dan history supaya layout drawer tetap stabil saat data tab aktif masih diproses.
- Menambahkan regresi [tests/e2e/prompt-workbench.spec.ts](C:/Project%20Autiluer/tests/e2e/prompt-workbench.spec.ts) yang memverifikasi URL tab prompt hanya merender konten tab aktif dan tidak membawa section tab lain ke HTML aktif.

## 2026-05-27 - PERF-05 Drive Initial Payload Reduction

- Mengganti fetch awal [src/app/drive/page.tsx](C:/Project%20Autiluer/src/app/drive/page.tsx) dari blanket limit 1000 ke limit awal 500 lewat `getActiveWorkspaceDriveScope`, sehingga payload server untuk render pertama Drive lebih ringan.
- Menjaga `uploadTarget`, preview URL, dan visual item tetap sama, tetapi menghindari pengiriman dataset Drive yang lebih besar dari yang dibutuhkan untuk first paint.

## 2026-05-27 - PROMPT-DETAIL-DRAWER-LAYOUT-REGRESSION-01

- Memperbaiki struktur [src/app/prompts/page.tsx](C:/Project%20Autiluer/src/app/prompts/page.tsx) supaya search/filter chrome tetap full-width, sementara list prompt dan drawer detail kembali menjadi sibling grid seperti detail produk.
- Menyesuaikan [src/app/prompts/loading.tsx](C:/Project%20Autiluer/src/app/prompts/loading.tsx) dan CSS desktop prompt workbench agar skeleton dan drawer tetap konsisten dengan layout dua kolom saat detail aktif.
- Menambahkan regresi posisi di [tests/e2e/prompt-workbench.spec.ts](C:/Project%20Autiluer/tests/e2e/prompt-workbench.spec.ts) untuk memastikan drawer prompt desktop tampil di kolom kanan, bukan turun di bawah tabel.

## 2026-05-27 - PERF-01 Product List Read Model

- Mengubah read model `/products` agar pagination server-side hanya memuat page aktif dan relasi yang diperlukan untuk baris visible, bukan seluruh dataset workspace dulu.
- Memisahkan jalur `listProductListPageForUser` dari fallback legacy supaya query count dan page fetch bisa dioptimalkan tanpa mengubah perilaku `uploadFilter`.
- Menyesuaikan smoke test pagination produk agar mengikuti UI aktual yang memang tidak menampilkan label total hasil.

## 2026-05-25 - PROMPT-SINGLE-GEN-01

- Mengunci refactor `/prompts` menjadi single-product drawer `Output / Generate / History` seperti Share Caption dan menghapus prompt bulk queue dari surface operator.
- Menambahkan migration `prompt_packs` untuk `angle`, `variant_count`, `input_params_json`, dan `output_variants_json`.
- Menyiapkan prompt generate/regenerate agar memakai setting ringan: angle Share Caption, mode video, VO on/off, dan jumlah varian 1-4.
- Menghapus drawer/API/lib kontrak prompt queue dan mengganti `Buat Prompt` menjadi link langsung ke `?detail=<productId>&tab=generate`.
- Mengubah renderer output dan export TXT agar satu versi prompt dapat memuat 1-4 varian melalui `output_variants_json` dengan fallback data lama.
- Memperbarui smoke prompt workbench agar memvalidasi drawer generate tunggal, bukan bulk queue.

## 2026-05-25 - PROMPT-DRAWER-REFRESH-POLISH

- Memperbaiki monitor generate/regenerate prompt agar refresh UI mengikuti perubahan status task setiap 3 detik dan output prompt muncul tanpa pindah tab manual.
- Memisahkan picker `Mode video` dari tombol generate/antrikan pada drawer setup prompt single dan bulk.
- Menghapus summary duplikat di drawer bulk prompt karena jumlah pilihan sudah tampil di topbar drawer.

## 2026-05-25 - PROMPT-REGEN-KEY-ELIGIBILITY-01

- Memperbaiki runner generate/regenerate prompt pack agar error runtime non-Gemini tidak lagi diperlakukan sebagai rotasi key hingga berakhir sebagai `No eligible Gemini key`.
- Menambahkan diagnostic server-side terstruktur untuk kondisi no eligible Gemini key pada prompt pack tanpa mengekspos secret key.
- Menjaga persistence hasil generate dari kegagalan `revalidatePath` saat runner dipanggil melalui polling/API; client tetap refresh melalui monitor prompt.
- Mengubah legacy `Generate Ulang Prompt` dari detail produk menjadi enqueue-only agar mengikuti jalur regenerate prompt pack yang sama dengan drawer `/prompts`.

## 2026-05-25 - PROMPT-DRAWER-005-008 Setup Bulk dan Output Mode

- Mengubah bulk prompt di `/prompts` agar membuka setup drawer sebelum enqueue, dengan final `bulkEnqueuePromptPacks` hanya berjalan dari drawer.
- Memperluas kontrak Gemini prompt pack untuk membedakan `frame_to_video` dan `ingredients_to_video` melalui `generation_options.video_mode` tanpa migration.
- Menambahkan rendering output mode-aware: `frame_to_video` tetap menampilkan `First Frame Image` + `I2V Prompt`, sementara `ingredients_to_video` menampilkan `Ingredients Video Prompt`.
- Menyesuaikan TXT export, source-of-truth prompt pipeline, dan smoke/e2e prompt tests untuk menjaga kompatibilitas prompt pack lama.

## 2026-05-24 - PROMPT-DRAWER-004 Video Mode Selector

- Menambahkan selector `video_mode` di setup drawer prompt dengan opsi `frame_to_video` dan `ingredients_to_video`.
- Meneruskan pilihan mode video ke `savePromptPack(intent=create_generate)` melalui hidden field form final tanpa mengubah backend, schema database, Gemini builder/schema, output renderer, atau Flow manifest.
- Menjaga default aman `frame_to_video` untuk setup drawer dan kontrak lama yang tidak memiliki `generation_options.video_mode`.

## 2026-05-24 - PROMPT-DRAWER-003 Setup Drawer

- Mengubah aksi `Buat Prompt` di `/prompts` menjadi link ke setup drawer (`?setup=<productId>`) sehingga klik tombol hanya membuka drawer dan tidak langsung membuat prompt pack atau memicu task generate.
- Menambahkan komponen `PromptGenerateSetupDrawer` yang membungkus konfirmasi varian konten lewat `VariantSubmitButton`/`savePromptPack(intent=create_generate)` tanpa mengubah backend, schema, Gemini schema/builder, atau flow output.
- Menambahkan field `promptSetupHref` pada baris workbench server (`src/app/prompts/page.tsx`) dan API workbench (`src/app/api/prompts/workbench/route.ts`) agar tampilan desktop dan mobile load-more sejalan.
- Tidak mengubah kontrak `savePromptPack`, schema database, Gemini parser/builder, manifest Flow, atau alur bulk `Antrikan`.

## 2026-05-24 - PROMPT-DRAWER-002 Video Mode Contract

- Menambahkan kontrak minimal `video_mode` untuk prompt pack pada `prompt_packs.personalization_json.generation_options` dengan nilai `frame_to_video` dan `ingredients_to_video`.
- Menetapkan fallback kompatibel untuk data lama tanpa `video_mode` ke `frame_to_video` tanpa migration atau perubahan schema database.
- Meneruskan opsi `video_mode` pada save, regenerate, bulk enqueue, dan pembacaan prompt pack server-side tanpa mengubah UI drawer, Gemini schema/builder, atau Flow manifest.

## 2026-05-24 - Prompt Generate Drawer Actual Audit

- Menambahkan audit aktual flow Buat Prompt, Buat Ulang, Bulk Prompt, drawer, generation options, output prompt, kontrak Gemini, dan rencana implementasi setup-first prompt generation.
- Mendokumentasikan penilaian no-migration untuk menyimpan `video_mode` di `prompt_packs.personalization_json.generation_options`.
- Perubahan ini hanya dokumentasi; tidak ada runtime code, schema, migration, atau logic prompt generation yang diubah.

## 2026-05-24 - Formalisasi Banplex OS

- Mengubah identitas formal aplikasi menjadi `Banplex OS` dengan pemilik dan hak cipta `Dzul Qornain`.
- Menambahkan build metadata otomatis dari git untuk setiap build/push/deploy.
- Menambahkan generator dan guard changelog agar perubahan AI tercatat dari commit/diff aktual.
- Menambahkan runbook release/deploy dan tutorial Supabase CLI untuk push migrasi dev lalu production.
- Menambahkan migration grant Data API untuk tabel Share Workspace.
- Mengupdate devDependency Supabase CLI dari `2.98.1` ke `2.101.0`.
- Menyelaraskan migration history dev Supabase untuk Share Workspace dan menerapkan migration grant Data API sampai local/remote migration list bersih.

## 2026.05.24.1

- Menambahkan sumber versi app formal dengan build number bertanggal.
- Menampilkan build number dan copyright di footer shell authenticated.
- Menambahkan halaman `Settings > Tentang` untuk info versi, FAQ, dan riwayat rilis.
- Menambahkan FAQ internal untuk status sertifikat dan aturan bump versi.

## Aturan versi

- Format rilis app: `YYYY.MM.DD.N`.
- `N` berasal dari metadata build otomatis pada push/deploy.
- Versi data domain seperti prompt pack, share history, dan output history tetap terpisah dari versi app.
- Setiap agent AI wajib menambahkan entry aktual ketika mengubah code, schema, docs, workflow, atau UI.
