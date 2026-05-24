# Page Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve perceived and actual page-load performance by enabling Next.js Cache Components, deduping auth, streaming the app shell and drawers, and moving high-impact list reads to DB-backed cached loaders.

**Architecture:** Implement the Progressive Cached Read Architecture from `docs/superpowers/specs/2026-05-24-page-load-performance-design.md` in three testable passes. Pass 1 adds global cache/auth/shell foundations; Pass 2 migrates products, prompts, dashboard, and settings; Pass 3 migrates share and remaining secondary route read paths without introducing new dependencies or changing route locks.

**Tech Stack:** Next.js 16 App Router, React 19 `cache()`, Next Cache Components (`use cache`, `cacheTag`, `cacheLife`, `revalidateTag`), Supabase SSR/Postgres, TypeScript strict.

---

## Scope and sequencing

This plan is intentionally split into independently verifiable tasks. Do not implement all route migrations in one edit. Complete and verify each task before moving to the next.

Out of scope:
- New dependencies.
- Service workers, Redis/KV, offline cache engines.
- Route/nav label changes.
- Schema changes or Postgres views.
- Broad UI redesign beyond skeleton/Suspense boundaries needed for streaming.

Required docs to keep open while implementing:
- `AGENTS.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/superpowers/specs/2026-05-24-page-load-performance-design.md`
- `docs/DO_NOT_BUILD.md`
- `docs/MICRO_TASK_BACKLOG.md`

---

## File structure map

### New files

- `src/lib/server/cache-tags.ts`
  - Owns cache tag domain names and the `userCacheTag(userId, domain)` helper.
  - Must not import Supabase, cookies, headers, or route state.

- `src/lib/server/auth.ts`
  - Owns request-scoped auth dedupe via React `cache()`.
  - Exposes `getCurrentUser()` and `requireCurrentUser()`.
  - This file may call `createSupabaseServerClient()` and `redirect()` because it is not used inside `use cache` functions.

- `src/components/operator/shell-context-loader.tsx`
  - Server component Suspense island that loads cached shell context.
  - Renders a small client bridge when context is available.

- `src/components/operator/shell-context-bridge.tsx`
  - Client component that delivers async shell context to `AppShell` without blocking children.
  - Keeps topbar controls present while profile/avatar context streams.

- `src/app/products/product-list-section.tsx`
  - Server component for cached products list data behind Suspense.
  - Keeps route frame synchronous in `src/app/products/page.tsx`.

- `src/app/products/product-detail-drawer-section.tsx`
  - Server component for product drawer content behind Suspense.
  - Drawer frame opens immediately from `?detail=`.

- `src/app/prompts/prompt-workbench-section.tsx`
  - Server component for cached prompt workbench rows behind Suspense.

- `src/app/prompts/prompt-detail-drawer-section.tsx`
  - Server component for prompt drawer content behind Suspense.

- `src/app/share/[platform]/share-list-section.tsx`
  - Server component for cached share list rows behind Suspense.

- `src/app/share/[platform]/share-detail-drawer-section.tsx`
  - Server component for share drawer content behind Suspense.

### Modified files

- `next.config.mjs`
  - Add `cacheComponents: true`.

- `src/app/layout.tsx`
  - Stop awaiting `getOperatorShellContext()` in root layout.
  - Wrap shell profile context in Suspense.

- `src/components/app-shell.tsx`
  - Accept neutral fallback shell context by default.
  - Allow shell context to be updated by a client bridge after streamed data resolves.

- `src/lib/server/operator-shell.ts`
  - Split into `getOperatorShellContextForUser(userId)` cached inner function and uncached wrapper if still needed.
  - Tag as `user:<id>:shell`.

- `src/lib/server/product-list.ts`
  - Add `listProductListPageForUser(userId, input)` with `use cache`.
  - Move pagination/search/filter into Supabase/Postgres query for visible products.
  - Keep old `listProductListPage()` as an uncached compatibility wrapper only if needed by existing callers during migration.

- `src/app/products/page.tsx`
  - Remove `dynamic = "force-dynamic"` if build permits.
  - Use `requireCurrentUser()` once.
  - Normalize search params synchronously, render route frame, then stream list/detail sections.

- `src/app/prompts/page.tsx`
  - Remove duplicate auth calls where possible.
  - Move queue/list/detail data into Suspense sections.
  - Replace query waterfalls with visible-page scoped loaders.

- `src/lib/server/prompt-workbench.ts`
  - Add cached prompt workbench loader keyed by `userId`, workspace/profile/readiness/search/page.

- `src/app/dashboard/page.tsx`
  - Use `requireCurrentUser()`.
  - Cache `getDashboardViewModelForUser(userId)` under `dashboard`.

- `src/lib/server/dashboard-view-model.ts`
  - Add cached inner view-model function tagged as `dashboard`.

- `src/app/settings/page.tsx`
  - Use cached overview data under `settings`.

