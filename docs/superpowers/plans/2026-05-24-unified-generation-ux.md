# Unified Generation UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify generation loading UX (intake, prompt, share) into a single generic component, and consolidate Prompt + Share workspaces into 3-tab navigation (Output | Generate/Regenerate | History) with read-only history "Lihat" flow.

**Architecture:** Generic `<GeneratingState>` component with composition pattern (skeleton as React node prop) handles both polling mode (share, prompt) and synchronous mode (intake). Tab navigation uses URL params (`?tab=`) and reuses existing `tab-nav tab-nav--flush` CSS. History tabs become read-only lists with "Lihat" action that switches to Tab Output via `?version=<id>` param + version banner.

**Tech Stack:** Next.js 15 App Router, React 19, Server Components + Server Actions, URL-based tab state, client polling (3s/90s), shimmer CSS animation.

**Spec:** `docs/superpowers/specs/2026-05-24-unified-generation-ux-design.md`

---

## File Structure

### New files
- `src/components/operator/generating-state.tsx` — generic `<GeneratingState>` component (polling + non-polling modes, composable skeleton)
- `src/components/operator/generating-state-skeletons.tsx` — three skeleton variants: `<ShareSkeleton>`, `<PromptSkeleton>`, `<IntakeSkeleton>`
- `src/styles/05-features/generating-state.css` — shimmer animation + status pulse extracted from share-workspace.css
- `src/app/share/[platform]/share-output-version-banner.tsx` — "Versi X — tanggal" banner with "Kembali ke Terbaru" button (shared by share, can be reused for prompt)

### Modified files
- `src/lib/share/share-list-contract.ts` — extend `normalizeShareTab` to accept `"generate"`
- `src/app/share/[platform]/share-detail-panel.tsx` — restructure to 3 tabs (Output | Generate | History), remove `?mode=input` branching
- `src/app/share/[platform]/share-history-tab.tsx` — replace Regenerate button with "Lihat" button (router push to `?tab=output&version=<id>`)
- `src/app/share/[platform]/share-output-tab.tsx` — accept optional `version` param, render version banner when viewing old generation
- `src/app/share/_components/share-generating-state.tsx` — refactor as thin wrapper over `<GeneratingState>`
- `src/app/share/page.tsx` — adjust to pass `version` param into `<ShareDetailPanel>` and fetch by id when set
- `src/app/prompts/prompt-detail-panel.tsx` — restructure 2 SectionCards into 3 tabs (Output | Regenerate | History)
- `src/app/prompts/[id]/history/page.tsx` — keep route but use read-only variant (no Regenerate)
- `src/app/products/new/intake-workflow-form.tsx` — replace `<SkeletonIntakeMetadataPreview>` inside `IntakeMetadataPendingPanel` with `<GeneratingState isPending>` + `<IntakeSkeleton>`
- `src/styles/05-features/share-workspace.css` — remove duplicated shimmer rules now extracted to generating-state.css (keep share-specific layout only)

---

## Task 1: Create generic `<GeneratingState>` component

**Files:**
- Create: `src/components/operator/generating-state.tsx`
- Create: `tests/components/operator/generating-state.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/operator/generating-state.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { GeneratingState } from "@/components/operator/generating-state";

describe("GeneratingState", () => {
  it("renders skeleton and first status stage", () => {
    render(
      <GeneratingState
        skeleton={<div data-testid="skel" />}
        statusStages={["Stage 1", "Stage 2"]}
        isPending
      />,
    );
    expect(screen.getByTestId("skel")).toBeInTheDocument();
    expect(screen.getByText("Stage 1")).toBeInTheDocument();
  });

  it("calls onResolved when pollFn returns generated", async () => {
    const onResolved = jest.fn();
    const pollFn = jest.fn().mockResolvedValue({ status: "generated", error_message: null });
    render(
      <GeneratingState
        skeleton={<div />}
        statusStages={["S"]}
        pollFn={pollFn}
        onResolved={onResolved}
        pollIntervalMs={10}
      />,
    );
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith({ status: "generated", error_message: null }));
  });

  it("calls onTimeout after timeoutMs", async () => {
    jest.useFakeTimers();
    const onTimeout = jest.fn();
    const pollFn = jest.fn().mockResolvedValue({ status: "generating", error_message: null });
    render(
      <GeneratingState
        skeleton={<div />}
        statusStages={["S"]}
        pollFn={pollFn}
        onTimeout={onTimeout}
        pollIntervalMs={10}
        timeoutMs={50}
      />,
    );
    jest.advanceTimersByTime(60);
    await waitFor(() => expect(onTimeout).toHaveBeenCalled());
    jest.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/components/operator/generating-state.test.tsx`
