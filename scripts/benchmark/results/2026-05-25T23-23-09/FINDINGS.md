# Performance Benchmark Findings — 2026-05-25

**Origin:** https://banplex.my.id (production, Vercel deploy)
**Method:** Lighthouse CI desktop (RTT 40ms, 10Mbps, cpu 1x), authenticated with operator account
**Raw results:** `scripts/benchmark/results/2026-05-25T23-23-09/`

## Lighthouse Score Table

| # | Page | Score | LCP | FCP | TBT | SI | TTFB | Transfer | Reqs | UnusedJS |
|---|------|------:|----:|----:|----:|---:|-----:|---------:|-----:|---------:|
| 01 | /dashboard | **64** | 1238ms | 807ms | **614ms** | 3624ms | 21ms | 499KB | 47 | 27KB |
| 02 | /products | **92** | 1110ms | 802ms | 20ms | 2372ms | 21ms | 753KB | 97 | 26KB |
| 03 | /prompts | **53** | **1805ms** | 854ms | **2613ms** | 3765ms | 20ms | 542KB | 74 | 24KB |
| 04 | /share | **87** | 856ms | 556ms | 224ms | 2207ms | 21ms | 486KB | 51 | 27KB |
| 05 | /drive | **83** | 819ms | 593ms | 259ms | 2763ms | 21ms | 491KB | 40 | 26KB |
| 06 | /settings | **93** | 1031ms | 751ms | 5ms | 2312ms | 20ms | 487KB | 50 | 26KB |
| 07 | /admin/diagnostics | **96** | 786ms | 558ms | 47ms | 1810ms | 21ms | 479KB | 41 | 27KB |
| 08 | /products/new | **63** | 1203ms | 597ms | **717ms** | 3586ms | 21ms | 550KB | 42 | 91KB |
| 09 | /login | **94** | 877ms | 580ms | 120ms | 1981ms | 22ms | 493KB | 48 | 27KB |
| 10 | /tools/ai-media | **63** | 1059ms | 638ms | **767ms** | 3393ms | 19ms | 525KB | 58 | 27KB |

**Critical observations**
- TTFB ~20ms across the board → server response itself is fast. Bottleneck is NOT the database. The bottleneck is **client-side** (JS bootup + RSC prefetches + main-thread blocking).
- 4 pages have TBT > 600ms: dashboard, prompts, products/new, tools/ai-media. These have heavy client components.
- /prompts is catastrophic: 1.8s LCP, 2.6s TBT, 5s TTI. Long-task profile shows 16 long tasks with the worst attributed to `/prompts` document itself (1027ms, 894ms) — meaning hydration of a single big page tree.

## Root Causes

### 1. RSC prefetch storm
`/prompts` made **33 fetch requests to its own URL** during the trace. Cause: Next.js `<Link>` components prefetch RSC payload on hover/visible — but with `force-dynamic` everywhere, every prefetch hits the server with full SSR work. Network panel shows 47 total fetches; 33 are duplicate `/prompts` RSC fragments triggered by other links rendered on the page.

### 2. `force-dynamic` on every page (42 occurrences)
Confirmed via `Grep`. Every page sets `export const dynamic = "force-dynamic"`. Result:
- No caching at the route level
- Every navigation = fresh SSR + serialize + ship to client + hydrate
- Vercel CDN cannot cache the HTML shell

### 3. Hydration of large client trees
- /prompts: 5092ms bootup attributed to the page itself, 16 long tasks
- /tools/ai-media: 985ms bootup, 13 long tasks
- /products/new: 1334ms bootup, 11 long tasks, 91KB unused JS
- /dashboard: 1577ms unattributable (third-party or Geist runtime)

### 4. CSS chunk fragmentation
- 4 CSS chunks per page = 4 RTTs in worst case (none render-blocking but pop into the network waterfall)
- `globals.css` is the only entry but Turbopack splits per route

### 5. Bundle reuse
- The `0v9c2uadhpd-i.js` chunk (71KB, 758-1161ms bootup) is loaded on EVERY page → likely the operator shell + Supabase client + form libs
- 27KB unused JS per page = some shell components are bundled but never rendered

### 6. Login redirect penalty
All authenticated pages have a "Avoid multiple page redirects" opportunity worth ~230-280ms. Cause: middleware does 307 to `/login` then `/login` redirects after auth. Cold navigation for unauthenticated users wastes a roundtrip.

## What's NOT the problem
- Database/Supabase queries: TTFB is 20ms across all routes
- Server compute: SSR is fast
- Image weight: only 1 image >50KB on /prompts
- Network bandwidth: total transfer 479-753KB, well within budget
- CLS: 0 across the board (no layout shifts)

## Conclusion
The app is **client-heavy, not server-heavy**. The user's perception of "lambat dan tidak responsif" is consistent with:
1. Long TBT (~600-2600ms) → main thread frozen during hydration → clicks feel unresponsive
2. RSC prefetch waterfall on every nav → fast interactions trigger many parallel SSRs
3. No route-level caching → every page is fresh from origin even if data is identical

Server-side optimization (the 2026-05-24 plan) is still relevant but secondary. The dominant fix vector is client-side: reduce JS, remove `force-dynamic`, gate prefetch.
