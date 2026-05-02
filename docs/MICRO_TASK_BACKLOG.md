# Micro-Task Backlog — Codex Work Queue

## Rules
- One micro-task per Codex session where possible.
- Do not skip dependencies.
- Do not combine unrelated streams.
- Every task must end with lint/typecheck/build where applicable.
- For Supabase MCP tasks, inspect and ask approval before applying.

---

# S0 — Project Control

## S0-001 — Create source-of-truth docs in repo
**Goal:** Add `/docs`, `AGENTS.md`, prompt templates, and scope guard docs.  
**Owner:** Codex  
**Depends on:** none  
**Acceptance:** docs exist, no code feature added.

## S0-002 — Add `.gitignore` and env safety
**Goal:** Ensure `.env*` local files are ignored and `.env.example` exists.  
**Owner:** Codex  
**Acceptance:** no real secrets, `.env.example` contains placeholders only.

## S0-003 — Add quality gate scripts
**Goal:** Add or confirm `lint`, `typecheck`, `build` scripts.  
**Owner:** Codex  
**Acceptance:** commands are documented and runnable.

---

# S1 — App Foundation

## S1-001 — Initialize Next.js PWA shell
**Goal:** Create base app with TypeScript strict and app router.  
**Owner:** Codex  
**Acceptance:** app boots, build passes.

## S1-002 — Add base layout and navigation
**Goal:** Add dashboard shell with mobile-first navigation.  
**Owner:** Codex  
**Acceptance:** routes render placeholder pages.

## S1-003 — Add env validation
**Goal:** Validate required environment variables server-side.  
**Owner:** Codex  
**Acceptance:** missing env produces clear error, no secrets exposed to client.

## S1-004 — Add shared UI states
**Goal:** Create reusable loading, empty, error, and confirm components.  
**Owner:** Codex  
**Acceptance:** components are used by at least one placeholder page.

---

# S2 — Supabase Foundation

## S2-001 — Configure Supabase clients
**Goal:** Add browser/server Supabase clients.  
**Owner:** Codex  
**User:** provides env values.  
**Acceptance:** client helpers compile.

## S2-002 — Create Supabase schema via migration/MCP plan
**Goal:** Prepare SQL for enums/tables/indexes/RLS based on schema lock.  
**Owner:** Codex  
**Acceptance:** SQL plan produced, no apply before approval.

## S2-003 — Apply schema with Supabase MCP
**Goal:** Use Supabase MCP to create database objects after user approval.  
**Owner:** Codex + User approval  
**Acceptance:** tables, enums, indexes, RLS policies exist.

## S2-004 — Implement auth pages
**Goal:** Login/logout and protected dashboard.  
**Owner:** Codex  
**Acceptance:** unauthenticated users redirected, authenticated users see dashboard.

## S2-005 — Add profile bootstrap
**Goal:** Ensure `profiles` row exists for authenticated user.  
**Owner:** Codex  
**Acceptance:** profile created or upserted safely.

---

# S3 — Gemini Manager

## S3-001 — Build Gemini key metadata CRUD
**Goal:** Add create/list/update/disable Gemini keys.  
**Owner:** Codex  
**Acceptance:** user can save metadata and encrypted key.

## S3-002 — Add key encryption helper
**Goal:** Encrypt/decrypt key server-side only.  
**Owner:** Codex  
**User:** provides `APP_ENCRYPTION_KEY`.  
**Acceptance:** encrypted value stored; raw key never sent to client after save.

## S3-003 — Add Gemini role/model validation
**Goal:** Validate VISION/I2I/I2V/CONSISTENCY/QA/FALLBACK roles and model names.  
**Owner:** Codex  
**Acceptance:** invalid combinations rejected.

## S3-004 — Add usage counter fields and reset placeholder
**Goal:** Track `requests_today`, `last_used_at`, `cooldown_until`.  
**Owner:** Codex  
**Acceptance:** counters update in mock execution.

---

# S4 — AI Task Queue

## S4-001 — Create AI task service
**Goal:** Create tasks with type, input JSON, priority, and status.  
**Owner:** Codex  
**Acceptance:** tasks can be queued and listed.