- `src/app/products/actions.ts`, `src/app/prompts/actions.ts`, `src/app/intake/actions.ts`, `src/app/settings/actions.ts`, `src/app/gemini/actions.ts`, `src/app/drive/actions.ts`, `src/app/share/[platform]/actions.ts`, `src/app/tools/ai-media/actions.ts`
  - Add `revalidateTag(userCacheTag(userId, domain))` or `updateTag()` after successful user-initiated mutations only.
  - Do not add request-scoped invalidation calls to background workers.

---

## Task 1: Enable Cache Components and cache tag helper

**Files:**
- Modify: `next.config.mjs:25-32`
- Create: `src/lib/server/cache-tags.ts`

- [ ] **Step 1: Update Next.js config**

Change `next.config.mjs` so `nextConfig` includes Cache Components:

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

- [ ] **Step 2: Add cache tag utility**

Create `src/lib/server/cache-tags.ts`:

```ts
import "server-only";

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

- [ ] **Step 3: Run focused validation**

Run:

```bash
npm run typecheck
```

Expected: TypeScript passes. If it fails, fix only errors introduced by this task.

- [ ] **Step 4: Commit if requested by user**

Do not commit unless explicitly requested. If requested:

```bash
git add next.config.mjs src/lib/server/cache-tags.ts
git commit -m "feat(perf): enable cache components"
```

---

## Task 2: Add request-scoped auth helpers

**Files:**
- Create: `src/lib/server/auth.ts`
- Later consumers: `src/app/products/page.tsx`, `src/app/prompts/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/settings/page.tsx`

- [ ] **Step 1: Create deduped auth helper**

Create `src/lib/server/auth.ts`:

```ts
import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
```

- [ ] **Step 2: Verify imports compile**

Run:

```bash
npm run typecheck
```

Expected: PASS. If TypeScript reports the `User` type import is invalid for the installed Supabase version, replace it with:

```ts
import type { User } from "@supabase/auth-js";
```

and rerun typecheck.

---

## Task 3: Stream app shell profile context

**Files:**
- Modify: `src/lib/server/operator-shell.ts:10-50`
- Modify: `src/app/layout.tsx:1-200`
- Modify: `src/components/app-shell.tsx:1-240`
- Create: `src/components/operator/shell-context-loader.tsx`
- Create: `src/components/operator/shell-context-bridge.tsx`

- [ ] **Step 1: Cache shell context by user**

Replace `src/lib/server/operator-shell.ts` with this structure while preserving the existing query behavior:

```ts
import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultAffiliateProfileForWorkspace } from "@/lib/server/affiliate-profiles";
import { resolveAffiliateProfileAvatar } from "@/lib/server/affiliate-profile-avatars";
import { userCacheTag } from "@/lib/server/cache-tags";
import { listDriveItemsByIds } from "@/lib/server/drive-items";
import { getWorkspaceSelectionState } from "@/lib/server/workspaces";
import type { OperatorShellContext } from "@/components/operator/operator-shell-context";

export const EMPTY_OPERATOR_SHELL_CONTEXT: OperatorShellContext = {
  currentAffiliateProfile: null,
};

export async function getOperatorShellContextForUser(userId: string): Promise<OperatorShellContext> {
  "use cache";
  cacheTag(userCacheTag(userId, "shell"));
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  try {
    const workspaceState = await getWorkspaceSelectionState();
    const workspaceId = workspaceState.currentWorkspace?.id ?? null;

    if (!workspaceId) {
      return EMPTY_OPERATOR_SHELL_CONTEXT;
    }

    const currentAffiliateProfile = await getDefaultAffiliateProfileForWorkspace(workspaceId);

    if (!currentAffiliateProfile) {
      return EMPTY_OPERATOR_SHELL_CONTEXT;
    }

    const driveItems = (await listDriveItemsByIds([
      currentAffiliateProfile.seed_character_drive_item_ref_id,
      currentAffiliateProfile.environment_drive_item_ref_id,
    ])).filter((item) => item.status !== "ARCHIVED");
    const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));

    return {
      currentAffiliateProfile: {
        id: currentAffiliateProfile.id,
        profileName: currentAffiliateProfile.profile_name,
        avatarUrl: resolveAffiliateProfileAvatar(currentAffiliateProfile, driveItemMap),
      },
    };
  } catch {
    return EMPTY_OPERATOR_SHELL_CONTEXT;
  }
}

export async function getOperatorShellContext(): Promise<OperatorShellContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return EMPTY_OPERATOR_SHELL_CONTEXT;
  }

  return getOperatorShellContextForUser(user.id);
}
```

If build later rejects request-scoped helpers inside `use cache` because `getWorkspaceSelectionState()` reads cookies, split workspace lookup outside this cached function in Task 3 Step 1b:

```ts
export async function getOperatorShellContextForUserWorkspace(
  userId: string,
  workspaceId: string | null,
): Promise<OperatorShellContext> {
  "use cache";
  cacheTag(userCacheTag(userId, "shell"));
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  // same body, but use workspaceId argument instead of getWorkspaceSelectionState()
}
```

- [ ] **Step 2: Add client bridge**

Create `src/components/operator/shell-context-bridge.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import type { OperatorShellContext } from "@/components/operator/operator-shell-context";

