# UI/UX Polish Plan

## Summary
Dokumen ini adalah rujukan tetap untuk semua UI/UX polish berikutnya di Affiliate AI Content OS. Isinya merangkum pola visual yang aman dari referensi gambar, lalu menerjemahkannya menjadi aturan implementasi yang konsisten untuk repo ini.

Tujuannya bukan redesign total. Tujuannya adalah membuat semua surface operasional terasa seperti satu sistem yang sama: rapi, padat, mobile-first, dan mudah dipolish bertahap tanpa mengubah flow MVP.

## Safe Visual Principles

### 1. Typography hierarchy
- Gunakan hierarki yang konsisten: `page title -> section title -> card title -> body -> meta/label`.
- Satu layar hanya boleh punya satu judul yang benar-benar dominan.
- `Section title` harus lebih tenang dari `page title`, dan `card title` harus lebih kecil lagi.
- `Meta`, `status`, dan `helper line` harus tetap ringan agar tidak bersaing dengan isi utama.

### 2. 8pt spacing rhythm
- Pakai ritme dasar 8pt sebagai fondasi spacing.
- Skala aman: `4`, `8`, `12`, `16`, `24`, lalu `32+` hanya untuk pemisah blok besar.
- Di dalam kartu atau section, spacing harus stabil dan berulang.
- Hindari spacing acak per komponen atau per halaman.

### 3. Card anatomy
- Kartu operasional harus punya struktur yang mudah dibaca: title, meta, body, action.
- Media atau thumbnail boleh dominan, tetapi tidak boleh menenggelamkan isi teks.
- Radius, border, shadow, dan padding harus terasa ringan, bukan dekoratif.
- Kartu harus bekerja di mobile dan desktop tanpa berubah identitas visual.

### 4. State design
- Setiap surface aktif harus punya loading, empty, dan error state.
- Loading state harus mengikuti bentuk konten nyata, bukan hanya spinner kecil.
- Empty state harus singkat dan tidak terlihat seperti konten utama.
- Status dan badge harus cukup jelas untuk dipahami cepat, tapi tetap kecil dan tenang.

### 5. Responsive behavior
- Prioritaskan mobile-first, lalu skala naik ke desktop tanpa memecah hierarchy.
- Mobile harus padat, touch-friendly, dan mudah dipindai.
- Desktop boleh lebih lebar, tetapi tidak boleh berubah jadi layout marketing.
- Bottom sheet, drawer, dan safe-area spacing harus tetap native-feel.

## Surface Mapping

### Dashboard
- Page title ringan dan dominan.
- Section title untuk grup ringkasan dan analytics.
- KPI, chart, empty state, dan usage overview harus berbagi hierarki yang sama.

### Products
- Card title harus paling terlihat di list item.
- Meta dipakai untuk marketplace, status, dan context singkat.
- List harus tetap operasional, bukan naratif.

### Intake
- Section title memandu urutan workflow.
- Preview cards, readiness, dan status proses harus konsisten dengan ritme spacing yang sama.
- Tidak ada hero besar atau penjelasan panjang.

### Prompts
- Prompt pack panel harus terasa seperti kartu operasional, bukan form panjang.
- Copy-ready fields perlu struktur yang jelas dan konsisten.
- History dan revision input harus tetap ringan secara visual.

### Drive
- Tile grid harus menjadi pola utama.
- Bottom sheet preview harus memakai hierarchy yang jelas: preview -> meta -> action.
- Long-press select tetap sekunder terhadap tap preview.

### Settings
- Overview harus terasa seperti native grouped list.
- Drawer dan bottom sheet dipakai untuk edit, bukan form panjang di halaman utama.
- Section routing tetap jelas, tapi tidak menambah navigasi baru.

## Implementation Segments

### Segment A: Token audit
- Scope: audit token typography, spacing, radius, shadow, dan surface values yang sudah ada.
- Goal: pastikan komponen memakai token, bukan literal baru.
- Acceptance: semua ukuran visual penting bisa ditelusuri ke token source of truth.

### Segment B: Typography pass
- Scope: samakan hierarki teks di halaman dan section yang paling terlihat.
- Goal: satu layar satu page title dominan, section title konsisten, card title lebih kecil.
- Acceptance: page, section, card, body, dan meta terbaca sebagai satu sistem.

### Segment C: Section spacing pass
- Scope: rapikan padding dan gap pada wrapper section.
- Goal: setiap section terasa seperti satu family visual.
- Acceptance: spacing antar header, body, dan blok section stabil di mobile dan desktop.

### Segment D: Card anatomy pass
- Scope: seragamkan bentuk kartu di surface operasional.
- Goal: kartu punya padding, border, radius, dan shadow yang konsisten.
- Acceptance: dashboard, products, prompts, drive, dan settings terasa satu keluarga kartu.

### Segment E: State surfaces pass
- Scope: loading, empty, error, badge, dan status surfaces.
- Goal: semua state terasa satu sistem visual.
- Acceptance: state tidak saling bertabrakan dan tetap mengikuti hierarchy.

### Segment F: Bottom sheet polish
- Scope: bottom sheet, preview sheet, drawer sheet, safe-area handling.
- Goal: native-feel yang ringan dan stabil.
- Acceptance: sheet tidak menutupi shell dengan cara yang janggal dan tetap nyaman di mobile.

