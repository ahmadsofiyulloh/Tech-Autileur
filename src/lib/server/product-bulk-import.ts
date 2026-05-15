import "server-only";

import { revalidatePath } from "next/cache";
import { readSheet } from "read-excel-file/universal";
import type { CellValue } from "read-excel-file/universal";
import { createDriveItem } from "@/lib/server/drive-items";
import { ensureIntakeDriveFolders } from "@/lib/server/intake";
import { createMarketplaceSource } from "@/lib/server/product-marketplace-sources";
import { attachProductSourceImage, createProduct } from "@/lib/server/products";
import { uploadBufferToGoogleDrive } from "@/lib/server/google-drive";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createIntakeSession } from "@/lib/server/intake";
import type { JsonRecord, MarketplacePlatform } from "@/lib/intake/validation";
import type {
  BulkImportOptionalFields,
  BulkImportPreviewRow,
  BulkImportResponse,
  BulkImportRowStatus,
  BulkImportSummary,
} from "@/lib/bulk-import/types";

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
    confidence_notes: ["Metadata awal dari bulk import scraping. Review manual sebelum prompt."],
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

async function importReadyRow(row: BulkImportPreviewRow, sourceFileName: string) {
  if (!row.platform) {
    throw new Error("Marketplace belum didukung.");
  }

  const intakeCode = buildBulkIntakeCode(row.rowNumber);
  const folders = await ensureIntakeDriveFolders(intakeCode);
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
    shopee_url: row.platform === "SHOPEE" ? row.productUrl : null,
    tiktok_url: row.platform === "TIKTOK" ? row.productUrl : null,
    status: "NEEDS_REVIEW",
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
    status: "NEEDS_REVIEW",
    notes: "Saved from bulk import.",
  });

  return {
    driveItemId: driveItem.id,
    intakeSessionId: session.id,
    productId: product.id,
  };
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
      rows.push({
        ...row,
        status: "skipped",
      });
      continue;
    }

    try {
      const result = await importReadyRow(row, preview.fileName);
      importedLinks.add(row.productUrl);
      rows.push({
        ...row,
        ...result,
        status: "imported",
        errors: [],
      });
    } catch (error) {
      rows.push({
        ...row,
        status: "error",
        errors: [error instanceof Error ? error.message : "Import row gagal."],
      });
    }
  }

  revalidatePath("/products");
  revalidatePath("/products/new");
  revalidatePath("/intake");

  return {
    fileName: preview.fileName,
    rows,
    summary: summarize(rows),
  };
}
