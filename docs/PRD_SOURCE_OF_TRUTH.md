# PRD v1 Final - Affiliate AI Content OS MVP

**Status:** LOCKED FOR MVP IMPLEMENTATION
**Version:** 1.0 Final
**Date:** 2026-05-02
**Primary Operator:** Single owner/operator
**Implementation Target:** Next.js PWA + Supabase + Google Drive + Gemini API + Google Flow workflow
**Implementation Mode:** Codex CLI with strict source-of-truth docs and Git checkpoints

---

## 0. Executive Summary

Affiliate AI Content OS is a private mobile-first operator tool for AI affiliate content production. The system manages product intake, prompt personalization, Google Flow execution, Drive-based asset metadata, and output history from a single control plane.

This MVP is an AI production control center. It is not a video editor, not an auto-uploader, and not a custom remote desktop engine.

---

## 1. Locked App Flow and UX

### 1.1 Main Navigation

Main navigation is exactly:

```text
Dashboard
Products
Controller
Settings
```

Mobile bottom nav is the same four items. Desktop sidebar is the same four items.

### 1.2 Route Lock

```text
/products       -> product list only
/products/new   -> intake workflow entrypoint
/products/[id]  -> product detail with Metadata, Output, History tabs
/controller     -> execution workspace
/settings       -> configuration hub
```

Compatibility routes remain available, but are not primary navigation:

```text
/intake   -> /products/new
/flow     -> /controller
/prompts  -> compatibility manager only
/outputs  -> compatibility view only
/gemini   -> primarily accessed from Settings
/drive    -> primarily accessed from Settings
```

### 1.3 Required Step Order

```text
Intake form
-> Prompt editor/generator
-> Controller
-> Output/history
```

Prompt and Output are not primary navigation pages. They live inside the workflow and product detail surfaces.

### 1.4 Intake UX

- Product image and screenshot inputs use upload cards with local preview.
- The UI can show overlay action buttons on the card placeholder.
- Do not claim visual parsing from links when image bytes are not available.
- If image bytes are missing, use text fallback only.

### 1.5 Dashboard

Dashboard is the operator entrypoint and should eventually show:

- API usage
- token usage, if available, or estimated token usage
- generated file count
- Drive item count
- prompt/task counts
- simple donut and line charts if the data exists

### 1.6 Settings Hub

Settings is the configuration hub for:

- Workspace Profiles
- Gemini
- Drive
- Flow Accounts / Tools
- Affiliate Profiles
- Prompt Personalization
- Account/logout

---

## 2. Product Vision

1. Reduce manual work in intake and prompt preparation.
2. Keep image, screenshot, prompt, and output context organized by product and workspace.
3. Keep Flow accounts global execution tools, not workspace-bound.
4. Allow unlimited affiliate profiles with UI-editable prompt rules.
5. Make the operator workflow mobile-friendly without building a custom remote desktop engine.
6. Keep Supabase as metadata source of truth and Google Drive as asset source of truth.

---

## 3. MVP Definition

MVP means the system can:

- Capture product intake once.
- Save intake in the active workspace when one exists.
- Advance from intake into a prompt editor/generator step.
- Persist prompt pack JSON.
- Queue work into Controller and assign available Flow accounts.
- Track output history on the product detail page.
- Support workspace-scoped affiliate profiles with editable prompt personalization.
- Support dashboard usage analytics.

---

## 4. Locked Architecture

### 4.1 Frontend

```text
Framework: Next.js PWA
Language: TypeScript strict
UI: Mobile-first responsive control center
```

### 4.2 Auth

```text
Provider: Supabase Auth
User model: single owner/operator
Team/role permission: out of scope MVP
```

### 4.3 Database

```text
Database: Supabase Postgres
Metadata source of truth: Supabase
RLS: enabled on all owner-owned tables
```

### 4.4 Asset Storage

```text
Asset/file source of truth: Google Drive
Supabase Storage: not used for large video/image assets in MVP
Supabase stores: Drive item metadata, URLs, paths, MIME type, status, relations
```

### 4.5 AI

```text
AI provider: Gemini API
Keys: encrypted and server-only
Structured JSON outputs: required
Prompt rules: editable in UI, not hardcoded in JSX/HTML
```

### 4.6 Execution

```text
Google Flow is the external executor
Controller manages a global Flow tool pool
Flow accounts are global tools and never workspace-bound
```

### 4.7 Mobile Control

```text
Mobile PWA is the operator control hub
Remote desktop is external
Custom remote desktop engine: out of scope
```

---

## 5. Source of Truth Hierarchy

| Area | Source of Truth |
|---|---|
| App flow and nav | This PRD |
| Architecture | Locked Architecture section |
| Metadata | Supabase Postgres |
| File and asset metadata | Google Drive item metadata in Supabase |
| AI key/project status | Supabase |
| AI task queue | Supabase |
| Prompt rules | UI-editable profile settings + prompt pack JSON |
| Flow execution | Google Flow + Controller manifest |
| Output history | Supabase + Drive metadata |
| Analytics | Supabase + derived estimates when needed |

---

## 6. Core MVP Features

### 6.1 Dashboard

- Entry point for the operator.
- Shows usage analytics and top-level status.
- Links into Products, Controller, and Settings.

### 6.2 Products

- `/products` is list only.
- `/products/new` is the intake workflow.
- `/products/[id]` shows Metadata, Output, and History.

### 6.3 Intake

- Accepts product image and screenshot uploads.
- Supports draft/autosave and main submit.
- Inherits the current workspace when one is active.
- Main submit moves the workflow forward when minimum data is present.

### 6.4 Prompt Personalization

- Unlimited affiliate profiles.
- Workspace-scoped profiles.
- UI-editable i2i, i2v, caption, hashtag, negative prompt, niche notes, seed lock, and environment lock rules.

### 6.5 Controller

- Global Flow tool pool.
- Queue and execution control.
- Flow account selection based on availability and credit.
- Output/import status tracking.

### 6.6 Settings

- Workspace Profiles
- Gemini
- Drive
- Flow Accounts / Tools
- Affiliate Profiles
- Prompt Personalization
- Account/logout

---

## 7. Non-Goals / Do Not Build in MVP

- Auto upload TikTok/Shopee
- Video editor inside the PWA
- Custom remote desktop engine
- Multi-user/team permissions
- Google Flow Business/Enterprise/Pro support
- Browser automation that clicks Google Flow automatically
- Hardcoded prompt rules in code
- Workspace-bound Flow accounts
- Fixed-count affiliate profiles
- Claims of visual parsing from links when image bytes are not available
- Supabase Storage for large video/image assets
- Bypassing provider quotas or rate limits

---

## 8. Status Rules

### 8.1 Intake Status

```text
DRAFT
SUBMITTED
NEEDS_REVIEW
REVIEWED
ANCHOR_READY
```

- `DRAFT` is only for incomplete draft/autosave.
- `SUBMITTED` is used when the operator clicks the main save/submit action.
- `NEEDS_REVIEW` is used when parsed or generated metadata needs review.
- `REVIEWED` is used after operator review.
- `ANCHOR_READY` is used when anchor data is ready for downstream prompt generation.

### 8.2 Product Detail Surfaces

Product detail history may include prompt pack versions, controller assignments, output imports, and review events.

---

## 9. Final MVP Lock Statement

```text
Affiliate AI Content OS MVP is a private AI production control center.

It manages product intake, prompt personalization, Controller-based Flow execution, Drive-based asset metadata, output history, and dashboard analytics.

It does not generate videos internally, edit videos, auto-upload to TikTok/Shopee, or build a custom remote desktop engine.
```
