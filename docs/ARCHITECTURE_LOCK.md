# Architecture Lock — MVP

## Status
LOCKED for MVP implementation.

## Frontend
```text
Framework: Next.js PWA
Language: TypeScript strict
UI: Mobile-first responsive dashboard
Styling: Tailwind/shadcn optional
```

## Auth
```text
Provider: Supabase Auth
User model: single owner/operator
Team/role permission: out of scope MVP
```

## Database
```text
Database: Supabase Postgres
Metadata source of truth: Supabase database
RLS: enabled on all owner-owned tables
All owner-owned tables: must include user_id
```

## Storage
```text
Asset/file source of truth: Google Drive
Supabase Storage: not used for large video/image assets in MVP
Supabase stores: Drive file ID, URL, path, MIME type, metadata, status, relationships
```

## AI
```text
Gemini API via encrypted API key registry
Recommended Free Tier setup: 3 separate projects/API keys
Task routing by role/model
AI task queue stored in Supabase
Structured JSON outputs required
```

## Execution
```text
Google Flow is external executor
PWA creates prompts, jobs, batches, manifest, and import logic
PWA does not generate video directly
PWA does not auto-click Google Flow in MVP
```

## Mobile
```text
Mobile PWA is control center
Remote desktop is external app/link
MVP does not build custom remote desktop engine
```

## Deployment
Deployment target may be Vercel or equivalent. Secrets must be server-side only.
