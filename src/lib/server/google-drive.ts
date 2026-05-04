import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  GOOGLE_DRIVE_CONNECTION_SCOPES,
  getActiveGoogleDriveRefreshToken,
  hasRequiredGoogleDriveScopes,
  isGoogleDriveConnectionSchemaMissingError,
  markGoogleDriveConnectionError,
  normalizeGoogleDriveScopes,
} from "@/lib/server/google-drive-connections";

type GoogleDriveConfig = {
  clientId: string;
  clientSecret: string;
};

type GoogleDriveUploadResult = {
  id: string;
  name: string;
  mimeType: string;
  size: string | number | null;
  md5Checksum?: string | null;
  modifiedTime?: string | null;
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

type GoogleDriveRefreshTokenSource = "connection" | "environment" | "explicit";

type GoogleDriveRefreshTokenResolution = {
  refreshToken: string;
  source: GoogleDriveRefreshTokenSource;
};

export type GoogleDriveFileMetadata = {
  driveItemId: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  checksum: string | null;
  driveModifiedAt: string | null;
  driveUrl: string;
};

type GoogleOAuthTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

const cachedAccessTokens = new Map<string, AccessTokenCache>();
const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

class GoogleDriveClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "GoogleDriveClientError";
  }
}

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function readRequiredEnv(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "GOOGLE_REDIRECT_URI") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readOptionalEnv(name: "GOOGLE_REFRESH_TOKEN") {
  return readText(process.env[name]);
}

function getGoogleDriveConfig(): GoogleDriveConfig {
  return {
    clientId: readRequiredEnv("GOOGLE_CLIENT_ID"),
    clientSecret: readRequiredEnv("GOOGLE_CLIENT_SECRET"),
  };
}

function getGoogleRedirectUri() {
  return readRequiredEnv("GOOGLE_REDIRECT_URI");
}

function isGoogleDriveEnvRefreshTokenFallbackAllowed() {
  return process.env.MOCK_MODE === "true" || process.env.NODE_ENV !== "production";
}

function getRefreshTokenCacheKey(refreshToken: string) {
  return createHash("sha256").update(refreshToken).digest("hex");
}

function isRetryableGoogleDriveStatus(status: number) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function parseJsonSafely<T>(rawText: string) {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
}

function parseRequiredGoogleDriveJson<T>(rawText: string, fallbackMessage: string) {
  const parsed = parseJsonSafely<T>(rawText);

  if (!parsed) {
    throw new GoogleDriveClientError(fallbackMessage);
  }

  return parsed;
}

function extractGoogleDriveErrorMessage(rawText: string, fallbackMessage: string) {
  const parsed = parseJsonSafely<{
    error?: string | { message?: string; errors?: Array<{ message?: string; reason?: string }> };
    error_description?: string;
  }>(rawText);
  const candidates = [
    parsed?.error && typeof parsed.error === "object" ? parsed.error.message : null,
    parsed?.error && typeof parsed.error === "object"
      ? parsed.error.errors?.find((entry) => readText(entry.message))?.message
      : null,
    parsed?.error_description,
    typeof parsed?.error === "string" ? parsed.error : null,
  ];
  const detail = candidates.map((candidate) => readText(candidate)).find(Boolean);

  return detail ? `${fallbackMessage}: ${detail}` : fallbackMessage;
}

function googleDriveErrorFromResponse(response: Response, rawText: string, fallbackMessage: string) {
  return new GoogleDriveClientError(
    extractGoogleDriveErrorMessage(rawText, fallbackMessage),
    response.status,
    isRetryableGoogleDriveStatus(response.status),
  );
}

async function resolveGoogleDriveRefreshToken(): Promise<GoogleDriveRefreshTokenResolution> {
  try {
    const storedToken = await getActiveGoogleDriveRefreshToken();

    if (storedToken) {
      return {
        refreshToken: storedToken,
        source: "connection",
      };
    }
  } catch (error) {
    if (!isGoogleDriveConnectionSchemaMissingError(error)) {
      throw error;
    }
  }

  const envToken = readOptionalEnv("GOOGLE_REFRESH_TOKEN");

  if (envToken && isGoogleDriveEnvRefreshTokenFallbackAllowed()) {
    return {
      refreshToken: envToken,
      source: "environment",
    };
  }

  throw new Error("Google Drive belum terhubung. Hubungkan Drive di Pengaturan.");
}

