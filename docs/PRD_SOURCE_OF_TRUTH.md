# PRD v1 Final — Affiliate AI Content OS MVP

**Status:** LOCKED FOR MVP IMPLEMENTATION  
**Version:** 1.0 Final  
**Date:** 2026-05-02  
**Primary Operator:** Single owner/operator  
**Implementation Target:** Next.js PWA + Supabase + Google Drive + Gemini API + Google Flow workflow  
**Implementation Mode:** Codex CLI full code implementer with strict source-of-truth docs and Git checkpoints  

---

## 0. Executive Summary

Affiliate AI Content OS adalah sistem operasi produksi konten affiliate berbasis AI untuk membantu operator mengelola banyak akun Gemini, mengelola file produksi di Google Drive, menghasilkan prompt i2i dan i2v yang konsisten, menyiapkan batch prompt untuk Google Flow, mengimpor hasil generate, mereview clip, membuat upload package manual TikTok/Shopee, dan melacak performance.

MVP ini **bukan** video editor, **bukan** auto-uploader TikTok/Shopee, dan **bukan** custom remote desktop engine. MVP adalah **AI production control center** yang membuat workflow produksi konten affiliate lebih cepat, rapi, dan bisa dikontrol dari desktop maupun mobile.

---

## 1. Product Vision

Membangun PWA yang menjadi pusat kendali produksi konten affiliate AI, dengan fokus pada:

1. Mengurangi pekerjaan manual dalam membuat prompt.
2. Menjaga konsistensi visual antar i2i start frame, i2i last frame, dan i2v clip.
3. Mengelola banyak project/API key Gemini Free Tier secara terstruktur.
4. Menyimpan semua file produksi di Google Drive secara rapi dan mudah dicari.
5. Membuat batch Google Flow yang siap dieksekusi manual/semi-manual.
6. Memungkinkan operator memantau dan menjalankan workflow dari mobile melalui remote control layer.
7. Menyimpan status, metadata, dan performance agar project tidak berantakan.

---

## 2. MVP Definition

MVP Affiliate AI Content OS adalah PWA single-operator untuk:

- Mengelola banyak Gemini API project/key.
- Mengelola struktur file Google Drive secara terpusat.
- Menganalisis gambar produk.
- Menghasilkan 4 prompt i2i dan 2 prompt i2v per content.
- Menjaga konsistensi antar prompt dan clip.
- Membuat clip job C01/C02.
- Membuat batch prompt untuk Google Flow.
- Mengimpor hasil generate dari Google Drive.
- Review approve/reject/regenerate clip.
- Attach final video hasil edit manual.
- Membuat upload package TikTok/Shopee.
- Menjalankan kontrol workflow dari mobile.
- Mencatat performance/revenue harian secara manual.

---

## 3. Locked Technical Architecture

### 3.1 Frontend

```text
Frontend Framework: Next.js PWA
Language: TypeScript strict
UI: Mobile-first responsive dashboard
Deployment target: Web/PWA
```

### 3.2 Auth

```text
Auth Provider: Supabase Auth
User Model: Single owner/operator for MVP
Team/role permission: Out of scope MVP
```

### 3.3 Database

```text
Database: Supabase Postgres
Metadata Source of Truth: Supabase Database
RLS: Enabled on all owner-owned tables
All owner-owned tables: must include user_id referencing auth.users(id)
```

### 3.4 Asset Storage

```text
File/Asset Source of Truth: Google Drive
Large Asset Storage: Google Drive, not Supabase Storage
Supabase stores only: Drive file ID, Drive URL, path, mime type, metadata, status, relations
```

### 3.5 AI

```text
AI Provider: Gemini API
API key management: Stored encrypted in Supabase
Quota logic: Project-based, not key-based
Task routing: By role/model/status
Task execution: Queue-based with retry and fallback
```

### 3.6 Video Generation Execution

```text
Video Generator: Google Flow
PWA role: planner, prompt generator, batch bridge, metadata manager
Google Flow role: external executor
Extension/Desktop Helper role: execution/import assistance
```

