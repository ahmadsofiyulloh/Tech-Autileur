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

async function ensureSmokeWorkspaceDriveRoot(page: import("@playwright/test").Page, workspaceId: string, workspaceName: string) {
  const client = createSmokeServiceClient();
  await page.goto("/settings/workspace", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");

  const workspaceRow = page.locator("tr", { hasText: workspaceName }).first();
  await expect(workspaceRow).toBeVisible();
  const rowForm = workspaceRow.locator("form").first();
  await rowForm.evaluate((form) => {
    const intent = form.querySelector('input[name="intent"]');

    if (!(intent instanceof HTMLInputElement)) {
      throw new Error("Workspace form intent input was not found.");
    }

    intent.value = "provision_workspace_drive";
  });

  await rowForm.evaluate((form) => {
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Workspace form submit target was not found.");
    }

    if (typeof form.requestSubmit !== "function") {
      throw new Error("Workspace form submit is not available.");
    }

    form.requestSubmit();
  });

  await expect
    .poll(async () => {
      const { data, error } = await client
        .from("workspaces")
        .select("drive_root_folder_ref_id")
        .eq("id", workspaceId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return Boolean(data?.drive_root_folder_ref_id);
    }, { timeout: 180_000 })
    .toBeTruthy();
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

async function readSmokeWorkspaceDriveRoot(state: Awaited<ReturnType<typeof readSmokeBootstrapState>>) {
  const client = createSmokeServiceClient();
  const { data: workspace, error: workspaceError } = await client
    .from("workspaces")
    .select("drive_root_folder_ref_id")
    .eq("id", state.workspace.id)
    .eq("user_id", state.user.id)
    .maybeSingle();

  if (workspaceError) {
    throw new Error(workspaceError.message);
  }

  if (!workspace?.drive_root_folder_ref_id) {
    throw new Error("Smoke workspace root folder not found.");
  }

  const { data: driveItem, error: driveItemError } = await client
    .from("drive_items")
    .select("drive_item_id, drive_url")
    .eq("id", workspace.drive_root_folder_ref_id)
    .eq("user_id", state.user.id)
    .maybeSingle();

  if (driveItemError) {
    throw new Error(driveItemError.message);
  }

  if (!driveItem?.drive_item_id) {
    throw new Error("Smoke workspace root Drive folder ID not found.");
  }

  return {
    id: driveItem.drive_item_id,
    url: driveItem.drive_url || `https://drive.google.com/drive/folders/${driveItem.drive_item_id}`,
  };
}

type SmokeCallbackFile = {
  file_name: string;
  detected_prefix: string;
  match_status: string;
  imported_at: string;
  drive_item: {
    drive_item_id: string;
    item_type: string;
    name: string;
    drive_url: string;
    drive_path: string;
    mime_type: string;
    size_bytes: number;
    purpose: string;
    status: string;
    notes: string;
  };
};

async function applySmokeCallbackState(
  client: ReturnType<typeof createSmokeServiceClient>,
  userId: string,
  batchId: string,
  helperEventAt: string,
  generatedFiles: SmokeCallbackFile[],
) {
  for (const file of generatedFiles) {
    const driveItemId = file.drive_item.drive_item_id;
    let resolvedDriveItemRowId = "";
    const { data: existingDriveItem, error: existingDriveItemError } = await client
      .from("drive_items")
      .select("id")
      .eq("user_id", userId)
      .eq("drive_item_id", driveItemId)
      .maybeSingle();

    if (existingDriveItemError) {
      throw new Error(existingDriveItemError.message);
    }

    const driveItemPayload = {
      user_id: userId,
      item_type: file.drive_item.item_type,
      drive_item_id: driveItemId,
      parent_id: null,
      parent_drive_item_id: null,
      name: file.drive_item.name,
      drive_url: file.drive_item.drive_url,
      drive_path: file.drive_item.drive_path,
      mime_type: file.drive_item.mime_type,
      size_bytes: file.drive_item.size_bytes,
      checksum: null,
      drive_modified_at: null,
      purpose: file.drive_item.purpose,
      status: file.drive_item.status,
      notes: file.drive_item.notes,
    } as const;

    if (existingDriveItem?.id) {
      const { error: updateDriveItemError } = await client
        .from("drive_items")
        .update(driveItemPayload)
        .eq("id", existingDriveItem.id);

      if (updateDriveItemError) {
        throw new Error(updateDriveItemError.message);
      }

      resolvedDriveItemRowId = existingDriveItem.id;
    } else {
      const { data: insertedDriveItem, error: insertDriveItemError } = await client
        .from("drive_items")
        .insert(driveItemPayload)
        .select("id")
        .single();

      if (insertDriveItemError) {
        throw new Error(insertDriveItemError.message);
      }

      if (!insertedDriveItem?.id) {
        throw new Error("Failed to create smoke drive item.");
      }

      resolvedDriveItemRowId = insertedDriveItem.id;
    }

    const clipCode = file.detected_prefix.trim().toUpperCase();
    const { data: clipJob, error: clipJobError } = await client
      .from("clip_jobs")
      .select("id, status")
      .eq("user_id", userId)
      .eq("batch_id", batchId)
      .eq("clip_code", clipCode)
      .maybeSingle();

    if (clipJobError) {
      throw new Error(clipJobError.message);
    }

    if (clipJob?.id) {
      const { error: updateClipJobError } = await client
        .from("clip_jobs")
        .update({
          generated_drive_item_id: resolvedDriveItemRowId,
          status: "IMPORTED",
        })
        .eq("id", clipJob.id);

      if (updateClipJobError) {
        throw new Error(updateClipJobError.message);
      }
    }

    const { data: existingGeneratedFile, error: existingGeneratedFileError } = await client
      .from("generated_files")
      .select("id")
      .eq("user_id", userId)
      .eq("drive_item_id", resolvedDriveItemRowId)
      .maybeSingle();

    if (existingGeneratedFileError) {
      throw new Error(existingGeneratedFileError.message);
    }

    const generatedFilePayload = {
      user_id: userId,
      clip_job_id: clipJob?.id ?? null,
      drive_item_id: resolvedDriveItemRowId,
      file_name: file.file_name,
      detected_prefix: file.detected_prefix,
      match_status: file.match_status,
      imported_at: file.imported_at,
    } as const;

    if (existingGeneratedFile?.id) {
      const { error: updateGeneratedFileError } = await client
        .from("generated_files")
        .update(generatedFilePayload)
        .eq("id", existingGeneratedFile.id);

      if (updateGeneratedFileError) {
        throw new Error(updateGeneratedFileError.message);
      }
    } else {
      const { error: insertGeneratedFileError } = await client.from("generated_files").insert(generatedFilePayload);

      if (insertGeneratedFileError) {
        throw new Error(insertGeneratedFileError.message);
      }
    }
  }

  const { error: batchUpdateError } = await client
    .from("flow_batches")
    .update({
      status: "IMPORTING",
      last_helper_event_at: helperEventAt,
    })
    .eq("id", batchId)
    .eq("user_id", userId);

  if (batchUpdateError) {
    throw new Error(batchUpdateError.message);
  }

  return {
    batchStatus: "IMPORTING",
    savedFileCount: generatedFiles.length,
  };
}

test("prompt generation, flow handoff, manifest export, and helper callback stay connected", async ({ page }) => {
  const state = await readSmokeBootstrapState();
  const runTag = state.run_tag;
  const client = createSmokeServiceClient();
  await ensureSmokeWorkspaceDriveRoot(page, state.workspace.id, state.workspace.name);
  const driveOutputFolder = await readSmokeWorkspaceDriveRoot(state);
  let batchId = "";
  let batchCode = "";
  let flowAccountCode = "";
  let promptPackId = "";

  try {
    await page.goto(`/prompts?product_id=${state.product.id}&intake_id=${state.intake.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Paket Prompt", level: 1 })).toBeVisible();
    await expect(page.getByRole("main").getByText(state.product.name, { exact: true }).first()).toBeVisible();

    await ensurePromptPackGenerationMode(page);
    const createPromptButton = page.getByRole("button", { name: "Buat Prompt" });

    if (await createPromptButton.count()) {
      await createPromptButton.first().click();
    }

    await expect
      .poll(
        async () => {
          const { data, error } = await client
            .from("prompt_packs")
            .select("id")
            .eq("product_id", state.product.id)
            .eq("intake_session_id", state.intake.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            throw new Error(error.message);
          }

          return Boolean(data?.id);
        },
        { timeout: 60_000 },
      )
      .toBeTruthy();

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

    const { error: readyError } = await client.from("prompt_packs").update({ status: "APPROVED" }).eq("id", promptPackId);

    if (readyError) {
      throw new Error(readyError.message);
    }

    await page.goto("/controller", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Flow Control" })).toBeVisible();

    const flowAccountPanel = page.locator("details.controller-support-panel").first();
    const flowAccountSummary = page.locator("details.controller-support-panel > summary").first();
    if (!(await flowAccountPanel.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await flowAccountSummary.click();
    }

    await page.getByRole("button", { name: "Tambah akun" }).click();
    await expect
      .poll(async () => {
        const { data, error } = await client
          .from("flow_accounts")
          .select("account_code")
          .eq("user_id", state.user.id)
          .eq("account_type", "FLOW_FREE")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return Boolean(data?.account_code);
      })
      .toBeTruthy();

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

    await expect(page.getByRole("button", { name: "Konfirmasi batch" }).first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Konfirmasi batch" }).click();
    await expect
      .poll(async () => {
        const batch = await findLatestBatchByPromptPackId(promptPackId);
        return Boolean(batch);
      })
      .toBeTruthy();

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
    await page.getByLabel("Lane Chrome").fill("utama");
    await page.getByLabel("Folder Drive ID").fill(driveOutputFolder.id);
    await page.getByLabel("Folder Drive URL").fill(driveOutputFolder.url);
    await page.getByLabel("Output Key").fill(`smoke-helper-${runTag}`);
    await page.getByRole("button", { name: "Ekspor Manifest" }).click();

    const exportUrl = new URL(page.url());
    const exportError = exportUrl.searchParams.get("error");

    if (exportError) {
      throw new Error(exportError);
    }

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

        const manifestJson = data?.manifest_json as Record<string, unknown> | null | undefined;

        return Boolean(
          data?.manifest_json &&
            data?.flow_url &&
            data?.helper_output_folder_key &&
            data?.status === "EXPORTED" &&
            manifestJson &&
            "chrome_profile_lane_key" in manifestJson,
        );
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
      chrome_profile_lane_key: string | null;
      helper_output_folder_key: string;
      rename_pattern: string;
      jobs: Array<{ job_code: string; output_file_name: string }>;
    };

    expect(manifest.batch_id).toBe(batchId);
    expect(manifest.batch_code).toBe(batchCode);
    expect(manifest.flow_account_code).toBe(flowAccountCode);
    expect(manifest.chrome_profile_lane_key).toBe("utama");
    expect(manifest.helper_output_folder_key).toContain("helper");
    expect(manifest.rename_pattern).toContain(".mp4");
    expect(manifest.jobs).toHaveLength(2);

    const { error: runningUpdateError } = await client.from("flow_batches").update({ status: "RUNNING" }).eq("id", batchId);

    if (runningUpdateError) {
      throw new Error(runningUpdateError.message);
    }

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

    const callbackResult = await applySmokeCallbackState(
      client,
      state.user.id,
      batchId,
      callbackPayload.helper_event_at,
      callbackPayload.generated_files as SmokeCallbackFile[],
    );
    expect(callbackResult.savedFileCount).toBe(2);
    expect(callbackResult.batchStatus).toBe("IMPORTING");

    const { error: importedUpdateError } = await client.from("flow_batches").update({ status: "IMPORTED" }).eq("id", batchId);

    if (importedUpdateError) {
      throw new Error(importedUpdateError.message);
    }

    await expect
      .poll(async () => {
        const { data, error } = await client.from("flow_batches").select("status").eq("id", batchId).maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        return data?.status;
      })
      .toBe("IMPORTED");
    const importedControllerResponse = await page.request.get("/controller");
    expect(importedControllerResponse.ok()).toBeTruthy();
    const importedControllerHtml = await importedControllerResponse.text();
    expect(importedControllerHtml).toContain(batchCode);
    expect(importedControllerHtml).toContain("IMPORTED");
    const { error: closeError } = await client.from("flow_batches").update({ status: "CLOSED" }).eq("id", batchId);

    if (closeError) {
      throw new Error(closeError.message);
    }

    const closedControllerResponse = await page.request.get("/controller");
    expect(closedControllerResponse.ok()).toBeTruthy();
    const closedControllerHtml = await closedControllerResponse.text();
    expect(closedControllerHtml).toContain(batchCode);
    expect(closedControllerHtml).toContain("CLOSED");

    const metadataResponse = await page.request.get(`/products?detail=${state.product.id}&tab=metadata`);
    expect(metadataResponse.ok()).toBeTruthy();
    expect(await metadataResponse.text()).toContain("Metadata");

    const outputResponse = await page.request.get(`/products?detail=${state.product.id}&tab=output`);
    expect(outputResponse.ok()).toBeTruthy();
    expect(await outputResponse.text()).toContain("Output Siap Copy");

    const historyResponse = await page.request.get(`/products?detail=${state.product.id}&tab=history`);
    expect(historyResponse.ok()).toBeTruthy();
    expect(await historyResponse.text()).toContain("History");
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      throw classifySmokeError("prompt controller timeout", error);
    }

    throw classifySmokeError("prompt controller callback", error);
  }
});
