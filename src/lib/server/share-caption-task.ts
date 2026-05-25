import "server-only";

import type { GeminiModelName } from "@/lib/gemini/validation";
import { GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA } from "@/lib/gemini/json-schemas";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { GeminiClientError } from "@/lib/server/gemini-client";
import { logDiagnostic } from "@/lib/server/diagnostic-logging";
import {
  listQuotaAwareGeminiKeys,
  markGeminiKeySuccess,
  markGeminiQuotaGroupCooldown,
  markGeminiQuotaGroupError,
  getGeminiQuotaGroupKey,
} from "@/lib/server/gemini-key-routing";
import { readGeminiSecretForKey, getGeminiSecretRotationErrorMessage } from "@/lib/server/gemini-secret";
import { generateTrackedGeminiJsonText } from "@/lib/server/gemini-usage-events";
import {
  type SharePlatform,
  type ShareAngle,
  type ShareGenerateOptions,
  platformPromptBlocks,
  angleHookPatterns,
  PLATFORM_CHAR_LIMITS,
  RECOMMENDED_BLOCK_LIMITS,
} from "@/lib/share/share-platform";

type ShareCaptionTaskInput = {
  generationId: string;
  productId: string;
  productName: string;
  affiliateUrl: string;
  platform: SharePlatform;
  angle: ShareAngle;
  variantCount: number;
  inputParams?: ShareGenerateOptions | null;
  // SHARE-V1-008: optional product context fields. All optional/nullable;
  // missing fields fall back gracefully (prompt simply omits the line).
  productMarketplace?: string | null;
  productNiche?: string | null;
  productMetadata?: Record<string, unknown> | null;
};

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceRoleClient>;

type ShareCaptionBlock = {
  role: string;
  label: string;
  content: string;
  char_count: number;
  recommended_max_chars: number;
  copy_ready: boolean;
  warning?: string;
};

type ShareImagePromptBlock = {
  source: "i2i";
  image_inputs: string[];
  prompt_text: string;
  must_keep: string[];
  must_avoid: string[];
  aspect_ratio: string;
  upload_note: string;
};

type ShareCaptionVariant = {
  caption: string;
  angle: ShareAngle;
  platform: SharePlatform;
  platform_specific_fields?: Record<string, unknown>;
  blocks?: ShareCaptionBlock[];
  image_prompt?: ShareImagePromptBlock;
};

type ShareCaptionResponse = {
  variants: ShareCaptionVariant[];
};

