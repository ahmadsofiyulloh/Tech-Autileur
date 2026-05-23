# Share Workspace UX Fallback Layer — Design Spec

**Date:** 2026-05-23
**Status:** Approved
**Stream:** Share Workspace
**Scope:** Loading state, error state, timeout state for caption generation flow

---

## Problem Statement

Saat user klik "Generate Caption", share workspace tidak memberikan feedback visual yang memadai:

- Status `generating` hanya menampilkan teks statis: "Caption sedang di-generate. Tunggu sebentar."
- Tidak ada auto-refresh — user harus reload manual untuk lihat hasil
- Tidak ada indikator progress atau animasi hidup
- Error message generik tanpa konteks atau action yang jelas
- Tidak ada timeout handling jika proses stuck

---

## Decisions

| Aspek | Keputusan |
|-------|-----------|
| Pendekatan update | Polling (3s interval, stop on terminal status) |
| Visual loading style | Pulse Status + Shimmer (Option D) |
| Error UX | Context-aware message + dual action (Retry / Edit Form) |
| Timeout threshold | 90 detik client-side |
| Streaming | Tidak diimplementasi (fire-and-forget worker + JSON schema tidak kompatibel) |

---

## Architecture

### Polling Mechanism

- Client component `ShareGeneratingState` menggunakan `useEffect` + `setInterval`
- Interval: **3 detik**
- Stop conditions: status berubah ke `generated` atau `error`
- Max duration: **90 detik** → tampilkan `ShareTimeoutState`
- Endpoint: `GET /api/share/generation-status?id={generationId}`
- Response shape: `{ status: string, error_message: string | null, output_json: unknown | null }`
- Auth: RLS enforced di Supabase, no extra auth layer needed

**Kenapa polling bukan Supabase Realtime:**
- Simpler — tidak ada subscription/channel/cleanup management
- 3s interval cukup untuk UX yang terasa live
- Konsisten dengan fire-and-forget worker pattern yang sudah ada

### Component Structure

```
share-output-tab.tsx (modified)
├── ShareGeneratingState (NEW — client component)
│   ├── PulseStatusHeader
│   ├── ShimmerPlaceholder (× variant_count)
│   └── usePolling → /api/share/generation-status
├── ShareErrorState (NEW)
│   ├── ErrorContextMessage
│   └── DualActionButtons
├── ShareTimeoutState (NEW)
└── ShareOutputContent (existing — status="generated")
```

---

## Loading State: Pulse Status + Shimmer

Ditampilkan saat `status === "generating"`.

### Layout

```
┌─────────────────────────────────────┐
│  ● Generating caption...            │  ← pulsing dot + status text
│  Estimasi 10-30 detik               │  ← subtitle muted
├─────────────────────────────────────┤
│  ████████░░░░░░░░░░  [shimmer]      │  ← shimmer bar 1 (75%)
│  ██████████████░░░░░  [shimmer]     │  ← shimmer bar 2 (90%)
│  ██████░░░░░░░░░░░░░  [shimmer]     │  ← shimmer bar 3 (50%)
│                                     │
│  ████████░░░░░░░░░░  [shimmer]      │  ← variant 2 group (jika variant_count > 1)
│  ██████████████░░░░░  [shimmer]     │
│  ██████░░░░░░░░░░░░░  [shimmer]     │
└─────────────────────────────────────┘
```

### Visual Tokens

- Pulsing dot: 8px circle, `var(--color-accent)`, animasi scale 0.8→1.2 + opacity 0.3→1, duration 1.4s infinite
- Status text: 13px, `var(--color-text-primary)`
- Subtitle: 11px, `var(--color-text-muted)`
- Shimmer bars: 3 bars per variant slot, height 8px, border-radius 4px
- Shimmer gradient: `linear-gradient(90deg, var(--color-surface-alt) 0%, var(--color-border) 50%, var(--color-surface-alt) 100%)`
- Shimmer animation: `background-size: 200% 100%`, staggered delay 0s / 0.3s / 0.6s per bar
- Variant separator: subtle divider (`var(--color-border)`) antara variant groups jika `variant_count > 1`

### Status Text Progression (berdasarkan elapsed time)

| Elapsed | Text |
|---------|------|
| 0–5s | "Memproses permintaan..." |
| 5–15s | "Menghubungi Gemini..." |
| 15–30s | "Generating caption..." |
| 30–60s | "Masih memproses, mohon tunggu..." |
| 60–90s | "Proses lebih lama dari biasa..." |