### 3.7 Mobile Control

```text
Mobile PWA: control center
Remote Desktop: external tool/link integration
Custom remote desktop engine: out of scope
```

---

## 4. Source of Truth Hierarchy

| Area | Source of Truth |
|---|---|
| Product scope | This PRD |
| Architecture | Locked Technical Architecture section |
| Metadata | Supabase Postgres |
| File/video/image asset | Google Drive |
| AI key/project status | Supabase |
| AI task queue | Supabase |
| Prompt generation output | Supabase + exported TXT/JSON |
| Flow batch execution | Google Flow + batch manifest |
| File import/matching | Prompt prefix + Drive file metadata |
| Upload status | Supabase upload package |
| Performance/revenue | Supabase performance metrics |

---

## 5. Core MVP Features

## 5.1 P0 Core Features

### P0.1 Multi Gemini Account Manager

Manages multiple Gemini API projects/keys.

**Purpose:** prevent API/key chaos, route tasks by model/role, and support failover.

**MVP capabilities:**

- Add Gemini project/key metadata.
- Store encrypted API key.
- Assign model per key.
- Assign role per key.
- Track status.
- Track usage counters.
- Track cooldown.
- Disable problematic keys.
- Route AI tasks to available key by role/model.

**Key status:**

```text
ACTIVE
COOLDOWN
RATE_LIMITED
ERROR
DISABLED
```

**Key roles:**

```text
VISION_ANALYSIS
I2I_PROMPT
I2V_PROMPT
CONSISTENCY_CHECK
PROMPT_REPAIR
FALLBACK
QA_PRO
```

---

### P0.2 Centralized Google Drive File Manager

Manages production files in Google Drive.

**Purpose:** all images/videos/prompts/results live in a predictable structure.

**MVP capabilities:**

- Create standard Drive folder structure.
- Register Drive file metadata in Supabase.
- Attach Drive files to products, prompt packs, clip jobs, final videos, and upload packages.
- Copy/open Drive file links.
- Browse product folder.
- Browse batch folder.
- Track unmatched imports.

---

### P0.3 Prompt Generator Pipeline: Vision → i2i → i2v

This is the core production engine.

**Per content Gemini workload:**

```text
1 product image vision analysis
4 i2i prompts:
  - clip_01_start_frame
  - clip_01_last_frame
  - clip_02_start_frame
  - clip_02_last_frame
2 i2v prompts:
  - clip_01_i2v
  - clip_02_i2v

Total = 7 logical AI tasks per content
```

**Preferred implementation:**

The system may bundle outputs into fewer API calls if the JSON output remains valid and consistent.

**Required output shape:**

```json
{
  "product_analysis": {
    "product_type": "",
    "visual_attributes": [],
    "materials": [],
    "colors": [],
    "selling_points": [],
    "risk_notes": []
  },
  "i2i_prompts": {
    "clip_01_start_frame": "",
    "clip_01_last_frame": "",
    "clip_02_start_frame": "",
    "clip_02_last_frame": ""
  },
  "i2v_prompts": {
    "clip_01": "",
    "clip_02": ""
  },
  "consistency_rules": [],
  "negative_rules": [],
  "prompt_prefixes": {
    "clip_01": "",
    "clip_02": ""
  }
}
```

---

### P0.4 Flow Batch Bridge

Prepares Google Flow execution.

**MVP capabilities:**

- Create C01/C02 clip jobs.
- Assign clip jobs to Google Flow account.
- Create batch per Flow account.
- Export prompt batch TXT.
- Export batch manifest JSON.
- Save output folder Drive URL per batch.
- Mark batch status.
- Support filename matching by prompt prefix.

---

### P0.5 Mobile Remote Control Layer

Mobile interface for controlling the workflow.

**Important lock:**

```text
MVP does not build a custom remote desktop engine.
MVP provides a mobile control hub and links to external remote desktop tools.
```

