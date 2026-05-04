import { expect, test } from "@playwright/test";
import { parseIntakeVisionOutput } from "../../src/lib/intake/vision-contract";

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