### Transition ke Generated Content

Saat polling detect `status === "generated"`:
1. Shimmer bars fade out (200ms)
2. Real caption content fade in (300ms, staggered per variant)
3. Tidak ada full page reload — client component swap content in-place

---

## Error State: Context-Aware + Dual Action

Ditampilkan saat `status === "error"`.

### Layout

```
┌─────────────────────────────────────┐
│  ⚠  Gagal generate caption          │  ← error header
│                                     │
│  [Error message sesuai konteks]     │  ← contextual explanation
│                                     │
│  ┌──────────┐  ┌──────────────────┐ │
│  │  Retry   │  │  Ubah & Coba Lagi│ │  ← dual action
│  └──────────┘  └──────────────────┘ │
│                                     │
│  → Kelola Gemini key di Settings    │  ← conditional link (key/quota errors only)
└─────────────────────────────────────┘
```

### Error Type Mapping

| `error_message` contains | User-facing message | Button kiri | Button kanan | Settings link |
|---|---|---|---|---|
| "key" / "quota" / "no key" | "Tidak ada Gemini key tersedia atau kuota habis." | Settings | Retry | Ya (inline link, bukan button) |
| "timeout" | "Proses timeout. Gemini tidak merespons dalam waktu yang ditentukan." | Retry | Ubah & Coba Lagi | Tidak |
| "parse" / "invalid" / "json" | "Respons dari Gemini tidak valid. Coba lagi." | Retry | Ubah & Coba Lagi | Tidak |
| default | "Terjadi error saat generate caption." | Retry | Ubah & Coba Lagi | Tidak |

### Action Behavior

- **Retry**: re-calls `generateShareCaption` server action dengan input yang sama. Input diambil dari generation record (`platform`, `angle`, `variant_count`, `product_id`) + `affiliate_url` dari `share_product_links` (join via `product_id`)
- **Ubah & Coba Lagi**: navigates ke input form tab dengan data pre-filled dari generation record
- **Settings link**: `href="/settings"`, hanya muncul untuk key/quota errors

---

## Timeout State

Ditampilkan saat polling mencapai 90 detik tanpa status change.

**Penting:** Ini bukan error — hanya client-side timeout. Worker mungkin masih berjalan di background.

### Layout

```
┌─────────────────────────────────────┐
│  ⏱  Proses lebih lama dari biasa    │  ← timeout header
│                                     │
│  Caption mungkin masih diproses di  │
│  background. Kamu bisa:             │
│                                     │
│  ┌──────────┐  ┌──────────────────┐ │
│  │  Refresh │  │  Kembali ke Form │ │
│  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────┘
```

- **Refresh**: `router.refresh()` untuk re-fetch status terbaru dari server
- **Kembali ke Form**: navigates ke input form tab

---

## Files

### New Files

| File | Purpose |
|------|---------|
| `src/app/api/share/generation-status/route.ts` | Polling endpoint — returns `{ status, error_message, output_json }` |
| `src/app/share/_components/share-generating-state.tsx` | Loading UI dengan pulse + shimmer + polling hook |
| `src/app/share/_components/share-error-state.tsx` | Error UI dengan context-aware message + dual action |

### Modified Files

| File | Change |
|------|--------|
| `src/app/share/[platform]/share-output-tab.tsx` | Route ke state components berdasarkan status |
| `src/styles/05-features/share-workspace.css` | Animasi pulse, shimmer, fade transitions |

---

## Out of Scope

- Cancel/abort generation mid-flight
- Supabase Realtime subscription
- Token-by-token streaming
- Queue position display
- Sound/push notification saat selesai
- WAITING_FOR_KEY status display (ditangani oleh error state via error_message)

---

## Acceptance Criteria

1. Saat status `generating`: pulse dot + shimmer skeleton muncul, status text berubah sesuai elapsed time
2. Polling berjalan setiap 3 detik dan berhenti otomatis saat status terminal
3. Saat status berubah ke `generated`: shimmer fade out, caption content fade in tanpa full reload
4. Saat status `error`: error message sesuai tipe error, dual action button muncul, Settings link muncul hanya untuk key/quota errors
5. Saat polling 90 detik tanpa perubahan: timeout state muncul dengan Refresh + Kembali ke Form
6. Semua animasi menggunakan CSS tokens (`var(--color-accent)`, `var(--color-surface-alt)`, dll) — tidak ada hardcoded hex/rgb
7. Build, lint, typecheck pass
