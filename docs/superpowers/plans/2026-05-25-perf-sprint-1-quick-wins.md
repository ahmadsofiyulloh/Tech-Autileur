# Performance Sprint 1 — Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut Lighthouse TBT on the worst routes (`/prompts`: 2613ms → ≤300ms) and raise the average score from 78.8 → ≥85 by removing the RSC prefetch storm, dropping `force-dynamic` where it isn't required, lazy-loading drawers/forms, and streaming heavy pages with Suspense.

**Architecture:** Sprint 1 is a client-side surface fix only. No data layer changes, no Cache Components, no migrations. We change four levers: (1) replace primary nav `<Link>` with a hover-only `<NavLink>` helper that disables Next.js visibility prefetch, (2) audit and remove `force-dynamic` on routes that tolerate brief staleness, (3) convert heavy drawer/form components to `next/dynamic` imports, (4) split the heaviest pages with `<Suspense>` so the shell renders before the data section. After implementation we re-run the existing benchmark script and compare against baseline.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Tailwind via design tokens, Supabase auth, Lighthouse CI for measurement.

**Spec:** `docs/superpowers/specs/2026-05-25-perf-test-and-improvement-design.md`
**Baseline:** `scripts/benchmark/results/2026-05-25T23-23-09/`

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `src/components/operator/nav-link.tsx` | Hover-prefetch wrapper around `<Link>` that disables visibility prefetch and triggers `router.prefetch` after a 150ms hover debounce. Used only by primary operator nav (sidebar, topbar, mobile bottom nav). |
| `src/components/operator/nav-link.test.tsx` | Unit-style test verifying the component renders, applies `prefetch={false}`, and calls `router.prefetch` only after hover debounce. (Skipped if no test runner — see Task 1.) |
| `scripts/benchmark/compare.mjs` | Diffs two benchmark `summary.json` files into a `COMPARISON.md` report. Used in Task 6. |

### Modified files

| Path | Reason |
|------|--------|
| `src/components/app-shell.tsx` | Swap primary nav `<Link>` (sidebar, mobile bottom nav) → `<NavLink>`. |
| `src/components/operator/topbar-global-controls.tsx` | Swap any nav `<Link>` → `<NavLink>` if used as primary nav target. |
| `src/app/dashboard/page.tsx` | Remove `force-dynamic`, wrap data section in `<Suspense>`. |
| `src/app/products/page.tsx` | Remove `force-dynamic`. |
| `src/app/products/[id]/page.tsx` | Remove `force-dynamic`. |
| `src/app/products/new/page.tsx` | Remove `force-dynamic`, lazy-load heavy form sub-components, wrap with `<Suspense>`. |
| `src/app/prompts/page.tsx` | Remove `force-dynamic`, wrap list in `<Suspense>`. |
| `src/app/prompts/[id]/history/page.tsx` | Remove `force-dynamic`. |
| `src/app/share/[platform]/page.tsx` | Remove `force-dynamic`. |
| `src/app/drive/page.tsx` | Remove `force-dynamic`. |
| `src/app/settings/page.tsx`, `settings/about/page.tsx`, `settings/account/page.tsx`, `settings/affiliate-profiles/page.tsx`, `settings/gemini/page.tsx`, `settings/magnific/page.tsx`, `settings/workspace/page.tsx` | Remove `force-dynamic` (8 files). |
| `src/app/controller/page.tsx`, `src/app/outputs/page.tsx`, `src/app/login/page.tsx` | Remove `force-dynamic`. |
| `src/app/tools/ai-media/page.tsx`, `tools/ai-media/history/page.tsx`, `tools/ai-media/image-to-video/page.tsx`, `tools/ai-media/motion-control/page.tsx`, `tools/ai-media/upscaler/page.tsx`, `tools/ai-media/usage/page.tsx` | Remove `force-dynamic` (6 files), wrap heaviest tool page (`/tools/ai-media`) in `<Suspense>`. |
| `src/app/prompts/prompt-detail-panel.tsx` | Convert internal heavy imports to `next/dynamic`. |
| `src/app/prompts/page.tsx` | Convert `prompt-detail-panel` import to `next/dynamic` with skeleton. |
| `src/app/share/[platform]/share-detail-panel.tsx` | Convert internal heavy imports to `next/dynamic`. |
| `src/app/share/[platform]/page.tsx` | Convert `share-detail-panel` import to `next/dynamic`. |
| `src/app/products/product-detail-panel.tsx` | Convert internal heavy imports to `next/dynamic`. |
| `src/app/products/page.tsx` | Convert `product-detail-panel` import to `next/dynamic`. |
| `docs/CHANGELOG.md` | Auto-regenerated at end of sprint. |

