import "server-only";

import { readSheet } from "read-excel-file/universal";
import type { CellValue } from "read-excel-file/universal";
import type { BulkImportOptionalFields, BulkImportPreviewRow } from "@/lib/bulk-import/types";
import type { MarketplacePlatform } from "@/lib/intake/validation";

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 200;

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

export type BulkParsedRow = Omit<BulkImportPreviewRow, "status" | "errors"> & {
  errors: string[];
};

export function readBulkImportText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHeader(value: string) {
  return readBulkImportText(value)
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
  return rows.filter((currentRow) => currentRow.some((currentCell) => readBulkImportText(currentCell)));
}

function fileExtension(fileName: string) {
  const match = readBulkImportText(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
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
      return readBulkImportText(row[index]);
    }
  }

  return "";
}

function rawColumns(headers: string[], row: string[]) {
  return headers.reduce<Record<string, string>>((record, header, index) => {
    const key = readBulkImportText(header);
    if (key) {
      record[key] = readBulkImportText(row[index]);
    }
    return record;
  }, {});
}

function normalizeHttpUrl(value: string) {
  const text = readBulkImportText(value);

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

export function emptyBulkImportOptionalFields(): BulkImportOptionalFields {
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
    ...emptyBulkImportOptionalFields(),
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

function parseRows(rows: string[][]): BulkParsedRow[] {
  const [headerRow, ...dataRows] = rows;

  if (!headerRow?.length) {
    throw new Error("Header file bulk kosong.");
  }

  const headers = headerRow.map((header) => stripBom(readBulkImportText(header)));
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

export async function parseBulkImportFile(file: File) {
  return parseRows(await readSpreadsheetRows(file));
}
