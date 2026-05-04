# Playwright Smoke E2E Runbook

## Goal
Run a hybrid smoke harness that exercises the operator app end-to-end and classifies failures as:

- `APP_BLOCKER`
- `AUTH_BLOCKER`
- `SUPABASE_BLOCKER`
- `GEMINI_BLOCKER`
- `DRIVE_BLOCKER`
- `HELPER_BLOCKER`
- `FLOW_BLOCKER`
- `ENV_BLOCKER`

## What the harness covers

- Auth bootstrap and protected shell
- Desktop nav and mobile controller redirect guard
- Settings account surface, Chrome pairing, App API Token
- Live intake upload path with real image files
- Prompt generation from seeded intake data
- Flow account creation
- Flow batch creation
- Manifest export and persisted manifest fetch
- Helper metadata callback
- Batch status progression through `RUNNING`, `IMPORTING`, `IMPORTED`, and `CLOSED`

## Primary commands

```bash
npm run smoke:e2e
npm run smoke:e2e:headed
npm run smoke:e2e:report
```

## Environment

Required for the harness to boot:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `E2E_BASE_URL`
- `E2E_SMOKE_EMAIL`
- `E2E_SMOKE_PASSWORD`
- `SMOKE_PROMPT_GENERATION_MODE=mock|gemini`

## Notes

- The live intake test requires working Gemini and Drive integration.
- The prompt/controller smoke path can use mock prompt generation by default.
- Google Flow remains a manual boundary and is not auto-submitted by the app.
- The harness creates a local auth state file under `.playwright/.auth/`.
- The harness seeds a dedicated smoke workspace, affiliate profile, product, intake session, and Drive references before the browser tests start.
