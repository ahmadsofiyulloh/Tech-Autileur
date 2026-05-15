import "server-only";

import { getCurrentWorkspace, getOrProvisionWorkspaceDriveRoot, type WorkspaceRecord } from "@/lib/server/workspaces";
import type { DriveItemRecord } from "@/lib/server/drive-items";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type DriveScopeContext = {
  supabase: SupabaseServerClient;
  user: {
    id: string;
  };
};

export type ActiveWorkspaceDriveScope = {
  affiliateProfileId: string;
  workspace: WorkspaceRecord;
  rootFolder: DriveItemRecord;
  items: DriveItemRecord[];
};

export const DRIVE_SCOPE_ERROR_MESSAGE = "Item Drive tidak tersedia untuk Akun Affiliate aktif.";

const DEFAULT_SCOPE_LIMIT = 500;
const MAX_SCOPE_LIMIT = 1000;
const MAX_PARENT_DEPTH = 24;

type AffiliateProfileWorkspaceLinkScopeRow = {
  affiliate_profile_id: string;
  workspace_id: string;
  is_default: boolean;
  created_at: string;
};

type AffiliateProfileScopeNamespace = {
  affiliateProfileId: string;
  workspaceId: string;
};

function clampScopeLimit(value: number | null | undefined) {
  const parsed = Number(value ?? DEFAULT_SCOPE_LIMIT);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_SCOPE_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_SCOPE_LIMIT);
}