function buildShareCaptionPrompt(input: ShareCaptionTaskInput): string {
  const platformBlock = platformPromptBlocks[input.platform];
  const anglePattern = angleHookPatterns[input.angle];
  const opts = input.inputParams;

  const platformSpecificInstruction = input.platform === "x"
    ? `PENTING: Untuk X, field "caption" adalah tweet utama (max 280 chars, TANPA link).
       Field "platform_specific_fields.reply_with_link" WAJIB diisi dengan CTA + link affiliate.`
    : input.platform === "pinterest"
    ? `PENTING: Untuk Pinterest, field "platform_specific_fields.pin_title" WAJIB diisi (max 100 chars, keyword-first).
       Caption adalah description pin (100-200 chars, SEO-optimized).`
    : `Sertakan link affiliate di akhir caption.`;

  // ---------------------------------------------------------------
  // SHARE-V1-005 + SHARE-V1-006: structured blocks + image_prompt
  // ---------------------------------------------------------------

  // Determine which blocks are required for this platform/options combo.
  const blockRules: string[] = [];
  blockRules.push(`- WAJIB: blok "main_caption" — isi sama dengan field "caption" (untuk konsistensi).`);

  if (input.platform === "facebook") {
    const fbOpts = opts && opts.platform === "facebook" ? opts : null;
    if (fbOpts?.includeFirstComment) {
      blockRules.push(`- WAJIB: blok "first_comment" — first comment yang akan di-post setelah main caption (link affiliate boleh di sini).`);
    }
  }

  if (input.platform === "threads") {
    const threadsOpts = opts && opts.platform === "threads" ? opts : null;
    if (threadsOpts?.mode === "thread") {
      blockRules.push(`- WAJIB: 2-5 blok "thread_section" — setiap blok adalah satu thread post (max 500 chars per blok).`);
    }
  }

  if (input.platform === "x") {
    const xOpts = opts && opts.platform === "x" ? opts : null;
    if (xOpts?.mode === "thread") {
      blockRules.push(`- WAJIB: 3-7 blok "thread_section" — setiap blok adalah satu tweet dalam thread (max 280 chars per blok).`);
    }
    if (xOpts?.linkPlacement === "reply") {
      blockRules.push(`- WAJIB: blok "x_reply_with_link" — CTA + link affiliate yang akan di-post sebagai reply ke tweet utama.`);
    }
  }

  if (input.platform === "pinterest") {
    blockRules.push(`- WAJIB: blok "pinterest_pin_title" — judul pin (max 100 chars, keyword-first).`);
    blockRules.push(`- WAJIB: blok "pinterest_pin_description" — description pin (100-200 chars optimal, SEO-optimized).`);
    blockRules.push(`- WAJIB: blok "pinterest_destination_link" — content = link affiliate sebagai destinasi pin.`);
    const pinOpts = opts && opts.platform === "pinterest" ? opts : null;
    if (pinOpts?.generateAltText) {
      blockRules.push(`- WAJIB: blok "pinterest_alt_text" — alt text deskriptif untuk accessibility (max 500 chars).`);
    }
  }

  // Determine if image_prompt is required.
  let imagePromptRequired = false;
  let imageRatio: string | undefined;
  if (input.platform === "facebook" && opts?.platform === "facebook" && opts.includeImagePrompt) {
    imagePromptRequired = true;
    imageRatio = opts.imageRatio;
  } else if (input.platform === "x" && opts?.platform === "x" && opts.includeImagePrompt) {
    imagePromptRequired = true;
    imageRatio = opts.imageRatio;
  } else if (input.platform === "pinterest" && opts?.platform === "pinterest") {
    imagePromptRequired = true; // Pinterest always requires image prompt
    imageRatio = opts.imageRatio;
  }

  const imagePromptInstruction = imagePromptRequired
    ? `

IMAGE PROMPT (WAJIB):
Field "image_prompt" WAJIB diisi dengan disiplin i2i (image-to-image):
- "source": "i2i" (selalu)
- "image_inputs": daftar foto produk yang harus di-upload sebagai referensi (contoh: ["foto utama produk", "foto detail kemasan"])
- "prompt_text": instruksi visual untuk model i2i. Fokus ke staging/lighting/komposisi, BUKAN modifikasi produk
- "must_keep": elemen yang HARUS dipertahankan dari foto sumber (contoh: ["warna asli produk", "bentuk kemasan", "tanda merek pada label"])
- "must_avoid": WAJIB sertakan minimal: ["text overlay", "price label", "discount badge", "fake logo", "fake UI", "unsupported claims", "perubahan bentuk produk"]
- "aspect_ratio": "${imageRatio ?? "1:1"}"
- "upload_note": catatan singkat untuk operator (contoh: "Upload foto produk dari angle utama dengan latar bersih")

ATURAN PROMPT IMAGE:
- JANGAN minta text overlay, price label, discount badge, atau fake logo di gambar
- JANGAN minta perubahan bentuk/warna produk yang tidak ada di foto asli
- JANGAN klaim visual yang tidak didukung produk (contoh: "before/after" tanpa data)
- Fokus ke: pencahayaan natural, komposisi rapi, latar yang relevan dengan produk`
    : "";

  // ---------------------------------------------------------------

  // SHARE-V1-008: Build optional product context block from available metadata.
  const contextLines: string[] = [];
  if (input.productMarketplace) {
    contextLines.push(`- Marketplace: ${input.productMarketplace}`);
  }
  if (input.productNiche) {
    contextLines.push(`- Niche: ${input.productNiche}`);
  }

  const meta = input.productMetadata;
  if (meta && typeof meta === "object") {
    const safeStr = (key: string): string | null => {
      const val = (meta as Record<string, unknown>)[key];
      return typeof val === "string" && val.trim().length > 0 ? val.trim() : null;
    };

    const category = safeStr("category");
    if (category) contextLines.push(`- Kategori: ${category}`);

    const useCase = safeStr("use_case");
    if (useCase) contextLines.push(`- Use case: ${useCase}`);

    const painPoint = safeStr("pain_point");
    if (painPoint) contextLines.push(`- Pain point yang dijawab: ${painPoint}`);

    const sellingAngle = safeStr("selling_angle");
    if (sellingAngle) contextLines.push(`- Selling angle: ${sellingAngle}`);

    const targetViewer = safeStr("target_viewer");
    if (targetViewer) contextLines.push(`- Target audience: ${targetViewer}`);

    const deskripsiVisual = safeStr("deskripsi_visual");
    if (deskripsiVisual) contextLines.push(`- Deskripsi visual produk: ${deskripsiVisual}`);

    const keyword = safeStr("keyword_cari_etalase");
    if (keyword) contextLines.push(`- Keyword etalase: ${keyword}`);
  }

  const productContextBlock = contextLines.length > 0
    ? `\nKONTEKS PRODUK (dari metadata yang sudah tersimpan — gunakan sebagai referensi, JANGAN fabrikasi data baru):\n${contextLines.join("\n")}\n`
    : "";

  return `Kamu adalah copywriter affiliate marketing Indonesia yang ahli membuat caption social media yang convert.

GAYA BAHASA WAJIB:
- Bahasa Indonesia natural, seperti manusia biasa ngobrol — bukan bahasa iklan kaku
- Boleh sedikit kontroversial atau clickbait di kalimat pertama untuk menarik perhatian
- Sentuhan storytelling jujur: "jujur", "pengalaman pribadi", "nemu", "akhirnya ketemu"
- Soft CTA: "buat yang penasaran", "yang mau coba", "link ada di..."
- HINDARI: "TERBATAS!", "DISKON GILA!", klaim berlebihan, bahasa robot

PRODUK:
- Nama: ${input.productName}
- Link affiliate: ${input.affiliateUrl}
${productContextBlock}
ATURAN AFFILIATE:
- Affiliate disclosure WAJIB terlihat di caption atau di salah satu blok copy (contoh: "(link affiliate)", "*aff", atau disclosure natural di akhir)
- Affiliate URL adalah CTA/destination link — BUKAN URL sumber produk. Jangan ganti dengan URL marketplace asli.

ATURAN KONTEKS PRODUK:
- Gunakan konteks produk di atas HANYA sebagai referensi untuk membuat caption lebih relevan.
- JANGAN fabrikasi harga, diskon, stok, garansi, klaim medis/tubuh, atau data yang tidak ada di konteks.
- JANGAN klaim fitur atau manfaat yang tidak disebutkan di metadata.
- Jika konteks produk kosong atau minim, buat caption generik yang tetap menarik berdasarkan nama produk saja.

${platformBlock}

${anglePattern}

TUGAS:
Generate ${input.variantCount} varian caption BERBEDA untuk platform ${input.platform} dengan angle ${input.angle}.

${platformSpecificInstruction}

ATURAN BLOK STRUKTURAL (field "blocks"):
Setiap varian WAJIB sertakan field "blocks" — array of structured copy blocks. Setiap blok punya:
- "role": salah satu dari [main_caption, first_comment, thread_section, x_reply_with_link, pinterest_pin_title, pinterest_pin_description, pinterest_destination_link, pinterest_alt_text, hashtags]
- "label": label human-readable singkat (contoh: "Caption", "First Comment", "Reply dengan Link")
- "content": isi copy
- "char_count": jumlah karakter content
- "recommended_max_chars": rekomendasi batas karakter untuk role tersebut
- "copy_ready": true jika siap copy-paste
- "warning": (opsional) peringatan jika ada masalah

Blok WAJIB untuk request ini:
${blockRules.join("\n")}
${imagePromptInstruction}

Setiap varian harus memiliki hook/pembuka yang berbeda — jangan variasi minor dari kalimat yang sama.

Return JSON sesuai schema yang diminta. Field "caption" tetap diisi (untuk backward compat); field "blocks" adalah representasi structural baru.`;
}

