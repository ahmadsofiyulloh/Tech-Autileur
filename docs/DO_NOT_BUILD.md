# Do Not Build - MVP Scope Guard

Codex must not implement these items during MVP unless the user explicitly updates this file.

## Out of Scope

- Auto upload TikTok/Shopee.
- Video editor inside the PWA.
- Browser automation that clicks, selects, or submits Google Flow automatically.
- Custom remote desktop engine.
- Complex visual flow builders.
- Drag-and-drop node editors.
- Huashu-design as a runtime dependency, copied component library, asset bundle, or export toolchain.
- Huashu-style video editor, PPT export, HTML animation engine, design advisor feature, TTS/BGM/SFX pipeline, or design variation playground.
- Mobile Flow queue managers while Controller/Flow are frozen in Phase 1.
- Multi-user/team permissions.
- Google Flow Business/Enterprise/Pro account support.
- Workspace-bound Flow accounts.
- `workspace_id` on `flow_accounts`.
- Hardcoded Flow pool size such as `22`.
- Fixed-count affiliate profiles.
- Hardcoded prompt rules in JSX, HTML, route handlers, or inline code.
- Per-prompt character/environment/background lock overrides in Phase awal.
- A third background-reference asset slot for Affiliate Profiles in Phase awal.
- Implicit latest-active default profile selection.
- Reverting Affiliate Profile to workspace-scoped only in the revised model.
- Expanding Workspace as the operator-facing planning model during the 2026-05-06 Affiliate Profile namespace refactor.
- Exposing many-to-many workspace choices in the Affiliate Profile drawer during the 2026-05-06 refactor.
- Adding unapproved UI copy, helper paragraphs, marketing text, or duplicate descriptions during refactor micro-tasks.
- Adding a new Metadata route for the 2026-05-07 Intake refactor.
- Reintroducing an Affiliate Profile switching carousel inside Intake during the 2026-05-07 refactor.
- Treating Gemini metadata success as the only way a product can be durably captured.
- Duplicate standalone Settings entry points across topbar, header, sidebar, and bottom nav. Settings is allowed as a Profile avatar menu action only; Settings must not appear in bottom navigation.
- A separate Settings CRUD surface for Flow Accounts in Phase awal.
- Inline flat settings forms replacing the locked overview + section route + drawer grammar.
- Raw desktop data tables as the primary mobile list interaction.
- Dense data tables for mobile views.
- Full edit forms inside Drive preview bottom sheets.
- Batch archive/delete mutations from Drive multi-select in the initial Phase 1 visual manager.
- Drive multi-select remains client-side only; do not add Drive batch archive/delete mutations while this guard is active.
- Hard delete as the default lifecycle for mutable master data.
- Products bulk cleanup may only use backlog-approved archive-first behavior (`products.status = 'ARCHIVED'`); permanent product delete is out of scope.
- Prompt bulk queue UI, prompt bulk setup drawer, prompt bulk queue drawer, and prompt bulk queue runner on `/prompts`.
- Delete/archive actions on the main `/prompts` page; destructive prompt version cleanup belongs only in `/prompts/[id]/history` and is archive-first unless hard delete is separately approved.
- Claims of visual parsing from marketplace links when image bytes are not available.
- Supabase Storage for large video/image assets.
- Server-side ZIP generation for output packages.
- Storing Chrome profile paths in Supabase.
- Storing Windows Helper Google Drive OAuth tokens in Supabase.
- Storing Windows Helper local output folder paths in Supabase or the repo.
- Proxying large helper-uploaded video bytes through Next.js or Supabase.
- Bypassing Gemini, Google Flow, TikTok, Shopee, or Google quota/rate limits.
- Verbose UI descriptions outside empty/error states.
- Service worker cache engines, background sync, or custom offline data persistence in Phase 1.
- Page-swipe navigation or a custom gesture routing framework in Phase 1.

## Explicitly Allowed In Phase Awal

- Two global topbar controls: Notifications and Profile avatar menu. The Profile avatar opens profile overview and may expose `Pengaturan` and `Sign out` menu actions. `/settings` must not render a duplicate standalone Settings gear/action.

Windows Helper is allowed only as a local companion that:

- reads/imports batch manifest JSON.
- maps `flow_account_code` to a local Chrome profile path from local config.
- opens the Chrome profile and Google Flow URL.
- watches a local output folder.
- renames generated files.
- uploads files directly to Google Drive with local OAuth.
- posts metadata callback to the app with App API Token.

This is not browser automation and not a remote desktop engine.

## Scope Creep Rule

If a requested implementation requires any item above, Codex must stop and ask for explicit approval.

## MVP Principle

Build the smallest working control center that helps the operator manage AI production faster with real data, real uploaded images, Gemini, Drive metadata, and manual Google Flow execution.
