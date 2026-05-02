# Gemini Key Routing Lock

## Free Tier Setup — Recommended
Use 3 separate Google AI Studio projects/API keys for maximum quality and efficiency.

```text
Project/Key 1: Gemini 2.5 Pro
Role: VISION
Task: product image analysis

Project/Key 2: Gemini 2.5 Flash-Lite
Role: I2I
Task: high-volume i2i prompt generation

Project/Key 3: Gemini 2.5 Flash
Role: I2V / CONSISTENCY / PROMPT_REPAIR
Task: i2v prompt generation and consistency checking
```

## Workload Per Content
```text
1 vision analysis
4 i2i prompts:
  - clip 01 start frame
  - clip 01 last frame
  - clip 02 start frame
  - clip 02 last frame
2 i2v prompts:
  - clip 01
  - clip 02
= 7 logical Gemini tasks per content
```

## Routing Rules
- `VISION_ANALYSIS` → role `VISION`, preferred model Gemini 2.5 Pro.
- `I2I_PROMPT_PACK` → role `I2I`, preferred model Gemini 2.5 Flash-Lite.
- `I2V_PROMPT_PACK` → role `I2V`, preferred model Gemini 2.5 Flash.
- `CONSISTENCY_CHECK` → role `CONSISTENCY`, preferred model Gemini 2.5 Flash.
- `PROMPT_REPAIR` → role `I2V` or `FALLBACK`.
- `QA` → optional, preferred model Gemini 2.5 Pro.

## Failure Rules
If a key is rate limited:

1. Mark key `RATE_LIMITED` or `COOLDOWN`.
2. Try another active key with compatible role.
3. If no key available, set task `WAITING_FOR_KEY`.
4. Do not block manual workflow.

## Output Rule
All AI outputs must be structured JSON and validated before saving.

## MVP Prompt Pack Output
A prompt pack must include:

```json
{
  "product_analysis": {},
  "i2i_prompts": {
    "clip_01_start_frame": "",
    "clip_01_last_frame": "",
    "clip_02_start_frame": "",
    "clip_02_last_frame": ""
  },
  "i2v_prompts": {
    "clip_01": "",
    "clip_02": ""
  },
  "consistency_rules": [],
  "risk_notes": []
}
```
