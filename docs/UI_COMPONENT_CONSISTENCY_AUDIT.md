# UI Component Consistency Audit — 2026-05-19

## Audit Scope

Reviewed: StatusBadge, NativeButton variants (primary/compact/tertiary/destructive), shell nav, bottom nav, topbar, responsive breakpoints, button sizing, and component symmetry across all routes.

**Method:** Static analysis of `src/app/globals.css`, `src/components/operator/status-badge.tsx`, `src/components/ui/native-button.tsx`, `src/components/app-shell.tsx`, and all page-level component files that consume buttons and badges.

---

## 2026-05-21 Addendum: Neutral Action Token Contract

Non-badge action UI is now locked to black/white/grayscale tokens. Buttons, destructive buttons, nav links, bottom nav links, topbar menu actions, segmented controls, view toggles, focus rings, selected cards/rows, and active control indicators must use `--control-*` or `--btn-*` tokens instead of blue, gradient, `--color-primary`, `--accent`, `--auth-primary`, or status-color tokens.

Badge styling remains the only approved colored UI exception. The neutral action contract is enforced by:

```bash
npm run audit:neutral-ui
```

This audit verifies the late neutral override import, required action selector coverage, no badge restyling in the override, no blue literals in action-token contract files, no gradient button/control rules, and no direct action-color token bypasses in button/control CSS.

---

## Finding 1: Button min-height inconsistency across contexts

**Problem:** `.button` base min-height is `32px` (desktop-appropriate) but on mobile this is below the 44px touch target recommendation. Several contexts override this ad-hoc:

| Context | min-height | Source |
|---------|-----------|--------|
| `.button` base | 32px | globals.css line 99/465 |
| `.button.compact` | 28px | globals.css line 106 |
| Overflow menu buttons | 36px | globals.css line 116 |
| Intake launch action | 38px | globals.css line 358 |
| Intake primary (mobile) | 38px | globals.css line 1117 |
| Bulk import actions | 42px | globals.css line 959 |
| Prompt cell button | 30px | globals.css line 1018 |
| Evidence grid small | 26px | globals.css line 1080 |
| Prompt list meta row | 24px | globals.css line 523 |

**Issue:** No consistent mobile touch-target enforcement. Buttons in mobile-primary surfaces (intake, bulk import) are manually enlarged per-context instead of using a responsive token.

**Recommendation:** Add a `--button-min-height` token (32px desktop, 36px mobile) and a `--button-compact-min-height` token (28px desktop, 32px mobile). Apply via media query at 860px breakpoint.

**Risk:** LOW — CSS-only, no behavior change.

---

## Finding 2: StatusBadge size/variant props underutilized

**Problem:** StatusBadge has `size` (sm/md), `variant` (pill/badge), and `muted` props, but only `/controller` uses them (3 instances). The other 116 usages all use defaults (md, badge, not muted).

**Issue:** On dense list views (product-list, prompt-workbench-list), badges at `md` size compete visually with primary content. Metadata-count badges should use `size="sm"` to reduce visual noise.

**Recommendation:** Audit all StatusBadge usages and apply `size="sm"` to secondary/informational badges in list rows. Apply `muted` to confirmational states (CLOSED, ARCHIVED, REPLACED).

**Risk:** LOW — prop changes only, no CSS changes needed.

---

## Finding 3: Button variant naming is className-based, not prop-based

**Problem:** Button variants are applied via className strings: `"primary"`, `"compact"`, `"tertiary"`, `"destructive"`. This is fragile — no TypeScript enforcement, easy to typo, and `PendingActionButton` strips the word "button" from className via regex.

**Issue:** Not a bug, but a consistency concern. The pattern works but is not type-safe. A `variant` prop would be cleaner.

**Recommendation:** DEFER. This is a larger refactor (touching 30+ files). Document as tech debt. Current pattern works and is consistent across all usages.

**Risk:** N/A — no action needed now.

---

## Finding 4: Responsive breakpoint is consistent (860px) but button sizing does not adapt

**Problem:** The app uses `860px` as the single mobile/desktop breakpoint consistently (35 media queries). Sidebar hides below 860px, bottom nav shows below 860px. This is correct.

**Issue:** Buttons do not get a mobile size bump at this breakpoint. The base `.button` stays at 32px min-height on mobile, which is below the 44px WCAG touch target for mobile.

