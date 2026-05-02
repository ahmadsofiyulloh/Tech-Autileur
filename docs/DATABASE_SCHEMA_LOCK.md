# Database Schema Lock — Supabase Postgres MVP

## General Rules
- Database: Supabase Postgres.
- Auth: Supabase Auth.
- `auth.users.id` is the user identity source.
- Every owner-owned table must include `user_id uuid references auth.users(id) on delete cascade`.
- RLS must be enabled on all owner-owned tables.
- MVP is single user/operator, but schema should still be owner-safe.

## Required Enums

```sql
create type account_status as enum ('ACTIVE', 'COOLDOWN', 'RATE_LIMITED', 'DISABLED');
create type ai_task_status as enum ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'RETRYING', 'WAITING_FOR_KEY', 'CANCELLED');
create type ai_task_type as enum ('VISION_ANALYSIS', 'I2I_PROMPT_PACK', 'I2V_PROMPT_PACK', 'CONSISTENCY_CHECK', 'PROMPT_REPAIR', 'CAPTION_TAGS', 'RISK_CHECK');
create type gemini_key_role as enum ('VISION', 'I2I', 'I2V', 'CONSISTENCY', 'QA', 'FALLBACK');
create type product_status as enum ('DRAFT', 'IMAGE_ATTACHED', 'IMAGE_ANALYZED', 'PROMPT_READY', 'IN_PRODUCTION', 'READY_FOR_UPLOAD', 'UPLOADED', 'ARCHIVED');
create type content_status as enum ('PLANNED', 'PROMPT_READY', 'BATCHED', 'GENERATING', 'NEED_REVIEW', 'APPROVED', 'FINALIZED', 'READY_TO_UPLOAD', 'UPLOADED');
create type clip_job_status as enum ('PENDING', 'PROMPT_READY', 'BATCHED', 'EXPORTED', 'RUNNING_MANUAL', 'DOWNLOADED', 'MATCHED', 'NEED_REVIEW', 'APPROVED', 'REJECTED', 'REGENERATE_REQUESTED', 'FAILED');
create type batch_status as enum ('DRAFT', 'READY_TO_EXPORT', 'EXPORTED', 'RUNNING', 'IMPORTING', 'PARTIALLY_IMPORTED', 'IMPORTED', 'NEED_MANUAL_MATCH', 'CLOSED');
create type drive_file_kind as enum ('SOURCE_IMAGE', 'I2I_RESULT', 'RAW_CLIP', 'FINAL_VIDEO', 'BATCH_EXPORT', 'MANIFEST', 'UPLOAD_PACKAGE', 'OTHER');
create type upload_status as enum ('DRAFT', 'READY_TO_UPLOAD', 'UPLOADED', 'FAILED');
```

## Required Tables

### `profiles`
Extends `auth.users`.

Fields:

```text
id uuid primary key references auth.users(id) on delete cascade
email text
timezone text default 'Asia/Jakarta'
created_at timestamptz default now()
updated_at timestamptz default now()
```

### `gemini_api_keys`
Stores encrypted Gemini key metadata.

```text
id uuid pk
user_id uuid fk auth.users
key_code text unique per user
label text
provider text default 'gemini'
google_account_label text
project_label text
model_name text
role gemini_key_role
rpm_limit int
rpd_limit int
tpm_limit int
encrypted_api_key text
requests_today int default 0
last_used_at timestamptz
cooldown_until timestamptz
status account_status
notes text
created_at timestamptz
updated_at timestamptz
```

### `ai_tasks`
Queue for Gemini work.

```text
id uuid pk
user_id uuid fk auth.users
product_id uuid nullable
content_id uuid nullable
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

### `google_drive_connections`
OAuth/token metadata. Tokens encrypted.

```text
id uuid pk
user_id uuid fk auth.users
connection_label text
root_folder_id text
root_folder_url text
encrypted_refresh_token text nullable
status account_status
created_at timestamptz
updated_at timestamptz
```

### `drive_files`
Metadata for Drive files only.

```text
id uuid pk
user_id uuid fk auth.users
drive_file_id text
name text
mime_type text
kind drive_file_kind
drive_url text
folder_id text
folder_path text
size_bytes bigint nullable
checksum text nullable
product_id uuid nullable
content_id uuid nullable
clip_job_id uuid nullable
batch_id uuid nullable
created_at timestamptz
updated_at timestamptz
```

### `products`

```text
id uuid pk
user_id uuid fk auth.users
workspace_id uuid nullable fk workspaces(id, user_id)
product_code text unique per user
product_name text
niche text
marketplace text
marketplace_product_link text
status product_status
created_at timestamptz
updated_at timestamptz
```

## Workspace/Profile Additions

Sprint 12B adds workspace/profile persistence:

```text
workspaces
- id uuid pk
- user_id uuid fk auth.users
- workspace_code text unique per user
- workspace_name text
- niche text nullable
- drive_root_folder_ref_id uuid nullable composite fk drive_items(id, user_id)
- drive_root_folder_url text nullable
- drive_root_folder_path text nullable
- status workspace_status
- is_default boolean
- notes text nullable
- created_at timestamptz
- updated_at timestamptz