Expected: FAIL with "Cannot find module '@/components/operator/generating-state'"

- [ ] **Step 3: Implement the component**

```tsx
// src/components/operator/generating-state.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type GeneratingStatePollResult = {
  status: string;
  error_message?: string | null;
};

export type GeneratingStateProps = {
  skeleton: ReactNode;
  statusStages: string[];
  pollFn?: () => Promise<GeneratingStatePollResult>;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onResolved?: (result: GeneratingStatePollResult) => void;
  onTimeout?: () => void;
  isPending?: boolean;
  estimateLabel?: string;
};

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 90000;
const STAGE_CYCLE_MS = 15000;

export function GeneratingState({
  skeleton,
  statusStages,
  pollFn,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onResolved,
  onTimeout,
  estimateLabel,
}: GeneratingStateProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const resolvedRef = useRef(false);
  const timedOutRef = useRef(false);

  useEffect(() => {
    startedAtRef.current = Date.now();

    const stageInterval = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, statusStages.length - 1));
    }, STAGE_CYCLE_MS);

    const timeoutId = setTimeout(() => {
      if (!resolvedRef.current && !timedOutRef.current) {
        timedOutRef.current = true;
        onTimeout?.();
      }
    }, timeoutMs);

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    async function tick() {
      if (!pollFn || resolvedRef.current || timedOutRef.current) return;
      try {
        const result = await pollFn();
        if (result.status !== "generating" && !resolvedRef.current) {
          resolvedRef.current = true;
          onResolved?.(result);
        }
      } catch {
        // silent retry — network blip
      }
    }

    if (pollFn) {
      void tick();
      pollInterval = setInterval(tick, pollIntervalMs);
    }

    return () => {
      clearInterval(stageInterval);
      clearTimeout(timeoutId);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollFn, pollIntervalMs, timeoutMs, onResolved, onTimeout, statusStages.length]);

  const statusText = statusStages[Math.min(stageIndex, statusStages.length - 1)] ?? "";

  return (
    <div className="generating-state">
      <div className="generating-state__header">
        <div className="generating-state__status" role="status" aria-live="polite">
          <span className="generating-state__dot" aria-hidden="true" />
          {statusText}
        </div>
        {estimateLabel ? (
          <p className="generating-state__subtitle">{estimateLabel}</p>
        ) : null}
      </div>
      <div className="generating-state__body">{skeleton}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/components/operator/generating-state.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/operator/generating-state.tsx tests/components/operator/generating-state.test.tsx
git commit -m "feat(operator): add generic GeneratingState component"
```

---

## Task 2: Extract shimmer CSS to generating-state.css

**Files:**
- Create: `src/styles/05-features/generating-state.css`
- Modify: `src/styles/index.css` (or whatever imports the 05-features layer)

- [ ] **Step 1: Identify current shimmer rules in share-workspace.css**

Run: `Grep with pattern="share-shimmer-bar|share-generating-state|share-pulse-dot|share-shimmer" path="src/styles/05-features/share-workspace.css"`
Expected: ranges around lines 1365–1474.

- [ ] **Step 2: Create generating-state.css with extracted + renamed rules**