function isShareImagePromptRequired(input: ShareCaptionTaskInput) {
  if (input.platform === "facebook" && input.inputParams?.platform === "facebook") {
    return input.inputParams.includeImagePrompt;
  }

  if (input.platform === "x" && input.inputParams?.platform === "x") {
    return input.inputParams.includeImagePrompt;
  }

  return input.platform === "pinterest";
}

function isFacebookFirstCommentRequired(input: ShareCaptionTaskInput) {
  return input.platform === "facebook" && input.inputParams?.platform === "facebook" && input.inputParams.includeFirstComment;
}

function readTrimmedText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => readTrimmedText(item)).filter((item) => item.length > 0)
    : [];
}

function isRecommendedBlockRole(role: string): role is keyof typeof RECOMMENDED_BLOCK_LIMITS {
  return role in RECOMMENDED_BLOCK_LIMITS;
}

function recommendedMaxCharsForRole(role: string) {
  return isRecommendedBlockRole(role) ? RECOMMENDED_BLOCK_LIMITS[role] : 500;
}

function labelForBlockRole(role: string) {
  switch (role) {
    case "first_comment":
      return "First Comment";
    case "thread_section":
      return "Thread";
    case "x_reply_with_link":
      return "Reply dengan Link";
    case "pinterest_pin_title":
      return "Pin Title";
    case "pinterest_pin_description":
      return "Pin Description";
    case "pinterest_destination_link":
      return "Destination Link";
    case "pinterest_alt_text":
      return "Alt Text";
    case "hashtags":
      return "Hashtags";
    case "main_caption":
    default:
      return "Caption";
  }
}

