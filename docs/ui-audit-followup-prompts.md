# UI Audit Follow-up Guardrail

Dokumen ini adalah guardrail implementasi untuk hasil audit UI. Isinya sudah disesuaikan dengan source of truth repo aktual dan lock docs, sehingga tidak boleh dipakai untuk mendorong redesign yang bertabrakan dengan MVP.

## Source of Truth

- `docs/01_README_START_HERE.md`
- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/DATABASE_SCHEMA_LOCK.md`
- `docs/DO_NOT_BUILD.md`
- `docs/MICRO_TASK_BACKLOG.md`
- `docs/PROMPT_PIPELINE_LOCK.md`
- `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
- UI lock docs yang berlaku untuk shell, login, dan intake/product flow

## Visual Locks

- Runtime visual tetap light, native, mobile-first.
- Primary brand color tetap `--color-primary: #007aff`.
- Font utama tetap Inter melalui `--font-inter`.
- Komponen UI harus memakai semantic tokens dari `src/app/globals.css`.
- Jangan tambah hardcoded hex/RGB/ad hoc palette di component code.
- Jangan ubah navigasi, route, auth flow, schema, atau component API untuk audit follow-up ini.
- Jangan membuat dark-luxury, editorial, gold-primary, display-font, atau marketing-style direction.

## Filtering 8 Issue Audit

| Issue | Status | Keputusan Aman |
| --- | --- | --- |
| 1. Typography overhaul | Tidak aman | Jangan ganti Inter, jangan tambah display font, jangan ubah `layout.tsx`. Perbaikan typography hanya boleh lewat token existing bila ada micro-task khusus. |
| 2. Color system dual accent | Sebagian aman | Aman hanya untuk merapikan alias token ringan dan komentar legacy. Jangan ubah primary color, jangan jadikan gold sebagai brand primary, dan jangan rename massal token. |
| 3. Sidebar decorative blur | Aman | Hapus/nonaktifkan pseudo-element blur mahal pada `.sidebar::before`. Pertahankan visual sidebar berbasis token yang sudah ada. |
| 4. Status indicator polish | Aman | Rapikan tone existing `.status-badge` memakai semantic status tokens. Tetap gunakan `StatusBadge`, `.status-badge`, dan prop API saat ini. |
| 5. Micro-motion | Aman | Tambahkan transition CSS-only dan pressed state ringan untuk nav state. Respect `prefers-reduced-motion`. Jangan tambah JS scroll listener/topbar state. |
| 6. Dark luxury surface redesign | Tidak aman | Tidak diimplementasi. Bertentangan dengan light native operator UI dan login reference. |
| 7. Navigation/topbar behavior rewrite | Tidak aman | Jangan ubah struktur shell, route mapping, active state source, atau tambah `operator-topbar--scrolled`. |
| 8. Component rename/migration | Tidak aman | Jangan rename `StatusBadge` menjadi status component baru, jangan migrasi callsite, dan jangan ubah API komponen. |

## Safe Implementation Plan

1. Audit doc safety sync: jadikan dokumen ini guardrail lock-safe.
2. Token cleanup ringan: tambah komentar/alias legacy seperlunya di `src/app/globals.css` tanpa rename massal.
3. Sidebar performance: nonaktifkan `.sidebar::before` blur.
4. StatusBadge polish: rapikan `.status-badge--success/info/warning/danger/neutral`.
5. CSS-only micro-motion: tambahkan transition dan pressed state ringan untuk `.nav-link` dan `.bottom-nav__link`.

## Explicitly Invalidated Prompt Directions

Instruksi audit lama berikut tidak boleh diimplementasikan di repo ini:

- Dark-luxury editorial redesign.
- Gold primary, green/gold dual accent sebagai brand direction, atau penggantian `#007aff`.
- Display font pairing untuk heading/operator topbar.
- JS-based topbar scroll state seperti `operator-topbar--scrolled`.
- Rename `.status-badge` menjadi `.status-tag` atau komponen status baru.
- Layout marketing/hero treatment untuk operator surface.

## Review Checklist

- Perubahan hanya menyentuh dokumen dan CSS target yang relevan.
- Tidak ada dependency baru.
- Tidak ada migrasi database.
- Tidak ada route/auth/schema/flow changes.
- Tidak ada component API change.
- `input { width: 100% }` global tetap dipertahankan.
- `prefers-reduced-motion` tetap mematikan animasi/transisi yang tidak perlu.
