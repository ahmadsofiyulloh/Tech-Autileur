#!/usr/bin/env node

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const VALID_STAGES = new Set(["FIRST_FRAME", "LAST_FRAME", "VIDEO"]);
const DEFAULT_CONFIG_PATH = "config.json";

function printHelp() {
  console.log(`Affiliate Flow Windows Helper

Commands:
  prepare   Write manifest and prompt TXT files into the local work folder.
  open      Open the manifest Flow URL with the mapped Chrome profile lane.
  import    Upload one local output file to Drive and callback the app.
  watch     Process exact manifest output file names from the mapped output folder.
  callback  Post metadata for a file already uploaded to Drive.

Common flags:
  --manifest <path>  Flow manifest JSON from the app.
  --config <path>    Local helper config. Defaults to config.json.
  --lane <key>       Optional Chrome profile lane key for multi-lane accounts.
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];

    if (!next || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return { command, flags };
}

function readFlag(flags, key, fallback = "") {
  const value = flags[key];
  return typeof value === "string" ? value.trim() : fallback;
}

function requireFlag(flags, key) {
  const value = readFlag(flags, key);

  if (!value) {
    throw new Error(`--${key} is required.`);
  }

  return value;
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadInputs(flags) {
  const manifestPath = resolve(requireFlag(flags, "manifest"));
  const configPath = resolve(readFlag(flags, "config", DEFAULT_CONFIG_PATH));
  const [manifest, config] = await Promise.all([readJsonFile(manifestPath), readJsonFile(configPath)]);

  if (manifest.schema_version !== "flow_manifest_v2") {
    throw new Error("Manifest must use schema_version flow_manifest_v2.");
  }

  if (!Array.isArray(manifest.stage_jobs) || !manifest.stage_jobs.length) {
    throw new Error("Manifest stage_jobs[] is required.");
  }

  if (!manifest.batch_code || !manifest.flow_account_code) {
    throw new Error("Manifest batch_code and flow_account_code are required.");
  }

  return { manifestPath, configPath, manifest, config };
}

function localPath(value, root = process.cwd()) {
  if (!value) {
    return "";
  }

  return isAbsolute(value) ? value : resolve(root, value);
}

function getWorkDir(config, manifest) {
  return join(localPath(config.work_root || "./work"), manifest.batch_code);
}

function normalizeLaneKey(value) {
  return readFlag({ lane: value }, "lane")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
}

function normalizeLaneRecord(lane, index) {
  const laneKey = readFlag({ lane: lane?.lane_key ?? lane?.key ?? lane?.label }, "lane") || `LANE-${index + 1}`;
  const laneLabel = readFlag({ lane: lane?.label ?? lane?.name ?? laneKey }, "lane") || laneKey;

  return {
    lane_key: laneKey,
    lane_label: laneLabel,
    chrome_profile_path: readFlag({ path: lane?.chrome_profile_path }, "path"),
    active: lane?.active === true || lane?.is_active === true,
  };
}

export function getFlowAccountConfig(config, manifest, requestedLaneKey = "") {
  const account = config.flow_accounts?.[manifest.flow_account_code];

  if (!account) {
    throw new Error(`Missing local flow account config for ${manifest.flow_account_code}.`);
  }

  const laneKey = normalizeLaneKey(requestedLaneKey || manifest.chrome_profile_lane_key || "");
  const lanes = Array.isArray(account.lanes) ? account.lanes.map(normalizeLaneRecord).filter((lane) => lane.chrome_profile_path) : [];

  if (lanes.length) {
    let selectedLane = null;

    if (laneKey) {
      selectedLane = lanes.find((lane) => normalizeLaneKey(lane.lane_key) === laneKey) || null;

      if (!selectedLane) {
        throw new Error(
          `Missing local chrome_profile_path for ${manifest.flow_account_code} lane ${requestedLaneKey || manifest.chrome_profile_lane_key}.`,
        );
      }
    } else {
      const activeLanes = lanes.filter((lane) => lane.active);

      if (activeLanes.length === 1) {
        selectedLane = activeLanes[0];
      } else if (activeLanes.length > 1) {
        throw new Error(`Multiple active lanes configured for ${manifest.flow_account_code}. Pass --lane to select one.`);
      } else if (lanes.length === 1) {
        selectedLane = lanes[0];
      } else {
        throw new Error(`No active lane configured for ${manifest.flow_account_code}. Pass --lane to select one.`);
      }
    }

    return selectedLane;
  }

  if (!account.chrome_profile_path) {
    throw new Error(`Missing local chrome_profile_path for ${manifest.flow_account_code}.`);
  }

  return {
    lane_key: "DEFAULT",
    lane_label: "DEFAULT",
    chrome_profile_path: readFlag({ path: account.chrome_profile_path }, "path"),
    active: true,
  };
}

function getOutputFolder(config, manifest) {
  const key = manifest.helper_output_folder_key || "default";
  const folder = config.output_folders?.[key] || config.output_folders?.default;

  if (!folder) {
    throw new Error(`Missing local output folder mapping for ${key}.`);
  }

  return localPath(folder);
}

function getStageJob(manifest, flags) {
  const stage = requireFlag(flags, "stage").toUpperCase();
  const clip = requireFlag(flags, "clip").toUpperCase();

  if (!VALID_STAGES.has(stage)) {
    throw new Error(`--stage must be one of: ${Array.from(VALID_STAGES).join(", ")}.`);
  }

  const job = manifest.stage_jobs.find((item) => item.stage === stage && String(item.clip_code).toUpperCase() === clip);

  if (!job) {
    throw new Error(`No stage job found for ${clip} ${stage}.`);
  }

  return job;
}

function safeFileName(value, fallback) {
  const rawName = basename(String(value || fallback || "item.txt"));
  const safeName = rawName.replace(/[\\/:*?"<>|]+/g, "-").trim();

  return safeName || fallback || "item.txt";
}

function normalizeStage(value) {
  const stage = String(value || "").toUpperCase();

  if (!VALID_STAGES.has(stage)) {
    throw new Error(`Manifest stage must be one of: ${Array.from(VALID_STAGES).join(", ")}.`);
  }

  return stage;
}

function stagePromptFolder(stage) {
  return normalizeStage(stage) === "VIDEO" ? "i2v" : "i2i";
}

function stageOrderPrefix(value, fallback) {
  const parsed = Number(value);
  const order = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;

  return String(order).padStart(2, "0");
}

async function prepare({ manifest, config }) {
  const workDir = getWorkDir(config, manifest);
  const promptDir = join(workDir, "prompts");
  const i2iPromptDir = join(promptDir, "i2i");
  const i2vPromptDir = join(promptDir, "i2v");
  const manifestDir = join(workDir, "manifest");
  const stagingI2iDir = join(workDir, "staging", "i2i");
  const stagingI2vDir = join(workDir, "staging", "i2v");
  const downloadsDir = join(workDir, "downloads");
  const importedDir = join(workDir, "imported");

  await Promise.all([
    mkdir(i2iPromptDir, { recursive: true }),
    mkdir(i2vPromptDir, { recursive: true }),
    mkdir(manifestDir, { recursive: true }),
    mkdir(stagingI2iDir, { recursive: true }),
    mkdir(stagingI2vDir, { recursive: true }),
    mkdir(downloadsDir, { recursive: true }),
    mkdir(importedDir, { recursive: true }),
  ]);
  await writeFile(join(manifestDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  for (const [index, job] of manifest.stage_jobs.entries()) {
    const stage = normalizeStage(job.stage);
    const fileName = `${stageOrderPrefix(job.stage_order, index + 1)}_${safeFileName(
      job.prompt_file_name,
      `${job.clip_code || "clip"}_${stage}.txt`,
    )}`;
    const promptFolder = stagePromptFolder(stage);
    await writeFile(join(promptDir, promptFolder, fileName), job.prompt_copy_text || "", "utf8");
  }

  await writeFile(
    join(workDir, "expected-outputs.json"),
    JSON.stringify(
      manifest.stage_jobs.map((job, index) => {
        const stage = normalizeStage(job.stage);
        const promptFileName = `${stageOrderPrefix(job.stage_order, index + 1)}_${safeFileName(
          job.prompt_file_name,
          `${job.clip_code || "clip"}_${stage}.txt`,
        )}`;
        const promptFolder = stagePromptFolder(stage);

        return {
          job_code: job.job_code,
          clip_code: job.clip_code,
          stage,
          prompt_file_path: ["prompts", promptFolder, promptFileName].join("/"),
          input_handles: job.input_handles || [],
          depends_on_job_codes: job.depends_on_job_codes || [],
          output_purpose: job.output_purpose,
          output_file_name: job.output_file_name,
        };
      }),
      null,
      2,
    ),
  );

  console.log(`Prepared ${manifest.stage_jobs.length} stage prompt files in ${workDir}`);
}

function openChrome({ manifest, config }, flags = {}) {
  const account = getFlowAccountConfig(config, manifest, readFlag(flags, "lane", ""));
  const chromePath = localPath(config.chrome_executable_path || "chrome");
  const profilePath = localPath(account.chrome_profile_path);
  const flowUrl = manifest.flow_url;

  if (!flowUrl) {
    throw new Error("Manifest flow_url is required.");
  }

  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", chromePath, `--user-data-dir=${profilePath}`, flowUrl], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    }).unref();
  } else {
    spawn(chromePath, [`--user-data-dir=${profilePath}`, flowUrl], {
      detached: true,
      stdio: "ignore",
    }).unref();
  }

  console.log(`Opened Flow for ${manifest.flow_account_code} lane ${account.lane_label || account.lane_key}`);
}

function mimeTypeForFile(filePath, stage) {
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".png")) {
    return "image/png";
  }

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lower.endsWith(".webp")) {
    return "image/webp";
  }

  if (lower.endsWith(".mp4") || stage === "VIDEO") {
    return "video/mp4";
  }

  return "application/octet-stream";
}

async function getGoogleAccessToken(config) {
  const oauth = config.google_oauth || {};

  if (oauth.access_token) {
    return oauth.access_token;
  }

  if (!oauth.client_id || !oauth.client_secret || !oauth.refresh_token) {
    throw new Error("Local google_oauth client_id, client_secret, and refresh_token are required.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: oauth.client_id,
      client_secret: oauth.client_secret,
      refresh_token: oauth.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json();

  if (!response.ok || !payload.access_token) {
    throw new Error(`Google OAuth refresh failed: ${payload.error_description || payload.error || response.status}`);
  }

  return payload.access_token;
}

async function uploadFileToDrive(config, manifest, filePath, outputName, stage) {
  if (!manifest.drive_output_folder_id) {
    throw new Error("Manifest drive_output_folder_id is required for upload.");
  }

  const accessToken = await getGoogleAccessToken(config);
  const boundary = `affiliate-helper-${Date.now()}`;
  const fileBytes = await readFile(filePath);
  const mimeType = mimeTypeForFile(filePath, stage);
  const metadata = {
    name: outputName,
    parents: [manifest.drive_output_folder_id],
  };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    fileBytes,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  const payload = await response.json();

  if (!response.ok || !payload.id) {
    throw new Error(`Drive upload failed: ${payload.error?.message || response.status}`);
  }

  return {
    id: payload.id,
    name: payload.name || outputName,
    mimeType: payload.mimeType || mimeType,
    size: payload.size ? Number(payload.size) : (await stat(filePath)).size,
    webViewLink: payload.webViewLink || `https://drive.google.com/file/d/${payload.id}/view`,
  };
}

