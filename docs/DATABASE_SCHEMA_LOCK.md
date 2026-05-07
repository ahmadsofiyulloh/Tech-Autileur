# Database Schema Lock - Supabase Postgres MVP

## General Rules

- Database: Supabase Postgres.
- Auth: Supabase Auth.
- `auth.users.id` is the user identity source.
- Every owner-owned table must include `user_id uuid references auth.users(id) on delete cascade`.
- RLS must be enabled on all owner-owned tables.
- MVP is single user/operator, but schema must still be owner-safe.
- `workspace_id` is allowed on product flow tables only when explicitly listed below.
- `flow_accounts` are global user-owned tools and must never have `workspace_id`.
- Chrome profile paths must not be stored in Supabase in Phase awal.
- Windows Helper Drive OAuth tokens must not be stored in Supabase in Phase awal.
- Prompt packs do not get `workspace_id`; derive workspace context from product, intake session, and affiliate profile.
- Large asset bytes must not be stored in Supabase.
- 2026-05-06 refactor: `workspace_id` remains internal namespace infrastructure. Operator-facing scope is Affiliate Profile.
- Do not remove or rename `workspaces` in this refactor. Any direct `affiliate_profile_id` schema cleanup for product-flow tables belongs to a later explicit migration task.

## Required Enums

```sql
create type account_status as enum ('ACTIVE', 'COOLDOWN', 'RATE_LIMITED', 'DISABLED', 'ERROR');
create type ai_task_status as enum ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'RETRYING', 'WAITING_FOR_KEY', 'CANCELLED');
create type ai_task_type as enum ('VISION_ANALYSIS', 'I2I_PROMPT', 'I2V_PROMPT', 'CONSISTENCY_CHECK', 'PROMPT_REPAIR', 'FALLBACK', 'PROMPT_PACK_GENERATION');
create type gemini_key_role as enum ('VISION_ANALYSIS', 'I2I_PROMPT', 'I2V_PROMPT', 'CONSISTENCY_CHECK', 'PROMPT_REPAIR', 'FALLBACK');
create type workspace_status as enum ('ACTIVE', 'ARCHIVED');
create type product_status as enum ('DRAFT', 'IMAGE_ATTACHED', 'IMAGE_ANALYZED', 'PROMPT_READY', 'IN_PRODUCTION', 'READY_FOR_UPLOAD', 'UPLOADED', 'ARCHIVED');
create type intake_status as enum ('DRAFT', 'SUBMITTED', 'NEEDS_REVIEW', 'REVIEWED', 'ANCHOR_READY', 'ARCHIVED', 'ERROR');
create type prompt_pack_status as enum ('DRAFT', 'QUEUED', 'GENERATING', 'GENERATED', 'NEEDS_REVIEW', 'APPROVED', 'ARCHIVED', 'ERROR');
create type flow_batch_status as enum ('DRAFT', 'READY_TO_EXPORT', 'EXPORTED', 'RUNNING', 'IMPORTING', 'PARTIALLY_IMPORTED', 'IMPORTED', 'NEED_MANUAL_MATCH', 'CLOSED');
create type drive_item_kind as enum ('SOURCE_IMAGE', 'SCREENSHOT', 'ANALYSIS', 'PROMPT_REFERENCE', 'I2I_RESULT', 'RAW_CLIP', 'FINAL_VIDEO', 'BATCH_EXPORT', 'MANIFEST', 'UPLOAD_PACKAGE', 'OTHER');
create type marketplace_platform as enum ('SHOPEE', 'TIKTOK');
create type marketplace_source_status as enum ('DRAFT', 'ACTIVE', 'NEEDS_REVIEW', 'ARCHIVED', 'ERROR');
create type product_anchor_status as enum ('DRAFT', 'READY', 'USED_FOR_PROMPT', 'ARCHIVED', 'ERROR');
create type affiliate_platform as enum ('TIKTOK', 'SHOPEE', 'OTHER');
create type affiliate_profile_status as enum ('ACTIVE', 'PAUSED', 'ARCHIVED');
create type upload_status as enum ('DRAFT', 'READY_TO_UPLOAD', 'UPLOADED', 'FAILED');
```