### Segment G: Shell spacing polish
- Scope: topbar, content offset, bottom nav spacing, shell rhythm.
- Goal: menjaga hierarki halaman saat masuk ke semua route.
- Acceptance: shell tidak mengganggu keterbacaan page title, section title, dan card content.

## Out Of Scope
- Flow Control redesign.
- Database schema changes.
- Prompt pipeline logic changes.
- Navigation changes.
- New product features di luar MVP.
- Marketing hero layout.
- Service worker, offline cache, atau background sync.
- Custom remote desktop behavior.
- Auto upload TikTok/Shopee.
- Browser automation untuk Google Flow.

## Acceptance Criteria
- Setiap micro-task punya scope kecil dan satu tujuan utama.
- Setiap micro-task bisa diverifikasi sendiri tanpa tergantung work besar lain.
- Tidak ada perubahan flow atau schema hanya karena polish visual.
- UI tetap minimal, dense, dan mobile-first.
- Semua perubahan visual tetap mengikuti lock docs yang sudah ada.

## Implementation Instructions

### Working rules for every implementer
- Baca dokumen ini bersama lock docs sebelum mengubah UI apa pun.
- Mulai dari token dan komponen dasar, bukan dari page-level redesign.
- Jika sebuah perubahan membutuhkan nilai visual baru, extend token layer dulu lalu pakai token itu di komponen.
- Jangan menambah asumsi visual baru hanya karena layar terlihat kosong atau "kurang pas".
- Jangan mengubah flow, copy policy, schema, atau navigation sebagai bagian dari polish visual.
- Jangan memperkenalkan style baru yang hanya cocok untuk satu page lalu memecah konsistensi surface lain.

### Non-negotiables
- Hierarki harus tetap: `page title -> section title -> card title -> body -> meta/label`.
- Spacing harus mengikuti ritme 8pt.
- Mobile-first behavior harus tetap lebih penting daripada desktop flourish.
- Loading, empty, dan error states wajib tetap ada di setiap surface aktif.
- Bottom sheet dan drawer harus tetap safe-area aware.
- Semua surface operasional harus terasa seperti satu keluarga visual.

### Decision rules
- Jika ada dua pilihan visual yang sama-sama valid, pilih yang paling netral dan paling konsisten dengan token yang sudah ada.
- Jika referensi gambar mendorong efek dekoratif tetapi token repo tidak mendukungnya, jangan menambah dekorasi baru.
- Jika satu komponen dipakai lintas surface, optimalkan untuk konsistensi lintas surface, bukan untuk satu page tertentu.
- Jika ada ketidakjelasan, pilih perubahan terkecil yang tetap memenuhi hierarchy dan spacing.
- Jangan menafsirkan ruang kosong sebagai izin untuk menambah blok baru.

### Required work output for each micro-task
- Sebutkan file yang berubah.
- Jelaskan scope yang dikerjakan.
- Jelaskan apa yang sengaja tidak diubah.
- Jalankan verifikasi yang relevan jika task menyentuh runtime UI.
- Laporkan risiko atau asumsi hanya jika benar-benar diperlukan.

### Handoff contract
- Micro-task harus bisa dilanjutkan oleh implementer lain tanpa membaca chat lama.
- Setiap task berikutnya harus bisa memahami tujuan, scope, dan batasan hanya dari lock docs dan plan ini.
- Jika ada perubahan kecil pada arah polish, update dokumen ini dulu agar plan tetap menjadi sumber rujukan tunggal.

## Source Of Truth
- [UI_UX_POLISH_IMPLEMENTER_PROMPT.md](UI_UX_POLISH_IMPLEMENTER_PROMPT.md)
- [UI_UX_POLISH_SESSION_START.md](UI_UX_POLISH_SESSION_START.md)
- [UI_UX_POLISH_ONE_PAGER.md](UI_UX_POLISH_ONE_PAGER.md)
- [UI_UX_POLISH_QUICKSTART.md](UI_UX_POLISH_QUICKSTART.md)
- [PRD_SOURCE_OF_TRUTH.md](PRD_SOURCE_OF_TRUTH.md)
- [ARCHITECTURE_LOCK.md](ARCHITECTURE_LOCK.md)
- [MOBILE_REMOTE_CONTROL_LOCK.md](MOBILE_REMOTE_CONTROL_LOCK.md)
- [MICRO_TASK_BACKLOG.md](MICRO_TASK_BACKLOG.md)
- [UI_UX_POLISH_IMPLEMENTER_GUIDE.md](UI_UX_POLISH_IMPLEMENTER_GUIDE.md)
- [VISUAL_PWA_PROGRESS_2026_05_04.md](VISUAL_PWA_PROGRESS_2026_05_04.md)

## Notes For Future Implementation
- Jika ada token visual baru yang dibutuhkan, extend token layer dulu sebelum dipakai di komponen.
- Jika ada micro-task baru, tambahkan di bagian Implementation Segments atau pecah lagi menjadi sub-task kecil.
- Dokumen ini bersifat living plan dan boleh diperbarui, tetapi prinsip aman dan scope kecil harus tetap dijaga.