function stagePurpose(stage) {
  return stage === "VIDEO" ? "FINAL_VIDEO" : "I2I_RESULT";
}

function unwrapAppApiPayload(payload) {
  if (payload && typeof payload === "object" && payload.ok === true && "data" in payload) {
    return payload.data;
  }

  return payload;
}

function readAppApiErrorMessage(payload, fallback) {
  if (payload && typeof payload === "object") {
    if (payload.ok === false && payload.error && typeof payload.error.message === "string") {
      return payload.error.message;
    }

    if (typeof payload.error === "string") {
      return payload.error;
    }
  }

  return fallback;
}

function buildDrivePath(manifest, outputName) {
  return `/AffiliateAI/03_BATCHES/${manifest.target_date}/${manifest.batch_code}/${manifest.flow_account_code}/${outputName}`;
}

async function postCallback(config, manifest, job, driveItem, fileName, matchStatus = "IMPORTED") {
  if (!config.app_base_url || !config.app_api_token) {
    throw new Error("app_base_url and app_api_token are required for callback.");
  }

  const callbackUrl = new URL("/api/helper/callback", config.app_base_url).toString();
  const now = new Date().toISOString();
  const payload = {
    batch_code: manifest.batch_code,
    flow_account_code: manifest.flow_account_code,
    helper_event_at: now,
    generated_files: [
      {
        job_code: job.job_code,
        clip_code: job.clip_code,
        version: job.version,
        stage: job.stage,
        file_name: fileName,
        detected_prefix: job.clip_code,
        match_status: matchStatus,
        imported_at: now,
        drive_item: {
          drive_item_id: driveItem.id,
          item_type: "FILE",
          name: driveItem.name || fileName,
          drive_url: driveItem.webViewLink,
          drive_path: buildDrivePath(manifest, driveItem.name || fileName),
          mime_type: driveItem.mimeType,
          size_bytes: driveItem.size,
          purpose: stagePurpose(job.stage),
          status: "ACTIVE",
          notes: `Windows Helper ${job.stage}`,
        },
      },
    ],
  };
  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.app_api_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(`App callback failed: ${readAppApiErrorMessage(result, response.status)}`);
  }

  return unwrapAppApiPayload(result);
}

