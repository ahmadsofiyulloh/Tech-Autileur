# AI Media Lab PRD

**Status:** Proposed stream-specific PRD / lock candidate  
**Recommended path:** `docs/AI_MEDIA_LAB_PRD.md`  
**Feature stream:** AI Media Lab / Magnific API testing module  
**Implementation mode:** Frontend-first with dummy data, then backend/wiring after UI approval  
**Primary operator:** Single owner/operator  
**Related existing docs to read first:**

1. `AGENTS.md`
2. `docs/01_README_START_HERE.md`
3. `docs/PRD_SOURCE_OF_TRUTH.md`
4. `docs/ARCHITECTURE_LOCK.md`
5. `docs/DATABASE_SCHEMA_LOCK.md`
6. `docs/DO_NOT_BUILD.md`
7. `docs/MICRO_TASK_BACKLOG.md`
8. `docs/GEMINI_KEY_ROUTING_LOCK.md`
9. this document

---

## 0. Decision Summary

AI Media Lab is a private internal workspace inside Affiliate AI Content OS for testing visual/media AI provider workflows, initially focused on Magnific API.

This feature must not be built as a separate app and must not become a public playground. It extends the existing single-owner app as an operator tool.

Final routing target:

```text
/tools/ai-media
/tools/ai-media/motion-control
/tools/ai-media/image-to-video
/tools/ai-media/upscaler
/tools/ai-media/history
/tools/ai-media/usage

/settings/magnific
```

Final navigation target:

```text
Mobile:
Dashboard quick action -> /tools/ai-media

Desktop:
Sidebar group:
AI Media Lab -> /tools/ai-media
  Motion Control -> /tools/ai-media/motion-control
  Image to Video -> /tools/ai-media/image-to-video
  Upscaler -> /tools/ai-media/upscaler
  History -> /tools/ai-media/history
  Usage -> /tools/ai-media/usage
```

There is no `Overview` child item in the desktop sidebar. The parent `AI Media Lab` opens the overview/lobby page.

Implementation must proceed frontend-first:

```text
Top-level route placeholders
-> Dashboard entrypoint
-> Desktop sidebar entrypoint
-> AI Media overview
-> individual dummy pages
-> UI audit
-> backend schema/key storage
-> mock task wiring
-> live Magnific API
-> Drive output wiring
-> real usage tracking
```

---

## 1. Why This Is a New PRD Doc

Do not edit `docs/PRD_SOURCE_OF_TRUTH.md` directly for this feature. That file is the Phase 1 baseline and remains locked. AI Media Lab is a new feature stream and should have its own stream-specific PRD/lock doc.

`AGENTS.md` requires implementers to read the stream-specific lock doc for the task being implemented. This PRD serves as that stream-specific source of truth until split into smaller lock docs.

Recommended additional docs later:

```text
docs/AI_MEDIA_LAB_UI_LOCK.md
docs/AI_MEDIA_LAB_BACKEND_LOCK.md
```

Do not add runtime code in the PRD task.

---

## 2. Non-Negotiable Constraints

### 2.1 App architecture

- Next.js PWA.
- Supabase Auth.
- Supabase Postgres for metadata.
- Google Drive is the asset/file source of truth.
- Large image/video bytes must not be stored in Supabase Storage.
- Single owner/operator only.
- Every owner-owned table must include `user_id`.
- RLS must be enabled for owner-owned tables.
- Secrets and external API calls must be server-only.

### 2.2 Scope constraints

AI Media Lab must not introduce:

- public playground access;
- multi-user/team permission system;
- auto-upload to TikTok/Shopee;
- browser automation;
- Google Flow auto-clicking;
- video editor;
- remote desktop engine;
- Supabase Storage for large video/image assets;
- raw API key exposure in client code;
- `NEXT_PUBLIC_MAGNIFIC_API_KEY`;
- native browser dropdown/select controls;
- custom topbar separate from the app shell;
- broad backend/schema changes before frontend approval.

### 2.3 Development principle

Start with dummy frontend and no migrations.

Backend begins only after the operator approves:

- routing;
- navigation;
- overview UI;
- individual tool page UI;
- log terminal behavior;
- Magnific settings UI.