## Required Tables

### `profiles`

```text
id uuid primary key references auth.users(id) on delete cascade
email text
timezone text default 'Asia/Jakarta'
created_at timestamptz default now()
updated_at timestamptz default now()
```

### `workspaces`

Workspace means internal niche/folder namespace.

2026-05-06 refactor lock:

- A workspace is no longer the visible top-level planning concept.
- Each Affiliate Profile owns one internal workspace/folder namespace.
- Workspace records may remain editable only as retained internal support until a later UI cleanup task removes that surface.

```text
id uuid pk
user_id uuid fk auth.users
workspace_code text unique per user
workspace_name text
niche text nullable
drive_root_folder_ref_id uuid nullable composite fk drive_items(id, user_id)
drive_root_folder_url text nullable
drive_root_folder_path text nullable
status workspace_status
is_default boolean
notes text nullable
created_at timestamptz
updated_at timestamptz
```

UI labels:

```text
Nama Ruang Kerja
Folder Drive Utama
```

### `user_preferences`

Stores active workspace selection.

```text
user_id uuid pk fk auth.users
current_workspace_id uuid nullable composite fk workspaces(id, user_id)
created_at timestamptz
updated_at timestamptz
```

### `helper_api_tokens`

Stores App API Token metadata for Windows Helper callbacks. Store token hash only.

