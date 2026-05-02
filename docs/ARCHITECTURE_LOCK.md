# Architecture Lock - MVP

## Status
LOCKED for MVP implementation.

## Frontend
```text
Framework: Next.js PWA
Language: TypeScript strict
UI: Mobile-first responsive control center
Main nav: Dashboard, Products, Controller, Settings
Mobile bottom nav: Dashboard, Products, Controller, Settings
Desktop sidebar: Dashboard, Products, Controller, Settings
```

## Route Policy
```text
/products       -> list only
/products/new   -> intake workflow
/products/[id]  -> Metadata, Output, History
/controller     -> execution workspace
/settings       -> configuration hub
/intake         -> compatibility redirect to /products/new
/flow           -> compatibility redirect to /controller
/prompts        -> compatibility only
/outputs        -> compatibility only
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
All owner-owned tables: must include user_id unless explicitly documented as a static reference table
```

## Storage
```text
Asset/file source of truth: Google Drive
Supabase Storage: not used for large video/image assets in MVP
Intake image UX: upload cards with local preview, not link-only parsing
Supabase stores: Drive item metadata, URL, path, MIME type, status, relationships
```

## AI
```text
Gemini API via encrypted API key registry
Prompt rules editable in UI
Structured JSON outputs required
```

## Execution
```text
Google Flow is external executor
Controller manages a global Flow tool pool
Flow accounts are global tools and never workspace-bound
Controller selects accounts by availability and credit
```

## Settings
```text
Settings is the configuration hub for:
- Workspace Profiles
- Gemini
- Drive
- Flow Accounts / Tools
- Affiliate Profiles
- Prompt Personalization
- Account/logout
```

## Mobile
```text
Mobile PWA is the operator control hub
Remote desktop is external
MVP does not build a custom remote desktop engine
```

## Deployment
Deployment target may be Vercel or equivalent. Secrets must be server-side only.
