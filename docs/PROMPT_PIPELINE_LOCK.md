# Prompt Pipeline Lock - Intake -> Paket Prompt -> Output

## Purpose
This lock defines how uploaded product evidence becomes generated prompt packs. Prompt generation must follow user-owned Affiliate Profile rules and must not invent hardcoded prompt rules in UI/code.

## Locked Flow

```text
/products/new upload product image
-> Simpan Produk
-> complete Shopee + TikTok screenshot evidence
-> Analisis Metadata
-> Metadata review
-> Buat Prompt
-> Paket Prompt generated output
-> Buat Ulang bila perlu
-> Output/history
```

## Required Intake Inputs

Before `Simpan Produk`, only upload evidence is required and no manual metadata fields are shown.

Minimum for `Simpan Produk`:

- `Foto Produk Utama`: at least 1 image byte upload.

Minimum for `Analisis Metadata`:

- `Foto Produk Utama`: at least 1 image byte upload.
- `Screenshot Shopee`: at least 1 Shopee screenshot byte upload.
- `Screenshot TikTok`: at least 1 TikTok screenshot byte upload.

Optional:

- additional product images.
- additional marketplace screenshots.

Forbidden before metadata analysis:

- product title field.
- marketplace account field.
- manual product metadata fields.
- claiming visual analysis from links without image bytes.

Lifecycle lock:

- `Simpan Produk` persists a recoverable product/intake draft before Gemini success.
- saved products remain `DRAFT` while metadata is pending, generating, failed, or waiting for review.
- `Analisis Metadata` is retryable and must not discard the saved product on failure.
- `Buat Prompt` is the first action blocked by Affiliate Profile readiness.

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
- active Affiliate Profile.
- the active Affiliate Profile's internal workspace/folder namespace.
- Affiliate Profile i2i, i2v, caption, hashtag, and negative rules.
- Affiliate Profile character lock.
- Affiliate Profile environment lock.
- Drive item references for profile assets.

Character and environment are profile-owned only in Phase awal. The environment asset is the background-lock asset for prompt generation. Prompt pages must not create per-prompt overrides for these locks.

Character and environment assets are analyzed explicitly from the Settings drawer and their JSON metadata snapshots are cached on the affiliate profile. Save/update only stores the Drive refs and rules; prompt generation must reuse the cached JSON metadata snapshots until the asset reference changes, and the cached snapshot is only valid while its `drive_item_ref_id` still matches the current Drive reference.

Create prompt and regenerate prompt must read the same cached analysis JSON from `prompt_context.reference_cards` and the affiliate profile snapshots. `drive_url` and `drive_path` are display metadata only for visual references; prompt-facing cards must be compact mention-based JSON built from `@original_file_name`, not raw analysis blobs, and legacy empty values must be accepted as null-equivalent.

If an active profile lock is enabled but the matching Drive reference or cached analysis JSON is missing, prompt generation must fail instead of falling back to another profile or an unlocked asset.

Prompt generation must also consume reviewed Gemini output inside the active Affiliate Profile namespace and must not invent any extra profile asset slot beyond character and environment.

Retryable Gemini temporary-unavailable failures from intake and prompt actions should surface as warning redirects, not silent failures, so the operator can dismiss the message and retry from the same surface.

2026-05-06 strict readiness guards before `Buat Prompt` or `Buat Ulang`:

- active Affiliate Profile is required.
- the profile's internal namespace must resolve.
- source product image with Drive reference is required.
- reviewed Gemini metadata is required.
- all six rule groups must be non-empty: i2i, i2v, caption, hashtag, negative, product positioning.
- if `Lock Character` is ON, character Drive reference and `seed_character_analysis_json` are required.
- if `Lock Environment` is ON, environment Drive reference and `environment_analysis_json` are required.
- no runtime fallback may select another profile, create empty rules, or downgrade to legacy prompt fields.

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

