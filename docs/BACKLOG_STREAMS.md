# Backlog Streams - MVP

## Stream Overview

| Stream | Name | Purpose | Owner |
|---|---|---|---|
| S0 | Project Control | Docs, AGENTS, repo rules, quality gates | Codex + User review |
| S1 | App Shell | Next.js PWA, top-level nav, compatibility routes | Codex |
| S2 | Intake Workflow | `/products/new`, image/screenshot upload cards, submit flow | Codex |
| S3 | Prompt Personalization | Affiliate profiles, prompt rules, editor/generator | Codex |
| S4 | Controller | Global Flow tool pool, queueing, execution control | Codex |
| S5 | Product Detail | Metadata, Output, History surfaces | Codex |
| S6 | Settings Hub | Workspace profiles, Gemini, Drive, Flow tools, profiles | Codex |
| S7 | Dashboard Analytics | API, token, file, Drive, prompt/task metrics | Codex |
| S8 | Hardening | Build, tests, docs, security pass | Codex + User review |

## Recommended Build Order
```text
S0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7 -> S8
```

## First Vertical Slice
```text
Login
-> Dashboard
-> Products list
-> Intake form with upload cards
-> Prompt editor/generator
-> Controller
-> Output/history
```