**MVP capabilities:**

- Open remote desktop link from mobile.
- Open Google Flow link from mobile.
- Open Drive batch folder from mobile.
- Copy next prompt from mobile.
- View batch status.
- View AI task status.
- View import/matching status.
- Approve/reject clip from mobile.
- Attach final video Drive link.
- Mark upload package ready/uploaded.

---

## 5.2 P1 Core Support Features

### P1.1 Product Metadata Manager

Supports production context.

**MVP capabilities:**

- Add product.
- Generate product code.
- Save product name, niche, marketplace, source URL.
- Attach source image Drive file.
- Track product status.

---

### P1.2 Google Flow Account Manager

Manages Google Flow accounts.

**Supported account types:**

```text
FLOW_FREE
FLOW_PLUS
```

**Out of scope:**

```text
FLOW_PRO
FLOW_BUSINESS
FLOW_ENTERPRISE
```

---

### P1.3 Import Results

Imports generated files from Drive batch folders.

**MVP capabilities:**

- Scan Drive folder.
- Read filenames.
- Match by prompt prefix.
- Attach generated file to clip job.
- Show unmatched files.
- Manual attach unmatched file.

---

### P1.4 Review Board

Clip review workflow.

**MVP capabilities:**

- View generated clips.
- Approve clip.
- Reject clip.
- Request regenerate.
- Mark selected final clip.
- Track clip status.

---

### P1.5 Upload Package

Creates copy-ready upload package.

**MVP capabilities:**

- Platform: TikTok/Shopee.
- Affiliate account.
- Affiliate link.
- Final video Drive URL.
- Caption.
- Tags/hashtags per platform.
- CTA.
- Copy buttons.
- Mark uploaded.
- Save post URL.

---

## 5.3 P2 Features

### P2.1 Performance & Revenue Tracker

Manual tracking only.

**MVP capabilities:**

- Input views.
- Input clicks.
- Input orders.
- Input gross commission.
- Input net commission.
- Input revenue.
- Mark winner manually.
- Track by product, content, affiliate account, platform, date.

---

## 6. Non-Goals / Do Not Build in MVP

The following are explicitly out of scope:

```text
- Auto upload to TikTok/Shopee
- Video editor inside PWA
- Custom remote desktop engine
- Full browser automation
- Custom internal browser extension
- Multi-user/team permission
- FLOW_PRO / FLOW_BUSINESS / FLOW_ENTERPRISE support
- Advanced A/B testing automation
- Advanced revenue attribution automation
- Auto scraping marketplace metrics
- Automatic commission reconciliation
- AI-generated final video editing
```

---

## 7. Locked Gemini Free Tier Setup

### 7.1 Quota Rule

```text
Gemini quota is project-based, not API-key-based.
Multiple API keys inside the same project do not increase quota.
If more quota isolation is needed, use separate AI Studio projects/accounts.
```

### 7.2 Recommended MVP Setup for Maximum Quality + Efficiency

Use **3 separate Google AI Studio projects/accounts**, each with **1 API key**.

| Key | Model | Role | Daily MVP workload at 43 content/day |
|---|---|---|---:|
| API Key 1 | Gemini 2.5 Pro | Vision analysis / premium product understanding | ±43–52 requests/day |
| API Key 2 | Gemini 2.5 Flash-Lite | High-volume i2i prompt generation | ±172–207 requests/day |
| API Key 3 | Gemini 2.5 Flash | i2v prompt generation, consistency check, prompt repair | ±129–155 requests/day |

### 7.3 Minimum Setup

```text
Minimum technically enough:
- 1 Gemini 2.5 Flash-Lite project/key

Recommended for MVP quality:
- 3 separate projects/keys as defined above
```

### 7.4 Optional Future Setup

```text
Optional:
- 1 extra Flash/Flash-Lite fallback project/key
- 1 Pro key for high-priority QA only
```

---

## 8. Google Flow Capacity Rules

### 8.1 Flow Free

