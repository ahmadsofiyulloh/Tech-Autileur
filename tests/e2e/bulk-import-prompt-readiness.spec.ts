import { expect, test } from "@playwright/test";
import { isBulkImportMetadataPayload, readBulkImportSourceImport } from "../../src/lib/intake/bulk-import-metadata";
import { projectPromptReadiness } from "../../src/lib/prompts/prompt-readiness-projection";

function buildReadyAffiliateProfile() {
  return {
    status: "ACTIVE",
    workspace_ids: ["workspace-1"],
    i2i_prompt_rules: "keep product shape",
    i2v_prompt_rules: "keep continuity",
    caption_rules: "short caption",
    hashtag_rules: "#tag",
    negative_prompt_rules: "avoid blur",
    product_positioning_notes: "product-first",
    lock_seed_character: false,
    seed_character_drive_item_ref_id: null,
    seed_character_analysis_json: null,
    lock_environment: false,
    environment_drive_item_ref_id: null,
    environment_analysis_json: null,
  };
}

function completeReviewedMetadata(overrides: Record<string, unknown> = {}) {
  return {
    nama_produk: "Tas Selempang Travel",
    keyword_cari_etalase: "tas selempang",
    deskripsi_visual: "Tas selempang hitam compact dengan banyak kantong.",
    use_case: "Dipakai untuk membawa barang harian saat kerja atau jalan.",
    pain_point: "Barang kecil sering tercecer saat bepergian.",
    selling_angle: "Banyak kompartemen dalam ukuran compact.",
    target_viewer: "Pria dan wanita aktif yang sering mobile.",
    ...overrides,
  };
}

test("bulk import enriched metadata is prompt-ready without screenshot evidence", () => {
  const projection = projectPromptReadiness({
    product: { id: "product-1", status: "DRAFT" },
    sourceImages: [{ id: "image-1", drive_item_ref_id: "drive-product", status: "ATTACHED" }],
    marketplaceSources: [
      {
        id: "source-1",
        parsed_metadata_json: {
          source_import: {
            schema_version: "bulk_import_v1",
            product_url: "https://shopee.example/item",
          },
        },
        status: "ACTIVE",
      },
    ],
    intakeSessions: [
      {
        id: "intake-1",
        status: "REVIEWED",
        reviewed_metadata_json: completeReviewedMetadata({
          schema_version: "bulk_import_v1",
          source_import: {
            schema_version: "bulk_import_v1",
          },
        }),
      },
    ],
    affiliateProfile: buildReadyAffiliateProfile(),
  });

  expect(projection.status).toBe("READY_FOR_PROMPT");
  expect(projection.reasons).toHaveLength(0);
  expect(projection.isBulkEnqueueEligible).toBe(true);
});

test("bulk import metadata detector accepts nested source import marker", () => {
  const metadata = completeReviewedMetadata({
    schema_version: "intake_vision_v1",
    source_import: {
      schema_version: "bulk_import_v1",
      product_url: "https://shopee.example/item",
    },
  });

  expect(isBulkImportMetadataPayload(metadata)).toBe(true);
  expect(readBulkImportSourceImport(metadata)).toMatchObject({
    schema_version: "bulk_import_v1",
    product_url: "https://shopee.example/item",
  });
  expect(isBulkImportMetadataPayload(completeReviewedMetadata())).toBe(false);
});

test("bulk import seed metadata still needs Gemini enrichment", () => {
  const projection = projectPromptReadiness({
    product: { id: "product-1", status: "DRAFT" },
    sourceImages: [{ id: "image-1", drive_item_ref_id: "drive-product", status: "ATTACHED" }],
    marketplaceSources: [
      {
        id: "source-1",
        parsed_metadata_json: {
          source_import: {
            schema_version: "bulk_import_v1",
            product_url: "https://shopee.example/item",
          },
        },
        status: "ACTIVE",
      },
    ],
    intakeSessions: [
      {
        id: "intake-1",
        status: "SUBMITTED",
        parsed_metadata_json: {
          schema_version: "bulk_import_v1",
          nama_produk: "Tas",
          source_import: {
            schema_version: "bulk_import_v1",
          },
        },
        reviewed_metadata_json: null,
      },
    ],
    affiliateProfile: buildReadyAffiliateProfile(),
  });

  expect(projection.status).toBe("NEEDS_METADATA");
  expect(projection.reasons.map((reason) => reason.key)).toContain("metadata_analysis");
  expect(projection.isBulkEnqueueEligible).toBe(false);
});

test("non-bulk metadata still requires marketplace screenshot evidence", () => {
  const projection = projectPromptReadiness({
    product: { id: "product-1", status: "DRAFT" },
    sourceImages: [{ id: "image-1", drive_item_ref_id: "drive-product", status: "ATTACHED" }],
    marketplaceSources: [
      {
        id: "source-1",
        parsed_metadata_json: {
          schema_version: "intake_vision_v1",
          ocr: { title: "Tas" },
        },
        status: "ACTIVE",
      },
    ],
    intakeSessions: [
      {
        id: "intake-1",
        status: "REVIEWED",
        reviewed_metadata_json: completeReviewedMetadata(),
      },
    ],
    affiliateProfile: buildReadyAffiliateProfile(),
  });

  expect(projection.status).toBe("NEEDS_EVIDENCE");
  expect(projection.reasons.map((reason) => reason.key)).toContain("marketplace_evidence");
  expect(projection.isBulkEnqueueEligible).toBe(false);
});
