# Google Drive File System Lock

## Purpose
Google Drive is the source of truth for all file bytes and assets. Supabase stores metadata and relationships only.

## Root Folder

```text
/AffiliateAI/
```

## Standard Folder Structure

```text
/AffiliateAI/
  /00_ADMIN/
    /affiliate_profiles/
      /PROFILE_CODE/
        /character/
        /environment/
    google_flow_accounts/
    gemini_api_projects/
    helper_manifests/
    templates/

  /01_PRODUCTS/
    /PRODUCT_CODE/
      /01_SOURCE_IMAGES/
      /02_SCREENSHOTS/
      /03_ANALYSIS/
      /04_PROMPT_REFERENCES/
      /05_I2I_RESULTS/
      /06_I2V_PROMPTS/
      /07_CLIPS_RAW/
      /08_FINAL_VIDEO/
      /09_UPLOAD_PACKAGE/
      /10_PERFORMANCE/

  /02_WORKSPACES/
    /WORKSPACE_CODE/
      /ROOT_FOLDER/
      /PRODUCTS/
      /PROMPTS/

  /03_BATCHES/
    /YYYY-MM-DD/
      /BATCH_CODE/
        /FLOW_ACCOUNT_CODE/
          manifest.json
          PRODUCTCODE_BATCHCODE_CLIP01_V01.mp4
          PRODUCTCODE_BATCHCODE_CLIP02_V01.mp4

  /04_IMPORTS/
    /UNMATCHED/
    /NEED_MANUAL_ATTACH/

  /05_EXPORTS/
    /BATCH_MANIFEST_JSON/
    /PROMPT_BATCH_TXT/
    /UPLOAD_PACKAGE_CSV/
    /PERFORMANCE_CSV/
```

## Drive Item Metadata Required in Supabase

For every attached file store:

```text
drive_item_id
name
mime_type
kind
drive_url
folder_id
folder_path
size_bytes if available
product_id, intake_session_id, prompt_pack_id, clip_job_id, or batch_id relation if applicable
```

## MVP Drive Operations

- Create standard folders.
- Upload product image bytes and store Drive metadata before Gemini metadata success when the operator uses `Simpan Produk`.
- Upload marketplace screenshot bytes and store Drive metadata before `Analisis Metadata`.
- Upload affiliate profile character and environment assets from the Affiliate Profile drawer into the profile-owned admin folders.
- Store those profile assets as Drive metadata references that resolve back to the active Affiliate Profile or its linked workspace context.
- Attach existing Drive file metadata by URL or picker when needed.
- Resolve image-like Drive items server-side into transient preview data URLs for thumbnails and bottom-sheet previews. The same preview path may be reused by compact product list rows so mobile surfaces stay visually consistent.
- Store prompt reference file metadata.
- Store batch manifest metadata.
- Store helper-uploaded output clip metadata.
- Match imported files to clip jobs using manifest data and prompt prefix.
- Move unmatched metadata into manual attach state.
- Copy Drive file and folder links.

2026-05-07 Intake refactor lock: Drive-backed product image availability does not mean metadata is ready. Source image and screenshot evidence are stored as file metadata/relations first, then Gemini metadata readiness is tracked separately through intake review/action state.

## Drive Settings UI Lock

Google Drive connect/status lives in the `/settings` Connected Services row.

- The row uses a local Drive asset icon and a `Connect` action when disconnected.
- `/settings/drive` is a compatibility redirect only.
- Drive folder provisioning remains under Settings > Workspace.
- The primary Drive manager stays `/drive`.
- Drive codes are internal and hidden from the primary UI.

## Windows Helper Upload Path

Windows Helper uploads generated clips directly to Google Drive using local OAuth. The app receives metadata callback and stores Drive metadata in Supabase.

The app must not proxy large video bytes through Supabase or Next.js in Phase awal.

## Output Package

Output package stores links and metadata:

```text
Nama Produk
Keyword Etalase
Caption
Tags
Clip 1 Drive link
Clip 2 Drive link
Folder Drive
Status
```

No server-side ZIP generation in Phase awal. Download uses Drive links.

## Out of Scope

- Large asset storage in Supabase.
- Full Drive sync daemon.
- Server-side video proxy/upload for helper outputs.
- Automatic editing or rendering inside Drive.
- Claiming visual parsing from links when image bytes are not available.
- Persisting preview blobs or base64 thumbnail caches as a new asset storage layer.
- Creating a third profile-owned background-reference asset slot in Phase awal.
