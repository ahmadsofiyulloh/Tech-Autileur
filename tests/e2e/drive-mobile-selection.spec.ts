import { expect, test, type Locator, type Page } from "@playwright/test";
import { createSmokeServiceClient } from "./support/supabase";
import { classifySmokeError } from "./support/blockers";
import { readSmokeBootstrapState } from "./support/bootstrap";

test.use({
  hasTouch: true,
  isMobile: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  viewport: {
    width: 390,
    height: 844,
  },
});

async function longPressTile(page: Page, tile: Locator) {
  const box = await tile.boundingBox();

  if (!box) {
    throw new Error("Drive tile is not visible.");
  }

  const clientX = Math.round(box.x + box.width / 2);
  const clientY = Math.round(box.y + box.height / 2);

  await tile.dispatchEvent("pointerdown", {
    button: 0,
    buttons: 1,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
  });

  await page.waitForTimeout(500);
  await tile.dispatchEvent("contextmenu", {
    clientX,
    clientY,
    button: 2,
  });
  await tile.dispatchEvent("pointerup", {
    button: 0,
    buttons: 0,
    clientX,
    clientY,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
  });
}

type SmokeRow = Record<string, unknown> & {
  id: string;
};

const DRIVE_SCOPE_CODES = {
  activeRoot: "smoke-drive-scope-active-root",
  activeFolder: "smoke-drive-scope-active-folder",
  activeFile: "smoke-drive-scope-active-file",
  crossLinkedFile: "smoke-drive-scope-cross-linked-file",
  inactiveRoot: "smoke-drive-scope-inactive-root",
  inactiveFolder: "smoke-drive-scope-inactive-folder",
  inactiveFile: "smoke-drive-scope-inactive-file",
  inactiveWorkspace: "SMOKE_DRIVE_SCOPE_ALT",
} as const;

function workspaceRootPath(workspaceCode: string) {
  return `/AffiliateAI/02_WORKSPACES/${workspaceCode}/ROOT_FOLDER`;
}

async function selectRow(table: string, filters: Record<string, unknown>) {
  const client = createSmokeServiceClient();
  let query = client.from(table).select("*").limit(1);

  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value as never);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as SmokeRow | null;
}

async function insertRow(table: string, payload: Record<string, unknown>) {
  const client = createSmokeServiceClient();
  const { data, error } = await client.from(table).insert(payload as never).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SmokeRow;
}

async function updateRow(table: string, id: string, payload: Record<string, unknown>) {
  const client = createSmokeServiceClient();
  const { data, error } = await client.from(table).update(payload as never).eq("id", id).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SmokeRow;
}

async function upsertByNaturalKey(table: string, filters: Record<string, unknown>, payload: Record<string, unknown>) {
  const existing = await selectRow(table, filters);

  if (existing) {
    return await updateRow(table, existing.id, payload);
  }

  return await insertRow(table, payload);
}

async function upsertDriveItem(userId: string, driveItemId: string, payload: Record<string, unknown>) {
  return await upsertByNaturalKey(
    "drive_items",
    {
      user_id: userId,
      drive_item_id: driveItemId,
    },
    {
      user_id: userId,
      drive_item_id: driveItemId,
      status: "ACTIVE",
      ...payload,
    },
  );
}

