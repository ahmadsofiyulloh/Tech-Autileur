# Controller UI Polish — Codex CLI Micro-Task Pack

> Run each task independently in order. Each task is self-contained with a
> specific scope, acceptance criteria, and the exact files to touch.
> After each task, run `pnpm build` and `pnpm lint` and fix any errors before
> moving to the next task.

---

## TASK 01 — Establish a visual weight system for StatusBadge

**Problem**: `StatusBadge` is used 40+ times on the controller page with equal
visual weight. Status pills for "Lane key set", "3 akun", "Helper belum
diverifikasi", and "RUNNING" all look identical. The user cannot scan the page
and immediately understand priority.

**Files to modify**:
- `src/components/operator/status-badge.tsx`
- `src/app/globals.css` (add new badge variants)

**Task**:

1. Add a `size` prop to `StatusBadge`: `"sm" | "md"` (default `"md"`).
   - `"sm"`: `font-size: var(--type-control-sm-size)`, `padding: 2px 6px`,
     `min-height: 20px`, no dot indicator. Use for metadata counts and secondary
     labels like "3 akun", "Lane key set".
   - `"md"`: current styles (default, no change).

2. Add a `variant` prop: `"pill" | "badge"` (default `"badge"`).
   - `"pill"`: `border-radius: 999px` (already pill-like, stays as-is).
   - `"badge"`: `border-radius: var(--radius)` (square-ish, for status states
     that are more like a tag than a count).

3. Add a `muted` prop (boolean, default `false`). When `true`:
   - Force tone to neutral.
   - Reduce opacity of dot to 0.5.
   - Use for status information that is confirmational (already-done states),
     not actionable.

4. Update `inferTone()` to cover these additional cases explicitly:
   - `"CLOSED"` → `"neutral"` + muted
   - `"READY_TO_EXPORT"` → `"success"`
   - `"EXPORTED"` → `"info"`
   - `"RUNNING"` → `"warning"` (process in flight needs attention)
   - `"IMPORTING"` → `"info"`
   - `"PARTIALLY_IMPORTED"` → `"warning"`
   - `"IMPORTED"` → `"success"`
   - `"NEED_MANUAL_MATCH"` → `"danger"`
   - `"AVAILABLE"` / `"Perkiraan tersedia"` → `"success"`

**Acceptance criteria**:
- `StatusBadge` renders correctly at both sizes in light and dark mode.
- No existing usages break (all new props are optional with backwards-compatible
  defaults).
- `pnpm build` passes.

---

## TASK 02 — Controller stepper rail: replace overflow scroll with a vertical
              progress indicator

**Problem**: `controller-stepper-rail` requires horizontal scrolling on any
viewport below 1148px. The 7-step grid is unusable on 1024–1280px displays
which are the most common desktop viewport widths for this operator tool.

**Files to modify**:
- `src/app/controller/page.tsx` (`ControllerWorkflowRail` component)
- `src/app/globals.css` (`.controller-stepper-rail` and related classes)

**Task**:

Replace the horizontal scrolling rail with a vertical sidebar progress
indicator. The rail should:

1. Render as a vertical `<ol>` with items stacked top-to-bottom.
2. Each item shows:
   - A circular step number indicator (28×28px, `border-radius: 999px`)
     with a connecting vertical line between steps (1px, `var(--color-border-standard)`)
   - Step title (`font-size: var(--type-control-size)`, `font-weight: var(--type-control-strong-weight)`)
   - Step summary (`font-size: var(--type-control-sm-size)`, `color: var(--color-text-secondary)`)
   - Status badge (size `"sm"`)
3. Active step:
   - Circle uses `background: var(--color-primary)`, `color: white`
   - Title uses `color: var(--color-text-primary)` (strong)
   - Left border accent: `2px solid var(--color-primary)` on the item row
4. Steps with `count === 0`:
   - Circle uses `background: var(--color-surface-muted-soft)`,
     `color: var(--color-text-secondary)`
   - Title uses `color: var(--color-text-secondary)`
