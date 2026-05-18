import { expect, test } from "@playwright/test";
import {
  applyBulkImportPreviewStatus,
  parseBulkImportCsv,
  parseBulkImportRows,
} from "../../src/lib/bulk-import/parser-core";

test("Shopee CSS scraper CSV maps detail rows as ready import rows", () => {
  const csv = [
    [
      "contents href",
      "_image_yazkc_11 src",
      "_image_yazkc_11 src (2)",
      "whitespace-normal",
      "mr-0_5 src",
      "truncate",
      "text-shopee-primary",
      "pointer-events-none src",
      "truncate (2)",
      "text-shopee-black87",
      "truncate (3)",
      "pointer-events-none src (2)",
      "w-auto src",
      "text-sp10",
      "ml-[3px]",
      "opacity-0 href",
      "pointer-events-none src (3)",
    ].join(","),
    [
      "https://shopee.co.id/Test-Produk-i.932528254.29260633950?sp_atk=abc",
      "https://down-id.img.susercontent.com/file/id-11134207-product",
      "https://down-id.img.susercontent.com/file/id-11134258-secondary",
      "Test Produk Shopee",
      "https://deo.shopeemobile.com/badge.png",
      "139.885",
      "-30%",
      "https://deo.shopeemobile.com/local.png",
      "Pilih Lokal",
      "4.9",
      "1RB+ Terjual/ Bulan",
      "https://deo.shopeemobile.com/icon.svg",
      "https://deo.shopeemobile.com/icon2.svg",
      "Besok",
      "Kab. Tangerang",
      "https://shopee.co.id/find_similar_products?catid=100011&itemid=29260633950&shopid=932528254",
      "",
    ].join(","),
  ].join("\n");

  const parsed = parseBulkImportRows(parseBulkImportCsv(csv));
  const preview = applyBulkImportPreviewStatus(parsed, new Set());

  expect(preview).toHaveLength(1);
  expect(preview[0]).toMatchObject({
    status: "ready",
    productName: "Test Produk Shopee",
    productUrl: "https://shopee.co.id/Test-Produk-i.932528254.29260633950",
    imageUrl: "https://down-id.img.susercontent.com/file/id-11134207-product",
    marketplaceLabel: "Shopee",
    platform: "SHOPEE",
    sourceDomain: "shopee.co.id",
  });
  expect(preview[0].optional).toMatchObject({
    discountText: "-30%",
    priceText: "Rp 139.885",
    ratingText: "4.9",
    soldCountText: "1RB+ Terjual/ Bulan",
  });
  expect(preview[0].productUrl).not.toContain("find_similar_products");
});

test("Shopee web scraper XLSX shape is skipped when it only has a search URL", () => {
  const rows = [
    [
      "web_scraper_order",
      "web_scraper_start_url",
      "pagination",
      "data",
      "name",
      "data2",
      "data3",
      "data4",
      "data5",
      "data6",
      "data7",
      "data8",
      "data9",
      "data10",
      "image",
      "image2",
    ],
    [
      "1779073574-1",
      "https://shopee.co.id/search?keyword=kemeja%20linen%20pria",
      "",
      "109.000",
      "Cozyclub Linen Long Sleeve Shirt Pria Premium",
      "10RB+ Terjual",
      "-58%",
      "Jakarta Barat",
      "4.9",
      "Pilih Lokal",
      "",
      "2-3 Hari",
      "Rp",
      "Produk Serupa",
      "https://down-id.img.susercontent.com/file/id-11134207-product@resize_w640_nl",
      "https://down-id.img.susercontent.com/file/id-11134258-secondary",
    ],
  ];

  const parsed = parseBulkImportRows(rows);
  const preview = applyBulkImportPreviewStatus(parsed, new Set());

  expect(preview).toHaveLength(1);
  expect(preview[0]).toMatchObject({
    status: "skipped",
    productName: "Cozyclub Linen Long Sleeve Shirt Pria Premium",
    productUrl: "",
    imageUrl: "https://down-id.img.susercontent.com/file/id-11134207-product@resize_w640_nl",
    marketplaceLabel: "Shopee",
    platform: "SHOPEE",
    sourceDomain: "shopee.co.id",
  });
  expect(preview[0].errors).toContain("URL Produk Shopee tidak tersedia atau bukan URL detail produk.");
  expect(preview[0].optional).toMatchObject({
    discountText: "-58%",
    priceText: "Rp 109.000",
    ratingText: "4.9",
    soldCountText: "10RB+ Terjual",
  });
});

test("canonical bulk import headers remain supported and dedupe by normalized URL", () => {
  const rows = [
    ["Product Name", "Product URL", "Product Image", "Price"],
    [
      "Kemeja Linen",
      "https://shopee.co.id/Kemeja-Linen-i.111.222?sp_atk=tracking",
      "https://down-id.img.susercontent.com/file/id-11134207-kemeja",
      "99.000",
    ],
    [
      "Kemeja Linen Duplicate",
      "https://shopee.co.id/Kemeja-Linen-i.111.222?xptdk=tracking",
      "https://down-id.img.susercontent.com/file/id-11134207-kemeja-2",
      "99.000",
    ],
  ];

  const parsed = parseBulkImportRows(rows);
  const preview = applyBulkImportPreviewStatus(parsed, new Set());

  expect(preview[0]).toMatchObject({
    status: "ready",
    productUrl: "https://shopee.co.id/Kemeja-Linen-i.111.222",
  });
  expect(preview[1]).toMatchObject({
    status: "duplicate",
    productUrl: "https://shopee.co.id/Kemeja-Linen-i.111.222",
  });
});
