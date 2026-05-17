# Mobile Control Layer Lock

## Purpose
Mobile is for upload, review, prompt preparation, and light monitoring. Desktop is required for Flow Control and Google Flow execution.

## Locked Definition

The mobile PWA is not a remote desktop layer. It does not operate Google Flow directly.

Visual override: the Visual PWA Mobile-First references approved on 2026-05-04 define the active mobile shell. If older mobile nav language conflicts with this section, this section wins.

## Mobile Bottom Navigation

Mobile bottom navigation labels are exactly:

```text
Dashboard
Intake
Produk
Prompt
Drive
```

`Dashboard` is the secondary analytics route in the mobile shell.
`Flow Control` is hidden from mobile bottom navigation.

Settings is not a mobile bottom navigation item in Phase 1. Mobile uses one global Settings gear in the topbar on every non-Settings route. `/settings` renders no right-side topbar gear.

## Mobile Surfaces

In scope on mobile:

- Dashboard analytics route through the shell nav.
- `/products/new` Intake as the primary entrypoint.
- Produk list.
- durable product capture through `Simpan Produk`.
- Gemini metadata analysis trigger and metadata review.
- Paket Prompt generated output/regenerate/history.
- Drive visual grid/gallery and bottom-sheet preview.
- Output package review through product detail when available.
- Pengaturan access through the topbar gear for workspace, affiliate profile, Gemini, Drive, and account basics.

Out of scope on mobile:

- Flow Control board as a primary surface.
- opening local Chrome profiles.
- running Google Flow.
- remote desktop streaming inside the PWA.
- auto-clicking Google Flow.
- TikTok/Shopee upload automation.

## Direct `/controller` Mobile Access

During Phase 1, `/controller` follows the frozen redirect to `/products/new` on mobile.

No mobile queue management UI should be added in Phase awal.

The redirect path must not surface helper actions, queue columns, or Chrome profile controls.

## Mobile Intake Contract

Mobile intake must support:

- upload `Foto Produk Utama`.
- upload `Screenshot Shopee`.
- upload `Screenshot TikTok`.
- local preview before submit.
- `Simpan Produk` action with only product image required.
- `Analisis Metadata` action after at least one Shopee or TikTok screenshot evidence is complete.
- recoverable failed/pending metadata state with retry.
- three equal mini preview cards on mobile without a product/screenshot tab split.
- active Affiliate Account readiness card without profile switching.
- loading, empty, and error states.

## Mobile Prompt Contract

Mobile prompt must support:

- prompt preview.
- read-only copy-ready prompt fields.
- collapsible clip-level `Storyboard Image` and `I2V Prompt` fields; hidden `I2I Last Frame` remains persisted for legacy compatibility.
- `Instruksi Revisi`.
- `Buat Prompt`.
- `Buat Ulang`.

The user may prepare and copy generated prompts on mobile. Flow execution remains a frozen desktop/backend compatibility concern in Phase 1.

## Mobile Settings Contract

Mobile settings must keep `/settings` as the overview entrypoint, then open section routes or equivalent section screens for Workspace, Affiliate Profiles, Gemini, and Account. Settings overview exposes the active Affiliate Profile switch, and switching it also switches the internal workspace namespace. Google Drive connect/status lives in the Connected Services row on the overview, with `/settings/drive` retained only as a redirect. Drive folder setup is automatic under `/AffiliateAI/` and is not a manual mobile setting.

Mutable master lists use compact cards. Edit/create forms open as a full-screen drawer or bottom sheet. Mobile must not expose large desktop tables as the primary interaction.

Affiliate Profile drawers on mobile keep Character and Environment preview cards compact, use Drive-style preview tiles when image bytes exist, and show inline reanalysis pending or fallback feedback so the drawer does not go silent during retryable Gemini work. Character preview is shown only when `Lock Character` is ON. Environment preview is shown only when `Lock Environment` is ON. Reanalysis success or failure must not close the drawer automatically.

The Settings overview should read as a native grouped list. Account, Affiliate Profiles, Connected Services, Preferences, and System/Support groups may appear when backed by real app state.
