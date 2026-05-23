# Unified Generation UX Design

**Date:** 2026-05-24  
**Status:** Approved  
**Scope:** Generic loading state component + unified 3-tab navigation for Prompt & Share workspaces

---

## Context

Currently, the app has inconsistent UX patterns across generation surfaces:

- **Share workspace:** 2 tabs (Output | History) + separate input form (`?mode=input`), polling loading state with 5-stage progress text
- **Prompt workspace:** No tabs — stacked SectionCards (Output + Regenerate form), no progress text during generation
- **Intake metadata:** Static skeleton during server action, no progress feedback
- **Prompt history drawer:** Renders full `<PromptDetailPanel>` including Regenerate section, breaking read-only UX
- **Share history:** Only has Regenerate button, no way to view full output of old generations

User feedback:
- "Regenerate field memecah UX" (in prompt history drawer)
- "Share history tidak ada tombol untuk melihat versi lainnya selain yang aktif terbaru"
- "Seragamkan loading UI ketika generate sedang berjalan"

---

## Goals

1. **Unified loading state:** One generic `<GeneratingState>` component for all surfaces (intake, prompt, share)
2. **Consistent navigation:** Prompt and Share both use 3-tab structure (Output | Generate/Regenerate | History)
3. **Seamless history UX:** History tabs are read-only lists with "Lihat" button to view old versions, no Regenerate button in history
4. **Discoverable actions:** Tab navigation replaces scattered links (overflow menu, toolbar, form footer)

---

## Design

### 1. Generic `<GeneratingState>` Component

**Location:** `src/components/operator/generating-state.tsx`

**API:**

```typescript
type GeneratingStateProps = {
  // Skeleton visual — composition pattern
  skeleton: React.ReactNode;
  
  // Status text stages (array of string, cycle through over time)
  statusStages: string[];
  
  // Polling mode (share, prompt)
  pollFn?: () => Promise<{ status: string; error_message?: string | null }>;
  pollIntervalMs?: number;   // default 3000
  timeoutMs?: number;        // default 90000
  onResolved?: (result: { status: string; error_message?: string | null }) => void;
  onTimeout?: () => void;
  
  // Non-polling mode (intake) — parent controls lifecycle
  isPending?: boolean;
};
```

**Behavior:**

- When `pollFn` is provided → component manages polling lifecycle (setInterval, cleanup, timeout)
- When `isPending=true` without `pollFn` → component only renders skeleton + cycling status text, parent controls unmount
- Status text cycles through `statusStages` array every 15 seconds (same as `ShareGeneratingState`)
- Timeout triggers `onTimeout()` callback after `timeoutMs` (default 90s)
- Polling success/error triggers `onResolved()` callback

**Skeleton variants (composition):**

- **Share:** Shimmer bars per variant slot (existing pattern from `ShareGeneratingState`)
- **Prompt:** Shimmer blocks for prompt fields (image prompt, text prompt, VO)
- **Intake:** Shimmer card for metadata fields (nama, kategori, deskripsi)

**Migration:**

- `ShareGeneratingState` → thin wrapper over `<GeneratingState>` with share-specific skeleton
- `IntakeMetadataPendingPanel` → replace static `SkeletonIntakeMetadataPreview` with `<GeneratingState isPending={true}>` + intake skeleton
- Prompt generate/regenerate → `<GeneratingState>` with prompt skeleton + polling

**Intake caveat:** Intake metadata uses synchronous server action (no background worker, no polling endpoint). `<GeneratingState>` is used visual-only during server action pending state. `onResolved` is called from parent when server action resolves/rejects.

---

### 2. Unified 3-Tab Navigation for Prompt & Share

**Principle:** Consistency across workspaces. Prompt and Share have identical navigation patterns: **3 tabs in drawer** as the single source of navigation. Remove old navigation (toolbar links, overflow menu history link, regenerate button in history list).

---

#### A. Prompt Detail — 3 Tabs

```
[ Output ] [ Regenerate ] [ History ]
```

**Tab Output:**
- `<PromptOutputFields>` + "Simpan TXT Drive" button
- Read-only
- When viewing old version: banner "Versi X — 22 Mei 2026" + "Kembali ke Terbaru" button

**Tab Regenerate:**
- Form: regeneration_scope, video_model, vo_enabled, vo_length_preset, revision_instruction, "Buat Ulang" button
- When generate is running → replace with `<GeneratingState>` + prompt skeleton

**Tab History:**
- Inline list of generation history (version, date, note)
- Each row has "Lihat" button → switches to Tab Output with that version's data
- **No Regenerate button** in history list — seamless, read-only

**Navigation removed:**
- "History" button at bottom of Regenerate form (now a tab)
- Full page `/prompts/[id]/history` remains as route but primary access is via tab

**Tab state:** URL param `?tab=output|regenerate|history` (same as share pattern)

**Tab default:** Output

---

#### B. Share Detail — 3 Tabs

```
[ Output ] [ Generate ] [ History ]
```

Currently share has 2 tabs (Output | History) + separate input form (`?mode=input`). Changed to 3 tabs:

**Tab Output:**
- Caption variants (existing `ShareOutputTab`)
- Read-only + copy/share actions
- When viewing old version: banner "Versi X — 22 Mei 2026" + "Kembali ke Terbaru" button

**Tab Generate:**
- Input form (existing `ShareInputForm`)
- When generate is running → replace with `<GeneratingState>` + share skeleton

**Tab History:**
- List of past generations
- Each row has "Lihat" button → switches to Tab Output with that generation's data
- **Remove "Regenerate" button** from history list — user who wants to regenerate from old version clicks "Lihat" first, then can go to Tab Generate (prefilled)