async function fetchGoogleDriveAccessToken(input?: { refreshToken?: string | null }) {
  const explicitRefreshToken = readText(input?.refreshToken);
  const resolvedToken = explicitRefreshToken
    ? ({
        refreshToken: explicitRefreshToken,
        source: "explicit",
      } satisfies GoogleDriveRefreshTokenResolution)
    : await resolveGoogleDriveRefreshToken();
  const refreshToken = resolvedToken.refreshToken;
  const cacheKey = getRefreshTokenCacheKey(refreshToken);
  const now = Date.now();
  const cachedAccessToken = cachedAccessTokens.get(cacheKey);

  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 30_000) {
    return cachedAccessToken.accessToken;
  }

  const { clientId, clientSecret } = getGoogleDriveConfig();
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
    const error = googleDriveErrorFromResponse(response, rawText, "Google Drive token refresh failed.");

    cachedAccessTokens.delete(cacheKey);

    if (resolvedToken.source === "connection") {
      await markGoogleDriveConnectionError(error.message).catch(() => undefined);
    }

    throw error;
  }

  const parsed = parseRequiredGoogleDriveJson<GoogleOAuthTokenResponse>(
    rawText,
    "Google Drive token refresh failed: invalid token response.",
  );

  if (!parsed.access_token) {
    throw new Error("Google Drive token refresh failed: access token missing.");
  }

  cachedAccessTokens.set(cacheKey, {
    accessToken: parsed.access_token,
    expiresAt: Date.now() + (parsed.expires_in ?? 3600) * 1000,
  });

  return parsed.access_token;
}

function buildMultipartBody(input: {
  name: string;
  mimeType: string;
  parents?: string[];
  description?: string | null;
  bytes: Buffer;
}) {
  const boundary = `boundary-${randomUUID()}`;
  const crlf = "\r\n";
  const metadata = JSON.stringify({
    name: input.name,
    mimeType: input.mimeType,
    ...(input.parents?.length ? { parents: input.parents } : {}),
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

function normalizeSizeBytes(value: string | number | null | undefined, fallback?: number | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && Number.isFinite(Number(value))) {
    return Number(value);
  }

  return fallback ?? null;
}

function normalizeGoogleDriveFileMetadata(input: GoogleDriveUploadResult, fallback?: { name?: string; mimeType?: string; sizeBytes?: number | null }) {
  if (!input.id || !input.webViewLink) {
    throw new Error("Google Drive response is missing file metadata.");
  }

  return {
    driveItemId: input.id,
    name: readText(input.name) || fallback?.name || "drive-file",
    mimeType: readText(input.mimeType) || fallback?.mimeType || "application/octet-stream",
    sizeBytes: normalizeSizeBytes(input.size, fallback?.sizeBytes ?? null),
    checksum: readText(input.md5Checksum) || null,
    driveModifiedAt: readText(input.modifiedTime) || null,
    driveUrl: input.webViewLink,
  } satisfies GoogleDriveFileMetadata;
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
    throw googleDriveErrorFromResponse(response, rawText, "Google Drive request failed.");
  }

  if (!rawText) {
    return {} as T;
  }

  return parseRequiredGoogleDriveJson<T>(rawText, "Google Drive returned an invalid JSON response.");
}

export function buildGoogleDriveAuthorizationUrl(state: string) {
  const { clientId } = getGoogleDriveConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getGoogleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_DRIVE_CONNECTION_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeGoogleDriveOAuthCode(code: string) {
  const { clientId, clientSecret } = getGoogleDriveConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getGoogleRedirectUri(),
    grant_type: "authorization_code",
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
    throw googleDriveErrorFromResponse(response, rawText, "Google Drive OAuth exchange failed.");
  }

  const parsed = parseRequiredGoogleDriveJson<GoogleOAuthTokenResponse>(
    rawText,
    "Google Drive OAuth exchange failed: invalid token response.",
  );

  if (!parsed.access_token) {
    throw new Error("Google Drive OAuth exchange failed: access token missing.");
  }

  const scopes = normalizeGoogleDriveScopes(parsed.scope ?? GOOGLE_DRIVE_CONNECTION_SCOPES);

  if (!hasRequiredGoogleDriveScopes(scopes)) {
    throw new Error("Google Drive OAuth scope tidak lengkap. Hubungkan ulang Drive dan izinkan akses file.");
  }

  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? null,
    scopes,
    expiresIn: parsed.expires_in ?? 3600,
  };
}

export async function getGoogleDriveAccountInfo(accessToken: string) {
  const parsed = await fetchGoogleDriveJson<{
    user?: {
      emailAddress?: string;
      displayName?: string;
    };
  }>("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)", accessToken);

  return {
    email: readText(parsed.user?.emailAddress) || null,
    label: readText(parsed.user?.displayName) || readText(parsed.user?.emailAddress) || null,
  };
}

async function fetchGoogleDriveFileBytes(fileId: string) {
  const token = await fetchGoogleDriveAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const rawText = await response.text();
    throw googleDriveErrorFromResponse(response, rawText, "Google Drive file fetch failed.");
  }

  return Buffer.from(await response.arrayBuffer());
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
  return await uploadBufferToGoogleDrive({
    bytes: fileBytes,
    name: fileName,
    mimeType,
    description: input.description,
    parentFolderId: input.parentFolderId,
  });
}

