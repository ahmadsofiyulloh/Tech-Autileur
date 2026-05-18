import "server-only";

import { readSheet } from "read-excel-file/universal";
import type { CellValue } from "read-excel-file/universal";
import {
  emptyBulkImportOptionalFields,
  parseBulkImportCsv,
  parseBulkImportRows,
  readBulkImportText,
  type BulkParsedRow,
} from "@/lib/bulk-import/parser-core";

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

function cellToText(value: CellValue | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value).trim();
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
    return parseBulkImportCsv(await file.text());
  }

  const rows = await readSheet(await file.arrayBuffer());
  return rows.map((row) => row.map((cell) => cellToText(cell)));
}

export { emptyBulkImportOptionalFields, readBulkImportText };
export type { BulkParsedRow };

export async function parseBulkImportFile(file: File) {
  return parseBulkImportRows(await readSpreadsheetRows(file));
}
