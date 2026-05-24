# Changelog

<!-- changelog:generated:start -->
## Riwayat commit aktual

Range: `origin/main..HEAD`

### 2026-05-20

- `46ca253` feat: add AI Media Lab frontend and shell polish
- `7f2923a` feat: expand dashboard quick actions
- `293b99d` fix: stabilize dashboard badge token and next-env routes
- `adaff51` docs: sync AI Media audit and backlog

### 2026-05-21

- `bf6d3ed` Fixing Mdularisasi css global
- `9b2d6b4` docs: add workflow and AI Media Lab backend guides
- `660e099` feat: add AI Media Lab backend and settings surface

### 2026-05-22

- `d749f2c` feat: enforce neutral action tokens
- `3b75d03` docs: lock neutral action UI rules
- `fba4134` fix: neutralize non-badge status tokens
- `4348d30` fix: align settings drawer desktop layout
- `41d5391` feat: add prompt generator flexibility options
- `b34a99f` feat: polish product detail panel and regeneration
- `ead98c6` feat: unified connected-table nav tabs globally
- `0b2a511` feat: add custom branded scrollbar tokens
- `0e4e668` docs: lock generation options in prompt pipeline

### 2026-05-23

- `1297c19` docs: add Share workspace redesign spec
- `9f53f8d` docs: update architecture lock, backlog, and pipeline specs
- `420e5b9` feat: add Share workspace feature scaffold
- `a8f9324` feat: redesign product list with bulk selection mode
- `b12bacd` feat: enhance prompt history and workbench list views
- `a972a0a` chore: update shell config and e2e guard test
- `dafe517` feat: remove share list header, update topbar per platform
- `de91743` docs: add Share workspace UX fallback design spec
- `4aa670b` feat(share): add generation-status polling endpoint

### 2026-05-24

- `2c886fc` docs: add unified generation UX design spec
- `ddfa13f` docs: add drawer inline notif audit design spec
- `3b98584` docs: add drawer inline notif implementation plan
- `05d04d3` feat(ui): add inline-notif CSS with token-driven colors and animations
- `6d6add6` feat(ui): add InlineNotif shared component with auto-dismiss
- `0ac9e8f` chore: refresh next-env.d.ts
- `8944709` docs: add share workspace V1 plan, audit, and mark V1-009 deferred
- `f4514cb` docs: add superpowers design specs for share workspace UX
- `a448803` feat(share): SHARE-V1-008 product metadata context for Gemini prompts
- `734065e` feat(share): SHARE-V1-001-007 share workspace V1 UI
- `4100386` feat(ui): add unified generating state components
- `40259d4` feat(prompts): refactor to enqueue-only regeneration pattern
- `85b3a4d` feat(ui): add InlineNotif shared component with auto-dismiss
- `b6a7698` feat(products): update intake workflow form
- `47114c5` feat(gemini): update key routing and add share caption JSON schema
- `270161d` feat(ui): update navigation config and responsive styles
- `9312179` feat(share): standardize option controls
- `06aa4ff` fix(ai): recover stale tasks and refine key routing
- `4679b03` perf(ui): streamline loading and action states
- `dc97e51` perf(settings): parallelize overview reads
- `108505b` docs(perf): add page load performance plan
- `1903c19` feat(formalization): add app release metadata
- `b7ed263` feat(release): automate Banplex OS identity metadata
- `c93df74` docs(release): enforce changelog and deploy runbook
- `7afdfc4` fix(db): grant share workspace data api access
<!-- changelog:generated:end -->

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