5. The rail sits in the left column of a 2-column CSS grid:
   `grid-template-columns: 200px minmax(0, 1fr)` for the
   `.controller-stepper-shell`.
6. The rail is `position: sticky; top: var(--space-3)` so it stays visible
   while the user scrolls through step sections.
7. Remove the `overflow-x: auto` and the `minmax(164px, 1fr)` horizontal grid.

**CSS to add**:
```css
.controller-stepper-shell {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  align-items: start;
  gap: var(--space-4);
}

.controller-stepper-rail {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
  position: sticky;
  top: var(--space-3);
}

.controller-stepper-rail__item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: var(--space-2);
  align-items: start;
  padding: var(--space-2) var(--space-2);
  border-left: 2px solid transparent;
  transition: border-color 0.15s ease;
}

.controller-stepper-rail__item[data-active="true"] {
  border-left-color: var(--color-primary);
}

.controller-stepper-rail__index {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--color-surface-muted-soft);
  color: var(--color-text-secondary);
  font-size: var(--type-control-sm-size);
  font-weight: var(--type-weight-700);
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

.controller-stepper-rail__item[data-active="true"] .controller-stepper-rail__index {
  background: var(--color-primary);
  color: white;
}
```

**Acceptance criteria**:
- Rail is fully visible on a 1024px-wide viewport without horizontal scroll.
- Active step is visually distinct at a glance.
- Sticky positioning keeps the rail visible while scrolling sections.
- `pnpm build` passes.

---

## TASK 03 — BatchCard: restructure action row and add visual hierarchy

**Problem**: `BatchCard` mixes read-only metadata, import stage rows, manifest
panel, and 3 separate `<form>` action buttons in one flat card. There is no
visual separation between "status I'm reading" and "actions I can take". The
"Tutup" button has no icon and different semantic weight than the other two
actions.

**Files to modify**:
- `src/app/controller/page.tsx` (`BatchCard` component, `StageImportRows`)
- `src/app/globals.css`

**Task**:

1. Split `BatchCard` into two visual zones:
   - **Info zone** (top): `batch_code`, account label, clip count, lane key,
     `updated_at`, and status badge. Use a `grid` with
     `grid-template-columns: minmax(0, 1fr) auto`.
   - **Stage zone** (middle): `StageImportRows` stays as-is but add a
     `border-top: 1px solid var(--color-border-standard)` separator above it
     and `padding-top: var(--space-2)`.
   - **Action zone** (bottom): All action buttons in a single row separated by
     `border-top: 1px solid var(--color-border-standard)` and
     `padding-top: var(--space-2)`.

2. In the action zone:
   - "Mulai Flow" and "Tandai Masuk" are primary actions → keep `compact primary`
     and `compact tertiary` classes.
   - "Tutup" is a destructive/closing action → change to `compact` with
     `color: var(--color-text-secondary)` and add `X` icon (import `X` from
     `lucide-react`). Do NOT use `destructive` class — closing a batch is
     routine.
   - Wrap all three forms in a single `div.controller-action-row` so they
     render in one visual row.

3. Add these CSS classes:
```css
.controller-batch-info-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-1);
}

.controller-card-section {
  border-top: 1px solid var(--color-border-standard);
  padding-top: var(--space-2);
  margin-top: var(--space-1);
}
```

4. In `StageImportRows`: change the `controller-stage-row` background to
   `transparent` (remove `var(--color-surface-base)` background) so it reads
   as part of the card, not a nested card inside a card.

**Acceptance criteria**:
- Visual zones are clearly separated.
- Action row has all 3 actions in one visual line.
- "Tutup" has an X icon.
- No nested card-within-card appearance in stage rows.

---

## TASK 04 — FlowAccountSupportPanel: responsive form layout fix