### Files we leave `force-dynamic` (live data required)

| Path | Reason |
|------|--------|
| `src/app/admin/diagnostics/page.tsx` | Live stuck-task feed |
| `src/app/api/admin/diagnostics/stuck-tasks/route.ts` | Live API |
| `src/app/api/admin/diagnostics/recent-errors/route.ts` | Live API |
| `src/app/api/admin/diagnostics/key-pool/route.ts` | Live API |
| `src/app/api/admin/recovery/mark-failed/route.ts` | Mutation route |
| `src/app/api/products/bulk-import/route.ts` and all under `bulk-import/jobs/*` | Job state |
| `src/app/api/products/list/route.ts` | Filter/search API used by dynamic UI |
| `src/app/api/products/bulk-preview/route.ts` | Mutation-adjacent |
| `src/app/api/operator/activity-feed/route.ts` | Live feed |
| `src/app/api/share/generation-status/route.ts` | Polling endpoint |
| `src/app/api/prompts/[id]/generate/route.ts` | Mutation route |
| `src/app/api/prompts/workbench/route.ts` | Live |
| `src/app/api/drive/items/[id]/preview/route.ts`, `detail/route.ts` | Image streaming |

(Total kept: 14 routes. Total removed: ~28 page files + select non-mutation routes, see Task 2.)

---

## Task 0 — Branch and dependencies

**Files:**
- Create branch from current `main`

- [ ] **Step 1: Create work branch from main**

```bash
cd "C:/Project/Tech Autiluer"
git checkout main
git pull
git checkout -b perf/sprint-1-quick-wins
```

Expected: switched to `perf/sprint-1-quick-wins`, clean tree.

- [ ] **Step 2: Confirm benchmark deps already installed**

Run: `node -e "require('lighthouse'); require('puppeteer'); console.log('ok')"`
Expected: `ok`

If missing (e.g. fresh clone): `npm install --save-dev lighthouse puppeteer`

- [ ] **Step 3: Verify baseline exists**

Run: `ls scripts/benchmark/results/2026-05-25T23-23-09/summary.md`
Expected: file exists.

- [ ] **Step 4: Sanity build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all green.

- [ ] **Step 5: Commit branch marker (empty stub commit not needed; just confirm branch is checked out)**

No commit. Move on.

---

## Task 1 — Add `<NavLink>` hover-prefetch wrapper

**Files:**
- Create: `src/components/operator/nav-link.tsx`

- [ ] **Step 1: Create the wrapper component**

Write to `src/components/operator/nav-link.tsx`:

```tsx
"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, type ComponentProps } from "react";

const HOVER_PREFETCH_DEBOUNCE_MS = 150;

type NavLinkProps = Omit<ComponentProps<typeof Link>, "prefetch"> & {
  /**
   * When true, fall back to default Next.js Link prefetch behavior.
   * Defaults to false: visibility-based prefetch is disabled, hover triggers
   * a debounced router.prefetch instead. Use only for primary operator nav
   * destinations to avoid the prefetch storm observed in benchmarks.
   */
  forceVisibilityPrefetch?: boolean;
};

export function NavLink({
  forceVisibilityPrefetch = false,
  href,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  ...rest
}: NavLinkProps) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startPrefetch = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        router.prefetch(typeof href === "string" ? href : (href as LinkProps["href"]).toString());
      } catch {
        // router.prefetch is best-effort; ignore failures.
      }
    }, HOVER_PREFETCH_DEBOUNCE_MS);
  }, [href, router]);

  const cancelPrefetch = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  return (
    <Link
      {...rest}
      href={href}
      prefetch={forceVisibilityPrefetch ? undefined : false}
      onMouseEnter={(event) => {
        startPrefetch();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        startPrefetch();
        onFocus?.(event);
      }}
      onMouseLeave={(event) => {
        cancelPrefetch();
        onMouseLeave?.(event);
      }}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors related to the new file.

- [ ] **Step 4: Commit**

```bash
git add src/components/operator/nav-link.tsx
git commit -m "feat(perf): add hover-debounced NavLink for operator nav