function buildShareCaptionBlock(role: string, label: string, content: string): ShareCaptionBlock {
  const normalizedContent = content.trim();

  return {
    role,
    label,
    content: normalizedContent,
    char_count: normalizedContent.length,
    recommended_max_chars: recommendedMaxCharsForRole(role),
    copy_ready: true,
  };
}

function normalizeCaptionBlock(value: unknown): ShareCaptionBlock | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const block = value as Partial<ShareCaptionBlock>;
  const role = readTrimmedText(block.role);
  const content = readTrimmedText(block.content);

  if (!role || !content) {
    return null;
  }

  const label = readTrimmedText(block.label) || labelForBlockRole(role);
  const recommendedMaxChars =
    typeof block.recommended_max_chars === "number" && Number.isFinite(block.recommended_max_chars) && block.recommended_max_chars > 0
      ? Math.round(block.recommended_max_chars)
      : recommendedMaxCharsForRole(role);
  const warning = readTrimmedText(block.warning);

  return {
    role,
    label,
    content,
    char_count: content.length,
    recommended_max_chars: recommendedMaxChars,
    copy_ready: block.copy_ready !== false,
    ...(warning ? { warning } : {}),
  };
}

function getRequestedImageRatio(input: ShareCaptionTaskInput) {
  if (input.platform === "facebook" && input.inputParams?.platform === "facebook") {
    return input.inputParams.imageRatio;
  }

  if (input.platform === "x" && input.inputParams?.platform === "x") {
    return input.inputParams.imageRatio;
  }

  if (input.platform === "pinterest" && input.inputParams?.platform === "pinterest") {
    return input.inputParams.imageRatio;
  }

  return "1:1";
}

