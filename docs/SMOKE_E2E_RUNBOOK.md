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
- Bounded live intake -> prompt -> regenerate loop with affiliate seed lock and prompt rules preflight
- Prompt generation from seeded intake data
- Flow account creation
- Flow batch creation
- Manifest export and persisted manifest fetch
- Helper metadata callback
- Batch status progression through `RUNNING`, `IMPORTING`, `IMPORTED`, and `CLOSED`

## Primary commands

```bash
npm run smoke:e2e
npm run smoke:e2e:live-loop
npm run smoke:e2e:live-100
npm run smoke:e2e:live-batch
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
- `SMOKE_LIVE_E2E_LOOPS=3`
- `SMOKE_LIVE_E2E_BATCHES=10`
- `SMOKE_LIVE_E2E_BATCH_PAUSE_MS=0`

## Notes

- The live intake test requires working Gemini and Drive integration.
- `tests/e2e/intake-prompt-live-loop.spec.ts` runs live Gemini intake, prompt generation, and regeneration in a bounded loop. Default loop count is `3`; raise `SMOKE_LIVE_E2E_LOOPS` for longer soak runs.
- The affiliate-profile preflight checks locked seed/environment references and prompt rules. It does not require cached asset-analysis JSON as a precondition.
- The prompt/controller smoke path can use mock prompt generation by default.
- If Gemini returns the controlled `Gemini service is temporarily unavailable.` blocker, `tests/e2e/intake-live.spec.ts` annotates it as an expected external-service blocker and skips the remainder of that live intake check.
- The live loop applies the same external Gemini blocker handling and cleans up each iteration before the next run.
- Other Gemini auth, schema, validation, or app errors still fail the smoke run.
- Google Flow remains a manual boundary and is not auto-submitted by the app.
- The harness creates a local auth state file under `.playwright/.auth/`.
- The harness seeds a dedicated smoke workspace, affiliate profile, product, intake session, and Drive references before the browser tests start.
- `npm run smoke:e2e:live-100` is a convenience alias for the default `10 x 10` plan. Use `npm run smoke:e2e:live-batch` with `SMOKE_LIVE_E2E_BATCHES` and `SMOKE_LIVE_E2E_LOOPS` to adjust the total.
