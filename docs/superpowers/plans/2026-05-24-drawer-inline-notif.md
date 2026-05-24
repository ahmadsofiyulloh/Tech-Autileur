# Drawer Inline Notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a shared `<InlineNotif>` component with auto-dismiss behavior and migrate 8 existing inline notification instances across 6 drawer files to use it, positioned at the bottom of each drawer body.

**Architecture:** Single reusable client component with timer-based auto-dismiss (5s success, 6s info, 8s warning, persistent error). Parent drawers manage single notif state — errors dismiss when replaced by a success notif. CSS uses existing semantic color tokens.

**Tech Stack:** React 19, TypeScript strict, CSS custom properties (existing token layer), lucide-react icons

**Spec:** `docs/superpowers/specs/2026-05-24-drawer-inline-notif-audit-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/operator/inline-notif.tsx` | Shared InlineNotif component |
| Create | `src/styles/05-features/inline-notif.css` | Styling with token-driven colors + animations |
| Modify | `src/app/globals.css` | Add CSS import |
| Modify | `src/app/prompts/prompt-detail-panel.tsx` | Migrate error-box + helper-text to bottom |
| Modify | `src/app/prompts/prompt-queue-drawer.tsx` | Migrate prompt-queue-error to bottom |
| Modify | `src/app/products/new/bulk-import-panel.tsx` | Migrate error-box to bottom |
| Modify | `src/app/settings/affiliate-profiles/affiliate-profiles-board.tsx` | Migrate settings-action-feedback (desktop + mobile) to bottom |
| Modify | `src/app/products/new/intake-workflow-form.tsx` | Migrate error-box to bottom |
| Modify | `src/app/products/product-detail-panel.tsx` | Migrate helper-text to bottom |

---

## Task 1: Create CSS file

**Files:**
- Create: `src/styles/05-features/inline-notif.css`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create the CSS file**

```css
/* src/styles/05-features/inline-notif.css */

.inline-notif {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  border: 1px solid var(--inline-notif-border);
  background: var(--inline-notif-background);
  color: var(--inline-notif-tone);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-snug);
  margin-block-start: var(--space-3);
}

.inline-notif__icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--space-4);
  block-size: var(--space-4);
  color: var(--inline-notif-icon-tone, var(--inline-notif-tone));
}

.inline-notif__message {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.inline-notif--success {
  --inline-notif-tone: var(--color-status-success);
  --inline-notif-background: var(--color-status-success-soft);
  --inline-notif-border: var(--color-status-success-border);
}

.inline-notif--info {
  --inline-notif-tone: var(--color-primary);
  --inline-notif-background: var(--color-status-info-soft);
  --inline-notif-border: color-mix(in srgb, var(--color-primary) 22%, var(--color-border-standard));
  --inline-notif-icon-tone: var(--color-status-info);
}

.inline-notif--warning {
  --inline-notif-tone: var(--color-text-on-warm);
  --inline-notif-background: var(--color-status-warning-soft);
  --inline-notif-border: color-mix(in srgb, var(--color-status-warning) 42%, var(--color-border-standard));
  --inline-notif-icon-tone: var(--color-status-warning);
}

.inline-notif--error {
  --inline-notif-tone: var(--color-status-error);
  --inline-notif-background: var(--color-status-error-soft);
  --inline-notif-border: var(--color-status-error-border);
}

.inline-notif {
  animation: inline-notif-enter 200ms ease-out;
}

.inline-notif[data-dismissing="true"] {
  animation: inline-notif-exit 300ms ease-in forwards;
}

@keyframes inline-notif-enter {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes inline-notif-exit {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-2px); }
}

@media (prefers-reduced-motion: reduce) {
  .inline-notif,
  .inline-notif[data-dismissing="true"] {
    animation: none;
  }
}
```

- [ ] **Step 2: Add CSS import to globals.css**

Add after the last `05-features` import line in `src/app/globals.css`:

```css
@import "../styles/05-features/inline-notif.css";
```

- [ ] **Step 3: Verify build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS (CSS-only, no TS changes yet)

- [ ] **Step 4: Commit**

```bash
git add src/styles/05-features/inline-notif.css src/app/globals.css
git commit -m "feat(ui): add inline-notif CSS with token-driven colors and animations"
```

