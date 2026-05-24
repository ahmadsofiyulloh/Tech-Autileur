# Share Link Caption Generator Actual Audit

## 1. Audit Metadata

- **Date/time**: 2026-05-24T05:48 UTC
- **Branch**: `main`
- **Git status summary**: 24 modified files, 13 untracked files
- **Uncommitted files related to this feature**:
  - `M src/app/share/[platform]/page.tsx`
  - `M src/app/share/[platform]/share-detail-panel.tsx`
  - `M src/app/share/[platform]/share-history-tab.tsx`
  - `M src/app/share/[platform]/share-input-form.tsx`
  - `M src/app/share/[platform]/share-output-tab.tsx`
  - `M src/app/share/[platform]/share-product-list.tsx`
  - `M src/app/share/page.tsx`
  - `M src/lib/gemini/json-schemas.ts`
  - `M src/lib/share/share-list-contract.ts`
  - `M src/lib/share/share-platform.ts`
  - `M src/lib/server/share-generations.ts`
  - `?? src/app/api/share/list/route.ts`
  - `?? src/app/share/[platform]/share-output-version-banner.tsx`
  - `?? src/app/share/_components/share-platform-grid.tsx`
  - `?? src/app/share/_components/share-generating-state.tsx`
  - `?? src/app/share/_components/share-error-state.tsx`
  - `?? src/app/share/_components/share-timeout-state.tsx`
  - `?? src/app/share/_components/share-kpi-summary.tsx`
  - `?? src/lib/server/share-caption-task.ts`
  - `?? src/lib/server/share-kpi.ts`
  - `?? src/components/operator/generating-state.tsx`
  - `?? src/components/operator/generating-state-skeletons.tsx`
  - `?? supabase/migrations/20260523180000_add_share_caption_enum_value.sql`
- **Commands used**: `git status`, `git diff --stat`, `rg`, `find`, `npm run lint`, `npm run typecheck`, `npm run build`

---

## 2. Feature Location Map

