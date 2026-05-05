# Prompt Pipeline Lock - Intake -> Paket Prompt -> Output

## Purpose
This lock defines how uploaded product evidence becomes generated prompt packs. Prompt generation must follow user-owned Affiliate Profile rules and must not invent hardcoded prompt rules in UI/code.

## Locked Flow

```text
/products/new upload
-> Analisis Gemini
-> Metadata review
-> Buat Prompt
-> Paket Prompt generated output
-> Buat Ulang bila perlu
-> Output/history
```

## Required Intake Inputs

Before `Analisis Gemini`, only upload evidence is required.

Required:

- `Foto Produk Utama`: at least 1 image byte upload.
- `Screenshot Shopee`: at least 1 Shopee screenshot byte upload.
- `Screenshot TikTok`: at least 1 TikTok screenshot byte upload.

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
```

## Prompt Personalization Inputs

Prompt generation must consume:

- reviewed product metadata.
- uploaded product image and screenshot context when bytes are available.
- workspace context.
- selected or workspace-default-linked Affiliate Profile.
- Affiliate Profile i2i, i2v, caption, hashtag, and negative rules.
- Affiliate Profile character lock.
- Affiliate Profile environment lock.
- Drive item references for profile assets.

Character and environment are profile-owned only in Phase awal. The environment asset is the background-lock asset for prompt generation. Prompt pages must not create per-prompt overrides for these locks.

If a selected profile lock is enabled but the matching Drive reference is missing, prompt generation must fail instead of falling back to another profile or an unlocked asset.

Prompt generation must also consume the active workspace's reviewed Gemini output and must not invent any extra profile asset slot beyond character and environment.

## Required Prompt UI

Surface label:

```text
Paket Prompt
```

Read-only generated output fields:

```text
Prompt Clip 1
Prompt Clip 2
Caption
Tags
Target Marketplace
```

Editable regeneration field:

```text
Instruksi Revisi
```

Actions:

```text
Buat Prompt
Buat Ulang
```

Prompt set structure:

- `/prompts` is a list/launcher surface.
- `/prompts/[id]` is the prompt detail/editor surface.
- `/prompts/[id]/history` is the prompt-only generation history surface, grouped by `prompt_code`.
- Prompt Clip 1 and Prompt Clip 2 are separate collapsed clip panels that can expand.
- Each clip panel must expose `I2I First Frame`, `I2I Last Frame`, and `I2V Prompt` as read-only copy-ready fields.
- `I2I First Frame` and `I2I Last Frame` are the two frame anchors for the clip-specific image-to-image prompt path.
- `I2V Prompt` is the motion-oriented text for the clip-specific image-to-video path.
- Caption is shared across the prompt set and is read-only copy-ready after generation.
- Tags are stored and rendered as a hashtag string and are read-only copy-ready after generation.
- Target Marketplace is a fixed read-only chip for `Shopee + TikTok`.
- Instruksi Revisi is explicit input for regeneration only.
- `GENERATED` is the Phase 1 final operator-facing prompt status.
- `APPROVED`/controller readiness is retained for dormant Flow compatibility only and is not exposed as a Phase 1 prompt action.

## Required Prompt Persistence

Prompt generation must persist structured JSON with at least:

```json
{
  "product_analysis": {
    "product": {
      "id": "",
      "product_code": "",
      "product_name": "",
      "niche": null,
      "marketplace": null,
      "marketplace_product_link": null,
      "status": ""
    }
  },
  "prompt_context": {},
  "i2i_prompts": {
    "clip_1": {
      "first_frame": "",
      "last_frame": ""
    },
    "clip_2": {
      "first_frame": "",
      "last_frame": ""
    }
  },
  "i2v_prompts": {
    "clip_1": "",
    "clip_2": ""
  },
  "caption": "",
  "tags": "",
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

`product_analysis.product.status` is mandatory and must be copied from the source product record. The model must not infer or invent this value.

When a source product image exists, `product_analysis.source_image` must echo the source image record and include `id`, `is_primary`, `status`, `source_type`, and `drive_item_ref_id`. The server may backfill missing source_image fields from the source image record, but mismatched values are contract errors.

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
- Generated prompt versions are final copy-ready outputs for Phase 1.
- History must preserve the generate/regenerate notes for prompt versions with the same `prompt_code`.

## Flow Control Handoff

- Flow Control is frozen in Phase 1.
- Ready prompt packs moving into the global Flow account pool is retained backend compatibility, not a Phase 1 UI action.
- Flow accounts are not owned by workspace.
- Flow account management belongs to the retained `/controller` support panels, not Settings CRUD.
- Account recommendation is based on availability, observed credit, and status.
- User confirms the account before running Flow.
- Desktop execution details, including helper staging and Chrome profile reuse, live in [FLOW_HELPER_DESKTOP_WORKFLOW.md](FLOW_HELPER_DESKTOP_WORKFLOW.md).