```css
/* src/styles/05-features/generating-state.css */
.generating-state {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
  padding: var(--space-4, 16px) 0;
}

.generating-state__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
}

.generating-state__status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 8px);
  font-size: var(--font-size-sm, 14px);
  color: var(--color-fg-default, #1a1a1a);
  transition: opacity 200ms ease;
}

.generating-state__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent-default, #2563eb);
  animation: generating-state-pulse 1.4s ease-in-out infinite;
}

@keyframes generating-state-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.85); }
  50%      { opacity: 1;   transform: scale(1); }
}

.generating-state__subtitle {
  margin: 0;
  font-size: var(--font-size-xs, 12px);
  color: var(--color-fg-muted, #6b7280);
}

.generating-state__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
}

.generating-state-shimmer {
  height: 12px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--color-bg-subtle, #f3f4f6) 0%,
    var(--color-bg-default, #ffffff) 50%,
    var(--color-bg-subtle, #f3f4f6) 100%
  );
  background-size: 200% 100%;
  animation: generating-state-shimmer 1.6s linear infinite;
}

@keyframes generating-state-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.generating-state-shimmer--w-50 { width: 50%; }
.generating-state-shimmer--w-75 { width: 75%; }
.generating-state-shimmer--w-90 { width: 90%; }
.generating-state-shimmer--delay-1 { animation-delay: 0.15s; }
.generating-state-shimmer--delay-2 { animation-delay: 0.3s; }
```

- [ ] **Step 3: Register the new CSS in the feature layer index**

Find the 05-features import (e.g. `src/styles/index.css` or `globals.css`) and add `@import "./05-features/generating-state.css";` after the existing share-workspace import.

- [ ] **Step 4: Verify tokens compile**

Run: `npm run audit:colors && npm run audit:typography`
Expected: PASS, no new violations.

- [ ] **Step 5: Commit**

```bash
git add src/styles/05-features/generating-state.css src/styles/index.css
git commit -m "feat(styles): add generating-state shimmer CSS shared across surfaces"
```

---

## Task 3: Create skeleton variants

**Files:**
- Create: `src/components/operator/generating-state-skeletons.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/operator/generating-state-skeletons.tsx
type ShareSkeletonProps = { variantCount: number };

export function ShareSkeleton({ variantCount }: ShareSkeletonProps) {
  const slots = Array.from({ length: Math.max(variantCount, 1) }, (_, i) => i);
  return (
    <div className="generating-state__share-variants">
      {slots.map((i) => (
        <div key={i} className="generating-state__share-variant">
          <div className="generating-state-shimmer generating-state-shimmer--w-75" />
          <div className="generating-state-shimmer generating-state-shimmer--w-90 generating-state-shimmer--delay-1" />
          <div className="generating-state-shimmer generating-state-shimmer--w-50 generating-state-shimmer--delay-2" />
        </div>
      ))}
    </div>
  );
}

export function PromptSkeleton() {
  return (
    <div className="generating-state__prompt">
      <div className="generating-state-shimmer generating-state-shimmer--w-90" />
      <div className="generating-state-shimmer generating-state-shimmer--w-75 generating-state-shimmer--delay-1" />
      <div className="generating-state-shimmer generating-state-shimmer--w-50 generating-state-shimmer--delay-2" />
      <div className="generating-state-shimmer generating-state-shimmer--w-90 generating-state-shimmer--delay-1" />
    </div>
  );
}

export function IntakeSkeleton() {
  return (
    <div className="generating-state__intake">
      <div className="generating-state-shimmer generating-state-shimmer--w-50" />
      <div className="generating-state-shimmer generating-state-shimmer--w-75 generating-state-shimmer--delay-1" />
      <div className="generating-state-shimmer generating-state-shimmer--w-90 generating-state-shimmer--delay-2" />
    </div>
  );
}
```

- [ ] **Step 2: Add skeleton-specific layout CSS to generating-state.css**

```css
/* append to generating-state.css */
.generating-state__share-variants {
  display: grid;
  gap: var(--space-3, 12px);
}
.generating-state__share-variant {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px);
  border: 1px solid var(--color-border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
}
.generating-state__prompt,
.generating-state__intake {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/operator/generating-state-skeletons.tsx src/styles/05-features/generating-state.css
git commit -m "feat(operator): add Share/Prompt/Intake skeleton variants for GeneratingState"
```

---

## Task 4: Refactor `ShareGeneratingState` as wrapper

**Files:**
- Modify: `src/app/share/_components/share-generating-state.tsx`

- [ ] **Step 1: Replace implementation with wrapper**

