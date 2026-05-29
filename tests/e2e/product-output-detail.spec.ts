import { expect, test } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";
import { readSmokeBootstrapState } from "./support/bootstrap";
import { createSmokeServiceClient } from "./support/supabase";

test.use({
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  viewport: {
    width: 390,
    height: 844,
  },
});

type SeededOutputData = {
  caption: string;
  tags: string;
  folderDriveUrl: string;
  flowAccountId: string;
  flowBatchId: string;
  promptPackId: string;
};

async function seedOutputReadinessData(runTag: string, state: Awaited<ReturnType<typeof readSmokeBootstrapState>>) {
  const client = createSmokeServiceClient();
  const caption = `Smoke caption ${runTag}`;
  const tags = `#smoke-${runTag} #output`;
  const flowAccountCode = `SMOKE_FLOW_${runTag}`;
  const promptCode = `SMOKE_PROMPT_${runTag}`;
  const batchCode = `SMOKE_BATCH_${runTag}`;
  const folderDriveId = `SMOKE-OUTPUT-${runTag}`;
  const folderDriveUrl = `https://drive.google.com/drive/folders/SMOKE-OUTPUT-${runTag}`;
  let flowAccountId = "";
  let promptPackId = "";
  let flowBatchId = "";

  try {
    const flowAccountResult = await client
      .from("flow_accounts")
      .insert({
        user_id: state.user.id,
        account_code: flowAccountCode,
        account_type: "FLOW_FREE",
        observed_daily_credit: 50,
        observed_monthly_credit: null,
        credit_per_generation: 10,
        max_parallel_allowed: 1,
        cooldown_minutes: 0,
        status: "ACTIVE",
        notes: "Seeded by Playwright smoke output detail test.",
      })
      .select("id")
      .single();

    if (flowAccountResult.error) {
      throw new Error(flowAccountResult.error.message);
    }

    flowAccountId = flowAccountResult.data.id;

    const promptPackResult = await client
      .from("prompt_packs")
      .insert({
        user_id: state.user.id,
        product_id: state.product.id,
        intake_session_id: state.intake.id,
        affiliate_profile_id: state.affiliate_profile.id,
        source_product_image_id: state.drive_items.product_image_id,
        prompt_code: promptCode,
        version: 1,
        status: "GENERATED",
        product_analysis_json: null,
        i2i_prompts_json: {},
        i2v_prompts_json: {},
        consistency_rules_json: null,
        negative_rules_json: null,
        personalization_json: {
          caption,
          tags,
          prompt_context: {
            run_tag: runTag,
            source: "smoke-test",
          },
          target_marketplace: "Shopee + TikTok",
          seed_character: {
            locked: false,
            notes: "",
            drive_item_ref_id: null,
          },
          environment: {
            locked: false,
            notes: "",
            drive_item_ref_id: null,
          },
        },
        error_message: null,
        notes: "Seeded by Playwright smoke output detail test.",
      })
      .select("id")
      .single();

    if (promptPackResult.error) {
      throw new Error(promptPackResult.error.message);
    }

    promptPackId = promptPackResult.data.id;

    const flowBatchResult = await client
      .from("flow_batches")
      .insert({
        user_id: state.user.id,
        workspace_id: state.workspace.id,
        product_id: state.product.id,
        prompt_pack_id: promptPackId,
        batch_code: batchCode,
        flow_account_id: flowAccountId,
        target_date: new Date().toISOString().slice(0, 10),
        model: "google-flow",
        max_jobs: 2,
        drive_output_folder_url: folderDriveUrl,
        drive_output_folder_id: folderDriveId,
        status: "DRAFT",
      })
      .select("id")
      .single();

    if (flowBatchResult.error) {
      throw new Error(flowBatchResult.error.message);
    }

    flowBatchId = flowBatchResult.data.id;

    return {
      caption,
      tags,
      folderDriveUrl,
      flowAccountId,
      flowBatchId,
      promptPackId,
    } satisfies SeededOutputData;
  } catch (error) {
    const cleanupOps = [
      flowBatchId ? client.from("flow_batches").delete().eq("id", flowBatchId) : null,
      promptPackId ? client.from("prompt_packs").delete().eq("id", promptPackId) : null,
      flowAccountId ? client.from("flow_accounts").delete().eq("id", flowAccountId) : null,
    ].filter(Boolean);

    for (const operation of cleanupOps) {
      const { error: cleanupError } = await operation!;

      if (cleanupError) {
        throw new Error(cleanupError.message);
      }
    }

    throw error;
  }
}

