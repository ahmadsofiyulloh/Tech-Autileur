import "server-only";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getContentById } from "@/lib/server/contents";
import { getDriveItemById } from "@/lib/server/drive-items";
import { getFlowBatchById } from "@/lib/server/flow-batches";
import { getPromptPackById } from "@/lib/server/prompt-packs";

export const CLIP_JOB_STATUSES = [
  "DRAFT",
  "READY",
  "RUNNING",
  "IMPORTING",
  "IMPORTED",
  "NEEDS_REVIEW",
  "APPROVED",
  "ERROR",
  "ARCHIVED",
] as const;

export const GENERATED_FILE_MATCH_STATUSES = ["UNMATCHED", "MATCHED", "IMPORTED", "NEEDS_REVIEW", "ERROR"] as const;

export type ClipJobStatus = (typeof CLIP_JOB_STATUSES)[number];
export type GeneratedFileMatchStatus = (typeof GENERATED_FILE_MATCH_STATUSES)[number];

export type ClipJobRecord = {
  id: string;
  user_id: string;
  content_id: string;
  prompt_pack_id: string | null;
  batch_id: string | null;
  job_code: string;
  clip_code: string;
  version: string;
  prompt_prefix: string;
  prompt_one_paragraph: string;
  start_frame_drive_item_id: string | null;
  last_frame_drive_item_id: string | null;
  generated_drive_item_id: string | null;
  status: ClipJobStatus | string;
  created_at: string;
  updated_at: string;
};

export type GeneratedFileRecord = {
  id: string;
  user_id: string;
  clip_job_id: string | null;
  drive_item_id: string;
  file_name: string;
  detected_prefix: string | null;
  match_status: GeneratedFileMatchStatus | string;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
};

type ClipJobInput = {
  content_id: string;
  prompt_pack_id?: string | null;
  batch_id?: string | null;
  job_code?: string;
  clip_code?: string;
  version?: string;
  prompt_prefix?: string;
  prompt_one_paragraph?: string;
  start_frame_drive_item_id?: string | null;
  last_frame_drive_item_id?: string | null;
  generated_drive_item_id?: string | null;
  status?: string;
};

type ClipJobUpdateInput = Partial<ClipJobInput>;

type GeneratedFileInput = {
  clip_job_id?: string | null;
  drive_item_id: string;
  file_name?: string;
  detected_prefix?: string | null;
  match_status?: string;
  imported_at?: string | null;
};

type GeneratedFileUpdateInput = Partial<GeneratedFileInput>;

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = readText(value);
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStatus(value: string | null | undefined, fallback = "DRAFT") {
  const trimmed = readText(value);
  return trimmed ? trimmed.toUpperCase() : fallback;
}

function assertClipJobStatus(value: string) {
  if (!(CLIP_JOB_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Invalid clip job status. Expected one of: ${CLIP_JOB_STATUSES.join(", ")}.`);
  }
}

function assertGeneratedFileMatchStatus(value: string) {
  if (!(GENERATED_FILE_MATCH_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Invalid generated file match status. Expected one of: ${GENERATED_FILE_MATCH_STATUSES.join(", ")}.`);
  }
}

