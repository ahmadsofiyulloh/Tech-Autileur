// Share platform constants and metadata

export const SHARE_PLATFORMS = ["facebook", "threads", "x", "pinterest"] as const;

export type SharePlatform = (typeof SHARE_PLATFORMS)[number];

export function isSharePlatform(value: unknown): value is SharePlatform {
  return typeof value === "string" && SHARE_PLATFORMS.includes(value as SharePlatform);
}

export const SHARE_PLATFORM_LABELS: Record<SharePlatform, string> = {
  facebook: "Facebook",
  threads: "Threads",
  x: "X",
  pinterest: "Pinterest",
};

export const SHARE_PLATFORM_ICONS: Record<SharePlatform, string> = {
  facebook: "/share-platform-facebook.svg",
  threads: "/share-platform-threads.svg",
  x: "/share-platform-x.svg",
  pinterest: "/share-platform-pinterest.svg",
};

export const SHARE_PLATFORM_VISUALS: Record<SharePlatform, string> = {
  facebook: "/share-platform/facebook.svg",
  threads: "/share-platform/threads.svg",
  x: "/share-platform/x.svg",
  pinterest: "/share-platform/pinterest.svg",
};

export const SHARE_PLATFORM_DESCRIPTIONS: Record<SharePlatform, string> = {
  facebook: "Caption & post untuk Facebook.",
  threads: "Konten pendek untuk Threads.",
  x: "Tweet & thread untuk X.",
  pinterest: "Pin description & caption.",
};

export const SHARE_ANGLES = [
  "benefit_focused",
  "problem_solution",
  "social_proof",
  "urgency_scarcity",
  "educational",
  "storytelling",
] as const;

export type ShareAngle = (typeof SHARE_ANGLES)[number];

export function isShareAngle(value: unknown): value is ShareAngle {
  return typeof value === "string" && SHARE_ANGLES.includes(value as ShareAngle);
}

export const SHARE_ANGLE_LABELS: Record<ShareAngle, string> = {
  benefit_focused: "Fokus Manfaat",
  problem_solution: "Solusi Masalah",
  social_proof: "Bukti Sosial",
  urgency_scarcity: "Urgensi & Kelangkaan",
  educational: "Edukatif",
  storytelling: "Cerita",
};

export const SHARE_VARIANT_COUNT_MIN = 1;
export const SHARE_VARIANT_COUNT_MAX = 4;

export function normalizeShareVariantCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isInteger(parsed)) {
    return SHARE_VARIANT_COUNT_MIN;
  }

  return Math.min(Math.max(parsed, SHARE_VARIANT_COUNT_MIN), SHARE_VARIANT_COUNT_MAX);
}

// ---------------------------------------------------------------------------
// Per-platform prompt blocks — rich structural guidance for Gemini prompt
// ---------------------------------------------------------------------------

export const platformPromptBlocks: Record<SharePlatform, string> = {
  facebook: `PLATFORM: Facebook
- Panjang optimal: 150-500 karakter untuk engagement; long-form (hingga 1000 chars) untuk storytelling
- Struktur: Hook kuat (125 chars pertama terlihat sebelum "Lihat selengkapnya") → Body cerita → CTA
- Link: Taruh link affiliate di AKHIR caption atau sarankan "link di komentar"
- Tone: Conversational, jujur, seperti cerita teman ke teman
- Emoji: 2-4 sebagai visual anchor, jangan berlebihan
- Hashtag: 1-3 yang sangat relevan, atau tidak sama sekali
- Hindari: engagement bait ("like kalau setuju"), klaim berlebihan, hard selling
- Optimasi untuk: komentar dan share (bukan sekadar like)`,

  threads: `PLATFORM: Meta Threads
- Panjang MAKSIMAL: 500 karakter — jangan melebihi ini
- Panjang optimal: 80-200 karakter (conversation-starter)
- Struktur: Satu ide kuat → pertanyaan atau hot take → link di akhir (opsional)
- Tone: Casual, seperti ngobrol di grup chat, santai tapi berisi
- Format: Satu paragraf pendek, atau 2-3 baris dengan line break
- Link: Boleh di akhir, tapi value harus ada di caption itu sendiri
- Hindari: essay panjang, hard selling, banyak hashtag
- Optimasi untuk: replies dan conversation depth`,

  x: `PLATFORM: X (Twitter)
- Panjang MAKSIMAL tweet utama: 280 karakter — ini batas keras
- ATURAN KRITIS: JANGAN taruh link affiliate di tweet utama (reach turun 50-90%)
- Struktur WAJIB:
  * Tweet utama: Hook/value tanpa link (max 280 chars)
  * Field reply_with_link: CTA pendek + link affiliate (untuk di-post sebagai reply pertama)
- Tone: Punchy, opinionated, information-dense, langsung ke inti
- Emoji: 0-2 maksimal, sebagai bullet point atau penekanan
- Hashtag: 0-2 yang sangat relevan
- Hook patterns yang works: hot take, data point, pertanyaan provokatif, "aku udah test X dan..."
- Optimasi untuk: repost dan bookmark (bukan like)`,

  pinterest: `PLATFORM: Pinterest
- Pinterest adalah SEARCH ENGINE visual, bukan social media biasa
- Panjang title: maksimal 100 karakter (30-35 chars pertama terlihat di feed)
- Panjang description: 100-200 karakter optimal (max 500)
- Struktur: Keyword utama di kalimat pertama → benefit spesifik → CTA
- Tone: Aspirational, helpful, solution-oriented — bukan conversational
- SEO WAJIB: Masukkan 2-3 keyword relevan secara natural di description
- Link: Link affiliate langsung di pin URL — ini adalah inti dari Pinterest
- Format title: "[Keyword Utama] - [Benefit Spesifik]"
- Hindari: bahasa percakapan, hashtag (tidak efektif di Pinterest), klaim tanpa detail
- Optimasi untuk: saves dan clicks dari search`,
};