**Navigation removed:**
- `?mode=input` logic (now Tab Generate)
- "Regenerate" button in history list row

**Tab state:** URL param `?tab=output|generate|history` (replace `?mode=input` with `?tab=generate`)

**Tab default:** Output (or Generate if no generation exists yet)

---

#### C. Consistency Pattern

| Aspect | Prompt | Share |
|--------|--------|-------|
| Tab 1 | Output (read-only) | Output (read-only) |
| Tab 2 | Regenerate (form) | Generate (form) |
| Tab 3 | History (list + "Lihat") | History (list + "Lihat") |
| Tab state | `?tab=` URL param | `?tab=` URL param |
| Loading state | `<GeneratingState>` in Tab 2 | `<GeneratingState>` in Tab 2 |
| History row action | "Lihat" only | "Lihat" only |
| CSS | Reuse `tab-nav tab-nav--flush` | Existing `tab-nav tab-nav--flush` |

---

### 3. Data Flow & Error Handling

**Loading state flow (all surfaces):**

```
User submits form (Tab Generate/Regenerate)
  ↓
Server Action inserts record → returns generationId
  ↓
Tab switches to Output (URL: ?tab=output)
  ↓
<GeneratingState> mounts — polling starts
  ↓
pollFn() every 3 seconds → fetch status endpoint
  ↓
status === "generated" → onResolved() → router.refresh()
  ↓
Tab Output renders latest data
```

**Error handling:**

- `status === "error"` → `onResolved()` called → parent renders error state with message from `error_message`
- Timeout 90 seconds → `onTimeout()` callback → render timeout state with retry button (navigate to Tab Generate)
- Network error during polling → silent retry, does not interrupt user

**"Lihat" old version flow:**

```
User in Tab History → clicks "Lihat" on version X row
  ↓
URL: ?tab=output&version=<generationId>
  ↓
Tab Output fetches data for that generationId
  ↓
Renders output + banner "Versi X — tanggal"
  ↓
"Kembali ke Terbaru" button → removes ?version param
```

**Intake caveat (confirmed from Section 1):**

Intake metadata does not use polling — server action is synchronous. `<GeneratingState>` is used visual-only (skeleton + status text cycling) during server action pending. No `pollFn`, `onResolved` is called from parent when server action resolves/rejects.

**Error states required for every surface:**

- Generate/Regenerate error → message from `error_message` + "Coba Lagi" button (return to form)
- Timeout → timeout message + "Coba Lagi" button
- Empty output (never generated) → empty state in Tab Output with CTA to Tab Generate

---

### 4. Component API & CSS

**`<GeneratingState>` API final:**

```typescript
type GeneratingStateProps = {
  skeleton: React.ReactNode;
  statusStages: string[];
  // Polling mode (share, prompt)
  pollFn?: () => Promise<{ status: string; error_message?: string | null }>;
  pollIntervalMs?: number;   // default 3000
  timeoutMs?: number;        // default 90000
  onResolved?: (result: { status: string; error_message?: string | null }) => void;
  onTimeout?: () => void;
  // Non-polling mode (intake) — parent controls lifecycle
  isPending?: boolean;
};
```

When `pollFn` is provided → component manages polling itself.
When `isPending=true` without `pollFn` → component only renders skeleton + cycling status text, parent controls when to unmount.

**CSS:**

- Reuse existing `.tab-nav`, `.tab-nav--flush`, `.tab-link` from `unified-nav-tabs.css`
- `<GeneratingState>` uses class `.generating-state` with shimmer animation (extract from existing `share-generating-state`)
- Status text: `.generating-state__status` — fade transition between stages
- Version banner: `.output-version-banner` — compact inline banner above output

**Skeleton variants (composition):**

- Share: shimmer bars per variant slot (existing pattern)
- Prompt: shimmer blocks for prompt fields (image prompt, text prompt, VO)
- Intake: shimmer card for metadata fields (nama, kategori, deskripsi)

---

## Files Changed

### New files:
- `src/components/operator/generating-state.tsx` — generic loading component

### Modified files:
- `src/app/share/[platform]/share-detail-panel.tsx` — add Tab Generate, remove `?mode=input` logic
- `src/app/share/[platform]/share-history-tab.tsx` — remove Regenerate button, add "Lihat" button
- `src/app/share/[platform]/share-generating-state.tsx` — refactor as wrapper over `<GeneratingState>`
- `src/app/prompts/prompt-detail-panel.tsx` — restructure to 3 tabs
- `src/app/prompts/[id]/history/page.tsx` — use read-only variant in drawer
- `src/app/products/new/intake-workflow-form.tsx` — replace static skeleton with `<GeneratingState>`
- `src/lib/share/share-list-contract.ts` — update `normalizeShareTab` to accept "generate"
- `src/styles/05-features/generating-state.css` — extract shimmer animation CSS

---

## Verification

1. `npm run typecheck` — no type errors
2. `npm run lint` — no new lint errors
3. `npm run build` — clean build
4. Manual test per surface:
   - Share: generate caption → verify polling + progress text → verify output → verify history "Lihat" → verify old version banner
   - Prompt: generate prompt → verify polling + progress text → verify output → verify history "Lihat" → verify old version banner
   - Intake: submit metadata → verify skeleton + progress text (no polling)
5. Responsive test: 360px, 768px, 1024px, 1280px — tab nav stretch, scroll behavior

---

## Out of Scope

- Thread mode multi-tweet for X (separate feature)
- Pinterest keyword input field (separate feature)
- Full page `/prompts/[id]/history` removal (kept as route, access via tab)
- Prompt history archive/delete actions (existing functionality preserved)
- Share history archive/delete actions (existing functionality preserved)