user_preferences
- user_id uuid pk fk auth.users
- current_workspace_id uuid nullable composite fk workspaces(id, user_id)
- created_at timestamptz
- updated_at timestamptz
```

Sprint 12C scopes product flow records to workspaces with nullable `workspace_id` for backward compatibility:

```text
products.workspace_id uuid nullable composite fk workspaces(id, user_id)
product_intake_sessions.workspace_id uuid nullable composite fk workspaces(id, user_id)
product_marketplace_sources.workspace_id uuid nullable composite fk workspaces(id, user_id)
product_anchors.workspace_id uuid nullable composite fk workspaces(id, user_id)
```

Flow accounts remain global execution tools. Do not add `workspace_id` to Flow accounts, Flow batches, clip jobs, AI tasks, Gemini key tables, Drive item tables, or prompt packs unless a later approved sprint changes the lock.

### `product_images`

```text
id uuid pk
user_id uuid fk auth.users
product_id uuid fk products
source_drive_file_id uuid nullable fk drive_files
drive_file_url text nullable
source_type text
analysis_json jsonb
status text
created_at timestamptz
updated_at timestamptz
```

### `contents`

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
prompt_pack_json jsonb nullable
status content_status
created_at timestamptz
updated_at timestamptz
```

### `clip_jobs`

```text
id uuid pk
user_id uuid fk auth.users
content_id uuid fk contents
batch_id uuid nullable
job_code text
clip_code text -- C01/C02
version text default 'V01'
prompt_prefix text
prompt_i2i_start text nullable
prompt_i2i_last text nullable
prompt_i2v text nullable
start_frame_drive_file_id uuid nullable fk drive_files
last_frame_drive_file_id uuid nullable fk drive_files
generated_file_id uuid nullable fk drive_files
status clip_job_status
created_at timestamptz
updated_at timestamptz
```

### `flow_accounts`

```text
id uuid pk
user_id uuid fk auth.users
account_code text
account_type text -- FLOW_FREE/FLOW_PLUS
observed_daily_credit int
observed_monthly_credit int
credit_per_generation int default 10
max_clip_per_day int
max_parallel_allowed int default 1
cooldown_minutes int default 0
status account_status
notes text
created_at timestamptz
updated_at timestamptz
```

### `batches`

```text
id uuid pk
user_id uuid fk auth.users
batch_code text
flow_account_id uuid fk flow_accounts
target_date date
model text
max_jobs int
drive_output_folder_url text
drive_output_folder_id text
status batch_status
created_at timestamptz
updated_at timestamptz
```

### `generated_files`
Optional matching log. Can also use `drive_files` directly.

```text
id uuid pk
user_id uuid fk auth.users
clip_job_id uuid nullable fk clip_jobs
drive_file_id uuid fk drive_files
file_name text
match_status text
matched_prefix text nullable
imported_at timestamptz default now()
created_at timestamptz
updated_at timestamptz
```

### `affiliate_accounts`

```text
id uuid pk
user_id uuid fk auth.users
account_code text
platform text
marketplace text
niche text
status account_status
notes text
created_at timestamptz
updated_at timestamptz
```

### `affiliate_links`

```text
id uuid pk
user_id uuid fk auth.users
product_id uuid fk products
affiliate_account_id uuid fk affiliate_accounts
platform text
marketplace text
niche text
affiliate_link text
status account_status
created_at timestamptz
updated_at timestamptz
```

### `final_videos`

```text
id uuid pk
user_id uuid fk auth.users
content_id uuid fk contents
final_video_drive_file_id uuid nullable fk drive_files
final_video_drive_url text
final_video_file_name text
edited_on text default 'mobile'
status text
created_at timestamptz
updated_at timestamptz
```

### `upload_packages`

```text
id uuid pk
user_id uuid fk auth.users
final_video_id uuid fk final_videos
affiliate_link_id uuid fk affiliate_links
platform text
caption text
tags jsonb
cta text
post_url_after_upload text nullable
upload_status upload_status
created_at timestamptz
updated_at timestamptz
```

### `performance_metrics`

```text
id uuid pk
user_id uuid fk auth.users
upload_package_id uuid fk upload_packages
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

## Index Requirements
Create indexes for:

- every `user_id`
- every FK used in joins
- `products(product_code)`
- `contents(product_id, content_code)`
- `clip_jobs(prompt_prefix)`
- `batches(target_date, status)`
- `drive_files(drive_file_id)`
- `ai_tasks(status, priority, scheduled_at)`

## RLS Policy Pattern
For owner-owned tables:

```sql
alter table public.table_name enable row level security;

create policy "select own rows" on public.table_name
for select to authenticated
using (auth.uid() = user_id);

create policy "insert own rows" on public.table_name
for insert to authenticated
with check (auth.uid() = user_id);

create policy "update own rows" on public.table_name
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "delete own rows" on public.table_name
for delete to authenticated
using (auth.uid() = user_id);
```

## Updated At Trigger
Use one reusable trigger function for `updated_at`.
