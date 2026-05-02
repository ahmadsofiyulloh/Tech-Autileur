# Flow Batch Bridge Lock

## Purpose
The PWA prepares Google Flow jobs. Google Flow remains the external executor.

## Locked Rules
- MVP supports `FLOW_FREE` and `FLOW_PLUS` only.
- Flow accounts are global execution tools and are not workspace-bound.
- The account pool is dynamic; do not hardcode 22 or any fixed pool size.
- `FLOW_FREE`: 50 credits/day, 10 credits/generation, max 5 clips/account/day.
- `FLOW_PLUS`: reserve for priority/regenerate.
- Max 5 jobs per `FLOW_FREE` account per day.
- PWA does not auto-click Google Flow in MVP.
- PWA exports prompt batch TXT and manifest JSON.

## Batch Outputs
Each batch must have:

```text
batch_code
flow_account_id
flow_account_code
target_date
max_jobs
output_drive_folder_id
output_drive_folder_url
jobs[]
status
```

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

## Export Formats

### TXT Prompt Batch
One prompt per line or separated by a safe delimiter. No blank lines inside a prompt.

### JSON Manifest
Includes all metadata needed for import and matching.

## Status Lifecycle
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
