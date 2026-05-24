import "server-only";

import type { GeminiModelName } from "@/lib/gemini/validation";
import { GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA } from "@/lib/gemini/json-schemas";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/admin";
import { GeminiClientError } from "@/lib/server/gemini-client";
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
          : "Tidak ada Gemini key tersedia. Periksa pengaturan key atau tunggu cooldown selesai.";
        await serviceClient
          .from("share_generations")
          .update({ status: "error", error_message: errorMsg })
          .eq("id", taskInput.generationId)
          .eq("user_id", userId);
        await serviceClient
          .from("ai_tasks")
          .update({ status: "FAILED", error_message: errorMsg, finished_at: new Date().toISOString() })
          .eq("id", taskId)
          .eq("user_id", userId);
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

        await serviceClient
          .from("share_generations")
          .update({ status: "generating" })
          .eq("id", taskInput.generationId)
          .eq("user_id", userId);

        try {
          const prompt = buildShareCaptionPrompt(taskInput);

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
              maxOutputTokens: 2048,
              timeoutMs: 60_000,
              responseJsonSchema: GEMINI_SHARE_CAPTION_RESPONSE_SCHEMA,
              enableGoogleSearchGrounding: false,
            },
          });

          let parsed: ShareCaptionResponse;
          try {
            parsed = JSON.parse(response.text) as ShareCaptionResponse;
          } catch {
            throw new Error("Gemini response was not valid JSON.");
          }

          if (!parsed.variants || !Array.isArray(parsed.variants) || parsed.variants.length !== taskInput.variantCount) {
            throw new Error(`Expected ${taskInput.variantCount} variants, got ${parsed.variants?.length ?? 0}.`);
          }

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

          return;
        } catch (error) {
          lastErrorMessage = error instanceof Error ? error.message : "Gemini request failed.";

          if (error instanceof GeminiClientError) {
            const status = error.status;

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

            if (status === 400 || status === 401 || status === 403) {
              await markGeminiQuotaGroupError({ serviceClient, userId, key }).catch(() => undefined);
              excludedQuotaGroups.add(getGeminiQuotaGroupKey(key));
              continue;
            }

            if (status >= 500) {
              excludedKeyIds.add(key.id);
              continue;
            }
          }

          excludedKeyIds.add(key.id);
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
