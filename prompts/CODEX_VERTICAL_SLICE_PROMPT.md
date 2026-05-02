# Codex Prompt — First Vertical Slice

```text
Implement the first MVP vertical slice only.

Read:
- AGENTS.md
- docs/PRD_SOURCE_OF_TRUTH.md
- docs/ARCHITECTURE_LOCK.md
- docs/DO_NOT_BUILD.md
- docs/MICRO_TASK_BACKLOG.md

Vertical slice:
Login
→ Add Gemini key metadata
→ Add product
→ Attach source image Drive URL manually
→ Run mock vision/prompt pipeline
→ Create C01/C02 clip jobs
→ Export Flow prompt TXT

Use mock mode for Gemini and Drive.
Do not implement real Gemini calls yet.
Do not implement real Google Drive OAuth yet.
Do not implement upload package yet.
Do not build post-MVP features.

Before coding, list files likely to change and ask for approval if the scope is larger than this vertical slice.
After coding, run lint/typecheck/build and summarize changed files.
```
