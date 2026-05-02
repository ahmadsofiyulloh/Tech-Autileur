# Google Drive File System Lock

## Purpose
Google Drive is the source of truth for all files/assets. Supabase only stores metadata and relationships.

## Root Folder
```text
/AffiliateAI/
```

## Standard Folder Structure
```text
/AffiliateAI/
  /00_ADMIN/
    affiliate_accounts/
    google_flow_accounts/
    api_key_registry_reference/
    templates/

  /01_PRODUCTS/
    /PRODUCT_CODE/
      /01_SOURCE_IMAGES/
      /02_AI_ANALYSIS/
      /03_I2I_RESULTS/
      /04_I2V_PROMPTS/
      /05_CLIPS_RAW/
      /06_FINAL_VIDEO/
      /07_UPLOAD_PACKAGE/
      /08_PERFORMANCE/

  /02_BATCHES/
    /YYYY-MM-DD/
      /BATCH_CODE/
        /FLOW_ACCOUNT_CODE/

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

## Drive File Metadata Required in Supabase
For every attached file store:

```text
drive_file_id
name
mime_type
kind
drive_url
folder_id
folder_path
size_bytes if available
product_id/content_id/clip_job_id/batch_id relation if applicable
```

## MVP Drive Operations
- Create standard folders.
- Attach existing Drive file by URL or picker.
- Store file metadata.
- Copy file/folder links.
- Scan batch output folder.
- Match imported files to clip jobs using prompt prefix.
- Move unmatched files to unmatched queue metadata.

## Out of Scope
- Large asset storage in Supabase.
- Full Drive sync daemon.
- Automatic editing or rendering inside Drive.
