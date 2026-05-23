import "server-only";

import { resolveDriveImagePreviewUrl } from "@/lib/server/drive-image-previews";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildShareListHref,
  createPaginationState,
  SHARE_LIST_DESKTOP_PAGE_SIZE,
  type PaginationState,
  type ShareListRow,
  type ShareProductStatus,
} from "@/lib/share/share-list-contract";
import type { SharePlatform } from "@/lib/share/share-platform";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ProductRecord = {
  id: string;
  user_id: string;
  product_name: string;
  marketplace: string | null;
  marketplace_product_link: string | null;
  created_at: string;
};

type ProductImageRecord = {
  product_id: string;
  drive_item_ref_id: string;
  is_primary: boolean;
};

type DriveItemRecord = {
  id: string;
  drive_item_id: string | null;
  name: string;
  mime_type: string;
  purpose?: string | null;
};

type ShareProductLinkRecord = {
  product_id: string;
  affiliate_url: string;
};

type ShareGenerationRecord = {
  product_id: string;
  status: string;
  created_at: string;
};

export type ShareListPageInput = {
  platform: SharePlatform;
  page?: number;
  pageSize?: number;
  search?: string | null;
};

export type ShareListRowByProductInput = {
  platform: SharePlatform;
  productId: string;
  page?: number;
  search?: string | null;
};

export type ShareListPageResult = {
  rows: ShareListRow[];
  pagination: PaginationState;
};

async function requireUser(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

function deriveShareStatus(
  hasAffiliateUrl: boolean,
  latestGenerationStatus: string | null,
): ShareProductStatus {
  if (!hasAffiliateUrl) {
    return "needs_link";
  }

  if (!latestGenerationStatus) {
    return "ready";
  }

  if (latestGenerationStatus === "error") {
    return "error";
  }

  return "generated";
}

async function resolveProductThumbnail(input: {
  productId: string;
  supabase: SupabaseServerClient;
  userId: string;
}) {
  const { data: image, error: imageError } = await input.supabase
    .from("product_images")
    .select("product_id, drive_item_ref_id, is_primary")
    .eq("user_id", input.userId)
    .eq("product_id", input.productId)
    .eq("is_primary", true)
    .maybeSingle();

  if (imageError) {
    throw new Error(imageError.message);
  }

  const imageRecord = image as ProductImageRecord | null;

  if (!imageRecord?.drive_item_ref_id) {
    return null;
  }

  const { data: driveItem, error: driveItemError } = await input.supabase
    .from("drive_items")
    .select("id, drive_item_id, name, mime_type, purpose")
    .eq("user_id", input.userId)
    .eq("id", imageRecord.drive_item_ref_id)
    .maybeSingle();

  if (driveItemError) {
    throw new Error(driveItemError.message);
  }

  return resolveDriveImagePreviewUrl((driveItem ?? null) as DriveItemRecord | null);
}

async function resolveShareLink(input: {
  productId: string;
  supabase: SupabaseServerClient;
  userId: string;
}) {
  const { data, error } = await input.supabase
    .from("share_product_links")
    .select("product_id, affiliate_url")
    .eq("user_id", input.userId)
    .eq("product_id", input.productId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? null) as ShareProductLinkRecord | null)?.affiliate_url ?? null;
}

async function resolveLatestGeneration(input: {
  platform: SharePlatform;
  productId: string;
  supabase: SupabaseServerClient;
  userId: string;
}) {
  const { data, error } = await input.supabase
    .from("share_generations")
    .select("product_id, status, created_at")
    .eq("user_id", input.userId)
    .eq("product_id", input.productId)
    .eq("platform", input.platform)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as ShareGenerationRecord | null;
}