// ---------------------------------------------------------------------------
// Per-angle hook patterns — opening examples and guidance for Gemini prompt
// ---------------------------------------------------------------------------

export const angleHookPatterns: Record<ShareAngle, string> = {
  benefit_focused: `Angle: Benefit Focused
- Fokus ke manfaat utama yang langsung terasa oleh pembeli
- Opening patterns: "Yang bikin [produk] ini beda adalah...", "[Produk] ini solve [masalah] dalam [waktu]"
- Jangan daftar semua fitur — pilih 1-2 benefit paling relevan
- Sertakan hasil konkret jika ada ("kulit lebih cerah dalam 2 minggu")`,

  problem_solution: `Angle: Problem-Solution
- Mulai dari masalah harian yang relatable, lalu arahkan ke solusi
- Opening patterns: "Capek [masalah]?", "Pernah ngerasa [pain point]?", "Masalah [X] itu nyata..."
- Bangun empati dulu sebelum promosi
- Transisi natural: "Nah, aku nemu solusinya..."`,

  social_proof: `Angle: Social Proof
- Tampilkan alasan produk ini layak dipercaya berdasarkan pengalaman nyata
- Opening patterns: "Udah [X] bulan pake dan...", "Temen-temen pada nanya apa rahasianya..."
- Gunakan angka spesifik jika ada
- Bahasa jujur: "jujur awalnya skeptis, tapi..."`,

  urgency_scarcity: `Angle: Urgency/Scarcity
- Tekankan momentum tanpa klaim stok palsu atau manipulatif
- Opening patterns: "Harga ini nggak bakal lama...", "Lagi ada promo sampai [waktu]"
- Hanya gunakan urgency yang NYATA — jangan fabrikasi
- Soft urgency lebih dipercaya: "kalau lagi cari [produk], sekarang timing yang bagus"`,

  educational: `Angle: Educational
- Beri konteks edukatif yang membantu pembeli membuat keputusan lebih baik
- Opening patterns: "Tau nggak bedanya [A] vs [B]?", "Sebelum beli [kategori], perhatikan ini..."
- Posisikan diri sebagai teman yang helpful, bukan sales
- CTA natural: "kalau mau coba yang aku pake, link ada di..."`,

  storytelling: `Angle: Storytelling
- Buka dengan cerita pendek seputar pemakaian produk — jujur, manusiawi
- Opening patterns: "Jujur, awalnya aku skeptis...", "Cerita dikit, [situasi yang relatable]..."
- Story arc: situasi → masalah → discovery → hasil
- Bahasa sederhana, seperti ngobrol — hindari bahasa iklan
- Boleh sedikit kontroversial atau clickbait di kalimat pertama untuk menarik perhatian`,
};

// ---------------------------------------------------------------------------
// Character limits per platform (for post-generation validation)
// ---------------------------------------------------------------------------

export const PLATFORM_CHAR_LIMITS: Record<SharePlatform, number> = {
  facebook: 63206,
  threads: 500,
  x: 280,
  pinterest: 500,
};

// Per-block limits that are independent of the main caption platform limit.
export const PIN_TITLE_CHAR_LIMIT = 100;
export const X_REPLY_CHAR_LIMIT = 280;