---

## 3. Product Goals

### 3.1 Primary goal

Create a private AI media testing workspace that lets the operator evaluate Magnific workflows safely before paid/serious usage.

### 3.2 Secondary goals

- Make motion/video API testing usable on mobile and desktop.
- Provide a fast launcher grid for tools.
- Provide task visibility through history and logs.
- Keep technical errors out of main UI and route them into a log terminal.
- Keep provider key management minimal but secure.
- Prepare for key fallback/rotator behavior by adopting the existing Gemini routing pattern.
- Keep all generated media tied to Google Drive metadata later.

### 3.3 Non-goals

- Full production video automation.
- Public SaaS UI.
- Full provider marketplace.
- Multi-provider abstraction in the first frontend task.
- Complex cost accounting before real pricing/usage data exists.
- Batch generation in the first wave.
- Prompt preset manager in the first sidebar wave.
- Live Magnific API during frontend dummy phase.

---

## 4. User Model

Primary user:

```text
Single owner/operator
```

No role matrix is required.

Access assumptions:

- authenticated user only;
- no guest access;
- no team permission;
- AI Media Lab visible only inside authenticated app shell.

---

## 5. Navigation Requirements

### 5.1 Mobile

Mobile bottom nav must remain unchanged.

AI Media Lab is accessed from Dashboard quick action.

Dashboard card:

```text
AI Media Lab
Motion, I2V, Upscale.
```

CTA:

```text
Buka
```

Target:

```text
/tools/ai-media
```

### 5.2 Desktop

Desktop sidebar adds a grouped navigation item.

Parent:

```text
AI Media Lab -> /tools/ai-media
```

Children:

```text
Motion Control -> /tools/ai-media/motion-control
Image to Video -> /tools/ai-media/image-to-video
Upscaler -> /tools/ai-media/upscaler
History -> /tools/ai-media/history
Usage -> /tools/ai-media/usage
```

No `Overview` child.

Sidebar behavior:

- parent active for every `/tools/ai-media` route;
- child active only for matching child route;
- child links hidden when sidebar collapsed;
- mobile bottom nav untouched.

### 5.3 Route titles

Add route titles for:

```text
/tools/ai-media
/tools/ai-media/motion-control
/tools/ai-media/image-to-video
/tools/ai-media/upscaler
/tools/ai-media/history
/tools/ai-media/usage
/settings/magnific
```

Suggested labels:

```text
AI Media Lab
Motion Control
Image to Video
Upscaler
History
Usage
Magnific
```

Suggested subtitles:

```text
Ruang kerja visual.
AI Media Lab.
AI Media Lab.
AI Media Lab.
AI Media Lab.
AI Media Lab.
Kunci provider.
```

---

## 6. UI Design Rules

### 6.1 Design system

AI Media Lab must use the existing design system.

Required:

- existing semantic tokens;
- existing surface tokens;
- shared button styles;
- shared badge/status styles;
- shared custom picker patterns;
- shared loading/empty/error patterns;
- Intake-like stepper pattern for individual tool pages.

Forbidden:

- hardcoded colors;
- hardcoded font sizes/weights/line heights in component code;
- raw native `<select>`;
- native browser dropdowns;
- browser default file input without app wrapper;
- custom marketing hero;
- verbose page descriptions;
- duplicate topbar;
- cards nested inside cards.

### 6.2 Copy style

Use short operational copy.

Allowed:

- page title;
- section title;
- field label;
- action label;
- status label;
- one-sentence empty state;
- one-sentence error state;
- brief overview summary only on `/tools/ai-media`.

Forbidden:

- marketing language;
- repeated explanations;
- long provider help text;
- raw technical errors in primary UI;
- hardcoded prompt guidance paragraphs.

### 6.3 Page-local header

Do not build a special AI Media topbar.

Use page-local header in content area:

Overview:

```text
[Back]
AI Media Lab
```

Individual tool page mobile:

```text
[Back]                         [Log]
Motion Control
```

The global app shell topbar remains unchanged.

---

## 7. Overview Page: `/tools/ai-media`

### 7.1 Purpose

Lobby/launcher for AI Media tools.

It must show:

- provider status;
- usage mini summary;
- clickable tool cards;
- settings shortcut;
- fallback readiness state.

It must not contain generate forms.

### 7.2 Mobile layout

Mobile uses 2-card grid per row.

```text
[Back]
AI Media Lab

Provider Status
Magnific: Active / Missing / Error
2 key aktif
Fallback siap
0 / 10 request hari ini
0 task aktif

Tool Grid
[Motion Control] [Image to Video]
[Upscaler]       [History]
[Usage]          [Settings]
```

Every card must be full-clickable.

### 7.3 Desktop layout

Desktop uses up to 3-column grid.

```text
AI Media Lab

Provider Status | Usage Summary | Fallback Status

Tools:
Motion Control | Image to Video | Upscaler

Manage:
History | Usage | Magnific Settings
```

### 7.4 Tool card anatomy

Each card:

```text
visual area
title
short label
status badge
```

Example:

```text
Motion Control
Reference motion.
Ready
```

### 7.5 Animated visual rules

Allowed in the visual area:

- lightweight CSS animation;
- muted looping preview;
- moving timeline placeholder;
- static fallback;
- reduced-motion fallback.

Forbidden:

- audio autoplay;
- large video assets;
- heavy GIFs;
- layout shift;
- external untracked media;
- aggressive animation.

Animation is polish. It must not block core frontend flow.

---

## 8. Individual Tool Pages

These pages must use an Intake-like stepper.

Routes:

```text
/tools/ai-media/motion-control
/tools/ai-media/image-to-video
/tools/ai-media/upscaler
```

Common rules:

- mobile: stepper stack, one active/expanded step at a time;
- desktop: form/stepper + preview panel + log panel;
- preview card required;
- log terminal required;
- no native dropdown/select;
- all provider/model/duration/aspect choices use shared custom controls;
- generate uses dummy state in frontend-first phase.

### 8.1 Motion Control

Purpose:

```text
reference image + reference motion video -> output video
```

Steps:

```text
1. Provider
2. Reference
3. Prompt
4. Settings
5. Preview & Generate
6. Output
```

Step details:

Provider:

- selected Magnific key;
- provider status;
- fallback readiness.

Reference:

- image reference;
- video motion reference.

Prompt:

- prompt;
- negative prompt.

Settings:

- model;
- CFG scale;
- duration;
- aspect ratio;
- orientation.

Preview & Generate:

- input preview;
- output placeholder;
- generate button;
- current task status.

Output:

- result preview;
- save to Drive;
- retry;
- open history.

### 8.2 Image to Video

Purpose:

```text
image + prompt -> output video
```

Steps:

```text
1. Provider
2. Image
3. Prompt
4. Settings
5. Preview & Generate
6. Output
```

Settings visible by default:

- model;
- duration;
- aspect ratio.

Advanced settings:

- negative prompt;
- seed/creativity if supported later;
- safety filter if supported later.

Do not expose unsupported fields in the first dummy UI.

### 8.3 Upscaler

Purpose:

```text
image -> enhanced/upscaled image
```

Steps:

```text
1. Provider
2. Image
3. Upscale Settings
4. Preview & Generate
5. Compare Output
```

Desktop:

```text
Stepper/Form | Before/After Preview | Log Terminal
```

Mobile:

- stacked before/after, or tabbed before/after;
- no side-by-side compare if text/preview overlaps.

---

## 9. Log Terminal

### 9.1 Principle

Technical notifications go to Log Terminal.

Main UI and toast show simplified operator messages only.

### 9.2 Toast examples

Allowed:

```text
Generate gagal.
Key belum aktif.
Limit habis.
Output siap.
Task tersimpan.
Mencoba fallback.
```

Forbidden in toast:

```text
HTTP 429 provider returned rate_limit_exceeded with retry_after_seconds...
```

### 9.3 Terminal examples

```text
[12:01:03] Submit request
[12:01:04] Using key: Main Magnific
[12:01:08] Error 429: rate limit
[12:01:08] Mark key as RATE_LIMITED
[12:01:09] Trying fallback key: Backup Magnific
[12:01:15] Provider task created: abc123
```

### 9.4 Desktop behavior

Desktop log terminal appears as side panel/drawer.