**Problem**: The lane key edit form inside `FlowAccountSupportPanel` uses a
`controller-account-lane-form` grid with `grid-template-columns: minmax(0, 1fr) auto`
which works at wide viewports but breaks at 860–1100px where the controller
renders in a single column with less horizontal space.

**Files to modify**:
- `src/app/globals.css`

**Task**:

1. Change `.controller-account-lane-form` to stack vertically by default and
   only go horizontal at wide viewports:

```css
.controller-account-lane-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}

@media (min-width: 1024px) {
  .controller-account-lane-form {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
  }
}
```

2. The "Tambah akun" form at the bottom of the panel currently stacks a hidden
   input, label, and button as a block. Wrap it in:

```css
.controller-add-account-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--space-2);
  border-top: 1px solid var(--color-border-standard);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
}
```

   Add `className="controller-add-account-form"` to the create-account
   `<form>` in `FlowAccountSupportPanel`.

3. Hide the `HiddenInput` elements inside that form visually (they're already
   `type="hidden"`, this is defensive):
```css
.controller-add-account-form input[type="hidden"] {
  display: none;
}
```

**Acceptance criteria**:
- At 900px viewport width the lane key form does not overflow its container.
- The "Tambah akun" form is visually separated from the account list.
- `pnpm build` passes.

---

## TASK 05 — ControllerPage loading skeleton: match actual page structure

**Problem**: `src/app/controller/loading.tsx` shows only two skeleton lines.
The actual controller page renders a 7-step rail, a summary strip, and multiple
section cards. The loading → loaded transition is a jarring full-page flash.

**Files to modify**:
- `src/app/controller/loading.tsx`
- `src/components/operator/loading-skeleton.tsx` (add new skeleton components)

**Task**:

1. Add `SkeletonControllerRail` to `loading-skeleton.tsx`:
```tsx
export function SkeletonControllerRail() {
  return (
    <div className="controller-stepper-rail loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, index) => (
        <div className="controller-stepper-rail__item" key={index}>
          <span className="controller-stepper-rail__index skeleton-icon skeleton-icon--small" />
          <span className="controller-stepper-rail__copy">
            <SkeletonLine size="medium" />
            <SkeletonLine size="short" />
          </span>
        </div>
      ))}
    </div>
  );
}
```

2. Add `SkeletonControllerSummaryStrip` to `loading-skeleton.tsx`:
```tsx
export function SkeletonControllerSummaryStrip() {
  return (
    <div className="settings-inline-summary controller-stepper-summary-strip loading-skeleton-static" aria-hidden="true">
      <div className="controller-stepper-summary-strip__workspace stack-tight">
        <SkeletonLine size="short" />
        <SkeletonLine size="medium" />
        <SkeletonLine size="short" />
      </div>
      <div className="controller-stepper-summary-strip__focus stack-tight">
        <SkeletonLine size="short" />
        <SkeletonLine size="long" />
        <SkeletonLine size="medium" />
      </div>
      <div className="controller-stepper-summary-strip__badges" style={{ gap: "var(--space-1)" }}>
        <span className="skeleton-pill" />
        <span className="skeleton-pill" />
      </div>
    </div>
  );
}
```

3. Add `SkeletonControllerCard` to `loading-skeleton.tsx`:
```tsx
export function SkeletonControllerCard() {
  return (
    <div className="controller-lane-card loading-skeleton-static" aria-hidden="true">
      <div className="controller-batch-info-grid">
        <span className="stack-tight">
          <SkeletonLine size="medium" />
          <SkeletonLine size="short" />
        </span>
        <span className="skeleton-pill" />
      </div>
      <div className="controller-card-section">
        {Array.from({ length: 3 }).map((_, i) => (
          <div className="controller-stage-row" key={i}>
            <SkeletonLine size="medium" />
            <span className="skeleton-pill" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

4. Update `src/app/controller/loading.tsx`:
```tsx
import {
  SkeletonControllerRail,
  SkeletonControllerSummaryStrip,
  SkeletonControllerCard,
} from "@/components/operator/loading-skeleton";

