# User-Only Tasks

Codex cannot complete these without the user.

## Accounts and Projects
- Create Supabase project.
- Configure Supabase MCP access.
- Create Google AI Studio projects.
- Create 3 Gemini API keys from separate projects/accounts.
- Create Google Cloud OAuth client for Drive.
- Enable Google Drive API.
- Set up Google Flow accounts.
- Set up TikTok Affiliate accounts.
- Set up Shopee Affiliate account.
- Set up external remote desktop app.

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

## Operations
- Run Google Flow generation.
- Use Flow extension/manual execution.
- Review video quality.
- Edit final video on mobile.
- Upload manually to TikTok/Shopee.
- Paste post URL.
- Input performance metrics.

## Business Decisions
- Product selection.
- Niche selection.
- Affiliate link correctness.
- Content angle approval.
- Final quality approval.
- Winner marking.
