# Gemini Key Routing Lock

## Free Tier Setup - Recommended

Use separate Google AI Studio projects/API keys when available, but keep the UI minimal.

```text
Project/Key 1: Gemini vision-capable model
Role: VISION
Task: product image + marketplace screenshot analysis

Project/Key 2: Gemini prompt model
Role: PROMPT
Task: Paket Prompt generation and regeneration

Project/Key 3: Gemini fallback/repair model optional
Role: FALLBACK
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

The Gemini settings surface is a single minimal form with `name`, `model`, `purpose`, and masked `encrypted API key` controls only. It is not a list or history page.

## Routing Rules

- `VISION_ANALYSIS` -> role `VISION`.
- `I2I_PROMPT_PACK` -> role `PROMPT`.
- `I2V_PROMPT_PACK` -> role `PROMPT`.
- `PROMPT_REPAIR` -> role `PROMPT` or `FALLBACK`.
- `CAPTION_TAGS` -> role `PROMPT`.
- `RISK_CHECK` -> role `PROMPT` or `FALLBACK`.

## Prompt Pack Context

A prompt pack must consume UI-editable rules from the selected Affiliate Profile and must not hardcode i2i, i2v, caption, hashtag, or negative prompt logic in code.

Required context:

- reviewed Prompt Essentials.
- active workspace.
- selected workspace-scoped Affiliate Profile.
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
  "consistency_rules": [],
  "negative_rules": []
}
```
