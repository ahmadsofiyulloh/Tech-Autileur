# Prompt Pipeline Lock — Vision → i2i → i2v

## Purpose
This is the core production pipeline. Every content unit produces two clips, and each clip needs start/last frame prompts plus one i2v prompt.

## Per Content Workload
```text
1 product vision analysis
4 i2i prompts
2 i2v prompts
```

## Pipeline
```text
Product source image
→ Vision analysis
→ i2i prompt pack
→ i2i result images attached from Drive
→ i2v prompt pack
→ C01/C02 clip jobs
→ Flow batch export
→ generated clips import
```

## Content Structure
```text
Content CT001
  Clip C01
    i2i_start_frame_prompt
    i2i_last_frame_prompt
    i2v_prompt
  Clip C02
    i2i_start_frame_prompt
    i2i_last_frame_prompt
    i2v_prompt
```

## Prompt Requirements
- Must preserve product identity.
- Must preserve scene continuity between start frame, last frame, and video prompt.
- Must avoid text/logo overlays unless product has actual logo.
- Must be vertical UGC compatible.
- Must be output as structured JSON.

## Prompt Prefix
Format:

```text
PRODUCTCODE_CONTENTCODE_CLIPCODE_VERSION_FLOWACCOUNT_BATCHCODE_SCENETYPE_PRODUCTSHORTNAME
```

Example:

```text
HORG0001_CT001_C01_V01_FLOWFREE01_B20260502A_START_RAKKAMARMANDI
```

Rules:

- Prefix must be at the start of exported Flow prompt.
- Prefix uses underscores.
- No blank line before prompt.
- One prompt = one continuous paragraph.
- Avoid filename-risk characters: `/ \ : * ? " < > |`.

## Structured Output Contract
```json
{
  "content_code": "CT001",
  "clips": [
    {
      "clip_code": "C01",
      "i2i_start_frame_prompt": "",
      "i2i_last_frame_prompt": "",
      "i2v_prompt": "",
      "continuity_notes": []
    },
    {
      "clip_code": "C02",
      "i2i_start_frame_prompt": "",
      "i2i_last_frame_prompt": "",
      "i2v_prompt": "",
      "continuity_notes": []
    }
  ],
  "global_consistency_rules": [],
  "risk_notes": []
}
```