---

## Task 2: Create InlineNotif component

**Files:**
- Create: `src/components/operator/inline-notif.tsx`

- [ ] **Step 1: Create the component file**

```tsx
// src/components/operator/inline-notif.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, AlertTriangle, CircleAlert } from "lucide-react";

export type InlineNotifType = "success" | "info" | "warning" | "error";

type InlineNotifProps = {
  type: InlineNotifType;
  message: string | ReactNode;
  notifKey?: string | number;
  onDismissed?: () => void;
};

const DISMISS_DURATIONS: Record<InlineNotifType, number | null> = {
  success: 5000,
  info: 6000,
  warning: 8000,
  error: null,
};

const ICONS: Record<InlineNotifType, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: CircleAlert,
};

const EXIT_ANIMATION_MS = 300;

export function InlineNotif({ type, message, notifKey, onDismissed }: InlineNotifProps) {
  const [dismissing, setDismissing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDismissing(false);

    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);

    const duration = DISMISS_DURATIONS[type];
    if (!duration) return;

    timerRef.current = setTimeout(() => {
      setDismissing(true);
      exitTimerRef.current = setTimeout(() => {
        onDismissed?.();
      }, EXIT_ANIMATION_MS);
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [notifKey, type, onDismissed]);

  const Icon = ICONS[type];
  const isAssertive = type === "error" || type === "warning";

  return (
    <div
      className={`inline-notif inline-notif--${type}`}
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? "assertive" : "polite"}
      aria-atomic="true"
      data-dismissing={dismissing ? "true" : undefined}
    >
      <span className="inline-notif__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="inline-notif__message">{message}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/operator/inline-notif.tsx
git commit -m "feat(ui): add InlineNotif shared component with auto-dismiss"
```

---

## Task 3: Migrate prompt-detail-panel.tsx

**Files:**
- Modify: `src/app/prompts/prompt-detail-panel.tsx:249-255` (remove old notifs)
- Modify: `src/app/prompts/prompt-detail-panel.tsx` (add InlineNotif at bottom of panel)

- [ ] **Step 1: Add import**

At the top of `src/app/prompts/prompt-detail-panel.tsx`, add:

```tsx
import { InlineNotif } from "@/components/operator/inline-notif";
```

- [ ] **Step 2: Remove old inline notifs from top of panel**

Remove lines 249-255 (the `error-box` section and `helper-text` section that sit above the tab nav):

```tsx
// REMOVE THIS:
{promptErrorMessage ? <section className="error-box">{promptErrorMessage}</section> : null}

{isWaitingForKey ? (
  <section className="helper-text" role="status">
    Semua Gemini key sedang cooldown atau melebihi kuota. Sistem otomatis mencoba ulang setiap 15 detik untuk mencari key yang eligible.
  </section>
) : null}
```

- [ ] **Step 3: Add InlineNotif at the bottom of the panel**

Place at the very end of the panel `<div>`, after all tab content sections, before the closing `</div>`:

```tsx
{promptErrorMessage ? (
  <InlineNotif
    type="error"
    message={promptErrorMessage}
    notifKey={promptErrorMessage}
  />
) : isWaitingForKey ? (
  <InlineNotif
    type="info"
    message="Semua Gemini key sedang cooldown atau melebihi kuota. Sistem otomatis mencoba ulang setiap 15 detik untuk mencari key yang eligible."
    notifKey="waiting-for-key"
  />
) : null}
```

