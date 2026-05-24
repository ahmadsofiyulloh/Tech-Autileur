# UI/UX Redesign Source of Truth

## 1. Intent

Banplex OS is an operator dashboard, not a landing page.

The UI exists to help one owner/operator move through intake, metadata review, prompt production, Drive asset review, settings, and secondary monitoring with minimal friction. Redesign work must improve clarity, density, responsiveness, and action access without changing the locked product workflow.

This document governs UI/UX redesign tasks together with:

- `docs/PRD_SOURCE_OF_TRUTH.md`
- `docs/ARCHITECTURE_LOCK.md`
- `docs/MOBILE_REMOTE_CONTROL_LOCK.md`
- `docs/UI_UX_REDESIGN_AUDIT.md`

If this document conflicts with the PRD, the PRD wins.

## 2. Non-Negotiable PRD Locks

### Routes And Navigation

- `/` redirects to `/products/new`.
- `/controller` redirects to `/products/new` while frozen.
- `/flow` redirects to `/products/new` while frozen.
- `/products/new` is the Phase 1 entrypoint and primary Intake workflow.
- `/dashboard` is secondary analytics, not the primary workflow entrypoint.
- `/controller` and `/flow` are dormant in Phase 1 and must not appear as primary UI.
- Workflow navigation labels are exactly:
  - `Intake`
  - `Produk`
  - `Prompt`
  - `Drive`
- Mobile bottom navigation order is exactly:
  - `Dashboard`
  - `Intake`
  - `Produk`
  - `Prompt`
  - `Drive`
- `Flow Control` and `Controller` must not appear in Phase 1 workflow navigation.
- Topbar global controls are Notifications and Profile avatar menu.
- The Profile avatar opens profile overview and includes menu actions for `Pengaturan` and `Sign out`.
- `/settings` must not render a duplicate standalone Settings gear/action.
- The shell must not show a workspace picker.

### Copy

- UI language is concise Indonesian operational copy.
- Allowed copy is limited to page titles, section titles, field labels, action labels, status labels, one-sentence empty states, one-sentence error states, and concise overview summaries on true overview pages.
- Do not add verbose helper text, marketing copy, repeated descriptions, or English copy during redesign work.

### Intake Lifecycle

- `Simpan Produk` happens before `Analisis Metadata`.
- `Simpan Produk` requires at least one `Foto Produk Utama`.
- `Analisis Metadata` requires `Foto Produk Utama` plus at least one `Screenshot Shopee` or `Screenshot TikTok`.
- Product capture must be durable before Gemini metadata analysis succeeds.
- Gemini failure must leave the saved product recoverable and retryable.
- Intake must not expose Affiliate Profile switching. It may show active Affiliate Account context and readiness only.

### Prompt Labels And Actions

- Prompt surface label remains `Paket Prompt`.
- Read-only generated output fields remain:
  - `Prompt Clip 1`
  - `Prompt Clip 2`
  - `Caption`
  - `Tags`
  - `Target Marketplace`
- Regeneration field remains `Instruksi Revisi`.
- Prompt actions remain:
  - `Buat Prompt`
  - `Buat Ulang`
- Clip panels must expose `First Frame Image` and `I2V Prompt` as copy-ready fields.
- `I2I Last Frame` remains hidden compatibility data.
- Controller readiness actions must not be exposed in the Phase 1 prompt UI.

### Drive Browser

- `/drive` is a hierarchical visual browser over Google Drive metadata.
- Google Drive remains the asset/file source of truth.
- Supabase remains metadata source of truth.
- Large assets must not be stored in Supabase Storage.
- Folder items navigate into direct children.
- File/image items open preview.
- Mobile preview uses a bottom sheet.
- Desktop preview may use a right-side drawer.
- Mobile List mode must stay compact and must not become a dense table.
- Do not add full edit forms inside Drive preview bottom sheets.
- Do not add batch archive/delete mutations from Drive multi-select in the initial visual manager.

### Settings

- `/settings` is the Pengaturan hub and overview surface.
- Settings section routes remain:
  - `/settings/workspace`
  - `/settings/affiliate-profiles`
  - `/settings/gemini`
  - `/settings/account`
  - `/settings/drive -> /settings`
