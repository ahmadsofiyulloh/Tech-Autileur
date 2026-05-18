import type { BulkImportOptionalFields, BulkImportPreviewRow, BulkImportRowStatus } from "@/lib/bulk-import/types";
import type { MarketplacePlatform } from "@/lib/intake/validation";

export const MAX_IMPORT_ROWS = 250;

const REQUIRED_HEADER_GROUPS = [
  { label: "Nama Produk", aliases: ["nama produk", "product name", "title", "name"] },
  { label: "URL Produk", aliases: ["url produk", "marketplace link", "link produk", "product url"] },
  { label: "Gambar Produk", aliases: ["gambar produk", "url gambar", "image url", "product image", "image"] },
] as const;

const HEADER_ALIASES = {
  availableColors: ["warna tersedia", "warna"],
  availableSizes: ["ukuran tersedia", "ukuran"],
  description: ["deskripsi produk", "deskripsi"],
  discountText: ["diskon", "diskon persen", "diskon %"],
  globalReviewText: ["ulasan global", "ulasan"],
  imageUrl: ["gambar produk", "url gambar", "image url", "product image", "image"],
  priceText: ["harga idr", "harga", "price"],
  productName: ["nama produk", "product name", "title", "name"],
  productUrl: ["url produk", "marketplace link", "link produk", "product url"],
  ratingText: ["rating max 5", "rating"],
  shopName: ["nama penjual", "nama toko", "toko", "seller"],
  soldCountText: ["jumlah terjual", "terjual", "sold"],
} as const;

const SHOPEE_PRODUCT_IMAGE_HOST = "down-id.img.susercontent.com";

export type BulkParsedRow = Omit<BulkImportPreviewRow, "status" | "errors"> & {
  errors: string[];
  skipReason?: string;
};

type MarketplaceResolution = {
  label: string;
  platform: MarketplacePlatform;
  sourceDomain: string;
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

export function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function detectCsvDelimiter(headerLine: string) {
  const candidates = [",", ";", "\t"] as const;
  return candidates
    .map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length }))
    .sort((left, right) => right.count - left.count)[0]?.delimiter ?? ",";
}

export function parseBulkImportCsv(text: string) {
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

function hasHeader(headers: Map<string, number>, header: string) {
  return headers.has(normalizeHeader(header));
}

function hasAnyHeader(headers: Map<string, number>, aliases: readonly string[]) {
  return aliases.some((alias) => hasHeader(headers, alias));
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

function isShopeeHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === "shopee.co.id" || normalized.endsWith(".shopee.co.id");
}

function isShopeeProductImageUrl(value: string) {
  try {
    return new URL(value).hostname.toLowerCase() === SHOPEE_PRODUCT_IMAGE_HOST;
  } catch {
    return false;
  }
}

function normalizeShopeeDetailUrl(value: string) {
  const normalized = normalizeHttpUrl(value);

  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized);
    if (!isShopeeHost(url.hostname)) {
      return "";
    }

    if (!/-i\.\d+\.\d+\/?$/i.test(url.pathname)) {
      return "";
    }

    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeMarketplaceProductUrl(value: string) {
  const normalized = normalizeHttpUrl(value);

  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized);
    if (isShopeeHost(url.hostname)) {
      return normalizeShopeeDetailUrl(normalized);
    }

    return normalized;
  } catch {
    return "";
  }
}