- [ ] **Step 4: Verify build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/prompts/prompt-detail-panel.tsx
git commit -m "refactor(prompts): migrate inline notifs to InlineNotif at bottom of panel"
```

---

## Task 4: Migrate prompt-queue-drawer.tsx

**Files:**
- Modify: `src/app/prompts/prompt-queue-drawer.tsx:345-350` (remove old error)
- Modify: `src/app/prompts/prompt-queue-drawer.tsx` (add InlineNotif at bottom)

- [ ] **Step 1: Add import**

```tsx
import { InlineNotif } from "@/components/operator/inline-notif";
```

- [ ] **Step 2: Remove old error div**

Remove lines 345-350:

```tsx
// REMOVE THIS:
{errorMessage ? (
  <div className="prompt-queue-error">
    <AlertTriangle size={15} aria-hidden="true" />
    <span>{errorMessage}</span>
  </div>
) : null}
```

- [ ] **Step 3: Add InlineNotif at the bottom of the drawer**

Place at the very end of the drawer container `<div>`, after the queue sections (after the `<>...</>` fragment or the muted-box), before the closing `</div>`:

```tsx
{errorMessage ? (
  <InlineNotif
    type="error"
    message={errorMessage}
    notifKey={errorMessage}
  />
) : null}
```

- [ ] **Step 4: Remove unused AlertTriangle import if no longer used elsewhere in the file**

Check if `AlertTriangle` is still used in the file (it is — in `prompt-queue-row__issue`). If still used, keep the import.

- [ ] **Step 5: Verify build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/prompts/prompt-queue-drawer.tsx
git commit -m "refactor(prompts): migrate queue error to InlineNotif at bottom of drawer"
```

---

## Task 5: Migrate bulk-import-panel.tsx

**Files:**
- Modify: `src/app/products/new/bulk-import-panel.tsx:1035-1040` (remove old error-box)
- Modify: `src/app/products/new/bulk-import-panel.tsx` (add InlineNotif at bottom)

- [ ] **Step 1: Add import**

```tsx
import { InlineNotif } from "@/components/operator/inline-notif";
```

- [ ] **Step 2: Remove old error-box**

Remove lines 1035-1040:

```tsx
// REMOVE THIS:
{error && !importProgress ? (
  <section className="error-box" aria-live="polite">
    <AlertTriangle size={16} aria-hidden="true" />
    {error}
  </section>
) : null}
```

- [ ] **Step 3: Add InlineNotif at the very bottom of the panel**

Place after all content (after the result section, after the table, at the end of the panel container), before the closing tag:

```tsx
{error && !importProgress ? (
  <InlineNotif
    type="error"
    message={error}
    notifKey={error}
  />
) : null}
```

- [ ] **Step 4: Check if AlertTriangle import is still needed**

`AlertTriangle` is likely still used in `BulkImportProgressPanel` or other sub-components. If still used, keep the import. If not, remove it.

- [ ] **Step 5: Verify build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/products/new/bulk-import-panel.tsx
git commit -m "refactor(bulk-import): migrate error-box to InlineNotif at bottom of panel"
```

---

## Task 6: Migrate affiliate-profiles-board.tsx (desktop + mobile)

**Files:**
- Modify: `src/app/settings/affiliate-profiles/affiliate-profiles-board.tsx:415-420` (remove desktop feedback)
- Modify: `src/app/settings/affiliate-profiles/affiliate-profiles-board.tsx:554-559` (remove mobile feedback)
- Modify: `src/app/settings/affiliate-profiles/affiliate-profiles-board.tsx` (add InlineNotif at bottom of both)

- [ ] **Step 1: Add import**

```tsx
import { InlineNotif, type InlineNotifType } from "@/components/operator/inline-notif";
```

- [ ] **Step 2: Add tone-to-type mapping helper**

The existing `routeFeedback` uses `tone` (which can be "success", "warning", "error", "info"). Map directly since the values match `InlineNotifType`:

```tsx
const feedbackNotifType: InlineNotifType = routeFeedback?.tone === "error" ? "error"
  : routeFeedback?.tone === "warning" ? "warning"
  : routeFeedback?.tone === "info" ? "info"
  : "success";
```

- [ ] **Step 3: Remove desktop feedback (line ~415-420)**

Remove:

```tsx
// REMOVE THIS:
{!drawerOpen && routeFeedback ? (
  <div className="settings-action-feedback" data-tone={routeFeedback.tone} role={routeFeedback.tone === "error" ? "alert" : "status"} aria-live={routeFeedback.tone === "error" ? "assertive" : "polite"}>
    <strong>{routeFeedback.title}</strong>
    <span className="subtle">{routeFeedback.message}</span>
  </div>
) : null}
```

- [ ] **Step 4: Add InlineNotif at bottom of desktop panel**

Place after the `</table>` closing tag and the table-wrap div, at the very bottom of the desktop section:

```tsx
{!drawerOpen && routeFeedback ? (
  <InlineNotif
    type={feedbackNotifType}
    message={<><strong>{routeFeedback.title}</strong> {routeFeedback.message}</>}
    notifKey={`${routeFeedback.tone}-${routeFeedback.title}`}
  />
) : null}
```

- [ ] **Step 5: Remove mobile drawer feedback (line ~554-559)**

Remove the mobile `settings-action-feedback` div.

- [ ] **Step 6: Add InlineNotif at bottom of mobile drawer body**

Place at the very end of the mobile drawer body, before the closing container:

```tsx
{routeFeedback ? (
  <InlineNotif
    type={feedbackNotifType}
    message={<><strong>{routeFeedback.title}</strong> {routeFeedback.message}</>}
    notifKey={`${routeFeedback.tone}-${routeFeedback.title}`}
  />
) : null}
```

- [ ] **Step 7: Verify build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/settings/affiliate-profiles/affiliate-profiles-board.tsx
git commit -m "refactor(settings): migrate action feedback to InlineNotif at bottom of panel"
```