Prompt Clip 1 and Prompt Clip 2 are copy-ready read-only JSON prompt payloads in the UI, not prose text. The UI surface stays the same; only the copied value changes. Generated copy fields use `schema_version: "prompt_pack_v2"` and must not expose raw `visual_references` or raw `prompt_rules`.

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
- Each clip panel must expose `I2I First Frame`, `I2I Last Frame`, and `I2V Prompt` as read-only copy-ready JSON fields.
- `I2I First Frame` must use three image inputs: `@character`, `@environment`, and the product mention from the source product image/reference card.
- `I2I Last Frame` must use only `@firstframe`; it must not repeat the original three reference images.
- `I2V Prompt` must use only `@firstframe` and `@lastframe`; it must not include character/environment/product reference images again.
- I2V duration is locked to `8` seconds with four timeline windows: `00:00-00:02`, `00:02-00:04`, `00:04-00:06`, `00:06-00:08`.
- Clip 1 is the hook/hero look. Clip 2 is the detail/benefit/use-case look.
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
  "prompt_context": {
    "reference_cards": []
  },
  "i2i_prompts": {
    "clip_1": {
      "first_frame": {
        "schema_version": "prompt_pack_v2",
        "slot": "clip_1",
        "stage": "i2i_first_frame",
        "image_inputs": ["@character", "@environment", "@product"],
        "prompt_text": "",
        "must_keep": [],
        "must_avoid": []
      },
      "last_frame": {
        "schema_version": "prompt_pack_v2",
        "slot": "clip_1",
        "stage": "i2i_last_frame",
        "image_inputs": ["@firstframe"],
        "prompt_text": "",
        "must_keep": [],
        "must_avoid": []
      }
    },
    "clip_2": {
      "first_frame": {
        "schema_version": "prompt_pack_v2",
        "slot": "clip_2",
        "stage": "i2i_first_frame",
        "image_inputs": ["@character", "@environment", "@product"],
        "prompt_text": "",
        "must_keep": [],
        "must_avoid": []
      },
      "last_frame": {
        "schema_version": "prompt_pack_v2",
        "slot": "clip_2",
        "stage": "i2i_last_frame",
        "image_inputs": ["@firstframe"],
        "prompt_text": "",
        "must_keep": [],
        "must_avoid": []
      }
    }
  },
  "i2v_prompts": {
    "clip_1": {
      "schema_version": "prompt_pack_v2",
      "slot": "clip_1",
      "stage": "i2v",
      "duration_seconds": 8,
      "frame_inputs": ["@firstframe", "@lastframe"],
      "timeline": [
        { "time": "00:00-00:02", "action": "" },
        { "time": "00:02-00:04", "action": "" },
        { "time": "00:04-00:06", "action": "" },
        { "time": "00:06-00:08", "action": "" }
      ],
      "motion_prompt": "",
      "camera_motion": "",
      "prompt_text": "",
      "continuity": "",
      "negative_prompt": ""
    },
    "clip_2": {
      "schema_version": "prompt_pack_v2",
      "slot": "clip_2",
      "stage": "i2v",
      "duration_seconds": 8,
      "frame_inputs": ["@firstframe", "@lastframe"],
      "timeline": [
        { "time": "00:00-00:02", "action": "" },
        { "time": "00:02-00:04", "action": "" },
        { "time": "00:04-00:06", "action": "" },
        { "time": "00:06-00:08", "action": "" }
      ],
      "motion_prompt": "",
      "camera_motion": "",
      "prompt_text": "",
      "continuity": "",
      "negative_prompt": ""
    }
  },
  "caption": "",
  "tags": "",
  "target_marketplace": "",
  "negative_prompt_rules": [],
  "consistency_rules": [],
  "seed_character": {
    "locked": false,
    "notes": "",
    "drive_item_ref_id": null,
    "analysis_json": null
  },
  "environment": {
    "locked": false,
    "notes": "",
    "drive_item_ref_id": null,
    "analysis_json": null
  }
}
```

`product_analysis.product.status` is mandatory and must be copied from the source product record. The model must not infer or invent this value.

When a source product image exists, `product_analysis.source_image` must echo the source image record and include `id`, `is_primary`, `status`, `source_type`, and `drive_item_ref_id`. The server may backfill missing source_image fields from the source image record, but mismatched values are contract errors.

`prompt_context` must be persisted in `prompt_packs.personalization_json`.

`prompt_context.reference_cards` must be present in `personalization_json` for generated prompt packs. Each card must carry `mention`, `role`, `summary`, `must_keep`, `must_avoid`, `instruction`, and nullable Drive metadata. `analysis_json` stays server-side cache only and must not be copied into prompt-facing copy JSON.

Prompt pack editor round-trips must not fail when legacy prompt JSON contains older `visual_references`/`prompt_rules` fields or when legacy visual references lack `drive_url` or `drive_path`. Legacy JSON must be readable and converted to v2 copy payloads during read/save. Prompt rules are internal generation policy and must be normalized from JSON-like blobs before use; they must not be copied as raw `prompt_rules` into I2I/I2V output fields.

## Prompt Rule Locks

- i2i, i2v, caption, hashtag, and negative prompt rules must be editable in Affiliate Profile UI.
- Prompt rules must not be hardcoded in JSX, HTML, route handlers, or inline strings.
- Prompt rules are internal policy inputs for generation. They may shape `prompt_text`, `must_keep`, `must_avoid`, `timeline`, `motion_prompt`, `camera_motion`, `continuity`, `negative_prompt`, caption, and tags, but must not be emitted as raw `prompt_rules` in copy-ready prompt fields.
- Do not claim visual parsing from links when image bytes are missing.
- Use cached JSON metadata snapshots instead of re-running OCR/vision on every prompt generation.
- Do not add a third background-reference asset slot in Phase awal.
- lock controls must be visible in the Affiliate Profile asset section with labels `Lock Character` and `Lock Environment`.
- do not add explanatory copy or helper paragraphs around lock controls.

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