**Recommendation:** Add a mobile button size override at `@media (max-width: 860px)` that bumps `.button` to 36px and `.button.compact` to 32px. This gives better touch targets without being oversized.

**Risk:** LOW — CSS-only. May slightly shift layouts on mobile.

---

## Finding 5: Bottom nav center button is well-implemented and symmetric

**Problem:** None. The center-elevated Intake button is 60×60px with a 46×46px inner icon wrap. Side nav items are 50px min-height. The 2-left/center/2-right layout is symmetric after R3 reorder.

**Recommendation:** No action needed.

---

## Finding 6: Shell topbar density created minor mismatch with sidebar brand

**Problem:** After R4-003, topbar is 56px. The sidebar brand area (`--shell-sidebar-brand-min-height: 48px`) is shorter. Minor visual misalignment between sidebar header and topbar.

**Recommendation:** Reduce `--shell-sidebar-brand-min-height` from 48px to 44px or keep at 48px (close enough to 56px with padding). Either is acceptable.

**Risk:** LOW — token change only.

---

## Finding 7: StatusBadge CSS is defined in THREE places

**Problem:** StatusBadge styles appear at:
1. Line ~474 — base definition (minified, from original build)
2. Line ~2540 — shell rebrand override (formatted, overrides min-height/radius/padding/font)
3. Line ~3568 — size variant definitions (sm/md/pill/badge/muted)

**Issue:** The three locations create a cascade that is hard to reason about. The shell rebrand override changes the badge base appearance, then the size variants add further overrides. This works but is fragile and makes future changes risky.

**Recommendation:** Consolidate StatusBadge CSS into one location during next CSS cleanup pass. Move all badge styles to the formatted section and remove the minified duplicate.

**Risk:** LOW — CSS consolidation, no visual change if done correctly.

---

## Finding 8: No consistent icon button pattern

**Problem:** Several places need icon-only buttons (overflow menu trigger, delete icon, copy button, drive view toggle). Each implements its own sizing:
- `DeleteActionButton` with `variant="iconOnly"` — custom sizing
- Overflow menu trigger — custom 32×32 sizing
- Drive view toggle — uses `.compact` class

**Issue:** No shared `.button.icon-only` class or token for square icon buttons. Each context reinvents the sizing.

**Recommendation:** Add a `.button.icon-only` variant with `width: var(--button-min-height); padding: 0; aspect-ratio: 1;` to standardize icon button sizing.

**Risk:** LOW — additive CSS, no breaking changes.

---

## Proposed Backlog Tasks

| ID | Title | Risk | Files | Status |
|----|-------|------|-------|--------|
| UI-AUDIT-01 | Add responsive button min-height tokens | LOW | `globals.css` | ✅ DONE |
| UI-AUDIT-02 | Apply StatusBadge size="sm" to list-row secondary badges | LOW | 5–8 page files | ✅ DONE |
| UI-AUDIT-03 | Add mobile button touch-target override at 860px | LOW | `globals.css` | ✅ DONE |
| UI-AUDIT-04 | Align sidebar brand height with new topbar density | LOW | `globals.css` | ✅ ALREADY RESOLVED |
| UI-AUDIT-05 | Consolidate StatusBadge CSS into single location | LOW | `globals.css` | DEFERRED (cascade risk in minified CSS) |
| UI-AUDIT-06 | Add `.button.icon-only` variant | LOW | `globals.css` | ✅ DONE |
| UI-AUDIT-07 | (DEFERRED) Refactor button variants to prop-based | MEDIUM | 30+ files | DEFERRED |
| UI-AUDIT-08 | Enforce neutral action token contract | LOW | `src/styles`, `scripts`, docs | DONE |

---

## Implementation Order

1. **UI-AUDIT-01 + UI-AUDIT-03** (together — button token + mobile override)
2. **UI-AUDIT-06** (icon-only button variant)
3. **UI-AUDIT-04** (sidebar brand alignment)
4. **UI-AUDIT-05** (CSS consolidation)
5. **UI-AUDIT-02** (StatusBadge size audit — per-page, multiple PRs)
6. **UI-AUDIT-07** (DEFERRED — tech debt, not urgent)

7. **UI-AUDIT-08** (DONE - neutral action token audit)

---

## Constraints

- No implementation in this document.
- Each task must be a separate PR.
- CSS-only tasks must not change component behavior.
- StatusBadge prop changes must not alter tone inference logic.
- All tasks must pass `npm run lint && npm run typecheck && npm run build`.
