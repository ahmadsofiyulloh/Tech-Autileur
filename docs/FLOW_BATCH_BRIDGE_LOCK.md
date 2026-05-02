# Flow Batch Bridge Lock

## Purpose
The app prepares prompt batches for Google Flow. Google Flow remains the external executor. Windows Helper bridges local Chrome profile opening and output import without browser automation.

## Locked Rules

- UI label: `Flow Control`.
- Route: `/controller`.
- Surface: desktop-only primary board.
- Flow accounts are global execution tools and are not workspace-bound.
- `flow_accounts` must not have `workspace_id`.
- The account pool is dynamic; do not hardcode `22` or any fixed pool size.
- MVP supports `FLOW_FREE` and `FLOW_PLUS`.
- `FLOW_FREE` default: 50 credits/day, 10 credits/generate, 1 active slot.
- `FLOW_PLUS` default: reserve/manual priority.
- PWA does not auto-click Google Flow.
- PWA does not auto-submit prompts to Google Flow.
- PWA exports or downloads batch manifest JSON.
- User manually runs Google Flow.

## Flow Account UI

Tiny form fields:

```text
Kode Akun
Tipe Akun
```

Advanced defaults may be hidden:

```text
observed_daily_credit
observed_monthly_credit
credit_per_generation
max_parallel_allowed
cooldown_minutes
status
notes
```

`Pengaturan > Account` owns Chrome profile pairing and App API Token controls. `/controller` must not duplicate pairing actions.

## Account Recommendation

Flow Control recommends an account only when:

- status is active.
- observed credit is enough for the job.
- active slot is available.
- account is not in cooldown.

The user confirms the recommendation. The app must not silently bind workspace to an account.

## Board Columns

Columns are exactly:

```text
Prompt Siap
Sedang Flow
Output Masuk
Selesai
```

Each card shows:

- product name or code.
- batch code.
- selected Flow account code.
- clip count.
- status.
- last action timestamp.

Progress source:

- user actions in the app.
- Windows Helper metadata callback after upload.

Do not claim real-time Google Flow progress unless helper or extension data explicitly reports it.

## Batch Outputs

Each batch must have:

```text
batch_code
flow_account_id
flow_account_code
product_id optional
workspace_id optional
prompt_pack_id
target_date
max_jobs
drive_output_folder_id
drive_output_folder_url
helper_output_folder_key optional
manifest_json
status
```

`helper_output_folder_key` is a label resolved by Windows Helper local config. Do not store absolute local output folder paths in Supabase in Phase awal.

## Job Outputs

Each job must have:

```text
job_code
content_code
clip_code
version
prompt_prefix
prompt_one_paragraph
start_frame_drive_url optional
last_frame_drive_url optional
```

## Manifest JSON

The app manifest must include the minimum data Windows Helper needs:

```json
{
  "batch_code": "",
  "flow_account_code": "",
  "flow_url": "",
  "drive_output_folder_id": "",
  "drive_output_folder_url": "",
  "helper_output_folder_key": "",
  "rename_pattern": "PRODUCTCODE_BATCHCODE_CLIP01_V01.mp4",
  "jobs": []
}
```

## Windows Helper Contract

Helper local config maps:

```text
flow_account_code -> chrome_profile_path
helper_output_folder_key -> local_output_folder_path
```

Helper may:

- import/read manifest JSON.
- open selected Chrome profile.
- open Google Flow URL.
- watch local output folder.
- rename generated files.
- upload renamed files to Google Drive with local OAuth.
- callback app metadata endpoint with App API Token.

Helper must not:

- click Google Flow controls.
- select Google Flow project automatically.
- submit prompts automatically.
- store Chrome profile path in Supabase.
- store helper Drive OAuth token in Supabase.

## Output Rename Pattern

Locked pattern:

```text
PRODUCTCODE_BATCHCODE_CLIP01_V01.mp4
```

## Status Lifecycle

Database status values may stay technical, but UI maps them to the board columns.

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

UI mapping:

```text
Prompt Siap    -> READY_TO_EXPORT, EXPORTED
Sedang Flow    -> RUNNING
Output Masuk   -> IMPORTING, PARTIALLY_IMPORTED, IMPORTED, NEED_MANUAL_MATCH
Selesai        -> CLOSED
```
