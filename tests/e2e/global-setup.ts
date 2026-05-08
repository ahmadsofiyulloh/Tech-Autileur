import { writeSmokeBootstrapState, makeSmokeTag } from "./support/bootstrap";
import { createSmokeServiceClient, getSmokeBaseUrl, getSmokeEmail, getSmokePassword } from "./support/supabase";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv as typeof import("@next/env");
loadEnvConfig(process.cwd());

const SMOKE_CODES = {
  workspace: "SMOKE_WS_PRIMARY",
  profile: "SMOKE_PROFILE_PRIMARY",
  product: "SMOKE_PRODUCT_PRIMARY",
  intake: "SMOKE_INTAKE_PRIMARY",
  driveItems: {
    workspaceRoot: "SMOKE_DRIVE_ROOT_PRIMARY",
    seedCharacter: "SMOKE_DRIVE_CHAR_PRIMARY",
    environment: "SMOKE_DRIVE_ENV_PRIMARY",
    productImage: "SMOKE_DRIVE_PRODUCT_PRIMARY",
    shopeeScreenshot: "SMOKE_DRIVE_SHOPEE_PRIMARY",
  },
} as const;

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`[ENV_BLOCKER] Missing required environment variable: ${name}`);
  }

  return value;
}

async function ensureSmokeUser(email: string, password: string) {
  const client = createSmokeServiceClient();
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    throw new Error(error.message);
  }

  const existing = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    const { error: updateError } = await client.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    return existing.id;
  }

  const { data: created, error: createError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Codex Smoke Operator",
    },
    app_metadata: {
      smoke: true,
    },
  });

  if (createError) {
    throw new Error(createError.message);
  }

  if (!created.user) {
    throw new Error("Smoke user was not created.");
  }

  return created.user.id;
}

type SmokeRow = Record<string, unknown> & { id: string };

