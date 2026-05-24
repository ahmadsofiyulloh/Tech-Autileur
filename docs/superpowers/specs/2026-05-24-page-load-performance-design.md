# Page Load Performance Refactor Design

## Micro-task

Page load performance refactor for the Affiliate AI Content OS Next.js App Router application using a Progressive Cached Read Architecture.

## Goal

Improve perceived and actual page-load performance across the app. Today every primary page feels heavy even with little data because the app:

- renders almost everything as fully dynamic,
- repeats Supabase auth lookups,
- waits for root shell data before route content can stream,
- runs multi-step server query waterfalls inside pages,
- loads full datasets and filters/paginates in memory.

This refactor moves the app to a Next.js 16 Cache Components architecture with DB-backed list reads, per-user tagged caches, and Suspense-streamed drawers. The user accepts 30-60 seconds of stale data when mutations correctly invalidate tags.

## Source-of-truth constraints

- Preserve the MVP architecture: Next.js PWA, Supabase Auth/Postgres, Google Drive as asset source of truth.
- Keep the single-owner/operator model and RLS assumptions.
- Do not add a service worker or offline cache engine.
- Do not introduce new dependencies.
- Do not change route locks, navigation labels, or Phase 1 UI constraints.
- Keep secrets and external API calls server-only.
- Fire-and-forget/background workers must not use request-scoped helpers such as `cookies()` or `revalidatePath()`.

## Current findings

1. Most active routes export `dynamic = "force-dynamic"`, so every navigation requires request-time rendering and Supabase calls.
2. `src/app/layout.tsx` waits for `getOperatorShellContext()` before rendering the app shell and children.
3. `supabase.auth.getUser()` is called in root layout, page components, and server loaders for the same request.
4. `src/app/prompts/page.tsx` performs query waterfalls after its initial `Promise.all`.
5. `src/lib/server/product-list.ts` loads all products and related rows, then filters and paginates in memory.
6. There is no `use cache`, `cacheTag`, `cacheLife`, `React.cache`, or structured data invalidation layer.
7. Drawer detail content blocks the same page render path as the list, making list navigation feel slow when detail data is heavy.
8. Thumbnail/Drive preview hydration runs during server render without a short-lived cache.

## Target architecture: Progressive Cached Read Architecture

The app should feel like an operator workbench where navigation is always fast, data may stream in, and writes are gated by readiness rather than by full-page loads.

### Layer 1 - App shell

- Root layout renders the shell instantly: topbar, bottom nav/sidebar, theme.
- Root layout does not block route children on heavy data.
- Profile/avatar/operator context loads in a Suspense island.
- Shell context cached per user with tag `user:<id>:shell`.

### Layer 2 - Route frame

- Page title, toolbar, search form, filter tabs, and pagination frame render from synchronous server code.
- Search params are normalized in the page component, then passed as serializable arguments to cached loaders.
- All async data sections live behind Suspense.

### Layer 3 - Cached DB-backed list read model

- Per-user tagged cache with `cacheLife({ stale: 30, revalidate: 60, expire: 300 })`.
- Pagination, filtering, sorting, and search execute in Postgres, not in JavaScript.
- List loaders return only the columns required to render visible rows.
- Relation loads are scoped to row ids on the visible page.
- Optional Postgres views can be added later as a clean read model surface.

### Layer 4 - Drawer streaming

- Drawer frame opens immediately when `?detail=` (or equivalent) is present.
- Drawer header uses fields already known from the list row when available.
- Each drawer tab/section is its own Suspense boundary with its own skeleton.
- Write actions inside the drawer are disabled until the data they depend on has loaded.
- Closing the drawer never blocks list navigation.

### Layer 5 - Dynamic islands

Keep these dynamic, with no caching:

- Auth/session checks at the route entry.
- Server actions and write paths.
- Queue/task monitors that already poll.
- Anything else that must reflect real-time state.

## Configuration

Enable Cache Components in `next.config.mjs`:

```js
const nextConfig = {
  cacheComponents: true,
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};
```

Do not use legacy `experimental.ppr`.

## Cache tag helper

Add a small server utility such as `src/lib/server/cache-tags.ts`:

```ts
export type UserCacheDomain =
  | "shell"
  | "dashboard"
  | "products"
  | "prompts"
  | "settings"
  | "drive"
  | "share"
  | "ai-media";

export function userCacheTag(userId: string, domain: UserCacheDomain) {
  return `user:${userId}:${domain}`;
}
```

Cached loaders must:

- accept `userId` as a serializable argument,
- accept normalized query arguments (search, filter, page, etc.),
- not call `cookies()`, `headers()`, `searchParams`, or `auth.getUser()` inside the cached body.

## Cache life

Use a short profile for operator data:

```ts
cacheLife({ stale: 30, revalidate: 60, expire: 300 });
```

Static/structural content (filter tab definitions, copy, route shells) can rely on default static behavior.

## Architecture design

### Auth dedupe

Introduce request-scoped auth helpers using React `cache()`:

- `getCurrentUser()` returns the Supabase user or `null`.
- `requireCurrentUser()` redirects or throws consistently at the page boundary.
- Page components pass `user.id` into server loaders; loaders stop calling `auth.getUser()` when the page already has `userId`.

### Root layout and app shell

- Keep theme cookie handling in `src/app/layout.tsx`.
- Keep `<AppShell>` as the global shell component.
- Move slow profile/avatar context into an async Suspense island.
- Provide a neutral profile fallback that preserves locked topbar controls (Notifications + Profile avatar menu) without duplicating Settings.
- Cache operator shell context with `cacheTag(userCacheTag(userId, "shell"))`.

### Cached data loaders

Use function-level `use cache` on stable server loaders. Example:

```ts
export async function listProductListPageForUser(
  userId: string,
  input: NormalizedProductListInput,
) {
  "use cache";
  cacheTag(userCacheTag(userId, "products"));
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  const supabase = await createSupabaseServerClient();
  // Pagination/filter/search executed in Postgres against userId.
}
```

If a loader needs runtime request state, split it into:

1. an uncached wrapper that reads runtime state,
2. a cached inner function that only receives serializable arguments.

### Suspense boundaries

Add Suspense boundaries around:

- Root shell profile context.
- Dashboard panels that do not need to block each other.
- Prompt queue snapshot/drawer.
- Product/prompt detail drawer content.
- Drive thumbnails when they slow down list rendering.

Keep existing `loading.tsx`, empty states, and error states. Add minimal skeletons only where needed.

## DB-backed list reads

Move list pagination/filter/search into Postgres for high-traffic routes:

- `/products`
- `/prompts`
- `/share/[platform]`

Rules:

- Query only the columns required to render the visible page.
- Compute counts via DB count or lightweight aggregates instead of in-memory length.
- Resolve relations only for the visible row set, not the full owner data.
- Keep RLS on; loaders always filter by `userId` (and `workspaceId` where applicable).
- Maintain the current contract types where possible to limit UI churn.

Optional later step (not required for Pass 2): introduce read-only Postgres views such as `product_list_view` and `prompt_workbench_view` to centralize list projection.

## Drawer streaming

Apply to product, prompt, share, and Drive drawers.

- Render the drawer frame as soon as `?detail=` (or equivalent) is in the URL.
- Reuse list-row data for the header (title, status badge, primary metadata) where available.
- Wrap each drawer section/tab in its own Suspense boundary.
- Each section has its own loading skeleton and its own error state.
- Disable write actions until the required section is ready.
- Closing the drawer must never reload the list.

## Page migration order

### Pass 1 - Global foundation

1. Enable Cache Components.
2. Add cache tag helper.
3. Add request-scoped auth helper using React `cache()`.
4. Refactor `getOperatorShellContext` to accept `userId` and use a tagged cache.
5. Adjust `AppShell` to tolerate a neutral/fallback shell context while async context streams.

### Pass 2 - High-impact routes

1. `/products`
   - DB-backed pagination/search/filter via `listProductListPageForUser(userId, normalizedArgs)`.
   - Tag as `products`.
   - Drawer split into Suspense sections (Metadata, Output, History).
   - Remove duplicate auth inside loader.

