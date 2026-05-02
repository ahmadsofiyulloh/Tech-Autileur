# Database Schema Lock - Supabase Postgres MVP

## General Rules
- Database: Supabase Postgres.
- Auth: Supabase Auth.
- `auth.users.id` is the user identity source.
- Every owner-owned table must include `user_id uuid references auth.users(id) on delete cascade`.
- RLS must be enabled on all owner-owned tables.
- MVP is single user/operator, but schema must still be owner-safe.
- `workspace_id` is allowed on product flow tables only when explicitly listed below.
- Flow accounts, Gemini keys, Gemini secrets, drive items, and prompt packs are global user-owned tools and do not get `workspace_id`.

## Required Enums

```sql
create type account_status as enum ('ACTIVE', 'COOLDOWN', 'RATE_LIMITED', 'DISABLED');
create type ai_task_status as enum ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'RETRYING', 'WAITING_FOR_KEY', 'CANCELLED');
create type ai_task_type as enum ('VISION_ANALYSIS', 'I2I_PROMPT_PACK', 'I2V_PROMPT_PACK', 'CONSISTENCY_CHECK', 'PROMPT_REPAIR', 'CAPTION_TAGS', 'RISK_CHECK');
create type workspace_status as enum ('ACTIVE', 'ARCHIVED');
create type product_status as enum ('DRAFT', 'IMAGE_ATTACHED', 'IMAGE_ANALYZED', 'PROMPT_READY', 'IN_PRODUCTION', 'READY_FOR_UPLOAD', 'UPLOADED', 'ARCHIVED');
create type intake_status as enum ('DRAFT', 'SUBMITTED', 'NEEDS_REVIEW', 'REVIEWED', 'ANCHOR_READY');
create type prompt_pack_status as enum ('DRAFT', 'READY_FOR_CONTROLLER', 'SENT_TO_CONTROLLER', 'NEEDS_REVIEW', 'REVIEWED', 'REGENERATE_REQUESTED', 'ARCHIVED');
create type flow_batch_status as enum ('DRAFT', 'READY_TO_EXPORT', 'EXPORTED', 'RUNNING', 'IMPORTING', 'PARTIALLY_IMPORTED', 'IMPORTED', 'NEED_MANUAL_MATCH', 'CLOSED');
create type drive_item_kind as enum ('SOURCE_IMAGE', 'SCREENSHOT', 'ANALYSIS', 'PROMPT_REFERENCE', 'I2I_RESULT', 'RAW_CLIP', 'FINAL_VIDEO', 'BATCH_EXPORT', 'MANIFEST', 'UPLOAD_PACKAGE', 'OTHER');
create type affiliate_platform as enum ('TIKTOK', 'SHOPEE', 'OTHER');
create type affiliate_profile_status as enum ('ACTIVE', 'PAUSED', 'ARCHIVED');
create type upload_status as enum ('DRAFT', 'READY_TO_UPLOAD', 'UPLOADED', 'FAILED');
```

## Required Tables

### `profiles`
Extends `auth.users`.

```text
id uuid primary key references auth.users(id) on delete cascade
email text
timezone text default 'Asia/Jakarta'
created_at timestamptz default now()
updated_at timestamptz default now()
```

### `workspaces`
Workspace profile and grouping scope.

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

### `user_preferences`
Stores active workspace selection.

```text
user_id uuid pk fk auth.users
current_workspace_id uuid nullable composite fk workspaces(id, user_id)
created_at timestamptz
updated_at timestamptz
```

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
created_at timestamptz
updated_at timestamptz
```

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

### `product_marketplace_sources`
Manual marketplace references and notes.

```text
id uuid pk
user_id uuid fk auth.users
workspace_id uuid nullable composite fk workspaces(id, user_id)
product_id uuid fk products
source_type text
source_url text
source_title text
notes text
drive_item_ref_id uuid nullable fk drive_items
created_at timestamptz
updated_at timestamptz
```

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

### `prompt_packs`
Structured prompt output from the editor/generator step.

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

### `affiliate_profiles`
Unlimited affiliate profile records. Workspace scoped.

```text
id uuid pk
user_id uuid fk auth.users
workspace_id uuid fk workspaces(id, user_id)
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
lock_environment boolean
environment_notes text
environment_drive_item_ref_id uuid nullable fk drive_items
status affiliate_profile_status
created_at timestamptz
updated_at timestamptz
```

### `flow_accounts`
Global Flow tool pool.

```text
id uuid pk
user_id uuid fk auth.users
account_code text unique per user
account_type text
observed_daily_credit int
observed_monthly_credit int
credit_per_generation int default 10
max_parallel_allowed int default 1
cooldown_minutes int default 0
status account_status
notes text
created_at timestamptz
updated_at timestamptz
```

### `flow_batches`
Batch orchestration may optionally carry workspace or product context, but the account itself stays global.

```text
id uuid pk
user_id uuid fk auth.users
workspace_id uuid nullable composite fk workspaces(id, user_id)
product_id uuid nullable fk products
prompt_pack_id uuid nullable fk prompt_packs
batch_code text
flow_account_id uuid fk flow_accounts
target_date date
model text
max_jobs int
drive_output_folder_url text
drive_output_folder_id text
status flow_batch_status
created_at timestamptz
updated_at timestamptz
```

### `contents`
Optional supporting table for content grouping.

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

### `generated_files`
Optional matching log for imported Drive outputs.

```text
id uuid pk
user_id uuid fk auth.users
clip_job_id uuid nullable fk clip_jobs
drive_item_id uuid fk drive_items
file_name text
detected_prefix text
match_status text
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

## Workspace/Profile Additions

- `products.workspace_id` is nullable for backward-compatible null rows.
- `product_intake_sessions.workspace_id` is nullable.
- `product_marketplace_sources.workspace_id` is nullable.
- `product_anchors.workspace_id` is nullable.
- `affiliate_profiles.workspace_id` is required.
- `user_preferences.current_workspace_id` stores the active workspace.
- A user can have many workspaces.
- A workspace can have many affiliate profiles.

## RLS Policy Pattern

Every owner-owned table must use owner-only policies. Pattern:

- authenticated user can `select` own rows
- authenticated user can `insert` own rows
- authenticated user can `update` own rows
- no cross-user access

## Updated At Trigger

Every mutable table must have an `updated_at` trigger or equivalent server-managed timestamp behavior.
