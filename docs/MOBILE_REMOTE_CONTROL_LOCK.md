# Mobile Control Layer Lock

## Purpose
Mobile is for upload, review, prompt preparation, and light monitoring. Desktop is required for Flow Control and Google Flow execution.

## Locked Definition

The mobile PWA is not a remote desktop layer. It does not operate Google Flow directly.

## Mobile Bottom Navigation

Mobile bottom navigation labels are exactly:

```text
Dashboard
Produk
Prompt
Pengaturan
```

`Flow Control` is hidden from mobile bottom navigation.

Mobile must not expose a second settings shortcut outside the bottom navigation. `Pengaturan` is the only settings entry point on mobile.

## Mobile Surfaces

In scope on mobile:

- Dashboard counts.
- Produk list.
- `/products/new` intake upload.
- Gemini analysis trigger and metadata review.
- Paket Prompt preview/edit/regenerate.
- Output package review through product detail when available.
- Pengaturan access for workspace, affiliate profile, Gemini, Drive, and account basics.

Out of scope on mobile:

- Flow Control board as a primary surface.
- opening local Chrome profiles.
- running Google Flow.
- remote desktop streaming inside the PWA.
- auto-clicking Google Flow.
- TikTok/Shopee upload automation.

## Direct `/controller` Mobile Access

If `/controller` is opened on mobile, show a minimal state:

```text
Flow Control tersedia di desktop.
```

No mobile queue management UI should be added in Phase awal.

The minimal state can offer a single return path to `Pengaturan` or `Dashboard`, but it must not surface helper actions, queue columns, or Chrome profile controls.

## Mobile Intake Contract

Mobile intake must support:

- upload `Foto Produk Utama`.
- upload `Screenshot Marketplace`.
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