- `Pengaturan > Account` owns Chrome pairing and App API Token.
- Sign out is allowed from the Profile avatar menu and `Pengaturan > Account`.
- Google Drive connect/status lives on the Settings overview row.
- `/settings/drive` remains a compatibility redirect only.
- Workspace is retained internal support and must not be expanded into an operator planning model.
- Affiliate Profiles use list + drawer CRUD with Character and Environment asset cards.
- Gemini uses multi-key list + drawer CRUD. Do not add Test, Copy Key, Regenerate, or key history UI.
- Flow Accounts must not become a Settings CRUD surface.

## 3. Visual Direction

The redesign is Vercel-inspired, not Vercel-cloned.

The target feel is:

- neutral
- compact
- border-driven
- data-first
- action-first
- responsive
- professional SaaS dashboard
- calm private operator tool

Operational pages must not use hero blocks, marketing layouts, oversized promotional sections, or decorative landing-page composition.

Use visual hierarchy through layout, spacing, borders, type scale, surface weight, and action placement before adding decoration. Do not add filler cards, fake stats, arbitrary badges, random gradients, or icons that do not represent a real state, action, or navigation affordance.

As of 2026-05-21, non-badge UI color is locked to a neutral black/white/grayscale system through the shared token layer. Buttons, active states, focus rings, navigation states, controls, and operational surfaces must not use blue accents or gradient backgrounds. Status badges remain the only approved colored UI family and must continue to use semantic badge/status tokens. New or edited UI must consume semantic design tokens for color and typography. If a visual value is missing, extend the token layer first.

## 4. Responsive Breakpoints

Use these redesign bands when planning, implementing, and reviewing UI work:

- Mobile: `360-767px`
- Tablet: `768-1023px`
- Desktop: `1024-1279px`
- Wide desktop: `1280px+`

Existing CSS breakpoints may be migrated gradually, but every redesigned surface must be checked against these four bands.

## 5. Layout Rules

### Mobile

- Use compact cards, simple lists, full-width controls, and bottom sheets.
- Keep tap targets usable and safe-area aware.
- Avoid raw desktop tables and dense data grids.
- Keep primary actions visible and secondary actions in overflow where appropriate.
- Bottom sheets must sit above the bottom nav and account for `env(safe-area-inset-bottom)`.

### Tablet

- Use adaptive two-column layouts when they improve scanning or reduce excessive vertical stacking.
- Do not leave tablet stuck between broken mobile and desktop layouts.
- Preserve mobile ergonomics where available width does not support a true desktop layout.

### Desktop

- Prefer list/table + side drawer for mutable master data and review surfaces.
- Use denser rows, split panes, compact metrics, and persistent secondary panels where useful.
- Avoid layouts that look like mobile cards enlarged into a centered column.

### Wide Desktop

- Use width intentionally.
- Avoid stretching cards, paragraphs, forms, or charts beyond their useful scan width.
- Prefer multi-column composition, side panels, and bounded content regions.

### Shell And Sheets

- Bottom navigation requires safe-area padding.
- Bottom sheets must render above bottom navigation.
- Page content must not be hidden behind fixed shell chrome.

## 6. App Shell Rules

- Mobile shell uses a topbar plus fixed bottom navigation.
- Desktop shell uses a compact dashboard shell/sidebar.
- Active nav state must be clear.
- `Flow Control` must not appear in workflow nav during Phase 1.
- `Controller` must not appear as primary navigation during Phase 1.
- No workspace picker is allowed in the shell.
- Topbar has two global controls: Notifications and Profile avatar menu.
- Settings is a Profile avatar menu action, not a standalone topbar gear.
- `/settings` hides duplicate standalone Settings actions.
- Desktop shell polish must preserve route contracts, search params, form contracts, and data behavior.

## 7. Component Contract

Redesign work should converge on these shared operator components. If a component does not exist yet, introduce it through a small micro-task and pilot it on one surface before broad rollout.

### AppShell

