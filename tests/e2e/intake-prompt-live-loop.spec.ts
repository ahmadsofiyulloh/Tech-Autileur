import { expect, test } from "@playwright/test";
import path from "node:path";
import { getGeminiTemporaryUnavailableRetryMessage } from "@/lib/gemini/error-message";
import { readPromptPackEditorPromptSet } from "@/lib/prompts/prompt-pack-contract";
import { classifySmokeError, isControlledGeminiTemporaryUnavailableBlocker, SmokeBlockerError } from "./support/blockers";
import { readSmokeBootstrapState } from "./support/bootstrap";
import { createSmokeImageFixtures } from "./support/images";
import { createSmokeServiceClient } from "./support/supabase";

const LOOP_COUNT = Math.max(1, Number.parseInt(process.env.SMOKE_LIVE_E2E_LOOPS ?? "3", 10) || 3);
const PROMPT_GENERATION_TIMEOUT_MS = Math.max(
  600_000,
  Number.parseInt(process.env.SMOKE_LIVE_E2E_PROMPT_TIMEOUT_MS ?? "600000", 10) || 600_000,
);
const SOAK_TEST_TIMEOUT_MS = Math.max(
  1_800_000,
  Number.parseInt(process.env.SMOKE_LIVE_E2E_TIMEOUT_MS ?? "1800000", 10) || 1_800_000,
);

type LiveSmokeFiles = Awaited<ReturnType<typeof createSmokeImageFixtures>>;

type LiveSmokeIterationResult = {
  productId: string;
  blockerMessage: string | null;
};

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function assertNonEmptyText(label: string, value: unknown) {
  const text = readText(value);

  expect(text, `${label} should not be empty`).not.toBe("");
}

function readRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readRouteFeedbackMessage(url: URL) {
  return url.searchParams.get("warning") ?? url.searchParams.get("error");
}

function isGeminiBlockerMessage(message: string) {
  return (
    isControlledGeminiTemporaryUnavailableBlocker(message) ||
    message.includes(getGeminiTemporaryUnavailableRetryMessage()) ||
    message.includes("Stored Gemini keys could not be decrypted")
  );
}

function promptPackIdFromUrl(url: URL) {
  const detailId = url.searchParams.get("detail");

  if (url.pathname === "/prompts" && detailId) {
    return detailId;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] !== "prompts" || segments.length < 2) {
    return "";
  }

  return segments[1] ?? "";
}

async function ensureWorkspaceDriveRoot(page: import("@playwright/test").Page, workspaceName: string) {
  await page.goto("/settings/workspace");
  await page.waitForLoadState("networkidle");

  const workspaceRow = page.locator("tr", { hasText: workspaceName }).first();
  await expect(workspaceRow).toBeVisible();
  await workspaceRow.getByRole("button", { name: "Kelola" }).click();

  const provisionButton = page.getByRole("button", { name: "Buat Folder Drive" });
  await expect(provisionButton).toBeVisible();
  await provisionButton.click();

  await page.waitForURL(
    (url) => url.pathname === "/settings/workspace" && url.searchParams.get("message") === "Folder Drive disinkronkan",
    {
      timeout: 180_000,
    },
  );
}