async function setCurrentWorkspace(userId: string, workspaceId: string) {
  const client = createSmokeServiceClient();
  const { error } = await client.from("user_preferences").upsert(
    {
      user_id: userId,
      current_workspace_id: workspaceId,
    } as never,
    {
      onConflict: "user_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function seedDriveScopeFixtures(activeWorkspace: "primary" | "inactive" = "primary") {
  const state = await readSmokeBootstrapState();
  const userId = state.user.id;
  const activeRootPath = workspaceRootPath(state.workspace.code);
  const inactiveWorkspace = await upsertByNaturalKey(
    "workspaces",
    {
      user_id: userId,
      workspace_code: DRIVE_SCOPE_CODES.inactiveWorkspace,
    },
    {
      user_id: userId,
      workspace_code: DRIVE_SCOPE_CODES.inactiveWorkspace,
      workspace_name: "Smoke Drive Scope Alt",
      niche: "Smoke Testing",
      drive_root_folder_ref_id: null,
      drive_root_folder_url: null,
      drive_root_folder_path: null,
      status: "ACTIVE",
      is_default: false,
      notes: "Seeded by Drive scope smoke test.",
    },
  );
  const inactiveRootPath = workspaceRootPath(DRIVE_SCOPE_CODES.inactiveWorkspace);
  const activeRoot = await upsertDriveItem(userId, DRIVE_SCOPE_CODES.activeRoot, {
    item_type: "FOLDER",
    parent_id: null,
    parent_drive_item_id: null,
    name: "ROOT_FOLDER",
    drive_url: "https://drive.google.com/drive/folders/smoke-drive-scope-active-root",
    drive_path: activeRootPath,
    mime_type: "application/vnd.google-apps.folder",
    size_bytes: null,
    purpose: "ROOT_FOLDER",
    notes: "Active workspace root.",
  });
  const inactiveRoot = await upsertDriveItem(userId, DRIVE_SCOPE_CODES.inactiveRoot, {
    item_type: "FOLDER",
    parent_id: null,
    parent_drive_item_id: null,
    name: "ROOT_FOLDER",
    drive_url: "https://drive.google.com/drive/folders/smoke-drive-scope-inactive-root",
    drive_path: inactiveRootPath,
    mime_type: "application/vnd.google-apps.folder",
    size_bytes: null,
    purpose: "ROOT_FOLDER",
    notes: "Inactive workspace root.",
  });

  await updateRow("workspaces", state.workspace.id, {
    drive_root_folder_ref_id: activeRoot.id,
    drive_root_folder_url: activeRoot.drive_url,
    drive_root_folder_path: activeRoot.drive_path,
  });
  await updateRow("workspaces", inactiveWorkspace.id, {
    drive_root_folder_ref_id: inactiveRoot.id,
    drive_root_folder_url: inactiveRoot.drive_url,
    drive_root_folder_path: inactiveRoot.drive_path,
  });

  const activeFolder = await upsertDriveItem(userId, DRIVE_SCOPE_CODES.activeFolder, {
    item_type: "FOLDER",
    parent_id: activeRoot.id,
    parent_drive_item_id: activeRoot.drive_item_id,
    name: "Active Produk",
    drive_url: "https://drive.google.com/drive/folders/smoke-drive-scope-active-folder",
    drive_path: `${activeRootPath}/Active Produk`,
    mime_type: "application/vnd.google-apps.folder",
    size_bytes: null,
    purpose: "PRODUCT_FOLDER",
    notes: "Active workspace child folder.",
  });

  const activeFile = await upsertDriveItem(userId, DRIVE_SCOPE_CODES.activeFile, {
    item_type: "FILE",
    parent_id: activeRoot.id,
    parent_drive_item_id: activeRoot.drive_item_id,
    name: "Active Product.png",
    drive_url: "https://drive.google.com/file/d/smoke-drive-scope-active-file/view",
    drive_path: `${activeRootPath}/Active Product.png`,
    mime_type: "image/png",
    size_bytes: 1024,
    purpose: "SOURCE_IMAGE",
    notes: "Active workspace file.",
  });
  await upsertDriveItem(userId, DRIVE_SCOPE_CODES.inactiveFolder, {
    item_type: "FOLDER",
    parent_id: inactiveRoot.id,
    parent_drive_item_id: inactiveRoot.drive_item_id,
    name: "Inactive Produk",
    drive_url: "https://drive.google.com/drive/folders/smoke-drive-scope-inactive-folder",
    drive_path: `${inactiveRootPath}/Inactive Produk`,
    mime_type: "application/vnd.google-apps.folder",
    size_bytes: null,
    purpose: "PRODUCT_FOLDER",
    notes: "Inactive workspace child folder.",
  });
  const inactiveFile = await upsertDriveItem(userId, DRIVE_SCOPE_CODES.inactiveFile, {
    item_type: "FILE",
    parent_id: inactiveRoot.id,
    parent_drive_item_id: inactiveRoot.drive_item_id,
    name: "Inactive Product.png",
    drive_url: "https://drive.google.com/file/d/smoke-drive-scope-inactive-file/view",
    drive_path: `${inactiveRootPath}/Inactive Product.png`,
    mime_type: "image/png",
    size_bytes: 1024,
    purpose: "SOURCE_IMAGE",
    notes: "Inactive workspace file.",
  });
  const crossLinkedFile = await upsertDriveItem(userId, DRIVE_SCOPE_CODES.crossLinkedFile, {
    item_type: "FILE",
    parent_id: activeRoot.id,
    parent_drive_item_id: activeRoot.drive_item_id,
    name: "Cross Account.png",
    drive_url: "https://drive.google.com/file/d/smoke-drive-scope-cross-linked-file/view",
    drive_path: `${inactiveRootPath}/Cross Account.png`,
    mime_type: "image/png",
    size_bytes: 1024,
    purpose: "SOURCE_IMAGE",
    notes: "Malformed cross-account path should stay hidden.",
  });

  await setCurrentWorkspace(userId, activeWorkspace === "primary" ? state.workspace.id : inactiveWorkspace.id);

  return {
    activeFile,
    activeFolder,
    activeWorkspaceId: state.workspace.id,
    crossLinkedFile,
    inactiveFile,
    inactiveWorkspaceId: inactiveWorkspace.id,
    userId,
  };
}

test.beforeEach(async () => {
  await seedDriveScopeFixtures("primary");
});

test("mobile drive long-press selection persists after release", async ({ page }) => {
  try {
    await page.goto("/drive");
    await expect(page.getByRole("heading", { name: "Drive", level: 1 })).toBeVisible();

    const tiles = page.locator(".drive-tile");
    const firstTile = tiles.first();
    const secondTile = tiles.nth(1);

    await expect(firstTile).toBeVisible();
    await expect(secondTile).toBeVisible();

    await longPressTile(page, firstTile);

    await expect(firstTile).toHaveAttribute("data-selected", "true");
    await expect(page.locator(".muted-box strong")).toHaveText("1 dipilih");

    await secondTile.click();

    await expect(firstTile).toHaveAttribute("data-selected", "true");
    await expect(secondTile).toHaveAttribute("data-selected", "true");
    await expect(page.locator(".muted-box strong")).toHaveText("2 dipilih");
    await expect(page.getByRole("dialog", { name: "Preview Drive" })).toHaveCount(0);
  } catch (error) {
    throw classifySmokeError("drive mobile selection", error);
  }
});

test("mobile drive tap still opens preview when no selection is active", async ({ page }) => {
  try {
    await page.goto("/drive");
    await expect(page.getByRole("heading", { name: "Drive", level: 1 })).toBeVisible();

    const firstTile = page.getByRole("button", { name: /Active Product\.png/ });
    await expect(firstTile).toBeVisible();

    await firstTile.click();

    await expect(page.getByRole("dialog", { name: "Preview Drive" })).toBeVisible();
  } catch (error) {
    throw classifySmokeError("drive preview tap fallback", error);
  }
});

test("drive search only exposes the active affiliate workspace root", async ({ page }) => {
  try {
    const fixtures = await seedDriveScopeFixtures("primary");

    await page.goto("/drive");
    await expect(page.getByRole("heading", { name: "Drive", level: 1 })).toBeVisible();
    await expect(page.getByText("Active Product.png")).toBeVisible();
    await expect(page.getByText("Inactive Product.png")).toHaveCount(0);
    await expect(page.getByText("Cross Account.png")).toHaveCount(0);

    await page.getByPlaceholder("Cari Drive").fill("Inactive Product");
    await expect(page.getByText("Inactive Product.png")).toHaveCount(0);
    await expect(page.getByText("Tidak ada item yang cocok.")).toBeVisible();

    await setCurrentWorkspace(fixtures.userId, fixtures.inactiveWorkspaceId);
    await page.goto("/drive");
    await expect(page.getByText("Active Product.png")).toBeVisible();
    await expect(page.getByText("Inactive Product.png")).toHaveCount(0);

    const previewResponse = await page.request.get(`/api/drive/items/${fixtures.inactiveFile.id}/preview`);
    expect(previewResponse.status()).toBe(404);
    const crossLinkedPreviewResponse = await page.request.get(`/api/drive/items/${fixtures.crossLinkedFile.id}/preview`);
    expect(crossLinkedPreviewResponse.status()).toBe(404);
  } catch (error) {
    throw classifySmokeError("drive active affiliate scope", error);
  }
});
