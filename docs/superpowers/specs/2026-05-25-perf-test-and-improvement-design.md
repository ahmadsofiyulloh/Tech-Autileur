# Performance Improvement Design — 2026-05-25

**Status**: Approved (brainstorming phase)
**Author**: OpenClaude (kr/auto) with operator collaboration
**Approach**: Hybrid — Sprint 1 quick wins, then re-evaluate Sprint 2 (Cache Components)
**Predecessor plan**: `docs/superpowers/plans/2026-05-24-page-load-performance.md` (still relevant for Sprint 2 if needed)
**Benchmark baseline**: `scripts/benchmark/results/2026-05-25T23-23-09/`

## Problem statement

The user reports that "navigation from one page to another feels slow and unresponsive" and the entire app feels heavy. A Lighthouse benchmark of production (https://banplex.my.id) authenticated with the operator account confirmed this perception with concrete data.

## Benchmark findings

| Page | Score | LCP | TBT | Notes |
|------|------:|----:|----:|-------|
| `/dashboard` | 64 | 1238ms | 614ms | Heavy hydration |
| `/products` | 92 | 1110ms | 20ms | OK baseline |
| `/prompts` | **53** | 1805ms | **2613ms** | Worst — 16 long tasks, 5s TTI |
| `/share` | 87 | 856ms | 224ms | OK |
| `/drive` | 83 | 819ms | 259ms | OK |
| `/settings` | 93 | 1031ms | 5ms | OK baseline |
| `/admin/diagnostics` | 96 | 786ms | 47ms | Best |
| `/products/new` | 63 | 1203ms | 717ms | 91KB unused JS |
| `/login` | 94 | 877ms | 120ms | OK |
| `/tools/ai-media` | 63 | 1059ms | 767ms | Heavy hydration |

**Average score 78.8. TBT range 5ms-2613ms.**

### Root causes

1. **RSC prefetch storm**. `/prompts` issued 33 fetches to its own URL during the trace. Cause: every `<Link>` in the operator nav prefetches RSC payloads when visible. With `force-dynamic` everywhere, each prefetch costs a full SSR.
2. **`force-dynamic` on every page** (42 files confirmed). No route-level caching, no Vercel CDN reuse, every navigation is a fresh SSR.
3. **Heavy hydration trees**. /prompts hydration produces 16 long tasks; /tools/ai-media has 13. Drawer/form components are bundled into the initial load even when unopened.
4. **Bundle reuse but waste**. Shared chunk `0v9c2uadhpd-i.js` (71KB) loads on every page and burns 758-1161ms of bootup. 27KB unused JS on average per page.
5. **Login redirect chain** (lower priority, ~230ms).

### What is healthy
- TTFB ~20ms across all routes — server compute is fast.
- CLS = 0 — no layout shifts.
- Network bandwidth — total transfer <750KB on every page.
- Database queries — not visible as a bottleneck given TTFB is constant.

The bottleneck is **client-side**, not server-side. The 2026-05-24 Cache Components plan focuses on server-side caching where TTFB is already 20ms — diminishing returns for that effort. Client-side fixes deliver more impact per hour invested.

## Sprint 1 — Quick Wins (target: 3 days)

### Goal

Average Lighthouse score 78.8 → ≥85. TBT on the worst page (`/prompts`) 2613ms → ≤300ms. Remove perceived navigation lag.

### Task list

#### S1-T1 Disable RSC prefetch on operator nav
**Files**: `src/components/operator/main-nav.tsx`, `src/components/operator/sidebar*.tsx`, mobile bottom nav, topbar profile menu.

**Implementation**:
- Add a `<NavLink>` wrapper component at `src/components/operator/nav-link.tsx`.
- Internally `<Link prefetch={false}>` plus an `onMouseEnter` handler that calls `router.prefetch(href)` after a 150ms debounce.
- Replace `<Link>` with `<NavLink>` in primary nav locations only. Inline content links keep `<Link>` defaults.

**Why**: Eliminates the 33-fetch storm observed on `/prompts`. Hover-prefetch keeps the click-to-paint experience snappy for operators who hover before clicking.

**Risk**: Touch users who tap directly will hit a cold route. Mitigation: 150ms hover debounce is short enough that most touch interactions still benefit if a finger hovers briefly. Also see S1-T2 — removing `force-dynamic` makes cold navigations cheap.

#### S1-T2 Remove `force-dynamic` selectively
**Files**: 42 occurrences across `src/app/**/page.tsx` and `src/app/api/**/route.ts`.

**Audit categorization**:

| Keep `force-dynamic` (must be live) | Remove (default caching is fine) |
|--|--|
| `/admin/diagnostics` (live stuck-task feed) | `/products`, `/products/[id]`, `/products/new` |
| `/api/admin/diagnostics/*` | `/prompts`, `/prompts/[id]`, `/prompts/[id]/history` |
| `/api/admin/recovery/mark-failed` | `/share`, `/share/[platform]` |
| `/api/products/bulk-import/*` | `/drive` |
| `/api/share/generation-status` | `/settings`, `/settings/*` |
| `/api/operator/activity-feed` | `/dashboard` (see note) |
| `/api/prompts/[id]/generate` | `/controller`, `/outputs` |
| | `/tools/ai-media`, `/tools/ai-media/*` |
| | `/login` |

**Note on `/dashboard`**: KPI numbers update over time but operators tolerate 30-60s staleness (per the 2026-05-24 user input). Remove `force-dynamic` and rely on Next.js default revalidation. If operators report stale dashboards, add `export const revalidate = 30`.

**Implementation**: For each page in the "remove" column, delete the line `export const dynamic = "force-dynamic";`. No other behavior change.

**Why**: Without `force-dynamic`, Next.js can dedup concurrent RSC requests, Vercel CDN can cache HTML for the brief revalidation window, and the prefetch storm (if any survives S1-T1) becomes cheap.

**Risk**: Operators see slightly stale lists. Mutations already use server actions with `revalidatePath`/`revalidateTag` (verify — if not, the staleness can persist beyond the revalidation window). Mitigation: explicit verification step in S1-T6.

#### S1-T3 Lazy-load drawer and form components
**Files**:
- `src/app/prompts/prompt-detail-panel.tsx`
- `src/app/prompts/prompt-generate-form.tsx`
- `src/app/prompts/prompt-output-fields.tsx`
- `src/app/share/[platform]/share-detail-panel.tsx`
- `src/app/products/[id]/*` (large detail components)
- `src/app/tools/ai-media/*/page.tsx` (heavy form components)

**Implementation**: Convert the imports of these components inside their parent pages to `next/dynamic`:

```tsx
const PromptDetailPanel = dynamic(() => import("./prompt-detail-panel"), {
  loading: () => <PromptDetailPanelSkeleton />,
});
```

For `/products/new` (91KB unused JS) audit which sub-components are bundled but not rendered on the initial step — those are the lazy candidates.

**Why**: Cuts initial JS bundle. The 71KB shared chunk includes drawers/forms that are only shown after user interaction.

**Risk**: First open of a drawer waits ~50-150ms for the chunk. Mitigation: prefer `prefetch` on hover of the trigger button. Skeleton appears immediately so perceived delay is small.

#### S1-T4 Suspense streaming on the heaviest pages
**Files**:
- `src/app/prompts/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/products/new/page.tsx`
- `src/app/tools/ai-media/page.tsx`

**Implementation**: For each page, identify the data-loading section (list, KPI grid) and wrap it in `<Suspense fallback={<Skeleton />}>`. The page shell (header, toolbar, nav) renders immediately and streams the data section.

```tsx
return (
  <PageShell>
    <PageHeader />
    <Suspense fallback={<PromptListSkeleton />}>
      <PromptList />
    </Suspense>
  </PageShell>
);
```

**Why**: TBT 2613ms on `/prompts` correlates with hydration of one giant tree. Splitting via Suspense narrows the blocking window — shell hydrates first, list streams.

**Risk**: Skeleton flicker for fast loads. The pattern is already used in `/share`, so we know it looks acceptable.

#### S1-T5 Verify and re-benchmark
**Implementation**:
1. `npm run typecheck && npm run lint && npm run build`
2. `npm run smoke:e2e`
3. Re-run `node scripts/benchmark/run-lighthouse.mjs` (with same env conditions)
4. Compare against baseline `scripts/benchmark/results/2026-05-25T23-23-09/summary.md`
5. Visual smoke check at 360/768/1024/1280px on `/prompts`, `/dashboard`, `/products/new`, `/tools/ai-media`

**Acceptance criteria**:
- Average Lighthouse score ≥ 85
- TBT on `/prompts` ≤ 300ms
- No e2e regressions
- No visual regressions
- All builds green

If criteria pass: Sprint 1 complete, decide whether Sprint 2 is needed.
If criteria fail: profile remaining issues, decide whether Sprint 2 (Cache Components) addresses them.

#### S1-T6 Verify mutation invalidation still works
**Implementation**: Quick audit of every server action that mutates data on routes where we removed `force-dynamic`:
- `src/app/products/actions.ts`
- `src/app/prompts/actions.ts`
- `src/app/share/[platform]/actions.ts`
- `src/app/drive/*` actions
- `src/app/settings/*/actions.ts`

Each mutating action must call `revalidatePath` or `revalidateTag` on the relevant route. Document any that don't and add them.

**Why**: Without `force-dynamic`, stale data lingers until something invalidates the cache. Mutations are the only correct invalidation point.

### What we explicitly do NOT do in Sprint 1
- ❌ Cache Components (`use cache`, `cacheTag`) — defer to Sprint 2.
- ❌ DB-backed pagination for in-memory lists — defer.
- ❌ Refactor data layer — defer.
- ❌ Aggressive bundle splitting beyond drawers — defer.
- ❌ Fix login redirect chain (low impact, ~230ms).
- ❌ Reduce CSS chunks — let Turbopack handle it; not a hot path.
- ❌ Image optimization — only 1 image >50KB found.

### Sprint 1 isolation strategy
Work happens on a new branch `perf/sprint-1-quick-wins` cut from `main`. The existing `worktree-perf-page-load-cache` branch is left untouched in case Sprint 2 needs it. All work is reviewable as a single PR.

## Sprint 2 — Cache Components (conditional, target: 1-2 weeks)

Triggered only if Sprint 1 acceptance criteria fail OR specific routes still feel sluggish.

### Inputs to Sprint 2 decision
- Re-benchmark numbers from S1-T5
- User subjective feedback after Sprint 1 deploy
- Specific route(s) still flagged as slow

### Scope (cherry-pick from 2026-05-24 plan)
1. Enable Cache Components in `next.config.ts` (currently absent — needs creation)
2. `userCacheTag` for per-user RLS-respecting cache keys
3. Migrate top-3 worst remaining routes to cached read loaders
4. Drawer-level Suspense sections (already started in S1-T4 but stricter)
5. DB-backed search/filter/pagination for routes with >50 rows in memory

### What we still skip
- Whole-codebase migration to Cache Components. Only the routes that need it.
- The shell-context streaming work (it's already fast in benchmark).

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|--|--|--|--|
| Stale data after `force-dynamic` removal | Med | Med | S1-T6 mutation audit; bias to keep `force-dynamic` if uncertain |
| RSC prefetch removal hurts perceived speed | Low | Low | Hover-prefetch (150ms debounce) covers desktop operators; cold nav becomes cheap with default caching |
| Lazy-loaded drawer feels janky | Low | Low | Skeleton renders instantly; chunk is small; prefetch on hover of trigger button |
| Suspense skeleton flicker | Low | Low | Pattern already used elsewhere with operator approval |
| Sprint 1 doesn't move the needle enough | Low-Med | Med | Acceptance criteria force a re-benchmark; Sprint 2 is the planned escalation |

## Test plan

### Automated
- `npm run typecheck` — must pass
- `npm run lint` — must pass
- `npm run build` — must pass
- `npm run smoke:e2e` — must pass
- Lighthouse benchmark via `scripts/benchmark/run-lighthouse.mjs` — compare against baseline

### Manual
- Visual smoke at 4 breakpoints (360/768/1024/1280) on each modified page
- Click-through operator flow: intake → metadata → prompt → share — measure perceived speed subjectively
- Verify no regression in dashboard KPI freshness, prompt list filter, share generation status

## Deliverables

1. Branch `perf/sprint-1-quick-wins` with 6 logical commits (one per S1-Tx)
2. Updated benchmark script results at `scripts/benchmark/results/<post-sprint-timestamp>/`
3. Comparison report at `scripts/benchmark/results/<timestamp>/COMPARISON.md`
4. Single PR with summary of changes, before/after metrics table, and Sprint 2 recommendation
5. CHANGELOG entry under today's date

## Open questions for the operator
None — proceeding with operator approval recorded in brainstorming session.

## References
- Baseline: `scripts/benchmark/results/2026-05-25T23-23-09/`
- Findings: `scripts/benchmark/results/2026-05-25T23-23-09/FINDINGS.md`
- 2026-05-24 plan (deferred): `docs/superpowers/plans/2026-05-24-page-load-performance.md`
- Memory: `team/page-load-performance-refactor.md`
