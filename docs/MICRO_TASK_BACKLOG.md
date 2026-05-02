# Micro Task Backlog - Current Sprint Order

This backlog replaces the older implementation order for the current deadline sprint. Legacy completed work is not repeated here.

## S0 - Docs and Source of Truth Sync

### S0-001 - Align lock docs
**Goal:** Make all source-of-truth docs describe the same app flow and UX.
**Owner:** Codex  
**Acceptance:** no doc still treats Prompt/Output as primary navigation or Flow as workspace-bound.

## S1 - Navigation and Route Lock

### S1-001 - Lock global nav
**Goal:** Keep main nav exactly Dashboard, Products, Controller, Settings.
**Owner:** Codex  
**Acceptance:** compatibility routes remain secondary only.

## S2 - Intake Workflow

### S2-001 - Single intake entrypoint
**Goal:** Make `/products/new` the only intake workflow entrypoint.
**Owner:** Codex  
**Acceptance:** intake does not split into a second duplicate funnel.

### S2-002 - Upload cards and preview
**Goal:** Product image and screenshot use upload cards with local preview.
**Owner:** Codex  
**Acceptance:** no docs or UI language imply link-only visual parsing.

### S2-003 - Submit advances workflow
**Goal:** Main save/submit advances intake into the prompt step when ready.
**Owner:** Codex  
**Acceptance:** `DRAFT` is only for autosave or incomplete states.

## S3 - Prompt Personalization

### S3-001 - Affiliate profiles
**Goal:** Support unlimited workspace-scoped affiliate profiles.
**Owner:** Codex  
**Acceptance:** profile rules are editable in UI and not hardcoded.

### S3-002 - Prompt editor/generator
**Goal:** Build the prompt editor/generator step from intake and profile context.
**Owner:** Codex  
**Acceptance:** prompt pack JSON is persisted and versioned.

## S4 - Controller and Flow Tools

### S4-001 - Global Flow pool
**Goal:** Keep Flow accounts global and available to all workspaces.
**Owner:** Codex  
**Acceptance:** no workspace_id is added to Flow accounts.

### S4-002 - Controller queue
**Goal:** Assign ready prompt packs to available Flow accounts.
**Owner:** Codex  
**Acceptance:** account selection is based on availability and credit.

## S5 - Product Detail

### S5-001 - Detail tabs
**Goal:** Product detail shows Metadata, Output, and History.
**Owner:** Codex  
**Acceptance:** Prompt and Output are not primary nav pages.

## S6 - Settings Hub

### S6-001 - Workspace and tools settings
**Goal:** Keep workspace profiles, Gemini, Drive, Flow tools, and affiliate profiles in Settings.
**Owner:** Codex  
**Acceptance:** settings is the single configuration hub.

## S7 - Dashboard Analytics

### S7-001 - Analytics scope
**Goal:** Show usage analytics on Dashboard.
**Owner:** Codex  
**Acceptance:** API, token, file, Drive, prompt, and task counts are represented.

## S8 - Hardening

### S8-001 - Scope guard pass
**Goal:** Prevent drift back to the old flow.
**Owner:** Codex  
**Acceptance:** docs and runtime both preserve the locked source of truth.
