import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  WORKSPACE_STATUSES,
  assertWorkspaceStatus,
  normalizeNullableWorkspaceText,
  normalizeNullableWorkspaceUuid,
  normalizeWorkspaceCode,
  readWorkspaceText,
  validateWorkspaceInput,
  type WorkspaceInput,
  type WorkspaceStatus,
} from "@/lib/workspaces/validation";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type WorkspaceContext = {
  supabase: SupabaseServerClient;
  user: {
    id: string;
  };
};

export type WorkspaceRecord = {
  id: string;
  user_id: string;
  workspace_code: string;
  workspace_name: string;
  niche: string | null;
  drive_root_folder_ref_id: string | null;
  drive_root_folder_url: string | null;
  drive_root_folder_path: string | null;
  status: WorkspaceStatus;
  is_default: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UserPreferencesRecord = {
  user_id: string;
  current_workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceSelectionState = {
  workspaces: WorkspaceRecord[];
  currentWorkspace: WorkspaceRecord | null;
  preferences: UserPreferencesRecord;
};

export type WorkspaceShellState = {
  schemaReady: boolean;
  errorMessage: string | null;
  workspaces: Array<Pick<WorkspaceRecord, "id" | "workspace_code" | "workspace_name" | "is_default">>;
  currentWorkspaceId: string | null;
};

type WorkspaceUpdateInput = Partial<WorkspaceInput>;

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "Workspace operation failed.";
}

export function isWorkspaceSchemaMissingError(error: unknown) {
  const message = errorMessage(error).toLowerCase();

  return (
    errorCode(error) === "42P01" ||
    message.includes("workspace schema is not applied") ||
    (message.includes("relation") &&
      (message.includes("workspaces") || message.includes("user_preferences")) &&
      message.includes("does not exist"))
  );
}

function workspaceSchemaMissingError() {
  return new Error("Workspace schema is not applied yet. Apply the Sprint 12B migration first.");
}

function throwWorkspaceError(error: unknown): never {
  if (isWorkspaceSchemaMissingError(error)) {
    throw workspaceSchemaMissingError();
  }

  throw new Error(errorMessage(error));
}

async function requireUser(): Promise<WorkspaceContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

async function getOptionalUser(): Promise<WorkspaceContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ? { supabase, user } : null;
}

async function listWorkspacesForContext(context: WorkspaceContext, input?: { status?: WorkspaceStatus | string; limit?: number }) {
  if (input?.status) {
    assertWorkspaceStatus(input.status);
  }

  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 200);
  let query = context.supabase
    .from("workspaces")
    .select("*")
    .eq("user_id", context.user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throwWorkspaceError(error);
  }

  return (data ?? []) as WorkspaceRecord[];
}

async function ensureUserPreferencesForContext(context: WorkspaceContext) {
  const { data, error } = await context.supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: context.user.id,
      },
      {
        onConflict: "user_id",
      },
    )
    .select("*")
    .single();

  if (error) {
    throwWorkspaceError(error);
  }

  return data as UserPreferencesRecord;
}

async function updateCurrentWorkspacePreference(context: WorkspaceContext, workspaceId: string | null) {
  const { data, error } = await context.supabase
    .from("user_preferences")
    .update({
      current_workspace_id: workspaceId,
    })
    .eq("user_id", context.user.id)
    .select("*")
    .single();

  if (error) {
    throwWorkspaceError(error);
  }

  return data as UserPreferencesRecord;
}

async function requireOwnedActiveWorkspace(context: WorkspaceContext, workspaceId: string) {
  const { data, error } = await context.supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .eq("user_id", context.user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) {
    throwWorkspaceError(error);
  }

  if (!data) {
    throw new Error("Choose an active workspace.");
  }

  return data as WorkspaceRecord;
}