| File | Role | Confirmed behavior | Notes |
|------|------|-------------------|-------|
| `src/app/share/page.tsx` | Share landing page | Renders `ShareKpiSummary` + `SharePlatformGrid` | Entry point at `/share` |
| `src/app/share/_components/share-platform-grid.tsx` | Platform picker grid | Renders 4 platform cards (facebook, threads, x, pinterest) linking to `/share/{platform}` | Uses `SHARE_PLATFORM_VISUALS` for images |
| `src/app/share/_components/share-kpi-summary.tsx` | KPI metrics display | Shows Platform count, Captions Today, Total Generations, Queue count | Server component calling `getShareKpiMetrics()` |
| `src/app/share/_components/share-generating-state.tsx` | Polling loading state | Polls `/api/share/generation-status?id=` every 3s, timeout 90s | Wraps shared `GeneratingState` component |
| `src/app/share/_components/share-error-state.tsx` | Error display | Classifies errors (key_quota, timeout, parse, default) and shows retry/settings actions | Client component |
| `src/app/share/_components/share-timeout-state.tsx` | Timeout fallback | Shows refresh + back-to-form buttons when generation exceeds 90s | Client component |
| `src/app/share/[platform]/page.tsx` | Platform detail page | Server component: auth check, platform normalization, product list + detail drawer | Route: `/share/[platform]` |
| `src/app/share/[platform]/actions.ts` | Server action | `generateShareCaption(formData)`: validates, upserts affiliate URL, creates generation, redirects to output tab | Uses `createShareGeneration` |
| `src/app/share/[platform]/share-detail-panel.tsx` | Detail drawer tabs | Renders 3 tabs: Output, Generate, History. Auto-selects Generate if no generation exists | Client component |
| `src/app/share/[platform]/share-input-form.tsx` | Generation input form | Fields: affiliate_url, platform (readonly), angle (picker), variant_count (radio 1-4) | Client component with `<form action={}>` |
| `src/app/share/[platform]/share-output-tab.tsx` | Output display | Shows generating state, error state, or variant list with copy/share buttons | Client component |
| `src/app/share/[platform]/share-output-version-banner.tsx` | Version banner | Shows "Versi lama" banner with link to latest when viewing old generation | Client component |
| `src/app/share/[platform]/share-history-tab.tsx` | History list | Lists past generations with date, angle, variant count, preview, and "Lihat" link | Client component |
| `src/app/share/[platform]/share-product-list.tsx` | Product list (desktop table + mobile cards) | Desktop: paginated table. Mobile: infinite scroll via IntersectionObserver + `/api/share/list` | Client component |
| `src/lib/share/share-platform.ts` | Platform constants & prompt blocks | Defines platforms, angles, labels, char limits, `platformPromptBlocks`, `angleHookPatterns` | Shared contract |
| `src/lib/share/share-list-contract.ts` | List contract types | `ShareListRow`, `ShareTab`, pagination helpers, URL builders | Shared types |
| `src/lib/server/share-list.ts` | Server list data | `listShareListPage()`, `getShareListRowByProductId()` — fetches products + images + links + generations | Server-only |
| `src/lib/server/share-generations.ts` | Generation CRUD | `createShareGeneration()`, `getLatestShareGeneration()`, `listShareGenerationHistory()`, `updateShareGenerationOutput()`, `updateShareGenerationError()` | Server-only, fires background task |
| `src/lib/server/share-product-links.ts` | Affiliate URL CRUD | `upsertShareProductLink()`, `getShareProductLink()`, `listShareProductLinks()` | Server-only, validates URL |
| `src/lib/server/share-caption-task.ts` | Gemini caption worker | `runRealShareCaptionTask()`: builds prompt, calls Gemini with JSON schema, retries with key rotation, persists output | Background fire-and-forget |
| `src/lib/server/share-kpi.ts` | KPI metrics query | `getShareKpiMetrics()`: counts today's captions, total generations, queued tasks | Server-only |
| `src/lib/gemini/json-schemas.ts` (lines 652-702) | JSON response schema | `shareCaptionVariantSchema` + `GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA` | Defines expected Gemini output structure |
| `src/lib/ai-tasks/validation.ts` | Task type enum | `SHARE_CAPTION` in `AI_TASK_TYPES` array | Shared validation |
| `src/app/api/share/generation-status/route.ts` | Polling API | GET: returns `{status, error_message, output_json}` for a generation by id | Auth-gated |
| `src/app/api/share/list/route.ts` | Mobile infinite scroll API | GET: returns paginated share list rows for a platform | Auth-gated |
| `supabase/migrations/20260523000001_share_workspace.sql` | DB schema | Creates `share_product_links` and `share_generations` tables with RLS | Applied migration |
| `supabase/migrations/20260523180000_add_share_caption_enum_value.sql` | Enum extension | `ALTER TYPE ai_task_type ADD VALUE 'SHARE_CAPTION'` | Applied migration |
| `tests/e2e/share-page-design.spec.ts` | E2E test | 163 lines, tests platform picker grid columns at 4 breakpoints + share detail flow | Playwright |

---

## 3. Current User Flow

### Entry
1. User navigates to `/share` — sees KPI summary (4 metrics) + platform grid (4 cards).
2. User clicks a platform card → navigates to `/share/{platform}`.

### Product Selection
3. `/share/{platform}` shows a product list (desktop: paginated table, mobile: infinite scroll cards).
4. Each product row shows: name, marketplace, affiliate URL status, share status badge, last generation date, "Buka" button.
5. Clicking "Buka" opens the detail drawer with the product selected via `?detail={productId}`.

### Detail Drawer
6. Drawer shows 3 tabs: **Output**, **Generate**, **History**.
7. If no generation exists yet, auto-redirects to **Generate** tab.

### Generate Tab (Input Form)
8. Shows product hero (thumbnail + marketplace + external link).
9. Fields:
   - **Affiliate URL** (text input, required, pre-filled from saved link)
   - **Platform** (readonly, shows current platform label)
   - **Angle** (RelationalPicker dropdown, 6 options, default: `benefit_focused`)
   - **Jumlah varian** (radio buttons 1-4, default: 2)
10. "Generate Caption" button (disabled if affiliate URL empty, shows "Generate..." while pending).

### Generation Flow
11. Form submits server action `generateShareCaption`:
    - Validates inputs
    - Upserts affiliate URL to `share_product_links`
    - Creates `share_generations` row with status `"generating"`
    - Creates `ai_tasks` row with type `SHARE_CAPTION`
    - Fires background `runRealShareCaptionTask()` (fire-and-forget dynamic import)
    - Redirects to `?tab=output`