export async function uploadBufferToGoogleDrive(input: {
  bytes: Buffer;
  name: string;
  mimeType: string;
  description?: string | null;
  parentFolderId: string;
}) {
  const fileName = readText(input.name) || "upload.bin";
  const mimeType = readText(input.mimeType) || "application/octet-stream";
  const token = await fetchGoogleDriveAccessToken();
  const { body, contentType } = buildMultipartBody({
    name: fileName,
    mimeType,
    parents: [input.parentFolderId],
    description: input.description,
    bytes: input.bytes,
  });

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,md5Checksum,modifiedTime,webViewLink",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": contentType,
      },
      body,
    },
  );

  const rawText = await response.text();

  if (!response.ok) {
    throw googleDriveErrorFromResponse(response, rawText, "Google Drive upload failed.");
  }

  const parsed = parseRequiredGoogleDriveJson<GoogleDriveUploadResult>(
    rawText,
    "Google Drive upload failed: invalid upload response.",
  );

  return normalizeGoogleDriveFileMetadata(parsed, {
    name: fileName,
    mimeType,
    sizeBytes: input.bytes.length,
  });
}

export async function getGoogleDriveFileMetadata(fileId: string) {
  const token = await fetchGoogleDriveAccessToken();
  const parsed = await fetchGoogleDriveJson<GoogleDriveUploadResult>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,mimeType,size,md5Checksum,modifiedTime,webViewLink`,
    token,
  );

  return normalizeGoogleDriveFileMetadata(parsed);
}

export async function getGoogleDriveFolderMetadata(folderId: string) {
  const metadata = await getGoogleDriveFileMetadata(folderId);

  if (metadata.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
    throw new Error("Google Drive target is not a folder.");
  }

  return {
    id: metadata.driveItemId,
    name: metadata.name,
    webViewLink: metadata.driveUrl,
  };
}

export async function updateGoogleDriveFileMetadata(input: { fileId: string; name?: string | null }) {
  const token = await fetchGoogleDriveAccessToken();
  const payload = {
    ...(readText(input.name) ? { name: readText(input.name) } : {}),
  };

  if (!Object.keys(payload).length) {
    return await getGoogleDriveFileMetadata(input.fileId);
  }

  const parsed = await fetchGoogleDriveJson<GoogleDriveUploadResult>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}?supportsAllDrives=true&fields=id,name,mimeType,size,md5Checksum,modifiedTime,webViewLink`,
    token,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(payload),
    },
  );

  return normalizeGoogleDriveFileMetadata(parsed);
}

export async function replaceGoogleDriveFileContent(input: { fileId: string; file: File; name?: string | null }) {
  const fileName = readText(input.name) || readText(input.file.name) || "upload.bin";
  const mimeType = readText(input.file.type) || "application/octet-stream";
  const fileBytes = Buffer.from(await input.file.arrayBuffer());

  return await replaceGoogleDriveBufferContent({
    bytes: fileBytes,
    fileId: input.fileId,
    mimeType,
    name: fileName,
  });
}

export async function replaceGoogleDriveBufferContent(input: { fileId: string; bytes: Buffer; name: string; mimeType: string }) {
  const fileName = readText(input.name) || "upload.bin";
  const mimeType = readText(input.mimeType) || "application/octet-stream";
  const token = await fetchGoogleDriveAccessToken();
  const { body, contentType } = buildMultipartBody({
    name: fileName,
    mimeType,
    bytes: input.bytes,
  });

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(input.fileId)}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,md5Checksum,modifiedTime,webViewLink`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": contentType,
      },
      body,
    },
  );
  const rawText = await response.text();

  if (!response.ok) {
    throw googleDriveErrorFromResponse(response, rawText, "Google Drive replace failed.");
  }

  return normalizeGoogleDriveFileMetadata(
    parseRequiredGoogleDriveJson<GoogleDriveUploadResult>(rawText, "Google Drive replace failed: invalid replace response."),
    {
      name: fileName,
      mimeType,
      sizeBytes: input.bytes.length,
    },
  );
}

export async function trashGoogleDriveItem(fileId: string) {
  const token = await fetchGoogleDriveAccessToken();
  const parsed = await fetchGoogleDriveJson<GoogleDriveUploadResult>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,mimeType,size,md5Checksum,modifiedTime,webViewLink`,
    token,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ trashed: true }),
    },
  );

  return normalizeGoogleDriveFileMetadata(parsed);
}

export async function tryGetGoogleDriveImageDataUrl(input: { fileId: string; mimeType?: string | null }) {
  const mimeType = readText(input.mimeType) || "image/jpeg";

  if (!mimeType.startsWith("image/")) {
    return null;
  }

  try {
    const bytes = await fetchGoogleDriveFileBytes(input.fileId);

    if (!bytes.length) {
      return null;
    }

    return `data:${mimeType};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}
