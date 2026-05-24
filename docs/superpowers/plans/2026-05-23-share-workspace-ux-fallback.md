# Share Workspace UX Fallback Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live loading feedback (pulse + shimmer), context-aware error states, and timeout handling to the Share workspace caption generation flow.

**Architecture:** Client component `ShareGeneratingState` polls `GET /api/share/generation-status?id={generationId}` every 3s. On terminal status, swap to `ShareOutputTab` (generated) or `ShareErrorState` (error). After 90s without change, show `ShareTimeoutState`. All animations use CSS design tokens.

**Tech Stack:** Next.js App Router, React client components, Supabase RLS, CSS keyframe animations, TypeScript strict.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/app/api/share/generation-status/route.ts` | Polling endpoint — returns `{ status, error_message, output_json }` |
| `src/app/share/_components/share-generating-state.tsx` | Loading UI: pulse dot + shimmer + polling hook + status text progression |
| `src/app/share/_components/share-error-state.tsx` | Error UI: context-aware message + dual action buttons |
| `src/app/share/_components/share-timeout-state.tsx` | Timeout UI: refresh + back-to-form actions |

### Modified Files

| File | Change |
|------|--------|
| `src/app/share/[platform]/share-output-tab.tsx` | Route to state components based on generation status |
| `src/styles/05-features/share-workspace.css` | Add shimmer keyframes, pulse-dot, fade transitions, generating state layout |

---

## Task 1: Polling API Endpoint

**Files:**
- Create: `src/app/api/share/generation-status/route.ts`

- [ ] **Step 1: Create the polling endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("share_generations")
      .select("status, error_message, output_json")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Generation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: data.status,
      error_message: data.error_message,
      output_json: data.output_json,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify endpoint compiles**

Run: `npx tsc --noEmit src/app/api/share/generation-status/route.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/share/generation-status/route.ts
git commit -m "feat(share): add generation-status polling endpoint"
```

---

## Task 2: CSS Animations

**Files:**
- Modify: `src/styles/05-features/share-workspace.css`

- [ ] **Step 1: Add shimmer and generating state styles**

Append to `src/styles/05-features/share-workspace.css`:

```css
/* ─── Generating State ─── */

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.share-generating-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  animation: fade-in 300ms ease-out;
}

.share-generating-state__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.share-generating-state__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: pulse-dot 1.4s infinite;
}

.share-generating-state__status {
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.share-generating-state__subtitle {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-left: calc(8px + var(--space-2));
}

.share-generating-state__shimmer-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-4);
}

.share-generating-state__shimmer-group + .share-generating-state__shimmer-group {
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-3);
  padding-top: var(--space-4);
}

.share-generating-state__shimmer-bar {
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(
    90deg,
    var(--color-surface-alt) 0%,
    var(--color-border) 50%,
    var(--color-surface-alt) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

.share-generating-state__shimmer-bar:nth-child(1) { width: 75%; animation-delay: 0s; }
.share-generating-state__shimmer-bar:nth-child(2) { width: 90%; animation-delay: 0.3s; }
.share-generating-state__shimmer-bar:nth-child(3) { width: 50%; animation-delay: 0.6s; }

/* ─── Error State ─── */

.share-error-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  animation: fade-in 300ms ease-out;
}

.share-error-state__header {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.share-error-state__message {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-relaxed);
}

.share-error-state__actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.share-error-state__settings-link {
  font-size: var(--text-xs);
  color: var(--color-accent);
  margin-top: var(--space-1);
}

/* ─── Timeout State ─── */

.share-timeout-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  animation: fade-in 300ms ease-out;
}