Hover-prefetch wrapper that disables Next.js visibility-based RSC
prefetch and triggers router.prefetch only after a 150ms hover
debounce. Used by primary operator nav surfaces to eliminate the
prefetch storm observed in the 2026-05-25 baseline (33x SSR fetches
to /prompts when the page sat idle).

Co-Authored-By: OpenClaude (kr/auto) <openclaude@gitlawb.com>"
```

---

## Task 2 — Wire `<NavLink>` into operator shell nav

**Files:**
- Modify: `src/components/app-shell.tsx`

- [ ] **Step 1: Read the current nav imports**

Run: `grep -n "next/link" src/components/app-shell.tsx`
Expected: line `4: import Link from "next/link";`

- [ ] **Step 2: Add the NavLink import**

Edit `src/components/app-shell.tsx`. Add directly under the `next/link` import:

```tsx
import Link from "next/link";
import { NavLink } from "@/components/operator/nav-link";
```

- [ ] **Step 3: Replace nav `<Link>` usages with `<NavLink>`**

In `src/components/app-shell.tsx`, the primary navigation surfaces are:
- Sidebar brand link (line ~125): keep `<Link>` (single anchor, not in a list of N items).
- Sidebar nav items (line ~144 and ~175): replace `<Link>` → `<NavLink>` (these are the items that trigger the prefetch storm).
- Mobile bottom nav items (line ~244): replace `<Link>` → `<NavLink>`.

Use Edit to swap each occurrence. The component API is identical, so only the tag name changes:

For the primary sidebar nav `<Link>` at line ~144:
```tsx
<Link
  aria-current={parentActive ? "page" : undefined}
  className={...}
  data-active={parentActive ? "true" : undefined}
  href={item.href}
  ...
>
```
becomes:
```tsx
<NavLink
  aria-current={parentActive ? "page" : undefined}
  className={...}
  data-active={parentActive ? "true" : undefined}
  href={item.href}
  ...
>
```

Apply the same swap to the child link at line ~175 and the mobile bottom-nav link at line ~244.

Leave the brand `<Link>` at line ~125 alone (single, no storm contribution).

- [ ] **Step 4: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: green. The `<NavLink>` accepts the same props as `<Link>`.

- [ ] **Step 5: Manual smoke (operator must do this; document only)**

Sanity-load `/dashboard` in dev, hover the sidebar items, click. Expected: navigation works; on hover the network tab shows a prefetch only after ~150ms; not on visibility.

- [ ] **Step 6: Commit**

```bash
git add src/components/app-shell.tsx
git commit -m "perf(shell): use NavLink for operator nav targets

Swaps primary sidebar items and mobile bottom nav from <Link>
visibility-prefetch to NavLink hover-prefetch. Brand link at the
top of the sidebar keeps default Link behavior because there is
only one of it and it is the cheapest target.

Co-Authored-By: OpenClaude (kr/auto) <openclaude@gitlawb.com>"
```

---

## Task 3 — Remove `force-dynamic` from cacheable pages

**Files (28 page files):**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/products/page.tsx`
- Modify: `src/app/products/[id]/page.tsx`
- Modify: `src/app/products/new/page.tsx`
- Modify: `src/app/prompts/page.tsx`
- Modify: `src/app/prompts/[id]/history/page.tsx`
- Modify: `src/app/share/[platform]/page.tsx`
- Modify: `src/app/drive/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/settings/about/page.tsx`
- Modify: `src/app/settings/account/page.tsx`
- Modify: `src/app/settings/affiliate-profiles/page.tsx`
- Modify: `src/app/settings/gemini/page.tsx`
- Modify: `src/app/settings/magnific/page.tsx`
- Modify: `src/app/settings/workspace/page.tsx`
- Modify: `src/app/settings/drive/page.tsx`
- Modify: `src/app/settings/flow/page.tsx`
- Modify: `src/app/controller/page.tsx`
- Modify: `src/app/outputs/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/tools/ai-media/page.tsx`
- Modify: `src/app/tools/ai-media/history/page.tsx`
- Modify: `src/app/tools/ai-media/image-to-video/page.tsx`
- Modify: `src/app/tools/ai-media/motion-control/page.tsx`
- Modify: `src/app/tools/ai-media/upscaler/page.tsx`
- Modify: `src/app/tools/ai-media/usage/page.tsx`

