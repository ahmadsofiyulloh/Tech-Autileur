"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { autoAssignReadyPromptPacks, buildClipJobDraft, buildPromptContextSummary } from "@/lib/server/controller";
import { createContent, archiveContent, updateContent } from "@/lib/server/contents";
import { createFlowAccount, archiveFlowAccount, updateFlowAccount } from "@/lib/server/flow-accounts";
import { archiveFlowBatch, createFlowBatch, updateFlowBatch } from "@/lib/server/flow-batches";
import { archiveClipJob, createClipJob, markGeneratedFileImported, updateClipJob, updateGeneratedFile } from "@/lib/server/clip-jobs";
import { createGeneratedFile } from "@/lib/server/clip-jobs";
import { getContentById } from "@/lib/server/contents";
import { getFlowBatchById } from "@/lib/server/flow-batches";
import { getPromptPackById } from "@/lib/server/prompt-packs";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readNullableText(formData: FormData, key: string) {
  const value = readText(formData, key);
  return value.length > 0 ? value : null;
}

function done(message: string): never {
  redirect(`/controller?message=${encodeURIComponent(message)}`);
}

function fail(message: string): never {
  redirect(`/controller?error=${encodeURIComponent(message)}`);
}

function revalidateController() {
  revalidatePath("/controller");
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

export async function saveController(formData: FormData) {
  const intent = readText(formData, "intent");
  const id = readText(formData, "id");

  try {
    if (intent === "auto_assign_ready_prompt_packs") {
      const result = await autoAssignReadyPromptPacks({ targetDate: readNullableText(formData, "target_date") });
      revalidateController();
      done(`Auto-assigned ${result.createdBatches.length} batch(es); skipped ${result.skipped}.`);
    }

    if (intent === "create_flow_account") {
      await createFlowAccount({
        account_code: readText(formData, "account_code"),
        account_type: readText(formData, "account_type"),
        observed_daily_credit: readNumber(formData, "observed_daily_credit"),
        observed_monthly_credit: readNumber(formData, "observed_monthly_credit"),
        credit_per_generation: readNumber(formData, "credit_per_generation"),
        max_parallel_allowed: readNumber(formData, "max_parallel_allowed"),
        cooldown_minutes: readNumber(formData, "cooldown_minutes"),
        status: readText(formData, "status"),
        notes: readNullableText(formData, "notes"),
      });
      done("Flow account created.");
    }

    if (intent === "update_flow_account") {
      if (!id) {
        throw new Error("Missing flow account id.");
      }

      await updateFlowAccount(id, {
        account_code: readText(formData, "account_code"),
        account_type: readText(formData, "account_type"),
        observed_daily_credit: readNumber(formData, "observed_daily_credit"),
        observed_monthly_credit: readNumber(formData, "observed_monthly_credit"),
        credit_per_generation: readNumber(formData, "credit_per_generation"),
        max_parallel_allowed: readNumber(formData, "max_parallel_allowed"),
        cooldown_minutes: readNumber(formData, "cooldown_minutes"),
        status: readText(formData, "status"),
        notes: readNullableText(formData, "notes"),
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
      const promptPackId = readNullableText(formData, "prompt_pack_id");
      const promptPack = promptPackId ? await getPromptPackById(promptPackId) : null;

      await createFlowBatch({
        workspace_id: readNullableText(formData, "workspace_id"),
        product_id: readNullableText(formData, "product_id") ?? (promptPack ? promptPack.product_id : null),
        prompt_pack_id: promptPackId,
        flow_account_id: flowAccountId,
        batch_code: readText(formData, "batch_code"),
        target_date: readNullableText(formData, "target_date") ?? undefined,
        model: readText(formData, "model"),
        max_jobs: readNumber(formData, "max_jobs"),
        drive_output_folder_url: readNullableText(formData, "drive_output_folder_url"),
        drive_output_folder_id: readNullableText(formData, "drive_output_folder_id"),
        status: readText(formData, "status"),
      });
      done("Flow batch created.");
    }

    if (intent === "update_flow_batch") {
      if (!id) {
        throw new Error("Missing flow batch id.");
      }

      await updateFlowBatch(id, {
        flow_account_id: readNullableText(formData, "flow_account_id") ?? undefined,
        batch_code: readText(formData, "batch_code"),
        target_date: readNullableText(formData, "target_date") ?? undefined,
        model: readText(formData, "model"),
        max_jobs: readNumber(formData, "max_jobs"),
        drive_output_folder_url: readNullableText(formData, "drive_output_folder_url"),
        drive_output_folder_id: readNullableText(formData, "drive_output_folder_id"),
        status: readText(formData, "status"),
      });
      done("Flow batch updated.");
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
        content_code: readText(formData, "content_code"),
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
        content_code: readText(formData, "content_code"),
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
        job_code: readText(formData, "job_code"),
        clip_code: readText(formData, "clip_code"),
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
        job_code: readText(formData, "job_code"),
        clip_code: readText(formData, "clip_code"),
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
    const message = error instanceof Error ? error.message : "Controller operation failed.";
    fail(message);
  }
}