Suggested layout:

```text
Stepper/Form | Preview | Log Terminal
```

### 9.5 Mobile behavior

Mobile log terminal opens full screen from top-right `Log` button.

```text
[Back]                         [Log]
Motion Control
```

Opening Log:

```text
Log Terminal
[Close]

[12:01] ...
[12:02] ...
```

---

## 10. Magnific Settings Page

Route:

```text
/settings/magnific
```

### 10.1 Purpose

Minimal API key setup.

### 10.2 UI fields

Only:

```text
Nama key
API key
```

Actions:

```text
Tes koneksi
Simpan
```

Optional displayed status:

```text
Status
Terakhir dites
```

Do not expose:

- plan label;
- project label;
- account label;
- default model;
- RPM/RPD/TPM;
- daily cost limit;
- purpose/role;
- quota fields;
- advanced routing fields.

### 10.3 Security behavior

- raw API key is only accepted during create/update;
- raw API key must not be displayed after save;
- raw API key must not be stored client-side;
- raw API key must not be logged;
- final backend must encrypt secret server-side;
- visible UI should show only masked/saved state.

### 10.4 Frontend dummy behavior

Before backend, page must simulate:

- no key;
- test loading;
- test success;
- test failed;
- saved;
- invalid key.

No real API call. No migration.

---

## 11. History Page

Route:

```text
/tools/ai-media/history
```

### 11.1 Mobile

Use compact task cards, not dense tables.

Card fields:

```text
tool type
provider
model
status
created time
open action
```

Detail opens full-screen.

### 11.2 Desktop

Use searchable table/list with right-side drawer.

Columns:

```text
Tool
Provider
Model
Status
Created
Action
```

Drawer content:

```text
Input preview
Output preview
Provider task id
Selected/fallback key
Status
Error summary
Technical log
Retry
Archive
```

Hard delete is out of scope. Archive-first lifecycle.

---

## 12. Usage Page

Route:

```text
/tools/ai-media/usage
```

### 12.1 Metrics

Initially display:

```text
Request today
Success
Failed
Running
Waiting for key
Active keys
Rate limited keys
Fallback ready / not ready
Last used
Recent errors
```

### 12.2 Mobile

```text
Today
Provider
Fallback
Recent errors
```

### 12.3 Desktop

```text
Summary cards
Provider key status
Usage list/chart placeholder
Recent errors table/drawer
```

During frontend phase, usage is dummy but must follow the final data shape.

---

## 13. Dummy Data Contract

Frontend-first work must use structured dummy data resembling backend data.

Create a mock source such as:

```text
src/lib/ai-media/mock-data.ts
```

Suggested mock exports:

```text
mockAiMediaProviderStatus
mockAiMediaUsageSummary
mockAiMediaToolCards
mockAiMediaGenerationTasks
mockAiMediaTerminalLogs
mockMagnificKeys
```

Required dummy states:

```text
ready
empty
loading
error
no key
limit reached
task running
success output
rate limited
fallback success
waiting for key
```

Dummy data must not hide states that will exist in production.

---

## 14. Magnific Key Rotator / Fallback

### 14.1 Decision

Adopt the existing Gemini key routing pattern conceptually.

Do not invent a completely separate rotator model.

### 14.2 UI

Settings UI remains minimal.

Rotator status is shown in AI Media overview/usage, not in the settings form.

Examples:

```text
2 key aktif
Fallback siap
```

```text
1 key aktif
Fallback belum tersedia
```

```text
Tidak ada key siap
```

### 14.3 Backend behavior later

Eligible fallback errors:

```text
429 rate limit
408 timeout
5xx provider error
network timeout
temporary upstream error
cooldown key
```

Non-fallback errors:

```text
400 invalid payload
missing image/video
unsupported model
file too large
safety rejection
invalid prompt/input
```

Algorithm target:

```text
1. Select active Magnific key.
2. Skip keys with cooldown_until in the future.
3. Sort by requests_today ascending, last_used_at oldest/null first, created_at oldest first.
4. Attempt with selected key.
5. On success: mark success, increment usage, update last_used_at.
6. On retryable error: mark rate limited/cooldown/error as appropriate, exclude current key, try next key.
7. On non-retryable input error: stop and fail task.
8. If no available key: mark task WAITING_FOR_KEY.
9. Record every attempt in task log.
```

