import "server-only";

import { randomUUID } from "node:crypto";

type GoogleDriveConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

type GoogleDriveUploadResult = {
  id: string;
  name: string;
  mimeType: string;
  size: string | number | null;
  webViewLink: string;
};

type GoogleDriveFolderResult = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
};

type AccessTokenCache = {
  accessToken: string;
  expiresAt: number;
};

let cachedAccessToken: AccessTokenCache | null = null;
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function readRequiredEnv(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "GOOGLE_REFRESH_TOKEN") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getGoogleDriveConfig(): GoogleDriveConfig {
  return {
    clientId: readRequiredEnv("GOOGLE_CLIENT_ID"),
    clientSecret: readRequiredEnv("GOOGLE_CLIENT_SECRET"),
    refreshToken: readRequiredEnv("GOOGLE_REFRESH_TOKEN"),
  };
}

async function fetchGoogleDriveAccessToken() {
  const now = Date.now();

  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 30_000) {
    return cachedAccessToken.accessToken;
  }

  const { clientId, clientSecret, refreshToken } = getGoogleDriveConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Google Drive token refresh failed: ${rawText}`);
  }

  const parsed = JSON.parse(rawText) as { access_token?: string; expires_in?: number };

  if (!parsed.access_token) {
    throw new Error("Google Drive token refresh failed: access token missing.");
  }

  cachedAccessToken = {
    accessToken: parsed.access_token,
    expiresAt: Date.now() + (parsed.expires_in ?? 3600) * 1000,
  };

  return parsed.access_token;
}

function buildMultipartBody(input: {
  name: string;
  mimeType: string;
  parents: string[];
  description?: string | null;
  bytes: Buffer;
}) {
  const boundary = `boundary-${randomUUID()}`;
  const crlf = "\r\n";
  const metadata = JSON.stringify({
    name: input.name,
    mimeType: input.mimeType,
    parents: input.parents,
    ...(input.description ? { description: input.description } : {}),
  });

  const head = Buffer.from(
    [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      metadata,
      `--${boundary}`,
      `Content-Type: ${input.mimeType}`,
      "",
    ].join(crlf) + crlf,
  );
  const tail = Buffer.from(`${crlf}--${boundary}--${crlf}`);

  return {
    body: Buffer.concat([head, input.bytes, tail]),
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function fetchGoogleDriveJson<T>(url: string, token: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(rawText || "Google Drive request failed.");
  }

  return JSON.parse(rawText) as T;
}

async function findGoogleDriveFolder(input: { name: string; parentFolderId?: string | null }) {
  const token = await fetchGoogleDriveAccessToken();
  const queryParts = [
    `name='${escapeDriveQueryValue(input.name)}'`,
    `mimeType='${GOOGLE_DRIVE_FOLDER_MIME_TYPE}'`,
    "trashed=false",
  ];

  if (input.parentFolderId) {
    queryParts.push(`'${escapeDriveQueryValue(input.parentFolderId)}' in parents`);
  } else {
    queryParts.push("'root' in parents");
  }

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", queryParts.join(" and "));
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("fields", "files(id,name,mimeType,webViewLink)");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const parsed = await fetchGoogleDriveJson<{ files?: GoogleDriveFolderResult[] }>(url.toString(), token);
  return parsed.files?.[0] ?? null;
}

async function createGoogleDriveFolder(input: { name: string; parentFolderId?: string | null }) {
  const token = await fetchGoogleDriveAccessToken();
  const payload = {
    name: input.name,
    mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
    ...(input.parentFolderId ? { parents: [input.parentFolderId] } : {}),
  };

  return await fetchGoogleDriveJson<GoogleDriveFolderResult>(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,mimeType,webViewLink",
    token,
    {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(payload),
    },
  );
}

export async function ensureGoogleDriveFolder(input: { name: string; parentFolderId?: string | null }) {
  const existing = await findGoogleDriveFolder(input);

  if (existing) {
    return existing;
  }

  return await createGoogleDriveFolder(input);
}

export async function uploadFileToGoogleDrive(input: {
  file: File;
  name?: string;
  description?: string | null;
  parentFolderId: string;
}) {
  const fileName = readText(input.name) || readText(input.file.name) || "upload.bin";
  const mimeType = readText(input.file.type) || "application/octet-stream";
  const fileBytes = Buffer.from(await input.file.arrayBuffer());
  const token = await fetchGoogleDriveAccessToken();
  const { body, contentType } = buildMultipartBody({
    name: fileName,
    mimeType,
    parents: [input.parentFolderId],
    description: input.description,
    bytes: fileBytes,
  });

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": contentType,
    },
    body,
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Google Drive upload failed: ${rawText}`);
  }

  const parsed = JSON.parse(rawText) as GoogleDriveUploadResult;

  if (!parsed.id || !parsed.webViewLink) {
    throw new Error("Google Drive upload failed: invalid response.");
  }

  return {
    driveItemId: parsed.id,
    name: parsed.name || fileName,
    mimeType: parsed.mimeType || mimeType,
    sizeBytes:
      typeof parsed.size === "number"
        ? parsed.size
        : typeof parsed.size === "string" && Number.isFinite(Number(parsed.size))
          ? Number(parsed.size)
          : fileBytes.length,
    driveUrl: parsed.webViewLink,
  };
}