```tsx
// src/app/share/_components/share-generating-state.tsx
"use client";

import { useCallback } from "react";
import {
  GeneratingState,
  type GeneratingStatePollResult,
} from "@/components/operator/generating-state";
import { ShareSkeleton } from "@/components/operator/generating-state-skeletons";

type Props = {
  generationId: string;
  variantCount: number;
  onResolved: (result: GeneratingStatePollResult) => void;
  onTimeout: () => void;
};

const SHARE_STATUS_STAGES = [
  "Memproses permintaan...",
  "Menghubungi Gemini...",
  "Generating caption...",
  "Masih memproses, mohon tunggu...",
  "Proses lebih lama dari biasa...",
];

export function ShareGeneratingState({ generationId, variantCount, onResolved, onTimeout }: Props) {
  const pollFn = useCallback(async (): Promise<GeneratingStatePollResult> => {
    const res = await fetch(`/api/share/generation-status?id=${encodeURIComponent(generationId)}`);
    if (!res.ok) return { status: "generating", error_message: null };
    const data = (await res.json()) as { status: string; error_message: string | null };
    return { status: data.status, error_message: data.error_message };
  }, [generationId]);

  return (
    <GeneratingState
      skeleton={<ShareSkeleton variantCount={variantCount} />}
      statusStages={SHARE_STATUS_STAGES}
      pollFn={pollFn}
      onResolved={onResolved}
      onTimeout={onTimeout}
      estimateLabel="Estimasi 10–30 detik"
    />
  );
}
```

- [ ] **Step 2: Verify usage sites still type-check**

Run: `npm run typecheck`
Expected: PASS — `ShareOutputTab` still calls `<ShareGeneratingState onResolved={...} onTimeout={...} />`.

- [ ] **Step 3: Smoke check share generation**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/share/_components/share-generating-state.tsx
git commit -m "refactor(share): wrap ShareGeneratingState over generic GeneratingState"
```

---

## Task 5: Extend `normalizeShareTab` to accept `"generate"`

**Files:**
- Modify: `src/lib/share/share-list-contract.ts`

- [ ] **Step 1: Read the existing normalizer**

Run: `Grep with pattern="normalizeShareTab" path="src/lib/share/share-list-contract.ts" output_mode="content" -C=4`

- [ ] **Step 2: Update normalizer**

Replace the existing `normalizeShareTab` function body so the union expands:

```ts
export type ShareTab = "output" | "generate" | "history";

export function normalizeShareTab(value: string | null | undefined): ShareTab {
  if (value === "generate") return "generate";
  if (value === "history") return "history";
  return "output";
}
```

If `ShareTab` is already exported elsewhere, update both the type and the function in the same file.

- [ ] **Step 3: Update consumers**

Run: `Grep with pattern="normalizeShareTab|ShareTab" path="src" type="ts"`
Expected consumers: `src/app/share/page.tsx`, `src/app/share/[platform]/share-detail-panel.tsx`. Tighten the local prop types in both to use `ShareTab`.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/share/share-list-contract.ts src/app/share/page.tsx src/app/share/[platform]/share-detail-panel.tsx
git commit -m "feat(share): support generate tab in normalizeShareTab"
```

---

## Task 6: Add Tab Generate to `ShareDetailPanel`, drop `?mode=input`

**Files:**
- Modify: `src/app/share/[platform]/share-detail-panel.tsx`
- Modify: `src/app/share/page.tsx` (parameter wiring)

- [ ] **Step 1: Update the panel to render 3 tabs**

