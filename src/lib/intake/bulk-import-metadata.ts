import type { JsonRecord } from "@/lib/intake/validation";

export const BULK_IMPORT_SCHEMA_VERSION = "bulk_import_v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readBulkImportSourceImport(value: unknown): JsonRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceImport = isRecord(value.source_import) ? value.source_import : null;

  if (sourceImport?.schema_version === BULK_IMPORT_SCHEMA_VERSION) {
    return sourceImport as JsonRecord;
  }

  if (value.schema_version === BULK_IMPORT_SCHEMA_VERSION) {
    return value as JsonRecord;
  }

  return null;
}

export function isBulkImportMetadataPayload(value: unknown) {
  return Boolean(readBulkImportSourceImport(value));
}