export function ShellContextBridge({
  onResolve,
  shellContext,
}: {
  onResolve: (shellContext: OperatorShellContext) => void;
  shellContext: OperatorShellContext;
}) {
  useEffect(() => {
    onResolve(shellContext);
  }, [onResolve, shellContext]);

  return null;
}
```

- [ ] **Step 3: Add server loader island**

Create `src/components/operator/shell-context-loader.tsx`:

```tsx
import { ShellContextBridge } from "@/components/operator/shell-context-bridge";
import { getOperatorShellContextForUser } from "@/lib/server/operator-shell";
import type { OperatorShellContext } from "@/components/operator/operator-shell-context";

export async function ShellContextLoader({
  onResolve,
  userId,
}: {
  onResolve: (shellContext: OperatorShellContext) => void;
  userId: string;
}) {
  const shellContext = await getOperatorShellContextForUser(userId);

  return <ShellContextBridge onResolve={onResolve} shellContext={shellContext} />;
}
```

If TypeScript rejects passing a client callback into a server component, use the alternative in Step 4 instead: keep the Suspense boundary outside `AppShell` and pass the async content as `shellContextSlot` prop.

- [ ] **Step 4: Update `AppShell` to keep fallback context state**

In `src/components/app-shell.tsx`, update imports:

```tsx
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ShellContextLoader } from "@/components/operator/shell-context-loader";
```

Update `AppShell` props:

```tsx
export function AppShell({
  children,
  initialShellContext,
  shellUserId,
  themePreference,
}: {
  children: ReactNode;
  initialShellContext: OperatorShellContext;
  shellUserId: string | null;
  themePreference: ThemePreference;
}) {
```

Update the private route render:

```tsx
return (
  <TopbarProvider>
    <OperatorShellContent
      initialShellContext={initialShellContext}
      shellUserId={shellUserId}
      themePreference={themePreference}
    >
      {children}
    </OperatorShellContent>
  </TopbarProvider>
);
```

Update `OperatorShellContent` props and state:

```tsx
function OperatorShellContent({
  children,
  initialShellContext,
  shellUserId,
  themePreference,
}: {
  children: ReactNode;
  initialShellContext: OperatorShellContext;
  shellUserId: string | null;
  themePreference: ThemePreference;
}) {
  const [shellContext, setShellContext] = useState(initialShellContext);
```

Render the Suspense island near the top of the shell root:

```tsx
<div className="operator-shell operator-shell--dense" data-sidebar-collapsed={isSidebarCollapsed ? "true" : undefined}>
  {shellUserId ? (
    <Suspense fallback={null}>
      <ShellContextLoader onResolve={setShellContext} userId={shellUserId} />
    </Suspense>
  ) : null}
```

If the server/client callback boundary fails, replace Steps 2-4 with a server-wrapper pattern:

```tsx
// src/components/operator/shell-context-slot.tsx
import { getOperatorShellContextForUser } from "@/lib/server/operator-shell";
import { TopbarGlobalControls } from "@/components/operator/topbar-global-controls";

export async function ShellContextTopbarSlot({ userId, themePreference }: { userId: string; themePreference: ThemePreference }) {
  const shellContext = await getOperatorShellContextForUser(userId);
  return (
    <TopbarGlobalControls
      currentAffiliateProfile={shellContext.currentAffiliateProfile}
      hideSettingsAction={false}
      themePreference={themePreference}
    />
  );
}
```

Then keep `AppShell` topbar fallback controls synchronously and stream only the profile menu slot.

- [ ] **Step 5: Update root layout**

In `src/app/layout.tsx`, replace:

```ts
const [cookieStore, shellContext] = await Promise.all([cookies(), getOperatorShellContext()]);
```

with:

```ts
const cookieStore = await cookies();
const shellUser = await getCurrentUser();
```

Add imports:

```ts
import { getCurrentUser } from "@/lib/server/auth";
import { EMPTY_OPERATOR_SHELL_CONTEXT } from "@/lib/server/operator-shell";
```

Replace the `AppShell` call:

```tsx
<AppShell
  initialShellContext={EMPTY_OPERATOR_SHELL_CONTEXT}
  shellUserId={shellUser?.id ?? null}
  themePreference={themePreference}
>
  {children}
</AppShell>
```

- [ ] **Step 6: Validate shell behavior**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Expected:
- Build does not fail due to `cookies()`, `headers()`, or auth inside a `use cache` function.
- Topbar still shows Notifications and Profile avatar menu fallback.
- `/settings` still does not show duplicate standalone Settings action.

---

## Task 4: Product list DB-backed cached read model

**Files:**
- Modify: `src/lib/server/product-list.ts:859-949`
- Modify: `src/app/products/page.tsx:1-153`
- Create: `src/app/products/product-list-section.tsx`

- [ ] **Step 1: Add cached loader signature**

In `src/lib/server/product-list.ts`, add a new exported function below the current helper functions:

```ts
export async function listProductListPageForUser(
  userId: string,
  input?: ProductListPageInput,
): Promise<ProductListPageResult> {
  "use cache";
  cacheTag(userCacheTag(userId, "products"));
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  return listProductListPageForUserUncached(userId, input);
}
```

Add imports:

```ts
import { cacheLife, cacheTag } from "next/cache";
import { userCacheTag } from "@/lib/server/cache-tags";
```

- [ ] **Step 2: Extract uncached implementation that accepts `userId`**

Rename the current body of `listProductListPage()` into:

```ts
async function listProductListPageForUserUncached(
  userId: string,
  input?: ProductListPageInput,
): Promise<ProductListPageResult> {
  const supabase = await createSupabaseServerClient();
  const filter = input?.filter ?? "all";
  const pageSize = Math.min(Math.max(input?.pageSize ?? PRODUCT_LIST_DESKTOP_PAGE_SIZE, 1), 50);
  const requestedPage = Math.max(input?.page ?? 1, 1);
  const search = (input?.search ?? "").trim().toLowerCase();

  // Replace loadAllProducts in Step 3.
}
```

Keep the compatibility wrapper:

```ts
export async function listProductListPage(input?: ProductListPageInput): Promise<ProductListPageResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return listProductListPageForUserUncached(user.id, input);
}
```

- [ ] **Step 3: Move visible product pagination to Postgres**

Inside `listProductListPageForUserUncached`, replace `loadAllProducts()` plus JS slicing with a Supabase query that only fetches visible product rows:

```ts
let productQuery = supabase
  .from("products")
  .select("id,user_id,workspace_id,product_name,brand_name,product_category,status,created_at,updated_at", {
    count: "exact",
  })
  .eq("user_id", userId);

if (input?.workspaceId) {
  productQuery = productQuery.eq("workspace_id", input.workspaceId);
}

if (search) {
  productQuery = productQuery.or(
    `product_name.ilike.%${search}%,brand_name.ilike.%${search}%,product_category.ilike.%${search}%`,
  );
}

const from = (requestedPage - 1) * pageSize;
const to = from + pageSize - 1;
const { data: visibleProducts, error: productsError, count } = await productQuery
  .order("updated_at", { ascending: false, nullsFirst: false })
  .order("created_at", { ascending: false })
  .range(from, to);

if (productsError) {
  throw productsError;
}

const products = visibleProducts ?? [];
const productIds = products.map((product) => product.id);
```

Then hydrate only visible rows:

```ts
const [workspaces, intakeSessions, promptPacks, contents] = await Promise.all([
  loadWorkspaces({ supabase, userId }),
  loadIntakeSessions({ supabase, userId, productIds }),
  loadPromptPacks({ supabase, userId, productIds }),
  loadContents({ supabase, userId, productIds }),
]);
```

Create pagination using DB count:

```ts
const pagination = createPaginationState({
  page: requestedPage,
  pageSize,
  totalCount: count ?? 0,
});
```

Keep `buildRows()` but do not sort/slice all rows in JavaScript. Only apply row-level filters that cannot yet be expressed in SQL to the visible page. If filter semantics require exact global counts, add a scoped follow-up task instead of reintroducing all-row loading.

- [ ] **Step 4: Add products list Suspense section**

Create `src/app/products/product-list-section.tsx`:

```tsx
import { Package, Plus } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { ErrorState } from "@/components/operator/error-state";
import { NativeLinkButton } from "@/components/ui/native-button";
import { PRODUCT_LIST_DESKTOP_PAGE_SIZE } from "@/lib/products/product-list-contract";
import { listProductListPageForUser } from "@/lib/server/product-list";
import { ProductList } from "./product-list";

export async function ProductListSection({
  affiliateProfileId,
  filter,
  page,
  search,
  showAllWorkspaces,
  uploadFilter,
  userId,
  workspaceId,
}: {
  affiliateProfileId: string | null;
  filter: Parameters<typeof ProductList>[0]["filter"];
  page: number;
  search: string;
  showAllWorkspaces: boolean;
  uploadFilter: Parameters<typeof ProductList>[0]["uploadFilter"];
  userId: string;
  workspaceId?: string;
}) {
  try {
    const productPage = await listProductListPageForUser(userId, {
      affiliateProfileId,
      filter,
      page,
      pageSize: PRODUCT_LIST_DESKTOP_PAGE_SIZE,
      search,
      showAllWorkspaces,
      uploadFilter,
      workspaceId,
    });

    const shouldShowList =
      productPage.totalProductCount > 0 ||
      search.length > 0 ||
      filter !== "all" ||
      Boolean(uploadFilter);

    if (!shouldShowList) {
      return (
        <EmptyState
          icon={Package}
          title="Belum ada produk."
          description="Mulai dari intake."
          action={
            <NativeLinkButton className="primary" href="/products/new">
              <Plus size={16} aria-hidden="true" />
              Intake baru
            </NativeLinkButton>
          }
        />
      );
    }

    return (
      <ProductList
        activeProductId={null}
        affiliateProfileId={affiliateProfileId}
        filter={filter}
        pagination={productPage.pagination}
        products={productPage.rows}
        search={search}
        showAllWorkspaces={showAllWorkspaces}
        uploadFilter={uploadFilter}
      />
    );
  } catch {
    return <ErrorState icon={Package} title="Produk tidak bisa dimuat." description="Coba lagi." />;
  }
}
```

Adjust the `activeProductId` prop to pass selected detail id from page if needed.

- [ ] **Step 5: Refactor products page to route frame + Suspense**

In `src/app/products/page.tsx`:
- Remove `export const dynamic = "force-dynamic"`.
- Replace direct Supabase auth with `const user = await requireCurrentUser();`.
- Keep search param normalization in the page.
- Render static frame immediately and wrap list in Suspense:

```tsx
<Suspense fallback={<div className="operator-list-skeleton" aria-label="Memuat produk" />}>
  <ProductListSection
    affiliateProfileId={requestedAffiliateProfileId}
    filter={requestedFilter}
    page={requestedPage}
    search={requestedSearch}
    showAllWorkspaces={showAllWorkspaces}
    uploadFilter={requestedUploadFilter}
    userId={user.id}
    workspaceId={currentWorkspace && !showAllWorkspaces ? currentWorkspace.id : undefined}
  />
</Suspense>
```

- [ ] **Step 6: Validate products migration**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Manual check:
- `/products` renders shell + list skeleton before product data.
- Search/page params still produce valid links.
- Product rows still show thumbnails/status enough for the current UI.

---

## Task 5: Product drawer streaming

**Files:**
- Modify: `src/app/products/page.tsx`
- Create: `src/app/products/product-detail-drawer-section.tsx`
- Modify as needed: `src/app/products/product-detail-panel.tsx`

- [ ] **Step 1: Create drawer section wrapper**

Create `src/app/products/product-detail-drawer-section.tsx`:

```tsx
import { ErrorState } from "@/components/operator/error-state";
import { Package } from "lucide-react";
import { ProductDetailPanel, resolveProductDetailTab } from "./product-detail-panel";

export function ProductDetailDrawerSkeleton() {
  return (
    <div className="operator-drawer-skeleton" aria-label="Memuat detail produk">
      <div className="operator-drawer-skeleton__line" />
      <div className="operator-drawer-skeleton__block" />
      <div className="operator-drawer-skeleton__block" />
    </div>
  );
}

export async function ProductDetailDrawerSection({
  detailHrefBase,
  productId,
  tab,
}: {
  detailHrefBase: string;
  productId: string;
  tab: string | undefined;
}) {
  try {
    return (
      <ProductDetailPanel
        activeTab={resolveProductDetailTab(tab)}
        detailHrefBase={detailHrefBase}
        productId={productId}
      />
    );
  } catch {
    return <ErrorState icon={Package} title="Detail produk tidak bisa dimuat." description="Coba lagi." />;
  }
}
```

- [ ] **Step 2: Wrap drawer content in Suspense**

In `src/app/products/page.tsx`, keep `OperatorDetailDrawer` rendered as soon as `selectedProductDetailId` exists. Replace direct `ProductDetailPanel` with:

```tsx
<Suspense fallback={<ProductDetailDrawerSkeleton />}>
  <ProductDetailDrawerSection
    detailHrefBase={productDetailHrefBase}
    productId={selectedProductDetailId}
    tab={firstParam(query.tab)}
  />
</Suspense>
```

- [ ] **Step 3: Validate drawer behavior**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Manual check:
- `/products?detail=<id>` opens drawer frame immediately.
- Detail content skeleton appears while data loads.
- Closing drawer returns to list without list reload requirement.

---

## Task 6: Prompt workbench cached route sections

**Files:**
- Modify: `src/app/prompts/page.tsx`
- Modify: `src/lib/server/prompt-workbench.ts`
- Create: `src/app/prompts/prompt-workbench-section.tsx`
- Create: `src/app/prompts/prompt-detail-drawer-section.tsx`

- [ ] **Step 1: Add cached prompt loader**

In `src/lib/server/prompt-workbench.ts`, add:

```ts
import { cacheLife, cacheTag } from "next/cache";
import { userCacheTag } from "@/lib/server/cache-tags";

export type PromptWorkbenchCachedInput = {
  affiliateProfileId: string | null;
  page: number;
  pageSize: number;
  readiness: string;
  search: string;
  workspaceId: string | null;
};

export async function getPromptWorkbenchPageForUser(
  userId: string,
  input: PromptWorkbenchCachedInput,
) {
  "use cache";
  cacheTag(userCacheTag(userId, "prompts"));
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  return getPromptWorkbenchPageForUserUncached(userId, input);
}
```

Then implement `getPromptWorkbenchPageForUserUncached()` by moving the existing prompt list query body out of `src/app/prompts/page.tsx`. The uncached function must:
- Accept only `userId` and serializable `input`.
- Query prompt packs/products for the visible page only.
- Hydrate relations only for visible prompt/product ids.
- Return the same row shape currently consumed by `PromptWorkbenchList`.

- [ ] **Step 2: Create prompt list section**

Create `src/app/prompts/prompt-workbench-section.tsx`:

```tsx
import { FileText } from "lucide-react";
import { ErrorState } from "@/components/operator/error-state";
import { getPromptWorkbenchPageForUser, type PromptWorkbenchCachedInput } from "@/lib/server/prompt-workbench";
import { PromptWorkbenchList } from "./prompt-workbench-list";

export async function PromptWorkbenchSection({
  activePromptId,
  input,
  userId,
}: {
  activePromptId: string | null;
  input: PromptWorkbenchCachedInput;
  userId: string;
}) {
  try {
    const workbench = await getPromptWorkbenchPageForUser(userId, input);

    return <PromptWorkbenchList activePromptId={activePromptId} workbench={workbench} />;
  } catch {
    return <ErrorState icon={FileText} title="Prompt tidak bisa dimuat." description="Coba lagi." />;
  }
}
```

If `PromptWorkbenchList` has a different prop contract, keep its current prop names and pass the returned workbench fields explicitly.

- [ ] **Step 3: Create prompt drawer section**

Create `src/app/prompts/prompt-detail-drawer-section.tsx`:

```tsx
import { FileText } from "lucide-react";
import { ErrorState } from "@/components/operator/error-state";
import { PromptDetailPanel } from "./prompt-detail-panel";

export function PromptDetailDrawerSkeleton() {
  return (
    <div className="operator-drawer-skeleton" aria-label="Memuat detail prompt">
      <div className="operator-drawer-skeleton__line" />
      <div className="operator-drawer-skeleton__block" />
      <div className="operator-drawer-skeleton__block" />
    </div>
  );
}

export async function PromptDetailDrawerSection({ promptPackId }: { promptPackId: string }) {
  try {
    return <PromptDetailPanel promptPackId={promptPackId} />;
  } catch {
    return <ErrorState icon={FileText} title="Detail prompt tidak bisa dimuat." description="Coba lagi." />;
  }
}
```

Adjust props to match the existing `PromptDetailPanel` signature after reading that component.

- [ ] **Step 4: Refactor prompts page**

In `src/app/prompts/page.tsx`:
- Remove `export const dynamic = "force-dynamic"` if present.
- Replace page-level duplicate auth with `requireCurrentUser()`.
- Normalize `searchParams` in the page.
- Render title/toolbar/filter frame synchronously.
- Wrap prompt list and queue snapshot in separate Suspense boundaries.
- Wrap detail drawer content in `PromptDetailDrawerSection` with `PromptDetailDrawerSkeleton` fallback.

- [ ] **Step 5: Validate prompts migration**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Manual check:
- `/prompts` route frame renders before list data.
- Queue snapshot no longer blocks list frame.
- Prompt drawer frame opens before detail data completes.

---

## Task 7: Dashboard and settings cached overview loaders

**Files:**
- Modify: `src/lib/server/dashboard-view-model.ts`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify settings overview helper files used by `settings/page.tsx` if present.

- [ ] **Step 1: Cache dashboard view model**

In `src/lib/server/dashboard-view-model.ts`, add a cached user function:

```ts
import { cacheLife, cacheTag } from "next/cache";
import { userCacheTag } from "@/lib/server/cache-tags";

export async function getDashboardViewModelForUser(userId: string) {
  "use cache";
  cacheTag(userCacheTag(userId, "dashboard"));
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  return getDashboardViewModel({ userId });
}
```

If `getDashboardViewModel()` already accepts a different signature, preserve its existing signature and wrap it with the exact current args.

- [ ] **Step 2: Update dashboard page**

In `src/app/dashboard/page.tsx`:
- Use `const user = await requireCurrentUser();`.
- Replace `getDashboardViewModel({ userId: user.id })` with `getDashboardViewModelForUser(user.id)`.
- Remove `dynamic = "force-dynamic"` if no runtime-only API remains in the page body.
- Add Suspense boundaries for slower panels if the page has independent sections.

- [ ] **Step 3: Cache settings overview**

In the settings overview server helper or directly in `src/app/settings/page.tsx`, create:

```ts
async function getSettingsOverviewForUser(userId: string) {
  "use cache";
  cacheTag(userCacheTag(userId, "settings"));
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  // Move existing settings overview reads here.
}
```

The cached function must not call `cookies()`, `headers()`, `searchParams`, or `auth.getUser()`.

- [ ] **Step 4: Validate dashboard/settings**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Manual check:
- `/dashboard` still loads analytics cards.
- `/settings` still respects locked Settings hub and no duplicate global settings affordance.

---

## Task 8: Mutation cache invalidation

**Files:**
- Modify: `src/app/products/actions.ts`
- Modify: `src/app/prompts/actions.ts`
- Modify: `src/app/intake/actions.ts`
- Modify: `src/app/settings/actions.ts`
- Modify: `src/app/gemini/actions.ts`
- Modify: `src/app/drive/actions.ts`
- Modify: `src/app/share/[platform]/actions.ts`
- Modify: `src/app/tools/ai-media/actions.ts`

- [ ] **Step 1: Add shared invalidation imports to server actions**

For each request-scoped server action file that mutates user data, add:

```ts
import { revalidateTag, updateTag } from "next/cache";
import { userCacheTag } from "@/lib/server/cache-tags";
```

Use `revalidateTag()` by default. Use `updateTag()` only if the same request immediately reads the changed data.

- [ ] **Step 2: Products mutations**

After successful product create/update/archive/bulk archive in `src/app/products/actions.ts`:

```ts
revalidateTag(userCacheTag(user.id, "products"));
revalidateTag(userCacheTag(user.id, "dashboard"));
```

Use the actual authenticated user variable already present in each action.

- [ ] **Step 3: Prompts mutations**

After successful prompt generate/regenerate/archive/queue actions in `src/app/prompts/actions.ts`:

```ts
revalidateTag(userCacheTag(user.id, "prompts"));
revalidateTag(userCacheTag(user.id, "dashboard"));
```

Do not call `revalidateTag()` inside `src/lib/server/prompt-queue.ts` background workers.

- [ ] **Step 4: Intake mutations**

After successful durable intake product capture or metadata analysis action in `src/app/intake/actions.ts`:

```ts
revalidateTag(userCacheTag(user.id, "products"));
revalidateTag(userCacheTag(user.id, "prompts"));
revalidateTag(userCacheTag(user.id, "dashboard"));
```

- [ ] **Step 5: Settings/Gemini/profile mutations**

After successful account/profile/Gemini settings mutations:

```ts
revalidateTag(userCacheTag(user.id, "settings"));
revalidateTag(userCacheTag(user.id, "shell"));
```

Only invalidate `shell` when profile/avatar/account display data may change.

- [ ] **Step 6: Drive/share/AI Media mutations**

Drive actions:

```ts
revalidateTag(userCacheTag(user.id, "drive"));
revalidateTag(userCacheTag(user.id, "products"));
revalidateTag(userCacheTag(user.id, "prompts"));
```

Share actions:

```ts
revalidateTag(userCacheTag(user.id, "share"));
revalidateTag(userCacheTag(user.id, "prompts"));
```

AI Media actions:

```ts
revalidateTag(userCacheTag(user.id, "ai-media"));
revalidateTag(userCacheTag(user.id, "dashboard"));
```

Only add the related secondary invalidation if the action changes data visible in that domain.

- [ ] **Step 7: Validate invalidation task**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: no build-time errors from request-scoped invalidation in background/server-only worker modules.

---

## Task 9: Share platform DB-backed cached list and drawer streaming

**Files:**
- Modify: `src/lib/server/share-list.ts`
- Modify: `src/app/share/[platform]/page.tsx`
- Create: `src/app/share/[platform]/share-list-section.tsx`
- Create: `src/app/share/[platform]/share-detail-drawer-section.tsx`

- [ ] **Step 1: Add cached share list loader**

In `src/lib/server/share-list.ts`, add:

```ts
import { cacheLife, cacheTag } from "next/cache";
import { userCacheTag } from "@/lib/server/cache-tags";

export type ShareListCachedInput = {
  page: number;
  pageSize: number;
  platform: string;
  search: string;
  status: string;
  workspaceId: string | null;
};

export async function listSharePageForUser(userId: string, input: ShareListCachedInput) {
  "use cache";
  cacheTag(userCacheTag(userId, "share"));
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });

  return listSharePageForUserUncached(userId, input);
}
```

Implement `listSharePageForUserUncached()` using existing share-list query logic, but ensure search/filter/pagination happen in Supabase/Postgres before relation hydration.

- [ ] **Step 2: Create share list Suspense section**

Create `src/app/share/[platform]/share-list-section.tsx`:

```tsx
import { Share2 } from "lucide-react";
import { ErrorState } from "@/components/operator/error-state";
import { listSharePageForUser, type ShareListCachedInput } from "@/lib/server/share-list";
import { ShareProductList } from "./share-product-list";