async function selectRow(table: string, filters: Record<string, string | boolean | null>) {
  const client = createSmokeServiceClient();
  let query = client.from(table).select("*");

  for (const [column, value] of Object.entries(filters)) {
    if (value === null) {
      query = query.is(column, null);
    } else {
      query = query.eq(column, value as never);
    }
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SmokeRow | null) ?? null;
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

async function upsertByNaturalKey(
  table: string,
  filters: Record<string, string | boolean | null>,
  payload: Record<string, unknown>,
) {
  const existing = await selectRow(table, filters);

  if (existing) {
    return updateRow(table, existing.id, payload);
  }

  return insertRow(table, payload);
}

async function upsertSmokeWorkspace(userId: string) {
  const desired = {
    user_id: userId,
    workspace_code: SMOKE_CODES.workspace,
    workspace_name: "Smoke Workspace",
    niche: "Smoke Testing",
    drive_root_folder_ref_id: null,
    drive_root_folder_url: null,
    drive_root_folder_path: null,
    status: "ACTIVE",
    is_default: true,
    notes: "Seeded by Playwright smoke setup.",
  };

  const canonical = await selectRow("workspaces", {
    user_id: userId,
    workspace_code: SMOKE_CODES.workspace,
  });
  const defaultWorkspace = await selectRow("workspaces", {
    user_id: userId,
    is_default: true,
  });

  if (canonical) {
    if (defaultWorkspace && defaultWorkspace.id !== canonical.id) {
      await updateRow("workspaces", defaultWorkspace.id, {
        is_default: false,
      });
    }

    return updateRow("workspaces", canonical.id, desired);
  }

  if (defaultWorkspace) {
    return updateRow("workspaces", defaultWorkspace.id, desired);
  }

  return insertRow("workspaces", desired);
}

async function seedSmokeData(userId: string) {
  const workspace = await upsertSmokeWorkspace(userId);

  const existingWorkspaceRoot = await selectRow("drive_items", {
    user_id: userId,
    drive_item_id: SMOKE_CODES.driveItems.workspaceRoot,
  });

  if (existingWorkspaceRoot) {
    const { error: deleteRootError } = await createSmokeServiceClient()
      .from("drive_items")
      .delete()
      .eq("id", existingWorkspaceRoot.id);

    if (deleteRootError) {
      throw new Error(deleteRootError.message);
    }
  }

  const { error: workspaceRootUpdateError } = await createSmokeServiceClient()
    .from("workspaces")
    .update({
      drive_root_folder_ref_id: null,
      drive_root_folder_url: null,
      drive_root_folder_path: null,
    })
    .eq("id", workspace.id);

  if (workspaceRootUpdateError) {
    throw new Error(workspaceRootUpdateError.message);
  }

  const seedCharacter = await upsertByNaturalKey(
    "drive_items",
    {
      user_id: userId,
      drive_item_id: SMOKE_CODES.driveItems.seedCharacter,
    },
    {
      user_id: userId,
      item_type: "FILE",
      drive_item_id: SMOKE_CODES.driveItems.seedCharacter,
      parent_id: null,
      parent_drive_item_id: null,
      name: "Smoke Character.png",
      drive_url: "https://drive.google.com/file/d/smoke-char-primary/view",
      drive_path: "/AffiliateAI/SMOKE/PROFILE/PRIMARY/character.png",
      mime_type: "image/png",
      size_bytes: 1024,
      purpose: "SOURCE_IMAGE",
      status: "ACTIVE",
      notes: "Seeded character reference.",
    },
  );

  const environment = await upsertByNaturalKey(
    "drive_items",
    {
      user_id: userId,
      drive_item_id: SMOKE_CODES.driveItems.environment,
    },
    {
      user_id: userId,
      item_type: "FILE",
      drive_item_id: SMOKE_CODES.driveItems.environment,
      parent_id: null,
      parent_drive_item_id: null,
      name: "Smoke Environment.png",
      drive_url: "https://drive.google.com/file/d/smoke-env-primary/view",
      drive_path: "/AffiliateAI/SMOKE/PROFILE/PRIMARY/environment.png",
      mime_type: "image/png",
      size_bytes: 1024,
      purpose: "SOURCE_IMAGE",
      status: "ACTIVE",
      notes: "Seeded environment reference.",
    },
  );

  const productImage = await upsertByNaturalKey(
    "drive_items",
    {
      user_id: userId,
      drive_item_id: SMOKE_CODES.driveItems.productImage,
    },
    {
      user_id: userId,
      item_type: "FILE",
      drive_item_id: SMOKE_CODES.driveItems.productImage,
      parent_id: null,
      parent_drive_item_id: null,
      name: "Smoke Product.png",
      drive_url: "https://drive.google.com/file/d/smoke-product-primary/view",
      drive_path: "/AffiliateAI/SMOKE/PRODUCT/PRIMARY/product.png",
      mime_type: "image/png",
      size_bytes: 1024,
      purpose: "SOURCE_IMAGE",
      status: "ACTIVE",
      notes: "Seeded product source image.",
    },
  );

  const shopeeScreenshot = await upsertByNaturalKey(
    "drive_items",
    {
      user_id: userId,
      drive_item_id: SMOKE_CODES.driveItems.shopeeScreenshot,
    },
    {
      user_id: userId,
      item_type: "FILE",
      drive_item_id: SMOKE_CODES.driveItems.shopeeScreenshot,
      parent_id: null,
      parent_drive_item_id: null,
      name: "Smoke Shopee.png",
      drive_url: "https://drive.google.com/file/d/smoke-shopee-primary/view",
      drive_path: "/AffiliateAI/SMOKE/INTAKE/PRIMARY/shopee.png",
      mime_type: "image/png",
      size_bytes: 1024,
      purpose: "SOURCE_IMAGE",
      status: "ACTIVE",
      notes: "Seeded intake reference.",
    },
  );

  const affiliateProfile = await upsertByNaturalKey(
    "affiliate_profiles",
    {
      user_id: userId,
      profile_code: SMOKE_CODES.profile,
    },
    {
      user_id: userId,
      profile_code: SMOKE_CODES.profile,
      profile_name: "Smoke Profile",
      platform: "TIKTOK",
      account_label: "Smoke operator",
      niche: "Smoke testing",
      affiliate_url: "https://example.com/smoke-profile",
      notes: "Seeded by Playwright smoke setup.",
      i2i_prompt_rules: [
        "Keep the product as the main subject in every frame.",
        "Preserve product shape, label, and color accuracy.",
        "Use the locked character and environment without changing identity.",
        "Avoid extra props, duplicate products, clutter, and text overlays.",
        "Keep composition clean, commercial, and easy to read.",
      ].join("\n"),
      i2v_prompt_rules: [
        "Keep motion subtle and continuous across the clip.",
        "Preserve product identity, angle, and lighting continuity.",
        "Do not introduce cuts, abrupt zooms, or scene changes.",
        "Use the locked character and environment consistently.",
      ].join("\n"),
      caption_rules: [
        "Open with one clear hook.",
        "State one benefit and one simple call to action.",
        "Keep the caption short, natural, and non-spammy.",
      ].join("\n"),
      hashtag_rules: "#smoke #qa #affiliate #testing",
      negative_prompt_rules: [
        "No blur, no watermark, and no text artifacts.",
        "No warped anatomy, broken hands, or duplicate objects.",
        "No clutter, noise, overexposure, or low-resolution output.",
      ].join("\n"),
      product_positioning_notes: [
        "Lead with the product.",
        "Keep the product readable at a glance.",
        "Do not let background elements dominate the frame.",
      ].join("\n"),
      lock_seed_character: true,
      seed_character_notes: "Smoke seed character reference.",
      seed_character_drive_item_ref_id: seedCharacter.id,
      seed_character_analysis_json: {
        drive_item_ref_id: seedCharacter.id,
        analysis_mode: "SMOKE_SEED",
        asset_kind: "CHARACTER",
        subject: "Smoke Character",
        style_keywords: ["smoke", "clean", "locked"],
        prompt_rules: ["Keep the locked character consistent."],
      },
      lock_environment: true,
      environment_notes: "Smoke environment reference.",
      environment_drive_item_ref_id: environment.id,
      environment_analysis_json: {
        drive_item_ref_id: environment.id,
        analysis_mode: "SMOKE_SEED",
        asset_kind: "ENVIRONMENT",
        subject: "Smoke Environment",
        style_keywords: ["smoke", "studio", "locked"],
        prompt_rules: ["Keep the locked environment consistent."],
      },
      status: "ACTIVE",
    },
  );

  const existingDefaultLink = await selectRow("affiliate_profile_workspace_links", {
    user_id: userId,
    workspace_id: workspace.id,
    is_default: true,
  });
  const canonicalLink = await selectRow("affiliate_profile_workspace_links", {
    user_id: userId,
    workspace_id: workspace.id,
    affiliate_profile_id: affiliateProfile.id,
  });

  if (canonicalLink) {
    if (existingDefaultLink && existingDefaultLink.id !== canonicalLink.id) {
      await updateRow("affiliate_profile_workspace_links", existingDefaultLink.id, {
        is_default: false,
      });
    }

    await updateRow("affiliate_profile_workspace_links", canonicalLink.id, {
      user_id: userId,
      workspace_id: workspace.id,
      affiliate_profile_id: affiliateProfile.id,
      is_default: true,
    });
  } else if (existingDefaultLink) {
    await updateRow("affiliate_profile_workspace_links", existingDefaultLink.id, {
      user_id: userId,
      workspace_id: workspace.id,
      affiliate_profile_id: affiliateProfile.id,
      is_default: true,
    });
  } else {
    await insertRow("affiliate_profile_workspace_links", {
      user_id: userId,
      workspace_id: workspace.id,
      affiliate_profile_id: affiliateProfile.id,
      is_default: true,
    });
  }

  const product = await upsertByNaturalKey(
    "products",
    {
      user_id: userId,
      product_code: SMOKE_CODES.product,
    },
    {
      user_id: userId,
      workspace_id: workspace.id,
      product_code: SMOKE_CODES.product,
      product_name: "Smoke Product",
      niche: "Smoke testing",
      marketplace: "SHOPEE + TIKTOK",
      marketplace_product_link: "https://example.com/smoke-product",
      status: "IMAGE_ANALYZED",
      notes: "Seeded product for smoke tests.",
    },
  );

  const productImageRow = await upsertByNaturalKey(
    "product_images",
    {
      user_id: userId,
      product_id: product.id,
      drive_item_ref_id: productImage.id,
    },
    {
      user_id: userId,
      product_id: product.id,
      drive_item_ref_id: productImage.id,
      source_type: "GOOGLE_DRIVE",
      is_primary: true,
      analysis_json: {
        title: "Smoke Product",
        source: "seed",
      },
      status: "ANALYZED",
      notes: "Seeded product source image.",
    },
  );

  const reviewedMetadata = {
    nama_produk: "Smoke Product",
    keyword_cari_etalase: "Smoke keyword",
    deskripsi_visual: "Smoke visual description for the seed intake session.",
    use_case: "Smoke validation",
    pain_point: "Smoke validation friction",
    selling_angle: "Smoke-friendly angle",
    target_viewer: "QA operator",
    catatan_risiko: "Seeded smoke intake.",
    product_title: "Smoke Product",
    marketplace: "SHOPEE + TIKTOK",
    category: "Smoke validation",
    rating_text: "4.9",
    sold_count_text: "123",
    price_text: "Rp 99.000",
    shop_name: "Smoke Shop",
    visible_product_attributes: ["Smoke seed", "Playwright"],
    risk_notes: ["Seeded smoke intake."],
    confidence_notes: ["Seeded by smoke setup."],
  };

  const intake = await upsertByNaturalKey(
    "product_intake_sessions",
    {
      user_id: userId,
      intake_code: SMOKE_CODES.intake,
    },
    {
      user_id: userId,
      workspace_id: workspace.id,
      product_id: product.id,
      intake_code: SMOKE_CODES.intake,
      product_title: "Smoke Product",
      shopee_url: "https://example.com/shopee-smoke",
      tiktok_url: "https://example.com/tiktok-smoke",
      product_photo_drive_item_ref_id: productImage.id,
      screenshot_drive_item_ref_id: shopeeScreenshot.id,
      raw_notes: "Seeded intake session for Playwright smoke tests.",
      parsed_metadata_json: reviewedMetadata,
      reviewed_metadata_json: reviewedMetadata,
      status: "REVIEWED",
      error_message: null,
    },
  );

  const preferencesClient = createSmokeServiceClient();
  const { error: preferencesError } = await preferencesClient.from("user_preferences").upsert(
    {
      user_id: userId,
      current_workspace_id: workspace.id,
    },
    {
      onConflict: "user_id",
    },
  );

  if (preferencesError) {
    throw new Error(preferencesError.message);
  }

  return {
    workspace,
    affiliateProfile,
    product,
    intake,
    driveItems: {
      seedCharacter,
      environment,
      productImage: productImageRow,
      shopeeScreenshot,
    },
  };
}

async function seedSmokeGeminiKeys(userId: string) {
  const client = createSmokeServiceClient();
  const { data: sourceKey, error: sourceKeyError } = await client
    .from("gemini_api_keys")
    .select("user_id")
    .neq("user_id", userId)
    .eq("status", "ACTIVE")
    .eq("role", "VISION_ANALYSIS")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sourceKeyError) {
    throw new Error(sourceKeyError.message);
  }

  if (!sourceKey?.user_id) {
    throw new Error("No Gemini key source was found for smoke setup.");
  }

  const { data: sourceKeys, error: sourceKeysError } = await client
    .from("gemini_api_keys")
    .select(
      "id, user_id, key_code, label, provider, google_account_label, project_label, model_name, role, rpm_limit, rpd_limit, tpm_limit, requests_today, last_used_at, cooldown_until, status, notes",
    )
    .eq("user_id", sourceKey.user_id)
    .order("created_at", { ascending: true });

  if (sourceKeysError) {
    throw new Error(sourceKeysError.message);
  }

  if (!sourceKeys?.length) {
    throw new Error("No Gemini key source rows were found for smoke setup.");
  }

  const { data: sourceSecrets, error: sourceSecretsError } = await client
    .from("gemini_api_key_secrets")
    .select("gemini_api_key_id, encrypted_api_key")
    .eq("user_id", sourceKey.user_id);

  if (sourceSecretsError) {
    throw new Error(sourceSecretsError.message);
  }

  const secretMap = new Map((sourceSecrets ?? []).map((secret) => [secret.gemini_api_key_id, secret.encrypted_api_key]));

  for (const source of sourceKeys ?? []) {
    const smokeKeyCode = source.key_code.startsWith("SMOKE_") ? source.key_code : `SMOKE_${source.key_code}`;
    const smokeKey = await upsertByNaturalKey(
      "gemini_api_keys",
      {
        user_id: userId,
        key_code: smokeKeyCode,
      },
      {
        user_id: userId,
        key_code: smokeKeyCode,
        label: source.label,
        provider: source.provider,
        google_account_label: source.google_account_label,
        project_label: source.project_label,
        model_name: source.model_name,
        role: source.role,
        rpm_limit: source.rpm_limit,
        rpd_limit: source.rpd_limit,
        tpm_limit: source.tpm_limit,
        requests_today: 0,
        last_used_at: null,
        cooldown_until: null,
        status: source.status,
        notes: source.notes,
      },
    );
    const encryptedApiKey = secretMap.get(source.id);

    if (!encryptedApiKey) {
      throw new Error(`Missing Gemini secret for smoke seed key ${source.key_code}.`);
    }

    await upsertByNaturalKey(
      "gemini_api_key_secrets",
      {
        gemini_api_key_id: smokeKey.id,
      },
      {
        user_id: userId,
        gemini_api_key_id: smokeKey.id,
        encrypted_api_key: encryptedApiKey,
      },
    );
  }
}

