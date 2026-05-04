# Mobile Control Layer Lock

## Purpose
Mobile is for upload, review, prompt preparation, and light monitoring. Desktop is required for Flow Control and Google Flow execution.

## Locked Definition

The mobile PWA is not a remote desktop layer. It does not operate Google Flow directly.

Visual override: the Visual PWA Mobile-First references approved on 2026-05-04 define the active mobile shell. If older mobile nav language conflicts with this section, this section wins.

## Mobile Bottom Navigation

Mobile bottom navigation labels are exactly:

```text
Intake
Produk
Prompt
Drive
```

`Flow Control` is hidden from mobile bottom navigation.

Settings is not a mobile bottom navigation item in Phase 1. Mobile uses one global Settings gear in the topbar on every non-Settings route. `/settings` renders no right-side topbar gear.

## Mobile Surfaces

In scope on mobile:

- `/products/new` Intake as the primary entrypoint.
- Produk list.
- Gemini analysis trigger and metadata review.
- Paket Prompt preview/edit/regenerate.
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
- `Analisis Gemini` action.
- loading, empty, and error states.

## Mobile Prompt Contract

Mobile prompt must support:

- prompt preview.
- edit prompt fields.
- clip-level `I2I First Frame`, `I2I Last Frame`, and `I2V Prompt` fields.
- `Instruksi Revisi`.
- `Buat Prompt`.
- `Buat Ulang`.
- `Tandai Siap Flow`.

The user may prepare prompts on mobile, then continue Flow execution on desktop.

## Mobile Settings Contract

Mobile settings must keep `/settings` as the overview entrypoint, then open section routes or equivalent section screens for Workspace, Affiliate Profiles, Gemini, Drive, and Account.

Mutable master lists use compact cards. Edit/create forms open as a full-screen drawer or bottom sheet. Mobile must not expose large desktop tables as the primary interaction.

The Settings overview should read as a native grouped list. Account, Affiliate Profiles, Connected Services, Preferences, and System/Support groups may appear when backed by real app state.