```tsx
// src/app/share/[platform]/share-detail-panel.tsx
"use client";

import Link from "next/link";
import { ShareInputForm } from "./share-input-form";
import { ShareOutputTab } from "./share-output-tab";
import { ShareHistoryTab } from "./share-history-tab";
import type { SharePlatform, ShareAngle } from "@/lib/share/share-platform";
import {
  buildShareListHref,
  type ShareListRow,
  type ShareTab,
} from "@/lib/share/share-list-contract";
import type { ShareGenerationRecord } from "@/lib/server/share-generations";

type ShareDetailPanelProps = {
  action: (formData: FormData) => void;
  generations: ShareGenerationRecord[];
  latestGeneration: ShareGenerationRecord | null;
  selectedGeneration: ShareGenerationRecord | null;
  platform: SharePlatform;
  prefillAngle?: ShareAngle | null;
  prefillVariantCount?: number | null;
  product: ShareListRow;
  selectedTab: ShareTab;
  selectedVersionId?: string | null;
};

const shareTabs = [
  { key: "output", label: "Output" },
  { key: "generate", label: "Generate" },
  { key: "history", label: "History" },
] as const;

export function ShareDetailPanel({
  action,
  generations,
  latestGeneration,
  selectedGeneration,
  platform,
  prefillAngle,
  prefillVariantCount,
  product,
  selectedTab,
  selectedVersionId,
}: ShareDetailPanelProps) {
  const effectiveTab: ShareTab = !latestGeneration && selectedTab !== "generate" ? "generate" : selectedTab;

  return (
    <div className="share-detail-panel">
      <nav className="tab-nav tab-nav--flush" aria-label="Tab share detail">
        {shareTabs.map((tab) => {
          const href = buildShareListHref({
            platform,
            detailId: product.id,
            tab: tab.key,
          });
          return (
            <Link
              aria-current={effectiveTab === tab.key ? "page" : undefined}
              className="tab-link"
              data-active={effectiveTab === tab.key ? "true" : undefined}
              href={href}
              key={tab.key}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {effectiveTab === "output" ? (
        <ShareOutputTab
          generation={selectedGeneration ?? latestGeneration}
          latestGenerationId={latestGeneration?.id ?? null}
          productId={product.id}
          platform={platform}
          affiliateUrl={product.affiliate_url}
          isViewingOldVersion={Boolean(selectedVersionId && selectedVersionId !== latestGeneration?.id)}
        />
      ) : null}

      {effectiveTab === "generate" ? (
        <ShareInputForm
          action={action}
          platform={platform}
          prefillAngle={prefillAngle}
          prefillVariantCount={prefillVariantCount}
          product={product}
        />
      ) : null}

      {effectiveTab === "history" ? (
        <ShareHistoryTab
          generations={generations}
          platform={platform}
          productId={product.id}
          activeGenerationId={selectedGeneration?.id ?? latestGeneration?.id ?? null}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Wire `version` param through `src/app/share/page.tsx`**

In the page server component, read `searchParams.version`, fetch that specific `share_generations` row when set (scoped to user + product + platform), and pass `selectedGeneration` + `selectedVersionId` to `<ShareDetailPanel>`. Drop `showInput` and `?mode=input` parsing — replace with tab-driven branching.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/share/[platform]/share-detail-panel.tsx src/app/share/page.tsx
git commit -m "feat(share): add Generate tab and version-aware Output tab"
```

---

## Task 7: Replace Regenerate with "Lihat" in ShareHistoryTab

**Files:**
- Modify: `src/app/share/[platform]/share-history-tab.tsx`

- [ ] **Step 1: Remove `buildRegenerateHref`, add view-version href**

```tsx
// src/app/share/[platform]/share-history-tab.tsx
"use client";

import Link from "next/link";
import type { ShareGenerationRecord } from "@/lib/server/share-generations";
import { SHARE_ANGLE_LABELS, type SharePlatform } from "@/lib/share/share-platform";
import { buildShareListHref } from "@/lib/share/share-list-contract";

type ShareHistoryTabProps = {
  generations: ShareGenerationRecord[];
  platform: SharePlatform;
  productId: string;
  activeGenerationId: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildViewHref(input: {
  platform: SharePlatform;
  productId: string;
  generationId: string;
}) {
  const base = buildShareListHref({
    platform: input.platform,
    detailId: input.productId,
    tab: "output",
  });
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}version=${encodeURIComponent(input.generationId)}`;
}