function readProductMetadataText(input: ShareCaptionTaskInput, key: string) {
  return readTrimmedText(input.productMetadata?.[key]);
}

function buildFallbackShareImagePrompt(input: ShareCaptionTaskInput): ShareImagePromptBlock {
  const visualDescription = readProductMetadataText(input, "deskripsi_visual") || input.productName;

  return {
    source: "i2i",
    image_inputs: ["foto utama produk"],
    prompt_text: `Gunakan foto produk "${input.productName}" sebagai referensi utama. Buat visual affiliate yang natural, bersih, dan relevan untuk ${input.platform}. Pertahankan detail produk yang terlihat: ${visualDescription}. Jangan menambah teks, badge harga, logo palsu, atau klaim visual yang tidak ada di foto sumber.`,
    must_keep: ["bentuk produk asli", "warna produk asli", "detail kemasan atau label yang terlihat"],
    must_avoid: ["text overlay", "price label", "discount badge", "fake logo", "fake UI", "unsupported claims", "perubahan bentuk produk"],
    aspect_ratio: getRequestedImageRatio(input),
    upload_note: "Upload foto produk utama sebagai referensi i2i.",
  };
}

function normalizeShareImagePrompt(input: ShareCaptionTaskInput, value: unknown): ShareImagePromptBlock {
  const fallback = buildFallbackShareImagePrompt(input);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const imagePrompt = value as Partial<ShareImagePromptBlock>;
  const promptText = readTrimmedText(imagePrompt.prompt_text) || fallback.prompt_text;
  const aspectRatio = readTrimmedText(imagePrompt.aspect_ratio) || fallback.aspect_ratio;
  const uploadNote = readTrimmedText(imagePrompt.upload_note) || fallback.upload_note;
  const imageInputs = readStringList(imagePrompt.image_inputs);
  const mustKeep = readStringList(imagePrompt.must_keep);
  const mustAvoid = readStringList(imagePrompt.must_avoid);

  return {
    source: "i2i",
    image_inputs: imageInputs.length ? imageInputs : fallback.image_inputs,
    prompt_text: promptText,
    must_keep: mustKeep.length ? mustKeep : fallback.must_keep,
    must_avoid: mustAvoid.length ? mustAvoid : fallback.must_avoid,
    aspect_ratio: aspectRatio,
    upload_note: uploadNote,
  };
}

function normalizeAndValidateShareCaptionResponse(input: ShareCaptionTaskInput, parsed: ShareCaptionResponse) {
  parsed.variants.forEach((variant, index) => {
    const variantLabel = `Variant ${index + 1}`;
    const caption = readTrimmedText(variant.caption);

    if (!caption) {
      throw new Error(`${variantLabel} caption is required.`);
    }

    variant.caption = caption;
    variant.angle = input.angle;
    variant.platform = input.platform;

    const blocks = Array.isArray(variant.blocks)
      ? variant.blocks.map(normalizeCaptionBlock).filter((block): block is ShareCaptionBlock => Boolean(block))
      : [];

    if (!blocks.some((block) => block.role === "main_caption" && block.content.trim().length > 0)) {
      blocks.unshift(buildShareCaptionBlock("main_caption", "Caption", caption));
    }

    if (isFacebookFirstCommentRequired(input) && !blocks.some((block) => block.role === "first_comment" && block.content.trim().length > 0)) {
      blocks.push(
        buildShareCaptionBlock(
          "first_comment",
          "First Comment",
          `Buat yang mau cek detail produk, link affiliate ada di sini:\n${input.affiliateUrl}`,
        ),
      );
    }

    variant.blocks = blocks;

    if (isShareImagePromptRequired(input) || variant.image_prompt) {
      variant.image_prompt = normalizeShareImagePrompt(input, variant.image_prompt);
    }
  });
}