async function clearSmokeRuntimeData(userId: string) {
  const client = createSmokeServiceClient();

  const deleteOperations = [
    client.from("generated_files").delete().eq("user_id", userId),
    client.from("clip_jobs").delete().eq("user_id", userId),
    client.from("flow_batches").delete().eq("user_id", userId),
    client.from("flow_accounts").delete().eq("user_id", userId),
    client.from("helper_api_tokens").delete().eq("user_id", userId),
  ] as const;

  for (const operation of deleteOperations) {
    const { error } = await operation;

    if (error) {
      throw new Error(error.message);
    }
  }
}

export default async function globalSetup() {
  const runTag = makeSmokeTag();
  const baseUrl = getSmokeBaseUrl();
  const smokeEmail = getSmokeEmail();
  const smokePassword = getSmokePassword();

  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const userId = await ensureSmokeUser(smokeEmail, smokePassword);
  await clearSmokeRuntimeData(userId);
  const seed = await seedSmokeData(userId);
  await seedSmokeGeminiKeys(userId);

  await writeSmokeBootstrapState({
    run_tag: runTag,
    base_url: baseUrl,
    user: {
      id: userId,
      email: smokeEmail,
      password: smokePassword,
    },
    workspace: {
      id: seed.workspace.id,
      code: seed.workspace.workspace_code as string,
      name: seed.workspace.workspace_name as string,
    },
    affiliate_profile: {
      id: seed.affiliateProfile.id,
      code: seed.affiliateProfile.profile_code as string,
      name: seed.affiliateProfile.profile_name as string,
    },
    product: {
      id: seed.product.id,
      code: seed.product.product_code as string,
      name: seed.product.product_name as string,
    },
    intake: {
      id: seed.intake.id,
      code: seed.intake.intake_code as string,
    },
    drive_items: {
      workspace_root_id: null,
      seed_character_id: seed.driveItems.seedCharacter.id,
      environment_id: seed.driveItems.environment.id,
      product_image_id: seed.driveItems.productImage.id,
      shopee_screenshot_id: seed.driveItems.shopeeScreenshot.id,
    },
  });
}
