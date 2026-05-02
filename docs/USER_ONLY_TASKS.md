# User-Only Tasks

Codex cannot complete these without the user.

## Accounts and Projects

- Create Supabase project.
- Configure Supabase MCP access.
- Create Google AI Studio projects.
- Create Gemini API keys from separate projects/accounts if needed.
- Create Google Cloud OAuth client for Drive.
- Enable Google Drive API.
- Set up Google Flow accounts.
- Set up TikTok Affiliate accounts.
- Set up Shopee Affiliate account.
- Install and configure Windows Helper when available.
- Configure local Chrome profile paths in Windows Helper local config.
- Configure local output folder paths in Windows Helper local config.

## Secrets and Env

User must provide values locally:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_ENCRYPTION_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

Gemini keys should be entered through app UI after encryption is implemented, or loaded server-side only in development.

Windows Helper local secrets stay outside the repo:

```text
Chrome profile paths
Helper Google Drive OAuth token
Local output folder paths
App API Token plaintext
```

## Operations

- Upload real product images and marketplace screenshots.
- Review Gemini metadata.
- Approve prompt packs.
- Run Google Flow generation manually.
- Use Flow extension/manual execution.
- Review video quality.
- Edit final video outside the PWA if needed.
- Upload manually to TikTok/Shopee.
- Paste post URL.
- Input performance metrics.

## Business Decisions

- Product selection.
- Niche selection.
- Affiliate link correctness.
- Affiliate profile rules.
- Content angle approval.
- Final quality approval.
- Winner marking.