export function ShareHistoryTab({ generations, platform, productId, activeGenerationId }: ShareHistoryTabProps) {
  if (!generations.length) {
    return (
      <div className="share-history-tab">
        <p className="helper-text">Belum ada riwayat generate.</p>
      </div>
    );
  }

  return (
    <div className="share-history-tab">
      <div className="share-history-table-head" aria-hidden="true">
        <span>Waktu</span>
        <span>Setting</span>
        <span>Preview</span>
        <span>Aksi</span>
      </div>
      <ul className="share-history-list">
        {generations.map((generation) => {
          const preview = generation.output_json?.[0]?.caption?.trim() ?? "Belum ada output.";
          const viewHref = buildViewHref({ platform, productId, generationId: generation.id });
          const isActive = generation.id === activeGenerationId;

          return (
            <li key={generation.id} className="share-history-row" data-active={isActive ? "true" : undefined}>
              <div className="share-history-row__body">
                <div className="share-history-row__meta">{formatDate(generation.created_at)}</div>
                <div className="share-history-row__settings">
                  <strong>{SHARE_ANGLE_LABELS[generation.angle]}</strong>
                  <span>{generation.variant_count} varian</span>
                </div>
                <div className="share-history-row__preview">{preview}</div>
                <div className="share-history-row__actions">
                  <Link className="compact" href={viewHref}>
                    Lihat
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/share/[platform]/share-history-tab.tsx
git commit -m "feat(share): replace Regenerate with Lihat in history tab"
```

---

## Task 8: Add version banner to `ShareOutputTab`

**Files:**
- Create: `src/app/share/[platform]/share-output-version-banner.tsx`
- Modify: `src/app/share/[platform]/share-output-tab.tsx`
- Modify: `src/styles/05-features/share-workspace.css` (add banner styles)

- [ ] **Step 1: Create the banner component**

```tsx
// src/app/share/[platform]/share-output-version-banner.tsx
"use client";

import Link from "next/link";
import { buildShareListHref } from "@/lib/share/share-list-contract";
import type { SharePlatform } from "@/lib/share/share-platform";

type Props = {
  platform: SharePlatform;
  productId: string;
  createdAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));
}

export function ShareOutputVersionBanner({ platform, productId, createdAt }: Props) {
  const latestHref = buildShareListHref({ platform, detailId: productId, tab: "output" });
  return (
    <div className="output-version-banner" role="status">
      <span className="output-version-banner__label">Versi lama — {formatDate(createdAt)}</span>
      <Link className="compact" href={latestHref}>
        Kembali ke Terbaru
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Add banner styles**

```css
/* append to share-workspace.css or 99-overrides */
.output-version-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  border: 1px solid var(--color-border-subtle, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  background: var(--color-bg-subtle, #f9fafb);
  font-size: var(--font-size-sm, 14px);
}
.output-version-banner__label { color: var(--color-fg-muted, #6b7280); }
```

- [ ] **Step 3: Render banner in ShareOutputTab when viewing old version**

Update the existing ShareOutputTab signature to accept `latestGenerationId` + `isViewingOldVersion` and `platform`. When `isViewingOldVersion` is true and `generation` is set, render `<ShareOutputVersionBanner platform={platform} productId={productId} createdAt={generation.created_at} />` above the variant list. Do not render the banner during generating/error states.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/share/[platform]/share-output-version-banner.tsx src/app/share/[platform]/share-output-tab.tsx src/styles/05-features/share-workspace.css
git commit -m "feat(share): add version banner to Output tab when viewing old generation"
```

---

## Task 9: Restructure `PromptDetailPanel` to 3 tabs

**Files:**
- Modify: `src/app/prompts/prompt-detail-panel.tsx`
- Modify: `src/app/prompts/[id]/history/page.tsx` (read-only mode)

- [ ] **Step 1: Identify current tab/url helpers**

Run: `Grep with pattern="prompt.*tab|usePathname|useSearchParams" path="src/app/prompts/prompt-detail-panel.tsx" output_mode="content"`
Confirm there is no existing tab plumbing — this task introduces it.

- [ ] **Step 2: Convert the two SectionCards into 3 tabs**

Replace the stacked Output card + Regenerate card with a tab nav identical in structure to ShareDetailPanel: `[ Output ] [ Regenerate ] [ History ]`. Tab state is read from `searchParams.tab` (`output | regenerate | history`, default `output`). Reuse `tab-nav tab-nav--flush` + `tab-link`. The Regenerate tab renders the existing regenerate form. The History tab renders an inline history list (extracted from `/prompts/[id]/history` rendering, but with read-only "Lihat" action, no Regenerate). Switching to a version is via `?tab=output&version=<id>`.

Provide the full updated file. Keep `isPromptGenerationPending` polling logic, but render `<GeneratingState>` with `<PromptSkeleton>` inside the Regenerate tab when pending instead of the existing inline spinner.

- [ ] **Step 3: Make `/prompts/[id]/history` route read-only**

Where the route currently renders `<PromptDetailPanel>`, render a dedicated read-only history view (or pass a `readOnly` prop) so the Regenerate field never appears in the drawer/page.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run audit:colors && npm run audit:typography`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/prompts/prompt-detail-panel.tsx src/app/prompts/[id]/history/page.tsx
git commit -m "feat(prompts): restructure detail panel into Output | Regenerate | History tabs"
```

---

## Task 10: Migrate intake pending panel to `<GeneratingState>`

**Files:**
- Modify: `src/app/products/new/intake-workflow-form.tsx`

- [ ] **Step 1: Replace `IntakeMetadataPendingPanel` body**

```tsx
// inside intake-workflow-form.tsx
import { GeneratingState } from "@/components/operator/generating-state";
import { IntakeSkeleton } from "@/components/operator/generating-state-skeletons";

const INTAKE_STATUS_STAGES = [
  "Memproses permintaan...",
  "Menganalisis gambar...",
  "Mengekstrak metadata produk...",
  "Masih memproses, mohon tunggu...",
];

function IntakeMetadataPendingPanel() {
  return (
    <GeneratingState
      skeleton={<IntakeSkeleton />}
      statusStages={INTAKE_STATUS_STAGES}
      isPending
      estimateLabel="Estimasi 10–30 detik"
    />
  );
}
```

- [ ] **Step 2: Remove the now-unused `SkeletonIntakeMetadataPreview` import (if no other consumer)**

Run: `Grep with pattern="SkeletonIntakeMetadataPreview" path="src"`
If only one consumer, drop the import. If shared, leave the original component intact.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/products/new/intake-workflow-form.tsx
git commit -m "feat(intake): use GeneratingState for metadata pending panel"
```

---

## Task 11: Cleanup duplicate share shimmer CSS

**Files:**
- Modify: `src/styles/05-features/share-workspace.css`

- [ ] **Step 1: Remove duplicated shimmer + status rules**

Delete the now-superseded `.share-generating-state*`, `.share-shimmer-bar*`, `@keyframes share-shimmer`, `@keyframes share-pulse-dot` blocks (kept only as historical layout in lines ~1365–1474). Keep any layout-specific share rules that aren't shimmer.

- [ ] **Step 2: Verify visual parity**

Run: `npm run smoke:e2e -- --grep "share"` (if available) or smoke test manually at 360 / 768 / 1024 / 1280.
Expected: shimmer animation visually identical via the new generic class names.

- [ ] **Step 3: Verify token audits**

Run: `npm run audit:colors && npm run audit:typography && npm run audit:neutral-ui`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/styles/05-features/share-workspace.css
git commit -m "chore(styles): drop legacy share shimmer rules superseded by generating-state.css"
```

---

## Task 12: Final verification pass

- [ ] **Step 1: Full UI verification suite**

```bash
npm run audit:colors
npm run audit:typography
npm run audit:neutral-ui
npm run lint
npm run typecheck
npm run build
```
Expected: all PASS.

- [ ] **Step 2: Manual smoke per surface**

- Share: navigate `/share/facebook?detail=<id>` → confirm 3 tabs render, Generate submits, Output polls + resolves, History "Lihat" routes to `?tab=output&version=<id>` and shows banner, "Kembali ke Terbaru" clears version.
- Prompt: navigate `/prompts/<id>` → confirm 3 tabs (Output / Regenerate / History), Regenerate triggers `<GeneratingState>` with prompt skeleton, History "Lihat" works, banner appears for old version.
- Intake: submit `/products/new` → confirm new GeneratingState skeleton + cycling status text.
- Responsive: 360 / 768 / 1024 / 1280 — tab nav stretches and scrolls.

- [ ] **Step 3: Capture screenshots for handoff**

Save 4-width screenshots of: Share Output tab, Share Generate tab, Share History tab with Lihat, Share Output viewing old version (banner), Prompt 3-tab layout, Intake pending state.

- [ ] **Step 4: Final commit (if any pending fixes)**

```bash
git status
# only commit if real fixes are needed
```
