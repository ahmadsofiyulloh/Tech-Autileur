# Security and Secrets Lock

## Secret Handling
Never commit real secrets.

Forbidden in git:

```text
.env
.env.local
.env.*.local
Supabase service role key
Gemini API keys
Google OAuth client secret
Google refresh token
Encryption secret
```

Allowed:

```text
.env.example
placeholder values
setup instructions
```

## Server-Only Secrets
These must only be used in server actions, route handlers, edge functions, or server-only modules:

- Supabase service role key.
- Gemini API keys.
- Encryption secret.
- Google OAuth client secret.
- Google refresh token.

## Encryption Requirements
Sensitive database fields:

- `gemini_api_keys.encrypted_api_key`
- `google_drive_connections.encrypted_refresh_token`
- any future external service credentials

Use an application-level encryption helper controlled by an environment variable such as:

```text
APP_ENCRYPTION_KEY=
```

## RLS Requirements
- Enable RLS on every owner-owned table.
- All owner-owned tables must include `user_id`.
- MVP policies: authenticated user can only read/write own rows.

## Review Checklist
Before every commit:

- Check `git diff` for secrets.
- Check client components do not import server secret modules.
- Check `.env.local` is ignored.
- Check migrations do not include real secret values.