### Loading State
12. Output tab detects `status === "generating"` → renders `ShareGeneratingState`:
    - Polls `/api/share/generation-status?id=` every 3 seconds
    - Shows skeleton + rotating status messages
    - On resolved: `router.refresh()` to re-render with output
    - On timeout (90s): shows `ShareTimeoutState` with Refresh + Back to Form buttons

### Output Tab
13. Shows variant list (`share-output-list`):
    - Each variant: header (Varian N + angle badge + platform badge), caption text, Copy + Manual Share buttons.
    - Copy: `navigator.clipboard.writeText(caption)` with 2s "Tersalin" feedback.
    - Manual Share: `navigator.share({ text, title })` fallback to clipboard.
14. If viewing old version: shows `ShareOutputVersionBanner` with "Kembali ke Terbaru" link.

### Error State
15. If `status === "error"`: shows `ShareErrorState` with classified message + Retry/Edit buttons.
    - key_quota errors link to `/settings`.

### History Tab
16. Lists all past generations for this product+platform:
    - Columns: Waktu, Setting (angle + variant count), Preview (first caption truncated), Aksi ("Lihat" link).
    - "Lihat" navigates to `?tab=output&version={generationId}`.

---

## 4. Current Input Contract

| Field | Type | Required | Default | Validation | Source file |
|-------|------|----------|---------|------------|-------------|
| `product_id` | `string` (uuid) | Yes | From selected product | Must exist, must be owned by user | `src/app/share/[platform]/actions.ts:27` |
| `platform` | `string` | Yes | From URL param | Must pass `isSharePlatform()` — one of: facebook, threads, x, pinterest | `src/app/share/[platform]/actions.ts:31` |
| `affiliate_url` | `string` (URL) | Yes | Pre-filled from `share_product_links` if exists | Non-empty, must be valid http/https URL (validated in `normalizeAffiliateUrl`) | `src/lib/server/share-product-links.ts:28-49` |
| `angle` | `string` | Yes | `benefit_focused` | Must pass `isShareAngle()` — one of 6 values | `src/app/share/[platform]/actions.ts:39` |
| `variant_count` | `number` | Yes | `2` | Normalized via `normalizeShareVariantCount()`: clamped to 1-4 | `src/lib/share/share-platform.ts:66-74` |

### Angle options (6 total):
- `benefit_focused` — "Fokus Manfaat"
- `problem_solution` — "Solusi Masalah"
- `social_proof` — "Bukti Sosial"
- `urgency_scarcity` — "Urgensi & Kelangkaan"
- `educational` — "Edukatif"
- `storytelling` — "Cerita"

### Variant count range:
- Min: 1 (`SHARE_VARIANT_COUNT_MIN`)
- Max: 4 (`SHARE_VARIANT_COUNT_MAX`)

---

## 5. Current Output Contract

| Output | Type | Platform | Copy-ready | Stored? | Source file |
|--------|------|----------|------------|---------|-------------|
| `caption` | `string` | All | Yes (clipboard copy) | Yes, in `share_generations.output_json` as JSONB array | `src/lib/gemini/json-schemas.ts:656` |
| `angle` | `ShareAngle` enum | All | No (display badge) | Yes, per variant in output_json | `src/lib/gemini/json-schemas.ts:660` |
| `platform` | `SharePlatform` enum | All | No (display badge) | Yes, per variant in output_json | `src/lib/gemini/json-schemas.ts:664` |
| `platform_specific_fields.reply_with_link` | `string` | X only | Not currently rendered separately | Yes, stored in output_json | `src/lib/gemini/json-schemas.ts:671` |
| `platform_specific_fields.pin_title` | `string` | Pinterest only | Not currently rendered separately | Yes, stored in output_json | `src/lib/gemini/json-schemas.ts:675` |
| `platform_specific_fields.hashtags` | `string[]` | Facebook (1-3), X (0-2) | Not currently rendered separately | Yes, stored in output_json | `src/lib/gemini/json-schemas.ts:679` |

### Key observations:
- `platform_specific_fields` is defined in the JSON schema and Gemini is instructed to fill it, but the **output UI only renders `variant.caption`** — it does NOT display `reply_with_link`, `pin_title`, or `hashtags` separately.
- Character count validation exists in the worker (warns to console) but is NOT shown to the user in the UI.
- No disclosure/affiliate label is added to the output.