function readText(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDriveScopePath(value: string | null | undefined) {
  const trimmed = readText(value);

  if (!trimmed || trimmed === "/") {
    return "";
  }

  return trimmed.replace(/\/+$/g, "");
}

export function isDrivePathInsideWorkspaceRoot(drivePath: string | null | undefined, rootPath: string | null | undefined) {
  const normalizedPath = normalizeDriveScopePath(drivePath);
  const normalizedRootPath = normalizeDriveScopePath(rootPath);

  if (!normalizedPath || !normalizedRootPath) {
    return false;
  }

  return normalizedPath === normalizedRootPath || normalizedPath.startsWith(`${normalizedRootPath}/`);
}

async function requireUser(): Promise<DriveScopeContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

async function fetchDriveItemByIdForContext(context: DriveScopeContext, id: string) {
  const { data, error } = await context.supabase
    .from("drive_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as DriveItemRecord | null;
}

async function fetchDriveItemByDriveItemIdForContext(context: DriveScopeContext, driveItemId: string) {
  const { data, error } = await context.supabase
    .from("drive_items")
    .select("*")
    .eq("drive_item_id", driveItemId)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as DriveItemRecord | null;
}

async function fetchActiveAffiliateProfileExists(context: DriveScopeContext, affiliateProfileId: string) {
  const { data, error } = await context.supabase
    .from("affiliate_profiles")
    .select("id")
    .eq("id", affiliateProfileId)
    .eq("user_id", context.user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

async function fetchWorkspaceAffiliateLinks(context: DriveScopeContext, workspaceId: string) {
  const { data, error } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .select("affiliate_profile_id, workspace_id, is_default, created_at")
    .eq("user_id", context.user.id)
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AffiliateProfileWorkspaceLinkScopeRow[];
}

async function fetchAffiliateProfileLinks(context: DriveScopeContext, affiliateProfileId: string) {
  const { data, error } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .select("affiliate_profile_id, workspace_id, is_default, created_at")
    .eq("user_id", context.user.id)
    .eq("affiliate_profile_id", affiliateProfileId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AffiliateProfileWorkspaceLinkScopeRow[];
}

function resolveProfileNamespaceWorkspaceId(
  links: AffiliateProfileWorkspaceLinkScopeRow[],
  preferredWorkspaceId?: string | null,
) {
  return links.find((link) => link.is_default)?.workspace_id ??
    (preferredWorkspaceId && links.some((link) => link.workspace_id === preferredWorkspaceId) ? preferredWorkspaceId : null) ??
    links[0]?.workspace_id ??
    null;
}

async function resolveWorkspaceAffiliateNamespace(
  context: DriveScopeContext,
  workspaceId: string | null | undefined,
): Promise<AffiliateProfileScopeNamespace | null> {
  if (!workspaceId) {
    return null;
  }

  const workspaceLinks = await fetchWorkspaceAffiliateLinks(context, workspaceId);
  const defaultLink = workspaceLinks.find((link) => link.is_default) ?? null;
  const singleLink = workspaceLinks.length === 1 ? workspaceLinks[0] : null;
  const affiliateProfileId = defaultLink?.affiliate_profile_id ?? singleLink?.affiliate_profile_id ?? null;

  if (!affiliateProfileId) {
    return null;
  }

  const isActive = await fetchActiveAffiliateProfileExists(context, affiliateProfileId);

  if (!isActive) {
    return null;
  }

  const profileLinks = await fetchAffiliateProfileLinks(context, affiliateProfileId);
  const namespaceWorkspaceId = resolveProfileNamespaceWorkspaceId(profileLinks, workspaceId);

  if (!namespaceWorkspaceId) {
    throw new Error("Akun Affiliate belum memiliki namespace.");
  }

  return {
    affiliateProfileId,
    workspaceId: namespaceWorkspaceId,
  };
}

async function fetchDefaultWorkspaceId(context: DriveScopeContext) {
  const { data, error } = await context.supabase
    .from("workspaces")
    .select("id")
    .eq("user_id", context.user.id)
    .eq("status", "ACTIVE")
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function resolveSingleActiveAffiliateNamespace(context: DriveScopeContext) {
  const { data: profiles, error: profilesError } = await context.supabase
    .from("affiliate_profiles")
    .select("id")
    .eq("user_id", context.user.id)
    .eq("status", "ACTIVE")
    .limit(200);

  if (profilesError) {
    throw new Error(profilesError.message);
  }

  const profileIds = (profiles ?? []).map((profile) => profile.id as string).filter(Boolean);

  if (!profileIds.length) {
    return null;
  }

  const { data: links, error: linksError } = await context.supabase
    .from("affiliate_profile_workspace_links")
    .select("affiliate_profile_id, workspace_id, is_default, created_at")
    .eq("user_id", context.user.id)
    .in("affiliate_profile_id", profileIds)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (linksError) {
    throw new Error(linksError.message);
  }

  const linksByProfileId = new Map<string, AffiliateProfileWorkspaceLinkScopeRow[]>();

  for (const link of (links ?? []) as AffiliateProfileWorkspaceLinkScopeRow[]) {
    const existing = linksByProfileId.get(link.affiliate_profile_id) ?? [];
    existing.push(link);
    linksByProfileId.set(link.affiliate_profile_id, existing);
  }

  const namespaces = profileIds
    .map((affiliateProfileId) => ({
      affiliateProfileId,
      workspaceId: resolveProfileNamespaceWorkspaceId(linksByProfileId.get(affiliateProfileId) ?? []),
    }))
    .filter((namespace): namespace is AffiliateProfileScopeNamespace => Boolean(namespace.workspaceId));

  if (profileIds.length === 1 && !namespaces.length) {
    throw new Error("Akun Affiliate belum memiliki namespace.");
  }

  return namespaces.length === 1 ? namespaces[0] : null;
}

async function resolveActiveAffiliateNamespace(context: DriveScopeContext) {
  const currentWorkspace = await getCurrentWorkspace().catch(() => null);
  const currentNamespace = await resolveWorkspaceAffiliateNamespace(context, currentWorkspace?.id ?? null);

  if (currentNamespace) {
    return currentNamespace;
  }

  const defaultWorkspaceId = await fetchDefaultWorkspaceId(context);

  if (defaultWorkspaceId && defaultWorkspaceId !== currentWorkspace?.id) {
    const defaultNamespace = await resolveWorkspaceAffiliateNamespace(context, defaultWorkspaceId);

    if (defaultNamespace) {
      return defaultNamespace;
    }
  }

  const singleActiveNamespace = await resolveSingleActiveAffiliateNamespace(context);

  if (singleActiveNamespace) {
    return singleActiveNamespace;
  }

  throw new Error("Aktifkan Akun Affiliate dulu.");
}

async function fetchPathScopedItems(input: {
  context: DriveScopeContext;
  rootPath: string;
  includeArchived: boolean;
  limit: number;
}) {
  const lowerBound = `${input.rootPath}/`;
  const upperBound = `${input.rootPath}0`;
  let query = input.context.supabase
    .from("drive_items")
    .select("*")
    .eq("user_id", input.context.user.id)
    .gte("drive_path", lowerBound)
    .lt("drive_path", upperBound)
    .order("drive_path", { ascending: true })
    .limit(input.limit);

  if (!input.includeArchived) {
    query = query.neq("status", "ARCHIVED");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DriveItemRecord[];
}

async function fetchChildrenForParents(input: {
  context: DriveScopeContext;
  parentIds: string[];
  includeArchived: boolean;
  limit: number;
}) {
  if (!input.parentIds.length || input.limit <= 0) {
    return [] as DriveItemRecord[];
  }

  let query = input.context.supabase
    .from("drive_items")
    .select("*")
    .eq("user_id", input.context.user.id)
    .in("parent_id", input.parentIds)
    .order("created_at", { ascending: true })
    .limit(input.limit);

  if (!input.includeArchived) {
    query = query.neq("status", "ARCHIVED");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DriveItemRecord[];
}

function addScopedItem(
  itemsById: Map<string, DriveItemRecord>,
  rootFolder: DriveItemRecord,
  item: DriveItemRecord,
  includeArchived: boolean,
  options?: {
    allowMissingPath?: boolean;
  },
) {
  if (!includeArchived && item.status === "ARCHIVED") {
    return false;
  }

  const hasPath = Boolean(normalizeDriveScopePath(item.drive_path));

  if (
    item.id !== rootFolder.id &&
    !isDrivePathInsideWorkspaceRoot(item.drive_path, rootFolder.drive_path) &&
    !(options?.allowMissingPath && !hasPath)
  ) {
    return false;
  }

  if (itemsById.has(item.id)) {
    return false;
  }

  itemsById.set(item.id, item);
  return true;
}

async function collectParentScopedItems(input: {
  context: DriveScopeContext;
  rootFolder: DriveItemRecord;
  includeArchived: boolean;
  itemsById: Map<string, DriveItemRecord>;
  limit: number;
}) {
  let frontier = [input.rootFolder.id];
  const visitedParentIds = new Set<string>();

  for (let depth = 0; depth < MAX_PARENT_DEPTH && frontier.length && input.itemsById.size < input.limit; depth += 1) {
    const parentIds = frontier.filter((parentId) => !visitedParentIds.has(parentId));
    frontier = [];

    if (!parentIds.length) {
      break;
    }

    parentIds.forEach((parentId) => visitedParentIds.add(parentId));

    const children = await fetchChildrenForParents({
      context: input.context,
      parentIds,
      includeArchived: input.includeArchived,
      limit: input.limit - input.itemsById.size,
    });

    for (const child of children) {
      const wasAdded = addScopedItem(input.itemsById, input.rootFolder, child, input.includeArchived, {
        allowMissingPath: true,
      });

      if (wasAdded && child.item_type === "FOLDER") {
        frontier.push(child.id);
      }
    }
  }
}

async function isDriveItemInScopeByAncestry(input: {
  context: DriveScopeContext;
  item: DriveItemRecord;
  rootFolder: DriveItemRecord;
}) {
  const rootPath = input.rootFolder.drive_path;

  if (input.item.id === input.rootFolder.id || isDrivePathInsideWorkspaceRoot(input.item.drive_path, rootPath)) {
    return true;
  }

  if (normalizeDriveScopePath(input.item.drive_path)) {
    return false;
  }

  if (input.item.parent_id === input.rootFolder.id) {
    return true;
  }

  if (
    input.item.parent_drive_item_id &&
    input.rootFolder.drive_item_id &&
    input.item.parent_drive_item_id === input.rootFolder.drive_item_id
  ) {
    return true;
  }

  const visitedIds = new Set<string>([input.item.id]);
  const visitedDriveItemIds = new Set<string>();
  let parentId = input.item.parent_id;
  let parentDriveItemId = input.item.parent_drive_item_id;

  for (let depth = 0; depth < MAX_PARENT_DEPTH; depth += 1) {
    let parent: DriveItemRecord | null = null;

    if (parentId && !visitedIds.has(parentId)) {
      parent = await fetchDriveItemByIdForContext(input.context, parentId);
    } else if (parentDriveItemId && !visitedDriveItemIds.has(parentDriveItemId)) {
      parent = await fetchDriveItemByDriveItemIdForContext(input.context, parentDriveItemId);
    }

    if (!parent) {
      return false;
    }

    if (parent.id === input.rootFolder.id || isDrivePathInsideWorkspaceRoot(parent.drive_path, rootPath)) {
      return true;
    }

    visitedIds.add(parent.id);

    if (parent.drive_item_id) {
      visitedDriveItemIds.add(parent.drive_item_id);
    }

    parentId = parent.parent_id;
    parentDriveItemId = parent.parent_drive_item_id;
  }

  return false;
}

export async function getActiveWorkspaceDriveScope(input?: {
  includeArchived?: boolean;
  limit?: number;
}): Promise<ActiveWorkspaceDriveScope> {
  const includeArchived = input?.includeArchived ?? false;
  const limit = clampScopeLimit(input?.limit);
  const context = await requireUser();
  const activeNamespace = await resolveActiveAffiliateNamespace(context);
  const { workspace, rootFolder } = await getOrProvisionWorkspaceDriveRoot({ workspaceId: activeNamespace.workspaceId });
  const rootPath = normalizeDriveScopePath(rootFolder.drive_path);
  const itemsById = new Map<string, DriveItemRecord>();

  addScopedItem(itemsById, rootFolder, rootFolder, includeArchived);

  if (rootPath && itemsById.size < limit) {
    const pathItems = await fetchPathScopedItems({
      context,
      rootPath,
      includeArchived,
      limit: limit - itemsById.size,
    });

    for (const item of pathItems) {
      addScopedItem(itemsById, rootFolder, item, includeArchived);
    }
  }

  await collectParentScopedItems({
    context,
    rootFolder,
    includeArchived,
    itemsById,
    limit,
  });

  return {
    affiliateProfileId: activeNamespace.affiliateProfileId,
    workspace,
    rootFolder,
    items: Array.from(itemsById.values()).slice(0, limit),
  };
}

export async function requireDriveItemInActiveWorkspaceDriveScope(
  id: string,
  input?: {
    includeArchived?: boolean;
    requireFolder?: boolean;
  },
) {
  const context = await requireUser();
  const activeNamespace = await resolveActiveAffiliateNamespace(context);
  const { workspace, rootFolder } = await getOrProvisionWorkspaceDriveRoot({ workspaceId: activeNamespace.workspaceId });
  const item = await fetchDriveItemByIdForContext(context, id);

  if (!item) {
    throw new Error(DRIVE_SCOPE_ERROR_MESSAGE);
  }

  if (!input?.includeArchived && item.status === "ARCHIVED") {
    throw new Error(DRIVE_SCOPE_ERROR_MESSAGE);
  }

  if (!(await isDriveItemInScopeByAncestry({ context, item, rootFolder }))) {
    throw new Error(DRIVE_SCOPE_ERROR_MESSAGE);
  }

  if (input?.requireFolder && item.item_type !== "FOLDER") {
    throw new Error("Target Drive harus berupa folder.");
  }

  return {
    affiliateProfileId: activeNamespace.affiliateProfileId,
    workspace,
    rootFolder,
    item,
  };
}

export async function requireDrivePathInActiveWorkspaceDriveScope(drivePath: string) {
  const { rootFolder } = await getActiveWorkspaceDriveScope({ limit: 1 });

  if (!isDrivePathInsideWorkspaceRoot(drivePath, rootFolder.drive_path)) {
    throw new Error(DRIVE_SCOPE_ERROR_MESSAGE);
  }

  return rootFolder;
}