function buildCode(prefix: string, parts: Array<string | null | undefined>) {
  const normalizedParts = parts
    .map((part) => readText(part))
    .filter(Boolean)
    .map((part) => part.replace(/[^A-Za-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""));
  const normalizedPrefix = readText(prefix).replace(/[^A-Za-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const base = [normalizedPrefix, ...normalizedParts].filter(Boolean).join("-");
  return `${(base || normalizedPrefix || "ITEM").toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

async function requireOwnedClipJob(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, clipJobId: string) {
  const { data, error } = await supabase
    .from("clip_jobs")
    .select("*")
    .eq("id", clipJobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Clip job not found.");
  }

  return data as ClipJobRecord;
}

async function requireOwnedGeneratedFile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  generatedFileId: string,
) {
  const { data, error } = await supabase
    .from("generated_files")
    .select("*")
    .eq("id", generatedFileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Generated file not found.");
  }

  return data as GeneratedFileRecord;
}

async function validateClipJobReferences(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  contentId: string,
  input: ClipJobInput,
) {
  const content = await getContentById(contentId);

  if (!content) {
    throw new Error("Content not found.");
  }

  const promptPackId = normalizeNullableText(input.prompt_pack_id) ?? content.prompt_pack_id;
  const batchId = normalizeNullableText(input.batch_id);

  let batch = null as Awaited<ReturnType<typeof getFlowBatchById>> | null;

  if (batchId) {
    batch = await getFlowBatchById(batchId);

    if (!batch) {
      throw new Error("Flow batch not found.");
    }

    if (batch.product_id && batch.product_id !== content.product_id) {
      throw new Error("Flow batch must belong to the same product as the content.");
    }

    if (batch.prompt_pack_id && promptPackId && batch.prompt_pack_id !== promptPackId) {
      throw new Error("Batch prompt pack must match the selected prompt pack.");
    }
  }

  let promptPack = null as Awaited<ReturnType<typeof getPromptPackById>> | null;

  if (promptPackId) {
    promptPack = (await getPromptPackById(promptPackId)) as Awaited<ReturnType<typeof getPromptPackById>> | null;

    if (!promptPack) {
      throw new Error("Prompt pack not found.");
    }

    if (promptPack.product_id !== content.product_id) {
      throw new Error("Prompt pack must belong to the same product as the content.");
    }
  }

  const driveItemIds = [input.start_frame_drive_item_id, input.last_frame_drive_item_id, input.generated_drive_item_id]
    .map((value) => normalizeNullableText(value))
    .filter((value): value is string => Boolean(value));

  for (const driveItemId of driveItemIds) {
    const driveItem = await getDriveItemById(driveItemId);

    if (!driveItem) {
      throw new Error("Drive item not found.");
    }
  }

  const clipCode = normalizeNullableText(input.clip_code) ?? "CLIP";
  const jobCode = normalizeNullableText(input.job_code) ?? buildCode("JOB", [content.content_code, clipCode]);
  const promptPrefix =
    normalizeNullableText(input.prompt_prefix) ??
    `${promptPack ? `${promptPack.prompt_code} ` : ""}${content.content_code} ${clipCode}`.trim();
  const promptOneParagraph =
    normalizeNullableText(input.prompt_one_paragraph) ??
    `Controller draft for ${content.content_code}${batch ? ` in batch ${batch.batch_code}` : ""}.`;

  return {
    content,
    promptPackId,
    batchId,
    jobCode: jobCode.toUpperCase(),
    clipCode: clipCode.toUpperCase(),
    promptPrefix,
    promptOneParagraph,
  };
}

export async function listClipJobs(input?: {
  contentId?: string | null;
  batchId?: string | null;
  promptPackId?: string | null;
  status?: string;
  limit?: number;
}) {
  const { supabase, user } = await requireUser();
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("clip_jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.contentId) {
    query = query.eq("content_id", input.contentId);
  }

  if (input?.batchId) {
    query = query.eq("batch_id", input.batchId);
  }

  if (input?.promptPackId) {
    query = query.eq("prompt_pack_id", input.promptPackId);
  }

  if (input?.status) {
    query = query.eq("status", normalizeStatus(input.status));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ClipJobRecord[];
}

export async function getClipJobById(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("clip_jobs").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ClipJobRecord | null;
}

export async function createClipJob(input: ClipJobInput) {
  const { supabase, user } = await requireUser();
  const contentId = readText(input.content_id);

  if (!contentId) {
    throw new Error("Content is required.");
  }

  const resolved = await validateClipJobReferences(supabase, user.id, contentId, input);
  const status = input.status ? (assertClipJobStatus(input.status), input.status) : "DRAFT";
  const version = readText(input.version) || "V01";
  const { data, error } = await supabase
    .from("clip_jobs")
    .insert({
      user_id: user.id,
      content_id: contentId,
      prompt_pack_id: resolved.promptPackId,
      batch_id: resolved.batchId,
      job_code: resolved.jobCode,
      clip_code: resolved.clipCode,
      version,
      prompt_prefix: resolved.promptPrefix,
      prompt_one_paragraph: resolved.promptOneParagraph,
      start_frame_drive_item_id: normalizeNullableText(input.start_frame_drive_item_id),
      last_frame_drive_item_id: normalizeNullableText(input.last_frame_drive_item_id),
      generated_drive_item_id: normalizeNullableText(input.generated_drive_item_id),
      status,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/controller");
  return data as ClipJobRecord;
}

export async function updateClipJob(id: string, input: ClipJobUpdateInput) {
  const { supabase, user } = await requireUser();
  const current = await requireOwnedClipJob(supabase, user.id, id);
  const patch: Partial<ClipJobRecord> = {};

  if (input.content_id !== undefined) {
    const contentId = readText(input.content_id);
    if (!contentId) {
      throw new Error("Content is required.");
    }

    await validateClipJobReferences(supabase, user.id, contentId, { ...current, ...input, content_id: contentId });
    patch.content_id = contentId;
  }

  if (input.prompt_pack_id !== undefined) {
    patch.prompt_pack_id = normalizeNullableText(input.prompt_pack_id);
  }

  if (input.batch_id !== undefined) {
    patch.batch_id = normalizeNullableText(input.batch_id);
  }

  if (input.job_code !== undefined) {
    const jobCode = readText(input.job_code);
    if (!jobCode) {
      throw new Error("Job code is required.");
    }

    patch.job_code = jobCode.toUpperCase();
  }

  if (input.clip_code !== undefined) {
    const clipCode = readText(input.clip_code);
    if (!clipCode) {
      throw new Error("Clip code is required.");
    }

    patch.clip_code = clipCode.toUpperCase();
  }

  if (input.version !== undefined) {
    const version = readText(input.version);
    if (!version) {
      throw new Error("Version is required.");
    }

    patch.version = version;
  }

  if (input.prompt_prefix !== undefined) {
    const promptPrefix = readText(input.prompt_prefix);
    if (!promptPrefix) {
      throw new Error("Prompt prefix is required.");
    }

    patch.prompt_prefix = promptPrefix;
  }

  if (input.prompt_one_paragraph !== undefined) {
    const promptOneParagraph = readText(input.prompt_one_paragraph);
    if (!promptOneParagraph) {
      throw new Error("Prompt paragraph is required.");
    }

    patch.prompt_one_paragraph = promptOneParagraph;
  }

  if (input.start_frame_drive_item_id !== undefined) {
    const driveItemId = normalizeNullableText(input.start_frame_drive_item_id);
    if (driveItemId) {
      const driveItem = await getDriveItemById(driveItemId);
      if (!driveItem) {
        throw new Error("Start frame Drive item not found.");
      }
    }
    patch.start_frame_drive_item_id = driveItemId;
  }

  if (input.last_frame_drive_item_id !== undefined) {
    const driveItemId = normalizeNullableText(input.last_frame_drive_item_id);
    if (driveItemId) {
      const driveItem = await getDriveItemById(driveItemId);
      if (!driveItem) {
        throw new Error("Last frame Drive item not found.");
      }
    }
    patch.last_frame_drive_item_id = driveItemId;
  }

  if (input.generated_drive_item_id !== undefined) {
    const driveItemId = normalizeNullableText(input.generated_drive_item_id);
    if (driveItemId) {
      const driveItem = await getDriveItemById(driveItemId);
      if (!driveItem) {
        throw new Error("Generated Drive item not found.");
      }
    }
    patch.generated_drive_item_id = driveItemId;
  }

  if (input.status !== undefined) {
    const status = normalizeStatus(input.status, current.status);
    assertClipJobStatus(status);
    patch.status = status;
  }

  if (!Object.keys(patch).length) {
    throw new Error("No clip job changes provided.");
  }

  const { data, error } = await supabase
    .from("clip_jobs")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/controller");
  return data as ClipJobRecord;
}

export async function archiveClipJob(id: string) {
  return await updateClipJob(id, { status: "ARCHIVED" });
}

export async function listGeneratedFiles(input?: {
  clipJobId?: string | null;
  matchStatus?: string;
  limit?: number;
}) {
  const { supabase, user } = await requireUser();
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = supabase
    .from("generated_files")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.clipJobId) {
    query = query.eq("clip_job_id", input.clipJobId);
  }

  if (input?.matchStatus) {
    query = query.eq("match_status", normalizeStatus(input.matchStatus, "UNMATCHED"));
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as GeneratedFileRecord[];
}

export async function getGeneratedFileById(id: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("generated_files").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as GeneratedFileRecord | null;
}

export async function createGeneratedFile(input: GeneratedFileInput) {
  const { supabase, user } = await requireUser();
  const driveItemId = readText(input.drive_item_id);

  if (!driveItemId) {
    throw new Error("Drive item is required.");
  }

  const driveItem = await getDriveItemById(driveItemId);
  if (!driveItem) {
    throw new Error("Drive item not found.");
  }

  const clipJobId = normalizeNullableText(input.clip_job_id);
  if (clipJobId) {
    const clipJob = await getClipJobById(clipJobId);
    if (!clipJob) {
      throw new Error("Clip job not found.");
    }
  }

  const fileName = readText(input.file_name) || driveItem.name;
  const matchStatus = input.match_status ? (assertGeneratedFileMatchStatus(input.match_status), input.match_status) : "UNMATCHED";
  const importedAt = normalizeNullableText(input.imported_at);

  const { data, error } = await supabase
    .from("generated_files")
    .insert({
      user_id: user.id,
      clip_job_id: clipJobId,
      drive_item_id: driveItemId,
      file_name: fileName,
      detected_prefix: normalizeNullableText(input.detected_prefix),
      match_status: matchStatus,
      imported_at: importedAt,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/controller");
  return data as GeneratedFileRecord;
}

export async function updateGeneratedFile(id: string, input: GeneratedFileUpdateInput) {
  const { supabase, user } = await requireUser();
  const current = await requireOwnedGeneratedFile(supabase, user.id, id);
  const patch: Partial<GeneratedFileRecord> = {};

  if (input.clip_job_id !== undefined) {
    const clipJobId = normalizeNullableText(input.clip_job_id);
    if (clipJobId) {
      const clipJob = await getClipJobById(clipJobId);
      if (!clipJob) {
        throw new Error("Clip job not found.");
      }
    }
    patch.clip_job_id = clipJobId;
  }

  if (input.drive_item_id !== undefined) {
    const driveItemId = readText(input.drive_item_id);
    if (!driveItemId) {
      throw new Error("Drive item is required.");
    }

    const driveItem = await getDriveItemById(driveItemId);
    if (!driveItem) {
      throw new Error("Drive item not found.");
    }

    patch.drive_item_id = driveItemId;
  }

  if (input.file_name !== undefined) {
    const fileName = readText(input.file_name);
    if (!fileName) {
      throw new Error("File name is required.");
    }
    patch.file_name = fileName;
  }

  if (input.detected_prefix !== undefined) {
    patch.detected_prefix = normalizeNullableText(input.detected_prefix);
  }

  if (input.match_status !== undefined) {
    const matchStatus = normalizeStatus(input.match_status, current.match_status);
    assertGeneratedFileMatchStatus(matchStatus);
    patch.match_status = matchStatus;
  }

  if (input.imported_at !== undefined) {
    patch.imported_at = normalizeNullableText(input.imported_at);
  }

  if (!Object.keys(patch).length) {
    throw new Error("No generated file changes provided.");
  }

  const { data, error } = await supabase
    .from("generated_files")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/controller");
  return data as GeneratedFileRecord;
}

export async function markGeneratedFileImported(id: string) {
  return await updateGeneratedFile(id, { match_status: "IMPORTED", imported_at: new Date().toISOString() });
}