### 14.4 Max attempts

Default max attempts:

```text
3
```

Can be raised later, but do not retry unbounded.

---

## 15. Future Backend Model

Do not implement this during frontend dummy phase.

Recommended future tables:

```text
external_api_keys
external_api_key_secrets
external_generation_tasks
```

Optional later:

```text
external_generation_logs
external_usage_events
```

### 15.1 external_api_keys

Suggested fields:

```text
id
user_id
provider
key_code
label
status
requests_today
last_used_at
cooldown_until
last_tested_at
last_error_message
created_at
updated_at
```

Fields not shown in minimal UI may be null/default.

### 15.2 external_api_key_secrets

Suggested fields:

```text
id
user_id
external_api_key_id
encrypted_api_key
created_at
updated_at
```

### 15.3 external_generation_tasks

Suggested fields:

```text
id
user_id
provider
tool_type
model
status
selected_key_id
fallback_attempts
provider_task_id
input_json
output_json
input_drive_item_ids
output_drive_item_id
error_message
log_json
created_at
updated_at
```

Tool types:

```text
MOTION_CONTROL
IMAGE_TO_VIDEO
UPSCALER
```

Statuses may reuse the existing AI task mental model:

```text
QUEUED
RUNNING
SUCCESS
FAILED
RETRYING
WAITING_FOR_KEY
CANCELLED
```

---

## 16. Implementation Sequence

### AI-MEDIA-PRD-001 — Add PRD doc

Scope:

- create this document;
- no runtime code;
- no migration;
- no dependencies.

Acceptance:

- `docs/AI_MEDIA_LAB_PRD.md` exists;
- document defines routes, navigation, UI rules, settings UI, rotator policy, frontend-first sequence;
- no code files changed.

### AI-MEDIA-001 — Route placeholders

Scope:

- add placeholder pages for all final routes;
- static/dummy only.

Routes:

```text
/tools/ai-media
/tools/ai-media/motion-control
/tools/ai-media/image-to-video
/tools/ai-media/upscaler
/tools/ai-media/history
/tools/ai-media/usage
/settings/magnific
```

Acceptance:

- no route 404;
- no backend/API calls;
- no migration;
- lint/typecheck pass.

### AI-MEDIA-002 — Dashboard entrypoint

Scope:

- add Dashboard quick action card linking to `/tools/ai-media`.

Acceptance:

- mobile dashboard has AI Media Lab entry;
- bottom nav unchanged;
- no backend calls.

### AI-MEDIA-003 — Desktop sidebar group

Scope:

- update desktop sidebar nav only;
- parent `AI Media Lab` links to `/tools/ai-media`;
- children are Motion Control, Image to Video, Upscaler, History, Usage;
- no `Overview` child.

Acceptance:

- desktop sidebar group works;
- mobileNavItems unchanged;
- routeTitles added;
- child links hidden when sidebar collapsed.

### AI-MEDIA-004 — Overview dummy UI

Scope:

- build `/tools/ai-media` with dummy provider status, usage, tool grid;
- mobile 2-card grid;
- desktop 3-card grid;
- animated visual area optional and lightweight.

Acceptance:

- cards full-clickable;
- no native dropdown;
- no backend call;
- loading/empty/error dummy states available.

### AI-MEDIA-005 — Shared UI components

Scope:

- create reusable frontend components as needed.

Suggested components:

```text
AiMediaPageHeader
AiMediaToolGrid
AiMediaToolCard
AiMediaProviderStatusCard
AiMediaUsageMiniCard
AiMediaPreviewCard
AiMediaLogTerminal
AiMediaLogPanel
AiMediaTaskStatusCard
```

Acceptance:

- components use existing tokens/classes;
- no hardcoded color/typography values;
- no backend call.

### AI-MEDIA-006 — Motion Control dummy page

Scope:

- stepper flow;
- preview card;
- mobile full-screen log;
- desktop side log panel;
- dummy generate state.

Acceptance:

- all steps render;
- dummy logs show fallback scenario;
- toast messages simple;
- no live API.