async function importOutput({ manifest, config }, flags) {
  const job = getStageJob(manifest, flags);
  const sourceFile = resolve(requireFlag(flags, "file"));
  const workDir = getWorkDir(config, manifest);
  const importedDir = join(workDir, "imported");
  const outputName = job.output_file_name;
  const importedFile = join(importedDir, outputName);

  if (!existsSync(sourceFile)) {
    throw new Error(`Output file does not exist: ${sourceFile}`);
  }

  await mkdir(importedDir, { recursive: true });
  await copyFile(sourceFile, importedFile);

  const driveItem = await uploadFileToDrive(config, manifest, importedFile, outputName, job.stage);
  const result = await postCallback(config, manifest, job, driveItem, outputName);

  console.log(`Imported ${outputName}: ${result.batchStatus}`);
}

async function callbackOnly({ manifest, config }, flags) {
  const job = getStageJob(manifest, flags);
  const driveItemId = requireFlag(flags, "drive-item-id");
  const driveUrl = requireFlag(flags, "drive-url");
  const name = readFlag(flags, "name", job.output_file_name || basename(driveUrl));
  const driveItem = {
    id: driveItemId,
    name,
    webViewLink: driveUrl,
    mimeType: readFlag(flags, "mime-type", mimeTypeForFile(name, job.stage)),
    size: Number(readFlag(flags, "size-bytes", "0")) || null,
  };
  const result = await postCallback(config, manifest, job, driveItem, name, readFlag(flags, "match-status", "IMPORTED").toUpperCase());

  console.log(`Callback posted for ${name}: ${result.batchStatus}`);
}