```text
FLOW_FREE:
- daily_credit = 50
- credit_per_generation = 10
- max_clip_per_day = 5
- usage = main production
```

### 8.2 Flow Plus

```text
FLOW_PLUS:
- monthly_credit = 200
- credit_per_generation = 10
- max_clip_per_month = 20
- usage = regenerate / priority
```

### 8.3 Content Capacity Formula

```text
1 final content = 2 clip
Buffer regenerate = 20%
Effective clip per content = 2.4 clip
21 free accounts × 5 clip/day = 105 clip/day
105 / 2.4 = 43 final content/day max quota
```

### 8.4 Production Modes

| Mode | Target Content/Day | Estimated Clip Usage | Notes |
|---|---:|---:|---|
| Conservative | 10–15 | 24–36 | Stable default for early operation |
| Balanced | 20–25 | 48–60 | Recommended daily target |
| Max Quota | 40–43 | 96–103 | Advanced mode with warning |

---

## 9. Prompt Prefix & Naming Rules

### 9.1 Prefix Format

```text
PRODUCTCODE_CONTENTCODE_CLIPCODE_VERSION_FLOWACCOUNT_BATCHCODE_SCENETYPE_PRODUCTSHORTNAME
```

Example:

```text
HORG0001_CT001_C01_V01_FLOWFREE01_B20260502A_START_RAKKAMARMANDI
```

### 9.2 Parsing

```text
PRODUCTCODE = HORG0001
CONTENTCODE = CT001
CLIPCODE = C01
VERSION = V01
FLOWACCOUNT = FLOWFREE01
BATCHCODE = B20260502A
SCENETYPE = START
PRODUCTSHORTNAME = RAKKAMARMANDI
```

### 9.3 Extension Compatibility Rules

```text
- Prefix must be at the very beginning of the prompt.
- Prefix must be inside the first 8–9 words.
- Prompt must be one paragraph.
- No blank line.
- Use underscore separator.
- Avoid unsafe filename characters: / \ : * ? " < > |
```

---

## 10. Google Drive Folder Standard

```text
/AffiliateAI/
  /00_ADMIN/
    affiliate_accounts/
    google_flow_accounts/
    gemini_api_projects/
    templates/

  /01_PRODUCTS/
    /PRODUCT_CODE/
      /01_SOURCE_IMAGES/
      /02_PRODUCT_ANALYSIS/
      /03_I2I_PROMPTS/
      /04_I2I_RESULTS/
      /05_I2V_PROMPTS/
      /06_CLIPS_RAW/
      /07_FINAL_VIDEO/
      /08_UPLOAD_PACKAGE/
      /09_PERFORMANCE/

  /02_BATCHES/
    /YYYY-MM-DD/
      /BATCH_CODE/
        /FLOW_FREE_01/
        /FLOW_FREE_02/
        /FLOW_FREE_03/

  /03_IMPORTS/
    /UNMATCHED/
    /NEED_MANUAL_ATTACH/

  /04_EXPORTS/
    /BATCH_MANIFEST_JSON/
    /PROMPT_BATCH_TXT/
    /UPLOAD_PACKAGE_CSV/
    /PERFORMANCE_CSV/

  /05_FINAL_LIBRARY/
    /TIKTOK/
      /TIKTOK_AFF_01_FASHION_ATASAN_PRIA/
      /TIKTOK_AFF_02_FASHION_BAWAHAN_PRIA/
      /TIKTOK_AFF_03_NICHE_UTAMA/
    /SHOPEE/
      /SHOPEE_AFF_01/
```

---

## 11. Core Workflow

### 11.1 End-to-End MVP Workflow