```text
id uuid pk
user_id uuid fk auth.users
token_code text unique per user
token_hash text
status text default 'ACTIVE'
last_used_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Plain token value is shown once in Pengaturan and must not be stored in plaintext.

### `gemini_api_keys`

Metadata only.

```text
id uuid pk
user_id uuid fk auth.users
key_code text unique per user
label text
provider text default 'gemini'
google_account_label text
project_label text
model_name text
role text
rpm_limit int
rpd_limit int
tpm_limit int
requests_today int default 0
last_used_at timestamptz
cooldown_until timestamptz
status account_status
notes text
created_at timestamptz
updated_at timestamptz
```

`rpm_limit`, `rpd_limit`, and `tpm_limit` are not operator-editable fields in Phase awal. The app writes model-derived defaults when the key is created or updated.

`project_label` must be non-empty for `ACTIVE` Gemini keys. The app uses that metadata for `project + model` quota grouping and usage overview rendering.

### `gemini_api_key_secrets`

Server-only encrypted secret store.

```text
id uuid pk
user_id uuid fk auth.users
gemini_api_key_id uuid fk gemini_api_keys
encrypted_api_key text
created_at timestamptz
updated_at timestamptz
```

### `gemini_api_usage_events`

Request usage ledger for app-side Gemini quota analytics. Secret values are never stored here.

```text
id uuid pk
user_id uuid fk auth.users
gemini_api_key_id uuid composite fk gemini_api_keys(id, user_id)
ai_task_id uuid nullable composite fk ai_tasks(id, user_id)
project_label text nullable
model_name text
role gemini_key_role
task_type ai_task_type
request_started_at timestamptz
request_finished_at timestamptz nullable
status text check in ('STARTED', 'SUCCESS', 'FAILED', 'RATE_LIMITED')
http_status int nullable
prompt_token_count int nullable
candidates_token_count int nullable
total_token_count int nullable
thoughts_token_count int nullable
cached_content_token_count int nullable
retry_after_seconds int nullable
error_message text nullable
created_at timestamptz
updated_at timestamptz
```

Usage overview rules:

- group by `project_label + model_name` when `project_label` exists.
- fall back to per-key grouping when `project_label` is empty.
- `RPD` uses current Google quota day starting at midnight Pacific time.
- `RPM` uses rolling last 60 seconds.
- `TPM` uses Gemini `usageMetadata.promptTokenCount` for rolling last 60 seconds.

### `ai_tasks`

Queue for Gemini work.

```text
id uuid pk
user_id uuid fk auth.users
product_id uuid nullable
intake_session_id uuid nullable
prompt_pack_id uuid nullable
clip_job_id uuid nullable
api_key_id uuid nullable fk gemini_api_keys
task_type ai_task_type
status ai_task_status
input_json jsonb
output_json jsonb
error_message text
retry_count int default 0
priority int default 100
scheduled_at timestamptz default now()
started_at timestamptz
finished_at timestamptz
created_at timestamptz
updated_at timestamptz
```

2026-05-07 Intake refactor implementation note: the first UI/backend wave must not depend on `ai_tasks.product_id` or `ai_tasks.intake_session_id` for readiness display. Metadata readiness should be derived from existing product, image, intake session, and action state until the live schema contract is explicitly reconciled by a later approved schema task.

### `drive_items`

Drive metadata only. No large asset bytes.

```text
id uuid pk
user_id uuid fk auth.users
drive_item_id text
name text
mime_type text
kind drive_item_kind
drive_url text
folder_id text
folder_path text
size_bytes bigint nullable
checksum text nullable
product_id uuid nullable
intake_session_id uuid nullable
prompt_pack_id uuid nullable
clip_job_id uuid nullable
batch_id uuid nullable
created_at timestamptz
updated_at timestamptz
```

### `products`

```text
id uuid pk
user_id uuid fk auth.users
workspace_id uuid nullable composite fk workspaces(id, user_id)
product_code text unique per user
product_name text
niche text
marketplace text
marketplace_product_link text
status product_status
workflow_status_json jsonb not null default '{"video_generated": false, "uploaded_shopee": false, "uploaded_tiktok": false}'::jsonb
created_at timestamptz
updated_at timestamptz
```

`workflow_status_json` stores manual product management markers for the mobile `/products` surface. Prompt-ready remains derived from prompt packs, and final clip upload stays manual outside the app.

2026-05-07 Intake refactor lock: a captured product saved from Intake remains `DRAFT` even when the product source image has been uploaded. `products.status` must not be used as the only proof that metadata analysis is ready. Source image availability is derived from `product_images` and Drive metadata, while metadata readiness is derived from `product_intake_sessions` and review/action state.

### `product_images`

Keeps product image/screenshot references and analysis payloads.

```text
id uuid pk
user_id uuid fk auth.users
product_id uuid fk products
source_drive_item_id uuid nullable fk drive_items
source_type text
analysis_json jsonb
status text
created_at timestamptz
updated_at timestamptz
```

Intake capture may create or attach source image records before Gemini metadata analysis succeeds. The image/evidence relation is the source of truth for image availability; it does not imply metadata readiness.

### `product_intake_sessions`

Single intake workflow record.

```text
id uuid pk
user_id uuid fk auth.users
workspace_id uuid nullable composite fk workspaces(id, user_id)
product_id uuid nullable fk products
status intake_status
input_json jsonb
draft_payload_json jsonb
submitted_payload_json jsonb
reviewed_metadata_json jsonb
prompt_ready_json jsonb
created_at timestamptz
updated_at timestamptz
```

2026-05-07 lifecycle mapping:

- `DRAFT`: product/source capture exists but metadata is not ready.
- `SUBMITTED`: metadata analysis has been requested or evidence submitted.
- `NEEDS_REVIEW`: parsed metadata exists and requires operator review.
- `REVIEWED`: operator-reviewed metadata is ready for prompt generation.
- `ERROR`: metadata analysis failed but the product remains recoverable.

Do not require Gemini success before creating durable product/intake records.

### `product_marketplace_sources`

Marketplace evidence rows for Shopee and TikTok screenshots.

```text
id uuid pk
user_id uuid fk auth.users
workspace_id uuid nullable composite fk workspaces(id, user_id)
product_id uuid fk products
platform marketplace_platform
product_url text nullable
affiliate_url text nullable
title text nullable
category text nullable
rating_text text nullable
sold_count_text text nullable
price_text text nullable
shop_name text nullable
screenshot_drive_item_ref_id uuid nullable composite fk drive_items(id, user_id)
parsed_metadata_json jsonb nullable
status marketplace_source_status
notes text nullable
created_at timestamptz
updated_at timestamptz
```

Rows are unique per `(user_id, product_id, platform)`. OCR-derived fields must come from uploaded image bytes and `parsed_metadata_json` must retain the diagnostic OCR evidence when Gemini vision is used.

Do not claim visual parsing from `product_url` or `affiliate_url` when image bytes are not available.

### `product_anchors`

Reusable anchor context for prompt generation.

```text
id uuid pk
user_id uuid fk auth.users
workspace_id uuid nullable composite fk workspaces(id, user_id)
product_id uuid fk products
anchor_json jsonb
source_drive_item_ref_id uuid nullable fk drive_items
status text
created_at timestamptz
updated_at timestamptz
```

### `affiliate_profiles`

Top-level affiliate persona records. In the 2026-05-06 refactor, one profile owns one internal workspace/folder namespace. The existing link table remains for compatibility, but new UI must not expose many-to-many workspace choices.

```text
id uuid pk
user_id uuid fk auth.users
profile_code text unique per user
profile_name text
platform affiliate_platform
account_label text
niche text
affiliate_url text
notes text
i2i_prompt_rules text
i2v_prompt_rules text
caption_rules text
hashtag_rules text
negative_prompt_rules text
product_positioning_notes text
lock_seed_character boolean
seed_character_notes text
seed_character_drive_item_ref_id uuid nullable fk drive_items
seed_character_analysis_json jsonb nullable
lock_environment boolean
environment_notes text
environment_drive_item_ref_id uuid nullable fk drive_items
environment_analysis_json jsonb nullable
status affiliate_profile_status
created_at timestamptz
updated_at timestamptz
```

Affiliate Profile is the only owner for character and environment locks in Phase awal. The environment asset is the background-lock asset. There is no separate background-reference column in MVP.

UI note: `notes` may remain as legacy/internal metadata, but it must not be shown in Phase awal forms.

Character and environment assets are stored as Drive item metadata references and should resolve from the profile-owned admin folders in Google Drive. Their OCR/vision analysis snapshots are cached on the affiliate profile in `seed_character_analysis_json` and `environment_analysis_json`, and the drawer exposes explicit reanalysis refresh actions when the Drive reference changes. Prompt generation reuses the cached snapshot only while its `drive_item_ref_id` still matches the current Drive reference.

UI surface lock: Affiliate Profile create/edit happens in a list + drawer CRUD surface. Character and environment are separate image cards in the drawer. Asset upload/replace/remove controls live inside the editable drawer only.

### `affiliate_profile_workspace_links`

Explicit workspace-to-profile relation with default selection.

```text
id uuid pk
user_id uuid fk auth.users
workspace_id uuid fk workspaces(id, user_id)
affiliate_profile_id uuid fk affiliate_profiles(id, user_id)
is_default boolean
created_at timestamptz
updated_at timestamptz
```

Compatibility table for profile-to-internal-workspace ownership.

2026-05-06 refactor lock:

- new UI must maintain exactly one active workspace link per Affiliate Profile.
- many-to-many workspace selection must not be exposed to the operator.
- create flows should default both asset locks to `true`.
- save may still happen without asset refs, but prompt generation must block if a locked asset reference or cached analysis JSON is missing or stale.

Legacy behavior where each workspace can link to multiple affiliate profiles is retained only for existing compatibility until a later schema cleanup task is approved.

### Cutoff Preserve List

The 2026-05-06 data cutoff is destructive and must preserve only:

```text
auth.users
public.profiles
public.gemini_api_keys
public.gemini_api_key_secrets
public.google_drive_connections
```

Cutoff must delete Supabase metadata/data only. It must not delete real files from Google Drive.

### `prompt_packs`

Structured prompt output from the generator/detail-editor step.

```text
id uuid pk
user_id uuid fk auth.users
product_id uuid fk products
intake_session_id uuid nullable fk product_intake_sessions
affiliate_profile_id uuid nullable fk affiliate_profiles
version text
product_analysis_json jsonb
i2i_prompts_json jsonb
i2v_prompts_json jsonb
consistency_rules_json jsonb
negative_rules_json jsonb
personalization_json jsonb
status prompt_pack_status
created_at timestamptz
updated_at timestamptz
```

`personalization_json` must include `prompt_context` for the generated version. Prompt pack versions must be preserved.

`prompt_context` must retain the active workspace context, active affiliate profile snapshot, and the character/environment Drive references that were used for generation.

`GENERATED` is the Phase 1 final operator-facing prompt status. `APPROVED` is retained only as dormant controller readiness compatibility while `/controller` and `/flow` stay frozen.

### `flow_accounts`

Global Flow tool pool.

```text
id uuid pk
user_id uuid fk auth.users
account_code text unique per user
account_type text check in ('FLOW_FREE', 'FLOW_PLUS')
observed_daily_credit int default 50
observed_monthly_credit int nullable
credit_per_generation int default 10
max_parallel_allowed int default 1
cooldown_minutes int default 0
status account_status
notes text
created_at timestamptz
updated_at timestamptz
```

Forbidden columns:

```text
workspace_id
chrome_profile_path
local_profile_path
google_refresh_token
```

UI tiny form:

```text
Tipe Akun
```

`account_code` is generated internally and hidden from operator UI.

UI surface lock: Flow Accounts are controller-owned execution tools. They can appear in retained `/controller` support panels when that surface is enabled, but they must not become a separate Settings CRUD surface. Phase 1 keeps `/controller` frozen and redirects it to `/products/new`.

### `flow_batches`

Batch orchestration may optionally carry workspace, product, and prompt context. The Flow account remains global.

```text
id uuid pk
user_id uuid fk auth.users
workspace_id uuid nullable composite fk workspaces(id, user_id)
product_id uuid nullable fk products
prompt_pack_id uuid nullable fk prompt_packs
batch_code text
flow_account_id uuid fk flow_accounts
target_date date
model text default 'google-flow'
max_jobs int
drive_output_folder_url text nullable
drive_output_folder_id text nullable
flow_url text nullable
helper_output_folder_key text nullable
manifest_json jsonb nullable
last_helper_event_at timestamptz nullable
status flow_batch_status
created_at timestamptz
updated_at timestamptz
```

`helper_output_folder_key` is a local helper label, not an absolute local path.

### `contents`

Supporting table for output package grouping.

```text
id uuid pk
user_id uuid fk auth.users
product_id uuid fk products
content_code text
platform text
hook_type text
angle text
caption_tiktok text nullable
caption_shopee text nullable
tags_tiktok jsonb nullable
tags_shopee jsonb nullable
prompt_pack_id uuid nullable fk prompt_packs
status text
created_at timestamptz
updated_at timestamptz
```

### `clip_jobs`

```text
id uuid pk
user_id uuid fk auth.users
content_id uuid fk contents
prompt_pack_id uuid nullable fk prompt_packs
batch_id uuid nullable fk flow_batches
job_code text
clip_code text
version text default 'V01'
prompt_prefix text
prompt_one_paragraph text
start_frame_drive_item_id uuid nullable fk drive_items
last_frame_drive_item_id uuid nullable fk drive_items
generated_drive_item_id uuid nullable fk drive_items
status text
created_at timestamptz
updated_at timestamptz
```

UI status labels:

```text
Belum Ada
Imported
Approved
```

### `generated_files`

Matching log for helper-imported Drive outputs.

```text
id uuid pk
user_id uuid fk auth.users
clip_job_id uuid nullable fk clip_jobs
drive_item_id uuid fk drive_items
file_name text
detected_prefix text
match_status text
helper_report_json jsonb nullable
imported_at timestamptz
created_at timestamptz
updated_at timestamptz
```

### `final_videos`

```text
id uuid pk
user_id uuid fk auth.users
content_id uuid fk contents
drive_item_id uuid fk drive_items
notes text
created_at timestamptz
updated_at timestamptz
```

### `upload_packages`

```text
id uuid pk
user_id uuid fk auth.users
content_id uuid fk contents
affiliate_profile_id uuid nullable fk affiliate_profiles
final_video_drive_item_id uuid nullable fk drive_items
caption text
tags_json jsonb
cta text
post_url_after_upload text
upload_status upload_status
created_at timestamptz
updated_at timestamptz
```

Output package must use Drive links. No server-side ZIP generation in Phase awal.

### `performance_metrics`

```text
id uuid pk
user_id uuid fk auth.users
product_id uuid fk products
content_id uuid nullable fk contents
affiliate_profile_id uuid nullable fk affiliate_profiles
platform text
views int nullable
clicks int nullable
orders int nullable
gross_commission numeric nullable
net_commission numeric nullable
revenue numeric nullable
is_winner boolean default false
created_at timestamptz
updated_at timestamptz
```

## Required Indexes and Constraints

Minimum indexes:

- `flow_accounts (user_id, account_code)` unique.
- `flow_accounts (user_id, status)`.
- `flow_batches (user_id, batch_code)` unique.
- `flow_batches (user_id, status, target_date)`.
- `flow_batches (user_id, flow_account_id)`.
- `flow_batches (user_id, workspace_id)`.
- `flow_batches (user_id, product_id)`.
- `flow_batches (user_id, prompt_pack_id)`.
- `clip_jobs (user_id, batch_id)`.
- `clip_jobs (user_id, prompt_pack_id)`.
- `clip_jobs (user_id, status)`.
- `generated_files (user_id, clip_job_id)`.
- `generated_files (user_id, drive_item_id)`.
- `generated_files (user_id, match_status)`.
- `helper_api_tokens (user_id, token_code)` unique.
- `gemini_api_usage_events (user_id, request_started_at desc)`.
- `gemini_api_usage_events (user_id, gemini_api_key_id, request_started_at desc)`.
- `gemini_api_usage_events (user_id, project_label, model_name, request_started_at desc)`.

Minimum foreign keys:

- `flow_batches (flow_account_id, user_id)` -> `flow_accounts (id, user_id)`.
- `flow_batches (workspace_id, user_id)` -> `workspaces (id, user_id)`.
- `flow_batches (product_id, user_id)` -> `products (id, user_id)`.
- `flow_batches (prompt_pack_id, user_id)` -> `prompt_packs (id, user_id)`.
- `clip_jobs (batch_id, user_id)` -> `flow_batches (id, user_id)`.
- `clip_jobs (prompt_pack_id, user_id)` -> `prompt_packs (id, user_id)`.
- `generated_files (clip_job_id, user_id)` -> `clip_jobs (id, user_id)`.
- `generated_files (drive_item_id, user_id)` -> `drive_items (id, user_id)`.
- `gemini_api_usage_events (gemini_api_key_id, user_id)` -> `gemini_api_keys (id, user_id)`.
- `gemini_api_usage_events (ai_task_id, user_id)` -> `ai_tasks (id, user_id)`.

## RLS Policy Pattern

Every owner-owned table must use owner-only policies:

- authenticated user can `select` own rows.
- authenticated user can `insert` own rows.
- authenticated user can `update` own rows.
- no cross-user access.

Windows Helper callback must authenticate with App API Token and resolve the owner before writing metadata. The callback must not bypass owner scoping.

## Updated At Trigger

Every mutable table must have an `updated_at` trigger or equivalent server-managed timestamp behavior.
