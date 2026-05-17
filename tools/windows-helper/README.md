# Windows Helper

Local helper for Flow batch execution. It reads the app manifest, prepares stage prompt files, opens the mapped Chrome profile, uploads locally generated outputs to Google Drive, and posts metadata callbacks to the app.

This helper is local-only. Do not commit `config.json`, App API Token plaintext, Chrome profile paths, local output folder paths, or Google OAuth tokens.

## Commands

```bash
node src/index.mjs prepare --manifest path/to/manifest.json --config config.json
node src/index.mjs open --manifest path/to/manifest.json --config config.json
node src/index.mjs import --manifest path/to/manifest.json --config config.json --file path/to/output.png --stage FIRST_FRAME --clip CLIP01
node src/index.mjs watch --manifest path/to/manifest.json --config config.json
node src/index.mjs callback --manifest path/to/manifest.json --config config.json --stage VIDEO --clip CLIP01 --drive-item-id <ID> --drive-url <URL> --name clip01.mp4
```

`open` can also accept `--lane <key>` to pick a specific Chrome profile lane when the local config defines more than one lane for the same Flow account.

`watch` only processes files that already match manifest `stage_jobs[].output_file_name`. The helper never clicks, selects, uploads into, or submits inside Google Flow.

`prepare` creates one batch work folder with `manifest/`, `prompts/i2i/`, `prompts/i2v/`, `staging/i2i/`, `staging/i2v/`, `downloads/`, `imported/`, and `expected-outputs.json`.

Helper local config supports both the legacy single-profile shape and the lane-based shape:

```json
{
  "flow_accounts": {
    "FLOW-EXAMPLE": {
      "lanes": [
        {
          "lane_key": "utama",
          "chrome_profile_path": "<CHROME_PROFILE_PATH>",
          "active": true
        }
      ]
    }
  }
}
```
