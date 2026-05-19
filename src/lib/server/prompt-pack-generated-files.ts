import "server-only";

import { revalidatePath } from "next/cache.js";
import { PROMPT_CLIP_KEYS, PROMPT_CLIP_LABELS, PROMPT_TARGET_MARKETPLACE } from "@/lib/prompts/validation";
import { readPromptPackEditorPromptSet } from "@/lib/prompts/prompt-pack-contract";
import {
  createDriveItem,
  getDriveItemByDriveItemId,
  getDriveItemByDrivePath,
  updateDriveItem,
  writeGeneratedDriveFile,
  type DriveItemRecord,
} from "@/lib/server/drive-items";
import { ensureGoogleDriveFolder } from "@/lib/server/google-drive";
import { getProductById } from "@/lib/server/products";
import { getPromptPackById } from "@/lib/server/prompt-packs";
import { getOrProvisionWorkspaceDriveRoot } from "@/lib/server/workspaces";

type DriveFolderRecord = Pick<
  DriveItemRecord,
  "id" | "drive_item_id" | "name" | "drive_url" | "drive_path" | "purpose" | "status" | "notes" | "parent_id" | "parent_drive_item_id" | "item_type"
>;

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function joinDrivePath(...segments: Array<string | null | undefined>) {
  return `/${segments
    .map((segment) => readText(segment))
    .filter(Boolean)
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")}`;
}

function normalizeFileSegment(value: string | null | undefined, fallback: string) {
  const normalized = readText(value)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || fallback;
}

function promptTextFileName(input: { productCode?: string | null; promptCode: string; version: number }) {
  const productCode = normalizeFileSegment(input.productCode, "PRODUCT").toUpperCase();
  const promptCode = normalizeFileSegment(input.promptCode, "PROMPT").toUpperCase();
  const version = `V${String(input.version).padStart(2, "0")}`;

  return `${productCode}_${promptCode}_${version}.txt`;
}

function assertPromptSetReadyForExport(promptSet: ReturnType<typeof readPromptPackEditorPromptSet>) {
  if (!readText(promptSet.caption) || !readText(promptSet.tags)) {
    throw new Error("Generate prompt lengkap sebelum menyimpan TXT Drive.");
  }

  for (const clipKey of PROMPT_CLIP_KEYS) {
    const clip = promptSet.clips[clipKey];

    if (!readText(clip.i2i_first_frame) || !readText(clip.i2i_last_frame) || !readText(clip.i2v_prompt)) {
      throw new Error("Generate prompt lengkap sebelum menyimpan TXT Drive.");
    }
  }
}

async function ensureDriveFolderRecord(input: {
  name: string;
  drivePath: string;
  parentFolderId: string;
  parentRecord: DriveFolderRecord;
  notes: string;
}) {
  const driveFolder = await ensureGoogleDriveFolder({ name: input.name, parentFolderId: input.parentFolderId });
  const existing = (await getDriveItemByDriveItemId(driveFolder.id)) ?? (await getDriveItemByDrivePath(input.drivePath));

  if (existing && existing.item_type !== "FOLDER") {
    throw new Error("Path Drive target sudah dipakai file.");
  }

  if (existing) {
    return (await updateDriveItem(existing.id, {
      item_type: "FOLDER",
      drive_item_id: driveFolder.id,
      name: driveFolder.name,
      drive_url: driveFolder.webViewLink,
      drive_path: input.drivePath,
      purpose: "OTHER",
      status: "ACTIVE",
      notes: input.notes,
      parent_id: input.parentRecord.id,
      parent_drive_item_id: input.parentRecord.drive_item_id,
    })) as DriveFolderRecord;
  }

  return (await createDriveItem({
    item_type: "FOLDER",
    drive_item_id: driveFolder.id,
    name: driveFolder.name,
    drive_url: driveFolder.webViewLink,
    drive_path: input.drivePath,
    purpose: "OTHER",
    status: "ACTIVE",
    notes: input.notes,
    parent_id: input.parentRecord.id,
    parent_drive_item_id: input.parentRecord.drive_item_id,
  })) as DriveFolderRecord;
}

async function resolveWorkspacePromptsFolder(productWorkspaceId: string | null) {
  const { rootFolder } = await getOrProvisionWorkspaceDriveRoot({ workspaceId: productWorkspaceId });
  const parentFolderId = rootFolder.drive_item_id;

  if (!parentFolderId) {
    throw new Error("Folder Drive otomatis belum tersinkron.");
  }

  const promptsPath = joinDrivePath(rootFolder.drive_path, "PROMPTS");
  const promptsFolder = await getDriveItemByDrivePath(promptsPath);

  if (promptsFolder) {
    if (promptsFolder.item_type !== "FOLDER" || !promptsFolder.drive_item_id) {
      throw new Error("Folder PROMPTS workspace belum valid.");
    }

    return promptsFolder;
  }

  return await ensureDriveFolderRecord({
    name: "PROMPTS",
    drivePath: promptsPath,
    parentFolderId,
    parentRecord: rootFolder,
    notes: "Workspace generated prompt files.",
  });
}

function buildPromptPackTextFile(input: {
  promptPack: Awaited<ReturnType<typeof getPromptPackById>>;
  product: NonNullable<Awaited<ReturnType<typeof getProductById>>>;
}) {
  const promptSet = readPromptPackEditorPromptSet(input.promptPack);
  assertPromptSetReadyForExport(promptSet);
  const lines = [
    `Produk: ${input.product.product_name}`,
    `Kode Produk: ${input.product.product_code}`,
    `Prompt: ${input.promptPack.prompt_code}`,
    `Versi: v${input.promptPack.version}`,
    `Target Marketplace: ${PROMPT_TARGET_MARKETPLACE}`,
    "",
    "Caption",
    promptSet.caption || "Belum ada.",
    "",
    "Tags",
    promptSet.tags || "Belum ada.",
  ];

  for (const clipKey of PROMPT_CLIP_KEYS) {
    const clip = promptSet.clips[clipKey];

    lines.push(
      "",
      PROMPT_CLIP_LABELS[clipKey],
      "First Frame Image",
      clip.i2i_first_frame || "Belum ada.",
      "",
      "I2V Prompt",
      clip.i2v_prompt || "Belum ada.",
    );
  }

  return `${lines.join("\n")}\n`;
}

export async function exportPromptPackTextFile(promptPackId: string) {
  const promptPack = await getPromptPackById(promptPackId);
  const product = await getProductById(promptPack.product_id);

  if (!product) {
    throw new Error("Produk tidak ditemukan.");
  }

  const promptsFolder = await resolveWorkspacePromptsFolder(product.workspace_id);
  const name = promptTextFileName({
    productCode: product.product_code,
    promptCode: promptPack.prompt_code,
    version: promptPack.version,
  });
  const driveItem = await writeGeneratedDriveFile({
    bytes: buildPromptPackTextFile({ promptPack, product }),
    description: `Prompt TXT ${promptPack.prompt_code} v${promptPack.version}`,
    drivePath: joinDrivePath(promptsFolder.drive_path, name),
    mimeType: "text/plain; charset=utf-8",
    name,
    notes: `Prompt TXT ${promptPack.prompt_code} v${promptPack.version}`,
    parentId: promptsFolder.id,
    purpose: "EXPORT_FILE",
  });

  revalidatePath("/drive");
  revalidatePath("/dashboard");
  revalidatePath("/prompts");
  revalidatePath(`/prompts/${promptPack.id}`);
  revalidatePath(`/products/${promptPack.product_id}`);

  return driveItem;
}
