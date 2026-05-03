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
Chrome profile paths
Windows Helper Drive OAuth token
Windows Helper local output folder path
App API Token plaintext
```

Allowed:

```text
.env.example
placeholder values
setup instructions
token code without plaintext token
```

## Server-Only Secrets

These must only be used in server actions, route handlers, edge functions, or server-only modules:

- Supabase service role key.
- Gemini API keys.
- Encryption secret.
- Google OAuth client secret.
- Google refresh token used by the app.
- App API Token hash verification secret or salt if used.

## Windows Helper Secrets

These stay local to the helper machine:

- Chrome profile paths.
- helper Google Drive OAuth token.
- helper local output folder paths.
- plaintext App API Token after initial copy.

The app may store `helper_output_folder_key` as an inert label for manifest matching. It must never store the absolute local helper output folder path.

The app stores only helper token metadata and hash. Helper uploads output video bytes directly to Google Drive and sends metadata callback only.

## Encryption Requirements

Sensitive database fields:

- `gemini_api_key_secrets.encrypted_api_key`.
- app Google Drive connection encrypted refresh token if implemented.
- any future external service credentials.

Use an application-level encryption helper controlled by an environment variable such as:

```text
APP_ENCRYPTION_KEY=
```

## RLS Requirements

- Enable RLS on every owner-owned table.
- All owner-owned tables must include `user_id`.
- MVP policies: authenticated user can only read/write own rows.
- Helper metadata callback must resolve owner from App API Token and write only that owner scope.
- If a service-role client is used after helper token verification, every write must include the resolved `user_id` owner scope.

## Review Checklist

Before every commit:

- Check `git diff` for secrets.
- Check client components do not import server secret modules.
- Check `.env.local` is ignored.
- Check migrations do not include real secret values.
- Check Chrome profile paths are not stored in Supabase migrations or seed data.
- Check helper OAuth tokens are not stored in Supabase migrations or seed data.
- Check helper local output folder paths are not stored in Supabase migrations, seed data, docs examples, or runtime metadata.
