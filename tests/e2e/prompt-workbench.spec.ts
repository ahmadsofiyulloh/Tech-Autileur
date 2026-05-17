import { expect, test } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";
import { readSmokeBootstrapState, type SmokeBootstrapState } from "./support/bootstrap";
import { createSmokeServiceClient } from "./support/supabase";

async function cleanupPromptWorkbenchArtifacts(state: SmokeBootstrapState) {
  const client = createSmokeServiceClient();
  const { data, error } = await client
    .from("prompt_packs")
    .select("id, ai_task_id")
    .eq("user_id", state.user.id)
    .eq("product_id", state.product.id);

  if (error) {
    throw new Error(error.message);
  }

  const promptPackIds = (data ?? []).map((row) => row.id);
  const taskIds = Array.from(new Set((data ?? []).map((row) => row.ai_task_id).filter((value): value is string => Boolean(value))));

  if (promptPackIds.length) {
    const { error: promptPackError } = await client.from("prompt_packs").delete().in("id", promptPackIds);

    if (promptPackError) {
      throw new Error(promptPackError.message);
    }
  }

  if (taskIds.length) {
    const { error: taskError } = await client.from("ai_tasks").delete().in("id", taskIds);

    if (taskError) {
      throw new Error(taskError.message);
    }
  }
}

async function readSmokeGeminiKey(state: SmokeBootstrapState) {
  const client = createSmokeServiceClient();
  const { data, error } = await client
    .from("gemini_api_keys")
    .select("id, label")
    .eq("user_id", state.user.id)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id || !data.label) {
    throw new Error("Active Gemini key not found for smoke test.");
  }

  return data;
}