async function failShareCaptionTask(input: {
  errorMessage: string;
  generationId: string;
  serviceClient: SupabaseServiceClient;
  taskId: string;
  userId: string;
}) {
  await input.serviceClient
    .from("share_generations")
    .update({ status: "error", error_message: input.errorMessage })
    .eq("id", input.generationId)
    .eq("user_id", input.userId);

  await input.serviceClient
    .from("ai_tasks")
    .update({ status: "FAILED", error_message: input.errorMessage, finished_at: new Date().toISOString() })
    .eq("id", input.taskId)
    .eq("user_id", input.userId);

  void logDiagnostic({
    userId: input.userId,
    context: "share_generation",
    level: "error",
    message: "Generation failed",
    metadata: { task_id: input.taskId, share_generation_id: input.generationId, error_message: input.errorMessage },
  });
}

function computeShareCaptionMaxTokens(input: ShareCaptionTaskInput): number {
  // Each variant baseline (caption + angle + platform + main_caption block + JSON overhead) ≈ 350 tokens.
  let perVariantTokens = 350;

  const opts = input.inputParams;

  // Image prompt block adds ~250 tokens per variant (i2i schema with arrays).
  if (isShareImagePromptRequired(input)) {
    perVariantTokens += 250;
  }

  if (input.platform === "facebook" && opts?.platform === "facebook") {
    if (opts.includeFirstComment) {
      perVariantTokens += 200;
    }
    // Long captions push main_caption content size further.
    if (opts.captionLength === "long") {
      perVariantTokens += 250;
    } else if (opts.captionLength === "medium") {
      perVariantTokens += 100;
    }
  }

  if (input.platform === "threads" && opts?.platform === "threads" && opts.mode === "thread") {
    // Up to 5 thread_section blocks @ ~120 tokens each.
    perVariantTokens += 600;
  }

  if (input.platform === "x" && opts?.platform === "x") {
    if (opts.mode === "thread") {
      // Up to 7 thread_section blocks @ ~80 tokens each.
      perVariantTokens += 560;
    }
    if (opts.linkPlacement === "reply") {
      perVariantTokens += 80;
    }
  }

  if (input.platform === "pinterest") {
    // pin_title + pin_description + destination_link + (optional alt_text)
    perVariantTokens += 200;
    const pinOpts = opts?.platform === "pinterest" ? opts : null;
    if (pinOpts?.generateAltText) {
      perVariantTokens += 150;
    }
  }

  // Final budget: per-variant cost × variantCount + envelope/safety buffer.
  // Cap at 16384 to stay within Gemini Flash output ceiling.
  const computed = perVariantTokens * input.variantCount + 512;
  return Math.min(Math.max(computed, 2048), 16384);
}


