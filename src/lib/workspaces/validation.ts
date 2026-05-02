export const WORKSPACE_STATUSES = ["ACTIVE", "ARCHIVED", "DISABLED", "ERROR"] as const;

export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

export type WorkspaceInput = {
  workspace_code: string;
  workspace_name: string;
  niche?: string | null;
  drive_root_folder_ref_id?: string | null;
  drive_root_folder_url?: string | null;
  drive_root_folder_path?: string | null;
  status?: string;
  is_default?: boolean;
  notes?: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isWorkspaceStatus(value: string): value is WorkspaceStatus {
  return (WORKSPACE_STATUSES as readonly string[]).includes(value);
}

export function readWorkspaceText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeWorkspaceCode(value: string) {
  return readWorkspaceText(value).replace(/\s+/g, "_").toUpperCase();
}

export function normalizeNullableWorkspaceText(value: string | null | undefined) {
  const trimmed = readWorkspaceText(value);
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeNullableWorkspaceUuid(value: string | null | undefined) {
  const trimmed = readWorkspaceText(value);

  if (!trimmed) {
    return null;
  }

  if (!UUID_PATTERN.test(trimmed)) {
    throw new Error("Drive root folder reference must be a valid row id.");
  }

  return trimmed;
}

export function assertWorkspaceStatus(value: string): asserts value is WorkspaceStatus {
  if (!isWorkspaceStatus(value)) {
    throw new Error(`Invalid workspace status. Expected one of: ${WORKSPACE_STATUSES.join(", ")}.`);
  }
}

export function validateWorkspaceInput(input: WorkspaceInput) {
  const workspaceCode = normalizeWorkspaceCode(input.workspace_code);
  const workspaceName = readWorkspaceText(input.workspace_name);
  const status = input.status ?? "ACTIVE";

  if (!workspaceCode) {
    throw new Error("Workspace code is required.");
  }

  if (!workspaceName) {
    throw new Error("Workspace name is required.");
  }

  assertWorkspaceStatus(status);

  return {
    workspace_code: workspaceCode,
    workspace_name: workspaceName,
    niche: normalizeNullableWorkspaceText(input.niche),
    drive_root_folder_ref_id: normalizeNullableWorkspaceUuid(input.drive_root_folder_ref_id),
    drive_root_folder_url: normalizeNullableWorkspaceText(input.drive_root_folder_url),
    drive_root_folder_path: normalizeNullableWorkspaceText(input.drive_root_folder_path),
    status,
    is_default: input.is_default ?? false,
    notes: normalizeNullableWorkspaceText(input.notes),
  };
}