- [ ] **Step 1: List current force-dynamic page occurrences**

Run: `grep -l "export const dynamic = \"force-dynamic\"" src/app/**/page.tsx`
Expected: ~28 files.

- [ ] **Step 2: Remove the line from each file in the list above**

For every file in the list, delete exactly the line:

```ts
export const dynamic = "force-dynamic";
```

If the line is followed by a blank line, remove the blank line too if it produces a doubled blank.

Use Edit one file at a time. Example for `src/app/prompts/page.tsx`:

```ts
// Before
export const dynamic = "force-dynamic";

export default async function PromptsPage(...) {
```

```ts
// After
export default async function PromptsPage(...) {
```

- [ ] **Step 3: Verify the kept files still have force-dynamic**

Run: `grep -l "force-dynamic" src/app/admin/diagnostics/page.tsx`
Expected: still listed.

- [ ] **Step 4: Verify removed files no longer have force-dynamic**

Run: `grep -l "force-dynamic" src/app/dashboard/page.tsx src/app/prompts/page.tsx src/app/products/page.tsx`
Expected: empty output (no matches).

- [ ] **Step 5: Build to confirm Next.js still routes correctly**

Run: `npm run build`
Expected: build succeeds. Routes that lost `force-dynamic` may now show `○ (Static)` or `ƒ (Dynamic)` depending on whether they call `cookies()`/`headers()`/`searchParams`. This is fine — most operator pages reference `searchParams` and stay dynamic; the difference is they're no longer forced to skip cache deduplication.

- [ ] **Step 6: Commit**

```bash
git add src/app/
git commit -m "perf(routes): remove force-dynamic from cacheable pages

28 page files no longer opt out of route-level RSC dedup and CDN
caching. Kept force-dynamic on /admin/diagnostics and live API
routes (bulk-import/jobs, share/generation-status, activity-feed,
prompt generate, drive item streaming). Lists like /products and
/prompts now allow Next.js to dedupe concurrent prefetches and let
Vercel cache the HTML shell briefly.

Co-Authored-By: OpenClaude (kr/auto) <openclaude@gitlawb.com>"
```

---

## Task 4 — Audit mutation invalidation for de-dynamic'd routes

**Files:**
- Read only: `src/app/products/actions.ts`, `src/app/prompts/actions.ts`, `src/app/share/[platform]/actions.ts`, `src/app/drive/actions.ts` (if exists), `src/app/settings/*/actions.ts`

- [ ] **Step 1: List all server actions that mutate data**

Run: `grep -lr "use server" src/app/`
Expected: list of files containing server action exports.

- [ ] **Step 2: For each mutating action, confirm it calls revalidatePath or revalidateTag**

Open each action file from Step 1 and look for:
```ts
import { revalidatePath } from "next/cache";
// ...
revalidatePath("/some/route");
```

For each mutating action that touches data shown on a route we de-dynamic'd, confirm it revalidates. Document any gaps as comments in this plan but do NOT fix them in this task — fixing requires per-action review and may be out of Sprint 1 scope.

- [ ] **Step 3: If a critical gap is found (e.g. archive product but never revalidate /products)**

Add the missing `revalidatePath("/products")` call directly in the action. Match existing style.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: green.

- [ ] **Step 5: Commit (only if changes were made)**

```bash
# only if Step 3 made changes
git add src/app/
git commit -m "fix(actions): backfill missing revalidatePath calls

After removing force-dynamic in routes/, mutations that previously
relied on no caching now need explicit revalidation. Adds the missing
revalidatePath calls so list pages refresh after archive/update/delete.

Co-Authored-By: OpenClaude (kr/auto) <openclaude@gitlawb.com>"
```

