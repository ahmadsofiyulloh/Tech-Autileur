# Backlog Streams - MVP

## Stream Overview

| Stream | Name | Purpose | Owner |
|---|---|---|---|
| S0 | Project Control | Docs, AGENTS, repo rules, quality gates | Codex + User review |
| S1 | App Shell | Intake/Produk/Prompt/Drive nav, topbar Settings gear, route lock, settings/account shell, compatibility routes | Codex |
| S2 | Intake Workflow | `/products/new`, real image/screenshot uploads, Gemini analysis | Codex |
| S3 | Paket Prompt | Affiliate personas, workspace links, prompt rules, editor/generator, versioning, prompt context | Codex |
| S4 | Flow Control | global Flow pool, board, manifest, Windows Helper callback | Codex |
| S5 | Product Detail | Metadata, Output, History surfaces | Codex |
| S6 | Pengaturan Hub | grouped native Settings overview, workspace, affiliate profile drawer, Gemini, Drive, Flow link, Account, helper token, picker grammar, nested routing, list drawer table/card grammar | Codex |
| S7 | Dashboard Analytics | secondary Gemini, Drive, prompt, output/import metrics | Codex |
| S8 | Hardening | build, tests, minimal copy, security pass | Codex + User review |

## Recommended Build Order

```text
S0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7 -> S8
```

## First Vertical Slice

```text
Login
-> /products/new Intake
-> Produk list
-> /products/new upload Foto Produk Utama + Screenshot Shopee + Screenshot TikTok
-> Analisis Gemini
-> Metadata review
-> Affiliate Profile selector
-> Paket Prompt
-> Drive visual grid/gallery
-> Pengaturan via topbar gear
-> Pengaturan > Account pairing/token
-> Output package/history
```
