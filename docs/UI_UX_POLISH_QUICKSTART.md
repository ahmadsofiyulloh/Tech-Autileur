# UI/UX Polish Quickstart

## Start Here
Baca urutan ini sebelum mengerjakan UI/UX polish:

1. [UI_UX_POLISH_IMPLEMENTER_PROMPT.md](UI_UX_POLISH_IMPLEMENTER_PROMPT.md)
2. [UI_UX_POLISH_SESSION_START.md](UI_UX_POLISH_SESSION_START.md)
3. [UI_UX_POLISH_ONE_PAGER.md](UI_UX_POLISH_ONE_PAGER.md)
4. [UI_UX_POLISH_PLAN.md](UI_UX_POLISH_PLAN.md)
5. [UI_UX_POLISH_IMPLEMENTER_GUIDE.md](UI_UX_POLISH_IMPLEMENTER_GUIDE.md)
6. [PRD_SOURCE_OF_TRUTH.md](PRD_SOURCE_OF_TRUTH.md)
7. [ARCHITECTURE_LOCK.md](ARCHITECTURE_LOCK.md)
8. [MOBILE_REMOTE_CONTROL_LOCK.md](MOBILE_REMOTE_CONTROL_LOCK.md)
9. [MICRO_TASK_BACKLOG.md](MICRO_TASK_BACKLOG.md)

## Canonical Segment Order
Kerjakan hanya urutan ini:

1. `Segment A: Token audit`
2. `Segment B: Typography pass`
3. `Segment C: Section spacing pass`
4. `Segment D: Card anatomy pass`
5. `Segment E: State surfaces pass`
6. `Segment F: Bottom sheet polish`
7. `Segment G: Shell spacing polish`

Jangan ganti urutan tanpa update plan dulu.

## Non-Negotiable Rules
- Hierarki harus tetap: `page title -> section title -> card title -> body -> meta/label`.
- Spacing harus tetap mengikuti ritme 8pt.
- Mobile-first tetap prioritas utama.
- Loading, empty, dan error state wajib ada pada surface aktif.
- Bottom sheet dan drawer harus safe-area aware.
- Jangan ubah flow, schema, atau navigation untuk polish visual.
- Jangan menambah asumsi visual baru hanya karena layar terlihat kosong.

## Allowed Work
- Audit token visual.
- Rapikan hierarki teks.
- Samakan spacing section.
- Samakan anatomy kartu.
- Poles loading/empty/error state.
- Poles bottom sheet dan shell spacing.

## Not Allowed
- Feature baru di luar MVP.
- Flow Control redesign.
- Database schema changes.
- Navigation changes.
- Marketing hero layout.
- Browser automation.
- Auto upload TikTok/Shopee.

## Required Output
Setiap task harus melaporkan:

- segment name
- goal
- files changed
- scope completed
- out of scope
- verification results
- risks or assumptions

Kalau format ini tidak bisa dipenuhi, task belum selesai.

## Stop Conditions
Berhenti dan update plan jika:

- perubahan butuh token visual baru
- perubahan menyentuh flow, schema, atau navigation
- perubahan butuh copy yang belum diizinkan
- scope mulai melebar ke halaman lain tanpa alasan

## Rule Of Thumb
Pilih perubahan terkecil yang tetap menjaga hierarchy, spacing, dan konsistensi lintas surface.