export default function ControllerLoading() {
  return (
    <div className="stack controller-desktop-content" aria-busy="true">
      <SkeletonControllerSummaryStrip />
      <div className="controller-stepper-shell">
        <SkeletonControllerRail />
        <div className="controller-stepper-sections stack">
          {Array.from({ length: 3 }).map((_, i) => (
            <section key={i} className="section-card panel stack">
              <div className="section-card__header loading-skeleton-static" aria-hidden="true">
                <SkeletonLine size="medium" />
                <span className="skeleton-pill" />
              </div>
              <SkeletonControllerCard />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Acceptance criteria**:
- Loading state matches the visual structure of the loaded page (rail on left,
  sections on right, summary strip at top).
- No layout shift when data loads.
- `pnpm build` passes.

---

## TASK 06 — Controller summary strip: typographic hierarchy fix

**Problem**: `.controller-stepper-summary-strip` uses `var(--type-overline-size)`
(10px) for the eyebrow labels and `var(--type-card-size)` (16px) for the
values, but the workspace code and active step summary both render at
`var(--type-control-sm-size)` (11px) with no visual distinction. Three columns
of text at similar sizes create visual noise without a clear reading order.

**Files to modify**:
- `src/app/globals.css` (`.controller-stepper-summary-strip` block)

**Task**:

Tighten the type scale for the summary strip:

```css
.controller-stepper-summary-strip {
  /* existing layout styles stay */
}

.controller-stepper-summary-strip__workspace span:first-child,
.controller-stepper-summary-strip__focus span:first-child {
  color: var(--color-text-secondary);
  font-size: var(--type-overline-size);        /* 10px */
  font-weight: var(--type-overline-weight);    /* 700 */
  letter-spacing: var(--type-letter-0075);
  line-height: var(--type-overline-line);
  text-transform: uppercase;
  display: block;
}

.controller-stepper-summary-strip__workspace strong,
.controller-stepper-summary-strip__focus strong {
  color: var(--color-text-primary);
  font-size: var(--type-card-size);            /* 16px */
  font-weight: var(--type-card-weight);        /* 680 */
  line-height: var(--type-card-line);
  overflow-wrap: anywhere;
  display: block;
  margin-top: 1px;
}

.controller-stepper-summary-strip__workspace span:last-child,
.controller-stepper-summary-strip__focus span:last-child {
  color: var(--color-text-secondary);
  font-size: var(--type-control-sm-size);      /* 11px */
  line-height: var(--type-control-sm-line);
  overflow-wrap: anywhere;
  display: block;
  margin-top: 2px;
}

.controller-stepper-summary-strip__badges {
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
  justify-content: flex-end;
  display: flex;
  min-width: 0;
  align-self: center;
}
```

Also remove the duplicate `.controller-stepper-summary-strip__workspace` and
`.controller-stepper-summary-strip__focus` and `.controller-stepper-summary-strip__badges`
blocks that currently exist in globals.css and consolidate into one block.

**Acceptance criteria**:
- Clear visual reading order: eyebrow (10px uppercase) → value (16px) → subtitle (11px).
- No duplicate CSS selectors for these classes.
- Light and dark mode both readable.

---

## TASK 07 — BatchSelectionCard: add selection state feedback

**Problem**: `BatchSelectionCard` uses a native `<input type="checkbox">` with
label text "Pilih batch" but the entire card does not respond visually to the
checked state. When 5 cards are selected and 2 are skipped, the user cannot
scan and confirm their selection without reading every checkbox.

**Files to modify**:
- `src/app/globals.css`

**Task**:

Add CSS-only checked state styling for `.controller-batch-selection-card`:

```css
/* Card turns softly selected when its checkbox is checked */
.controller-batch-selection-card:has(input[type="checkbox"]:checked) {
  border-color: color-mix(in srgb, var(--color-primary) 32%, var(--color-border-standard));
  background: color-mix(in srgb, var(--color-primary-soft) 52%, var(--color-surface-base));
}

/* The checkbox label row gets primary color treatment when checked */
.controller-batch-selection-card:has(input[type="checkbox"]:checked)
.controller-batch-selection-card__picker {
  color: var(--color-primary);
}

/* Skipped cards get a clear visual treatment */
.controller-batch-selection-card--skipped {
  border-style: dashed;
  opacity: 0.72;
}
```

Also: in `BatchSelectionCard`, change the `defaultChecked` prop handling so
that the checkbox label text updates based on state. Replace the static
`"Pilih batch"` label with a `<label>` that has proper `for`/`id` pairing:

In `page.tsx`:
```tsx
<label className="checkbox-row controller-batch-selection-card__picker">
  <input
    defaultChecked={defaultChecked}
    id={`batch-select-${promptPack.id}`}
    name="prompt_pack_ids"
    type="checkbox"
    value={promptPack.id}
  />
  <span>Pilih batch ini</span>
</label>
```

**Acceptance criteria**:
- Selected cards are visually distinct from unselected cards without
  JavaScript.
- Skipped cards are visually de-emphasized.
- `pnpm build` passes.

---

## TASK 08 — ExportManifestPanel: make it an inline expandable, not a `<details>`

**Problem**: `ExportManifestPanel` renders as a CSS `<details>` element with a
`<summary>`. Inside it is a full form with 5 inputs and 3 buttons. The
`<details>` element has a browser-default `summary::marker` triangle which
clashes with the custom `StatusBadge` row inside `<summary>`. The panel also
renders at `flex: 100%; width: 100%` which breaks the card's internal grid.

**Files to modify**:
- `src/app/controller/page.tsx` (`ExportManifestPanel` component)
- `src/app/globals.css`

**Task**:

1. Keep the `<details>/<summary>` structure (it's accessible) but apply
   `list-style: none` and `::marker { display: none }` to remove the
   browser triangle:

```css
.controller-manifest-panel summary {
  list-style: none;
}
.controller-manifest-panel summary::-webkit-details-marker {
  display: none;
}
.controller-manifest-panel summary::marker {
  display: none;
}
```

2. Add a chevron icon to the `<summary>` in `ExportManifestPanel`. Import
   `ChevronDown` from `lucide-react` and add it to the right of the badge row:

```tsx
<summary>
  <span>Manifest</span>
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
    <StatusBadge status={batch.manifest_json ? "Tersedia" : "Belum"} tone={batch.manifest_json ? "success" : "warning"} />
    <StatusBadge status={chromeProfileLaneKey ? "Lane key set" : "Not paired"} tone={chromeProfileLaneKey ? "success" : "warning"} />
    <ChevronDown size={15} aria-hidden="true" style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
  </div>
</summary>
```

3. Add a CSS transition so the panel open/close feels smooth. Since `<details>`
   content-height animation requires JS in most browsers, just add an
   `opacity` transition:

```css
.controller-manifest-panel[open] .controller-manifest-panel__body {
  animation: manifest-fade-in 0.15s ease;
}

@keyframes manifest-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Acceptance criteria**:
- No browser-default triangle visible in any browser.
- Chevron icon is present and rotates on open (add CSS rotation if desired).
- Open/close feels intentional, not instant.
- `pnpm build` passes.

---

## TASK 09 — Reduce padding compression on mobile controller redirect

**Problem**: `ControllerMobileRedirect` redirects mobile users to
`/products/new`. The `.mobile-desktop-required` class has `min-height: 52vh`
but `ControllerPage` returns `ControllerMobileRedirect` directly (client-side
only) while also rendering the desktop content server-side. On slow connections
the desktop content flashes before the redirect fires.

**Files to modify**:
- `src/app/controller/page.tsx`
- `src/app/controller/controller-mobile-redirect.tsx`

**Task**:

1. In `ControllerPage`, before rendering the full desktop content, add a static
   mobile placeholder that is shown via CSS (not JS) on viewports ≤860px:

```tsx
{/* Mobile fallback — hidden on desktop via CSS, visible on mobile before JS runs */}
<div className="mobile-desktop-required" aria-hidden="true">
  <h2>Flow Control</h2>
  <p>Buka di desktop untuk menggunakan Flow Control.</p>
</div>
```

   This element already has CSS: `@media (max-width:860px) { .mobile-desktop-required { display: grid; } }` and
   `@media (min-width:861px) { .mobile-desktop-required { display: none; } }`.
   Place it BEFORE the desktop content div, so on mobile the user sees the
   placeholder immediately without waiting for JS.

2. In `controller-mobile-redirect.tsx`, add a check for the server-rendered
   user-agent redirect that already happens in `ControllerPage`. Only fire
   the client-side redirect if `window.location.pathname === '/controller'`
   (already there) AND `document.body.classList.contains('some-flag')` is NOT
   needed — the existing check is fine. No logic change needed.

3. Add a clear message to the mobile placeholder instead of the blank screen:

```tsx
<div className="mobile-desktop-required">
  <h2>Flow Control memerlukan desktop</h2>
  <p>Buka halaman ini di browser desktop (lebar ≥ 860px) untuk menggunakan Flow Control.</p>
</div>
```

**Acceptance criteria**:
- On a real mobile device, user sees the placeholder message immediately,
  then gets redirected.
- No blank screen or flash of desktop content on mobile.
- `pnpm build` passes.

---

## TASK 10 — Polish: consistent icon usage in controller action buttons

**Problem**: Action buttons in the controller page have inconsistent icon usage.
"Tutup" has no icon. "Mulai Flow" uses `MonitorPlay`. "Tandai Masuk" uses
`RefreshCcw` (which implies retry/reload, not "mark as imported").
"Siapkan Flow" uses `ArrowRight` (generic). "Ekspor Manifest" uses `FileJson`
(correct). "Buat batch terpilih" uses `ArrowRight` (generic).

**Files to modify**:
- `src/app/controller/page.tsx`

**Task**:

Update icon imports and usage:

1. Change `RefreshCcw` on "Tandai Masuk" → `Download` (importing = receiving).
2. Add `X` icon to "Tutup" button (already imported via lucide in scope).
3. Change `ArrowRight` on "Siapkan Flow" (`GeneratedPromptCard`) → `Zap`
   (ready to run).
4. Change `ArrowRight` on "Buat batch terpilih" → `ListPlus` (creating
   multiple items).
5. Keep all other icons as-is.

Icon import line to update:
```tsx
import {
  Download,
  ExternalLink,
  FileJson,
  ListPlus,
  MonitorPlay,
  Plus,
  Save,
  Workflow,
  X,
  Zap,
} from "lucide-react";
```

Then update JSX accordingly:
- `GeneratedPromptCard`: `<Zap size={15} />` instead of `<ArrowRight>`
- Batch selection submit button: `<ListPlus size={15} />` instead of `<ArrowRight>`
- "Tandai Masuk": `<Download size={15} />` instead of `<RefreshCcw>`
- "Tutup": `<X size={15} />` (add icon)

**Acceptance criteria**:
- Every action button has an icon.
- Icon meanings are semantically consistent with the action.
- No unused imports remain.
- `pnpm build` passes.

---

## Final verification checklist

After all 10 tasks:

- [ ] `pnpm build` succeeds with 0 errors
- [ ] `pnpm lint` reports 0 errors (warnings OK)
- [ ] Controller page renders correctly at 1024px, 1280px, 1440px viewport widths
- [ ] Controller loading state matches the loaded page structure
- [ ] Light mode and dark mode both look correct (test with `data-theme="dark"` on `<html>`)
- [ ] All action buttons have icons
- [ ] No horizontal scroll on the controller stepper rail
- [ ] StatusBadge size prop works correctly in all existing usages
- [ ] No TypeScript errors (`pnpm tsc --noEmit`)