---

## Task 7: Migrate intake-workflow-form.tsx

**Files:**
- Modify: `src/app/products/new/intake-workflow-form.tsx:284-288` (remove old error-box)
- Modify: `src/app/products/new/intake-workflow-form.tsx` (add InlineNotif at bottom)

- [ ] **Step 1: Add import**

```tsx
import { InlineNotif } from "@/components/operator/inline-notif";
```

- [ ] **Step 2: Remove old error-box**

Remove lines 284-288:

```tsx
// REMOVE THIS:
{savedSession.error_message ? (
  <section className="error-box" aria-live="polite">
    {savedSession.error_message}
  </section>
) : null}
```

- [ ] **Step 3: Add InlineNotif at the bottom of the error state section**

Place at the very end of the `<section>` that wraps the error state (before the closing `</section>` at line 289):

```tsx
{savedSession.error_message ? (
  <InlineNotif
    type="error"
    message={savedSession.error_message}
    notifKey={savedSession.error_message}
  />
) : null}
```

- [ ] **Step 4: Verify build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/products/new/intake-workflow-form.tsx
git commit -m "refactor(intake): migrate error-box to InlineNotif at bottom of form"
```

---

## Task 8: Migrate product-detail-panel.tsx

**Files:**
- Modify: `src/app/products/product-detail-panel.tsx:550-552` (remove old helper-text)
- Modify: `src/app/products/product-detail-panel.tsx` (add InlineNotif at bottom of History tab)

- [ ] **Step 1: Add import**

```tsx
import { InlineNotif } from "@/components/operator/inline-notif";
```

- [ ] **Step 2: Remove old helper-text**

Remove lines 550-552:

```tsx
// REMOVE THIS:
{latestPromptPack.status === "QUEUED" || latestPromptPack.status === "GENERATING" ? (
  <p className="helper-text">Prompt sedang diproses. Tunggu hingga selesai.</p>
) : null}
```

- [ ] **Step 3: Add InlineNotif at the bottom of the History tab content**

Place at the very end of the History tab section, after the "Versi Paket Prompt" SectionCard, before the closing container:

```tsx
{latestPromptPack.status === "QUEUED" || latestPromptPack.status === "GENERATING" ? (
  <InlineNotif
    type="info"
    message="Prompt sedang diproses. Tunggu hingga selesai."
    notifKey={`processing-${latestPromptPack.id}`}
  />
) : null}
```

- [ ] **Step 4: Verify build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/products/product-detail-panel.tsx
git commit -m "refactor(products): migrate helper-text to InlineNotif at bottom of History tab"
```

---

## Task 9: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full audit suite**

```bash
npm run audit:colors && npm run audit:typography && npm run audit:neutral-ui
```

Expected: PASS — no hardcoded colors or typography violations introduced.

- [ ] **Step 2: Run lint + typecheck + build**

```bash
npm run lint && npm run typecheck && npm run build
```

Expected: PASS

- [ ] **Step 3: Visual spot-check**

Open the app and verify these drawers show InlineNotif at the bottom:
- `/prompts/[id]` — trigger error or waiting-for-key state
- `/products/new` — trigger metadata analysis error
- `/products/[id]` — trigger QUEUED/GENERATING state
- `/settings` → Affiliate Profiles — trigger route feedback

Confirm: no notif appears above tabs, all notifs appear at bottom of drawer body.
