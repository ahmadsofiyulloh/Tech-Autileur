# Gemini Key Routing Lock

## Free Tier Setup - Recommended

Use separate Google AI Studio projects/API keys when available, but keep the UI minimal.

```text
Project/Key 1: Gemini vision-capable model
Role: VISION_ANALYSIS
Task: product image + marketplace screenshot analysis

Project/Key 2: Gemini prompt lane
Role: I2V_PROMPT / I2I_PROMPT / CONSISTENCY_CHECK
Task: Paket Prompt generation and regeneration

Project/Key 3: Gemini fallback/repair model optional
Role: PROMPT_REPAIR / FALLBACK
Task: prompt repair or retry
```

## Workload Per Product

Minimum Phase awal workflow:

```text
1 vision analysis from uploaded image bytes
1 prompt pack generation for 2 clips
optional prompt regeneration when user submits Instruksi Revisi
```

Do not expose extra Gemini task fields in the main UI unless the workflow needs them.

The Gemini settings surface is a multi-key list-card CRUD surface. Visible editable fields are `name`, `project`, `model`, `purpose`, and masked `encrypted API key` controls. Create/edit happen in a drawer, row actions are Kelola and Disable, and it is not a history page. Test, Copy Key, and Regenerate stay out of scope for the MVP UI.

Quota fields (`RPM`, `RPD`, `TPM`) must not be editable operator fields in Phase awal. They are stored from the selected model defaults when a Gemini key is created or updated. The operator changes quota by changing the selected model, not by typing limit numbers. Active Google AI Studio limits can still vary by project tier and account state; AI Studio remains the external source for the provider-side active quota.

Active Gemini keys must carry a non-empty `project` value so the usage overview can group by `project + model`; inactive keys may leave it blank.

`/settings` may show a compact Gemini usage overview directly below the topbar content. It is a usage summary, not a request log. The visual should stay minimal: one inline header row with `Penggunaan Gemini` and key count, then only the carousel when keys exist. Do not render `Usage belum tersedia` or empty-state copy in this panel. Each carousel slide uses a thick, static donut chart on the left half and quota numbers on the right half; the donut should not show tooltip/focus framing on tap. Key label, model, status, and purpose are plain text only, not badges. When more than one key exists, mobile must support horizontal swipe between keys. Usage is counted from app-recorded Gemini calls and grouped by `project + model` when `project` is filled, matching the Google AI Studio quota boundary more closely than a per-key-only count. If `project` is empty, the app falls back to per-key grouping.

Usage calculation rules:

- `RPD` counts app Gemini request attempts from the current Google quota day, reset at midnight Pacific time.
- `RPM` counts app Gemini request attempts in the last rolling 60 seconds.
- `TPM` sums Gemini `usageMetadata.promptTokenCount` in the last rolling 60 seconds.
- Failed and rate-limited attempts remain counted as request attempts because they consumed an app-side call attempt.
- Gemini key secrets must never be exposed to the overview client component.

## Routing Rules

- `VISION_ANALYSIS` -> role `VISION_ANALYSIS`.
- `PROMPT_PACK_GENERATION` -> role `I2V_PROMPT`, `I2I_PROMPT`, `CONSISTENCY_CHECK`, `PROMPT_REPAIR`, or `FALLBACK`.
- `PROMPT_REPAIR` -> role `PROMPT_REPAIR` or `FALLBACK`.
- `CONSISTENCY_CHECK` -> role `CONSISTENCY_CHECK` or `FALLBACK`.

## Prompt Pack Context

A prompt pack must consume UI-editable rules from the active Affiliate Profile and must not hardcode i2i, i2v, caption, hashtag, or negative prompt logic in code.

Required context:

- reviewed Prompt Essentials.
- active workspace.
- selected or workspace-default-linked Affiliate Profile.
- profile-owned character lock.
- profile-owned environment lock.
- uploaded image/screenshot context when bytes are available.

The environment asset is the background lock asset. Do not add a third background-reference asset slot in MVP.

## Failure Rules

If a key is rate limited:

1. Mark key `RATE_LIMITED` or `COOLDOWN`.
2. Try another active key with compatible role.
3. If no key is available, set task `WAITING_FOR_KEY`.
4. Do not block manual review of already generated data.

## Output Rule

All AI outputs must be structured JSON and validated before saving.

Do not claim visual parsing from links when image bytes are not available.

## MVP Prompt Pack Output

A prompt pack should include:

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
  "consistency_rules": [],
  "negative_rules": []
}
```

`product_analysis.product.status` must be present and must mirror the source product record. It is not a model-inferred field.