function resolveMarketplace(productUrl: string): MarketplaceResolution | null {
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

function resolveShopeeSource(value: string): MarketplaceResolution | null {
  const normalized = normalizeHttpUrl(value);

  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (!isShopeeHost(url.hostname)) {
      return null;
    }

    return { label: "Shopee", platform: "SHOPEE", sourceDomain: url.hostname.toLowerCase() };
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

function isShopeeCssScraper(headers: Map<string, number>) {
  return hasHeader(headers, "contents href") && hasHeader(headers, "whitespace-normal");
}

function isShopeeWebScraper(headers: Map<string, number>) {
  return hasHeader(headers, "web_scraper_start_url") && hasHeader(headers, "name") && hasHeader(headers, "image");
}

function findFirstUrl(row: string[], predicate: (url: string) => boolean) {
  for (const cell of row) {
    const normalized = normalizeHttpUrl(cell);
    if (normalized && predicate(normalized)) {
      return normalized;
    }
  }

  return "";
}

function findShopeeDetailUrl(row: string[]) {
  for (const cell of row) {
    const normalized = normalizeShopeeDetailUrl(cell);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function readPriceWithCurrency(currency: string, value: string) {
  const currentValue = readBulkImportText(value);
  const currentCurrency = readBulkImportText(currency);

  if (!currentValue) {
    return null;
  }

  return currentCurrency ? `${currentCurrency} ${currentValue}` : currentValue;
}

function buildShopeeCssOptionalFields(headers: Map<string, number>, row: string[]): BulkImportOptionalFields {
  const price = readCell(headers, row, ["truncate"]);

  return {
    ...emptyBulkImportOptionalFields(),
    discountText: readCell(headers, row, ["text-shopee-primary"]) || null,
    priceText: price ? `Rp ${price}` : null,
    ratingText: readCell(headers, row, ["text-shopee-black87"]) || null,
    soldCountText: readCell(headers, row, ["truncate (3)"]) || null,
  };
}

function buildShopeeWebOptionalFields(headers: Map<string, number>, row: string[]): BulkImportOptionalFields {
  return {
    ...emptyBulkImportOptionalFields(),
    discountText: readCell(headers, row, ["data3"]) || null,
    priceText: readPriceWithCurrency(readCell(headers, row, ["data9"]), readCell(headers, row, ["data"])),
    ratingText: readCell(headers, row, ["data5"]) || null,
    soldCountText: readCell(headers, row, ["data2"]) || null,
  };
}

function parsedRow(input: {
  errors: string[];
  imageUrl: string;
  marketplace: MarketplaceResolution | null;
  optional: BulkImportOptionalFields;
  productName: string;
  productUrl: string;
  rawColumns: Record<string, string>;
  rowNumber: number;
  skipReason?: string;
}): BulkParsedRow {
  return {
    rowNumber: input.rowNumber,
    errors: input.errors,
    productName: input.productName,
    productUrl: input.productUrl,
    imageUrl: input.imageUrl,
    marketplaceLabel: input.marketplace?.label ?? "",
    platform: input.marketplace?.platform ?? null,
    sourceDomain: input.marketplace?.sourceDomain ?? null,
    optional: input.optional,
    rawColumns: input.rawColumns,
    ...(input.skipReason ? { skipReason: input.skipReason } : {}),
  };
}

function parseShopeeCssRows(headers: string[], dataRows: string[][]) {
  const map = headerIndexMap(headers);

  return dataRows.map((row, index) => {
    const productUrl = findShopeeDetailUrl(row);
    const productName = readCell(map, row, ["whitespace-normal"]);
    const imageUrl = findFirstUrl(row, isShopeeProductImageUrl);
    const marketplace = productUrl ? resolveMarketplace(productUrl) : resolveShopeeSource(readCell(map, row, ["contents href"]));
    const errors: string[] = [];
    const skipReason = productUrl ? undefined : "URL Produk Shopee bukan URL detail produk.";

    if (!productName) {
      errors.push("Nama Produk wajib diisi.");
    }

    if (!imageUrl) {
      errors.push("Gambar Produk wajib berupa URL gambar produk Shopee.");
    }

    return parsedRow({
      rowNumber: index + 2,
      errors,
      productName,
      productUrl,
      imageUrl,
      marketplace,
      optional: buildShopeeCssOptionalFields(map, row),
      rawColumns: rawColumns(headers, row),
      skipReason,
    });
  });
}

function parseShopeeWebRows(headers: string[], dataRows: string[][]) {
  const map = headerIndexMap(headers);

  return dataRows.map((row, index) => {
    const sourceUrl = readCell(map, row, ["web_scraper_start_url"]);
    const productUrl = normalizeShopeeDetailUrl(sourceUrl);
    const productName = readCell(map, row, ["name"]);
    const imageUrl = findFirstUrl(row, isShopeeProductImageUrl);
    const marketplace = productUrl ? resolveMarketplace(productUrl) : resolveShopeeSource(sourceUrl);
    const errors: string[] = [];
    const skipReason = productUrl ? undefined : "URL Produk Shopee tidak tersedia atau bukan URL detail produk.";

    if (!productName) {
      errors.push("Nama Produk wajib diisi.");
    }

    if (!imageUrl) {
      errors.push("Gambar Produk wajib berupa URL gambar produk Shopee.");
    }

    return parsedRow({
      rowNumber: index + 2,
      errors,
      productName,
      productUrl,
      imageUrl,
      marketplace,
      optional: buildShopeeWebOptionalFields(map, row),
      rawColumns: rawColumns(headers, row),
      skipReason,
    });
  });
}

function parseCanonicalRows(headers: string[], dataRows: string[][]) {
  const map = headerIndexMap(headers);
  const missingHeaders = REQUIRED_HEADER_GROUPS.filter((group) => !hasAnyHeader(map, group.aliases)).map((group) => group.label);

  if (missingHeaders.length) {
    throw new Error(`Header wajib belum ada: ${missingHeaders.join(", ")}.`);
  }

  return dataRows.map((row, index) => {
    const productName = readCell(map, row, HEADER_ALIASES.productName);
    const productUrl = normalizeMarketplaceProductUrl(readCell(map, row, HEADER_ALIASES.productUrl));
    const imageUrl = normalizeHttpUrl(readCell(map, row, HEADER_ALIASES.imageUrl));
    const marketplace = productUrl ? resolveMarketplace(productUrl) : null;
    const errors: string[] = [];

    if (!productName) {
      errors.push("Nama Produk wajib diisi.");
    }

    if (!productUrl) {
      errors.push("URL Produk wajib berupa URL detail produk http/https.");
    }

    if (!imageUrl) {
      errors.push("Gambar Produk wajib berupa URL http/https.");
    }

    if (productUrl && !marketplace) {
      errors.push("Marketplace belum didukung.");
    }

    return parsedRow({
      rowNumber: index + 2,
      errors,
      productName,
      productUrl,
      imageUrl,
      marketplace,
      optional: buildOptionalFields(map, row),
      rawColumns: rawColumns(headers, row),
    });
  });
}

export function parseBulkImportRows(rows: string[][]): BulkParsedRow[] {
  const [headerRow, ...dataRows] = rows;

  if (!headerRow?.length) {
    throw new Error("Header file bulk kosong.");
  }

  const headers = headerRow.map((header) => stripBom(readBulkImportText(header)));

  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Maksimal ${MAX_IMPORT_ROWS} row per import.`);
  }

  const map = headerIndexMap(headers);
  const parsedRows = isShopeeCssScraper(map)
    ? parseShopeeCssRows(headers, dataRows)
    : isShopeeWebScraper(map)
      ? parseShopeeWebRows(headers, dataRows)
      : parseCanonicalRows(headers, dataRows);

  return parsedRows.filter(
    (row) => row.productName || row.productUrl || row.imageUrl || Object.values(row.rawColumns).some(Boolean),
  );
}

export function applyBulkImportPreviewStatus(rows: BulkParsedRow[], existingLinks: Set<string>): BulkImportPreviewRow[] {
  const seenLinks = new Set<string>();

  return rows.map((row) => {
    const { skipReason, ...publicRow } = row;
    let status: BulkImportRowStatus = row.errors.length ? "error" : "ready";
    const errors = [...row.errors];

    if (status !== "error" && skipReason) {
      status = "skipped";
      errors.push(skipReason);
    }

    if (status === "ready" && row.productUrl) {
      if (existingLinks.has(row.productUrl) || seenLinks.has(row.productUrl)) {
        status = "duplicate";
        errors.push("URL Produk sudah tersimpan.");
      } else {
        seenLinks.add(row.productUrl);
      }
    }

    return {
      ...publicRow,
      status,
      errors,
    };
  });
}
