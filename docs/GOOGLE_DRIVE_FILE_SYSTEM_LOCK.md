# Google Drive File System Lock

## Purpose
Google Drive is the source of truth for all files and assets. Supabase only stores metadata and relationships.

## Root Folder
```text
/AffiliateAI/
```

## Standard Folder Structure
```text
/AffiliateAI/
  /00_ADMIN/
    affiliate_profiles/
    google_flow_accounts/
    gemini_api_projects/
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
- Attach uploaded image or screenshot bytes and store the resulting Drive metadata.
- Attach existing Drive file metadata by URL or picker when needed.
- Store file metadata.
- Copy file and folder links.
- Scan batch output folders.
- Match imported files to clip jobs using prompt prefix.
- Move unmatched files to unmatched queue metadata.

## Out of Scope
- Large asset storage in Supabase.
- Full Drive sync daemon.
- Automatic editing or rendering inside Drive.
- Claiming visual parsing from links when image bytes are not available.