```text
1. Add product
2. Attach product image from Drive
3. Run Gemini vision analysis
4. Generate 4 i2i prompts
5. Generate/save i2i result frames externally/manual-assisted
6. Attach selected i2i start/last frames
7. Generate 2 i2v prompts
8. Create C01/C02 clip jobs
9. Create Flow batch
10. Export prompt batch
11. Execute in Google Flow manually/extension-assisted
12. Import generated files from Drive
13. Match by prefix
14. Review clips
15. Approve/reject/regenerate
16. Attach final video after manual HP edit
17. Create upload package
18. Upload manually to TikTok/Shopee
19. Paste post URL
20. Track performance manually
```

### 11.2 Prompt Pipeline

```text
Product source image
→ Vision analysis
→ i2i start/last frame prompts
→ i2i result frame assets
→ i2v prompt generation
→ C01/C02 clip jobs
→ Flow batch export
→ generated clip import
```

---

## 12. Status Lifecycle

### 12.1 Product Status

```text
DRAFT
IMAGE_ATTACHED
IMAGE_ANALYZED
PROMPT_READY
IN_PRODUCTION
READY_FOR_UPLOAD
UPLOADED
ARCHIVED
```

### 12.2 Content Status

```text
PLANNED
VISION_ANALYZED
I2I_PROMPT_READY
I2I_FRAME_READY
I2V_PROMPT_READY
BATCHED
GENERATING
NEED_REVIEW
APPROVED
FINALIZED
READY_TO_UPLOAD
UPLOADED
```

### 12.3 Clip Job Status

```text
PENDING
PROMPT_READY
BATCHED
EXPORTED
RUNNING_MANUAL
DOWNLOADED
MATCHED
NEED_REVIEW
APPROVED
REJECTED
REGENERATE_REQUESTED
FAILED
```

### 12.4 Batch Status

```text
DRAFT
READY_TO_EXPORT
EXPORTED
RUNNING
IMPORTING
PARTIALLY_IMPORTED
IMPORTED
NEED_MANUAL_MATCH
CLOSED
```

### 12.5 AI Task Status

```text
QUEUED
RUNNING
SUCCESS
FAILED
RETRYING
WAITING_FOR_KEY
RATE_LIMITED
CANCELLED
```

---

## 13. Supabase Database Schema Lock

### 13.1 Global Rules

```text
- Every owner-owned table must include user_id uuid references auth.users(id).
- RLS must be enabled on every owner-owned table.
- MVP policy: authenticated owner can only access own rows.
- All tables must include created_at.
- Mutable tables must include updated_at.
- API keys and tokens must be encrypted.
- No secret may be exposed to client components.
```

### 13.2 Required Tables

#### profiles

```text
id uuid PK references auth.users(id)
email text
timezone text default 'Asia/Jakarta'
created_at timestamptz
updated_at timestamptz
```

#### gemini_api_projects

```text
id uuid PK
user_id uuid FK auth.users
key_code text unique per user
google_account_label text
project_label text
model_name text
role enum
encrypted_api_key text
rpm_limit int
rpd_limit int
requests_today int
requests_this_minute int
last_used_at timestamptz
cooldown_until timestamptz
status enum
notes text
created_at timestamptz
updated_at timestamptz
```

#### ai_tasks

```text
id uuid PK
user_id uuid FK auth.users
gemini_project_id uuid FK gemini_api_projects nullable
product_id uuid FK products nullable
content_id uuid FK contents nullable
task_type enum
status enum
model_name text
input_json jsonb
output_json jsonb
error_message text
retry_count int
started_at timestamptz
completed_at timestamptz
created_at timestamptz
updated_at timestamptz
```

#### drive_files

```text
id uuid PK
user_id uuid FK auth.users
drive_file_id text
drive_url text
drive_path text
file_name text
mime_type text
file_size bigint
asset_type enum
related_entity_type text
related_entity_id uuid nullable
metadata_json jsonb
status enum
created_at timestamptz
updated_at timestamptz
```

#### products

```text
id uuid PK
user_id uuid FK auth.users
product_code text unique per user
product_name text
niche text
marketplace text
marketplace_product_link text
status enum
notes text
created_at timestamptz
updated_at timestamptz
```

#### product_images