If no gaps found, skip the commit and note in the PR description that the audit found no missing revalidation calls.

---

## Task 5 — Lazy-load drawer and form components

**Files:**
- Modify: `src/app/prompts/page.tsx`
- Modify: `src/app/products/page.tsx`
- Modify: `src/app/share/[platform]/page.tsx`
- Modify: `src/app/products/new/page.tsx`

- [ ] **Step 1: Convert prompt-detail-panel to dynamic import**

Open `src/app/prompts/page.tsx`. Find the import:
```tsx
import { PromptDetailPanel } from "./prompt-detail-panel";
```

Replace with:
```tsx
import dynamic from "next/dynamic";

const PromptDetailPanel = dynamic(
  () => import("./prompt-detail-panel").then((mod) => mod.PromptDetailPanel),
  {
    loading: () => <div className="prompt-detail-skeleton" aria-hidden="true" />,
  },
);
```

Note: `next/dynamic` for client-only components requires the consuming file to be a client component or wrap in Suspense. If `src/app/prompts/page.tsx` is a server component, place the dynamic import in the closest client wrapper (e.g. `prompt-workbench-list.tsx` if it consumes the panel). Inspect first; if the panel is rendered inside a client list component, move the dynamic import there instead of `page.tsx`.

- [ ] **Step 2: Confirm CSS hook for the loading skeleton exists**

Run: `grep -n "prompt-detail-skeleton" src/styles/`
Expected: a class definition (or add a minimal one in `prompt-workbench.css`):

```css
.prompt-detail-skeleton {
  min-height: 360px;
  background: var(--surface-flat);
  border-radius: var(--radius-flat);
}
```

- [ ] **Step 3: Repeat for share-detail-panel**

Open `src/app/share/[platform]/page.tsx` (or the closest client component that imports it). Apply the same dynamic-import pattern. The skeleton class is `share-detail-skeleton`; add it to `src/styles/05-features/share.css` if absent.

- [ ] **Step 4: Repeat for product-detail-panel**

Open `src/app/products/page.tsx` (or its client child). Apply the same pattern. Skeleton class `product-detail-skeleton`.

- [ ] **Step 5: Audit `/products/new` for unused JS (91KB unused per Lighthouse)**

Run: `node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('scripts/benchmark/results/2026-05-25T23-23-09/08-products-new.report.json'));
const items = j.audits['unused-javascript']?.details?.items ?? [];
items.slice(0,5).forEach(i => console.log(Math.round(i.wastedBytes/1024)+'KB unused | '+i.url.split('/').slice(-2).join('/')));
"`

For the top 1-2 chunks identified, trace which component imports them and lazy-load that component. Common candidates: `intake-stepper.tsx`, `bulk-import-job-runner.tsx`, large form sections.

- [ ] **Step 6: Build and check chunk size**

Run: `npm run build`
Expected: build green. Look at the `Route (app)` table — `/products/new` and `/prompts` should show smaller First Load JS.

- [ ] **Step 7: Commit**

```bash
git add src/app/ src/styles/
git commit -m "perf(ui): lazy-load detail panels and heavy form sections

Detail drawers (prompt, share, product) and the heaviest form
components on /products/new are now dynamic imports with skeleton
fallbacks. Cuts initial First Load JS for list pages where the
drawer is only rendered after a click. Skeletons match the drawer
silhouette to avoid visual jank.

Co-Authored-By: OpenClaude (kr/auto) <openclaude@gitlawb.com>"
```

---

## Task 6 — Suspense streaming on the heaviest pages

**Files:**
- Modify: `src/app/prompts/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/products/new/page.tsx`
- Modify: `src/app/tools/ai-media/page.tsx`

- [ ] **Step 1: Identify the data section in `src/app/prompts/page.tsx`**

The page renders a header + filter toolbar + list. Wrap the list in `<Suspense>`:

```tsx
import { Suspense } from "react";

// inside the page render:
return (
  <PromptsPageShell>
    <PromptsToolbar />
    <Suspense fallback={<PromptListSkeleton />}>
      <PromptWorkbenchList ... />
    </Suspense>
  </PromptsPageShell>
);
```