export async function ShareListSection({
  input,
  userId,
}: {
  input: ShareListCachedInput;
  userId: string;
}) {
  try {
    const sharePage = await listSharePageForUser(userId, input);

    return <ShareProductList sharePage={sharePage} />;
  } catch {
    return <ErrorState icon={Share2} title="Share pack tidak bisa dimuat." description="Coba lagi." />;
  }
}
```

Adjust props to match the existing `ShareProductList` signature.

- [ ] **Step 3: Create share drawer Suspense section**

Create `src/app/share/[platform]/share-detail-drawer-section.tsx`:

```tsx
import { Share2 } from "lucide-react";
import { ErrorState } from "@/components/operator/error-state";
import { ShareDetailPanel } from "./share-detail-panel";

export function ShareDetailDrawerSkeleton() {
  return (
    <div className="operator-drawer-skeleton" aria-label="Memuat detail share">
      <div className="operator-drawer-skeleton__line" />
      <div className="operator-drawer-skeleton__block" />
      <div className="operator-drawer-skeleton__block" />
    </div>
  );
}

export async function ShareDetailDrawerSection({
  platform,
  productId,
}: {
  platform: string;
  productId: string;
}) {
  try {
    return <ShareDetailPanel platform={platform} productId={productId} />;
  } catch {
    return <ErrorState icon={Share2} title="Detail share tidak bisa dimuat." description="Coba lagi." />;
  }
}
```

Adjust props after reading `ShareDetailPanel`.

- [ ] **Step 4: Refactor share platform page**

In `src/app/share/[platform]/page.tsx`:
- Use `requireCurrentUser()` once.
- Normalize `params` and `searchParams` outside cached loaders.
- Remove `dynamic = "force-dynamic"` if no longer needed.
- Wrap list and drawer content in Suspense.

- [ ] **Step 5: Validate share migration**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Manual check:
- `/share/[platform]` list renders with skeleton before rows.
- Detail drawer frame opens before detail data.
- Pagination/search/filter links still work.

---

## Task 10: Remove migrated `force-dynamic` exports and verify cache constraints

**Files:**
- Modify migrated route files only:
  - `src/app/products/page.tsx`
  - `src/app/prompts/page.tsx`
  - `src/app/dashboard/page.tsx`
  - `src/app/settings/page.tsx`
  - `src/app/share/[platform]/page.tsx`

- [ ] **Step 1: Search force-dynamic exports**

Use Grep tool or run:

```bash
npm run typecheck
```

Then specifically inspect migrated routes for:

```ts
export const dynamic = "force-dynamic";
```

- [ ] **Step 2: Remove migrated exports only**

Remove `force-dynamic` from migrated routes unless the file still directly depends on request-time APIs that cannot be moved behind Suspense or uncached wrappers.

- [ ] **Step 3: Build to catch invalid cache usage**

Run:

```bash
npm run build
```

Expected: build passes. If it fails with `cookies()`, `headers()`, `searchParams`, or `auth.getUser()` inside `use cache`, move that runtime read into the page/uncached wrapper and pass a serializable value into the cached function.

---

## Task 11: Full verification and handoff

**Files:**
- No new code unless fixing validation failures introduced by this plan.

- [ ] **Step 1: Run required validation**

Run:

```bash
npm run lint
npm run typecheck
npm run build
npm run smoke:e2e
```

Expected:
- `lint`: PASS
- `typecheck`: PASS
- `build`: PASS
- `smoke:e2e`: PASS or documented unrelated environment failure

- [ ] **Step 2: Manual verification checklist**

Verify manually:
- Root shell renders before profile/avatar data completes.
- `/products`, `/prompts`, `/share/[platform]` show route frame + skeleton before list data.
- Product/prompt/share drawer frames open immediately from query params.
- Drawer sections show skeleton/error states independently.
- Mutations refresh affected cached domains within the accepted 30-60 second stale window or immediately when `updateTag()` is used.
- No secrets or external API calls moved into client components.
- No route locks/nav labels changed.

- [ ] **Step 3: Inspect diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only files listed in this plan changed, plus existing user/other-agent changes preserved.

- [ ] **Step 4: Required verification agent gate**

Because this plan changes more than three files and touches backend/cache infrastructure, invoke the `verification` agent before reporting completion. Pass:
- Original task: page load performance refactor based on Progressive Cached Read Architecture.
- Spec path: `docs/superpowers/specs/2026-05-24-page-load-performance-design.md`.
- Plan path: `docs/superpowers/plans/2026-05-24-page-load-performance.md`.
- Changed files list from `git diff --stat`.
- Commands already run and their results.

If verifier returns FAIL, fix findings and rerun verifier. If PARTIAL, report exactly what could and could not be verified.

---

## Self-review

Spec coverage:
- Cache Components enabled: Task 1.
- Auth lookup deduped per request: Task 2.
- Root shell no longer blocks on profile context: Task 3.
- Per-user cache tags and cache life: Tasks 1, 3, 4, 6, 7, 9.
- DB-backed products/prompts/share pagination/search/filter: Tasks 4, 6, 9.
- Drawer detail streaming: Tasks 5, 6, 9.
- Mutation invalidation: Task 8.
- Remove `force-dynamic` from migrated routes: Task 10.
- Validation commands: Task 11.

Placeholder scan:
- No `TBD` or `TODO` placeholders are present.
- Where exact prop names may differ in existing large components, the plan instructs reading the component and preserving the current prop contract rather than inventing a new interface.

Type consistency:
- `userCacheTag(userId, domain)` is introduced before use.
- `requireCurrentUser()` and `getCurrentUser()` are introduced before route migrations.
- Cached loaders all accept `userId` plus serializable input.
- Cache domains match the spec: `shell`, `dashboard`, `products`, `prompts`, `settings`, `drive`, `share`, `ai-media`.