async function assertAffiliateProfileSeedState(
  page: import("@playwright/test").Page,
  state: Awaited<ReturnType<typeof readSmokeBootstrapState>>,
) {
  const client = createSmokeServiceClient();

  await page.goto(`/settings/affiliate-profiles?profile_id=${state.affiliate_profile.id}`);
  await page.waitForLoadState("networkidle");

  const drawer = page.locator('aside[aria-label="Detail akun affiliate"]');
  await expect(drawer).toBeVisible();
  await expect(page.locator(`[id="${state.affiliate_profile.id}-asset-lock"]`)).toBeChecked();
  await expect(page.locator("#affiliate-i2i-rules")).toHaveValue(/.+/);
  await expect(page.locator("#affiliate-i2v-rules")).toHaveValue(/.+/);
  await expect(page.locator("#affiliate-caption-rules")).toHaveValue(/.+/);
  await expect(page.locator("#affiliate-hashtag-rules")).toHaveValue(/.+/);
  await expect(page.locator("#affiliate-negative-rules")).toHaveValue(/.+/);
  await expect(page.locator('textarea[name="product_positioning_notes"]')).toHaveValue(/.+/);

  const { data, error } = await client
    .from("affiliate_profiles")
    .select(
      "id, profile_code, lock_seed_character, lock_environment, seed_character_drive_item_ref_id, environment_drive_item_ref_id, seed_character_analysis_json, environment_analysis_json, i2i_prompt_rules, i2v_prompt_rules, caption_rules, hashtag_rules, negative_prompt_rules, product_positioning_notes",
    )
    .eq("id", state.affiliate_profile.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  expect(data.lock_seed_character).toBe(true);
  expect(data.lock_environment).toBe(true);
  expect(data.seed_character_drive_item_ref_id).toBeTruthy();
  expect(data.environment_drive_item_ref_id).toBeTruthy();
  expect(readText(data.i2i_prompt_rules)).not.toBe("");
  expect(readText(data.i2v_prompt_rules)).not.toBe("");
  expect(readText(data.caption_rules)).not.toBe("");
  expect(readText(data.hashtag_rules)).not.toBe("");
  expect(readText(data.negative_prompt_rules)).not.toBe("");
  expect(readText(data.product_positioning_notes)).not.toBe("");
  expect(data.profile_code).toBe(state.affiliate_profile.code);

  if (data.seed_character_analysis_json && data.environment_analysis_json) {
    return;
  }

  await expect(page.getByRole("button", { name: "Analisis ulang aset" })).toBeVisible();
  await page.getByRole("button", { name: "Analisis ulang aset" }).click();

  const analysisBanner = page.locator(".affiliate-profile-reanalysis-feedback");
  await expect(analysisBanner).toBeVisible({ timeout: 180_000 });
  await expect(analysisBanner).toContainText("Analisis aset selesai", { timeout: 180_000 });

  const { data: refreshed, error: refreshedError } = await client
    .from("affiliate_profiles")
    .select(
      "id, profile_code, lock_seed_character, lock_environment, seed_character_drive_item_ref_id, environment_drive_item_ref_id, seed_character_analysis_json, environment_analysis_json, i2i_prompt_rules, i2v_prompt_rules, caption_rules, hashtag_rules, negative_prompt_rules, product_positioning_notes",
    )
    .eq("id", state.affiliate_profile.id)
    .single();

  if (refreshedError) {
    throw new Error(refreshedError.message);
  }

  expect(refreshed.seed_character_analysis_json).not.toBeNull();
  expect(refreshed.environment_analysis_json).not.toBeNull();
}

async function loadLatestDraftState(client: ReturnType<typeof createSmokeServiceClient>, state: Awaited<ReturnType<typeof readSmokeBootstrapState>>) {
  const { data: intake, error: intakeError } = await client
    .from("product_intake_sessions")
    .select("id, product_id, status, product_title, reviewed_metadata_json, parsed_metadata_json, created_at")
    .eq("user_id", state.user.id)
    .eq("workspace_id", state.workspace.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (intakeError) {
    throw new Error(intakeError.message);
  }

  if (!intake.product_id) {
    throw new Error("Intake draft did not create a product.");
  }

  const { data: product, error: productError } = await client
    .from("products")
    .select("id, product_code, product_name, status, workspace_id, created_at")
    .eq("id", intake.product_id)
    .single();

  if (productError) {
    throw new Error(productError.message);
  }

  return {
    intakeId: intake.id as string,
    productId: product.id as string,
    productName: product.product_name as string,
    productStatus: product.status as string,
    intakeStatus: intake.status as string,
  };
}

async function assertSavedCaptureState(client: ReturnType<typeof createSmokeServiceClient>, state: Awaited<ReturnType<typeof readSmokeBootstrapState>>, productId: string) {
  const { data: productImages, error: productImagesError } = await client
    .from("product_images")
    .select("id, drive_item_ref_id, source_type, is_primary, status")
    .eq("user_id", state.user.id)
    .eq("product_id", productId);

  if (productImagesError) {
    throw new Error(productImagesError.message);
  }

  const primaryImage = (productImages ?? []).find((image) => image.is_primary);
  expect(primaryImage?.drive_item_ref_id).toBeTruthy();
  expect(primaryImage?.status).toBeTruthy();

  const { data: marketplaceSources, error: marketplaceSourcesError } = await client
    .from("product_marketplace_sources")
    .select("platform, screenshot_drive_item_ref_id, parsed_metadata_json, status")
    .eq("user_id", state.user.id)
    .eq("product_id", productId);

  if (marketplaceSourcesError) {
    throw new Error(marketplaceSourcesError.message);
  }

  const sourceByPlatform = new Map((marketplaceSources ?? []).map((source) => [source.platform, source]));
  expect(sourceByPlatform.get("SHOPEE")?.screenshot_drive_item_ref_id).toBeTruthy();
  expect(sourceByPlatform.get("TIKTOK")?.screenshot_drive_item_ref_id).toBeTruthy();
}

async function assertIntakeGeminiTaskState(
  client: ReturnType<typeof createSmokeServiceClient>,
  state: Awaited<ReturnType<typeof readSmokeBootstrapState>>,
  iterationStartIso: string,
  productId: string,
) {
  const { data: task, error: taskError } = await client
    .from("ai_tasks")
    .select("id, gemini_api_key_id, task_type, status, input_json, output_json, error_message, created_at")
    .eq("user_id", state.user.id)
    .eq("task_type", "VISION_ANALYSIS")
    .gte("created_at", iterationStartIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (taskError) {
    throw new Error(taskError.message);
  }

  expect(task.status).toBe("SUCCESS");
  expect(task.gemini_api_key_id).toBeTruthy();
  expect(task.output_json).not.toBeNull();

  const input = readRecord(task.input_json);
  expect(input?.analysis_mode).toBe("LIVE_IMAGE_BYTES");
  expect(input?.image_bytes_available).toBe(true);
  expect(readRecord(input?.product_image)?.name).toBe("product.png");
  expect(readRecord(input?.shopee_screenshot)?.name).toBe("shopee.png");
  expect(readRecord(input?.tiktok_screenshot)?.name).toBe("tiktok.png");

  const { data: usageEvent, error: usageError } = await client
    .from("gemini_api_usage_events")
    .select("id, ai_task_id, task_type, status, prompt_token_count, model_name, project_label")
    .eq("user_id", state.user.id)
    .eq("ai_task_id", task.id)
    .eq("task_type", "VISION_ANALYSIS")
    .order("request_started_at", { ascending: false })
    .limit(1)
    .single();

  if (usageError) {
    throw new Error(usageError.message);
  }

  expect(usageEvent.status).toBe("SUCCESS");
  expect(usageEvent.model_name).toBeTruthy();
  expect(usageEvent.project_label).toBeTruthy();
  expect(usageEvent.prompt_token_count).not.toBeNull();

  const { data: latestIntake, error: latestIntakeError } = await client
    .from("product_intake_sessions")
    .select("id, product_id, status, reviewed_metadata_json, parsed_metadata_json, product_title, created_at")
    .eq("user_id", state.user.id)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (latestIntakeError) {
    throw new Error(latestIntakeError.message);
  }

  expect(latestIntake.product_id).toBe(productId);
  expect(latestIntake.status).toBe("NEEDS_REVIEW");
  expect(latestIntake.parsed_metadata_json).not.toBeNull();
  expect(latestIntake.reviewed_metadata_json).toBeNull();

  const { data: product, error: productError } = await client
    .from("products")
    .select("id, product_name, status, product_code")
    .eq("id", productId)
    .single();

  if (productError) {
    throw new Error(productError.message);
  }

  expect(product.status).toBe("DRAFT");
}

async function assertPromptTaskState(
  client: ReturnType<typeof createSmokeServiceClient>,
  state: Awaited<ReturnType<typeof readSmokeBootstrapState>>,
  promptPackId: string,
  expectedRevisionInstruction: string | null,
  expectedVersion: number,
) {
  const { data: promptPack, error: promptPackError } = await client
    .from("prompt_packs")
    .select(
      "id, product_id, prompt_code, version, status, ai_task_id, product_analysis_json, i2i_prompts_json, i2v_prompts_json, personalization_json, created_at",
    )
    .eq("id", promptPackId)
    .single();

  if (promptPackError) {
    throw new Error(promptPackError.message);
  }

  expect(promptPack.version).toBe(expectedVersion);
  expect(promptPack.status).toBe("GENERATED");
  expect(promptPack.ai_task_id).toBeTruthy();
  expect(promptPack.product_analysis_json).not.toBeNull();
  expect(promptPack.i2i_prompts_json).not.toBeNull();
  expect(promptPack.i2v_prompts_json).not.toBeNull();

  const promptPackPersonalization = readRecord(promptPack.personalization_json);
  const promptContext = readRecord(promptPackPersonalization?.prompt_context);
  const promptAffiliateProfile = readRecord(promptContext?.affiliate_profile);
  const promptSeedCharacter = readRecord(promptAffiliateProfile?.seed_character);
  const promptEnvironment = readRecord(promptAffiliateProfile?.environment);
  const promptRules = readRecord(promptAffiliateProfile?.rules);
  const reviewedGeminiMetadata = readRecord(promptContext?.reviewed_gemini_metadata);
  const promptSourceImage = readRecord(promptContext?.source_image);
  const promptReferenceCards = Array.isArray(promptContext?.reference_cards) ? promptContext.reference_cards.map(readRecord) : [];
  const productAnalysis = readRecord(promptPack.product_analysis_json);
  const productAnalysisProduct = readRecord(productAnalysis?.product);
  const sourceImage = readRecord(productAnalysis?.source_image);

  expect(promptContext?.visual_parsing_mode).toBe("CACHED_JSON_METADATA");
  expect(promptContext?.image_bytes_available).toBe(false);
  expect(promptReferenceCards).toHaveLength(3);
  expect(promptReferenceCards.map((reference) => reference?.analysis_json)).toEqual([null, null, null]);
  expect(promptReferenceCards.map((reference) => readText(reference?.mention).startsWith("@"))).toEqual([true, true, true]);
  expect(promptReferenceCards.map((reference) => reference?.role)).toEqual([
    "supporting_reference",
    "background_anchor",
    "primary_subject",
  ]);
  expect(promptAffiliateProfile?.profile_code).toBe(state.affiliate_profile.code);
  expect(promptSeedCharacter?.locked).toBe(true);
  expect(promptEnvironment?.locked).toBe(true);
  expect(Array.isArray(promptRules?.i2i_prompt_rules) ? promptRules?.i2i_prompt_rules.length : 0).toBeGreaterThan(0);
  expect(Array.isArray(promptRules?.i2v_prompt_rules) ? promptRules?.i2v_prompt_rules.length : 0).toBeGreaterThan(0);
  expect(Array.isArray(promptRules?.caption_rules) ? promptRules?.caption_rules.length : 0).toBeGreaterThan(0);
  expect(Array.isArray(promptRules?.hashtag_rules) ? promptRules?.hashtag_rules.length : 0).toBeGreaterThan(0);
  expect(Array.isArray(promptRules?.negative_prompt_rules) ? promptRules?.negative_prompt_rules.length : 0).toBeGreaterThan(0);
  expect(Array.isArray(promptRules?.product_positioning_notes) ? promptRules?.product_positioning_notes.length : 0).toBeGreaterThan(0);
  assertNonEmptyText("promptPack reviewed_gemini_metadata.nama_produk", reviewedGeminiMetadata?.nama_produk);
  expect(productAnalysisProduct?.status).toBe("DRAFT");
  expect(sourceImage?.drive_item_ref_id).toBeTruthy();
  expect(sourceImage?.drive_item).toBeUndefined();
  expect(promptSourceImage?.drive_item).toBeUndefined();

  if (expectedRevisionInstruction) {
    const regenerationRequest = readRecord(promptPackPersonalization?.regeneration_request);
    expect(readText(regenerationRequest?.revision_instruction)).toBe(expectedRevisionInstruction);
    expect(readText(regenerationRequest?.source_prompt_pack_id)).not.toBe("");
  }

  const { data: task, error: taskError } = await client
    .from("ai_tasks")
    .select("id, task_type, status, input_json, output_json, error_message, created_at")
    .eq("id", promptPack.ai_task_id)
    .single();

  if (taskError) {
    throw new Error(taskError.message);
  }

  expect(task.task_type).toBe("PROMPT_PACK_GENERATION");
  expect(task.status).toBe("SUCCESS");
  expect(task.output_json).not.toBeNull();

  const taskInput = readRecord(task.input_json);
  const taskPromptContext = readRecord(taskInput?.prompt_context);
  const taskAffiliateProfile = readRecord(taskPromptContext?.affiliate_profile);
  const taskSourceImage = readRecord(taskPromptContext?.source_image);
  const taskPromptSet = readRecord(taskInput?.prompt_set);
  const taskPromptSetClips = readRecord(taskPromptSet?.clips);
  const clip1 = readRecord(taskPromptSetClips?.clip_1);
  const clip2 = readRecord(taskPromptSetClips?.clip_2);

  expect(taskInput?.mode).toBe("gemini");
  expect(taskPromptContext?.image_bytes_available).toBe(false);
  expect(taskPromptContext?.visual_parsing_mode).toBe("CACHED_JSON_METADATA");
  expect(taskAffiliateProfile?.profile_code).toBe(state.affiliate_profile.code);
  expect(taskSourceImage?.drive_item).toBeUndefined();

  if (expectedRevisionInstruction) {
    expect(readText(taskInput?.revision_instruction)).toBe(expectedRevisionInstruction);
    expect(readText(taskPromptSet?.caption)).not.toBe("");
    expect(readText(clip1?.i2i_first_frame)).not.toBe("");
    expect(readText(clip1?.i2i_last_frame)).not.toBe("");
    expect(readText(clip1?.i2v_prompt)).not.toBe("");
    expect(readText(clip2?.i2i_first_frame)).not.toBe("");
    expect(readText(clip2?.i2i_last_frame)).not.toBe("");
    expect(readText(clip2?.i2v_prompt)).not.toBe("");
  }

  const { data: usageEvent, error: usageError } = await client
    .from("gemini_api_usage_events")
    .select("id, ai_task_id, task_type, status, prompt_token_count, model_name, project_label")
    .eq("user_id", state.user.id)
    .eq("ai_task_id", task.id)
    .eq("task_type", "PROMPT_PACK_GENERATION")
    .order("request_started_at", { ascending: false })
    .limit(1)
    .single();

  if (usageError) {
    throw new Error(usageError.message);
  }

  expect(usageEvent.status).toBe("SUCCESS");
  expect(usageEvent.prompt_token_count).not.toBeNull();
}

async function cleanupIterationArtifacts(
  client: ReturnType<typeof createSmokeServiceClient>,
  state: Awaited<ReturnType<typeof readSmokeBootstrapState>>,
  productId: string,
  iterationStartIso: string,
) {
  if (!productId) {
    return;
  }

  const deletions = [
    client.from("prompt_packs").delete().eq("user_id", state.user.id).eq("product_id", productId),
    client.from("ai_tasks").delete().eq("user_id", state.user.id).gte("created_at", iterationStartIso).in("task_type", [
      "VISION_ANALYSIS",
      "PROMPT_PACK_GENERATION",
      "PROMPT_REPAIR",
    ]),
    client.from("product_marketplace_sources").delete().eq("user_id", state.user.id).eq("product_id", productId),
    client.from("product_images").delete().eq("user_id", state.user.id).eq("product_id", productId),
    client.from("product_anchors").delete().eq("user_id", state.user.id).eq("product_id", productId),
    client.from("product_intake_sessions").delete().eq("user_id", state.user.id).eq("product_id", productId),
    client.from("products").delete().eq("user_id", state.user.id).eq("id", productId),
  ] as const;

  for (const operation of deletions) {
    const { error } = await operation;

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function runLiveSmokeIteration(input: {
  page: import("@playwright/test").Page;
  client: ReturnType<typeof createSmokeServiceClient>;
  state: Awaited<ReturnType<typeof readSmokeBootstrapState>>;
  files: LiveSmokeFiles;
  iteration: number;
}): Promise<LiveSmokeIterationResult> {
  const { page, client, state, files, iteration } = input;
  const iterationStartIso = new Date().toISOString();
  let productId = "";
  let blockerMessage: string | null = null;

  try {
    await test.step(`Loop ${iteration}: save capture`, async () => {
      await page.goto("/products/new");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(250);

      await expect(page.locator(".image-preview-upload-card")).toHaveCount(3);
      await expect(page.getByRole("button", { name: "Simpan Produk" })).toBeDisabled();

      const uploadCards = page.locator(".image-preview-upload-card");
      const productChooserPromise = page.waitForEvent("filechooser");
      await uploadCards.nth(0).getByRole("button").first().click();
      await (await productChooserPromise).setFiles(files.productImage);

      const evidencePanel = page.locator("#evidence-panel");
      if (!(await evidencePanel.isVisible())) {
        await page.locator('button[aria-controls="evidence-panel"]').click();
      }
      await expect(evidencePanel).toBeVisible();

      const shopeeChooserPromise = page.waitForEvent("filechooser");
      await evidencePanel.getByRole("button", { name: "Tambah gambar" }).first().click();
      await (await shopeeChooserPromise).setFiles(files.shopeeScreenshot);

      const tiktokChooserPromise = page.waitForEvent("filechooser");
      await evidencePanel.getByRole("button", { name: "Tambah gambar" }).first().click();
      await (await tiktokChooserPromise).setFiles(files.tiktokScreenshot);

      const capturePanel = page.locator("#capture-panel");
      if (!(await capturePanel.isVisible())) {
        await page.locator('button[aria-controls="capture-panel"]').click();
      }
      await expect(capturePanel).toBeVisible();
      await expect(page.getByRole("button", { name: "Simpan Produk" })).toBeEnabled();
      await page.getByRole("button", { name: "Simpan Produk" }).click();

      await page.waitForURL(
        (url) =>
          url.pathname === "/products/new" &&
          (url.searchParams.get("message") === "Produk disimpan" || url.searchParams.get("post_save") === "1"),
        {
          timeout: 180_000,
        },
      );

      const continueDecisionButton = page.getByRole("button", { name: /^(Lanjutkan sesi ini|Lanjut)$/ });
      await expect(continueDecisionButton).toBeVisible();
      await continueDecisionButton.click();

      await page.waitForURL((url) => url.pathname === "/products/new" && url.searchParams.get("post_save") !== "1", {
        timeout: 180_000,
      });

      await expect(page.getByRole("dialog", { name: "Opsi setelah simpan produk" })).toBeHidden();
      await expect(page.locator('button[aria-controls="capture-panel"]')).toBeVisible();

      const latestDraft = await loadLatestDraftState(client, state);
      productId = latestDraft.productId;
      await assertSavedCaptureState(client, state, productId);
    });

    await test.step(`Loop ${iteration}: affiliate lock preflight`, async () => {
      await assertAffiliateProfileSeedState(page, state);
    });

  let intakeId = "";
  let currentProductName = "";

  await test.step(`Loop ${iteration}: live Gemini analysis`, async () => {
    const latestDraft = await loadLatestDraftState(client, state);
    intakeId = latestDraft.intakeId;
    currentProductName = latestDraft.productName;

    await page.goto(`/products/new?intake_id=${intakeId}&affiliate_profile_id=${state.affiliate_profile.id}`);
    await page.waitForLoadState("networkidle");

    const analysisPanel = page.locator("#analysis-panel");
    if (!(await analysisPanel.isVisible())) {
      await page.locator('button[aria-controls="analysis-panel"]').click();
    }
    await expect(analysisPanel).toBeVisible();

    const analyzeMetadataButton = analysisPanel.getByRole("button", { name: "Analisis Metadata" });
    await expect(analyzeMetadataButton).toBeEnabled();
    await analyzeMetadataButton.click();
    await page.waitForURL(
      (url) => url.pathname === "/products/new" && (url.searchParams.has("intake_id") || url.searchParams.has("error") || url.searchParams.has("warning")),
      {
        timeout: 180_000,
      },
    );

    const analysisUrl = new URL(page.url());
    const analysisFeedback = readRouteFeedbackMessage(analysisUrl);
    if (analysisFeedback) {
      if (isGeminiBlockerMessage(analysisFeedback)) {
        blockerMessage = analysisFeedback;
        return;
      }

      throw classifySmokeError(`loop ${iteration} live Gemini analysis`, analysisFeedback);
    }

    const reviewHeading = page.getByRole("heading", { name: "Review Hasil" });
    const analysisFailureHeading = page.getByRole("heading", { name: "Analisis metadata gagal.", level: 3 });
    const analysisOutcome = await Promise.race([
      reviewHeading.waitFor({ state: "visible", timeout: 180_000 }).then(() => "review" as const),
      analysisFailureHeading.waitFor({ state: "visible", timeout: 180_000 }).then(() => "failure" as const),
    ]);

    if (analysisOutcome === "failure") {
      const failureMessage = await page.locator("body").innerText();
      if (isGeminiBlockerMessage(failureMessage)) {
        blockerMessage = failureMessage;
        return;
      }

      throw classifySmokeError(`loop ${iteration} live Gemini analysis`, failureMessage);
    }

    await expect(reviewHeading).toBeVisible();
    const reviewPanel = page.locator("#review-panel");
    await expect(reviewPanel).toBeVisible();
    const saveReviewButton = reviewPanel.getByRole("button", { name: "Simpan" });
    await expect(saveReviewButton).toBeVisible();

    await assertIntakeGeminiTaskState(client, state, iterationStartIso, productId);
  });

  if (blockerMessage) {
    return {
      productId,
      blockerMessage,
    };
  }

  await test.step(`Loop ${iteration}: save reviewed metadata`, async () => {
    await page.locator("#review-panel").getByRole("button", { name: "Simpan" }).click();
    await page.waitForURL(
      (url) =>
        url.pathname === "/prompts" &&
        url.searchParams.get("product_id") === productId &&
        url.searchParams.get("intake_id") === intakeId &&
        url.searchParams.get("affiliate_profile_id") === state.affiliate_profile.id,
      { timeout: 180_000 },
    );

    const reviewedIntake = await client
      .from("product_intake_sessions")
      .select("id, product_id, status, reviewed_metadata_json, parsed_metadata_json, product_title")
      .eq("id", intakeId)
      .single();

    if (reviewedIntake.error) {
      throw new Error(reviewedIntake.error.message);
    }

    expect(reviewedIntake.data.status).toBe("REVIEWED");
    expect(reviewedIntake.data.reviewed_metadata_json).not.toBeNull();
    expect(reviewedIntake.data.product_id).toBe(productId);

    const product = await client
      .from("products")
      .select("id, product_name, status, product_code")
      .eq("id", productId)
      .single();

    if (product.error) {
      throw new Error(product.error.message);
    }

    currentProductName = product.data.product_name;
    expect(product.data.status).toBe("DRAFT");
    expect(readText(product.data.product_name)).not.toBe("");

    const marketplaceSources = await client
      .from("product_marketplace_sources")
      .select("platform, screenshot_drive_item_ref_id, parsed_metadata_json, status")
      .eq("user_id", state.user.id)
      .eq("product_id", productId);

    if (marketplaceSources.error) {
      throw new Error(marketplaceSources.error.message);
    }

    const sourceByPlatform = new Map((marketplaceSources.data ?? []).map((source) => [source.platform, source]));
    expect(sourceByPlatform.get("SHOPEE")?.screenshot_drive_item_ref_id).toBeTruthy();
    expect(sourceByPlatform.get("TIKTOK")?.screenshot_drive_item_ref_id).toBeTruthy();
  });

    let promptPackV1Id = "";
    let promptCode = "";
    let promptTaskIdV1 = "";

  await test.step(`Loop ${iteration}: prompt asset preflight`, async () => {
    await assertAffiliateProfileSeedState(page, state);

    await page.goto(`/prompts?product_id=${productId}&intake_id=${intakeId}&affiliate_profile_id=${state.affiliate_profile.id}`);
    await page.waitForLoadState("networkidle");
  });

  await test.step(`Loop ${iteration}: generate prompt`, async () => {
    const promptCard = page
      .locator("article")
      .filter({ has: page.locator(`a[href^="/products?"][href*="detail=${productId}"][href*="tab=metadata"]`) })
      .first();
    await expect(promptCard).toBeVisible();
    await expect(promptCard.getByRole("button", { name: "Buat Prompt" })).toBeEnabled();
    await promptCard.getByRole("button", { name: "Buat Prompt" }).click();

    await page.waitForURL((url) => {
      const promptPackId = promptPackIdFromUrl(url);
      return (
        (url.pathname === "/prompts" || /^\/prompts\/[^/]+$/.test(url.pathname)) &&
        Boolean(promptPackId) &&
        promptPackId !== promptPackV1Id
      );
    }, {
      timeout: PROMPT_GENERATION_TIMEOUT_MS,
      waitUntil: "commit",
    });
    const promptUrl = new URL(page.url());
    const promptFeedback = readRouteFeedbackMessage(promptUrl);

    if (promptFeedback) {
      if (isGeminiBlockerMessage(promptFeedback)) {
        blockerMessage = promptFeedback;
        return;
      }

      throw classifySmokeError(`loop ${iteration} prompt generation`, promptFeedback);
    }

    promptPackV1Id = promptPackIdFromUrl(promptUrl);
    expect(promptPackV1Id).toBeTruthy();

    await expect(page.getByRole("heading", { name: "Output Siap Copy" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Buat Ulang" })).toBeVisible({
      timeout: PROMPT_GENERATION_TIMEOUT_MS,
    });

    const promptPackV1 = await client
      .from("prompt_packs")
      .select(
        "id, product_id, prompt_code, version, status, ai_task_id, product_analysis_json, i2i_prompts_json, i2v_prompts_json, personalization_json, created_at",
      )
      .eq("id", promptPackV1Id)
      .single();

    if (promptPackV1.error) {
      throw new Error(promptPackV1.error.message);
    }

    promptCode = promptPackV1.data.prompt_code;
    promptTaskIdV1 = promptPackV1.data.ai_task_id ?? "";
    expect(promptPackV1.data.version).toBe(1);
    expect(promptPackV1.data.status).toBe("GENERATED");
    expect(promptPackV1.data.ai_task_id).toBeTruthy();
    expect(promptPackV1.data.i2i_prompts_json).not.toBeNull();
    expect(promptPackV1.data.i2v_prompts_json).not.toBeNull();

    const promptPackV1Personalization = readRecord(promptPackV1.data.personalization_json);
    const promptPackV1EditorSet = readPromptPackEditorPromptSet(promptPackV1.data);
    const promptPackV1Clip1 = promptPackV1EditorSet.clips.clip_1;
    const promptPackV1Clip2 = promptPackV1EditorSet.clips.clip_2;
    const promptPackV1Clip1FirstFrame = readRecord(promptPackV1Clip1?.i2i_first_frame_json);
    const promptPackV1Clip1LastFrame = readRecord(promptPackV1Clip1?.i2i_last_frame_json);
    const promptPackV1Clip1I2V = readRecord(promptPackV1Clip1?.i2v_prompt_json);
    const promptPackV1Clip1FirstFrameInputs = Array.isArray(promptPackV1Clip1FirstFrame?.image_inputs)
      ? promptPackV1Clip1FirstFrame.image_inputs
      : [];
    const promptPackV1Clip1LastFrameInputs = Array.isArray(promptPackV1Clip1LastFrame?.image_inputs)
      ? promptPackV1Clip1LastFrame.image_inputs
      : [];
    const promptPackV1Clip1I2VFrameInputs = Array.isArray(promptPackV1Clip1I2V?.frame_inputs)
      ? promptPackV1Clip1I2V.frame_inputs
      : [];
    const promptPackV1Clip1I2VTimeline = Array.isArray(promptPackV1Clip1I2V?.timeline)
      ? promptPackV1Clip1I2V.timeline.map(readRecord)
      : [];
    const promptContext = readRecord(promptPackV1Personalization?.prompt_context);
    const promptAffiliateProfile = readRecord(promptContext?.affiliate_profile);
    const promptRules = readRecord(promptAffiliateProfile?.rules);
    const promptSeedCharacter = readRecord(promptAffiliateProfile?.seed_character);
    const promptEnvironment = readRecord(promptAffiliateProfile?.environment);
    const reviewedGeminiMetadata = readRecord(promptContext?.reviewed_gemini_metadata);
    const productAnalysis = readRecord(promptPackV1.data.product_analysis_json);
    const productAnalysisProduct = readRecord(productAnalysis?.product);
    const sourceImage = readRecord(productAnalysis?.source_image);

    expect(promptContext?.visual_parsing_mode).toBe("CACHED_JSON_METADATA");
    expect(promptContext?.image_bytes_available).toBe(false);
    expect(promptAffiliateProfile?.profile_code).toBe(state.affiliate_profile.code);
    expect(promptSeedCharacter?.locked).toBe(true);
    expect(promptEnvironment?.locked).toBe(true);
    expect(Array.isArray(promptRules?.i2i_prompt_rules) ? promptRules?.i2i_prompt_rules.length : 0).toBeGreaterThan(0);
    expect(Array.isArray(promptRules?.i2v_prompt_rules) ? promptRules?.i2v_prompt_rules.length : 0).toBeGreaterThan(0);
    expect(Array.isArray(promptRules?.caption_rules) ? promptRules?.caption_rules.length : 0).toBeGreaterThan(0);
    expect(Array.isArray(promptRules?.hashtag_rules) ? promptRules?.hashtag_rules.length : 0).toBeGreaterThan(0);
    expect(Array.isArray(promptRules?.negative_prompt_rules) ? promptRules?.negative_prompt_rules.length : 0).toBeGreaterThan(0);
    expect(Array.isArray(promptRules?.product_positioning_notes) ? promptRules?.product_positioning_notes.length : 0).toBeGreaterThan(0);
    assertNonEmptyText("promptPackV1 reviewed_gemini_metadata.nama_produk", reviewedGeminiMetadata?.nama_produk);
    expect(productAnalysisProduct?.status).toBe("DRAFT");
    expect(sourceImage?.drive_item_ref_id).toBeTruthy();
    assertNonEmptyText("promptPackV1 clip_1 i2i_first_frame", promptPackV1Clip1.i2i_first_frame);
    assertNonEmptyText("promptPackV1 clip_1 i2i_last_frame", promptPackV1Clip1.i2i_last_frame);
    assertNonEmptyText("promptPackV1 clip_1 i2v_prompt", promptPackV1Clip1.i2v_prompt);
    assertNonEmptyText("promptPackV1 clip_2 i2i_first_frame", promptPackV1Clip2.i2i_first_frame);
    assertNonEmptyText("promptPackV1 clip_2 i2i_last_frame", promptPackV1Clip2.i2i_last_frame);
    assertNonEmptyText("promptPackV1 clip_2 i2v_prompt", promptPackV1Clip2.i2v_prompt);
    expect(promptPackV1Clip1FirstFrame?.schema_version).toBe("prompt_pack_v2");
    expect(promptPackV1Clip1FirstFrame?.stage).toBe("i2i_first_frame");
    expect(promptPackV1Clip1FirstFrameInputs.length).toBe(3);
    expect(promptPackV1Clip1FirstFrameInputs[0]).toBe("@character");
    expect(promptPackV1Clip1FirstFrameInputs[1]).toBe("@environment");
    expect(readText(promptPackV1Clip1FirstFrameInputs[2]).startsWith("@")).toBe(true);
    expect(promptPackV1Clip1LastFrameInputs).toEqual(["@firstframe"]);
    expect(promptPackV1Clip1I2V?.schema_version).toBe("prompt_pack_v2");
    expect(promptPackV1Clip1I2V?.duration_seconds).toBe(8);
    expect(promptPackV1Clip1I2VFrameInputs).toEqual(["@firstframe", "@lastframe"]);
    expect(promptPackV1Clip1I2VTimeline.map((segment) => segment?.time)).toEqual([
      "00:00-00:02",
      "00:02-00:04",
      "00:04-00:06",
      "00:06-00:08",
    ]);
    expect(JSON.stringify(promptPackV1Clip1FirstFrame)).not.toContain("visual_references");
    expect(JSON.stringify(promptPackV1Clip1FirstFrame)).not.toContain("prompt_rules");
    expect(JSON.stringify(promptPackV1Clip1I2V)).not.toContain("visual_references");
    expect(JSON.stringify(promptPackV1Clip1I2V)).not.toContain("prompt_rules");

    const promptTask = await client
      .from("ai_tasks")
      .select("id, gemini_api_key_id, task_type, status, input_json, output_json, error_message, created_at")
      .eq("id", promptPackV1.data.ai_task_id)
      .single();

    if (promptTask.error) {
      throw new Error(promptTask.error.message);
    }

    expect(promptTask.data.task_type).toBe("PROMPT_PACK_GENERATION");
    expect(promptTask.data.status).toBe("SUCCESS");
    expect(promptTask.data.gemini_api_key_id).toBeTruthy();
    expect(promptTask.data.output_json).not.toBeNull();

    const promptInput = readRecord(promptTask.data.input_json);
    const promptTaskContext = readRecord(promptInput?.prompt_context);
    const promptTaskAffiliateProfile = readRecord(promptTaskContext?.affiliate_profile);
    const promptTaskReferenceCards = Array.isArray(promptTaskContext?.reference_cards) ? promptTaskContext.reference_cards.map(readRecord) : [];

    expect(promptInput?.mode).toBe("gemini");
    expect(promptTaskContext?.visual_parsing_mode).toBe("CACHED_JSON_METADATA");
    expect(promptTaskContext?.image_bytes_available).toBe(false);
    expect(promptTaskReferenceCards).toHaveLength(3);
    expect(promptTaskReferenceCards.map((reference) => reference?.analysis_json)).toEqual([null, null, null]);
    expect(promptTaskAffiliateProfile?.profile_code).toBe(state.affiliate_profile.code);
    expect(readText(promptInput?.revision_instruction)).toBe("");

    const promptUsage = await client
      .from("gemini_api_usage_events")
      .select("id, ai_task_id, task_type, status, prompt_token_count, model_name, project_label")
      .eq("user_id", state.user.id)
      .eq("ai_task_id", promptTask.data.id)
      .eq("task_type", "PROMPT_PACK_GENERATION")
      .order("request_started_at", { ascending: false })
      .limit(1)
      .single();

    if (promptUsage.error) {
      throw new Error(promptUsage.error.message);
    }

    expect(promptUsage.data.status).toBe("SUCCESS");
    expect(promptUsage.data.model_name).toBeTruthy();
    expect(promptUsage.data.project_label).toBeTruthy();
    expect(promptUsage.data.prompt_token_count).not.toBeNull();
  });

  if (blockerMessage) {
    return {
      productId,
      blockerMessage,
    };
  }

  const revisionInstruction = `Loop ${iteration} revisi hook, jaga seed lock, dan pertahankan bukti marketplace.`;

  await test.step(`Loop ${iteration}: regenerate prompt`, async () => {
    await page.locator("#revision_instruction").fill(revisionInstruction);
    await page.getByRole("button", { name: "Buat Ulang" }).click();

    await page.waitForURL((url) => {
      const promptPackId = promptPackIdFromUrl(url);
      return (
        (url.pathname === "/prompts" || /^\/prompts\/[^/]+$/.test(url.pathname)) &&
        Boolean(promptPackId) &&
        promptPackId !== promptPackV1Id
      );
    }, {
      timeout: PROMPT_GENERATION_TIMEOUT_MS,
      waitUntil: "commit",
    });
    const regenUrl = new URL(page.url());
    const regenFeedback = readRouteFeedbackMessage(regenUrl);

    if (regenFeedback) {
      if (isGeminiBlockerMessage(regenFeedback)) {
        blockerMessage = regenFeedback;
        return;
      }

      throw classifySmokeError(`loop ${iteration} prompt regeneration`, regenFeedback);
    }

    const promptPackV2Id = promptPackIdFromUrl(regenUrl);
    expect(promptPackV2Id).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Output Siap Copy" })).toBeVisible();

    const promptPackV2 = await client
      .from("prompt_packs")
      .select(
        "id, product_id, prompt_code, version, status, ai_task_id, product_analysis_json, i2i_prompts_json, i2v_prompts_json, personalization_json, created_at",
      )
      .eq("id", promptPackV2Id)
      .single();

    if (promptPackV2.error) {
      throw new Error(promptPackV2.error.message);
    }

    expect(promptPackV2.data.version).toBe(2);
    expect(promptPackV2.data.status).toBe("GENERATED");
    expect(promptPackV2.data.prompt_code).toBe(promptCode);
    expect(promptPackV2.data.ai_task_id).toBeTruthy();
    expect(promptPackV2.data.ai_task_id).not.toBe(promptTaskIdV1);
    expect(promptPackV2.data.i2v_prompts_json).not.toBeNull();

    const promptPackV2Personalization = readRecord(promptPackV2.data.personalization_json);
    const regenerationRequest = readRecord(promptPackV2Personalization?.regeneration_request);
    const promptPackV2EditorSet = readPromptPackEditorPromptSet(promptPackV2.data);
    const promptPackV2Clip1 = promptPackV2EditorSet.clips.clip_1;
    const promptPackV2Clip2 = promptPackV2EditorSet.clips.clip_2;
    const promptContext = readRecord(promptPackV2Personalization?.prompt_context);
    const promptAffiliateProfile = readRecord(promptContext?.affiliate_profile);
    const promptRules = readRecord(promptAffiliateProfile?.rules);
    const promptSeedCharacter = readRecord(promptAffiliateProfile?.seed_character);
    const promptEnvironment = readRecord(promptAffiliateProfile?.environment);
    const reviewedGeminiMetadata = readRecord(promptContext?.reviewed_gemini_metadata);
    const promptSourceImage = readRecord(promptContext?.source_image);
    expect(readText(regenerationRequest?.revision_instruction)).toBe(revisionInstruction);
    expect(readText(regenerationRequest?.source_prompt_pack_id)).toBe(promptPackV1Id);
    expect(regenerationRequest?.source_version).toBe(1);
    expect(promptContext?.visual_parsing_mode).toBe("CACHED_JSON_METADATA");
    expect(promptContext?.image_bytes_available).toBe(false);
    expect(promptAffiliateProfile?.profile_code).toBe(state.affiliate_profile.code);
    expect(promptSeedCharacter?.locked).toBe(true);
    expect(promptEnvironment?.locked).toBe(true);
    expect(Array.isArray(promptRules?.i2i_prompt_rules) ? promptRules?.i2i_prompt_rules.length : 0).toBeGreaterThan(0);
    expect(Array.isArray(promptRules?.i2v_prompt_rules) ? promptRules?.i2v_prompt_rules.length : 0).toBeGreaterThan(0);
    expect(Array.isArray(promptRules?.caption_rules) ? promptRules?.caption_rules.length : 0).toBeGreaterThan(0);
    expect(Array.isArray(promptRules?.hashtag_rules) ? promptRules?.hashtag_rules.length : 0).toBeGreaterThan(0);
    expect(Array.isArray(promptRules?.negative_prompt_rules) ? promptRules?.negative_prompt_rules.length : 0).toBeGreaterThan(0);
    expect(Array.isArray(promptRules?.product_positioning_notes) ? promptRules?.product_positioning_notes.length : 0).toBeGreaterThan(0);
    assertNonEmptyText("promptPackV2 reviewed_gemini_metadata.nama_produk", reviewedGeminiMetadata?.nama_produk);
    expect(promptSourceImage?.drive_item).toBeUndefined();
    assertNonEmptyText("promptPackV2 caption", promptPackV2EditorSet.caption);
    assertNonEmptyText("promptPackV2 clip_1 i2i_first_frame", promptPackV2Clip1.i2i_first_frame);
    assertNonEmptyText("promptPackV2 clip_1 i2i_last_frame", promptPackV2Clip1.i2i_last_frame);
    assertNonEmptyText("promptPackV2 clip_1 i2v_prompt", promptPackV2Clip1.i2v_prompt);
    assertNonEmptyText("promptPackV2 clip_2 i2i_first_frame", promptPackV2Clip2.i2i_first_frame);
    assertNonEmptyText("promptPackV2 clip_2 i2i_last_frame", promptPackV2Clip2.i2i_last_frame);
    assertNonEmptyText("promptPackV2 clip_2 i2v_prompt", promptPackV2Clip2.i2v_prompt);

    const promptTask = await client
      .from("ai_tasks")
      .select("id, gemini_api_key_id, task_type, status, input_json, output_json, error_message, created_at")
      .eq("id", promptPackV2.data.ai_task_id)
      .single();

    if (promptTask.error) {
      throw new Error(promptTask.error.message);
    }

    expect(promptTask.data.task_type).toBe("PROMPT_PACK_GENERATION");
    expect(promptTask.data.status).toBe("SUCCESS");
    expect(promptTask.data.gemini_api_key_id).toBeTruthy();
    expect(promptTask.data.output_json).not.toBeNull();

    const promptInput = readRecord(promptTask.data.input_json);
    const promptTaskContext = readRecord(promptInput?.prompt_context);
    const promptTaskAffiliateProfile = readRecord(promptTaskContext?.affiliate_profile);
    const promptTaskSourceImage = readRecord(promptTaskContext?.source_image);
    const promptTaskReferenceCards = Array.isArray(promptTaskContext?.reference_cards) ? promptTaskContext.reference_cards.map(readRecord) : [];
    const promptTaskSet = readRecord(promptInput?.prompt_set);
    const promptTaskSetClips = readRecord(promptTaskSet?.clips);
    const promptTaskSetClip1 = readRecord(promptTaskSetClips?.clip_1);
    const promptTaskSetClip2 = readRecord(promptTaskSetClips?.clip_2);
    const promptTaskSetClip1FirstFrame = readRecord(promptTaskSetClip1?.i2i_first_frame_json);
    const promptTaskSetClip1LastFrame = readRecord(promptTaskSetClip1?.i2i_last_frame_json);
    const promptTaskSetClip1I2V = readRecord(promptTaskSetClip1?.i2v_prompt_json);
    const promptTaskSetClip1FirstFrameInputs = Array.isArray(promptTaskSetClip1FirstFrame?.image_inputs)
      ? promptTaskSetClip1FirstFrame.image_inputs
      : [];
    const promptTaskSetClip1LastFrameInputs = Array.isArray(promptTaskSetClip1LastFrame?.image_inputs)
      ? promptTaskSetClip1LastFrame.image_inputs
      : [];
    const promptTaskSetClip1I2VFrameInputs = Array.isArray(promptTaskSetClip1I2V?.frame_inputs)
      ? promptTaskSetClip1I2V.frame_inputs
      : [];
    const promptTaskSetClip1I2VTimeline = Array.isArray(promptTaskSetClip1I2V?.timeline)
      ? promptTaskSetClip1I2V.timeline.map(readRecord)
      : [];

    expect(promptInput?.mode).toBe("gemini");
    expect(readText(promptInput?.revision_instruction)).toBe(revisionInstruction);
    expect(promptTaskContext?.visual_parsing_mode).toBe("CACHED_JSON_METADATA");
    expect(promptTaskContext?.image_bytes_available).toBe(false);
    expect(promptTaskReferenceCards).toHaveLength(3);
    expect(promptTaskReferenceCards.map((reference) => reference?.analysis_json)).toEqual([null, null, null]);
    expect(promptTaskAffiliateProfile?.profile_code).toBe(state.affiliate_profile.code);
    expect(promptTaskSourceImage?.drive_item).toBeUndefined();
    expect(readText(promptTaskSet?.caption)).not.toBe("");
    expect(readText(promptTaskSetClip1?.i2i_first_frame)).not.toBe("");
    expect(readText(promptTaskSetClip1?.i2i_last_frame)).not.toBe("");
    expect(readText(promptTaskSetClip1?.i2v_prompt)).not.toBe("");
    expect(readText(promptTaskSetClip2?.i2i_first_frame)).not.toBe("");
    expect(readText(promptTaskSetClip2?.i2i_last_frame)).not.toBe("");
    expect(readText(promptTaskSetClip2?.i2v_prompt)).not.toBe("");
    expect(promptTaskSetClip1FirstFrame?.schema_version).toBe("prompt_pack_v2");
    expect(promptTaskSetClip1FirstFrame?.stage).toBe("i2i_first_frame");
    expect(promptTaskSetClip1FirstFrameInputs.length).toBe(3);
    expect(promptTaskSetClip1FirstFrameInputs[0]).toBe("@character");
    expect(promptTaskSetClip1FirstFrameInputs[1]).toBe("@environment");
    expect(readText(promptTaskSetClip1FirstFrameInputs[2]).startsWith("@")).toBe(true);
    expect(promptTaskSetClip1LastFrameInputs).toEqual(["@firstframe"]);
    expect(promptTaskSetClip1I2V?.duration_seconds).toBe(8);
    expect(promptTaskSetClip1I2VFrameInputs).toEqual(["@firstframe", "@lastframe"]);
    expect(promptTaskSetClip1I2VTimeline.map((segment) => segment?.time)).toEqual([
      "00:00-00:02",
      "00:02-00:04",
      "00:04-00:06",
      "00:06-00:08",
    ]);
    expect(JSON.stringify(promptTaskSetClip1FirstFrame)).not.toContain("visual_references");
    expect(JSON.stringify(promptTaskSetClip1FirstFrame)).not.toContain("prompt_rules");
    expect(JSON.stringify(promptTaskSetClip1I2V)).not.toContain("visual_references");
    expect(JSON.stringify(promptTaskSetClip1I2V)).not.toContain("prompt_rules");

    const promptUsage = await client
      .from("gemini_api_usage_events")
      .select("id, ai_task_id, task_type, status, prompt_token_count, model_name, project_label")
      .eq("user_id", state.user.id)
      .eq("ai_task_id", promptTask.data.id)
      .eq("task_type", "PROMPT_PACK_GENERATION")
      .order("request_started_at", { ascending: false })
      .limit(1)
      .single();

    if (promptUsage.error) {
      throw new Error(promptUsage.error.message);
    }

    expect(promptUsage.data.status).toBe("SUCCESS");
    expect(promptUsage.data.model_name).toBeTruthy();
    expect(promptUsage.data.project_label).toBeTruthy();
    expect(promptUsage.data.prompt_token_count).not.toBeNull();

    const versionRows = await client
      .from("prompt_packs")
      .select("version, prompt_code, status")
      .eq("user_id", state.user.id)
      .eq("prompt_code", promptCode)
      .order("version", { ascending: true });

    if (versionRows.error) {
      throw new Error(versionRows.error.message);
    }

    expect((versionRows.data ?? []).map((row) => row.version)).toEqual([1, 2]);
  });

  return {
    productId,
    blockerMessage,
  };
  } finally {
    if (productId) {
      await cleanupIterationArtifacts(client, state, productId, iterationStartIso);
    }
  }
}

test("live intake prompt loop keeps Gemini, seed locks, and regeneration connected", async ({ page, browser }, testInfo) => {
  testInfo.setTimeout(SOAK_TEST_TIMEOUT_MS);
  const state = await readSmokeBootstrapState();
  const client = createSmokeServiceClient();
  const fixtureDir = path.join(testInfo.outputDir, "live-intake-prompt-loop");
  const fixtureContext = await browser.newContext();
  let geminiTemporaryUnavailableMessage: string | null = null;

  try {
    await ensureWorkspaceDriveRoot(page, state.workspace.name);
    await assertAffiliateProfileSeedState(page, state);

    for (let iteration = 1; iteration <= LOOP_COUNT; iteration++) {
      const files = await createSmokeImageFixtures(fixtureContext, path.join(fixtureDir, `iteration-${iteration}`));
      const result = await runLiveSmokeIteration({
        page,
        client,
        state,
        files,
        iteration,
      });

      if (result.blockerMessage) {
        geminiTemporaryUnavailableMessage = result.blockerMessage;
        break;
      }
    }
  } catch (error) {
    if (error instanceof SmokeBlockerError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes("timeout")) {
      throw classifySmokeError("live intake prompt loop timeout", error);
    }

    throw classifySmokeError("live intake prompt loop", error);
  } finally {
    await fixtureContext.close();
  }

  if (geminiTemporaryUnavailableMessage) {
    testInfo.annotations.push({
      type: "external-blocker",
      description: `GEMINI_BLOCKER: ${geminiTemporaryUnavailableMessage}`,
    });
    test.skip(true, `Expected external Gemini blocker: ${geminiTemporaryUnavailableMessage}`);
  }
});