async function resolveCurrentWorkspaceForContext(
  context: WorkspaceContext,
  workspaces: WorkspaceRecord[],
  preferences: UserPreferencesRecord,
) {
  const activeWorkspaces = workspaces.filter((workspace) => workspace.status === "ACTIVE");
  const preferredWorkspace =
    preferences.current_workspace_id ?
      activeWorkspaces.find((workspace) => workspace.id === preferences.current_workspace_id) ?? null
    : null;
  const fallbackWorkspace =
    preferredWorkspace ??
    activeWorkspaces.find((workspace) => workspace.is_default) ??
    activeWorkspaces[0] ??
    null;
  const nextWorkspaceId = fallbackWorkspace?.id ?? null;

  if (preferences.current_workspace_id !== nextWorkspaceId) {
    const updatedPreferences = await updateCurrentWorkspacePreference(context, nextWorkspaceId);
    return {
      currentWorkspace: fallbackWorkspace,
      preferences: updatedPreferences,
    };
  }

  return {
    currentWorkspace: fallbackWorkspace,
    preferences,
  };
}

async function getWorkspaceSelectionStateForContext(context: WorkspaceContext): Promise<WorkspaceSelectionState> {
  const preferences = await ensureUserPreferencesForContext(context);
  const workspaces = await listWorkspacesForContext(context);
  const resolved = await resolveCurrentWorkspaceForContext(context, workspaces, preferences);

  return {
    workspaces,
    currentWorkspace: resolved.currentWorkspace,
    preferences: resolved.preferences,
  };
}

function buildWorkspaceUpdatePayload(input: WorkspaceUpdateInput) {
  const payload: Record<string, string | boolean | null> = {};

  if (input.workspace_code !== undefined) {
    const workspaceCode = normalizeWorkspaceCode(input.workspace_code);

    if (!workspaceCode) {
      throw new Error("Workspace code is required.");
    }

    payload.workspace_code = workspaceCode;
  }

  if (input.workspace_name !== undefined) {
    const workspaceName = readWorkspaceText(input.workspace_name);

    if (!workspaceName) {
      throw new Error("Workspace name is required.");
    }

    payload.workspace_name = workspaceName;
  }

  if (input.niche !== undefined) {
    payload.niche = normalizeNullableWorkspaceText(input.niche);
  }

  if (input.drive_root_folder_ref_id !== undefined) {
    payload.drive_root_folder_ref_id = normalizeNullableWorkspaceUuid(input.drive_root_folder_ref_id);
  }

  if (input.drive_root_folder_url !== undefined) {
    payload.drive_root_folder_url = normalizeNullableWorkspaceText(input.drive_root_folder_url);
  }

  if (input.drive_root_folder_path !== undefined) {
    payload.drive_root_folder_path = normalizeNullableWorkspaceText(input.drive_root_folder_path);
  }

  if (input.status !== undefined) {
    assertWorkspaceStatus(input.status);
    payload.status = input.status;
  }

  if (input.is_default !== undefined) {
    payload.is_default = input.is_default;
  }

  if (input.notes !== undefined) {
    payload.notes = normalizeNullableWorkspaceText(input.notes);
  }

  return payload;
}

export async function createWorkspace(input: WorkspaceInput) {
  const context = await requireUser();
  const payload = validateWorkspaceInput(input);
  const existingWorkspaces = await listWorkspacesForContext(context);
  const shouldSetDefault = payload.is_default || !existingWorkspaces.length;

  if (shouldSetDefault) {
    const { error } = await context.supabase
      .from("workspaces")
      .update({ is_default: false })
      .eq("user_id", context.user.id)
      .eq("is_default", true);

    if (error) {
      throwWorkspaceError(error);
    }
  }

  const { data, error } = await context.supabase
    .from("workspaces")
    .insert({
      user_id: context.user.id,
      ...payload,
      is_default: shouldSetDefault,
    })
    .select("*")
    .single();

  if (error) {
    throwWorkspaceError(error);
  }

  const workspace = data as WorkspaceRecord;
  const preferences = await ensureUserPreferencesForContext(context);

  if (!preferences.current_workspace_id || shouldSetDefault) {
    await updateCurrentWorkspacePreference(context, workspace.id);
  }

  return workspace;
}

export async function listWorkspaces(input?: { status?: WorkspaceStatus | string; limit?: number }) {
  const context = await requireUser();
  return await listWorkspacesForContext(context, input);
}