async function watchOutputs(inputs) {
  const outputFolder = getOutputFolder(inputs.config, inputs.manifest);
  const expected = new Map(inputs.manifest.stage_jobs.map((job) => [job.output_file_name, job]));
  const entries = await readdir(outputFolder, { withFileTypes: true });
  let processed = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !expected.has(entry.name)) {
      continue;
    }

    const job = expected.get(entry.name);
    await importOutput(inputs, {
      file: join(outputFolder, entry.name),
      stage: job.stage,
      clip: job.clip_code,
    });
    processed += 1;
  }

  console.log(`Processed ${processed} exact manifest output files from ${outputFolder}`);
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === "--help" || command === "help") {
    printHelp();
    return;
  }

  const inputs = await loadInputs(flags);

  if (command === "prepare") {
    await prepare(inputs);
    return;
  }

  if (command === "open") {
    openChrome(inputs, flags);
    return;
  }

  if (command === "import") {
    await importOutput(inputs, flags);
    return;
  }

  if (command === "watch") {
    await watchOutputs(inputs);
    return;
  }

  if (command === "callback") {
    await callbackOnly(inputs, flags);
    return;
  }

  throw new Error(`Unsupported command: ${command}`);
}

const executedFileUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";

if (import.meta.url === executedFileUrl) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
