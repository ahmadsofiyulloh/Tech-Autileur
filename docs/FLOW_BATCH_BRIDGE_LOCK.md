# Flow Batch Bridge Lock

## Purpose
The app prepares prompt batches for Google Flow. Google Flow remains the external executor. Windows Helper bridges local Chrome profile opening and output import without browser automation.

## Phase Scope

Phase 1 freezes `/controller` and redirects it to `/products/new`. The board and helper contract below describe the retained desktop Flow Control surface for the phase when it is enabled.

## Locked Rules

- UI label: `Flow Control`.
- Route: `/controller`.
- Surface: desktop-only retained board.
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
Tipe Akun
```

`account_code` is auto-generated and hidden from operator UI.

Advanced defaults may be hidden:

```text
observed_daily_credit
observed_monthly_credit
credit_per_generation
max_parallel_allowed
cooldown_minutes
status
```

`Pengaturan > Account` owns Chrome profile pairing and App API Token controls. `/controller` must not duplicate pairing actions.

Flow Accounts are controller-owned execution tools. They may appear in `/controller` support panels when the retained desktop surface is enabled for recommendation, status, credit, cooldown, and slot management. They must not become a separate Settings CRUD surface. Settings may only link to Flow Control or show a minimal Flow status card.

## Account Recommendation

Flow Control recommends an account only when:

- status is active.
- observed credit is enough for the job.
- active slot is available.
- account is not in cooldown.

The user confirms the recommendation. The app must not silently bind workspace to an account.

## Chrome Profile Lane Contract

- Supabase may store `chrome_profile_lane_key` as an app-visible label, but never absolute `chrome_profile_path` values.
- Helper local config owns the real mapping: `flow_account_code + chrome_profile_lane_key -> chrome_profile_path`.
- The app must not claim a Flow account is paired until helper verification confirms that the lane is available.
- Runtime lane labels are:
  - `Not paired`: no lane key label has been assigned yet.
  - `Lane key set`: the app has a lane label, but helper verification is still pending.
  - `Helper verified`: helper confirmed the mapped Chrome profile is available.
  - `Session expired`: helper previously verified the lane, but the local Chrome session is no longer valid.
  - `Unavailable`: helper cannot bind the lane to a usable local profile right now.
- Conceptual handshake only, not an implementation contract:
  - app sends `flow_account_code`, `chrome_profile_lane_key`, and a request id.
  - helper returns `status`, `verified_at`, `reason`, and `session_state`.
  - `chrome_profile_path` never leaves helper local config.

## Controlled Multi-Select Batch Creation

- Multi-select source is active workspace `Prompt Ready` rows only.
- Default selection cap is `25`; hard cap is `50`, matching the locked Phase 2 batch ceiling already approved for bulk work.
- Prompt packs that already have open batches are skipped, not blocked, and the skipped count is shown to the operator.
- Batch creation uses the available Flow account pool only.
- The app must not silently assign an unavailable Flow account.
- Flow accounts remain global execution tools and are not workspace-bound.
- Batch creation returns created batch count, skipped count, and reasons per selected prompt pack.
- Manifest export remains a separate operator step after batch creation. Batch creation does not write manifest JSON or helper files.

## Board Columns

Columns are exactly:

```text
Prompt Siap
Sedang Flow
Output Masuk
Selesai
```

Each card shows:

- product name.
- selected Flow account type/status.
- clip count.
- status.
- last action timestamp.

Progress source:

- user actions in the app.
- Windows Helper metadata callback after upload.

Do not claim real-time Google Flow progress unless helper or extension data explicitly reports it.

Support panels on `/controller` should be collapsed by default so the board remains queue-first when that surface is enabled.

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

Phase 2 stage-aware manifests keep the legacy `jobs[]` video list for helper compatibility and add `stage_jobs[]` for the operator run loop. `stage_jobs[]` must contain:

```text
job_code
content_code
clip_code
version
stage FIRST_FRAME | LAST_FRAME | VIDEO
stage_order
prompt_file_name
prompt_copy_text
input_handles
output_purpose
output_file_name
depends_on_job_codes
```

Stage rules:

- `FIRST_FRAME` uses `@character`, `@environment`, and `@product`.
- `LAST_FRAME` depends on `FIRST_FRAME` and uses only `@firstframe`.
- `VIDEO` depends on both frame stages and uses only `@firstframe` and `@lastframe`.

## Manifest JSON

The app manifest must include the minimum data Windows Helper needs:

```json
{
  "schema_version": "flow_manifest_v2",
  "batch_code": "",
  "flow_account_code": "",
  "chrome_profile_lane_key": null,
  "flow_url": "",
  "drive_output_folder_id": "",
  "drive_output_folder_url": "",
  "helper_output_folder_key": "",
  "rename_pattern": "PRODUCTCODE_BATCHCODE_CLIP01_V01.mp4",
  "prompt_context": {},
  "stage_jobs": [],
  "jobs": []
}
```

`chrome_profile_lane_key` is an app-visible label only. It may travel in the manifest and app metadata, but the absolute Chrome profile path must stay local to helper config.

## Windows Helper Contract

Helper local config maps:

```text
flow_account_code + chrome_profile_lane_key -> chrome_profile_path
helper_output_folder_key -> local_output_folder_path
```

Helper may:

- import/read manifest JSON.
- open selected Chrome profile.
- open Google Flow URL.
- prepare stage prompt TXT files from `stage_jobs`.
- watch local output folder.
- rename generated files.
- upload renamed files to Google Drive with local OAuth.
- callback app metadata endpoint with App API Token.
- report lane verification state to the app using the lane key label, without exposing local profile paths.

Helper must not:

- click Google Flow controls.
- select Google Flow project automatically.
- submit prompts automatically.
- store Chrome profile path in Supabase.
- store helper Drive OAuth token in Supabase.

Operator-facing desktop sequence, staging rules, and Chrome profile reuse details live in [FLOW_HELPER_DESKTOP_WORKFLOW.md](FLOW_HELPER_DESKTOP_WORKFLOW.md).

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