async function seedPromptWorkbenchProducts(state: SmokeBootstrapState, count: number) {
  const client = createSmokeServiceClient();
  const products: Array<{ id: string; product_name: string }> = [];

  for (let index = 0; index < count; index += 1) {
    const isTarget = index === 0;
    const productName = isTarget
      ? `Workbench Target ${state.run_tag}`
      : `Workbench Page ${String(index).padStart(2, "0")} ${state.run_tag}`;
    const productCode = `WB${state.run_tag.slice(-6)}${String(index).padStart(2, "0")}`;
    const timestamp = new Date(Date.now() - index * 60_000).toISOString();

    const { data, error } = await client
      .from("products")
      .insert({
        user_id: state.user.id,
        workspace_id: state.workspace.id,
        product_code: productCode,
        product_name: productName,
        status: "DRAFT",
        workflow_status_json: {
          video_generated: false,
          uploaded_shopee: false,
          uploaded_tiktok: false,
        },
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select("id, product_name")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.id) {
      throw new Error("Failed to seed prompt workbench product.");
    }

    products.push({ id: data.id, product_name: data.product_name });
  }

  return products;
}

async function cleanupPromptWorkbenchProducts(productIds: string[]) {
  if (!productIds.length) {
    return;
  }

  const client = createSmokeServiceClient();
  const { error } = await client.from("products").delete().in("id", productIds);

  if (error) {
    throw new Error(error.message);
  }
}

async function cleanupPromptWorkbenchProductDraft(productId: string) {
  const client = createSmokeServiceClient();
  const cleanupSteps = [
    client.from("product_intake_sessions").delete().eq("product_id", productId),
    client.from("product_images").delete().eq("product_id", productId),
    client.from("products").delete().eq("id", productId),
  ];

  for (const step of cleanupSteps) {
    const { error } = await step;

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function seedPromptWorkbenchReviewDraft(state: SmokeBootstrapState) {
  const client = createSmokeServiceClient();
  const { data: seedProductImage, error: seedProductImageError } = await client
    .from("product_images")
    .select("drive_item_ref_id")
    .eq("user_id", state.user.id)
    .eq("product_id", state.product.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (seedProductImageError) {
    throw new Error(seedProductImageError.message);
  }

  if (!seedProductImage?.drive_item_ref_id) {
    throw new Error("Smoke product image Drive reference not found.");
  }

  const suffix = `${state.run_tag.slice(-6)}${Date.now().toString().slice(-6)}`;
  const productName = `Prompt Review Routing ${suffix}`;
  const productCode = `PRR${suffix}`;
  const timestamp = new Date().toISOString();
  const { data: product, error: productError } = await client
    .from("products")
    .insert({
      user_id: state.user.id,
      workspace_id: state.workspace.id,
      product_code: productCode,
      product_name: productName,
      status: "DRAFT",
      workflow_status_json: {
        video_generated: false,
        uploaded_shopee: false,
        uploaded_tiktok: false,
      },
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select("id, product_name")
    .single();

  if (productError) {
    throw new Error(productError.message);
  }

  const { error: imageError } = await client.from("product_images").insert({
    user_id: state.user.id,
    product_id: product.id,
    drive_item_ref_id: seedProductImage.drive_item_ref_id,
    source_type: "GOOGLE_DRIVE",
    is_primary: true,
    analysis_json: {
      title: productName,
      source: "prompt-routing-smoke",
    },
    status: "ANALYZED",
  });

  if (imageError) {
    throw new Error(imageError.message);
  }

  const { data: intake, error: intakeError } = await client
    .from("product_intake_sessions")
    .insert({
      user_id: state.user.id,
      workspace_id: state.workspace.id,
      product_id: product.id,
      intake_code: `PRR-INTAKE-${suffix}`,
      product_title: productName,
      shopee_url: "https://example.com/prompt-review-routing",
      tiktok_url: null,
      product_photo_drive_item_ref_id: seedProductImage.drive_item_ref_id,
      screenshot_drive_item_ref_id: state.drive_items.shopee_screenshot_id,
      raw_notes: "Prompt routing smoke fixture.",
      parsed_metadata_json: {
        nama_produk: productName,
        keyword_cari_etalase: "prompt review routing",
      },
      reviewed_metadata_json: null,
      status: "NEEDS_REVIEW",
      error_message: null,
    })
    .select("id")
    .single();

  if (intakeError) {
    throw new Error(intakeError.message);
  }

  return {
    intakeId: intake.id,
    productId: product.id,
    productName: product.product_name,
  };
}

async function seedMockQueuedPromptPack(
  state: SmokeBootstrapState,
  options?: {
    taskStatus?: "QUEUED" | "RETRYING" | "WAITING_FOR_KEY" | "FAILED";
    promptPackStatus?: "QUEUED" | "ERROR";
    geminiApiKeyId?: string | null;
    taskErrorMessage?: string | null;
  },
) {
  const client = createSmokeServiceClient();
  const taskStatus = options?.taskStatus ?? "QUEUED";
  const promptPackStatus = options?.promptPackStatus ?? (taskStatus === "QUEUED" ? "QUEUED" : "ERROR");
  const geminiApiKeyId = options?.geminiApiKeyId ?? null;
  const taskErrorMessage =
    options?.taskErrorMessage ??
    (taskStatus === "WAITING_FOR_KEY" ? "No eligible Gemini key is available for prompt-pack generation." : null);

  const { data: sourceImage, error: sourceImageError } = await client
    .from("product_images")
    .select("id, drive_item_ref_id, is_primary")
    .eq("user_id", state.user.id)
    .eq("product_id", state.product.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (sourceImageError) {
    throw new Error(sourceImageError.message);
  }

  if (!sourceImage?.id) {
    throw new Error("Source product image not found for mock queue seed.");
  }

  const { data: task, error: taskError } = await client
    .from("ai_tasks")
    .insert({
      user_id: state.user.id,
      gemini_api_key_id: geminiApiKeyId,
      task_type: "PROMPT_PACK_GENERATION",
      status: taskStatus,
      input_json: {
        mode: "mock",
      },
      output_json: null,
      error_message: taskErrorMessage,
      retry_count: taskStatus === "QUEUED" ? 0 : 1,
      max_retries: 0,
    })
    .select("id")
    .single();

  if (taskError) {
    throw new Error(taskError.message);
  }

  const promptCode = `PROMPT-SMOKE-RUNNER-${state.run_tag}`;
  const { data: promptPack, error: promptPackError } = await client
    .from("prompt_packs")
    .insert({
      user_id: state.user.id,
      product_id: state.product.id,
      intake_session_id: state.intake.id,
      affiliate_profile_id: state.affiliate_profile.id,
      source_product_image_id: sourceImage.id,
      prompt_code: promptCode,
      version: 1,
      status: promptPackStatus,
      ai_task_id: task.id,
      product_analysis_json: null,
      i2i_prompts_json: null,
      i2v_prompts_json: null,
      consistency_rules_json: null,
      negative_rules_json: null,
      personalization_json: null,
      error_message: null,
      notes: null,
    })
    .select("id, ai_task_id")
    .single();

  if (promptPackError) {
    throw new Error(promptPackError.message);
  }

  return {
    promptPackId: promptPack?.id ?? "",
    taskId: task.id,
  };
}

test("desktop prompt workbench can enqueue selected ready products", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const client = createSmokeServiceClient();

  try {
    await cleanupPromptWorkbenchArtifacts(state);

    const initialTaskSnapshot = await client
      .from("ai_tasks")
      .select("id")
      .eq("user_id", state.user.id)
      .eq("task_type", "PROMPT_PACK_GENERATION");

    if (initialTaskSnapshot.error) {
      throw new Error(initialTaskSnapshot.error.message);
    }

    const initialPromptPackSnapshot = await client
      .from("prompt_packs")
      .select("id")
      .eq("user_id", state.user.id)
      .eq("product_id", state.product.id);

    if (initialPromptPackSnapshot.error) {
      throw new Error(initialPromptPackSnapshot.error.message);
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/prompts?product_id=${state.product.id}&intake_id=${state.intake.id}`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: "Paket Prompt", level: 1 })).toBeVisible();

    const actionBar = page.getByRole("group", { name: "Aksi bulk prompt" });
    await expect(actionBar).toBeVisible();
    await expect(actionBar).toContainText("0 dipilih");

    const clearButton = actionBar.getByRole("button", { name: "Bersihkan" });
    const enqueueButton = actionBar.getByRole("button", { name: "Antrikan Prompt" });
    await expect(clearButton).toBeDisabled();
    await expect(enqueueButton).toBeDisabled();

    const selectButton = page
      .locator(".prompt-list-card")
      .filter({ hasText: state.product.name })
      .getByRole("button", { name: "Pilih" });

    await expect(selectButton).toBeVisible();
    await selectButton.click();

    await expect(actionBar).toContainText("1 dipilih");
    await expect(clearButton).toBeEnabled();
    await expect(enqueueButton).toBeEnabled();

    const promptPackCountBefore = initialPromptPackSnapshot.data?.length ?? 0;
    const taskCountBefore = initialTaskSnapshot.data?.length ?? 0;
    await enqueueButton.click();

    await page.waitForURL((url) => url.pathname === "/prompts" && url.searchParams.get("queue") === "1" && url.searchParams.has("message"), { timeout: 30_000 });
    await expect(page.locator('aside[aria-label="Antrian prompt"]')).toBeVisible();
    await expect(page.getByText("Antrian Prompt")).toBeVisible();

    const updatedPromptPacks = await client
      .from("prompt_packs")
      .select("id, status, ai_task_id, prompt_code, version")
      .eq("user_id", state.user.id)
      .eq("product_id", state.product.id)
      .order("created_at", { ascending: false });

    if (updatedPromptPacks.error) {
      throw new Error(updatedPromptPacks.error.message);
    }

    const updatedTasks = await client
      .from("ai_tasks")
      .select("id, status, task_type, retry_count, user_id")
      .eq("user_id", state.user.id)
      .eq("task_type", "PROMPT_PACK_GENERATION")
      .order("created_at", { ascending: false });

    if (updatedTasks.error) {
      throw new Error(updatedTasks.error.message);
    }

    expect((updatedPromptPacks.data ?? []).length).toBe(promptPackCountBefore + 1);
    expect((updatedTasks.data ?? []).length).toBe(taskCountBefore + 1);

    const latestPromptPack = updatedPromptPacks.data?.[0];
    const latestTask = updatedTasks.data?.[0];

    expect(latestPromptPack?.status).toBe("QUEUED");
    expect(latestPromptPack?.ai_task_id).toBe(latestTask?.id ?? null);
    expect(latestTask?.status).toBe("QUEUED");
    expect(latestTask?.retry_count).toBe(0);
    expect(latestTask?.user_id).toBe(state.user.id);
  } catch (error) {
    throw classifySmokeError("prompt workbench bulk enqueue", error);
  } finally {
    await cleanupPromptWorkbenchArtifacts(state);
  }
});

test("desktop prompt workbench paginates and searches server-side", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const seededProducts = await seedPromptWorkbenchProducts(state, 120);

  try {
    await cleanupPromptWorkbenchArtifacts(state);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/prompts", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: "Paket Prompt", level: 1 })).toBeVisible();
    const promptPagination = page.locator(".prompt-workbench-footer-pagination");
    await expect(promptPagination.getByRole("link", { name: "Berikutnya" })).toBeVisible();

    const targetName = `Workbench Target ${state.run_tag}`;
    const searchField = page.getByLabel("Cari produk");
    await searchField.fill(targetName);
    await searchField.press("Enter");

    await page.waitForURL((url) => url.pathname === "/prompts" && url.searchParams.get("q") === targetName, {
      timeout: 30_000,
    });

    await expect(page.locator(".prompt-list-card").filter({ hasText: targetName })).toHaveCount(1);
    await expect(page.locator(".prompt-list-card")).toHaveCount(1);

    await page.getByRole("link", { name: "Bersihkan" }).click();
    await page.waitForURL((url) => url.pathname === "/prompts" && !url.searchParams.has("q"), {
      timeout: 30_000,
    });

    await promptPagination.getByRole("link", { name: "Berikutnya" }).click();
    await page.waitForURL((url) => url.pathname === "/prompts" && url.searchParams.get("page") === "2", {
      timeout: 30_000,
    });

    await expect(promptPagination.getByText("Halaman 2/")).toBeVisible();
    await expect(page.locator(".prompt-list-card").first()).toBeVisible();

    await promptPagination.getByRole("link", { name: "Sebelumnya" }).click();
    await page.waitForURL((url) => url.pathname === "/prompts" && (!url.searchParams.has("page") || url.searchParams.get("page") === "1"), {
      timeout: 30_000,
    });
  } catch (error) {
    throw classifySmokeError("prompt workbench pagination/search", error);
  } finally {
    await cleanupPromptWorkbenchProducts(seededProducts.map((product) => product.id));
    await cleanupPromptWorkbenchArtifacts(state);
  }
});

test("mobile prompt workbench appends rows through infinite pagination fallback", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const seededProducts = await seedPromptWorkbenchProducts(state, 30);

  try {
    await cleanupPromptWorkbenchArtifacts(state);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/prompts?q=${encodeURIComponent(state.run_tag)}`, {
      waitUntil: "domcontentloaded",
    });

    const loadMore = page.getByRole("button", { name: "Muat lagi" });
    await loadMore.scrollIntoViewIfNeeded();
    await loadMore.click();

    await expect(page.locator(".prompt-list-card").filter({ hasText: `Workbench Page 29 ${state.run_tag}` })).toBeVisible();
  } catch (error) {
    throw classifySmokeError("mobile prompt infinite pagination", error);
  } finally {
    await cleanupPromptWorkbenchProducts(seededProducts.map((product) => product.id));
    await cleanupPromptWorkbenchArtifacts(state);
  }
});

test("desktop prompt workbench routes unfinished rows through intake continuation", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const seeded = await seedPromptWorkbenchReviewDraft(state);

  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/prompts?q=${encodeURIComponent(seeded.productName)}&affiliate_profile_id=${state.affiliate_profile.id}`, {
      waitUntil: "domcontentloaded",
    });

    const card = page.locator(".prompt-list-card").filter({ hasText: seeded.productName }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText("Needs Review");
    await expect(card.getByText("Kesiapan Prompt")).toHaveCount(0);
    await expect(card.getByRole("link", { name: "Produk" })).toHaveCount(0);

    const continueLink = card.getByRole("link", { name: "Lanjutkan" });
    await expect(continueLink).toBeVisible();
    await expect(continueLink).toHaveAttribute("href", new RegExp(`/products/new\\?.*intake_id=${seeded.intakeId}`));
    await expect(continueLink).toHaveAttribute("href", /step=prompt/);
    await expect(continueLink).toHaveAttribute("href", new RegExp(`affiliate_profile_id=${state.affiliate_profile.id}`));

    await continueLink.click();
    await page.waitForURL((url) => {
      return (
        url.pathname === "/products/new" &&
        url.searchParams.get("intake_id") === seeded.intakeId &&
        url.searchParams.get("step") === "prompt"
      );
    });
  } catch (error) {
    throw classifySmokeError("prompt workbench continuation routing", error);
  } finally {
    await cleanupPromptWorkbenchProductDraft(seeded.productId);
  }
});

test("desktop prompt queue drawer runs queued prompt jobs without opening detail", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const client = createSmokeServiceClient();

  try {
    await cleanupPromptWorkbenchArtifacts(state);
    const seeded = await seedMockQueuedPromptPack(state);

    await page.route("**/api/prompts/queue/run-next", async (route) => {
      const response = await route.fetch();
      await page.waitForTimeout(350);
      await route.fulfill({ response });
    });

    const runNextResponse = page.waitForResponse((response) => {
      return response.url().includes("/api/prompts/queue/run-next") && response.request().method() === "POST";
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/prompts?product_id=${state.product.id}&intake_id=${state.intake.id}&queue=1`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: "Paket Prompt", level: 1 })).toBeVisible();
    const actionBar = page.getByRole("group", { name: "Aksi bulk prompt" });
    await expect(actionBar).toContainText("1 task aktif");
    const drawer = page.locator('aside[aria-label="Antrian prompt"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("Menunggu");
    await drawer.getByRole("button", { name: "Jalankan Antrian" }).click();
    await runNextResponse;

    await expect
      .poll(async () => {
        const { data, error } = await client.from("prompt_packs").select("status, ai_task_id").eq("id", seeded.promptPackId).maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return data?.status ?? null;
      })
      .toBe("GENERATED");

    await expect
      .poll(async () => {
        const { data, error } = await client.from("ai_tasks").select("status, retry_count").eq("id", seeded.taskId).maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return data?.status ?? null;
      })
      .toBe("SUCCESS");

    await expect(actionBar).toContainText("Queue kosong");
    await expect(page.locator(".prompt-list-card").filter({ hasText: state.product.name }).first()).toContainText("GENERATED");
  } catch (error) {
    throw classifySmokeError("prompt workbench queue runner", error);
  } finally {
    await cleanupPromptWorkbenchArtifacts(state);
  }
});

test("desktop prompt queue drawer resumes retrying prompt jobs without opening detail", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const client = createSmokeServiceClient();

  try {
    await cleanupPromptWorkbenchArtifacts(state);
    const seeded = await seedMockQueuedPromptPack(state, {
      taskStatus: "RETRYING",
      promptPackStatus: "ERROR",
    });

    await page.route("**/api/prompts/queue/run-next", async (route) => {
      const response = await route.fetch();
      await page.waitForTimeout(350);
      await route.fulfill({ response });
    });

    const runNextResponse = page.waitForResponse((response) => {
      return response.url().includes("/api/prompts/queue/run-next") && response.request().method() === "POST";
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/prompts?product_id=${state.product.id}&intake_id=${state.intake.id}&queue=1`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: "Paket Prompt", level: 1 })).toBeVisible();
    const actionBar = page.getByRole("group", { name: "Aksi bulk prompt" });
    await expect(actionBar).toContainText("1 task aktif");
    const drawer = page.locator('aside[aria-label="Antrian prompt"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText("RETRYING");
    await drawer.getByRole("button", { name: "Jalankan Antrian" }).click();
    await runNextResponse;

    await expect
      .poll(async () => {
        const { data, error } = await client.from("prompt_packs").select("status, ai_task_id").eq("id", seeded.promptPackId).maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return data?.status ?? null;
      })
      .toBe("GENERATED");

    await expect
      .poll(async () => {
        const { data, error } = await client.from("ai_tasks").select("status, retry_count").eq("id", seeded.taskId).maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return data?.status ?? null;
      })
      .toBe("SUCCESS");

    await expect(actionBar).toContainText("Queue kosong");
    await expect(page.locator(".prompt-list-card").filter({ hasText: state.product.name }).first()).toContainText("GENERATED");
  } catch (error) {
    throw classifySmokeError("prompt workbench retry resume", error);
  } finally {
    await cleanupPromptWorkbenchArtifacts(state);
  }
});

test("desktop prompt workbench can cancel waiting prompt jobs before run", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const client = createSmokeServiceClient();

  try {
    await cleanupPromptWorkbenchArtifacts(state);
    const seeded = await seedMockQueuedPromptPack(state, {
      taskStatus: "WAITING_FOR_KEY",
      promptPackStatus: "QUEUED",
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/prompts?product_id=${state.product.id}&intake_id=${state.intake.id}&queue=1`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: "Paket Prompt", level: 1 })).toBeVisible();
    const actionBar = page.getByRole("group", { name: "Aksi bulk prompt" });
    await expect(actionBar).toContainText("1 task aktif");

    const drawer = page.locator('aside[aria-label="Antrian prompt"]');
    await expect(drawer).toBeVisible();
    const queueRow = drawer.locator(".prompt-queue-row").filter({ hasText: state.product.name }).first();
    await queueRow.getByRole("button", { name: "Batalkan" }).click();

    await page.waitForURL((url) => url.pathname === "/prompts" && url.searchParams.get("queue") === "1" && url.searchParams.has("message"), { timeout: 30_000 });

    await expect
      .poll(async () => {
        const { data, error } = await client
          .from("prompt_packs")
          .select("status, ai_task_id, error_message")
          .eq("id", seeded.promptPackId)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return data?.status ?? null;
      })
      .toBe("DRAFT");

    await expect
      .poll(async () => {
        const { data, error } = await client.from("ai_tasks").select("status, error_message").eq("id", seeded.taskId).maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return data?.status ?? null;
      })
      .toBe("CANCELLED");

    await expect(actionBar).toContainText("Queue kosong");
    const row = page.locator(".prompt-list-card").filter({ hasText: state.product.name }).first();
    await expect(row).toContainText("DRAFT");
  } catch (error) {
    throw classifySmokeError("prompt workbench cancel waiting job", error);
  } finally {
    await cleanupPromptWorkbenchArtifacts(state);
  }
});