2. `/prompts`
   - Cached workbench loaders keyed by `userId`, `workspaceId`, readiness/search/page.
   - DB-backed projection for the visible page, with relation hydration scoped to visible rows.
   - Queue snapshot moved into a Suspense island.
   - Drawer split into Suspense sections (Output, Regenerate, History).

3. `/dashboard`
   - Cache `getDashboardViewModel(userId)` under `dashboard`.
   - Split panels with Suspense if any panel remains slower than the rest.

4. `/settings`
   - Cache settings overview data under `settings`.
   - Invalidate `settings` and `shell` when affiliate profile or account display data changes.

### Pass 3 - Secondary routes

Apply the same architecture to `/drive`, `/products/new`, `/share/[platform]`, detail pages, and AI Media Lab routes as separate scoped follow-up work.

## Mutation invalidation design

Use `revalidateTag` or `updateTag` from `next/cache` in request-scoped server actions after successful mutations.

- Products actions: invalidate `products`; also invalidate `dashboard` when pipeline metrics can change.
- Prompts actions: invalidate `prompts`; also invalidate `dashboard` when queue/action counts can change.
- Intake actions: invalidate `products`, `prompts`, and `dashboard`.
- Settings Gemini/profile/account/Magnific actions: invalidate `settings`; invalidate `shell` when profile/avatar/account display can change.
- Drive actions: invalidate `drive`; invalidate `products` or `prompts` only if Drive metadata affects visible thumbnails or prompt readiness.
- Share actions: invalidate `share`; invalidate `prompts` if prompt-pack/share state changes.
- AI Media Lab actions: invalidate `ai-media` and `dashboard` if usage/action counts change.

Rules:

- Use `updateTag` only when the same request needs immediate read-after-write consistency.
- Prefer `revalidateTag` for normal stale-while-revalidate behavior.
- Background workers must not call request-scoped invalidation helpers; they rely on bounded cache expiry, existing polling, or invalidation from the user-initiated action that started the work.

## Write safety while data streams

Because list and drawer sections may render before all data is ready:

- Write actions that depend on a specific drawer section stay disabled until that section reports ready.
- Forms that depend on stale data show a small "data sedang diperbarui" cue when they detect stale-while-revalidate.
- Mutations always send full payloads and validate against current DB state server-side; the server is the source of truth, not the client cache.

## Out of scope

- Adding new dependencies.
- Adding Redis, KV, service workers, or offline caching.
- Schema changes beyond optional read-only views (deferred).
- Broad UI redesign.
- Changing route locks or navigation structure.

## Follow-up opportunities

After the Cache Components pass is stable:

1. Introduce Postgres read-only views (`product_list_view`, `prompt_workbench_view`, `share_caption_list_view`) to centralize list projection.
2. Add lightweight per-route performance probes in development to log loader timing.
3. Review image/thumbnail preview strategy for cacheable signed/transient URLs.
4. Split very large page modules into smaller server and client components for maintainability.
5. Reassess any remaining `force-dynamic` routes for partial migration.

## Verification plan

Run after implementation:

```bash
npm run lint
npm run typecheck
npm run build
npm run smoke:e2e
```

Manual verification:

- Build does not fail from `cookies()`, `headers()`, or `searchParams` inside `use cache` functions.
- Main routes show shell + skeleton instantly on navigation.
- Drawer opens before its detail data finishes loading; sections stream individually.
- Mutations refresh affected data within the accepted 30-60 second stale window.
- App shell preserves topbar controls and does not duplicate Settings.
- No secrets are exposed to client components.

## Acceptance criteria

- Cache Components enabled.
- Auth lookup deduped per request.
- Root shell renders without waiting for full operator profile context.
- High-impact loaders for shell, products, prompts, dashboard, and settings use per-user tagged cache where safe.
- `/products`, `/prompts`, and `/share/[platform]` perform pagination/search/filter in Postgres for the visible page.
- Drawer detail sections stream independently with their own skeletons.
- Domain mutations invalidate relevant cache tags.
- `force-dynamic` removed from migrated routes unless a route has a documented request-time requirement.
- Validation commands pass or failures are documented with cause and relation to the task.