export type CharStatus = "ok" | "warning" | "over";

// ---------------------------------------------------------------------------
// Per-platform generate options — typed contract for form → server action
// ---------------------------------------------------------------------------

export type FacebookGenerateOptions = {
  platform: "facebook";
  postMode: "feed" | "story" | "reel";
  captionLength: "short" | "medium" | "long";
  includeFirstComment: boolean;
  includeImagePrompt: boolean;
  imageRatio: "1:1" | "4:5" | "16:9" | "9:16";
};

export type ThreadsGenerateOptions = {
  platform: "threads";
  mode: "single" | "thread";
  linkPlacement: "in_caption" | "first_reply" | "none";
  imagePlacement: "with_post" | "none";
  imageRatio: "1:1" | "4:5" | "9:16";
};

export type XGenerateOptions = {
  platform: "x";
  mode: "single_tweet" | "thread";
  lengthMode: "punchy" | "standard";
  linkPlacement: "reply" | "none";
  includeImagePrompt: boolean;
  imageRatio: "1:1" | "16:9";
};

export type PinterestGenerateOptions = {
  platform: "pinterest";
  pinType: "standard" | "idea";
  seoKeywordMode: "auto" | "manual";
  seoKeyword: string;
  ctaStyle: "soft" | "direct";
  includeImagePrompt: boolean;
  imageRatio: "2:3" | "1:1";
  generateAltText: boolean;
};

export type ShareGenerateOptions =
  | FacebookGenerateOptions
  | ThreadsGenerateOptions
  | XGenerateOptions
  | PinterestGenerateOptions;

export const DEFAULT_SHARE_GENERATE_OPTIONS: {
  facebook: FacebookGenerateOptions;
  threads: ThreadsGenerateOptions;
  x: XGenerateOptions;
  pinterest: PinterestGenerateOptions;
} = {
  facebook: {
    platform: "facebook",
    postMode: "feed",
    captionLength: "medium",
    includeFirstComment: false,
    includeImagePrompt: false,
    imageRatio: "4:5",
  },
  threads: {
    platform: "threads",
    mode: "single",
    linkPlacement: "in_caption",
    imagePlacement: "with_post",
    imageRatio: "1:1",
  },
  x: {
    platform: "x",
    mode: "single_tweet",
    lengthMode: "punchy",
    linkPlacement: "reply",
    includeImagePrompt: false,
    imageRatio: "16:9",
  },
  pinterest: {
    platform: "pinterest",
    pinType: "standard",
    seoKeywordMode: "auto",
    seoKeyword: "",
    ctaStyle: "soft",
    includeImagePrompt: false,
    imageRatio: "2:3",
    generateAltText: false,
  },
};

export function getDefaultShareGenerateOptions(platform: SharePlatform): ShareGenerateOptions {
  return DEFAULT_SHARE_GENERATE_OPTIONS[platform];
}

/**
 * Normalize raw (unknown) options input into a typed ShareGenerateOptions for
 * the given platform. Falls back to defaults for any missing or invalid field.
 * Safe to call with untrusted input (e.g., parsed FormData JSON).
 */