---

## 6. Current Platform Support

| Platform | Supported? | Current fields | Current output | Missing/unclear |
|----------|-----------|----------------|----------------|-----------------|
| Facebook | Yes | Same as all: affiliate_url, angle, variant_count | Caption text (150-500 chars optimal per prompt). Hashtags requested in schema but not rendered in UI. | Hashtags not displayed. No first-comment support. |
| Threads | Yes | Same as all | Caption text (max 500 chars per prompt). | No thread/carousel support. |
| X | Yes | Same as all | Caption text (max 280 chars per prompt). `reply_with_link` requested in schema but NOT rendered separately in UI. | `reply_with_link` field exists in schema/prompt but output UI only shows `caption`. User cannot copy reply separately. |
| Pinterest | Yes | Same as all | Caption text (100-200 chars optimal per prompt). `pin_title` requested in schema but NOT rendered separately in UI. | `pin_title` not displayed. No image prompt. No pin URL guidance. |

### Platform-specific prompt instructions (confirmed in `buildShareCaptionPrompt`):
- **X**: Prompt instructs "JANGAN taruh link affiliate di tweet utama" and requires `reply_with_link` field.
- **Pinterest**: Prompt instructs `pin_title` is required (keyword-first, max 100 chars).
- **Facebook/Threads**: Link goes at end of caption.

---

## 7. Current Prompt Pack Integration

**There is NO direct integration between Share Caption Generator and Prompt Pack.**

Confirmed findings:
- The share feature uses `products` table data (product_name, marketplace) but does NOT read from `prompt_packs` or `prompt_pack_generated_files`.
- `createShareGeneration()` in `share-generations.ts:168-225` only passes `productName` and `affiliateUrl` to the task — no prompt pack metadata, no existing captions/tags, no i2i/i2v prompts.
- The Gemini prompt in `share-caption-task.ts:45-82` only references product name and affiliate URL — no product description, no USP, no existing generated content.
- Share generations are stored independently in `share_generations` table, not linked to `prompt_packs`.
- No history sharing between prompt pack and share caption.

### What product data IS used:
- `product_name` (from products table)
- `affiliate_url` (from share_product_links table)
- `marketplace` (displayed in UI hero but NOT passed to Gemini prompt)

### What product data is NOT used:
- Product description/USP
- Product category
- Product price
- Existing prompt pack captions/tags
- Product images (not referenced in prompt)
- Marketplace-specific metadata

---

## 8. Current Gemini / AI Instruction

### Prompt builder
- **Function**: `buildShareCaptionPrompt()` at `src/lib/server/share-caption-task.ts:45-82`
- **System instruction**: `"You are an expert Indonesian affiliate marketing copywriter."` (line 188)
- **Temperature**: 0.7
- **Max output tokens**: 2048
- **Timeout**: 60,000ms
- **Grounding**: Disabled (`enableGoogleSearchGrounding: false`)

### Prompt structure:
1. Role definition (Indonesian affiliate copywriter)
2. Style rules (natural language, soft CTA, avoid hard selling)
3. Product info (name + affiliate URL only)
4. Platform-specific block from `platformPromptBlocks[platform]`
5. Angle-specific hook patterns from `angleHookPatterns[angle]`
6. Task instruction (generate N variants, platform-specific field instructions)
7. Instruction for diverse hooks

### JSON schema
- **Schema**: `GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA` at `src/lib/gemini/json-schemas.ts:691-702`
- **Structure**: `{ variants: ShareCaptionVariant[] }`
- **Variant fields**: `caption` (required), `angle` (required), `platform` (required), `platform_specific_fields` (optional object with `reply_with_link`, `pin_title`, `hashtags`)

### Model/key routing
- Uses `listQuotaAwareGeminiKeys()` with purpose `"SHARE_CAPTION"`
- Model determined by key's `model_name` field
- Multi-key rotation with up to 5 attempts
- Handles 429 (rate limit with cooldown), 400/401/403 (permanent exclusion), 500+ (temporary exclusion)

### Parser/recovery
- `JSON.parse(response.text)` — no streaming, no partial recovery
- Validates variant count matches requested count (throws if mismatch)
- Character limit check: `console.warn` only, does NOT reject or truncate