test("desktop prompt workbench shows failure reason and selected Gemini key", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const client = createSmokeServiceClient();
  const geminiKey = await readSmokeGeminiKey(state);

  try {
    await cleanupPromptWorkbenchArtifacts(state);
    const seeded = await seedMockQueuedPromptPack(state, {
      taskStatus: "FAILED",
      promptPackStatus: "ERROR",
      geminiApiKeyId: geminiKey.id,
      taskErrorMessage: "Gemini request timed out.",
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/prompts?product_id=${state.product.id}&intake_id=${state.intake.id}&queue=1`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: "Paket Prompt", level: 1 })).toBeVisible();
    const actionBar = page.getByRole("group", { name: "Aksi bulk prompt" });
    await expect(actionBar).toContainText("Queue kosong");

    const drawer = page.locator('aside[aria-label="Antrian prompt"]');
    await expect(drawer).toBeVisible();
    const queueRow = drawer.locator(".prompt-queue-row").filter({ hasText: state.product.name }).first();
    await expect(queueRow).toContainText("FAILED");
    await expect(queueRow).toContainText(geminiKey.label);
    await expect(queueRow).toContainText("Gemini request timed out.");

    const row = page.locator(".prompt-list-card").filter({ hasText: state.product.name }).first();
    await expect(row).toContainText("FAILED");
    await expect(row).toContainText(`Key: ${geminiKey.label}`);
    await expect(row).toContainText("Gemini request timed out.");

    await expect
      .poll(async () => {
        const { data, error } = await client
          .from("prompt_packs")
          .select("status, ai_task_id, error_message")
          .eq("id", seeded.promptPackId)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return data?.status ?? null;
      })
      .toBe("ERROR");

    await queueRow.getByRole("button", { name: "Coba Lagi" }).click();
    await page.waitForURL((url) => url.pathname === "/prompts" && url.searchParams.get("queue") === "1" && url.searchParams.has("message"), {
      timeout: 30_000,
    });

    await expect
      .poll(async () => {
        const { data, error } = await client
          .from("prompt_packs")
          .select("status, ai_task_id")
          .eq("id", seeded.promptPackId)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return {
          taskChanged: Boolean(data?.ai_task_id && data.ai_task_id !== seeded.taskId),
          status: data?.status ?? null,
        };
      })
      .toEqual({ status: "QUEUED", taskChanged: true });
  } catch (error) {
    throw classifySmokeError("prompt workbench failure reason and selected key", error);
  } finally {
    await cleanupPromptWorkbenchArtifacts(state);
  }
});
