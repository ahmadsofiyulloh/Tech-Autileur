import { expect, test } from "@playwright/test";
import {
  INTAKE_VISION_PROMPT_VERSION,
  INTAKE_VISION_SCHEMA_VERSION,
  parseIntakeVisionOutput,
} from "../../src/lib/intake/vision-contract";
import { parseIntakeVisionOutputWithRepair } from "../../src/lib/intake/vision-repair";

function buildOcrBlock(overrides?: {
  visible_text_lines?: string[];
  extracted_fields?: Partial<{
    product_title: string;
    category: string;
    rating_text: string;
    sold_count_text: string;
    price_text: string;
    shop_name: string;
  }>;
  confidence?: "high" | "medium" | "low";
  quality_flags?: string[];
}) {
  return {
    visible_text_lines: overrides?.visible_text_lines ?? [],
    extracted_fields: {
      product_title: overrides?.extracted_fields?.product_title ?? "",
      category: overrides?.extracted_fields?.category ?? "",
      rating_text: overrides?.extracted_fields?.rating_text ?? "",
      sold_count_text: overrides?.extracted_fields?.sold_count_text ?? "",
      price_text: overrides?.extracted_fields?.price_text ?? "",
      shop_name: overrides?.extracted_fields?.shop_name ?? "",
    },
    confidence: overrides?.confidence ?? "medium",
    quality_flags: overrides?.quality_flags ?? [],
  };
}

function buildVisionPayload(overrides?: Record<string, unknown>) {
  return {
    schema_version: INTAKE_VISION_SCHEMA_VERSION,
    prompt_version: INTAKE_VISION_PROMPT_VERSION,
    nama_produk: "Tas selempang",
    keyword_cari_etalase: "Tas",
    deskripsi_visual: "Tas compact untuk mobile.",
    use_case: "Harian",
    pain_point: "Berat",
    selling_angle: "Ringan",
    target_viewer: "Wanita aktif",
    product_title: "Tas selempang premium",
    marketplace: "Shopee + TikTok",
    category: "Fashion",
    rating_text: "4.9",
    sold_count_text: "120 terjual",
    price_text: "Rp99.000",
    shop_name: "Toko A",
    visible_product_attributes: ["Kulit sintetis"],
    risk_notes: [],
    confidence_notes: ["Analisis bytes"],
    ocr_evidence: {
      product_image: buildOcrBlock({
        visible_text_lines: ["Tas selempang premium", "Kulit sintetis"],
        extracted_fields: {
          product_title: "Tas selempang premium",
          category: "Fashion",
        },
        confidence: "high",
      }),
      shopee_screenshot: buildOcrBlock({
        visible_text_lines: ["Tas selempang premium", "Rp99.000", "4.9", "120 terjual", "Toko A"],
        extracted_fields: {
          product_title: "Tas selempang premium",
          rating_text: "4.9",
          sold_count_text: "120 terjual",
          price_text: "Rp99.000",
          shop_name: "Toko A",
        },
        confidence: "high",
      }),
      tiktok_screenshot: buildOcrBlock({
        visible_text_lines: ["Tas selempang premium", "Rp99.000", "Toko A"],
        extracted_fields: {
          product_title: "Tas selempang premium",
          price_text: "Rp99.000",
          shop_name: "Toko A",
        },
      }),
    },
    extraction_quality: {
      overall_confidence: "high",
      review_required: false,
      blocking_flags: [],
      notes: [],
    },
    ...overrides,
  };
}

test("intake vision output coerces object-shaped string array items", () => {
  const parsed = parseIntakeVisionOutput(
    JSON.stringify({
      nama_produk: "Tas selempang",
      keyword_cari_etalase: "Tas",
      deskripsi_visual: "Tas compact untuk mobile.",
      use_case: "Harian",
      pain_point: "Berat",
      selling_angle: "Ringan",
      target_viewer: "Wanita aktif",
      product_title: "Tas selempang premium",
      marketplace: "Shopee",
      category: "Fashion",
      rating_text: "4.9",
      sold_count_text: "120",
      price_text: "Rp99.000",
      shop_name: "Toko A",
      visible_product_attributes: [
        { label: "Kulit sintetis" },
        { name: "Jahitan rapi" },
        { value: "Warna netral" },
        { text: "Ringan" },
        { title: "Anti air" },
        "Siap pakai",
      ],
      risk_notes: [{ text: "Tidak ada box" }],
      confidence_notes: [{ label: "Analisis bytes" }],
    }),
  );

  expect(parsed.visible_product_attributes).toEqual([
    "Kulit sintetis",
    "Jahitan rapi",
    "Warna netral",
    "Ringan",
    "Anti air",
    "Siap pakai",
  ]);
  expect(parsed.risk_notes).toEqual(["Tidak ada box"]);
  expect(parsed.confidence_notes).toEqual(["Analisis bytes"]);
});