## S4-002 — Implement key picker by role
**Goal:** Pick active key matching task role/model.  
**Owner:** Codex  
**Acceptance:** rate-limited/disabled keys are skipped.

## S4-003 — Implement mock task runner
**Goal:** Run fake AI tasks and save structured output.  
**Owner:** Codex  
**Acceptance:** mock pipeline works with no external API.

## S4-004 — Implement real Gemini runner
**Goal:** Call Gemini server-side using selected encrypted key.  
**Owner:** Codex  
**User:** provides real keys.  
**Acceptance:** one safe test call succeeds.

## S4-005 — Add retry and waiting-for-key logic
**Goal:** Handle failures and rate limits.  
**Owner:** Codex  
**Acceptance:** failed tasks retry or wait without breaking UI.

---

# S5 — Drive Manager

## S5-001 — Add Drive file metadata CRUD
**Goal:** Store Drive file/folder metadata in Supabase.  
**Owner:** Codex  
**Acceptance:** files can be attached by URL manually.

## S5-002 — Add standard folder generator logic
**Goal:** Generate expected folder paths for product/batch.  
**Owner:** Codex  
**Acceptance:** paths match Drive lock doc.

## S5-003 — Add Google Drive OAuth placeholders
**Goal:** Prepare auth flow integration points.  
**Owner:** Codex  
**User:** sets up OAuth app.  
**Acceptance:** placeholders and routes exist without real secrets.

## S5-004 — Implement Drive API wrapper
**Goal:** List/create folders and list files once OAuth is ready.  
**Owner:** Codex  
**Acceptance:** wrapper has typed methods and mock mode.

## S5-005 — Build Drive file manager UI
**Goal:** Browse metadata, copy links, attach files.  
**Owner:** Codex  
**Acceptance:** mobile-friendly UI with loading/error/empty states.

---

# S6 — Product & Content

## S6-001 — Product CRUD
**Goal:** Add product create/list/detail/edit/archive.  
**Owner:** Codex  
**Acceptance:** products persist and are owner-scoped.

## S6-002 — Product code generator
**Goal:** Generate safe product codes like `HORG0001`.  
**Owner:** Codex  
**Acceptance:** unique per user.

## S6-003 — Attach source image
**Goal:** Link Drive file or URL as product source image.  
**Owner:** Codex  
**Acceptance:** product status moves to `IMAGE_ATTACHED`.

## S6-004 — Content create flow
**Goal:** Create content idea for product.  
**Owner:** Codex  
**Acceptance:** content code generated like `CT001`.

## S6-005 — Create C01/C02 clip jobs
**Goal:** Every content gets exactly two clip jobs for MVP.  
**Owner:** Codex  
**Acceptance:** C01/C02 created, no 1/3 clip template.

---

# S7 — Prompt Pipeline

## S7-001 — Vision analysis prompt template
**Goal:** Create structured prompt for product image analysis.  
**Owner:** Codex  
**Acceptance:** output schema defined and validated.

## S7-002 — i2i prompt pack template
**Goal:** Generate four i2i prompts per content.  
**Owner:** Codex  
**Acceptance:** start/last frame prompts exist for C01/C02.

## S7-003 — i2v prompt pack template
**Goal:** Generate two i2v prompts per content.  
**Owner:** Codex  
**Acceptance:** C01/C02 prompts preserve continuity.

## S7-004 — Prompt pack pipeline action
**Goal:** Run vision → i2i → i2v pipeline in mock mode.  
**Owner:** Codex  
**Acceptance:** content stores prompt pack JSON.

## S7-005 — Real Gemini pipeline
**Goal:** Use task queue and real Gemini keys.  
**Owner:** Codex  
**User:** reviews quality.  
**Acceptance:** one product produces valid prompt pack.

## S7-006 — Prompt versioning and repair
**Goal:** Create V02 when regenerate/repair requested.  
**Owner:** Codex  
**Acceptance:** previous prompt remains preserved.

---

# S8 — Flow Batch Bridge