async function cleanupOutputReadinessData(state: Awaited<ReturnType<typeof readSmokeBootstrapState>>) {
  const client = createSmokeServiceClient();

  const [flowBatches, promptPacks, flowAccounts] = await Promise.all([
    client.from("flow_batches").select("id").eq("user_id", state.user.id).eq("product_id", state.product.id),
    client.from("prompt_packs").select("id").eq("user_id", state.user.id).eq("product_id", state.product.id),
    client.from("flow_accounts").select("id").eq("user_id", state.user.id).ilike("account_code", "SMOKE_FLOW_%"),
  ]);

  if (flowBatches.error) {
    throw new Error(flowBatches.error.message);
  }

  if (promptPacks.error) {
    throw new Error(promptPacks.error.message);
  }

  if (flowAccounts.error) {
    throw new Error(flowAccounts.error.message);
  }

  const flowBatchIds = (flowBatches.data ?? []).map((row) => row.id);
  const promptPackIds = (promptPacks.data ?? []).map((row) => row.id);
  const flowAccountIds = (flowAccounts.data ?? []).map((row) => row.id);

  if (flowBatchIds.length) {
    const { error } = await client.from("flow_batches").delete().in("id", flowBatchIds);

    if (error) {
      throw new Error(error.message);
    }
  }

  if (promptPackIds.length) {
    const { error } = await client.from("prompt_packs").delete().in("id", promptPackIds);

    if (error) {
      throw new Error(error.message);
    }
  }

  if (flowAccountIds.length) {
    const { error } = await client.from("flow_accounts").delete().in("id", flowAccountIds);

    if (error) {
      throw new Error(error.message);
    }
  }
}

test("product output tab is primary and renders partial copy-ready data", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const runTag = state.run_tag;
  const client = createSmokeServiceClient();
  let seeded: SeededOutputData | null = null;

  try {
    await cleanupOutputReadinessData(state);
    await page.goto(`/products?detail=${state.product.id}`);
    await expect(page.getByRole("heading", { name: "Output Siap Copy", level: 3 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Output" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Metadata Siap")).toBeVisible();
    await expect(page.getByRole("button", { name: "Salin" })).toHaveCount(5);
    await expect(page.getByText("Nama Produk").first()).toBeVisible();
    await expect(page.getByText("Keyword Etalase").first()).toBeVisible();

    seeded = await seedOutputReadinessData(runTag, state);

    await page.reload();

    await expect(page.getByRole("heading", { name: "Output Siap Copy", level: 3 })).toBeVisible();
    await expect(page.getByText("Output Siap", { exact: true }).first()).toBeVisible();
    const drawer = page.locator('aside[aria-label="Detail produk"]');
    await expect(drawer).toBeVisible();
    const drawerZIndex = await drawer.evaluate((element) => {
      const value = window.getComputedStyle(element).zIndex;
      const parsed = Number.parseInt(value, 10);

      if (Number.isNaN(parsed)) {
        throw new Error(`Product drawer z-index should be numeric, received ${value}.`);
      }

      return parsed;
    });
    const shellMainZIndex = await page.locator(".shell-main").evaluate((element) => {
      const value = window.getComputedStyle(element).zIndex;
      const parsed = Number.parseInt(value, 10);

      if (Number.isNaN(parsed)) {
        throw new Error(`Shell main z-index should be numeric, received ${value}.`);
      }

      return parsed;
    });
    const topbarZIndex = await page.locator(".operator-topbar").evaluate((element) => {
      const value = window.getComputedStyle(element).zIndex;
      const parsed = Number.parseInt(value, 10);

      if (Number.isNaN(parsed)) {
        throw new Error(`Topbar z-index should be numeric, received ${value}.`);
      }

      return parsed;
    });
    const bottomNavZIndex = await page.locator(".bottom-nav").evaluate((element) => {
      const value = window.getComputedStyle(element).zIndex;
      const parsed = Number.parseInt(value, 10);

      if (Number.isNaN(parsed)) {
        throw new Error(`Bottom nav z-index should be numeric, received ${value}.`);
      }

      return parsed;
    });
    expect(shellMainZIndex).toBeGreaterThan(topbarZIndex);
    expect(shellMainZIndex).toBeGreaterThan(bottomNavZIndex);
    const hitTestInsideDrawer = await page.evaluate(() => {
      const points = [10, 40, 70];

      return points.every((y) => {
        const element = document.elementFromPoint(20, y);

        return Boolean(element?.closest('aside[aria-label="Detail produk"]'));
      });
    });
    expect(hitTestInsideDrawer).toBe(true);
    expect(drawerZIndex).toBeGreaterThan(0);
    await expect(drawer.getByText(state.product.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(seeded.caption, { exact: true })).toBeVisible();
    await expect(page.getByText(seeded.tags, { exact: true })).toBeVisible();
    await expect(page.getByText(seeded.folderDriveUrl, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Salin" })).toHaveCount(5);
  } catch (error) {
    throw classifySmokeError("product output detail", error);
  } finally {
    if (seeded) {
      const deletions = [
        client.from("flow_batches").delete().eq("id", seeded.flowBatchId),
        client.from("prompt_packs").delete().eq("id", seeded.promptPackId),
        client.from("flow_accounts").delete().eq("id", seeded.flowAccountId),
      ] as const;

      for (const operation of deletions) {
        const { error } = await operation;

        if (error) {
          throw new Error(error.message);
        }
      }
    }
  }
});
