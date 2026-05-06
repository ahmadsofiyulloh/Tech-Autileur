# Changelog

Repo-level maintenance notes and MVP delivery updates.

## 2026-05-06

- Rewrote the root README in plain ASCII with setup, environment, folder, script, and deployment notes.
- Added explicit Vercel deployment instructions and environment variable guidance to the README.
- Synced the lock docs for the Affiliate Profile namespace refactor.
- Added cached analysis JSON support for locked Character and Environment assets.
- Hardened prompt generation and Gemini error handling paths.
- Soft-skipped the live intake smoke when Gemini returns the controlled temporary-unavailable blocker, while keeping all other Gemini failures hard-failing.
- Refreshed the mobile PWA manifest colors and visual reference screenshots.
