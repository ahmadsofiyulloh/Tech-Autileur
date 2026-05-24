# Drawer Inline Notification Audit — Design Spec
**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** Standardisasi penempatan dan auto-dismiss inline notification di semua drawer/panel

---

## 1. Problem Statement

Inline notification di drawer/panel saat ini:
- Tidak konsisten posisinya (ada di atas tabs, di dalam form, di bawah controls)
- Hampir semua persistent — tidak ada auto-dismiss
- Tidak ada shared component — setiap drawer punya markup sendiri (`error-box`, `helper-text`, `settings-action-feedback`, dll)
- Beberapa posisi merusak UI (di atas tabs memotong layout)

---

## 2. Goals

1. Buat shared `<InlineNotif>` component dengan auto-dismiss behavior terpusat
2. Standardisasi posisi: **paling bawah drawer body**, di ruang kosong setelah konten utama
3. Tidak ada tombol dismiss manual — auto-dismiss atau dismiss saat sukses berikutnya
4. Token-driven CSS — tidak ada hardcoded hex/rgb

---

## 3. Out of Scope

- Version banners (`output-version-banner`, `ShareOutputVersionBanner`) — punya link aksi, bukan notif biasa
- Per-item row errors (`prompt-queue-row__issue`) — kontekstual per item
- Progress panel errors (`bulk-import-activity__helper`, `bulk-import-log-list`) — log stream
- Reanalysis feedback (`affiliate-profile-reanalysis-feedback`) — punya list hasil per-asset dengan badge
- Copy/share icon swap di share output tab — sudah auto-dismiss 2s, pattern sudah tepat
- Global `route-toaster.tsx` — tidak diubah

---

## 4. Architecture

### Component baru
**File:** `src/components/operator/inline-notif.tsx`

```tsx
type InlineNotifType = "success" | "info" | "warning" | "error";

type InlineNotifProps = {
  type: InlineNotifType;
  message: string | React.ReactNode;
  notifKey?: string | number; // reset timer saat message berubah
  onDismissed?: () => void;
};
```

### CSS baru
**File:** `src/styles/05-features/inline-notif.css`

---

## 5. Auto-Dismiss Behavior

| Type    | Durasi     | Catatan |
|---------|------------|---------|
| success | 5000ms     | Auto fade-out |
| info    | 6000ms     | Auto fade-out |
| warning | 8000ms     | Auto fade-out |
| error   | persistent | Hilang hanya saat parent replace dengan notif baru |

**Pattern "error dismiss saat sukses berikutnya":**  
Parent menyimpan single `notif` state. Saat aksi sukses, parent set `{ type: "success", ... }` — error otomatis tergantikan, lalu success auto-dismiss setelah 5s.

---

## 6. State Management Pattern (Parent)

```tsx
const [notif, setNotif] = useState<{
  type: "success" | "info" | "warning" | "error";
  message: string;
  key: number;
} | null>(null);

// Error
setNotif({ type: "error", message: "Gagal memproses.", key: Date.now() });

// Sukses berikutnya → error tergantikan otomatis
setNotif({ type: "success", message: "Berhasil disimpan.", key: Date.now() });

// Render di paling bawah drawer body
{notif && (
  <InlineNotif
    type={notif.type}
    message={notif.message}
    notifKey={notif.key}
    onDismissed={() => setNotif(null)}
  />
)}
```

---

## 7. Internal Component Logic

1. Mount → animasi `inline-notif-enter` (200ms)
2. `useEffect` start timer berdasarkan `DISMISS_DURATIONS[type]`
3. Jika `notifKey` berubah → clear timer lama, start baru
4. Pre-dismiss → set `data-dismissing="true"` → trigger `inline-notif-exit` (300ms)
5. Setelah exit animation → panggil `onDismissed()` → parent set null

---

## 8. CSS Design

Token yang dipakai (semua existing dari `light-surface-base-shell.css`):
- `--color-status-success` / `--color-status-success-soft` / `--color-status-success-border`
- `--color-status-info-soft` / `--color-primary`
- `--color-status-warning` / `--color-status-warning-soft`
- `--color-status-error` / `--color-status-error-soft` / `--color-status-error-border`

Animasi:
- Enter: `translateY(4px) → 0` + `opacity 0 → 1` (200ms ease-out)
- Exit: `opacity 1 → 0` + `translateY(-2px)` (300ms ease-in)
- `prefers-reduced-motion`: animasi dinonaktifkan

Icons (lucide-react):
- success: `CheckCircle2`
- info: `Info`
- warning: `AlertTriangle`
- error: `CircleAlert`

---

## 9. ARIA

| Type | role | aria-live |
|---|---|---|
| success / info | `status` | `polite` |
| warning / error | `alert` | `assertive` |

`aria-atomic="true"` pada semua type.

---

## 10. Migration Map

### Instance yang dimigrasi ke `<InlineNotif>` (7 instance)

| File | Instance | Posisi baru |
|---|---|---|
| `prompt-detail-panel.tsx:249` | `error-box` | Paling bawah drawer body, setelah seluruh tab content |
| `prompt-detail-panel.tsx:251` | `helper-text` waiting-for-key | Paling bawah drawer body, setelah seluruh tab content |
| `prompt-queue-drawer.tsx:345` | `prompt-queue-error` | Paling bawah drawer body, setelah queue list |
| `bulk-import-panel.tsx:1035` | `error-box` | Paling bawah panel, setelah results |
| `affiliate-profiles-board.tsx:415` | `settings-action-feedback` desktop | Paling bawah panel, setelah table |
| `affiliate-profiles-board.tsx:554` | `settings-action-feedback` mobile | Paling bawah mobile drawer body |
| `intake-workflow-form.tsx:284` | `error-box` | Paling bawah form, setelah semua fields |
| `product-detail-panel.tsx:550` | `helper-text` QUEUED/GENERATING | Paling bawah History tab content |

### Instance yang TIDAK dimigrasi (special cases)

| File | Instance | Alasan |
|---|---|---|
| `prompt-detail-panel.tsx:278` | `output-version-banner` | Punya link aksi "Kembali ke Terbaru" |
| `share-output-tab.tsx:143` | `ShareOutputVersionBanner` | Punya link aksi |
| `prompt-queue-drawer.tsx:100` | `prompt-queue-row__issue` | Per-item error dalam row |
| `bulk-import-panel.tsx:517` | `bulk-import-activity__helper` | Progress error dalam progress panel |
| `bulk-import-panel.tsx:519` | `bulk-import-log-list` | Log stream real-time |
| `affiliate-profiles-board.tsx:230` | `affiliate-profile-reanalysis-feedback` | List hasil per-asset dengan badge |
| `share-output-tab.tsx:39` | Copy/share icon swap | Sudah auto-dismiss 2s, pattern tepat |

---

## 11. Edge Cases

| Kasus | Behavior |
|---|---|
| Notif baru muncul saat notif lama masih visible | State di-replace, timer reset via `notifKey` |
| Error → aksi sukses | Parent set success → error hilang, success auto-dismiss 5s |
| Drawer ditutup saat notif visible | Component unmount, timer cleared via cleanup |
| Multiple notif bersamaan | Tidak didukung — single state, satu notif per drawer |
| `message` berupa ReactNode | Didukung via `string | ReactNode` prop |

---

## 12. Verification

Setelah implementasi, jalankan:
```bash
npm run audit:colors
npm run audit:typography
npm run audit:neutral-ui
npm run lint
npm run typecheck
npm run build
```
