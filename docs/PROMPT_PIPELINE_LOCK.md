# Prompt Pipeline Lock - Intake -> Prompt Editor/Generator -> Controller

## Purpose
This is the core prompt workflow. The prompt step is an editor/generator inside the workflow, not a primary navigation page.

## Locked Flow
```text
Intake data
-> Prompt editor
-> Prompt generator
-> Controller queue
-> Flow export
-> Output/history
```

## Inputs
Prompt generation must consume:

- product intake data
- reviewed product metadata
- product image and screenshot context when bytes are available
- marketplace source metadata
- affiliate profile prompt rules
- seed character lock and environment lock flags
- Drive item references for seed/environment assets

## Prompt Rule Locks
- i2i, i2v, caption, hashtag, and negative prompt rules must be editable in UI.
- Prompt rules must not be hardcoded in JSX, HTML, or inline strings.
- Do not claim visual parsing from links when image bytes are missing.
- Use text fallback only if no real image bytes exist.

## Required Prompt Output
Prompt generation should persist structured JSON with at least:

```json
{
  "product_analysis": {},
  "prompt_context": {},
  "i2i_prompts": {},
  "i2v_prompts": {},
  "caption_rules": [],
  "hashtag_rules": [],
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

## Prompt Prefix
The exported prompt prefix format remains naming-safe and must appear at the start of the exported prompt text.

## Controller Handoff
- The Controller is the execution workspace.
- Ready prompt packs move into the global Flow tool pool.
- Flow accounts are not owned by workspace.
- Account selection is based on availability, credit, and status.

## Versioning
- Prompt packs must be versioned.
- Regeneration must preserve previous versions.
- Review status must stay explicit in the stored JSON or related metadata.
