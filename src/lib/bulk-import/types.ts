import type { MarketplacePlatform } from "@/lib/intake/validation";

export type BulkImportOptionalFields = {
  availableColors: string | null;
  availableSizes: string | null;
  description: string | null;
  discountText: string | null;
  globalReviewText: string | null;
  priceText: string | null;
  ratingText: string | null;
  shopName: string | null;
  soldCountText: string | null;
};

export type BulkImportRowStatus = "ready" | "duplicate" | "error" | "imported" | "skipped";

export type BulkImportPreviewRow = {
  rowNumber: number;
  status: BulkImportRowStatus;
  errors: string[];
  productName: string;
  productUrl: string;
  imageUrl: string;
  marketplaceLabel: string;
  platform: MarketplacePlatform | null;
  sourceDomain: string | null;
  optional: BulkImportOptionalFields;
  rawColumns: Record<string, string>;
  productId?: string;
  intakeSessionId?: string;
  driveItemId?: string;
};

export type BulkImportSummary = {
  totalRows: number;
  readyRows: number;
  duplicateRows: number;
  errorRows: number;
  importedRows: number;
  skippedRows: number;
};

export type BulkImportResponse = {
  fileName: string;
  rows: BulkImportPreviewRow[];
  summary: BulkImportSummary;
};
