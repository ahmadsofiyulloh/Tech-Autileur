# Backlog Streams — MVP

## Stream Overview

| Stream | Name | Purpose | Owner |
|---|---|---|---|
| S0 | Project Control | Docs, AGENTS, repo rules, quality gates | Codex + User review |
| S1 | App Foundation | Next.js PWA, TypeScript, layout, env | Codex |
| S2 | Supabase Foundation | Auth, schema, RLS, MCP database creation | Codex + User approval |
| S3 | Gemini Manager | Key registry, roles, routing, usage | Codex + User keys |
| S4 | AI Task Queue | Task execution, retries, JSON validation | Codex |
| S5 | Drive Manager | Drive metadata, folders, file attach/import | Codex + User OAuth |
| S6 | Product & Content | Product, image, content, clip jobs | Codex |
| S7 | Prompt Pipeline | Vision → i2i → i2v generation | Codex + User quality review |
| S8 | Flow Batch Bridge | Capacity, batch, TXT/JSON export | Codex |
| S9 | Import Results | Folder scan, prefix matching, unmatched | Codex |
| S10 | Review Board | Approve/reject/regenerate/attach final | Codex + User judgment |
| S11 | Mobile Control | Mobile workflow hub + remote launcher | Codex + User remote setup |
| S12 | Upload Package | TikTok/Shopee package, copy, post URL | Codex + User upload |
| S13 | Hardening | Build, test, docs, security pass | Codex + User review |

## Recommended Build Order
```text
S0 → S1 → S2 → S3 → S4 → S6 → S7 → S8 → S5 → S9 → S10 → S11 → S12 → S13
```

## First Vertical Slice
```text
Login
→ Add Gemini key metadata
→ Add product
→ Attach source image Drive URL
→ Run mock vision/prompt pipeline
→ Create C01/C02 clip jobs
→ Export Flow prompt TXT
```