### AI-MEDIA-007 — Image to Video dummy page

Scope:

- same pattern as Motion Control, adjusted steps.

Acceptance:

- stepper, preview, log, dummy output.

### AI-MEDIA-008 — Upscaler dummy page

Scope:

- upscaler stepper;
- before/after preview;
- log terminal.

Acceptance:

- mobile stacked/tabbed compare;
- desktop compare panel.

### AI-MEDIA-009 — History dummy page

Scope:

- mobile card list;
- desktop table/list + drawer;
- dummy tasks.

Acceptance:

- no dense mobile table;
- includes success, failed, running, waiting-for-key states.

### AI-MEDIA-010 — Usage dummy page

Scope:

- usage summary and provider/fallback state.

Acceptance:

- dummy metrics match expected future backend shape.

### AI-MEDIA-011 — Magnific settings minimal dummy UI

Scope:

- `Nama key`;
- `API key`;
- `Tes koneksi`;
- `Simpan`;
- dummy test/save states.

Acceptance:

- no extra fields;
- no backend/migration;
- no live API.

### AI-MEDIA-BACKEND-001 — Schema proposal

Only after UI approval.

Scope:

- propose SQL/migrations;
- do not apply until approved.

### AI-MEDIA-BACKEND-002 — Encrypted Magnific key storage

Scope:

- server-side actions;
- encryption;
- test connection.

### AI-MEDIA-BACKEND-003 — Mock task wiring

Scope:

- create tasks;
- append logs;
- history/usage backed by DB;
- no live Magnific yet.

### AI-MEDIA-BACKEND-004 — Live Magnific integration

Scope:

- server-only Magnific client;
- submit/poll;
- classify errors;
- key fallback;
- log terminal events.

### AI-MEDIA-BACKEND-005 — Drive output wiring

Scope:

- inputs from Drive;
- outputs to Drive;
- Supabase metadata only.

---

## 17. Acceptance Checklist

Before backend starts:

```text
[ ] Top-level routes exist.
[ ] Dashboard quick action exists.
[ ] Desktop sidebar group exists.
[ ] Mobile bottom nav unchanged.
[ ] AI Media overview uses 2-card mobile grid.
[ ] Overview cards are full-clickable.
[ ] Animated visual is lightweight or safely omitted.
[ ] No special AI Media topbar exists.
[ ] Local back button exists.
[ ] Individual pages use stepper.
[ ] Preview cards exist.
[ ] Log terminal exists.
[ ] Mobile log opens full screen.
[ ] Desktop log appears as panel/drawer.
[ ] Toast text is simplified.
[ ] Technical errors go to log terminal.
[ ] Magnific settings UI is minimal.
[ ] No native dropdown/select is used.
[ ] Dummy data covers key states.
[ ] No migration has been added.
[ ] No live Magnific call exists.
```

Before live Magnific starts:

```text
[ ] API key encryption works.
[ ] Test connection works server-side.
[ ] Task history writes to DB.
[ ] Usage summary reads real DB state.
[ ] Logs are persisted or recoverable.
[ ] Fallback policy is implemented.
[ ] Retryable vs non-retryable errors are classified.
[ ] Max fallback attempts enforced.
[ ] Large files remain in Google Drive.
```

---

## 18. Open Questions

Resolve later, not before frontend dummy:

1. Does Magnific expose a safe lightweight endpoint for `Tes koneksi`, or should test connection use a minimal non-generating account/status endpoint?
2. Should external provider key storage be generic from the start, or Magnific-specific first?
3. Should `external_generation_logs` be a separate table, or is `log_json` sufficient for MVP?
4. Should usage reset use provider timezone, UTC, or operator timezone?
5. Should usage show estimated cost only after reliable pricing/usage data is available?

Default until resolved:

```text
No estimated cost.
No generic provider UI.
No separate log table.
No live connection test in frontend dummy.
```

---

## 19. Final Rule

AI Media Lab is allowed only as a controlled internal testing workspace.

The first implementation wave is frontend-first and dummy-data only. Backend, migrations, API key encryption, task history, Magnific live calls, fallback rotator, and Drive output wiring come later as separate approved micro-tasks.