export function normalizeShareGenerateOptions(
  platform: SharePlatform,
  raw: unknown,
): ShareGenerateOptions {
  const defaults = DEFAULT_SHARE_GENERATE_OPTIONS[platform];

  if (typeof raw !== "object" || raw === null) {
    return defaults;
  }

  const r = raw as Record<string, unknown>;

  if (platform === "facebook") {
    const d = defaults as FacebookGenerateOptions;
    return {
      platform: "facebook",
      postMode: (["feed", "story", "reel"] as const).includes(r.postMode as FacebookGenerateOptions["postMode"])
        ? (r.postMode as FacebookGenerateOptions["postMode"])
        : d.postMode,
      captionLength: (["short", "medium", "long"] as const).includes(r.captionLength as FacebookGenerateOptions["captionLength"])
        ? (r.captionLength as FacebookGenerateOptions["captionLength"])
        : d.captionLength,
      includeFirstComment: typeof r.includeFirstComment === "boolean" ? r.includeFirstComment : d.includeFirstComment,
      includeImagePrompt: typeof r.includeImagePrompt === "boolean" ? r.includeImagePrompt : d.includeImagePrompt,
      imageRatio: (["1:1", "4:5", "16:9", "9:16"] as const).includes(r.imageRatio as FacebookGenerateOptions["imageRatio"])
        ? (r.imageRatio as FacebookGenerateOptions["imageRatio"])
        : d.imageRatio,
    };
  }

  if (platform === "threads") {
    const d = defaults as ThreadsGenerateOptions;
    return {
      platform: "threads",
      mode: (["single", "thread"] as const).includes(r.mode as ThreadsGenerateOptions["mode"])
        ? (r.mode as ThreadsGenerateOptions["mode"])
        : d.mode,
      linkPlacement: (["in_caption", "first_reply", "none"] as const).includes(r.linkPlacement as ThreadsGenerateOptions["linkPlacement"])
        ? (r.linkPlacement as ThreadsGenerateOptions["linkPlacement"])
        : d.linkPlacement,
      imagePlacement: (["with_post", "none"] as const).includes(r.imagePlacement as ThreadsGenerateOptions["imagePlacement"])
        ? (r.imagePlacement as ThreadsGenerateOptions["imagePlacement"])
        : d.imagePlacement,
      imageRatio: (["1:1", "4:5", "9:16"] as const).includes(r.imageRatio as ThreadsGenerateOptions["imageRatio"])
        ? (r.imageRatio as ThreadsGenerateOptions["imageRatio"])
        : d.imageRatio,
    };
  }

  if (platform === "x") {
    const d = defaults as XGenerateOptions;
    return {
      platform: "x",
      mode: (["single_tweet", "thread"] as const).includes(r.mode as XGenerateOptions["mode"])
        ? (r.mode as XGenerateOptions["mode"])
        : d.mode,
      lengthMode: (["punchy", "standard"] as const).includes(r.lengthMode as XGenerateOptions["lengthMode"])
        ? (r.lengthMode as XGenerateOptions["lengthMode"])
        : d.lengthMode,
      linkPlacement: (["reply", "none"] as const).includes(r.linkPlacement as XGenerateOptions["linkPlacement"])
        ? (r.linkPlacement as XGenerateOptions["linkPlacement"])
        : d.linkPlacement,
      includeImagePrompt: typeof r.includeImagePrompt === "boolean" ? r.includeImagePrompt : d.includeImagePrompt,
      imageRatio: (["1:1", "16:9"] as const).includes(r.imageRatio as XGenerateOptions["imageRatio"])
        ? (r.imageRatio as XGenerateOptions["imageRatio"])
        : d.imageRatio,
    };
  }

  // pinterest
  const d = defaults as PinterestGenerateOptions;
  return {
    platform: "pinterest",
    pinType: (["standard", "idea"] as const).includes(r.pinType as PinterestGenerateOptions["pinType"])
      ? (r.pinType as PinterestGenerateOptions["pinType"])
      : d.pinType,
    seoKeywordMode: (["auto", "manual"] as const).includes(r.seoKeywordMode as PinterestGenerateOptions["seoKeywordMode"])
      ? (r.seoKeywordMode as PinterestGenerateOptions["seoKeywordMode"])
      : d.seoKeywordMode,
    seoKeyword: typeof r.seoKeyword === "string" ? r.seoKeyword.trim().slice(0, 100) : d.seoKeyword,
    ctaStyle: (["soft", "direct"] as const).includes(r.ctaStyle as PinterestGenerateOptions["ctaStyle"])
      ? (r.ctaStyle as PinterestGenerateOptions["ctaStyle"])
      : d.ctaStyle,
    includeImagePrompt: typeof r.includeImagePrompt === "boolean" ? r.includeImagePrompt : d.includeImagePrompt,
    imageRatio: (["2:3", "1:1"] as const).includes(r.imageRatio as PinterestGenerateOptions["imageRatio"])
      ? (r.imageRatio as PinterestGenerateOptions["imageRatio"])
      : d.imageRatio,
    generateAltText: typeof r.generateAltText === "boolean" ? r.generateAltText : d.generateAltText,
  };
}

/**
 * Evaluate a character count against a recommended limit.
 * Returns "over" when above the limit, "warning" at >= 90% of the limit,
 * and "ok" otherwise.
 */
export function evaluateCharStatus(count: number, limit: number): CharStatus {
  if (limit <= 0) return "ok";
  if (count > limit) return "over";
  if (count >= Math.floor(limit * 0.9)) return "warning";
  return "ok";
}

// ---------------------------------------------------------------------------
// SHARE-V1-005: Structured output blocks contract
// ---------------------------------------------------------------------------

export const SHARE_CAPTION_BLOCK_ROLES = [
  "main_caption",
  "first_comment",
  "thread_section",
  "x_reply_with_link",
  "pinterest_pin_title",
  "pinterest_pin_description",
  "pinterest_destination_link",
  "pinterest_alt_text",
  "hashtags",
] as const;

