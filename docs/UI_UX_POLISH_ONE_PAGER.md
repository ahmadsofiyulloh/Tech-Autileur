# UI/UX Polish One-Pager

## Read This First
1. [UI_UX_POLISH_IMPLEMENTER_PROMPT.md](UI_UX_POLISH_IMPLEMENTER_PROMPT.md)
2. [UI_UX_POLISH_SESSION_START.md](UI_UX_POLISH_SESSION_START.md)
3. [UI_UX_POLISH_QUICKSTART.md](UI_UX_POLISH_QUICKSTART.md)
4. [UI_UX_POLISH_PLAN.md](UI_UX_POLISH_PLAN.md)
5. [UI_UX_POLISH_IMPLEMENTER_GUIDE.md](UI_UX_POLISH_IMPLEMENTER_GUIDE.md)

## Work Only In This Order
1. Segment A: Token audit
2. Segment B: Typography pass
3. Segment C: Section spacing pass
4. Segment D: Card anatomy pass
5. Segment E: State surfaces pass
6. Segment F: Bottom sheet polish
7. Segment G: Shell spacing polish

## Hard Rules
- Keep `page title -> section title -> card title -> body -> meta/label`.
- Keep the 8pt spacing rhythm.
- Keep mobile-first behavior.
- Keep loading, empty, and error states.
- Keep bottom sheets and drawers safe-area aware.
- Do not change flow, schema, or navigation for polish work.
- Do not invent visual assumptions from empty space.
- Do not add new copy unless the lock docs allow it.

## Before You Touch Code
- Name the active segment.
- List the exact files you will change.
- State what is out of scope.
- Confirm whether a new token is needed.
- Choose the smallest valid change.

## After You Touch Code
- List files changed.
- State what stayed untouched.
- Report verification results.
- Report risks or assumptions only if necessary.

## Stop If
- The change needs a new visual token.
- The change touches flow, schema, or navigation.
- The change needs unapproved copy.
- The scope starts expanding beyond the active segment.
