"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import {
  buildClipJobDraft,
  buildFlowAssignmentPlan,
  CONTROLLER_BATCH_SELECTION_HARD_CAP,
  buildPromptContextSummary,
  materializeFlowBatchClipJobs,
} from "@/lib/server/controller";
import { createContent, archiveContent, updateContent } from "@/lib/server/contents";
import { createFlowAccount, archiveFlowAccount, getFlowAccountPool, updateFlowAccount } from "@/lib/server/flow-accounts";
import { archiveFlowBatch, buildFlowBatchCode, createFlowBatch, listFlowBatches, updateFlowBatch } from "@/lib/server/flow-batches";
import { exportFlowBatchManifest } from "@/lib/server/flow-manifests";
import { archiveClipJob, createClipJob, markGeneratedFileImported, updateClipJob, updateGeneratedFile } from "@/lib/server/clip-jobs";
import { createGeneratedFile } from "@/lib/server/clip-jobs";
import { getContentById } from "@/lib/server/contents";
import { getFlowBatchById } from "@/lib/server/flow-batches";
import { getPromptPackById, listPromptPacks, markPromptPackReadyForFlow } from "@/lib/server/prompt-packs";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { PROMPT_READY_FOR_FLOW_STATUS } from "@/lib/prompts/validation";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNullableText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value.length > 0 ? value : null;
}

function readOptionalText(formData: FormData, key: string) {
  return formData.has(key) ? readText(formData, key) : undefined;
}

function readOptionalNullableText(formData: FormData, key: string) {
  return formData.has(key) ? readNullableText(formData, key) : undefined;
}