## S8-001 — Flow account CRUD
**Goal:** Add FLOW_FREE/FLOW_PLUS account manager.  
**Owner:** Codex  
**Acceptance:** accounts store capacity rules.

## S8-002 — Capacity planner
**Goal:** Calculate clips/day and content/day.  
**Owner:** Codex  
**Acceptance:** 21 free accounts × 5 clips/day = 105 clips/day.

## S8-003 — Batch generator
**Goal:** Assign prompt-ready clip jobs to flow accounts.  
**Owner:** Codex  
**Acceptance:** max 5 jobs per FLOW_FREE/day.

## S8-004 — Prompt prefix generator
**Goal:** Generate naming-safe prefixes.  
**Owner:** Codex  
**Acceptance:** prefix starts every exported prompt.

## S8-005 — Export TXT and JSON manifest
**Goal:** Export prompt batch for Google Flow.  
**Owner:** Codex  
**Acceptance:** TXT contains one-paragraph prompts; JSON manifest validates.

---

# S9 — Import Results

## S9-001 — Batch output folder attach
**Goal:** Attach Drive output folder to batch.  
**Owner:** Codex  
**Acceptance:** batch stores folder ID/URL.

## S9-002 — Folder scan mock
**Goal:** Simulate scanning generated files.  
**Owner:** Codex  
**Acceptance:** files listed from mock data.

## S9-003 — Prefix matching
**Goal:** Match generated file names to clip jobs.  
**Owner:** Codex  
**Acceptance:** matched/unmatched states generated correctly.

## S9-004 — Manual attach unmatched file
**Goal:** User can attach unmatched file to clip job.  
**Owner:** Codex  
**Acceptance:** manual attach creates audit trail.

---

# S10 — Review Board

## S10-001 — Clip review board
**Goal:** Show clips grouped by content/status.  
**Owner:** Codex  
**Acceptance:** approve/reject actions available.

## S10-002 — Regenerate request
**Goal:** Reject clip and create V02 regenerate job.  
**Owner:** Codex  
**Acceptance:** old job preserved, new job created.

## S10-003 — Attach final video
**Goal:** Attach final edited Drive video to content.  
**Owner:** Codex  
**User:** edits video manually.  
**Acceptance:** final video stored as Drive metadata.

---

# S11 — Mobile Control

## S11-001 — Mobile dashboard
**Goal:** Today board: batches, prompts, imports, review, upload.  
**Owner:** Codex  
**Acceptance:** usable on mobile width.

## S11-002 — Remote desktop link launcher
**Goal:** Store and open remote desktop link.  
**Owner:** Codex  
**User:** installs remote desktop app.  
**Acceptance:** opens external link.

## S11-003 — Mobile prompt copy flow
**Goal:** Copy next prompt from mobile.  
**Owner:** Codex  
**Acceptance:** copy button works and tracks copied status.

## S11-004 — Open Flow/Drive from mobile
**Goal:** Buttons for Flow and batch Drive folder.  
**Owner:** Codex  
**Acceptance:** links open externally.

---

# S12 — Upload Package

## S12-001 — Affiliate account/link CRUD
**Goal:** Add 3 TikTok + 1 Shopee account/link manager.  
**Owner:** Codex  
**User:** provides actual links.  
**Acceptance:** product can map to multiple affiliate links.

## S12-002 — Upload package generator
**Goal:** Create TikTok/Shopee packages from final video and affiliate link.  
**Owner:** Codex  
**Acceptance:** caption/tags/CTA/link are copy-ready.

## S12-003 — Mark uploaded
**Goal:** User can paste post URL and mark uploaded.  
**Owner:** Codex  
**Acceptance:** upload status updates.

---

# S13 — Hardening

## S13-001 — Security review
**Goal:** Check secret handling, RLS, server-only modules.  
**Owner:** Codex + User  
**Acceptance:** no critical leaks.

## S13-002 — Build fix pass
**Goal:** Clean lint/typecheck/build errors.  
**Owner:** Codex  
**Acceptance:** all pass.

## S13-003 — MVP runbook
**Goal:** Document how to run daily workflow.  
**Owner:** Codex  
**Acceptance:** user can follow steps from product to upload package.