export async function listShareListPage(input: ShareListPageInput): Promise<ShareListPageResult> {
  const supabase = await createSupabaseServerClient();
  const user = await requireUser(supabase);

  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? SHARE_LIST_DESKTOP_PAGE_SIZE, 1), 50);
  const search = (input.search ?? "").trim();
  const offset = (page - 1) * pageSize;

  // Count total products
  let countQuery = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "ARCHIVED");

  if (search) {
    countQuery = countQuery.ilike("product_name", `%${search}%`);
  }

  const { count: totalCount, error: countError } = await countQuery;

  if (countError) {
    throw new Error(countError.message);
  }

  const pagination = createPaginationState({
    page,
    pageSize,
    totalCount: totalCount ?? 0,
  });

  if (totalCount === 0) {
    return { rows: [], pagination };
  }

  // Fetch products
  let productsQuery = supabase
    .from("products")
    .select("id, user_id, product_name, marketplace, marketplace_product_link, created_at")
    .eq("user_id", user.id)
    .neq("status", "ARCHIVED")
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (search) {
    productsQuery = productsQuery.ilike("product_name", `%${search}%`);
  }

  const { data: products, error: productsError } = await productsQuery;

  if (productsError) {
    throw new Error(productsError.message);
  }

  if (!products || products.length === 0) {
    return { rows: [], pagination };
  }

  const productRecords = products as ProductRecord[];
  const productIds = productRecords.map((p) => p.id);

  // Fetch primary images
  const { data: images } = await supabase
    .from("product_images")
    .select("product_id, drive_item_ref_id, is_primary")
    .eq("user_id", user.id)
    .in("product_id", productIds)
    .eq("is_primary", true);

  const imageRecords = (images ?? []) as ProductImageRecord[];
  const driveItemRefIds = imageRecords.map((img) => img.drive_item_ref_id);

  // Fetch drive items
  let driveItemRecords: DriveItemRecord[] = [];

  if (driveItemRefIds.length) {
    const { data: driveItems, error: driveItemsError } = await supabase
      .from("drive_items")
      .select("id, drive_item_id, name, mime_type, purpose")
      .eq("user_id", user.id)
      .in("id", driveItemRefIds);

    if (driveItemsError) {
      throw new Error(driveItemsError.message);
    }

    driveItemRecords = (driveItems ?? []) as DriveItemRecord[];
  }
  const driveItemMap = new Map(driveItemRecords.map((item) => [item.id, item]));

  // Fetch affiliate links
  const { data: links } = await supabase
    .from("share_product_links")
    .select("product_id, affiliate_url")
    .eq("user_id", user.id)
    .in("product_id", productIds);

  const linkRecords = (links ?? []) as ShareProductLinkRecord[];
  const linkMap = new Map(linkRecords.map((link) => [link.product_id, link.affiliate_url]));

  // Fetch latest generation per product for this platform
  const { data: generations } = await supabase
    .from("share_generations")
    .select("product_id, status, created_at")
    .eq("user_id", user.id)
    .eq("platform", input.platform)
    .in("product_id", productIds)
    .order("created_at", { ascending: false });

  const generationRecords = (generations ?? []) as ShareGenerationRecord[];
  const latestGenerationMap = new Map<string, ShareGenerationRecord>();

  for (const gen of generationRecords) {
    if (!latestGenerationMap.has(gen.product_id)) {
      latestGenerationMap.set(gen.product_id, gen);
    }
  }

  // Build rows
  const rows: ShareListRow[] = productRecords.map((product) => {
    const primaryImage = imageRecords.find((img) => img.product_id === product.id);
    const driveItem = primaryImage ? driveItemMap.get(primaryImage.drive_item_ref_id) : null;
    const thumbnailUrl = driveItem
      ? resolveDriveImagePreviewUrl({
          id: driveItem.id,
          drive_item_id: driveItem.drive_item_id,
          mime_type: driveItem.mime_type,
          purpose: driveItem.purpose,
        })
      : null;
    const affiliateUrl = linkMap.get(product.id) ?? null;
    const latestGeneration = latestGenerationMap.get(product.id) ?? null;
    const shareStatus = deriveShareStatus(Boolean(affiliateUrl), latestGeneration?.status ?? null);

    return {
      id: product.id,
      product_name: product.product_name,
      marketplace: product.marketplace,
      product_url: product.marketplace_product_link,
      thumbnail_url: thumbnailUrl,
      affiliate_url: affiliateUrl,
      share_status: shareStatus,
      latest_generation_at: latestGeneration?.created_at ?? null,
      href: buildShareListHref({
        platform: input.platform,
        detailId: product.id,
        search,
        page,
      }),
      search_text: product.product_name.toLowerCase(),
    };
  });

  return { rows, pagination };
}

export async function getShareListRowByProductId(input: ShareListRowByProductInput) {
  const supabase = await createSupabaseServerClient();
  const user = await requireUser(supabase);

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, user_id, product_name, marketplace, marketplace_product_link, created_at")
    .eq("user_id", user.id)
    .eq("id", input.productId)
    .neq("status", "ARCHIVED")
    .maybeSingle();

  if (productError) {
    throw new Error(productError.message);
  }

  if (!product) {
    return null;
  }

  const productRecord = product as ProductRecord;
  const [thumbnailUrl, affiliateUrl, latestGeneration] = await Promise.all([
    resolveProductThumbnail({
      productId: productRecord.id,
      supabase,
      userId: user.id,
    }),
    resolveShareLink({
      productId: productRecord.id,
      supabase,
      userId: user.id,
    }),
    resolveLatestGeneration({
      platform: input.platform,
      productId: productRecord.id,
      supabase,
      userId: user.id,
    }),
  ]);
  const shareStatus = deriveShareStatus(Boolean(affiliateUrl), latestGeneration?.status ?? null);

  return {
    id: productRecord.id,
    product_name: productRecord.product_name,
    marketplace: productRecord.marketplace,
    product_url: productRecord.marketplace_product_link,
    thumbnail_url: thumbnailUrl,
    affiliate_url: affiliateUrl,
    share_status: shareStatus,
    latest_generation_at: latestGeneration?.created_at ?? null,
    href: buildShareListHref({
      platform: input.platform,
      detailId: productRecord.id,
      search: input.search,
      page: input.page,
    }),
    search_text: productRecord.product_name.toLowerCase(),
  } satisfies ShareListRow;
}