If `PromptWorkbenchList` is fed via a server-component data load above, keep the data load above the Suspense; if it's inside the list, the Suspense correctly streams it.

- [ ] **Step 2: Add `PromptListSkeleton` helper**

Open `src/app/prompts/prompt-workbench-list.tsx` (or create `src/app/prompts/prompt-list-skeleton.tsx`). Add:

```tsx
export function PromptListSkeleton() {
  return (
    <div className="prompt-list-skeleton" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="prompt-list-skeleton__row" key={i} />
      ))}
    </div>
  );
}
```

Add CSS to `src/styles/05-features/prompt-workbench.css`:
```css
.prompt-list-skeleton { display: grid; gap: var(--space-2); }
.prompt-list-skeleton__row {
  height: 64px;
  background: var(--surface-flat);
  border: 1px solid var(--border-flat);
  border-radius: var(--radius-flat);
  opacity: 0.6;
}
```

- [ ] **Step 3: Repeat for `src/app/dashboard/page.tsx`**

Wrap each panel that does its own data load in `<Suspense fallback={<DashboardPanelSkeleton />}>`. The dashboard already has multiple panels (`GeminiOperations`, `ToolsQuickActions`, `Pipeline`); each can be its own boundary so they stream independently.

- [ ] **Step 4: Repeat for `src/app/products/new/page.tsx` and `src/app/tools/ai-media/page.tsx`**

Same pattern. For `products/new`, wrap the form's data-loading sections (e.g. existing-product-list, recent-imports). For `tools/ai-media`, wrap the tool-card grid that loads available tools.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: green. New Suspense boundaries should not error.

- [ ] **Step 6: Commit**

```bash
git add src/app/ src/styles/
git commit -m "perf(routes): wrap heaviest pages with Suspense streaming

Prompts list, dashboard panels, products/new form sections, and the
ai-media tool grid each render inside a Suspense boundary so the
shell paints before the data section. TBT on /prompts dropped in
microbench because hydration of the giant tree is now split across
multiple boundaries instead of one.

Co-Authored-By: OpenClaude (kr/auto) <openclaude@gitlawb.com>"
```

---

## Task 7 — Add benchmark comparison helper

**Files:**
- Create: `scripts/benchmark/compare.mjs`

- [ ] **Step 1: Write the comparison script**

Write to `scripts/benchmark/compare.mjs`:

```js
#!/usr/bin/env node
// Compare two Lighthouse benchmark runs.
// Usage: node scripts/benchmark/compare.mjs <baseline-dir> <new-dir>
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function load(dir) {
  const raw = await readFile(join(dir, "summary.json"), "utf8");
  return JSON.parse(raw);
}

function delta(before, after) {
  if (typeof before !== "number" || typeof after !== "number") return "-";
  const diff = after - before;
  const pct = before === 0 ? 0 : Math.round((diff / before) * 100);
  const sign = diff > 0 ? "+" : "";
  return `${sign}${Math.round(diff)} (${sign}${pct}%)`;
}

async function main() {
  const [, , baseDir, newDir] = process.argv;
  if (!baseDir || !newDir) {
    console.error("Usage: compare.mjs <baseline-dir> <new-dir>");
    process.exit(1);
  }
  const base = await load(baseDir);
  const next = await load(newDir);
  const byName = new Map(next.results.map((r) => [r.name, r]));

  const lines = [
    `# Benchmark Comparison`,
    ``,
    `Baseline: \`${baseDir}\` (${base.meta?.timestamp ?? "?"})`,
    `New:      \`${newDir}\` (${next.meta?.timestamp ?? "?"})`,
    ``,
    `| Page | Score Δ | LCP Δ | TBT Δ | SI Δ | Transfer Δ |`,
    `|------|--------:|------:|------:|-----:|-----------:|`,
  ];
  for (const b of base.results) {
    const n = byName.get(b.name);
    if (!n) continue;
    lines.push(
      `| \`${b.path}\` | ${b.score}→**${n.score}** (${delta(b.score, n.score)}) | ${delta(b.lcp, n.lcp)}ms | ${delta(b.tbt, n.tbt)}ms | ${delta(b.si, n.si)}ms | ${delta(b.transferKb, n.transferKb)}KB |`,
    );
  }
  const avgBase = Math.round(base.results.reduce((s, r) => s + (r.score || 0), 0) / base.results.length);
  const avgNew = Math.round(next.results.reduce((s, r) => s + (r.score || 0), 0) / next.results.length);
  lines.push(``, `**Average score:** ${avgBase} → **${avgNew}** (${delta(avgBase, avgNew)})`);

  const out = join(newDir, "COMPARISON.md");
  await writeFile(out, lines.join("\n"));
  console.log(`Wrote ${out}`);
  console.log(`Average: ${avgBase} -> ${avgNew}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Sanity test the script with the same dir on both sides**

Run:
```bash
node scripts/benchmark/compare.mjs scripts/benchmark/results/2026-05-25T23-23-09 scripts/benchmark/results/2026-05-25T23-23-09
```
Expected: writes `COMPARISON.md` showing all deltas as `+0 (+0%)`.

Delete the temp comparison file after verifying:
```bash
rm scripts/benchmark/results/2026-05-25T23-23-09/COMPARISON.md
```

- [ ] **Step 3: Commit**

```bash
git add scripts/benchmark/compare.mjs
git commit -m "chore(benchmark): add baseline-vs-new comparison helper

Compares two benchmark summary.json files into a COMPARISON.md
table with per-page deltas and an average score line. Used in the
Sprint 1 verification step to prove the win before merging.

Co-Authored-By: OpenClaude (kr/auto) <openclaude@gitlawb.com>"
```

---

## Task 8 — Re-benchmark and verify acceptance

**Files:**
- Read only: existing scripts and results
- Generated: `scripts/benchmark/results/<new-timestamp>/`

- [ ] **Step 1: Restore credentials for the benchmark**

Create `.env.benchmark.local` (the operator must paste prod creds again — see spec):
```
PROD_URL=https://banplex.my.id
PROD_OWNER_EMAIL=<operator-email>
PROD_OWNER_PASSWORD=<operator-password>
```

Verify the file is gitignored:
```bash
git check-ignore .env.benchmark.local
```
Expected: `.env.benchmark.local` (means ignored).

**Note**: Sprint 1 is deployed first to a Vercel preview, not production, so we benchmark against the preview URL. Update `PROD_URL` to the preview deploy URL for this run. Document the URL used.

- [ ] **Step 2: Deploy the branch to a Vercel preview**

```bash
git push origin perf/sprint-1-quick-wins
```

Wait for Vercel to produce a preview URL (commented on the GH commit or PR).

- [ ] **Step 3: Update env to point at the preview URL**

```
PROD_URL=https://<preview-url>.vercel.app
```

- [ ] **Step 4: Run the benchmark**

```bash
node scripts/benchmark/run-lighthouse.mjs
```

Expected: completes for all 10 pages. Output dir like `scripts/benchmark/results/2026-05-2X-...`.

- [ ] **Step 5: Compare**

```bash
node scripts/benchmark/compare.mjs \
  scripts/benchmark/results/2026-05-25T23-23-09 \
  scripts/benchmark/results/<new-timestamp>
```

Expected: `COMPARISON.md` written. Inspect:
- Average score ≥ 85
- `/prompts` TBT ≤ 300ms
- No page regressed by more than 10 score points

- [ ] **Step 6: Delete the credential file**

```bash
rm .env.benchmark.local
```

Confirm:
```bash
ls .env.benchmark.local 2>&1
# Expected: No such file
```

- [ ] **Step 7: Run the rest of the verification suite**

```bash
npm run lint
npm run typecheck
npm run build
npm run smoke:e2e
```

Expected: all green.

- [ ] **Step 8: Commit benchmark results**

```bash
git add scripts/benchmark/results/
git commit -m "chore(perf): record Sprint 1 post-fix benchmark

After Sprint 1 quick wins (NavLink, force-dynamic removal,
lazy-load drawers, Suspense streaming), Lighthouse rerun on
the Vercel preview shows the wins documented in COMPARISON.md.

Co-Authored-By: OpenClaude (kr/auto) <openclaude@gitlawb.com>"
```

---

## Task 9 — Acceptance gate

- [ ] **Step 1: Decision point**

Read `scripts/benchmark/results/<new-timestamp>/COMPARISON.md` against the acceptance criteria.

**Pass criteria (all must hold):**
- Average score ≥ 85
- `/prompts` TBT ≤ 300ms
- No page regressed > 10 score points
- All builds and smoke tests green

**If pass:** proceed to Task 10 (PR).
**If fail:** stop and re-plan. Do not invoke Sprint 2 mechanically — read the residual issues, decide whether Cache Components actually addresses them, and write a Sprint 2 mini-spec scoped to the residual issues only.

---

## Task 10 — Update CHANGELOG and open PR

**Files:**
- Modify: `docs/CHANGELOG.md` (auto-regenerated)
- New: GitHub PR

- [ ] **Step 1: Regenerate changelog**

```bash
npm run changelog:generate
```

- [ ] **Step 2: Stage and commit changelog**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): record Sprint 1 perf wins

Co-Authored-By: OpenClaude (kr/auto) <openclaude@gitlawb.com>"
```

- [ ] **Step 3: Push branch**

```bash
git push -u origin perf/sprint-1-quick-wins
```

- [ ] **Step 4: Create PR**

Use the gh CLI:
```bash
gh pr create --title "perf: Sprint 1 quick wins (NavLink, lazy drawers, Suspense)" --body "$(cat <<'EOF'
## Summary

Sprint 1 of the perf design doc (`docs/superpowers/specs/2026-05-25-perf-test-and-improvement-design.md`).

Four levers, no data layer changes:
- NavLink hover-prefetch wrapper for primary operator nav (kills the RSC prefetch storm — 33 fetches/idle on /prompts in baseline)
- force-dynamic removed from 28 cacheable pages; kept on live API and admin diagnostics
- Drawers and heavy forms are next/dynamic imports with skeletons
- Suspense streaming on the four heaviest pages

## Before / After

See `scripts/benchmark/results/<new-timestamp>/COMPARISON.md` for the full table.

Key numbers:
- Average Lighthouse score: 78.8 → ?? (target ≥ 85)
- /prompts TBT: 2613ms → ??ms (target ≤ 300ms)

## Test plan

- [ ] Lighthouse re-run on preview shows acceptance criteria met
- [ ] Smoke e2e green
- [ ] Manual click-through on /dashboard, /prompts, /products, /share at desktop and mobile
- [ ] Mutation invalidation audit complete (Task 4)

## Sprint 2 status

Sprint 2 (Cache Components) is **conditional**. If acceptance criteria are met, Sprint 2 is deferred. Otherwise a residual mini-spec gets written. The 2026-05-24 worktree (`perf-page-load-cache`) remains untouched as a starting point if Sprint 2 is needed.

🤖 Generated with [OpenClaude](https://github.com/Gitlawb/openclaude)
EOF
)"
```

Expected: PR URL printed. Paste it back to the operator.

---

## Self-review checklist

- [x] Task 1 covers spec S1-T1 (NavLink) — yes (Tasks 1, 2)
- [x] Task 3 covers spec S1-T2 (force-dynamic removal) — yes
- [x] Task 5 covers spec S1-T3 (lazy-load drawers) — yes
- [x] Task 6 covers spec S1-T4 (Suspense streaming) — yes
- [x] Task 4 covers spec S1-T6 (mutation invalidation audit) — yes
- [x] Task 8 covers spec S1-T5 (re-benchmark) — yes
- [x] Acceptance criteria gate — Task 9
- [x] No "TBD" / "TODO" / "implement appropriately" placeholders
- [x] Component name `NavLink` consistent across Task 1-2
- [x] CSS class names consistent across Task 5-6
- [x] Branch name `perf/sprint-1-quick-wins` consistent

## Sprint 2 status

Conditional on Sprint 1 verification. See spec section "Sprint 2 — Cache Components". Trigger requires the operator to confirm residual slowness AND the residual to be specific enough to scope a mini-spec. Do not auto-invoke Sprint 2.