export type ShareCaptionBlockRole = (typeof SHARE_CAPTION_BLOCK_ROLES)[number];

export interface ShareCaptionBlock {
  role: ShareCaptionBlockRole;
  label: string;
  content: string;
  char_count: number;
  recommended_max_chars: number;
  copy_ready: boolean;
  warning?: string;
}

/**
 * Recommended character limits per block role.
 * Used for validation and UI feedback.
 */
export const RECOMMENDED_BLOCK_LIMITS: Record<ShareCaptionBlockRole, number> = {
  main_caption: 500,
  first_comment: 500,
  thread_section: 280,
  x_reply_with_link: 280,
  pinterest_pin_title: 100,
  pinterest_pin_description: 500,
  pinterest_destination_link: 2048,
  pinterest_alt_text: 500,
  hashtags: 200,
};

// ---------------------------------------------------------------------------
// SHARE-V1-006: Image prompt output contract
// ---------------------------------------------------------------------------

export interface ShareImagePromptBlock {
  source: "i2i";
  image_inputs: string[];
  prompt_text: string;
  must_keep: string[];
  must_avoid: string[];
  aspect_ratio: string;
  upload_note: string;
}

/**
 * Extended variant type with optional structured blocks and image prompt.
 * Backward compatible: old variants only have caption/angle/platform/platform_specific_fields.
 */
export interface ShareCaptionVariantV2 {
  caption: string;
  angle: ShareAngle;
  platform: SharePlatform;
  platform_specific_fields?: {
    reply_with_link?: string;
    pin_title?: string;
    hashtags?: string;
  };
  blocks?: ShareCaptionBlock[];
  image_prompt?: ShareImagePromptBlock;
}

/**
 * Type guard: check if a variant has the new structured blocks field.
 */
export function hasStructuredBlocks(variant: ShareCaptionVariantV2): variant is ShareCaptionVariantV2 & { blocks: ShareCaptionBlock[] } {
  return Array.isArray(variant.blocks) && variant.blocks.length > 0;
}

/**
 * Type guard: check if a variant has an image prompt.
 */
export function hasImagePrompt(variant: ShareCaptionVariantV2): variant is ShareCaptionVariantV2 & { image_prompt: ShareImagePromptBlock } {
  return variant.image_prompt !== undefined && variant.image_prompt !== null;
}

/**
 * Backward-compatible helper: derive structured blocks from old-format variant.
 * If variant already has blocks, pass through. Otherwise, build from caption + platform_specific_fields.
 */
export function buildShareOutputBlocks(variant: ShareCaptionVariantV2, platform: SharePlatform): ShareCaptionBlock[] {
  if (hasStructuredBlocks(variant)) {
    return variant.blocks;
  }

  // Old format: derive blocks from caption and platform_specific_fields
  const blocks: ShareCaptionBlock[] = [];
  const caption = variant.caption.trim();
  const psf = variant.platform_specific_fields;

  // Main caption block (all platforms)
  blocks.push({
    role: "main_caption",
    label: "Caption",
    content: caption,
    char_count: caption.length,
    recommended_max_chars: RECOMMENDED_BLOCK_LIMITS.main_caption,
    copy_ready: true,
  });

  // Platform-specific blocks from old platform_specific_fields
  if (platform === "x" && psf?.reply_with_link) {
    const replyContent = psf.reply_with_link.trim();
    blocks.push({
      role: "x_reply_with_link",
      label: "Reply dengan Link",
      content: replyContent,
      char_count: replyContent.length,
      recommended_max_chars: RECOMMENDED_BLOCK_LIMITS.x_reply_with_link,
      copy_ready: true,
    });
  }

  if (platform === "pinterest" && psf?.pin_title) {
    const titleContent = psf.pin_title.trim();
    blocks.push({
      role: "pinterest_pin_title",
      label: "Pin Title",
      content: titleContent,
      char_count: titleContent.length,
      recommended_max_chars: RECOMMENDED_BLOCK_LIMITS.pinterest_pin_title,
      copy_ready: true,
    });
  }

  if (psf?.hashtags) {
    const hashtagContent = psf.hashtags.trim();
    blocks.push({
      role: "hashtags",
      label: "Hashtags",
      content: hashtagContent,
      char_count: hashtagContent.length,
      recommended_max_chars: RECOMMENDED_BLOCK_LIMITS.hashtags,
      copy_ready: true,
    });
  }

  return blocks;
}
