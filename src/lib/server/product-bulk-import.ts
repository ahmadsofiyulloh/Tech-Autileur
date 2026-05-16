import "server-only";

import { revalidatePath } from "next/cache";
import { readSheet } from "read-excel-file/universal";
import type { CellValue } from "read-excel-file/universal";
import { createDriveItem } from "@/lib/server/drive-items";
import { ensureIntakeDriveFolders } from "@/lib/server/intake";
import { createMarketplaceSource } from "@/lib/server/product-marketplace-sources";
import { attachProductSourceImage, createProduct } from "@/lib/server/products";
import { listPromptReadinessProjections } from "@/lib/server/prompt-readiness";
import { uploadBufferToGoogleDrive } from "@/lib/server/google-drive";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createIntakeSession } from "@/lib/server/intake";
import type { JsonRecord, MarketplacePlatform } from "@/lib/intake/validation";
import type {
  BulkImportJob,
  BulkImportJobLog,
  BulkImportJobRow,
  BulkImportJobRowStatus,
  BulkImportJobSnapshot,
  BulkImportJobStatus,
  BulkImportLogLevel,
  BulkImportOptionalFields,
  BulkImportPreviewRow,
  BulkImportPromptReadiness,
  BulkImportResponse,
  BulkImportRowStatus,
  BulkImportSummary,
} from "@/lib/bulk-import/types";
import { getCurrentWorkspace } from "@/lib/server/workspaces";

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 200;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;

const REQUIRED_HEADERS = ["Nama Produk", "URL Produk", "Gambar Produk"] as const;

const HEADER_ALIASES = {
  availableColors: ["warna tersedia", "warna"],
  availableSizes: ["ukuran tersedia", "ukuran"],
  description: ["deskripsi produk", "deskripsi"],
  discountText: ["diskon", "diskon persen", "diskon %"],
  globalReviewText: ["ulasan global", "ulasan"],
  imageUrl: ["gambar produk", "url gambar", "image url", "product image"],
  priceText: ["harga idr", "harga", "price"],
  productName: ["nama produk", "product name", "title"],
  productUrl: ["url produk", "marketplace link", "link produk", "product url"],
  ratingText: ["rating max 5", "rating"],
  shopName: ["nama penjual", "nama toko", "toko", "seller"],
  soldCountText: ["jumlah terjual", "terjual", "sold"],
} as const;

type BulkParsedRow = Omit<BulkImportPreviewRow, "status" | "errors"> & {
  errors: string[];
};

type DownloadedImage = {
  bytes: Buffer;
  extension: string;
  mimeType: string;
};

type BulkImportJobRecord = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  file_name: string;
  status: BulkImportJobStatus;
  total_rows: number;
  ready_rows: number;
  duplicate_rows: number;
  error_rows: number;
  imported_rows: number;
  skipped_rows: number;
  cancelled_rows: number;
  error_message: string | null;
  runner_id: string | null;
  lease_expires_at: string | null;
  last_heartbeat_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  cancel_requested_at: string | null;
  created_at: string;
  updated_at: string;
};

type BulkImportJobRowRecord = {
  id: string;
  user_id: string;
  job_id: string;
  workspace_id: string | null;
  row_number: number;
  status: BulkImportJobRowStatus;
  errors: string[] | null;
  product_name: string;
  product_url: string;
  image_url: string;
  marketplace_label: string;
  platform: MarketplacePlatform | null;
  source_domain: string | null;
  optional_json: BulkImportOptionalFields | JsonRecord | null;
  raw_columns_json: Record<string, string> | JsonRecord | null;
  product_id: string | null;
  intake_session_id: string | null;
  drive_item_id: string | null;
  intake_code: string | null;
  current_stage: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type BulkImportJobLogRecord = {
  id: string;
  user_id: string;
  job_id: string;
  row_id: string | null;
  sequence: number;
  level: BulkImportLogLevel;
  title: string;
  message: string;
  metadata_json: JsonRecord | null;
  created_at: string;
};

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHeader(value: string) {
  return readText(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[%()]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cellToText(value: CellValue | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).trim();
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function detectCsvDelimiter(headerLine: string) {
  const candidates = [",", ";", "\t"] as const;
  return candidates
    .map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length }))
    .sort((left, right) => right.count - left.count)[0]?.delimiter ?? ",";
}

