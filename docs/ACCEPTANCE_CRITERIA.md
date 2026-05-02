# MVP Acceptance Criteria

## Core System
- User can log in with Supabase Auth.
- User sees a protected mobile-first dashboard.
- Main navigation is exactly `Dashboard`, `Products`, `Controller`, `Settings`.
- Compatibility routes keep working, but are not primary navigation.
- Metadata is stored in Supabase.
- File and asset references point to Google Drive.
- RLS prevents cross-user access.

## Products and Intake
- `/products` shows the product list only.
- `/products/new` is the intake workflow entrypoint.
- `/products/[id]` shows `Metadata`, `Output`, and `History` tabs.
- Intake uses image and screenshot upload cards with local preview.
- Main save advances to the prompt step when minimum data is sufficient.
- `DRAFT` is used only for incomplete draft or autosave states.
- `SUBMITTED` is used for the main save or submit action.
- Intake inherits `current_workspace_id` when one is active.

## Prompt Pipeline
- Prompt rules are editable in UI.
- i2i, i2v, caption, hashtag, negative prompt, seed lock, and environment lock are not hardcoded in JSX or HTML.
- Prompt generation consumes the selected affiliate profile and product context.
- Prompt packs are stored as structured JSON.
- Prompt pack versions are preserved.

## Controller and Flow
- Flow accounts remain global execution tools.
- Flow accounts do not have `workspace_id`.
- Any workspace, product, or prompt can use any available Flow account.
- Flow account count is dynamic and never hardcoded.
- Controller can assign ready prompt packs to available Flow accounts.

## Affiliate Profiles and Settings
- User can create unlimited affiliate profiles.
- Profiles can belong to a workspace.
- Profiles store editable prompt personalization rules.
- Profiles can lock seed character and environment with Drive references.

## Dashboard Analytics
- Dashboard can show API usage.
- Dashboard can show token usage as real or estimated.
- Dashboard can show generated file count.
- Dashboard can show Drive item count.
- Dashboard can show prompt and task counts.

## Hardening
- Lint passes.
- Typecheck passes.
- Build passes.
- No real secrets are committed.
- Post-MVP features are not implemented.