test("intake vision output preserves exact OCR evidence fields", () => {
  const parsed = parseIntakeVisionOutput(JSON.stringify(buildVisionPayload()));

  expect(parsed.schema_version).toBe(INTAKE_VISION_SCHEMA_VERSION);
  expect(parsed.prompt_version).toBe(INTAKE_VISION_PROMPT_VERSION);
  expect(parsed.ocr_evidence.shopee_screenshot.extracted_fields.price_text).toBe("Rp99.000");
  expect(parsed.ocr_evidence.shopee_screenshot.extracted_fields.rating_text).toBe("4.9");
  expect(parsed.ocr_evidence.shopee_screenshot.extracted_fields.sold_count_text).toBe("120 terjual");
  expect(parsed.ocr_evidence.shopee_screenshot.extracted_fields.shop_name).toBe("Toko A");
  expect(parsed.ocr_evidence.shopee_screenshot.visible_text_lines).toContain("Rp99.000");
});

test("intake vision output recovers JSON from wrapped code fences", () => {
  const parsed = parseIntakeVisionOutput(`
    Here is the JSON you asked for:
    \`\`\`json
    ${JSON.stringify(buildVisionPayload())}
    \`\`\`
    End of response.
  `);

  expect(parsed.product_title).toBe("Tas selempang premium");
  expect(parsed.extraction_quality.overall_confidence).toBe("high");
});

test("intake vision output repair callback is used when Gemini returns a JSON array", async () => {
  let repairCalls = 0;

  const parsed = await parseIntakeVisionOutputWithRepair({
    rawText: JSON.stringify([buildVisionPayload()]),
    repair: async ({ prompt }) => {
      repairCalls += 1;
      expect(prompt).toContain("Never return an array");
      expect(prompt).toContain("Repair reason:");
      return JSON.stringify(buildVisionPayload());
    },
  });

  expect(repairCalls).toBe(1);
  expect(parsed.schema_version).toBe(INTAKE_VISION_SCHEMA_VERSION);
  expect(parsed.product_title).toBe("Tas selempang premium");
});

test("intake vision output repair callback is used when Gemini returns non-JSON text", async () => {
  let repairCalls = 0;

  const parsed = await parseIntakeVisionOutputWithRepair({
    rawText: "Gemini responded with commentary instead of JSON.",
    repair: async ({ prompt }) => {
      repairCalls += 1;
      expect(prompt).toContain(INTAKE_VISION_SCHEMA_VERSION);
      return JSON.stringify(buildVisionPayload());
    },
  });

  expect(repairCalls).toBe(1);
  expect(parsed.schema_version).toBe(INTAKE_VISION_SCHEMA_VERSION);
  expect(parsed.prompt_version).toBe(INTAKE_VISION_PROMPT_VERSION);
});

test("intake vision output preserves low confidence review flags", () => {
  const parsed = parseIntakeVisionOutput(
    JSON.stringify(
      buildVisionPayload({
        price_text: "",
        ocr_evidence: {
          product_image: buildOcrBlock(),
          shopee_screenshot: buildOcrBlock({
            visible_text_lines: ["Harga tertutup"],
            confidence: "low",
            quality_flags: ["cropped", "price_unreadable"],
          }),
          tiktok_screenshot: buildOcrBlock({
            visible_text_lines: ["Harga tertutup"],
            confidence: "low",
            quality_flags: ["cropped", "price_unreadable"],
          }),
        },
        extraction_quality: {
          overall_confidence: "low",
          review_required: true,
          blocking_flags: ["price_unreadable"],
          notes: ["Harga marketplace perlu review manual."],
        },
      }),
    ),
  );

  expect(parsed.price_text).toBe("");
  expect(parsed.extraction_quality.review_required).toBe(true);
  expect(parsed.extraction_quality.blocking_flags).toEqual(["price_unreadable"]);
  expect(parsed.ocr_evidence.shopee_screenshot.quality_flags).toEqual(["cropped", "price_unreadable"]);
});

test("intake vision output does not fabricate visible attributes or confidence notes", () => {
  const parsed = parseIntakeVisionOutput(
    JSON.stringify({
      nama_produk: "Tas selempang",
      keyword_cari_etalase: "Tas",
      deskripsi_visual: "Tas compact untuk mobile.",
      use_case: "Harian",
      pain_point: "Berat",
      selling_angle: "Ringan",
      target_viewer: "Wanita aktif",
      product_title: "Tas selempang premium",
      marketplace: "Shopee",
      category: "Fashion",
      rating_text: "4.9",
      sold_count_text: "120",
      price_text: "Rp99.000",
      shop_name: "Toko A",
      visible_product_attributes: [],
      risk_notes: [],
      confidence_notes: [],
    }),
  );

  expect(parsed.visible_product_attributes).toEqual([]);
  expect(parsed.confidence_notes).toEqual([]);
  expect(parsed.extraction_quality.review_required).toBe(true);
  expect(parsed.extraction_quality.blocking_flags).toContain("legacy_ocr_contract");
});