Owns global shell layout, topbar Notifications, Profile avatar menu, desktop sidebar, mobile bottom nav, safe-area spacing, and Settings menu behavior.

Current reference: `src/components/app-shell.tsx`.

### PageHeader

Provides route title, concise route-level context where allowed, and primary page action. Create entrypoints should appear in page header or empty state CTA only.

### SectionHeader

Labels a section inside a route without creating an unnecessary card. Use for dense dashboard and operator surfaces.

### ActionToolbar

Groups search, filters, view toggles, and primary or secondary actions. Must wrap cleanly on mobile and remain compact on desktop.

### SearchInput

Shared search field with consistent label, icon, clear affordance where needed, and responsive sizing.

### FilterChips

Shared compact chip or segmented-filter pattern for product, prompt, Drive, and settings filters.

### StatusBadge

Shared status badge for product, prompt, Drive, Gemini, job, and settings states. Badges must map to real states and use semantic tokens.

Current reference: `src/components/operator/status-badge.tsx`.

### MetricCard

Compact metric display for real counts, quota values, progress, or operational summaries. No decorative or invented metrics.

### EntityCard

Mobile-first repeated item card for products, prompts, Drive items, and settings records. Must support status, primary action, and overflow actions.

### DataList

Shared desktop/tablet list or table shell with loading, empty, error, row action, and responsive fallback support.

### EmptyState

One concise empty sentence and optional approved CTA. No verbose instruction blocks.

Current reference: `src/components/operator/empty-state.tsx`.

### ErrorState

One concise error sentence, optional retry action, and no stack traces or technical diagnostics in normal UI.

### LoadingSkeleton

Skeletons should match the loaded structure closely enough to prevent layout jumps.

Current reference: `src/components/operator/loading-skeleton.tsx`.

### DetailDrawer

Desktop side drawer for detail, review, edit, and metadata panels. Must preserve form contracts and mutation behavior.

Current reference: `src/components/operator/detail-drawer.tsx`.

### BottomSheet

Mobile sheet for preview, detail, or light action flows. Must be safe-area aware and sit above bottom nav.

Current reference: `src/components/operator/bottom-sheet.tsx`.

### CopyField

Read-only copy-ready field for generated prompt output, OCR evidence, links, captions, tags, and helper tokens where allowed.

Current reference: `src/components/operator/copyable-readonly-field.tsx`.

### UploadCard

Upload or capture surface with local preview, status, and replace/remove affordances where allowed by the route.

Current reference: `src/components/operator/image-preview-upload-card.tsx`.

### PreviewTile

Compact visual preview for Drive assets, product images, character/environment assets, and upload previews. Must show real preview data when available and honest unavailable states otherwise.

## 8. Route Requirements

### `/dashboard`

Mobile:

- Keep a compact analytics overview.
- Avoid dense tables.
- Preserve loading, empty, and error states.

Desktop:

- Present a compact command-center layout.
- Use real metrics only: Gemini, Drive, prompts, outputs/imports, and related status counts.
- Avoid centered mobile-width card stacks on desktop and wide desktop.
- Dashboard remains secondary analytics, not the primary workflow entrypoint.

### `/products/new`

Mobile:

- Preserve Intake as the primary entrypoint.
- Use unified upload/product/metadata surface.
- Show `Foto Produk Utama`, `Screenshot Shopee`, and `Screenshot TikTok` as compact preview cards.
- Keep `Simpan Produk` and `Analisis Metadata` separate.
- Show active Affiliate Account readiness without profile switching.

Desktop:

- Keep Intake as the primary column.
- Make bulk import or secondary panels clearly subordinate to Intake.
- Use desktop width to reduce stacking without changing lifecycle or server behavior.

### `/products`

Mobile:

- Use compact product cards.
- Avoid raw desktop tables.
- Keep status, primary open action, and overflow actions clear.

Desktop:

- Prefer searchable list/table with side drawer.
- Keep product detail access to Metadata, Output, and History.
- Preserve product lifecycle and status semantics.

### `/products/[id]`

Mobile:

- Product detail must be usable as a direct route or an explicitly approved compatibility exception.
- Metadata, Output, and History must remain reachable.

