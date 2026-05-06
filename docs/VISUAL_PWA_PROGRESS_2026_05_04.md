# Visual PWA Progress - 2026-05-04

## Purpose

This note records the actual repo progress after the Visual PWA Mobile-First implementation. It is a status snapshot for the team, not a new backend scope request.
The commit-backed ledger lives in `docs/BACKLOG_AUDIT.md`; treat this note as a snapshot summary only.

## Current Visual Decisions

- The 2026-05-04 Visual PWA Mobile-First references override older shell and UI baseline conflicts.
- Bottom navigation is `Intake`, `Produk`, `Prompt`, `Drive`.
- Settings is opened through one topbar gear on non-Settings routes.
- `/settings` has no right-side topbar action.
- The workspace picker has been removed from the global shell.
- The app uses Inter and light native mobile design tokens.
- Drive uses a grid/gallery with bottom-sheet preview.
- The app surfaces a compact install card on `/products/new` and `/settings` when browser install prompt is available.
- The manifest now ships with install icons and screenshot assets.
- Product rows and Drive tiles now share a media thumbnail frame backed by server-resolved Drive preview URLs when image bytes are available.
- Settings overview uses grouped native-style sections.

## Frontend Implemented

- Design tokens and shared visual utilities were added in `src/app/globals.css`.
- App font and shell baseline were updated in `src/app/layout.tsx`.
- Global shell and navigation were updated in `src/components/app-shell.tsx` and `src/components/operator/nav-config.ts`.
- Shared media thumbnail rendering was added in `src/components/operator/media-thumbnail-frame.tsx` and `src/lib/server/drive-image-previews.ts`.
- PWA install affordance and manifest install assets were added in `src/components/operator/pwa-install-card.tsx`, `public/manifest.webmanifest`, `public/icons/`, and `public/pwa-screenshots/`.
- Intake visuals were updated in `src/app/products/new/page.tsx`, `src/app/products/new/intake-workflow-form.tsx`, and `src/app/intake/actions.ts`.
- Products and Prompts visual cards were updated in `src/app/products/page.tsx`, `src/app/products/product-list.tsx`, and `src/app/prompts/page.tsx`.
- Drive visual manager was added through `src/app/drive/page.tsx` and `src/app/drive/drive-visual-manager.tsx`.
- Settings grouped overview was updated in `src/app/settings/page.tsx`.
- The shell now includes a pull-to-refresh fallback on mobile, and retryable Gemini outages surface warning toasts instead of hard errors.
- The affiliate profile drawer now exposes explicit Character and Environment reanalysis actions with ref-aware readiness badges.

## Current Follow-Up

- `11efa04` reused the shared image preview upload card across intake and affiliate profile drawers.
- `d7e86bc` hardened intake upload parsing and raised the server action upload limit for real file bodies.

## Verification Snapshot

Last verification after the visual implementation and before this docs-only sync:

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- Authenticated mobile smoke check passed for:
  - `/products/new`: Settings gear visible, bottom nav visible.
  - `/settings`: Settings gear hidden, grouped sections visible.
  - `/drive`: grid visible, bottom sheet opens on item tap.

## Backend And Data Status

- No schema migration has been added for Drive thumbnail metadata.
- Drive thumbnails now resolve transient preview URLs server-side from Drive image bytes when available; the render path still falls back to file-type icons/placeholders.
- Drive multi-select is client-side only.
- No batch archive/delete mutation was added for Drive multi-select.
- No fake performance metrics were added.
- Settings service status is still page-level/ad hoc and should become an explicit server-only view-model contract in a future backend task.

## Next Useful Backend Follow-Up

Add server-only visual view-model loaders for Products, Prompts, Drive, Settings service status, and Affiliate Profile selector state. Keep this as metadata aggregation only; do not add persistent Drive thumbnail/preview storage unless a later approved task explicitly asks for it.