```text
id uuid PK
user_id uuid FK auth.users
product_id uuid FK products
drive_file_id uuid FK drive_files
source_type text
analysis_json jsonb
status enum
created_at timestamptz
updated_at timestamptz
```

#### contents

```text
id uuid PK
user_id uuid FK auth.users
product_id uuid FK products
content_code text
platform text
hook_type text
angle text
status enum
created_at timestamptz
updated_at timestamptz
```

#### prompt_packs

```text
id uuid PK
user_id uuid FK auth.users
product_id uuid FK products
content_id uuid FK contents
version text
product_analysis_json jsonb
i2i_prompts_json jsonb
i2v_prompts_json jsonb
consistency_rules_json jsonb
negative_rules_json jsonb
status enum
created_at timestamptz
updated_at timestamptz
```

#### flow_accounts

```text
id uuid PK
user_id uuid FK auth.users
account_code text unique per user
account_type enum FLOW_FREE/FLOW_PLUS
platform_access text default 'FLOW'
observed_daily_credit int
observed_monthly_credit int
credit_per_generation int default 10
max_parallel_allowed int default 1
cooldown_minutes int
status enum
notes text
created_at timestamptz
updated_at timestamptz
```

#### flow_batches

```text
id uuid PK
user_id uuid FK auth.users
batch_code text unique per user
flow_account_id uuid FK flow_accounts
target_date date
model text
max_jobs int
drive_output_folder_url text
status enum
created_at timestamptz
updated_at timestamptz
```

#### clip_jobs

```text
id uuid PK
user_id uuid FK auth.users
content_id uuid FK contents
prompt_pack_id uuid FK prompt_packs nullable
batch_id uuid FK flow_batches nullable
job_code text
clip_code text C01/C02
version text
prompt_prefix text
prompt_one_paragraph text
start_frame_drive_file_id uuid FK drive_files nullable
last_frame_drive_file_id uuid FK drive_files nullable
generated_file_id uuid FK drive_files nullable
status enum
created_at timestamptz
updated_at timestamptz
```

#### generated_files

```text
id uuid PK
user_id uuid FK auth.users
clip_job_id uuid FK clip_jobs nullable
drive_file_id uuid FK drive_files
file_name text
detected_prefix text
match_status enum
imported_at timestamptz
created_at timestamptz
updated_at timestamptz
```

#### affiliate_accounts

```text
id uuid PK
user_id uuid FK auth.users
account_code text unique per user
platform text
marketplace text
niche text
status enum
notes text
created_at timestamptz
updated_at timestamptz
```

#### affiliate_links

```text
id uuid PK
user_id uuid FK auth.users
product_id uuid FK products
affiliate_account_id uuid FK affiliate_accounts
platform text
marketplace text
niche text
affiliate_link text
status enum
created_at timestamptz
updated_at timestamptz
```

#### final_videos

```text
id uuid PK
user_id uuid FK auth.users
content_id uuid FK contents
drive_file_id uuid FK drive_files
final_video_file_name text
edited_on text
status enum
created_at timestamptz
updated_at timestamptz
```

#### upload_packages

```text
id uuid PK
user_id uuid FK auth.users
final_video_id uuid FK final_videos
affiliate_link_id uuid FK affiliate_links
platform text
caption text
tags jsonb
cta text
post_url_after_upload text
upload_status enum
created_at timestamptz
updated_at timestamptz
```

#### performance_metrics

```text
id uuid PK
user_id uuid FK auth.users
upload_package_id uuid FK upload_packages
metric_date date
views int
clicks int
orders int
gross_commission numeric
net_commission numeric
revenue_amount numeric
notes text
is_winner_manual boolean default false
created_at timestamptz
updated_at timestamptz
```

#### remote_desktop_profiles

```text
id uuid PK
user_id uuid FK auth.users
profile_name text
remote_url text
device_label text
status enum
notes text
created_at timestamptz
updated_at timestamptz
```

---

## 14. Upload Package Rules