### Fallback behavior
- If all keys exhausted: sets generation status to `"error"` with descriptive message
- If JSON parse fails: throws, caught by outer try/catch, sets error status
- No retry of the same key for non-quota errors

---

## 9. Current Data Persistence

### Confirmed persisted:
| Data | Table | Confirmed |
|------|-------|-----------|
| Affiliate URL per product | `share_product_links` (upsert on user_id + product_id) | Yes — `src/lib/server/share-product-links.ts:89-114` |
| Generation record (input params + status) | `share_generations` | Yes — `src/lib/server/share-generations.ts:186-198` |
| Generation output (variant array) | `share_generations.output_json` (JSONB) | Yes — `src/lib/server/share-caption-task.ts:217-224` |
| AI task tracking | `ai_tasks` table | Yes — via `createAITask()` |
| Generation history | `share_generations` (multiple rows per product+platform) | Yes — queried by `listShareGenerationHistory()` |

### NOT persisted:
- No "copy count" or "share count" tracking
- No per-variant selection/favorite marking
- No export/download history
- Output is NOT attached to prompt pack

### Storage format:
```json
// share_generations.output_json example structure
[
  {
    "caption": "...",
    "angle": "benefit_focused",
    "platform": "facebook",
    "platform_specific_fields": {
      "hashtags": ["tag1", "tag2"],
      "reply_with_link": "...",  // X only
      "pin_title": "..."         // Pinterest only
    }
  }
]
```

---

## 10. Current Image Prompt Support

**No image prompt support exists.**

Confirmed:
- The Gemini prompt in `buildShareCaptionPrompt()` does NOT reference any product image.
- No image URL, Drive item reference, or visual description is passed to the prompt.
- No `i2i` or `i2v` style prompt generation for share content.
- No `must_keep`/`must_avoid` fields.
- No aspect ratio or crop guidance.
- No image input reference in the form or schema.
- The `platform_specific_fields` schema has no image-related fields.
- Pinterest prompt mentions "visual search engine" but does NOT generate image prompts or reference product images.

---

## 11. Current Tests

| Test file | Coverage | Notes |
|-----------|----------|-------|
| `tests/e2e/share-page-design.spec.ts` | 163 lines | Tests platform picker grid columns at 4 breakpoints (360, 768, 1024, 1280px), navigation to platform page, share detail opening. Uses Playwright with Supabase service client for cleanup. |

### Not covered by tests:
- Generation flow (form submit → output)
- Error/timeout states
- History tab
- Copy/share buttons
- Mobile infinite scroll
- API routes (`/api/share/list`, `/api/share/generation-status`)

---

## 12. Gaps vs Observed Intent

| Gap | Status | Evidence |
|-----|--------|----------|
| Platform-specific field rendering (reply_with_link, pin_title, hashtags) | CONFIRMED_MISSING | Schema defines them, prompt requests them, but `share-output-tab.tsx` only renders `variant.caption` |
| Thread/carousel support for Threads | CONFIRMED_MISSING | No multi-post or carousel structure in schema or UI |
| First comment support for Facebook | CONFIRMED_MISSING | Prompt mentions "link di komentar" as option but no separate field or UI for it |
| Pinterest image requirement | CONFIRMED_MISSING | No image prompt, no image reference, no pin image guidance |
| Image prompt support (any platform) | CONFIRMED_MISSING | Zero image-related code in share feature |
| Character limit display in UI | CONFIRMED_MISSING | Limits defined in `PLATFORM_CHAR_LIMITS`, checked in worker (console.warn only), not shown to user |
| Disclosure/compliance labels | CONFIRMED_MISSING | No "#ad", "#affiliate", or FTC/Indonesian disclosure in output or prompt |
| Storage/history linked to prompt pack | CONFIRMED_MISSING | Completely independent data paths |
| Product metadata in prompt (description, USP, price) | CONFIRMED_MISSING | Only product_name and affiliate_url passed to Gemini |
| Copy count / analytics | CONFIRMED_MISSING | No tracking of copy or share actions |
| Per-variant actions (favorite, delete, edit) | CONFIRMED_MISSING | Only copy and share exist |
| Regenerate single variant | CONFIRMED_MISSING | Only full batch regeneration |
| Export/download captions | CONFIRMED_MISSING | No export functionality |

---

## 13. Risk Notes

