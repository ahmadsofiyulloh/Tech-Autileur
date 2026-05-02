# Prompt Pipeline Lock - Intake -> Paket Prompt -> Flow Control

## Purpose
This lock defines how uploaded product evidence becomes editable prompt packs. Prompt generation must follow user-owned Affiliate Profile rules and must not invent hardcoded prompt rules in UI/code.

## Locked Flow

```text
/products/new upload
-> Analisis Gemini
-> Metadata review
-> Buat Prompt
-> Paket Prompt preview/edit
-> Buat Ulang bila perlu
-> Tandai Siap Flow
-> Flow Control
-> Output/history
```

## Required Intake Inputs

Before `Analisis Gemini`, only upload evidence is required.

Required:

- `Foto Produk Utama`: at least 1 image byte upload.
- `Screenshot Marketplace`: at least 1 screenshot byte upload.

Optional:

- additional product images.
- additional marketplace screenshots.

Forbidden before Gemini:

- product title field.
- marketplace account field.
- manual product metadata fields.
- claiming visual analysis from links without image bytes.

## Gemini Analysis Output

The operator reviews and may edit these fields before prompt generation:

```text
Nama Produk
Keyword Cari Etalase
Deskripsi Visual
Use Case
Pain Point
Selling Angle
Target Viewer
Catatan Risiko
```

## Prompt Personalization Inputs

Prompt generation must consume:

- reviewed product metadata.
- uploaded product image and screenshot context when bytes are available.
- workspace context.
- active workspace-scoped Affiliate Profile.
- Affiliate Profile i2i, i2v, caption, hashtag, and negative rules.
- Affiliate Profile character lock.
- Affiliate Profile environment lock.
- Drive item references for profile assets.

Character and environment are profile-owned only in Phase awal. The environment asset is the background-lock asset for prompt generation. Prompt pages must not create per-prompt overrides for these locks.

Prompt generation must also consume the active workspace's reviewed Gemini output and must not invent any extra profile asset slot beyond character and environment.

## Required Prompt UI

Surface label:

```text
Paket Prompt
```

Editable fields:

```text
Prompt Clip 1
Prompt Clip 2
Caption
Tags
Target Marketplace
Instruksi Revisi
```

Actions:

```text
Buat Prompt
Buat Ulang
Tandai Siap Flow
```

Prompt set structure:

- Prompt Clip 1 and Prompt Clip 2 are separate clip panels.
- Each clip panel must expose `I2I First Frame`, `I2I Last Frame`, and `I2V Prompt` as editable fields.
- `I2I First Frame` and `I2I Last Frame` are the two frame anchors for the clip-specific image-to-image prompt path.
- `I2V Prompt` is the motion-oriented text for the clip-specific image-to-video path.
- Caption is shared across the prompt set.
- Tags are stored and rendered as a hashtag string.
- Target Marketplace is a fixed read-only chip for `Shopee + TikTok`.
- Instruksi Revisi is explicit input for regeneration only.
- The selected version is what gets frozen for Flow readiness.

## Required Prompt Persistence

Prompt generation must persist structured JSON with at least:

```json
{
  "product_analysis": {},
  "prompt_context": {},
  "i2i_prompts": {
    "clip_1": "",
    "clip_2": ""
  },
  "i2v_prompts": {
    "clip_1": "",
    "clip_2": ""
  },
  "caption": "",
  "tags": [],
  "target_marketplace": "",
  "negative_prompt_rules": [],
  "consistency_rules": [],
  "seed_character": {
    "locked": false,
    "notes": "",
    "drive_item_ref_id": null
  },
  "environment": {
    "locked": false,
    "notes": "",
    "drive_item_ref_id": null
  }
}
```

`prompt_context` must be persisted in `prompt_packs.personalization_json`.

## Prompt Rule Locks

- i2i, i2v, caption, hashtag, and negative prompt rules must be editable in Affiliate Profile UI.
- Prompt rules must not be hardcoded in JSX, HTML, route handlers, or inline strings.
- Do not claim visual parsing from links when image bytes are missing.
- Use text fallback only when image bytes are not available and label it honestly.
- Do not add a third background-reference asset slot in Phase awal.

## Versioning

- Prompt packs must be versioned.
- Regeneration must preserve previous versions or history.
- Review status must stay explicit.
- `Tandai Siap Flow` moves the selected version into Flow Control readiness.

## Flow Control Handoff

- Flow Control is the execution workspace.
- Ready prompt packs move into the global Flow account pool.
- Flow accounts are not owned by workspace.
- Account recommendation is based on availability, observed credit, and status.
- User confirms the account before running Flow.