export async function updateWorkspace(id: string, input: WorkspaceUpdateInput) {
  const context = await requireUser();
  const payload = buildWorkspaceUpdatePayload(input);

  if (!Object.keys(payload).length) {
    throw new Error("No workspace changes provided.");
  }

  const shouldSetDefault = payload.is_default === true;

  if (shouldSetDefault) {
    const { error } = await context.supabase
      .from("workspaces")
      .update({ is_default: false })
      .eq("user_id", context.user.id)
      .eq("is_default", true);

    if (error) {
      throwWorkspaceError(error);
    }
  }

  const { data, error } = await context.supabase
    .from("workspaces")
    .update(payload)
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select("*")
    .single();

  if (error) {
    throwWorkspaceError(error);
  }

  return data as WorkspaceRecord;
}

export async function archiveWorkspace(id: string) {
  const context = await requireUser();
  const { data, error } = await context.supabase
    .from("workspaces")
    .update({
      status: "ARCHIVED",
      is_default: false,
    })
    .eq("id", id)
    .eq("user_id", context.user.id)
    .select("*")
    .single();

  if (error) {
    throwWorkspaceError(error);
  }

  const archivedWorkspace = data as WorkspaceRecord;
  const preferences = await ensureUserPreferencesForContext(context);

  if (preferences.current_workspace_id === archivedWorkspace.id) {
    const workspaces = await listWorkspacesForContext(context);
    await resolveCurrentWorkspaceForContext(context, workspaces, preferences);
  }

  return archivedWorkspace;
}

export async function setDefaultWorkspace(id: string) {
  const context = await requireUser();
  await requireOwnedActiveWorkspace(context, id);

  const { error: clearError } = await context.supabase
    .from("workspaces")
    .update({ is_default: false })
    .eq("user_id", context.user.id)
    .eq("is_default", true);

  if (clearError) {
    throwWorkspaceError(clearError);
  }

  const { data, error } = await context.supabase
    .from("workspaces")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", context.user.id)
    .eq("status", "ACTIVE")
    .select("*")
    .single();

  if (error) {
    throwWorkspaceError(error);
  }

  return data as WorkspaceRecord;
}

export async function getCurrentWorkspace() {
  const context = await requireUser();
  const state = await getWorkspaceSelectionStateForContext(context);
  return state.currentWorkspace;
}

export async function setCurrentWorkspace(id: string | null) {
  const context = await requireUser();
  await ensureUserPreferencesForContext(context);

  if (!id) {
    return await updateCurrentWorkspacePreference(context, null);
  }

  const workspace = await requireOwnedActiveWorkspace(context, id);
  return await updateCurrentWorkspacePreference(context, workspace.id);
}

export async function ensureUserPreferences() {
  const context = await requireUser();
  return await ensureUserPreferencesForContext(context);
}

export async function getWorkspaceSelectionState(): Promise<WorkspaceSelectionState> {
  const context = await requireUser();
  return await getWorkspaceSelectionStateForContext(context);
}

export async function getWorkspaceShellState(): Promise<WorkspaceShellState> {
  const context = await getOptionalUser();

  if (!context) {
    return {
      schemaReady: true,
      errorMessage: null,
      workspaces: [],
      currentWorkspaceId: null,
    };
  }

  try {
    const state = await getWorkspaceSelectionStateForContext(context);
    const activeWorkspaces = state.workspaces.filter((workspace) => workspace.status === "ACTIVE");

    return {
      schemaReady: true,
      errorMessage: null,
      workspaces: activeWorkspaces.map((workspace) => ({
        id: workspace.id,
        workspace_code: workspace.workspace_code,
        workspace_name: workspace.workspace_name,
        is_default: workspace.is_default,
      })),
      currentWorkspaceId: state.currentWorkspace?.id ?? null,
    };
  } catch (error) {
    return {
      schemaReady: !isWorkspaceSchemaMissingError(error),
      errorMessage: isWorkspaceSchemaMissingError(error) ? null : errorMessage(error),
      workspaces: [],
      currentWorkspaceId: null,
    };
  }
}

export { WORKSPACE_STATUSES };
