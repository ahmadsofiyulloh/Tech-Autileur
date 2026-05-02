# MVP Acceptance Criteria

## Core System
- User can log in with Supabase Auth.
- User sees protected mobile-first dashboard.
- Metadata is stored in Supabase.
- File/asset references point to Google Drive.
- RLS prevents cross-user access.

## Gemini Manager
- User can add 3 separate Gemini project/key records.
- User can assign role/model per key.
- Gemini keys are encrypted at rest.
- Raw keys are not exposed to client after save.
- AI task queue routes tasks by role/model.
- If key is limited/unavailable, task waits or retries.

## Prompt Pipeline
- User can attach product source image.
- System can run product vision analysis.
- System can generate 4 i2i prompts per content.
- System can generate 2 i2v prompts per content.
- Prompts are stored as structured JSON.
- Every content has exactly two clip jobs: C01 and C02.
- Prompt versions are preserved.

## Flow Batch Bridge
- User can create FLOW_FREE/FLOW_PLUS accounts.
- System calculates capacity using max 5 jobs per FLOW_FREE/day.
- System creates batches per Flow account.
- System exports prompt TXT and JSON manifest.
- Prompt prefix is naming-safe and at the start of exported prompt.

## Drive Manager and Import
- User can attach Drive files/folders.
- System stores Drive metadata.
- System can scan/import batch results in mock or real mode.
- System matches files by prefix.
- Unmatched files are shown and can be manually attached.

## Review and Upload
- User can approve/reject clips.
- Rejected clip can create regenerate job V02.
- User can attach final video Drive link.
- System creates TikTok/Shopee upload package.
- User can copy caption/tags/CTA/affiliate link.
- User can mark uploaded and paste post URL.

## Mobile Control
- User can view production status on mobile.
- User can open remote desktop link from mobile.
- User can open Flow and Drive links from mobile.
- User can copy prompts from mobile.

## Hardening
- Lint passes.
- Typecheck passes.
- Build passes.
- No real secrets are committed.
- Post-MVP features are not implemented.