| Risk | Severity | Details |
|------|----------|---------|
| `platform_specific_fields` not rendered | Medium | Gemini generates `reply_with_link` for X and `pin_title` for Pinterest but users never see them. Data is stored but wasted. |
| Unused import in share-product-list.tsx | Low | `SHARE_LIST_DESKTOP_PAGE_SIZE` imported but unused (lint warning). |
| setState in useEffect warnings | Low | `share-product-list.tsx` lines 223, 230 — lint warnings about cascading renders. Functional but suboptimal. |
| No JSON parse recovery | Medium | If Gemini returns malformed JSON, entire generation fails. No partial extraction or retry with different prompt. |
| Variant count strict validation | Low | If Gemini returns wrong count, generation fails entirely (`share-caption-task.ts:204`). Could be more lenient. |
| Fire-and-forget worker pattern | Medium | `void import(...).then(...).catch(() => undefined)` at `share-generations.ts:219-221`. If the dynamic import fails silently, generation stays stuck in "generating" forever. Timeout UI (90s) is the only safety net. |
| No product description in prompt | Medium | Gemini only knows product name — captions may be generic or inaccurate without USP/description context. |
| Character limit not enforced | Low | Over-limit captions are logged but still stored and shown to user. User may paste oversized content. |
| `<img>` instead of `next/image` | Low | Lint warning in `share-input-form.tsx:57` and `share-platform-grid.tsx:14`. |
| Build passes | None | All 3 verification commands pass (lint: 0 errors/92 warnings, typecheck: clean, build: success). |

---

## 14. Recommended Next Audit Questions

1. Should `platform_specific_fields` (reply_with_link, pin_title, hashtags) be rendered in the output UI? If yes, what's the UX for copy-separately?
2. Should product description/USP/price be passed to the Gemini prompt for richer captions?
3. Is affiliate disclosure (#ad, #affiliate) required by Indonesian regulations or platform TOS?
4. Should character limits be enforced (truncate/reject) or just warned in UI?
5. Should the feature integrate with Prompt Pack data (existing captions, tags, product metadata)?
6. Is image prompt generation needed for Pinterest pins or Facebook posts?
7. Should there be a "first comment" field for Facebook (link in comment strategy)?
8. Should the fire-and-forget worker have a dead-letter/stuck-detection mechanism beyond the 90s client timeout?
9. Should variant count validation be lenient (accept fewer variants) or strict (fail if mismatch)?
10. Is per-variant editing/regeneration needed, or is full-batch regeneration sufficient?

---

## 15. Implementation Boundaries

### Should NOT be changed yet (risky / needs design decision):
- `src/lib/server/share-caption-task.ts` — core worker logic, key rotation, error handling. Changes here affect all generation reliability.
- `src/lib/gemini/json-schemas.ts` — shared schema file used by multiple features. Schema changes affect Gemini response parsing.
- `supabase/migrations/` — DB schema changes require migration-first approach and approval.
- `src/lib/server/gemini-key-routing.ts` — shared infrastructure, not share-specific.

### Safe for frontend-only work:
- `src/app/share/[platform]/share-output-tab.tsx` — can render `platform_specific_fields` without backend changes (data already stored).
- `src/app/share/[platform]/share-input-form.tsx` — can add UI elements (char limit display, field descriptions).
- `src/app/share/_components/` — all new components, safe to modify.
- `src/app/share/[platform]/share-history-tab.tsx` — display-only, safe to enhance.
- `src/app/share/[platform]/share-detail-panel.tsx` — tab orchestration, safe to modify.
- `src/styles/05-features/share-workspace.css` — CSS only.

### Backend/data contract work (needs careful coordination):
- `src/lib/server/share-generations.ts` — generation CRUD, affects data flow.
- `src/lib/server/share-caption-task.ts` — prompt changes affect output quality.
- `src/lib/share/share-platform.ts` — shared constants, changes propagate to prompt + UI + validation.
- `src/app/share/[platform]/actions.ts` — server action, changes affect form submission flow.

---

## 16. Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run lint` | PASS (exit 0) | 0 errors, 92 warnings. Share-specific warnings: unused import (`SHARE_LIST_DESKTOP_PAGE_SIZE`), `<img>` usage, setState-in-effect. |
| `npm run typecheck` | PASS (exit 0) | No type errors. |
| `npm run build` | PASS (exit 0) | All routes compiled successfully including `/share` and `/share/[platform]`. |