Desktop:

- Product detail should support a denser detail layout with tabs or equivalent sections for Metadata, Output, and History.
- Do not expose technical audit data in the main Metadata tab.

### `/prompts`

Mobile:

- Keep prompt list/launcher usable through cards and sheets.
- Preserve copy-ready generated output access.

Desktop:

- Use a compact prompt workstation layout.
- Reduce card-heavy vertical scanning.
- Preserve readiness, queue, generation, regenerate, and history behavior.
- Do not introduce Flow batch UI as a Phase 1 prompt action.

### `/prompts/[id]`

Mobile:

- Prompt detail/editor must remain copy-ready and usable.
- `Prompt Clip 1`, `Prompt Clip 2`, `Caption`, `Tags`, `Target Marketplace`, and `Instruksi Revisi` labels remain locked.

Desktop:

- Use denser detail/editor layout.
- Keep generated fields read-only except approved regeneration input.
- History link remains available.

### `/prompts/[id]/history`

Mobile:

- Use a compact history list.
- Keep previous versions readable and scannable.

Desktop:

- Use available width for history scanning without adding unapproved workflow actions.
- Preserve version history behavior.

### `/drive`

Mobile:

- Use touch-friendly grid/list items.
- File preview opens in a bottom sheet.
- List mode must be compact and not a dense table.
- Long-press selection must have tap/click fallback.

Desktop:

- Use hierarchical browser with right-side preview drawer where useful.
- Keep Drive as browser/preview, not a full edit form surface.
- Do not add batch archive/delete from multi-select.

### `/settings`

Mobile:

- Keep grouped native-list feel.
- Settings remains accessible through the Profile avatar menu, not bottom nav.
- Active Affiliate Profile switch may live on the overview when backed by real state.

Desktop:

- Use a compact settings hub layout.
- Surface Affiliate Profiles, Gemini, Google Drive, Account, and retained Workspace support clearly.
- Do not turn Workspace into a planning model.
- Keep Google Drive connect/status on the overview row.

### Settings Subsections

Mobile:

- Mutable settings records use compact cards plus full-screen drawer or bottom sheet.
- Do not expose large desktop tables as the primary mobile interaction.

Desktop:

- Mutable master data uses searchable list/table plus right-side drawer.
- Workspace remains retained internal support only.
- Affiliate Profiles keep Character and Environment asset cards with `Lock Character` and `Lock Environment`.
- Gemini keeps multi-key list + drawer CRUD with approved fields and actions only.
- Account remains the place for Chrome pairing and App API Token; sign out is also allowed from the Profile avatar menu.

## 9. Validation Rules

For UI, route, shell, component, or CSS changes, run:

```bash
npm run audit:colors
npm run audit:typography
npm run audit:neutral-ui
npm run lint
npm run typecheck
npm run build
```

For route behavior, responsive shell, or critical workflow changes, also run when applicable:

```bash
npm run smoke:e2e
```

Docs-only changes may skip runtime verification, but the diff must still be shown and the final handoff must state that no runtime verification was required.

Visual PRs must include screenshot evidence or screenshot notes for the changed surfaces at:

- `390px`
- `768px`
- `1024px`
- `1280px` or `1440px`

## 10. PR Review Checklist

Every UI PR must include:

- Files changed.
- Surfaces changed.
- Validation commands run and results.
- Screenshot requirements covered at `390`, `768`, `1024`, and `1280` or `1440`.
- Confirmation no schema changes were made.
- Confirmation no migration changes were made.
- Confirmation no secret, `.env`, credential, token, or production config changes were made.
- Confirmation PRD route locks are preserved.
- Confirmation nav labels and mobile nav order are preserved.
- Confirmation no Controller/Flow primary UI was introduced.
- Confirmation no workspace picker was introduced.
- Confirmation every changed active surface has loading, empty, and error states or inherits an existing route state.
- Confirmation new or edited UI uses semantic color and typography tokens.
- Confirmation no verbose helper copy, marketing copy, or English operational copy was added.
- Confirmation Drive, Intake, Prompt, and Settings constraints remain intact for any touched surface.