function parseCsv(text: string) {
  const normalized = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = normalized.split("\n").find((line) => line.trim()) ?? "";
  const delimiter = detectCsvDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const nextCharacter = normalized[index + 1];

    if (character === "\"") {
      if (quoted && nextCharacter === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!quoted && character === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  row.push(cell.trim());
  rows.push(row);
  return rows.filter((currentRow) => currentRow.some((currentCell) => readText(currentCell)));
}

function fileExtension(fileName: string) {
  const match = readText(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function assertSupportedFile(file: File) {
  if (!(file instanceof File) || !file.size) {
    throw new Error("File bulk wajib diunggah.");
  }

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error("Ukuran file bulk maksimal 10MB.");
  }

  const extension = fileExtension(file.name);

  if (extension !== "csv" && extension !== "xlsx") {
    throw new Error("Format bulk harus CSV atau XLSX.");
  }
}

async function readSpreadsheetRows(file: File) {
  assertSupportedFile(file);
  const extension = fileExtension(file.name);

  if (extension === "csv") {
    return parseCsv(await file.text());
  }

  const rows = await readSheet(await file.arrayBuffer());
  return rows.map((row) => row.map((cell) => cellToText(cell)));
}

function headerIndexMap(headers: string[]) {
  const map = new Map<string, number>();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (normalized && !map.has(normalized)) {
      map.set(normalized, index);
    }
  });

  return map;
}

function readCell(headers: Map<string, number>, row: string[], aliases: readonly string[]) {
  for (const alias of aliases) {
    const index = headers.get(normalizeHeader(alias));
    if (index !== undefined) {
      return readText(row[index]);
    }
  }

  return "";
}

function rawColumns(headers: string[], row: string[]) {
  return headers.reduce<Record<string, string>>((record, header, index) => {
    const key = readText(header);
    if (key) {
      record[key] = readText(row[index]);
    }
    return record;
  }, {});
}

function normalizeHttpUrl(value: string) {
  const text = readText(value);

  if (!text) {
    return "";
  }

  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function resolveMarketplace(productUrl: string): {
  label: string;
  platform: MarketplacePlatform;
  sourceDomain: string;
} | null {
  try {
    const url = new URL(productUrl);
    const hostname = url.hostname.toLowerCase();

    if (hostname.includes("shopee")) {
      return { label: "Shopee", platform: "SHOPEE", sourceDomain: hostname };
    }

    if (hostname.includes("tokopedia")) {
      return { label: "Tokopedia", platform: "TIKTOK", sourceDomain: hostname };
    }

    if (hostname.includes("tiktok")) {
      return { label: "TikTok", platform: "TIKTOK", sourceDomain: hostname };
    }

    return null;
  } catch {
    return null;
  }
}

function emptyOptionalFields(): BulkImportOptionalFields {
  return {
    availableColors: null,
    availableSizes: null,
    description: null,
    discountText: null,
    globalReviewText: null,
    priceText: null,
    ratingText: null,
    shopName: null,
    soldCountText: null,
  };
}

function buildOptionalFields(headers: Map<string, number>, row: string[]): BulkImportOptionalFields {
  return {
    ...emptyOptionalFields(),
    availableColors: readCell(headers, row, HEADER_ALIASES.availableColors) || null,
    availableSizes: readCell(headers, row, HEADER_ALIASES.availableSizes) || null,
    description: readCell(headers, row, HEADER_ALIASES.description) || null,
    discountText: readCell(headers, row, HEADER_ALIASES.discountText) || null,
    globalReviewText: readCell(headers, row, HEADER_ALIASES.globalReviewText) || null,
    priceText: readCell(headers, row, HEADER_ALIASES.priceText) || null,
    ratingText: readCell(headers, row, HEADER_ALIASES.ratingText) || null,
    shopName: readCell(headers, row, HEADER_ALIASES.shopName) || null,
    soldCountText: readCell(headers, row, HEADER_ALIASES.soldCountText) || null,
  };
}

function parseRows(rows: string[][], fileName: string): BulkParsedRow[] {
  const [headerRow, ...dataRows] = rows;

  if (!headerRow?.length) {
    throw new Error("Header file bulk kosong.");
  }

  const headers = headerRow.map((header) => stripBom(readText(header)));
  const normalizedHeaders = new Set(headers.map(normalizeHeader).filter(Boolean));
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !normalizedHeaders.has(normalizeHeader(header)));

  if (missingHeaders.length) {
    throw new Error(`Header wajib belum ada: ${missingHeaders.join(", ")}.`);
  }

  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Maksimal ${MAX_IMPORT_ROWS} row per import.`);
  }

  const map = headerIndexMap(headers);

  return dataRows
    .map((row, index) => {
      const productName = readCell(map, row, HEADER_ALIASES.productName);
      const productUrl = normalizeHttpUrl(readCell(map, row, HEADER_ALIASES.productUrl));
      const imageUrl = normalizeHttpUrl(readCell(map, row, HEADER_ALIASES.imageUrl));
      const marketplace = productUrl ? resolveMarketplace(productUrl) : null;
      const errors: string[] = [];

      if (!productName) {
        errors.push("Nama Produk wajib diisi.");
      }

      if (!productUrl) {
        errors.push("URL Produk wajib berupa URL http/https.");
      }

      if (!imageUrl) {
        errors.push("Gambar Produk wajib berupa URL http/https.");
      }

      if (productUrl && !marketplace) {
        errors.push("Marketplace belum didukung.");
      }

      return {
        rowNumber: index + 2,
        errors,
        productName,
        productUrl,
        imageUrl,
        marketplaceLabel: marketplace?.label ?? "",
        platform: marketplace?.platform ?? null,
        sourceDomain: marketplace?.sourceDomain ?? null,
        optional: buildOptionalFields(map, row),
        rawColumns: rawColumns(headers, row),
      } satisfies BulkParsedRow;
    })
    .filter((row) => row.productName || row.productUrl || row.imageUrl || Object.values(row.rawColumns).some(Boolean));
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

async function existingProductLinks(productUrls: string[]) {
  const uniqueUrls = [...new Set(productUrls.filter(Boolean))];

  if (!uniqueUrls.length) {
    return new Set<string>();
  }

  const { supabase, user } = await requireUser();
  const existing = new Set<string>();

  for (let index = 0; index < uniqueUrls.length; index += 100) {
    const chunk = uniqueUrls.slice(index, index + 100);
    const { data, error } = await supabase
      .from("products")
      .select("marketplace_product_link")
      .eq("user_id", user.id)
      .neq("status", "ARCHIVED")
      .in("marketplace_product_link", chunk);

    if (error) {
      throw new Error(error.message);
    }

    for (const product of data ?? []) {
      if (typeof product.marketplace_product_link === "string") {
        existing.add(product.marketplace_product_link);
      }
    }
  }

  return existing;
}

function summarize(rows: BulkImportPreviewRow[]): BulkImportSummary {
  return {
    totalRows: rows.length,
    readyRows: rows.filter((row) => row.status === "ready").length,
    duplicateRows: rows.filter((row) => row.status === "duplicate").length,
    errorRows: rows.filter((row) => row.status === "error").length,
    importedRows: rows.filter((row) => row.status === "imported").length,
    skippedRows: rows.filter((row) => row.status === "skipped").length,
    cancelledRows: rows.filter((row) => row.status === "cancelled").length,
  };
}

function withStatus(rows: BulkParsedRow[], existingLinks: Set<string>): BulkImportPreviewRow[] {
  const seenLinks = new Set<string>();

  return rows.map((row) => {
    let status: BulkImportRowStatus = row.errors.length ? "error" : "ready";
    const errors = [...row.errors];

    if (status === "ready" && row.productUrl) {
      if (existingLinks.has(row.productUrl) || seenLinks.has(row.productUrl)) {
        status = "duplicate";
        errors.push("URL Produk sudah tersimpan.");
      } else {
        seenLinks.add(row.productUrl);
      }
    }

    return {
      ...row,
      status,
      errors,
    };
  });
}

export async function previewProductBulkImport(file: File): Promise<BulkImportResponse> {
  const rows = parseRows(await readSpreadsheetRows(file), file.name);
  const existingLinks = await existingProductLinks(rows.map((row) => row.productUrl));
  const previewRows = withStatus(rows, existingLinks);

  return {
    fileName: file.name,
    rows: previewRows,
    summary: summarize(previewRows),
  };
}

function imageExtensionFromMimeType(mimeType: string) {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return "jpg";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "bin";
}

function mimeTypeFromUrl(url: string) {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (pathname.endsWith(".png")) {
    return "image/png";
  }

  if (pathname.endsWith(".webp")) {
    return "image/webp";
  }

  return "";
}

function assertImageMimeType(mimeType: string) {
  if (mimeType !== "image/webp" && mimeType !== "image/jpeg" && mimeType !== "image/jpg" && mimeType !== "image/png") {
    throw new Error("Gambar Produk harus WEBP, JPG, JPEG, atau PNG.");
  }
}

async function downloadImage(imageUrl: string): Promise<DownloadedImage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(imageUrl, {
      headers: {
        accept: "image/webp,image/png,image/jpeg,*/*",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Download gambar gagal (${response.status}).`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_IMAGE_BYTES) {
      throw new Error("Ukuran gambar maksimal 8MB.");
    }

    const responseMimeType = readText(response.headers.get("content-type")).split(";")[0]?.trim().toLowerCase() ?? "";
    const mimeType = responseMimeType || mimeTypeFromUrl(imageUrl);
    assertImageMimeType(mimeType);

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) {
      throw new Error("Gambar Produk kosong.");
    }

    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new Error("Ukuran gambar maksimal 8MB.");
    }

    return {
      bytes,
      extension: imageExtensionFromMimeType(mimeType),
      mimeType,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Download gambar melewati batas waktu.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeDriveLeafName(value: string) {
  const trimmed = readText(value);
  return (trimmed || "bulk-image").replace(/[\\/:*?"<>|]+/g, "-");
}

function joinDrivePath(...segments: Array<string | null | undefined>) {
  return `/${segments
    .map((segment) => readText(segment))
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

function buildBulkIntakeCode(rowNumber: number) {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `BULK-${timestamp}-${String(rowNumber).padStart(3, "0")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

function optionalFieldsJson(optional: BulkImportOptionalFields): JsonRecord {
  return Object.entries(optional).reduce<JsonRecord>((record, [key, value]) => {
    if (value) {
      record[key] = value;
    }
    return record;
  }, {});
}

function sourceImportJson(row: BulkImportPreviewRow, sourceFileName: string): JsonRecord {
  return {
    image_url: row.imageUrl,
    marketplace_label: row.marketplaceLabel,
    marketplace_platform: row.platform ?? "",
    optional_fields: optionalFieldsJson(row.optional),
    product_url: row.productUrl,
    raw_columns: row.rawColumns,
    row_number: row.rowNumber,
    schema_version: "bulk_import_v1",
    source_domain: row.sourceDomain ?? "",
    source_file_name: sourceFileName,
  };
}

function parsedMetadataJson(row: BulkImportPreviewRow, sourceFileName: string): JsonRecord {
  return {
    confidence_notes: ["Metadata scraping bulk import siap untuk prompt."],
    deskripsi_visual: row.optional.description ?? "",
    keyword_cari_etalase: "",
    nama_produk: row.productName,
    pain_point: "",
    product_title: row.productName,
    schema_version: "bulk_import_v1",
    selling_angle: "",
    source_import: sourceImportJson(row, sourceFileName),
    target_viewer: "",
    use_case: "",
  };
}

async function importReadyRow(row: BulkImportPreviewRow, sourceFileName: string, workspaceId?: string | null) {
  if (!row.platform) {
    throw new Error("Marketplace belum didukung.");
  }

  const intakeCode = buildBulkIntakeCode(row.rowNumber);
  const folders = await ensureIntakeDriveFolders(intakeCode, { workspaceId });
  const image = await downloadImage(row.imageUrl);
  const fileName = sanitizeDriveLeafName(`${row.productName}-${row.rowNumber}.${image.extension}`);
  const uploaded = await uploadBufferToGoogleDrive({
    bytes: image.bytes,
    description: "Bulk import product image.",
    mimeType: image.mimeType,
    name: fileName,
    parentFolderId: folders.productFolder.drive_item_id ?? "",
  });
  const driveItem = await createDriveItem({
    item_type: "FILE",
    drive_item_id: uploaded.driveItemId,
    name: uploaded.name,
    drive_url: uploaded.driveUrl,
    drive_path: joinDrivePath(folders.productFolder.drive_path, uploaded.name),
    mime_type: uploaded.mimeType,
    size_bytes: uploaded.sizeBytes,
    checksum: uploaded.checksum,
    drive_modified_at: uploaded.driveModifiedAt,
    purpose: "SOURCE_IMAGE",
    status: "ACTIVE",
    notes: "Bulk import product image.",
    parent_id: folders.productFolder.id,
    parent_drive_item_id: folders.productFolder.drive_item_id,
  });
  const product = await createProduct({
    workspace_id: folders.workspace.id,
    product_name: row.productName,
    marketplace: row.marketplaceLabel,
    marketplace_product_link: row.productUrl,
    status: "DRAFT",
  });

  await attachProductSourceImage({
    productId: product.id,
    driveItemRefId: driveItem.id,
    isPrimary: true,
    status: "ATTACHED",
    notes: "Auto-attached from bulk import.",
  });

  const metadata = parsedMetadataJson(row, sourceFileName);
  const session = await createIntakeSession({
    workspace_id: folders.workspace.id,
    intake_code: intakeCode,
    product_id: product.id,
    product_title: row.productName,
    product_photo_drive_item_ref_id: driveItem.id,
    parsed_metadata_json: metadata,
    reviewed_metadata_json: metadata,
    shopee_url: row.platform === "SHOPEE" ? row.productUrl : null,
    tiktok_url: row.platform === "TIKTOK" ? row.productUrl : null,
    status: "REVIEWED",
  });

  await createMarketplaceSource({
    product_id: product.id,
    workspace_id: folders.workspace.id,
    platform: row.platform,
    product_url: row.productUrl,
    title: row.productName,
    price_text: row.optional.priceText,
    rating_text: row.optional.ratingText,
    sold_count_text: row.optional.soldCountText,
    shop_name: row.optional.shopName,
    parsed_metadata_json: {
      source_import: sourceImportJson(row, sourceFileName),
    },
    status: "ACTIVE",
    notes: "Saved from bulk import scraping.",
  });

  return {
    driveItemId: driveItem.id,
    intakeSessionId: session.id,
    productId: product.id,
  };
}

const ACTIVE_BULK_JOB_STATUSES: BulkImportJobStatus[] = ["QUEUED", "RUNNING", "CANCEL_REQUESTED"];
const TERMINAL_BULK_JOB_STATUSES: BulkImportJobStatus[] = ["CANCELLED", "COMPLETED", "FAILED"];
const ACTIVE_BULK_ROW_STATUSES: BulkImportJobRowStatus[] = [
  "READY",
  "RUNNING",
  "IMAGE_DOWNLOADING",
  "IMAGE_UPLOADING",
  "PRODUCT_CREATING",
];
const BULK_IMPORT_LEASE_MS = 5 * 60 * 1000;
const BULK_IMPORT_RECENT_JOB_MS = 24 * 60 * 60 * 1000;

function isTerminalBulkJobStatus(status: BulkImportJobStatus) {
  return TERMINAL_BULK_JOB_STATUSES.includes(status);
}

function leaseExpiryIso() {
  return new Date(Date.now() + BULK_IMPORT_LEASE_MS).toISOString();
}

function summaryFromJobRecord(job: BulkImportJobRecord): BulkImportSummary {
  return {
    totalRows: job.total_rows,
    readyRows: job.ready_rows,
    duplicateRows: job.duplicate_rows,
    errorRows: job.error_rows,
    importedRows: job.imported_rows,
    skippedRows: job.skipped_rows,
    cancelledRows: job.cancelled_rows,
  };
}

function jobFromRecord(job: BulkImportJobRecord): BulkImportJob {
  return {
    id: job.id,
    status: job.status,
    fileName: job.file_name,
    summary: summaryFromJobRecord(job),
    errorMessage: job.error_message,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    cancelRequestedAt: job.cancel_requested_at,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

function optionalFieldsFromJson(value: unknown): BulkImportOptionalFields {
  const record = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const empty = emptyOptionalFields();

  return (Object.keys(empty) as Array<keyof BulkImportOptionalFields>).reduce<BulkImportOptionalFields>((fields, key) => {
    const current = record[key];
    fields[key] = typeof current === "string" && current.trim() ? current.trim() : null;
    return fields;
  }, { ...empty });
}

function rawColumnsFromJson(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((record, [key, current]) => {
    if (typeof current === "string") {
      record[key] = current;
    }
    return record;
  }, {});
}

function previewStatusFromJobRowStatus(status: BulkImportJobRowStatus): BulkImportRowStatus {
  if (status === "IMPORTED") {
    return "imported";
  }

  if (status === "SKIPPED") {
    return "skipped";
  }

  if (status === "ERROR") {
    return "error";
  }

  if (status === "CANCELLED") {
    return "cancelled";
  }

  return "ready";
}

function previewRowFromRecord(row: BulkImportJobRowRecord, promptReadiness?: BulkImportPromptReadiness | null): BulkImportPreviewRow {
  return {
    rowNumber: row.row_number,
    status: previewStatusFromJobRowStatus(row.status),
    errors: row.errors ?? (row.error_message ? [row.error_message] : []),
    productName: row.product_name,
    productUrl: row.product_url,
    imageUrl: row.image_url,
    marketplaceLabel: row.marketplace_label,
    platform: row.platform,
    sourceDomain: row.source_domain,
    optional: optionalFieldsFromJson(row.optional_json),
    rawColumns: rawColumnsFromJson(row.raw_columns_json),
    ...(row.product_id ? { productId: row.product_id } : {}),
    ...(row.intake_session_id ? { intakeSessionId: row.intake_session_id } : {}),
    ...(row.drive_item_id ? { driveItemId: row.drive_item_id } : {}),
    ...(promptReadiness ? { promptReadiness } : {}),
  };
}

function jobRowFromRecord(row: BulkImportJobRowRecord, promptReadiness?: BulkImportPromptReadiness | null): BulkImportJobRow {
  return {
    ...previewRowFromRecord(row, promptReadiness),
    id: row.id,
    jobId: row.job_id,
    jobStatus: row.status,
    currentStage: row.current_stage,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function logFromRecord(log: BulkImportJobLogRecord): BulkImportJobLog {
  return {
    id: log.id,
    jobId: log.job_id,
    rowId: log.row_id,
    sequence: log.sequence,
    level: log.level,
    title: log.title,
    message: log.message,
    createdAt: log.created_at,
  };
}

function promptReadinessFromProjection(
  projection: Awaited<ReturnType<typeof listPromptReadinessProjections>>[number],
): BulkImportPromptReadiness {
  return {
    affiliateProfileId: projection.affiliateProfileId,
    isBulkEnqueueEligible: projection.isBulkEnqueueEligible,
    label: projection.label,
    promptPackId: projection.promptPack?.id ?? null,
    promptPackStatus: projection.promptPack?.status ?? null,
    reasons: projection.reasons,
    sourceProductImageId: projection.sourceImage?.id ?? null,
    status: projection.status,
  };
}

async function promptReadinessByProductId(
  job: BulkImportJobRecord,
  rows: BulkImportJobRowRecord[],
): Promise<Map<string, BulkImportPromptReadiness>> {
  const productIds = Array.from(new Set(rows.map((row) => row.product_id).filter((value): value is string => Boolean(value))));

  if (!productIds.length) {
    return new Map();
  }

  try {
    const projections = await listPromptReadinessProjections({
      productIds,
      workspaceId: job.workspace_id ?? null,
      limit: productIds.length,
    });

    return new Map(projections.map((projection) => [projection.product.id, promptReadinessFromProjection(projection)]));
  } catch {
    return new Map();
  }
}

async function snapshotFromRecords(
  job: BulkImportJobRecord,
  rows: BulkImportJobRowRecord[],
  logs: BulkImportJobLogRecord[],
): Promise<BulkImportJobSnapshot> {
  const promptReadinessMap = await promptReadinessByProductId(job, rows);
  const previewRows = rows.map((row) => previewRowFromRecord(row, row.product_id ? promptReadinessMap.get(row.product_id) ?? null : null));

  return {
    job: jobFromRecord(job),
    rows: rows.map((row) => jobRowFromRecord(row, row.product_id ? promptReadinessMap.get(row.product_id) ?? null : null)),
    logs: logs.map(logFromRecord),
    result: {
      fileName: job.file_name,
      rows: previewRows,
      summary: summaryFromJobRecord(job),
    },
  };
}

async function loadJobRecord(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("bulk_import_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Job bulk import tidak ditemukan.");
  }

  return data as BulkImportJobRecord;
}

async function loadJobRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("bulk_import_job_rows")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("row_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BulkImportJobRowRecord[];
}

async function loadJobLogs(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("bulk_import_job_logs")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("sequence", { ascending: false })
    .limit(80);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as BulkImportJobLogRecord[]).sort((left, right) => left.sequence - right.sequence);
}

async function loadJobSnapshotForContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
) {
  const [job, rows, logs] = await Promise.all([
    loadJobRecord(supabase, userId, jobId),
    loadJobRows(supabase, userId, jobId),
    loadJobLogs(supabase, userId, jobId),
  ]);

  return await snapshotFromRecords(job, rows, logs);
}

export async function getProductBulkImportJob(jobId: string) {
  const { supabase, user } = await requireUser();
  return await loadJobSnapshotForContext(supabase, user.id, jobId);
}

export async function getActiveProductBulkImportJob() {
  const { supabase, user } = await requireUser();
  const { data: active, error: activeError } = await supabase
    .from("bulk_import_jobs")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ACTIVE_BULK_JOB_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) {
    throw new Error(activeError.message);
  }

  if (active) {
    return await loadJobSnapshotForContext(supabase, user.id, (active as BulkImportJobRecord).id);
  }

  const recentCutoff = new Date(Date.now() - BULK_IMPORT_RECENT_JOB_MS).toISOString();
  const { data: recent, error: recentError } = await supabase
    .from("bulk_import_jobs")
    .select("*")
    .eq("user_id", user.id)
    .gte("created_at", recentCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentError) {
    throw new Error(recentError.message);
  }

  if (!recent) {
    return null;
  }

  return await loadJobSnapshotForContext(supabase, user.id, (recent as BulkImportJobRecord).id);
}

async function insertJobLog(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  input: {
    jobId: string;
    rowId?: string | null;
    level: BulkImportLogLevel;
    title: string;
    message: string;
    metadata?: JsonRecord | null;
  },
) {
  const { error } = await supabase.from("bulk_import_job_logs").insert({
    user_id: userId,
    job_id: input.jobId,
    row_id: input.rowId ?? null,
    level: input.level,
    title: input.title,
    message: input.message,
    metadata_json: input.metadata ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function rowCounters(rows: BulkImportJobRowRecord[], duplicateRows: number): BulkImportSummary {
  return {
    totalRows: rows.length,
    readyRows: rows.filter((row) => ACTIVE_BULK_ROW_STATUSES.includes(row.status)).length,
    duplicateRows,
    errorRows: rows.filter((row) => row.status === "ERROR").length,
    importedRows: rows.filter((row) => row.status === "IMPORTED").length,
    skippedRows: rows.filter((row) => row.status === "SKIPPED").length,
    cancelledRows: rows.filter((row) => row.status === "CANCELLED").length,
  };
}

async function refreshJobCounters(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
) {
  const [job, rows] = await Promise.all([loadJobRecord(supabase, userId, jobId), loadJobRows(supabase, userId, jobId)]);
  const counts = rowCounters(rows, job.duplicate_rows);
  const { data, error } = await supabase
    .from("bulk_import_jobs")
    .update({
      total_rows: counts.totalRows,
      ready_rows: counts.readyRows,
      error_rows: counts.errorRows,
      imported_rows: counts.importedRows,
      skipped_rows: counts.skippedRows,
      cancelled_rows: counts.cancelledRows,
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as BulkImportJobRecord;
}

function initialJobRowStatus(row: BulkImportPreviewRow): BulkImportJobRowStatus {
  if (row.status === "error") {
    return "ERROR";
  }

  if (row.status === "duplicate" || row.status === "skipped") {
    return "SKIPPED";
  }

  return "READY";
}

function initialJobRowErrors(row: BulkImportPreviewRow) {
  if (row.status === "duplicate" && !row.errors.length) {
    return ["URL Produk sudah tersimpan."];
  }

  return row.errors;
}

export async function createProductBulkImportJob(file: File) {
  const preview = await previewProductBulkImport(file);
  const { supabase, user } = await requireUser();
  const currentWorkspace = await getCurrentWorkspace();

  if (!currentWorkspace) {
    throw new Error("Aktifkan Akun Affiliate dulu.");
  }

  const { data: jobData, error: jobError } = await supabase
    .from("bulk_import_jobs")
    .insert({
      user_id: user.id,
      workspace_id: currentWorkspace.id,
      file_name: preview.fileName,
      total_rows: preview.summary.totalRows,
      ready_rows: preview.summary.readyRows,
      duplicate_rows: preview.summary.duplicateRows,
      error_rows: preview.summary.errorRows,
      imported_rows: 0,
      skipped_rows: preview.summary.duplicateRows,
      cancelled_rows: 0,
      status: "QUEUED",
    })
    .select("*")
    .single();

  if (jobError) {
    throw new Error(jobError.message);
  }

  const job = jobData as BulkImportJobRecord;
  const rowPayloads = preview.rows.map((row) => ({
    user_id: user.id,
    job_id: job.id,
    workspace_id: currentWorkspace.id,
    row_number: row.rowNumber,
    status: initialJobRowStatus(row),
    errors: initialJobRowErrors(row),
    product_name: row.productName,
    product_url: row.productUrl,
    image_url: row.imageUrl,
    marketplace_label: row.marketplaceLabel,
    platform: row.platform,
    source_domain: row.sourceDomain,
    optional_json: row.optional,
    raw_columns_json: row.rawColumns,
    intake_code: buildBulkIntakeCode(row.rowNumber),
    current_stage:
      row.status === "error" ? "Row tidak valid" : row.status === "duplicate" ? "Duplikat dilewati" : "Menunggu import",
    error_message: row.status === "error" ? row.errors.join(" ") || "Row tidak valid." : null,
    finished_at: row.status === "error" || row.status === "duplicate" ? new Date().toISOString() : null,
  }));

  if (rowPayloads.length) {
    const { error: rowsError } = await supabase.from("bulk_import_job_rows").insert(rowPayloads);

    if (rowsError) {
      throw new Error(rowsError.message);
    }
  }

  await insertJobLog(supabase, user.id, {
    jobId: job.id,
    level: "INFO",
    title: "File terbaca",
    message: `${preview.summary.totalRows} row ditemukan, ${preview.summary.readyRows} siap import.`,
  });

  for (const row of preview.rows) {
    if (row.status === "duplicate") {
      await insertJobLog(supabase, user.id, {
        jobId: job.id,
        level: "WARNING",
        title: "Row dilewati",
        message: `Row ${row.rowNumber} - ${row.productName || "Produk tanpa nama"}. URL Produk sudah tersimpan.`,
      });
    }

    if (row.status === "error") {
      await insertJobLog(supabase, user.id, {
        jobId: job.id,
        level: "ERROR",
        title: "Row error",
        message: `Row ${row.rowNumber} - ${row.productName || "Produk tanpa nama"}. ${row.errors.join(" ") || "Row tidak valid."}`,
      });
    }
  }

  await refreshJobCounters(supabase, user.id, job.id);
  return await loadJobSnapshotForContext(supabase, user.id, job.id);
}

async function updateJobRow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  rowId: string,
  patch: Partial<{
    status: BulkImportJobRowStatus;
    errors: string[];
    product_id: string | null;
    intake_session_id: string | null;
    drive_item_id: string | null;
    current_stage: string | null;
    error_message: string | null;
    started_at: string | null;
    finished_at: string | null;
  }>,
) {
  const { data, error } = await supabase
    .from("bulk_import_job_rows")
    .update(patch)
    .eq("id", rowId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as BulkImportJobRowRecord;
}

async function heartbeatBulkImportJob(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
  runnerId: string,
) {
  const { error } = await supabase
    .from("bulk_import_jobs")
    .update({
      runner_id: runnerId,
      lease_expires_at: leaseExpiryIso(),
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function claimBulkImportJob(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
  runnerId: string,
) {
  const { data, error } = await supabase
    .from("bulk_import_jobs")
    .update({
      status: "RUNNING",
      runner_id: runnerId,
      lease_expires_at: leaseExpiryIso(),
      last_heartbeat_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", jobId)
    .eq("user_id", userId)
    .in("status", ["QUEUED", "RUNNING"])
    .or(`runner_id.is.null,lease_expires_at.lt.${new Date().toISOString()}`)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as BulkImportJobRecord | null;
}

async function findExistingProductByLink(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  productUrl: string,
) {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("user_id", userId)
    .eq("marketplace_product_link", productUrl)
    .neq("status", "ARCHIVED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function ensureProductSourceImage(productId: string, driveItemId: string) {
  const { supabase, user } = await requireUser();
  const { data: existing, error: existingError } = await supabase
    .from("product_images")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .eq("drive_item_ref_id", driveItemId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return;
  }

  const { data: primary, error: primaryError } = await supabase
    .from("product_images")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .eq("is_primary", true)
    .in("status", ["ATTACHED", "ANALYZED"])
    .limit(1)
    .maybeSingle();

  if (primaryError) {
    throw new Error(primaryError.message);
  }

  await attachProductSourceImage({
    productId,
    driveItemRefId: driveItemId,
    isPrimary: !primary,
    status: "ATTACHED",
    notes: "Auto-attached from bulk import.",
  });
}

async function findExistingIntakeSessionByCode(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  intakeCode: string,
) {
  const { data, error } = await supabase
    .from("product_intake_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("intake_code", intakeCode)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function processBulkImportJobRow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  job: BulkImportJobRecord,
  row: BulkImportJobRowRecord,
  runnerId: string,
) {
  const previewRow = previewRowFromRecord(row);
  const rowLabelText = `Row ${row.row_number} - ${row.product_name || "Produk tanpa nama"}`;
  const nowIso = new Date().toISOString();

  await updateJobRow(supabase, userId, row.id, {
    status: "RUNNING",
    current_stage: "Menyiapkan row",
    started_at: row.started_at ?? nowIso,
    error_message: null,
  });
  await insertJobLog(supabase, userId, {
    jobId: job.id,
    rowId: row.id,
    level: "INFO",
    title: "Row dimulai",
    message: rowLabelText,
  });
  await heartbeatBulkImportJob(supabase, userId, job.id, runnerId);

  let driveItemId = row.drive_item_id;
  if (!driveItemId) {
    const intakeCode = row.intake_code || buildBulkIntakeCode(row.row_number);
    await updateJobRow(supabase, userId, row.id, {
      status: "IMAGE_DOWNLOADING",
      current_stage: "Mengunduh gambar",
    });
    await insertJobLog(supabase, userId, {
      jobId: job.id,
      rowId: row.id,
      level: "INFO",
      title: "Download gambar",
      message: rowLabelText,
    });

    const folders = await ensureIntakeDriveFolders(intakeCode, { workspaceId: row.workspace_id ?? job.workspace_id });
    const image = await downloadImage(row.image_url);

    await updateJobRow(supabase, userId, row.id, {
      status: "IMAGE_UPLOADING",
      current_stage: "Upload ke Drive",
    });
    await insertJobLog(supabase, userId, {
      jobId: job.id,
      rowId: row.id,
      level: "INFO",
      title: "Upload Drive",
      message: rowLabelText,
    });

    const fileName = sanitizeDriveLeafName(`${row.product_name}-${row.row_number}.${image.extension}`);
    const uploaded = await uploadBufferToGoogleDrive({
      bytes: image.bytes,
      description: "Bulk import product image.",
      mimeType: image.mimeType,
      name: fileName,
      parentFolderId: folders.productFolder.drive_item_id ?? "",
    });
    const driveItem = await createDriveItem({
      item_type: "FILE",
      drive_item_id: uploaded.driveItemId,
      name: uploaded.name,
      drive_url: uploaded.driveUrl,
      drive_path: joinDrivePath(folders.productFolder.drive_path, uploaded.name),
      mime_type: uploaded.mimeType,
      size_bytes: uploaded.sizeBytes,
      checksum: uploaded.checksum,
      drive_modified_at: uploaded.driveModifiedAt,
      purpose: "SOURCE_IMAGE",
      status: "ACTIVE",
      notes: "Bulk import product image.",
      parent_id: folders.productFolder.id,
      parent_drive_item_id: folders.productFolder.drive_item_id,
    });
    driveItemId = driveItem.id;
    await updateJobRow(supabase, userId, row.id, {
      drive_item_id: driveItemId,
      current_stage: "Upload ke Drive selesai",
    });
    await insertJobLog(supabase, userId, {
      jobId: job.id,
      rowId: row.id,
      level: "SUCCESS",
      title: "Gambar masuk Drive",
      message: rowLabelText,
      metadata: { drive_item_id: driveItemId },
    });
  }

  let productId = row.product_id;
  if (!productId) {
    await updateJobRow(supabase, userId, row.id, {
      status: "PRODUCT_CREATING",
      current_stage: "Membuat draft produk",
    });
    await insertJobLog(supabase, userId, {
      jobId: job.id,
      rowId: row.id,
      level: "INFO",
      title: "Simpan produk",
      message: rowLabelText,
    });

    productId = await findExistingProductByLink(supabase, userId, row.product_url);
    if (!productId) {
      const product = await createProduct({
        workspace_id: row.workspace_id ?? job.workspace_id,
        product_name: row.product_name,
        marketplace: row.marketplace_label,
        marketplace_product_link: row.product_url,
        status: "DRAFT",
      });
      productId = product.id;
    }

    await updateJobRow(supabase, userId, row.id, {
      product_id: productId,
      current_stage: "Draft produk tersimpan",
    });
    await insertJobLog(supabase, userId, {
      jobId: job.id,
      rowId: row.id,
      level: "SUCCESS",
      title: "Produk dibuat",
      message: rowLabelText,
      metadata: { product_id: productId },
    });
  }

  await ensureProductSourceImage(productId, driveItemId);

  let intakeSessionId = row.intake_session_id;
  if (!intakeSessionId) {
    const intakeCode = row.intake_code || buildBulkIntakeCode(row.row_number);
    intakeSessionId = await findExistingIntakeSessionByCode(supabase, userId, intakeCode);
    if (!intakeSessionId) {
      const metadata = parsedMetadataJson(previewRow, job.file_name);
      const session = await createIntakeSession({
        workspace_id: row.workspace_id ?? job.workspace_id,
        intake_code: intakeCode,
        product_id: productId,
        product_title: row.product_name,
        product_photo_drive_item_ref_id: driveItemId,
        parsed_metadata_json: metadata,
        reviewed_metadata_json: metadata,
        shopee_url: row.platform === "SHOPEE" ? row.product_url : null,
        tiktok_url: row.platform === "TIKTOK" ? row.product_url : null,
        status: "REVIEWED",
      });
      intakeSessionId = session.id;
    }

    await updateJobRow(supabase, userId, row.id, {
      intake_session_id: intakeSessionId,
      current_stage: "Intake tersimpan",
    });
    await insertJobLog(supabase, userId, {
      jobId: job.id,
      rowId: row.id,
      level: "SUCCESS",
      title: "Intake dibuat",
      message: rowLabelText,
      metadata: { intake_session_id: intakeSessionId },
    });
  }

  if (!row.platform) {
    throw new Error("Marketplace belum didukung.");
  }

  await createMarketplaceSource({
    product_id: productId,
    workspace_id: row.workspace_id ?? job.workspace_id,
    platform: row.platform,
    product_url: row.product_url,
    title: row.product_name,
    price_text: previewRow.optional.priceText,
    rating_text: previewRow.optional.ratingText,
    sold_count_text: previewRow.optional.soldCountText,
    shop_name: previewRow.optional.shopName,
    parsed_metadata_json: {
      source_import: sourceImportJson(previewRow, job.file_name),
    },
    status: "ACTIVE",
    notes: "Saved from bulk import scraping.",
  });

  await updateJobRow(supabase, userId, row.id, {
    status: "IMPORTED",
    errors: [],
    current_stage: "Row selesai",
    error_message: null,
    finished_at: new Date().toISOString(),
  });
  await insertJobLog(supabase, userId, {
    jobId: job.id,
    rowId: row.id,
    level: "SUCCESS",
    title: "Import sukses",
    message: rowLabelText,
  });
  await heartbeatBulkImportJob(supabase, userId, job.id, runnerId);
}

async function markRemainingRowsCancelled(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
) {
  const { error } = await supabase
    .from("bulk_import_job_rows")
    .update({
      status: "CANCELLED",
      current_stage: "Dibatalkan",
      error_message: null,
      finished_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .in("status", ACTIVE_BULK_ROW_STATUSES);

  if (error) {
    throw new Error(error.message);
  }
}

async function markJobCancelled(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
) {
  await markRemainingRowsCancelled(supabase, userId, jobId);
  const counts = summaryFromJobRecord(await refreshJobCounters(supabase, userId, jobId));
  const { error } = await supabase
    .from("bulk_import_jobs")
    .update({
      status: "CANCELLED",
      runner_id: null,
      lease_expires_at: null,
      finished_at: new Date().toISOString(),
      error_message: null,
      ready_rows: counts.readyRows,
      error_rows: counts.errorRows,
      imported_rows: counts.importedRows,
      skipped_rows: counts.skippedRows,
      cancelled_rows: counts.cancelledRows,
    })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await insertJobLog(supabase, userId, {
    jobId,
    level: "WARNING",
    title: "Import dibatalkan",
    message: `${counts.importedRows} row sudah tersimpan, ${counts.cancelledRows} row dibatalkan.`,
  });
}

async function markJobCompleted(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
) {
  const counts = summaryFromJobRecord(await refreshJobCounters(supabase, userId, jobId));
  const { error } = await supabase
    .from("bulk_import_jobs")
    .update({
      status: "COMPLETED",
      runner_id: null,
      lease_expires_at: null,
      finished_at: new Date().toISOString(),
      error_message: null,
      ready_rows: counts.readyRows,
      error_rows: counts.errorRows,
      imported_rows: counts.importedRows,
      skipped_rows: counts.skippedRows,
      cancelled_rows: counts.cancelledRows,
    })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await insertJobLog(supabase, userId, {
    jobId,
    level: counts.errorRows ? "WARNING" : "SUCCESS",
    title: "Import selesai",
    message: `${counts.importedRows} import, ${counts.skippedRows} dilewati, ${counts.errorRows} error.`,
  });
}

async function markJobFailed(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  jobId: string,
  errorMessage: string,
) {
  const { error } = await supabase
    .from("bulk_import_jobs")
    .update({
      status: "FAILED",
      runner_id: null,
      lease_expires_at: null,
      finished_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", jobId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  await insertJobLog(supabase, userId, {
    jobId,
    level: "ERROR",
    title: "Import gagal",
    message: errorMessage,
  });
}

export async function cancelProductBulkImportJob(jobId: string) {
  const { supabase, user } = await requireUser();
  const job = await loadJobRecord(supabase, user.id, jobId);

  if (isTerminalBulkJobStatus(job.status)) {
    return await loadJobSnapshotForContext(supabase, user.id, jobId);
  }

  const nowIso = new Date().toISOString();
  const leaseExpired = !job.lease_expires_at || Date.parse(job.lease_expires_at) < Date.now();
  const nextStatus: BulkImportJobStatus = job.status === "QUEUED" || leaseExpired ? "CANCELLED" : "CANCEL_REQUESTED";
  const { error } = await supabase
    .from("bulk_import_jobs")
    .update({
      status: nextStatus,
      cancel_requested_at: job.cancel_requested_at ?? nowIso,
      ...(nextStatus === "CANCELLED"
        ? {
            runner_id: null,
            lease_expires_at: null,
            finished_at: nowIso,
          }
        : {}),
    })
    .eq("id", jobId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  await insertJobLog(supabase, user.id, {
    jobId,
    level: "WARNING",
    title: "Batal diminta",
    message: "Import akan berhenti setelah row aktif selesai.",
  });

  if (nextStatus === "CANCELLED") {
    await markJobCancelled(supabase, user.id, jobId);
  }

  return await loadJobSnapshotForContext(supabase, user.id, jobId);
}

export async function runProductBulkImportJob(jobId: string) {
  const { supabase, user } = await requireUser();
  const initialJob = await loadJobRecord(supabase, user.id, jobId);

  if (isTerminalBulkJobStatus(initialJob.status)) {
    return await loadJobSnapshotForContext(supabase, user.id, jobId);
  }

  if (initialJob.status === "CANCEL_REQUESTED") {
    const leaseExpired = !initialJob.lease_expires_at || Date.parse(initialJob.lease_expires_at) < Date.now();
    if (leaseExpired) {
      await markJobCancelled(supabase, user.id, jobId);
    }
    return await loadJobSnapshotForContext(supabase, user.id, jobId);
  }

  const runnerId = crypto.randomUUID();
  const claimedJob = await claimBulkImportJob(supabase, user.id, jobId, runnerId);

  if (!claimedJob) {
    return await loadJobSnapshotForContext(supabase, user.id, jobId);
  }

  try {
    const rows = await loadJobRows(supabase, user.id, jobId);

    for (const row of rows) {
      const currentJob = await loadJobRecord(supabase, user.id, jobId);
      if (currentJob.status === "CANCEL_REQUESTED") {
        await markJobCancelled(supabase, user.id, jobId);
        return await loadJobSnapshotForContext(supabase, user.id, jobId);
      }

      if (!ACTIVE_BULK_ROW_STATUSES.includes(row.status)) {
        continue;
      }

      try {
        await processBulkImportJobRow(supabase, user.id, currentJob, row, runnerId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Import row gagal.";
        await updateJobRow(supabase, user.id, row.id, {
          status: "ERROR",
          errors: [errorMessage],
          current_stage: "Row error",
          error_message: errorMessage,
          finished_at: new Date().toISOString(),
        });
        await insertJobLog(supabase, user.id, {
          jobId,
          rowId: row.id,
          level: "ERROR",
          title: "Row error",
          message: `Row ${row.row_number} - ${row.product_name || "Produk tanpa nama"}. ${errorMessage}`,
        });
      } finally {
        await refreshJobCounters(supabase, user.id, jobId);
      }
    }

    const finalJob = await loadJobRecord(supabase, user.id, jobId);
    if (finalJob.status === "CANCEL_REQUESTED") {
      await markJobCancelled(supabase, user.id, jobId);
    } else {
      await markJobCompleted(supabase, user.id, jobId);
    }

    revalidatePath("/products");
    revalidatePath("/products/new");
    revalidatePath("/intake");
    revalidatePath("/prompts");
    return await loadJobSnapshotForContext(supabase, user.id, jobId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Bulk import gagal.";
    await markJobFailed(supabase, user.id, jobId, errorMessage);
    return await loadJobSnapshotForContext(supabase, user.id, jobId);
  }
}

export async function importProductBulkFile(file: File): Promise<BulkImportResponse> {
  const preview = await previewProductBulkImport(file);
  const rows: BulkImportPreviewRow[] = [];
  const importedLinks = new Set<string>();

  for (const row of preview.rows) {
    if (row.status === "error") {
      rows.push(row);
      continue;
    }

    if (row.status === "duplicate" || importedLinks.has(row.productUrl)) {
      const skippedRow: BulkImportPreviewRow = {
        ...row,
        status: "skipped",
      };
      rows.push(skippedRow);
      continue;
    }

    try {
      const result = await importReadyRow(row, preview.fileName);
      importedLinks.add(row.productUrl);
      const importedRow: BulkImportPreviewRow = {
        ...row,
        ...result,
        status: "imported",
        errors: [],
      };
      rows.push(importedRow);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Import row gagal.";
      const errorRow: BulkImportPreviewRow = {
        ...row,
        status: "error",
        errors: [errorMessage],
      };
      rows.push(errorRow);
    }
  }

  revalidatePath("/products");
  revalidatePath("/products/new");
  revalidatePath("/intake");
  revalidatePath("/prompts");

  return {
    fileName: preview.fileName,
    rows,
    summary: summarize(rows),
  };
}