### 14.1 Required Fields

```text
final_video
platform
affiliate_account
affiliate_link
caption
tags
CTA
upload_status
post_url_after_upload
```

### 14.2 Platform Rules

```text
TikTok and Shopee captions are different.
TikTok tags can be hashtag-style.
Shopee tags can be keyword-style.
No global hashtag field in MVP.
Description is not used in MVP.
```

---

## 15. Performance Tracking Rules

```text
Granularity: daily
Input method: manual
Winner marking: manual
Commission tracking: gross and net
Auto attribution: out of scope MVP
```

Minimum fields:

```text
metric_date
platform
affiliate_account
product_id
content_id
post_url
views
clicks
orders
gross_commission
net_commission
revenue_amount
notes
is_winner_manual
```

---

## 16. Codex CLI Implementation Control

### 16.1 Required Repo Docs

Before coding, repo must include:

```text
/docs/PRD_SOURCE_OF_TRUTH.md
/docs/ARCHITECTURE_LOCK.md
/docs/DATABASE_SCHEMA_LOCK.md
/docs/MVP_TASK_BREAKDOWN.md
/docs/DO_NOT_BUILD.md
/AGENTS.md
```

### 16.2 Required AGENTS.md Rules

```text
- Always read docs before modifying code.
- Do not invent features outside MVP.
- Do not change locked architecture without explicit approval.
- Use Supabase Auth and Supabase Postgres.
- Use Google Drive as asset storage.
- Keep MVP single-user.
- Use TypeScript strict.
- Every DB change must be via migration.
- Never hardcode secrets.
- Never commit .env files.
- Keep changes small and reviewable.
- Every task must end with lint/typecheck/build result.
```

### 16.3 Git Control

```text
One branch per task or sprint.
Commit after every verified task.
Review git diff before moving to next task.
Never let Codex implement multiple modules in one unchecked change.
```

---

## 17. Implementation Sprint Order

### Sprint 0 — Project Foundation

```text
- Init Next.js PWA
- TypeScript strict
- Tailwind/UI setup
- Env validation
- Supabase client setup
- Basic layout
```

### Sprint 1 — Supabase Auth + DB Foundation

```text
- Supabase Auth login/logout
- Protected dashboard
- Initial migrations
- RLS policies
- Profile table
```

### Sprint 2 — Gemini Account Manager

```text
- CRUD Gemini project/key metadata
- Encrypted key storage
- Role/model/status fields
- Usage counters
```

### Sprint 3 — AI Task Queue

```text
- Create AI task
- Pick key by role/model/status
- Run task
- Save input/output JSON
- Retry/fallback/rate limit handling
```

### Sprint 4 — Drive File Manager

```text
- Google Drive integration
- Create folder structure
- Register Drive file metadata
- Attach files to entities
```

### Sprint 5 — Product + Source Image

```text
- Product CRUD
- Product code generator
- Attach source image
- Product status lifecycle
```

### Sprint 6 — Prompt Pipeline

```text
- Vision analysis
- 4 i2i prompts
- 2 i2v prompts
- Consistency rules
- Prompt pack versioning
```

### Sprint 7 — Flow Batch Bridge

```text
- Create C01/C02 clip jobs
- Generate prefix
- Create batch
- Export TXT and JSON manifest
```

### Sprint 8 — Import Results

```text
- Scan Drive folder
- Match files by prefix
- Manual attach unmatched files
```

### Sprint 9 — Mobile Control Layer

```text
- Mobile dashboard
- Remote desktop link
- Copy prompt
- Open Flow/Drive links
- Monitor batch/import/review
```

### Sprint 10 — Review + Upload Package

```text
- Approve/reject/regenerate
- Attach final video
- Create upload package
- Mark uploaded
```

### Sprint 11 — Performance Tracker

```text
- Manual metric input
- Winner marking
- Simple dashboard
```

---

## 18. First Vertical Slice

The first working MVP slice must be:

