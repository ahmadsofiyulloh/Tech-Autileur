import { expect, test } from "@playwright/test";
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

test("bulk import scraping metadata is prompt-ready without screenshot evidence", () => {
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
        reviewed_metadata_json: {
          schema_version: "bulk_import_v1",
          nama_produk: "Tas",
          source_import: {
            schema_version: "bulk_import_v1",
          },
        },
      },
    ],
    affiliateProfile: buildReadyAffiliateProfile(),
  });

  expect(projection.status).toBe("READY_FOR_PROMPT");
  expect(projection.reasons).toHaveLength(0);
  expect(projection.isBulkEnqueueEligible).toBe(true);
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
        reviewed_metadata_json: { nama_produk: "Tas" },
      },
    ],
    affiliateProfile: buildReadyAffiliateProfile(),
  });

  expect(projection.status).toBe("NEEDS_EVIDENCE");
  expect(projection.reasons.map((reason) => reason.key)).toContain("marketplace_evidence");
  expect(projection.isBulkEnqueueEligible).toBe(false);
});
