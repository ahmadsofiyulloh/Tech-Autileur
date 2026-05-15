import { expect, test } from "@playwright/test";
import { classifySmokeError } from "./support/blockers";
import { readSmokeBootstrapState } from "./support/bootstrap";
import { createSmokeServiceClient } from "./support/supabase";

function useMockPromptGeneration() {
  return (process.env.SMOKE_PROMPT_GENERATION_MODE ?? "mock").toLowerCase() !== "gemini";
}

async function ensurePromptPackGenerationMode(page: import("@playwright/test").Page) {
  const shouldMock = useMockPromptGeneration();

  if (!shouldMock) {
    return;
  }

  const button = page.getByRole("button", { name: "Buat Prompt" });
  if ((await button.count()) === 0) {
    return;
  }

  await button.evaluate((element) => {
    const form = element.closest("form");

    if (!form) {
      throw new Error("Prompt form was not found.");
    }

    const existing = form.querySelector('input[name="generation_mode"]');

    if (existing) {
      return;
    }

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "generation_mode";
    input.value = "mock";
    form.appendChild(input);
  });
}

async function findLatestBatchByPromptPackId(promptPackId: string) {
  const client = createSmokeServiceClient();
  const { data, error } = await client
    .from("flow_batches")
    .select("*")
    .eq("prompt_pack_id", promptPackId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | {
        id: string;
        batch_code: string;
        flow_account_id: string;
        status: string;
      }
    | null;
}

// Controller/Flow UI is frozen in Phase 1, so this bridge smoke returns in Phase 2.
test.skip("prompt generation, flow handoff, manifest export, and helper callback stay connected", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const runTag = state.run_tag;
  const client = createSmokeServiceClient();
  let batchId = "";
  let batchCode = "";
  let flowAccountCode = "";
  let helperToken = "";
  let promptPackId = "";

  try {
    await page.goto(`/prompts?product_id=${state.product.id}&intake_id=${state.intake.id}`);
    await expect(page.getByRole("heading", { name: "Paket Prompt", level: 1 })).toBeVisible();
    await expect(page.getByRole("main").getByText(state.product.name, { exact: true }).first()).toBeVisible();

    await ensurePromptPackGenerationMode(page);
    const createPromptButton = page.getByRole("button", { name: "Buat Prompt" });

    if (await createPromptButton.count()) {
      await createPromptButton.first().click();
      await expect(page.getByText("Prompt pack", { exact: true }).first()).toBeVisible();
    }

    const promptPackResult = await client
      .from("prompt_packs")
      .select("id")
      .eq("product_id", state.product.id)
      .eq("intake_session_id", state.intake.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (promptPackResult.error) {
      throw new Error(promptPackResult.error.message);
    }

    promptPackId = promptPackResult.data?.id ?? "";

    if (!promptPackId) {
      throw new Error("Prompt pack was not created.");
    }

    const readyButton = page.getByRole("button", { name: "Tandai Siap Flow" }).first();
    await expect(readyButton).toBeVisible();
    await readyButton.click();
    await expect
      .poll(async () => {
        const { data, error } = await client.from("prompt_packs").select("status").eq("id", promptPackId).maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return data?.status;
      })
      .toBe("APPROVED");

    await page.goto("/controller");
    await expect(page.getByRole("heading", { name: "Flow Control" })).toBeVisible();

    const flowAccountPanel = page.locator("details.controller-support-panel").first();
    const flowAccountSummary = page.locator("details.controller-support-panel > summary").first();
    if (!(await flowAccountPanel.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await flowAccountSummary.click();
    }

    await page.getByRole("button", { name: "Tambah akun" }).click();

    await page.waitForURL(
      (url) => url.pathname === "/controller" && (url.searchParams.get("message") === "Flow account created." || url.searchParams.has("error")),
      {
        timeout: 30_000,
      },
    );

    const flowAccountRedirect = new URL(page.url());
    const flowAccountError = flowAccountRedirect.searchParams.get("error");

    if (flowAccountError) {
      throw new Error(flowAccountError);
    }

    const createdFlowAccount = await client
      .from("flow_accounts")
      .select("id, account_code, account_type")
      .eq("user_id", state.user.id)
      .eq("account_type", "FLOW_FREE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (createdFlowAccount.error) {
      throw new Error(createdFlowAccount.error.message);
    }

    if (!createdFlowAccount.data?.account_code) {
      throw new Error("Flow account was not created.");
    }

    flowAccountCode = createdFlowAccount.data.account_code;

    await page.goto("/controller");
    await expect(page.getByText("Prompt Siap")).toBeVisible();
    await page.getByLabel("Konfirmasi akun Flow pilihan.").check();
    await page.getByRole("button", { name: "Konfirmasi batch" }).click();

    await page.waitForURL(
      (url) => url.pathname === "/controller" && (url.searchParams.get("message") === "Flow batch created." || url.searchParams.has("error")),
      { timeout: 30_000 },
    );

    const controllerUrl = new URL(page.url());
    const controllerError = controllerUrl.searchParams.get("error");

    if (controllerError) {
      throw new Error(controllerError);
    }

    const batch = await findLatestBatchByPromptPackId(promptPackId);

    if (!batch) {
      throw new Error("Batch was not created.");
    }

    batchId = batch.id;
    batchCode = batch.batch_code;

    const manifestExportPanel = page.locator("details.controller-manifest-panel").first();
    const manifestExportSummary = page.locator("details.controller-manifest-panel > summary").first();

    if (!(await manifestExportPanel.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await manifestExportSummary.click();
    }

    await page.getByLabel("Flow URL").fill("https://labs.google.com/fx/tools/flow");
    await page.getByLabel("Folder Drive ID").fill(`SMOKE-OUTPUT-${runTag}`);
    await page.getByLabel("Folder Drive URL").fill(`https://drive.google.com/drive/folders/SMOKE-OUTPUT-${runTag}`);
    await page.getByLabel("Output Key").fill(`smoke-helper-${runTag}`);
    await page.getByRole("button", { name: "Ekspor Manifest" }).click();

    await expect
      .poll(
        async () => {
          const { data, error } = await client
            .from("flow_batches")
            .select("status, manifest_json, flow_url, helper_output_folder_key")
            .eq("id", batchId)
            .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return Boolean(data?.manifest_json && data.flow_url && data.helper_output_folder_key && data.status === "EXPORTED");
        },
        { timeout: 60_000 },
      )
      .toBeTruthy();

    const manifestExportResponse = await page.request.get(`/controller/batches/${batchId}/manifest`);
    expect(manifestExportResponse.ok()).toBeTruthy();
    const manifest = (await manifestExportResponse.json()) as {
      batch_id: string;
      batch_code: string;
      flow_account_code: string;
      helper_output_folder_key: string;
      rename_pattern: string;
      jobs: Array<{ job_code: string; output_file_name: string }>;
    };

    expect(manifest.batch_id).toBe(batchId);
    expect(manifest.batch_code).toBe(batchCode);
    expect(manifest.flow_account_code).toBe(flowAccountCode);
    expect(manifest.helper_output_folder_key).toContain("helper");
    expect(manifest.rename_pattern).toContain(".mp4");
    expect(manifest.jobs).toHaveLength(2);

    await page.goto("/controller");
    await page.getByRole("button", { name: "Mulai Flow" }).first().click();
    await expect
      .poll(async () => {
        const { data, error } = await client
          .from("flow_batches")
          .select("status")
          .eq("id", batchId)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return data?.status;
      })
      .toBe("RUNNING");

    await page.goto("/controller");
    await expect(page.getByText("RUNNING")).toBeVisible();

    await page.goto("/settings/account");
    await page.getByRole("button", { name: "Buat token" }).click();
    const helperPayloadText = await page.locator("pre.json-block").innerText();
    const helperPayload = JSON.parse(helperPayloadText) as { raw_token: string };
    helperToken = helperPayload.raw_token;
    await page.getByRole("button", { name: "Simpan hash" }).click();
    await expect(page.getByText("App API Token saved")).toBeVisible();

    const callbackPayload = {
      batch_code: batchCode,
      flow_account_code: flowAccountCode,
      helper_event_at: new Date().toISOString(),
      generated_files: [
        {
          file_name: `${batchCode}_CLIP01.mp4`,
          detected_prefix: "CLIP01",
          match_status: "IMPORTED",
          imported_at: new Date().toISOString(),
          drive_item: {
            drive_item_id: `SMOKE-${runTag}-VIDEO-1`,
            item_type: "FILE",
            name: `${batchCode}_clip01.mp4`,
            drive_url: `https://drive.google.com/file/d/smoke-${runTag}-video-1/view`,
            drive_path: `/AffiliateAI/SMOKE/OUTPUT/${batchCode}/clip01.mp4`,
            mime_type: "video/mp4",
            size_bytes: 1024,
            purpose: "FINAL_VIDEO",
            status: "ACTIVE",
            notes: "Created by Playwright smoke test.",
          },
        },
        {
          file_name: `${batchCode}_CLIP02.mp4`,
          detected_prefix: "CLIP02",
          match_status: "IMPORTED",
          imported_at: new Date().toISOString(),
          drive_item: {
            drive_item_id: `SMOKE-${runTag}-VIDEO-2`,
            item_type: "FILE",
            name: `${batchCode}_clip02.mp4`,
            drive_url: `https://drive.google.com/file/d/smoke-${runTag}-video-2/view`,
            drive_path: `/AffiliateAI/SMOKE/OUTPUT/${batchCode}/clip02.mp4`,
            mime_type: "video/mp4",
            size_bytes: 1024,
            purpose: "FINAL_VIDEO",
            status: "ACTIVE",
            notes: "Created by Playwright smoke test.",
          },
        },
      ],
    };

    const callbackResponse = await page.request.post("/api/helper/callback", {
      headers: {
        Authorization: `Bearer ${helperToken}`,
      },
      data: callbackPayload,
    });

    if (!callbackResponse.ok()) {
      throw new Error(`Helper callback failed (${callbackResponse.status()}): ${await callbackResponse.text()}`);
    }

    const callbackResult = (await callbackResponse.json()) as { batchStatus: string; savedFileCount: number };
    expect(callbackResult.savedFileCount).toBe(2);
    expect(callbackResult.batchStatus).toBe("IMPORTING");

    await page.goto("/controller");
    await expect(page.getByText("Output Masuk")).toBeVisible();
    await expect(page.getByText("IMPORTING")).toBeVisible();
    await page.getByRole("button", { name: "Tandai Masuk" }).first().click();
    await expect(page.getByText("IMPORTED")).toBeVisible();
    await page.getByRole("button", { name: "Tutup" }).first().click();
    await expect(page.getByText("CLOSED", { exact: true })).toBeVisible();

    await page.goto(`/products?detail=${state.product.id}&tab=metadata`);
    await expect(page.getByRole("link", { name: "Metadata" })).toHaveAttribute("aria-current", "page");
    await page.goto(`/products?detail=${state.product.id}&tab=output`);
    await expect(page.getByRole("heading", { name: "Output Siap Copy", exact: true })).toBeVisible();
    await page.goto(`/products?detail=${state.product.id}&tab=history`);
    await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      throw classifySmokeError("prompt controller timeout", error);
    }

    throw classifySmokeError("prompt controller callback", error);
  }
});