.share-timeout-state__header {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.share-timeout-state__message {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: var(--leading-relaxed);
}

.share-timeout-state__actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

/* ─── Fade transition for output content ─── */

.share-output-tab--fade-in {
  animation: fade-in 300ms ease-out;
}
```

- [ ] **Step 2: Verify no CSS syntax errors**

Run: `npm run lint`
Expected: No CSS-related errors

- [ ] **Step 3: Commit**

```bash
git add src/styles/05-features/share-workspace.css
git commit -m "feat(share): add shimmer, pulse-dot, and state layout CSS"
```

---

## Task 3: ShareGeneratingState Component

**Files:**
- Create: `src/app/share/_components/share-generating-state.tsx`

- [ ] **Step 1: Create the generating state component with polling**

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShareGenerationRecord } from "@/lib/server/share-generations";

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 90000;

const STATUS_PROGRESSION: { threshold: number; text: string }[] = [
  { threshold: 0, text: "Memproses permintaan..." },
  { threshold: 5000, text: "Menghubungi Gemini..." },
  { threshold: 15000, text: "Generating caption..." },
  { threshold: 30000, text: "Masih memproses, mohon tunggu..." },
  { threshold: 60000, text: "Proses lebih lama dari biasa..." },
];

function getStatusText(elapsedMs: number): string {
  let text = STATUS_PROGRESSION[0].text;
  for (const entry of STATUS_PROGRESSION) {
    if (elapsedMs >= entry.threshold) {
      text = entry.text;
    }
  }
  return text;
}

type ShareGeneratingStateProps = {
  generation: ShareGenerationRecord;
  onGenerated: (updated: ShareGenerationRecord) => void;
  onError: (updated: ShareGenerationRecord) => void;
  onTimeout: () => void;
};

export function ShareGeneratingState({
  generation,
  onGenerated,
  onError,
  onTimeout,
}: ShareGeneratingStateProps) {
  const router = useRouter();
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/share/generation-status?id=${generation.id}`
      );
      if (!res.ok) return;

      const data = await res.json();

      if (data.status === "generated") {
        const updated: ShareGenerationRecord = {
          ...generation,
          status: "generated",
          output_json: data.output_json,
          error_message: null,
        };
        onGenerated(updated);
      } else if (data.status === "error") {
        const updated: ShareGenerationRecord = {
          ...generation,
          status: "error",
          error_message: data.error_message,
          output_json: null,
        };
        onError(updated);
      }
    } catch {
      // Network error — keep polling, don't crash
    }
  }, [generation, onGenerated, onError]);

  useEffect(() => {
    startTimeRef.current = Date.now();

    // Elapsed timer (updates status text)
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setElapsedMs(elapsed);

      if (elapsed >= TIMEOUT_MS) {
        // Stop everything and trigger timeout
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        onTimeout();
      }
    }, 1000);

    // Polling interval
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [poll, onTimeout]);

  const variantCount = generation.variant_count ?? 1;
  const statusText = getStatusText(elapsedMs);

  return (
    <div className="share-generating-state">
      <div className="share-generating-state__header">
        <div className="share-generating-state__dot" aria-hidden="true" />
        <span className="share-generating-state__status">{statusText}</span>
      </div>
      <span className="share-generating-state__subtitle">
        Estimasi 10-30 detik
      </span>

      {Array.from({ length: variantCount }, (_, groupIndex) => (
        <div
          key={groupIndex}
          className="share-generating-state__shimmer-group"
          aria-hidden="true"
        >
          <div className="share-generating-state__shimmer-bar" />
          <div className="share-generating-state__shimmer-bar" />
          <div className="share-generating-state__shimmer-bar" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `npx tsc --noEmit src/app/share/_components/share-generating-state.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/share/_components/share-generating-state.tsx
git commit -m "feat(share): add ShareGeneratingState with polling and shimmer"
```

---

## Task 4: ShareErrorState Component

**Files:**
- Create: `src/app/share/_components/share-error-state.tsx`

- [ ] **Step 1: Create the error state component**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { NativeButton } from "@/components/ui/native-button";
import type { ShareGenerationRecord } from "@/lib/server/share-generations";
import { generateShareCaption } from "@/app/share/[platform]/actions";

type ErrorMapping = {
  message: string;
  showSettingsLink: boolean;
};

function getErrorMapping(errorMessage: string | null): ErrorMapping {
  const msg = (errorMessage ?? "").toLowerCase();

  if (msg.includes("key") || msg.includes("quota") || msg.includes("no key")) {
    return {
      message: "Tidak ada Gemini key tersedia atau kuota habis.",
      showSettingsLink: true,
    };
  }

  if (msg.includes("timeout")) {
    return {
      message:
        "Proses timeout. Gemini tidak merespons dalam waktu yang ditentukan.",
      showSettingsLink: false,
    };
  }

  if (msg.includes("parse") || msg.includes("invalid") || msg.includes("json")) {
    return {
      message: "Respons dari Gemini tidak valid. Coba lagi.",
      showSettingsLink: false,
    };
  }

  return {
    message: "Terjadi error saat generate caption.",
    showSettingsLink: false,
  };
}

type ShareErrorStateProps = {
  generation: ShareGenerationRecord;
  onRetry: () => void;
};

export function ShareErrorState({ generation, onRetry }: ShareErrorStateProps) {
  const router = useRouter();
  const { message, showSettingsLink } = getErrorMapping(generation.error_message);

  function handleEditAndRetry() {
    // Navigate back to input form tab
    router.push(`/share/${generation.platform}?tab=input`);
  }

  return (
    <div className="share-error-state">
      <div className="share-error-state__header">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>Gagal generate caption</span>
      </div>

      <p className="share-error-state__message">{message}</p>

      <div className="share-error-state__actions">
        {showSettingsLink ? (
          <NativeButton
            type="button"
            className="compact secondary"
            onClick={() => router.push("/settings")}
          >
            Settings
          </NativeButton>
        ) : (
          <NativeButton
            type="button"
            className="compact secondary"
            onClick={onRetry}
          >
            Retry
          </NativeButton>
        )}
        <NativeButton
          type="button"
          className="compact primary"
          onClick={handleEditAndRetry}
        >
          Ubah &amp; Coba Lagi
        </NativeButton>
      </div>

      {showSettingsLink && (
        <a href="/settings" className="share-error-state__settings-link">
          Kelola Gemini key di Settings
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `npx tsc --noEmit src/app/share/_components/share-error-state.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/share/_components/share-error-state.tsx
git commit -m "feat(share): add ShareErrorState with context-aware messages"
```

---

## Task 5: ShareTimeoutState Component

**Files:**
- Create: `src/app/share/_components/share-timeout-state.tsx`

- [ ] **Step 1: Create the timeout state component**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { NativeButton } from "@/components/ui/native-button";
import type { ShareGenerationRecord } from "@/lib/server/share-generations";

type ShareTimeoutStateProps = {
  generation: ShareGenerationRecord;
};

export function ShareTimeoutState({ generation }: ShareTimeoutStateProps) {
  const router = useRouter();

  function handleRefresh() {
    router.refresh();
  }

  function handleBackToForm() {
    router.push(`/share/${generation.platform}?tab=input`);
  }

  return (
    <div className="share-timeout-state">
      <div className="share-timeout-state__header">
        <Clock size={16} aria-hidden="true" />
        <span>Proses lebih lama dari biasa</span>
      </div>

      <p className="share-timeout-state__message">
        Caption mungkin masih diproses di background. Kamu bisa:
      </p>

      <div className="share-timeout-state__actions">
        <NativeButton
          type="button"
          className="compact secondary"
          onClick={handleRefresh}
        >
          Refresh
        </NativeButton>
        <NativeButton
          type="button"
          className="compact primary"
          onClick={handleBackToForm}
        >
          Kembali ke Form
        </NativeButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `npx tsc --noEmit src/app/share/_components/share-timeout-state.tsx`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/share/_components/share-timeout-state.tsx
git commit -m "feat(share): add ShareTimeoutState with refresh and back actions"
```

---

## Task 6: Wire State Components into ShareOutputTab

**Files:**
- Modify: `src/app/share/[platform]/share-output-tab.tsx`

- [ ] **Step 1: Refactor ShareOutputTab to route between states**

Replace the entire file content:

```typescript
"use client";

import { useCallback, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton } from "@/components/ui/native-button";
import type { ShareGenerationRecord } from "@/lib/server/share-generations";
import { SHARE_ANGLE_LABELS, SHARE_PLATFORM_LABELS } from "@/lib/share/share-platform";
import { ShareGeneratingState } from "@/app/share/_components/share-generating-state";
import { ShareErrorState } from "@/app/share/_components/share-error-state";
import { ShareTimeoutState } from "@/app/share/_components/share-timeout-state";

type ShareOutputTabProps = {
  generation: ShareGenerationRecord;
};

export function ShareOutputTab({ generation: initialGeneration }: ShareOutputTabProps) {
  const [generation, setGeneration] = useState<ShareGenerationRecord>(initialGeneration);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sharedIndex, setSharedIndex] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const variants = generation.output_json ?? [];

  function clearFeedback(setter: (value: number | null) => void) {
    window.setTimeout(() => setter(null), 2000);
  }

  async function handleCopy(caption: string, index: number) {
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedIndex(index);
      clearFeedback(setCopiedIndex);
    } catch {
      // Clipboard can be unavailable in restricted browser contexts.
    }
  }

  async function handleManualShare(caption: string, index: number) {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: caption, title: SHARE_PLATFORM_LABELS[generation.platform] });
      } else {
        await navigator.clipboard.writeText(caption);
      }
      setSharedIndex(index);
      clearFeedback(setSharedIndex);
    } catch {
      // The operator can cancel the native share sheet; keep the output visible.
    }
  }

  const handleGenerated = useCallback((updated: ShareGenerationRecord) => {
    setGeneration(updated);
  }, []);

  const handleError = useCallback((updated: ShareGenerationRecord) => {
    setGeneration(updated);
  }, []);

  const handleTimeout = useCallback(() => {
    setTimedOut(true);
  }, []);

  function handleRetry() {
    // Reset to generating state and re-trigger via page refresh
    // The server action will be re-invoked from the form
    setGeneration({ ...generation, status: "generating", error_message: null });
    setTimedOut(false);
    // Trigger server-side re-generation by refreshing
    window.location.reload();
  }

  // Timeout state
  if (timedOut) {
    return (
      <div className="share-output-tab">
        <ShareTimeoutState generation={generation} />
      </div>
    );
  }

  // Generating state — show pulse + shimmer + polling
  if (generation.status === "generating") {
    return (
      <div className="share-output-tab">
        <ShareGeneratingState
          generation={generation}
          onGenerated={handleGenerated}
          onError={handleError}
          onTimeout={handleTimeout}
        />
      </div>
    );
  }

  // Error state — show context-aware error + actions
  if (generation.status === "error") {
    return (
      <div className="share-output-tab">
        <ShareErrorState generation={generation} onRetry={handleRetry} />
      </div>
    );
  }

  // Empty state
  if (!variants.length) {
    return (
      <div className="share-output-tab">
        <p className="helper-text">Belum ada caption yang di-generate.</p>
      </div>
    );
  }

  // Generated state — show captions with fade-in
  return (
    <div className="share-output-tab share-output-tab--fade-in">
      <ul className="share-output-list">
        {variants.map((variant, index) => {
          const angle = variant.angle ?? generation.angle;
          const platform = variant.platform ?? generation.platform;

          return (
            <li key={`${generation.id}-${index}`} className="share-output-item">
              <div className="share-output-item__header">
                <span className="share-output-item__label">Varian {index + 1}</span>
                <span className="share-output-item__badges">
                  <StatusBadge status={SHARE_ANGLE_LABELS[angle]} size="sm" tone="info" />
                  <StatusBadge status={SHARE_PLATFORM_LABELS[platform]} size="sm" tone="neutral" />
                </span>
              </div>
              <div className="share-output-item__caption">{variant.caption}</div>
              <div className="share-output-item__actions">
                <NativeButton
                  type="button"
                  className="compact tertiary"
                  onClick={() => handleCopy(variant.caption, index)}
                  aria-label={copiedIndex === index ? "Tersalin" : "Copy caption"}
                >
                  {copiedIndex === index ? (
                    <>
                      <Check size={14} aria-hidden="true" />
                      Tersalin
                    </>
                  ) : (
                    <>
                      <Copy size={14} aria-hidden="true" />
                      Copy
                    </>
                  )}
                </NativeButton>
                <NativeButton
                  type="button"
                  className="compact primary"
                  onClick={() => handleManualShare(variant.caption, index)}
                  aria-label={sharedIndex === index ? "Siap dibagikan" : "Manual Share"}
                >
                  {sharedIndex === index ? (
                    <>
                      <Check size={14} aria-hidden="true" />
                      Siap
                    </>
                  ) : (
                    <>
                      <Share2 size={14} aria-hidden="true" />
                      Manual Share
                    </>
                  )}
                </NativeButton>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify full build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add src/app/share/[platform]/share-output-tab.tsx
git commit -m "feat(share): wire generating/error/timeout states into output tab"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run full verification suite**

```bash
npm run audit:colors
npm run audit:typography
npm run audit:neutral-ui
npm run lint
npm run typecheck
npm run build
```

Expected: All pass with no regressions.

- [ ] **Step 2: Verify no hardcoded colors in new CSS**

Run: `npm run audit:colors`
Expected: No violations in share-workspace.css additions

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(share): address verification findings"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|-----------------|------|
| Pulse dot + shimmer skeleton | Task 2 (CSS) + Task 3 (component) |
| Status text progression by elapsed time | Task 3 (`STATUS_PROGRESSION`) |
| Polling 3s interval, stop on terminal | Task 3 (`useEffect` + `setInterval`) |
| Shimmer fade out → content fade in | Task 2 (`fade-in`) + Task 6 (`share-output-tab--fade-in`) |
| Error message by type | Task 4 (`getErrorMapping`) |
| Dual action buttons | Task 4 (Retry + Ubah & Coba Lagi) |
| Settings link for key/quota errors | Task 4 (`showSettingsLink`) |
| 90s timeout → timeout state | Task 3 (`TIMEOUT_MS`) + Task 5 |
| Refresh + Kembali ke Form | Task 5 |
| CSS tokens only (no hardcoded hex) | Task 2 (all `var(--color-*)`) |
| Polling endpoint with RLS | Task 1 (Supabase auth + user_id filter) |