```text
Login
→ Add Gemini key metadata
→ Add product
→ Attach product image Drive URL
→ Run/mock vision analysis
→ Generate 4 i2i + 2 i2v prompts
→ Create C01/C02 clip jobs
→ Export batch prompt TXT
```

Only after this works should the team continue to import, review, upload package, and performance tracking.

---

## 19. Acceptance Criteria

### Architecture

1. User can login with Supabase Auth.
2. All owner-owned tables use `user_id`.
3. RLS is enabled.
4. Supabase stores metadata only.
5. Google Drive stores large assets.
6. Secrets are not exposed to client code.

### Gemini

7. User can register multiple Gemini API projects/keys.
8. Each Gemini key has model, role, status, quota metadata.
9. API keys are encrypted.
10. System can create AI tasks.
11. System can route AI task by role/model.
12. System can save structured AI output JSON.
13. System can handle rate limit by queue/retry/fallback.

### Drive

14. System can create/read standard Drive folder structure.
15. System can register Drive file metadata.
16. System can attach Drive files to product/content/clip/final video.

### Product + Prompt Pipeline

17. User can create product.
18. User can attach source image.
19. System can run vision analysis.
20. System can generate 4 i2i prompts per content.
21. System can generate 2 i2v prompts per content.
22. System can save prompt pack version.
23. System can generate prompt prefix.

### Flow Batch

24. System can create C01/C02 clip jobs.
25. System can create Flow batch.
26. System can export batch prompt TXT.
27. System can export batch manifest JSON.
28. System enforces FLOW_FREE max 5 jobs/day.

### Import + Review

29. System can scan Drive batch folder.
30. System can match file by prefix.
31. System can show unmatched files.
32. User can manual attach unmatched file.
33. User can approve/reject clip.
34. User can request regenerate.

### Mobile

35. User can open mobile dashboard.
36. User can open remote desktop link.
37. User can open Flow link.
38. User can open Drive link.
39. User can copy prompt from mobile.
40. User can review status from mobile.

### Upload + Performance

41. User can attach final video Drive file.
42. System can create TikTok upload package.
43. System can create Shopee upload package.
44. Captions/tags differ per platform.
45. User can copy caption/tags/CTA/affiliate link.
46. User can mark uploaded and paste post URL.
47. User can input daily views/clicks/orders/commission/revenue.
48. User can mark winner manually.

### Scope Control

49. MVP does not include auto-upload.
50. MVP does not include video editor.
51. MVP does not include custom remote desktop engine.
52. MVP does not include multi-user/team permission.
53. MVP does not include Business/Enterprise/Pro Flow support.

---

## 20. Open Questions

The following are allowed implementation details, not scope blockers:

```text
- Exact UI component library choice.
- Exact Google Drive OAuth token storage implementation.
- Exact encryption library for API keys/tokens.
- Exact deployment platform.
- Whether Gemini prompt generation is bundled into 2 requests/content or split into 7 logical tasks.
```

The following are not open and must not be changed without explicit approval:

```text
- Supabase Auth
- Supabase Postgres
- Google Drive asset source of truth
- Single operator MVP
- Gemini multi-project/key setup
- Google Flow external execution
- No auto-upload
- No video editor
- No custom remote desktop engine
```

---

## 21. Change Control

Any change to the following requires explicit approval before implementation:

```text
- Architecture stack
- Database schema core entities
- Auth provider
- Asset storage provider
- Scope MVP/P1/P2
- Gemini model/key strategy
- Prompt prefix format
- Google Drive folder standard
- Status lifecycle
- Upload workflow
```

---

## 22. Final MVP Lock Statement

```text
Affiliate AI Content OS MVP is locked as an AI production control center.

It manages Gemini projects/keys, Drive assets, vision/i2i/i2v prompt generation, Flow batch preparation, import/result matching, mobile control, review, upload packages, and manual performance tracking.

It does not generate videos internally, edit videos, auto-upload to TikTok/Shopee, or build a custom remote desktop engine.
```
