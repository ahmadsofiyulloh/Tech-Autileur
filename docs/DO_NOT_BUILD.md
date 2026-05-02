# Do Not Build - MVP Scope Guard

Codex must not implement these items during MVP unless the user explicitly updates this file.

## Out of Scope

- Auto upload TikTok/Shopee.
- Video editor inside the PWA.
- Browser automation that clicks, selects, or submits Google Flow automatically.
- Custom remote desktop engine.
- Multi-user/team permissions.
- Google Flow Business/Enterprise/Pro account support.
- Workspace-bound Flow accounts.
- `workspace_id` on `flow_accounts`.
- Hardcoded Flow pool size such as `22`.
- Fixed-count affiliate profiles.
- Hardcoded prompt rules in JSX, HTML, route handlers, or inline code.
- Per-prompt character/environment/background lock overrides in Phase awal.
- A third background-reference asset slot for Affiliate Profiles in Phase awal.
- Duplicate Settings entry points in topbar, header, and sidebar at the same time.
- Claims of visual parsing from marketplace links when image bytes are not available.
- Supabase Storage for large video/image assets.
- Server-side ZIP generation for output packages.
- Storing Chrome profile paths in Supabase.
- Storing Windows Helper Google Drive OAuth tokens in Supabase.
- Proxying large helper-uploaded video bytes through Next.js or Supabase.
- Bypassing Gemini, Google Flow, TikTok, Shopee, or Google quota/rate limits.
- Verbose UI descriptions outside empty/error states.

## Explicitly Allowed In Phase Awal

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