function readMultiText(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function done(message: string): never {
  redirect(`/controller?message=${encodeURIComponent(message)}`);
}

function warn(message: string): never {
  redirect(`/controller?warning=${encodeURIComponent(message)}`);
}

function fail(message: string): never {
  redirect(`/controller?error=${encodeURIComponent(message)}`);
}

function readNumber(formData: FormData, key: string) {
  const value = readText(formData, key);
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${key} must be a whole number.`);
  }

  return parsed;
}

function readOptionalNumber(formData: FormData, key: string) {
  return formData.has(key) ? readNumber(formData, key) : undefined;
}

function summarizeSkippedReasons(reasons: string[]) {
  const reasonCounts = new Map<string, number>();

  for (const reason of reasons) {
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  return Array.from(reasonCounts.entries())
    .slice(0, 3)
    .map(([reason, count]) => (count > 1 ? `${count}x ${reason}` : reason))
    .join("; ");
}

function summarizeBatchCreationResult(createdCount: number, skippedReasons: string[]) {
  const skippedCount = skippedReasons.length;
  const summary = createdCount > 0 ? `${createdCount} batch dibuat` : "0 batch dibuat";
  const skippedSummary = skippedCount > 0 ? `, ${skippedCount} dilewati` : "";
  const reasonSummary = skippedCount > 0 ? `: ${summarizeSkippedReasons(skippedReasons)}` : "";

  return skippedCount > 0 ? `${summary}${skippedSummary}${reasonSummary}` : `${summary}.`;
}

export async function saveController(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");

  try {
    if (intent === "create_flow_account") {
      await createFlowAccount({
        account_type: readText(formData, "account_type"),
        chrome_profile_lane_key: readNullableText(formData, "chrome_profile_lane_key"),
        observed_daily_credit: readNumber(formData, "observed_daily_credit"),
        observed_monthly_credit: readNumber(formData, "observed_monthly_credit"),
        credit_per_generation: readNumber(formData, "credit_per_generation"),
        max_parallel_allowed: readNumber(formData, "max_parallel_allowed"),
        cooldown_minutes: readNumber(formData, "cooldown_minutes"),
        status: readText(formData, "status"),
      });
      done("Flow account created.");
    }

    if (intent === "update_flow_account") {
      if (!id) {
        throw new Error("Missing flow account id.");
      }

      await updateFlowAccount(id, {
        account_type: readOptionalText(formData, "account_type"),
        chrome_profile_lane_key: readNullableText(formData, "chrome_profile_lane_key"),
        observed_daily_credit: readNumber(formData, "observed_daily_credit"),
        observed_monthly_credit: readNumber(formData, "observed_monthly_credit"),
        credit_per_generation: readNumber(formData, "credit_per_generation"),
        max_parallel_allowed: readNumber(formData, "max_parallel_allowed"),
        cooldown_minutes: readNumber(formData, "cooldown_minutes"),
        status: readOptionalText(formData, "status"),
      });
      done("Flow account updated.");
    }

    if (intent === "archive_flow_account") {
      if (!id) {
        throw new Error("Missing flow account id.");
      }

      await archiveFlowAccount(id);
      done("Flow account archived.");
    }

    if (intent === "create_flow_batch") {
      const flowAccountId = readText(formData, "flow_account_id");
      const confirmed = formData.get("confirm_flow_account") === "on";
      const promptPackId = readNullableText(formData, "prompt_pack_id");
      const targetDate = readNullableText(formData, "target_date");

      if (!promptPackId) {
        throw new Error("Prompt pack wajib dipilih.");
      }

      const promptPack = await getPromptPackById(promptPackId);
      if (!flowAccountId) {
        throw new Error("Akun Flow wajib dipilih.");
      }

      if (!confirmed) {
        throw new Error("Konfirmasi akun Flow diperlukan.");
      }

      const flowAccountPool = await getFlowAccountPool({ targetDate });
      const selectedAccount = flowAccountPool.find((account) => account.id === flowAccountId) ?? null;

      // Lane key labels are stored on the account; helper verification remains a separate runtime step.
      if (!selectedAccount || !selectedAccount.is_available) {
        throw new Error("Akun Flow tidak tersedia.");
      }

      const batch = await createFlowBatch({
        workspace_id: readNullableText(formData, "workspace_id"),
        product_id: readNullableText(formData, "product_id") ?? promptPack.product_id,
        prompt_pack_id: promptPackId,
        flow_account_id: flowAccountId,
        batch_code: buildFlowBatchCode({
          promptPackCode: promptPack.prompt_code,
          accountCode: selectedAccount.account_code,
          targetDate: targetDate ?? undefined,
        }),
        target_date: targetDate ?? undefined,
        model: readText(formData, "model"),
        max_jobs: selectedAccount.recommended_max_jobs,
        drive_output_folder_url: readNullableText(formData, "drive_output_folder_url"),
        drive_output_folder_id: readNullableText(formData, "drive_output_folder_id"),
        flow_url: readNullableText(formData, "flow_url"),
        helper_output_folder_key: readNullableText(formData, "helper_output_folder_key"),
        status: readText(formData, "status"),
      });
      await materializeFlowBatchClipJobs(batch.id);
      done("Flow batch created.");
    }

    if (intent === "create_flow_batch_many") {
      const currentWorkspace = await getCurrentWorkspace();
      const targetDate = readNullableText(formData, "target_date") ?? todayInJakarta();
      const selectedPromptPackIds = Array.from(new Set(readMultiText(formData, "prompt_pack_ids")));

      if (!currentWorkspace) {
        throw new Error("Choose an active workspace.");
      }

      if (!selectedPromptPackIds.length) {
        throw new Error("Prompt pack wajib dipilih.");
      }

      if (selectedPromptPackIds.length > CONTROLLER_BATCH_SELECTION_HARD_CAP) {
        throw new Error(`Maksimal ${CONTROLLER_BATCH_SELECTION_HARD_CAP} prompt pack.`);
      }

      const activePromptPacks = (await listPromptPacks({
        workspaceId: currentWorkspace.id,
        status: PROMPT_READY_FOR_FLOW_STATUS,
        limit: 200,
      })) as Parameters<typeof buildFlowAssignmentPlan>[0]["promptPacks"];
      const selectedPromptPackIdSet = new Set(selectedPromptPackIds);
      const selectedPromptPacks = activePromptPacks.filter((promptPack) => selectedPromptPackIdSet.has(promptPack.id));

      if (selectedPromptPacks.length !== selectedPromptPackIds.length) {
        throw new Error("Prompt pack tidak aktif.");
      }

      const flowAccountPool = await getFlowAccountPool({ targetDate });
      const openPromptPackBatchIds = new Set(
        (await listFlowBatches({ workspaceId: currentWorkspace.id, limit: 200 }))
          .filter((batch) => batch.prompt_pack_id && batch.status !== "CLOSED")
          .map((batch) => batch.prompt_pack_id as string),
      );
      const assignmentPlan = buildFlowAssignmentPlan({
        promptPacks: selectedPromptPacks,
        accounts: flowAccountPool,
        existingPromptPackIds: openPromptPackBatchIds,
      });
      const skippedReasons = assignmentPlan.filter((item) => item.status === "SKIPPED").map((item) => item.reason);
      const createdBatchIds: string[] = [];

      for (const planItem of assignmentPlan) {
        if (planItem.status !== "READY") {
          continue;
        }

        const promptPack = selectedPromptPacks.find((item) => item.id === planItem.promptPackId);

        if (!promptPack) {
          throw new Error("Prompt pack tidak aktif.");
        }

        const batch = await createFlowBatch({
          workspace_id: currentWorkspace.id,
          product_id: promptPack.product_id,
          prompt_pack_id: promptPack.id,
          flow_account_id: planItem.recommendedAccountId,
          batch_code: buildFlowBatchCode({
            promptPackCode: planItem.promptPackCode,
            accountCode: planItem.recommendedAccountCode,
            targetDate,
          }),
          target_date: targetDate,
          model: "google-flow",
          max_jobs: planItem.recommendedMaxJobs,
          status: "READY_TO_EXPORT",
        });

        await materializeFlowBatchClipJobs(batch.id);
        createdBatchIds.push(batch.id);
      }

      const summary = summarizeBatchCreationResult(createdBatchIds.length, skippedReasons);

      if (skippedReasons.length > 0) {
        warn(summary);
      }

      done(summary);
    }

    if (intent === "mark_prompt_ready") {
      if (!id) {
        throw new Error("Missing prompt pack id.");
      }

      await markPromptPackReadyForFlow(id);
      done("Prompt siap Flow.");
    }

    if (intent === "update_flow_batch") {
      if (!id) {
        throw new Error("Missing flow batch id.");
      }

      await updateFlowBatch(id, {
        flow_account_id: readOptionalNullableText(formData, "flow_account_id") ?? undefined,
        target_date: readOptionalNullableText(formData, "target_date") ?? undefined,
        model: readOptionalText(formData, "model"),
        max_jobs: readOptionalNumber(formData, "max_jobs"),
        drive_output_folder_url: readOptionalNullableText(formData, "drive_output_folder_url"),
        drive_output_folder_id: readOptionalNullableText(formData, "drive_output_folder_id"),
        flow_url: readOptionalNullableText(formData, "flow_url"),
        helper_output_folder_key: readOptionalNullableText(formData, "helper_output_folder_key"),
        status: readOptionalText(formData, "status"),
      });
      done("Flow batch updated.");
    }

    if (intent === "export_flow_manifest") {
      if (!id) {
        throw new Error("Missing flow batch id.");
      }

      await materializeFlowBatchClipJobs(id);
      await exportFlowBatchManifest(id, {
        flow_url: readNullableText(formData, "flow_url"),
        drive_output_folder_id: readNullableText(formData, "drive_output_folder_id"),
        drive_output_folder_url: readNullableText(formData, "drive_output_folder_url"),
        helper_output_folder_key: readNullableText(formData, "helper_output_folder_key"),
        chrome_profile_lane_key: readNullableText(formData, "chrome_profile_lane_key"),
      });
      redirect(`/controller/batches/${id}/manifest`);
    }

    if (intent === "archive_flow_batch") {
      if (!id) {
        throw new Error("Missing flow batch id.");
      }

      await archiveFlowBatch(id);
      done("Flow batch closed.");
    }

    if (intent === "create_content") {
      await createContent({
        product_id: readText(formData, "product_id"),
        platform: readNullableText(formData, "platform"),
        hook_type: readNullableText(formData, "hook_type"),
        angle: readNullableText(formData, "angle"),
        caption_tiktok: readNullableText(formData, "caption_tiktok"),
        caption_shopee: readNullableText(formData, "caption_shopee"),
        prompt_pack_id: readNullableText(formData, "prompt_pack_id"),
        status: readText(formData, "status"),
      });
      done("Content created.");
    }

    if (intent === "update_content") {
      if (!id) {
        throw new Error("Missing content id.");
      }

      await updateContent(id, {
        product_id: readNullableText(formData, "product_id") ?? undefined,
        platform: readNullableText(formData, "platform"),
        hook_type: readNullableText(formData, "hook_type"),
        angle: readNullableText(formData, "angle"),
        caption_tiktok: readNullableText(formData, "caption_tiktok"),
        caption_shopee: readNullableText(formData, "caption_shopee"),
        prompt_pack_id: readNullableText(formData, "prompt_pack_id"),
        status: readText(formData, "status"),
      });
      done("Content updated.");
    }

    if (intent === "archive_content") {
      if (!id) {
        throw new Error("Missing content id.");
      }

      await archiveContent(id);
      done("Content archived.");
    }

    if (intent === "create_clip_job") {
      const contentId = readText(formData, "content_id");
      const content = await getContentById(contentId);

      if (!content) {
        throw new Error("Content not found.");
      }

      const batchId = readNullableText(formData, "batch_id");
      const batch = batchId ? await getFlowBatchById(batchId) : null;
      const promptPackId = readNullableText(formData, "prompt_pack_id") ?? content.prompt_pack_id ?? batch?.prompt_pack_id ?? null;
      const promptPack = promptPackId ? await getPromptPackById(promptPackId) : null;
      const draft = buildClipJobDraft({
        content: {
          ...content,
          prompt_context_summary: promptPack ? buildPromptContextSummary(promptPack) : "No persisted prompt context.",
          prompt_snippet: promptPack ? "Controller draft" : content.content_code,
        },
        promptPack,
        batch,
      });

      await createClipJob({
        content_id: contentId,
        prompt_pack_id: promptPackId,
        batch_id: batchId,
        version: readText(formData, "version"),
        prompt_prefix: readText(formData, "prompt_prefix") || draft.prompt_prefix,
        prompt_one_paragraph: readText(formData, "prompt_one_paragraph") || draft.prompt_one_paragraph,
        start_frame_drive_item_id: readNullableText(formData, "start_frame_drive_item_id"),
        last_frame_drive_item_id: readNullableText(formData, "last_frame_drive_item_id"),
        generated_drive_item_id: readNullableText(formData, "generated_drive_item_id"),
        status: readText(formData, "status"),
      });
      done("Clip job created.");
    }

    if (intent === "update_clip_job") {
      if (!id) {
        throw new Error("Missing clip job id.");
      }

      await updateClipJob(id, {
        content_id: readNullableText(formData, "content_id") ?? undefined,
        prompt_pack_id: readNullableText(formData, "prompt_pack_id"),
        batch_id: readNullableText(formData, "batch_id"),
        version: readText(formData, "version"),
        prompt_prefix: readText(formData, "prompt_prefix"),
        prompt_one_paragraph: readText(formData, "prompt_one_paragraph"),
        start_frame_drive_item_id: readNullableText(formData, "start_frame_drive_item_id"),
        last_frame_drive_item_id: readNullableText(formData, "last_frame_drive_item_id"),
        generated_drive_item_id: readNullableText(formData, "generated_drive_item_id"),
        status: readText(formData, "status"),
      });
      done("Clip job updated.");
    }

    if (intent === "archive_clip_job") {
      if (!id) {
        throw new Error("Missing clip job id.");
      }

      await archiveClipJob(id);
      done("Clip job archived.");
    }

    if (intent === "create_generated_file") {
      await createGeneratedFile({
        clip_job_id: readNullableText(formData, "clip_job_id"),
        drive_item_id: readText(formData, "drive_item_id"),
        file_name: readText(formData, "file_name"),
        detected_prefix: readNullableText(formData, "detected_prefix"),
        match_status: readText(formData, "match_status"),
        imported_at: readNullableText(formData, "imported_at"),
      });
      done("Generated file recorded.");
    }

    if (intent === "update_generated_file") {
      if (!id) {
        throw new Error("Missing generated file id.");
      }

      await updateGeneratedFile(id, {
        clip_job_id: readNullableText(formData, "clip_job_id"),
        drive_item_id: readText(formData, "drive_item_id"),
        file_name: readText(formData, "file_name"),
        detected_prefix: readNullableText(formData, "detected_prefix"),
        match_status: readText(formData, "match_status"),
        imported_at: readNullableText(formData, "imported_at"),
      });
      done("Generated file updated.");
    }

    if (intent === "mark_generated_file_imported") {
      if (!id) {
        throw new Error("Missing generated file id.");
      }

      await markGeneratedFileImported(id);
      done("Generated file marked imported.");
    }

    throw new Error("Unsupported controller action.");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Controller operation failed.";
    fail(message);
  }
}