export async function runRealShareCaptionTask(taskId: string, taskInput: ShareCaptionTaskInput) {
  const serviceClient = createSupabaseServiceRoleClient();

  const { data: generation, error: generationError } = await serviceClient
    .from("share_generations")
    .select("user_id")
    .eq("id", taskInput.generationId)
    .maybeSingle();

  if (generationError || !generation) {
    await serviceClient
      .from("ai_tasks")
      .update({
        status: "FAILED",
        error_message: "Generation record not found.",
        finished_at: new Date().toISOString(),
      })
      .eq("id", taskId);
    return;
  }

  const userId = generation.user_id as string;

  void logDiagnostic({
    userId,
    context: "share_generation",
    level: "info",
    message: "Generation started",
    metadata: { task_id: taskId, share_generation_id: taskInput.generationId, platform: taskInput.platform },
  });

  try {
    await serviceClient
      .from("ai_tasks")
      .update({
        status: "RUNNING",
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", taskId)
      .eq("user_id", userId);

    const excludedQuotaGroups = new Set<string>();
    const excludedKeyIds = new Set<string>();
    let attempt = 0;
    const maxAttempts = 5;
    let lastErrorMessage = "Gagal generate caption setelah beberapa percobaan.";
    let sawSecretDecryptionFailure = false;

    while (attempt < maxAttempts) {
      const availableKeys = await listQuotaAwareGeminiKeys({
        userId,
        purpose: "SHARE_CAPTION",
        excludedQuotaGroups,
        excludedKeyIds,
        serviceClient,
      });

      if (!availableKeys.length) {
        const errorMsg = sawSecretDecryptionFailure
          ? getGeminiSecretRotationErrorMessage()
          : "Tidak ada Gemini key tersedia untuk share caption. Pastikan minimal 1 key aktif dengan semua limit quota (RPM, RPD, TPM) terisi.";
        await serviceClient
          .from("share_generations")
          .update({ status: "error", error_message: errorMsg })
          .eq("id", taskInput.generationId)
          .eq("user_id", userId);
        await serviceClient
          .from("ai_tasks")
          .update({ status: "WAITING_FOR_KEY", error_message: errorMsg, finished_at: null })
          .eq("id", taskId)
          .eq("user_id", userId);

        void logDiagnostic({
          userId,
          context: "share_generation",
          level: "warn",
          message: "No keys available, task waiting",
          metadata: { task_id: taskId, share_generation_id: taskInput.generationId, reason: "no_keys_available" },
        });

        return;
      }

      let madeProgress = false;

      for (const key of availableKeys) {
        const secretResult = await readGeminiSecretForKey(serviceClient, userId, key.id);
        sawSecretDecryptionFailure = sawSecretDecryptionFailure || secretResult.decryptFailed;

        if (!secretResult.secret) {
          excludedKeyIds.add(key.id);
          continue;
        }

        madeProgress = true;

        await serviceClient
          .from("ai_tasks")
          .update({ gemini_api_key_id: key.id })
          .eq("id", taskId)
          .eq("user_id", userId);

        void logDiagnostic({
          userId,
          context: "key_routing",
          level: "debug",
          message: "Key selected",
          metadata: { task_id: taskId, key_id: key.id, role: key.role, model: key.model_name },
        });

        await serviceClient
          .from("share_generations")
          .update({ status: "generating" })
          .eq("id", taskInput.generationId)
          .eq("user_id", userId);

        try {
          const prompt = buildShareCaptionPrompt(taskInput);
          const maxOutputTokens = computeShareCaptionMaxTokens(taskInput);

          const response = await generateTrackedGeminiJsonText({
            aiTaskId: taskId,
            geminiApiKey: key,
            taskType: "SHARE_CAPTION",
            userId,
            request: {
              modelName: key.model_name as GeminiModelName,
              apiKey: secretResult.secret,
              systemInstruction: "You are an expert Indonesian affiliate marketing copywriter.",
              prompt,
              temperature: 0.7,
              maxOutputTokens,
              timeoutMs: 60_000,
              responseJsonSchema: GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA,
              enableGoogleSearchGrounding: false,
            },
          });

          let parsed: ShareCaptionResponse;
          try {
            parsed = JSON.parse(response.text) as ShareCaptionResponse;
          } catch (parseError) {
            const responseLength = response.text.length;
            const headSnippet = response.text.slice(0, 500);
            const tailSnippet = response.text.slice(-500);
            const parseErrorMessage = parseError instanceof Error ? parseError.message : String(parseError);

            void logDiagnostic({
              userId,
              context: "share_generation",
              level: "error",
              message: "Gemini JSON parse failed",
              metadata: {
                task_id: taskId,
                share_generation_id: taskInput.generationId,
                platform: taskInput.platform,
                variant_count: taskInput.variantCount,
                max_output_tokens: maxOutputTokens,
                response_length: responseLength,
                response_head: headSnippet,
                response_tail: tailSnippet,
                parse_error: parseErrorMessage,
              },
            });

            throw new Error(
              `Gemini response was not valid JSON (length=${responseLength}, parse_error=${parseErrorMessage}).`,
            );
          }

          if (!parsed.variants || !Array.isArray(parsed.variants) || parsed.variants.length !== taskInput.variantCount) {
            throw new Error(`Expected ${taskInput.variantCount} variants, got ${parsed.variants?.length ?? 0}.`);
          }

          normalizeAndValidateShareCaptionResponse(taskInput, parsed);

          const charLimit = PLATFORM_CHAR_LIMITS[taskInput.platform];
          for (const [index, variant] of parsed.variants.entries()) {
            if (typeof variant.caption === "string" && variant.caption.length > charLimit) {
              console.warn(
                `[SHARE_CAPTION] Variant ${index + 1} exceeds ${charLimit} chars for ${taskInput.platform}: ${variant.caption.length} chars`,
              );
            }
          }

          await serviceClient
            .from("share_generations")
            .update({
              output_json: parsed.variants,
              status: "generated",
            })
            .eq("id", taskInput.generationId)
            .eq("user_id", userId);

          await serviceClient
            .from("ai_tasks")
            .update({
              status: "SUCCESS",
              output_json: JSON.parse(JSON.stringify(parsed)),
              error_message: null,
              finished_at: new Date().toISOString(),
            })
            .eq("id", taskId)
            .eq("user_id", userId);
          await markGeminiKeySuccess({ serviceClient, userId, key });

          void logDiagnostic({
            userId,
            context: "share_generation",
            level: "info",
            message: "Generation succeeded",
            metadata: { task_id: taskId, share_generation_id: taskInput.generationId, variant_count: parsed.variants.length },
          });

          return;
        } catch (error) {
          lastErrorMessage = error instanceof Error ? error.message : "Gemini request failed.";

          if (error instanceof GeminiClientError) {
            const status = error.status;

            if (status === 400) {
              await failShareCaptionTask({
                errorMessage: `Request Gemini untuk share caption ${taskInput.platform} ditolak karena kontrak runtime/schema tidak valid: ${lastErrorMessage}`,
                generationId: taskInput.generationId,
                serviceClient,
                taskId,
                userId,
              });
              return;
            }

            if (status === 429) {
              const retryAfter = error.retryAfterSeconds ?? 60;
              const cooldownUntil = new Date(Date.now() + retryAfter * 1000).toISOString();
              await markGeminiQuotaGroupCooldown({
                serviceClient,
                userId,
                key,
                nextStatus: "RATE_LIMITED",
                cooldownUntil,
              }).catch(() => undefined);
              excludedQuotaGroups.add(getGeminiQuotaGroupKey(key));
              continue;
            }

            if (status === 401 || status === 403) {
              await markGeminiQuotaGroupError({ serviceClient, userId, key }).catch(() => undefined);
              excludedQuotaGroups.add(getGeminiQuotaGroupKey(key));
              continue;
            }

            if (status >= 500) {
              excludedKeyIds.add(key.id);
              continue;
            }
          }

          await failShareCaptionTask({
            errorMessage: `Runtime share caption ${taskInput.platform} gagal memproses output Gemini: ${lastErrorMessage}`,
            generationId: taskInput.generationId,
            serviceClient,
            taskId,
            userId,
          });
          return;
        }
      }

      if (!madeProgress) {
        break;
      }

      attempt++;
    }

    const finalMessage = sawSecretDecryptionFailure
      ? getGeminiSecretRotationErrorMessage()
      : lastErrorMessage;

    await serviceClient
      .from("share_generations")
      .update({ status: "error", error_message: finalMessage })
      .eq("id", taskInput.generationId)
      .eq("user_id", userId);
    await serviceClient
      .from("ai_tasks")
      .update({ status: "FAILED", error_message: finalMessage, finished_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", userId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error.";
    await serviceClient
      .from("share_generations")
      .update({ status: "error", error_message: errorMessage })
      .eq("id", taskInput.generationId)
      .eq("user_id", userId);
    await serviceClient
      .from("ai_tasks")
      .update({ status: "FAILED", error_message: errorMessage, finished_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("user_id", userId);
  }
}
