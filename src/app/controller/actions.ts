"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { buildClipJobDraft, buildPromptContextSummary, materializeFlowBatchClipJobs } from "@/lib/server/controller";
import { createContent, archiveContent, updateContent } from "@/lib/server/contents";
import { createFlowAccount, archiveFlowAccount, getFlowAccountPool, updateFlowAccount } from "@/lib/server/flow-accounts";
import { archiveFlowBatch, buildFlowBatchCode, createFlowBatch, updateFlowBatch } from "@/lib/server/flow-batches";
import { exportFlowBatchManifest } from "@/lib/server/flow-manifests";
import { archiveClipJob, createClipJob, markGeneratedFileImported, updateClipJob, updateGeneratedFile } from "@/lib/server/clip-jobs";
import { createGeneratedFile } from "@/lib/server/clip-jobs";
import { getContentById } from "@/lib/server/contents";
import { getFlowBatchById } from "@/lib/server/flow-batches";
import { getPromptPackById, markPromptPackReadyForFlow } from "@/lib/server/prompt-packs";

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

function done(message: string): never {
  redirect(`/controller?message=${encodeURIComponent(message)}`);
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

export async function saveController(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");

  try {
    if (intent === "create_flow_account") {
      await createFlowAccount({
        account_type: readText(formData, "account_type"),
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
      const promptPack = promptPackId ? await getPromptPackById(promptPackId) : null;
      const targetDate = readNullableText(formData, "target_date");
      const flowAccountPool = await getFlowAccountPool({ targetDate });
      const selectedAccount = flowAccountPool.find((account) => account.id === flowAccountId) ?? null;

      if (!confirmed) {
        throw new Error("Konfirmasi akun Flow diperlukan.");
      }

      if (!flowAccountId) {
        throw new Error("Flow account is required.");
      }

      if (!selectedAccount || !selectedAccount.is_available) {
        throw new Error("Selected Flow account is unavailable.");
      }

      const batch = await createFlowBatch({
        workspace_id: readNullableText(formData, "workspace_id"),
        product_id: readNullableText(formData, "product_id") ?? (promptPack ? promptPack.product_id : null),
        prompt_pack_id: promptPackId,
        flow_account_id: flowAccountId,
        batch_code: buildFlowBatchCode({
          promptPackCode: promptPack?.prompt_code ?? "FLOW",
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
