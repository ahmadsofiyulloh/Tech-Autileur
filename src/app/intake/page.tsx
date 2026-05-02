import { redirect } from "next/navigation";
import { Anchor, BadgeCheck, Inbox, Link2, Package, Save, Tags } from "lucide-react";
import { saveIntake } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { INTAKE_STATUSES, MARKETPLACE_SOURCE_STATUSES } from "@/lib/intake/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDriveItems } from "@/lib/server/drive-items";
import { listIntakeSessions } from "@/lib/server/intake";
import { listProductAnchors } from "@/lib/server/product-anchors";
import { listProductMarketplaceSources } from "@/lib/server/product-marketplace-sources";
import { listProductImages, listProducts } from "@/lib/server/products";

export const dynamic = "force-dynamic";

function selectOptions(values: readonly string[]) {
  return values.map((value) => (
    <option key={value} value={value}>
      {value}
    </option>
  ));
}

function fieldValue(value: string | number | null | undefined) {
  return value ?? "";
}

function driveItemLabel(item: { name: string; purpose: string; drive_path: string }) {
  return [item.name, item.purpose, item.drive_path].filter(Boolean).join(" - ");
}

function metadataValue(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}

function compactErrorMessage(message: string) {
  if (message.includes("product_intake_sessions") || message.includes("product_marketplace_sources") || message.includes("product_anchors")) {
    return "Migration pending.";
  }

  return message;
}

export default async function IntakePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let sessions;
  let products;
  let driveItems;
  let productImages;
  let marketplaceSources;
  let anchors;

  try {
    [sessions, products, driveItems, productImages, marketplaceSources, anchors] = await Promise.all([
      listIntakeSessions({ limit: 200 }),
      listProducts({ limit: 200 }),
      listDriveItems({ limit: 200 }),
      listProductImages({ limit: 200 }),
      listProductMarketplaceSources({ limit: 200 }),
      listProductAnchors({ limit: 200 }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? compactErrorMessage(error.message) : "Unable to load intake.";

    return (
      <SectionCard icon={Inbox} badge="Error" title="Intake unavailable." description={message}>
        <EmptyState icon={Inbox} title="Apply migration first." description="Then refresh." />
      </SectionCard>
    );
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const sourceMap = new Map(marketplaceSources.map((source) => [`${source.product_id}:${source.platform}`, source]));
  const anchorByIntake = new Map(anchors.filter((anchor) => anchor.intake_session_id).map((anchor) => [anchor.intake_session_id, anchor]));
  const linkedCount = sessions.filter((session) => session.product_id).length;
  const reviewCount = sessions.filter((session) => session.status === "NEEDS_REVIEW" || session.status === "REVIEWED").length;

  return (
    <div className="stack">
      <PageHeader
        icon={Inbox}
        badge="Capture"
        title="Intake"
        description="Add product leads."
        stats={[
          { label: "Intakes", value: sessions.length },
          { label: "Linked", value: linkedCount },
          { label: "Review", value: reviewCount },
          { label: "Anchors", value: anchors.length },
        ]}
      />

      <SectionCard icon={Inbox} badge="New" title="Add intake">
        <form className="stack" action={saveIntake}>
          <input type="hidden" name="intent" value="create_session" />
          <label className="stack auth-field" htmlFor="create-product-title">
            <span>Product title</span>
            <input id="create-product-title" name="product_title" type="text" placeholder="Product name" />
          </label>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-shopee-url">
              <span>Shopee URL</span>
              <input id="create-shopee-url" name="shopee_url" type="url" placeholder="https://..." />
            </label>
            <label className="stack auth-field" htmlFor="create-tiktok-url">
              <span>TikTok URL</span>
              <input id="create-tiktok-url" name="tiktok_url" type="url" placeholder="https://..." />
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-product-photo-ref">
              <span>Product photo</span>
              <select id="create-product-photo-ref" name="product_photo_drive_item_ref_id" defaultValue="">
                <option value="">None</option>
                {driveItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {driveItemLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack auth-field" htmlFor="create-screenshot-ref">
              <span>Screenshot</span>
              <select id="create-screenshot-ref" name="screenshot_drive_item_ref_id" defaultValue="">
                <option value="">None</option>
                {driveItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {driveItemLabel(item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="stack auth-field" htmlFor="create-raw-notes">
            <span>Notes</span>
            <textarea id="create-raw-notes" name="raw_notes" rows={3} placeholder="Manual notes" />
          </label>
          <FormActions>
            <button className="button primary" type="submit">
              <Save size={16} aria-hidden="true" />
              Save intake
            </button>
          </FormActions>
        </form>
      </SectionCard>

      {sessions.length ? (
        <section className="stack">
          {sessions.map((session) => {
            const product = session.product_id ? productMap.get(session.product_id) ?? null : null;
            const photo = session.product_photo_drive_item_ref_id
              ? driveItemMap.get(session.product_photo_drive_item_ref_id) ?? null
              : null;
            const screenshot = session.screenshot_drive_item_ref_id
              ? driveItemMap.get(session.screenshot_drive_item_ref_id) ?? null
              : null;
            const shopeeSource = product ? sourceMap.get(`${product.id}:SHOPEE`) ?? null : null;
            const tiktokSource = product ? sourceMap.get(`${product.id}:TIKTOK`) ?? null : null;
            const intakeAnchor = anchorByIntake.get(session.id) ?? null;
            const productSourceImages = session.product_id
              ? productImages.filter((image) => image.product_id === session.product_id)
              : [];
            const reviewedMetadata = session.reviewed_metadata_json as Record<string, unknown> | null;
            const title = session.product_title ?? product?.product_name ?? "Untitled intake";

            return (
              <SectionCard
                actions={<StatusBadge status={session.status} />}
                badge={session.intake_code}
                icon={Inbox}
                key={session.id}
                title={title}
                description={product ? `${product.product_code} - ${product.product_name}` : "No product linked."}
              >
                <div className="metric-grid">
                  <div className="metric">
                    <span>Product</span>
                    <strong>{product?.product_code ?? "Unlinked"}</strong>
                  </div>
                  <div className="metric">
                    <span>Photo</span>
                    <strong>{photo?.name ?? "None"}</strong>
                  </div>
                  <div className="metric">
                    <span>Screenshot</span>
                    <strong>{screenshot?.name ?? "None"}</strong>
                  </div>
                </div>

                <details open>
                  <summary>Edit intake</summary>
                  <form className="stack grid" action={saveIntake}>
                    <input type="hidden" name="intent" value="update_session" />
                    <input type="hidden" name="id" value={session.id} />
                    <label className="stack auth-field" htmlFor={`product-title-${session.id}`}>
                      <span>Product title</span>
                      <input
                        id={`product-title-${session.id}`}
                        name="product_title"
                        type="text"
                        defaultValue={fieldValue(session.product_title)}
                      />
                    </label>
                    <div className="grid two-up">
                      <label className="stack auth-field" htmlFor={`shopee-url-${session.id}`}>
                        <span>Shopee URL</span>
                        <input
                          id={`shopee-url-${session.id}`}
                          name="shopee_url"
                          type="url"
                          defaultValue={fieldValue(session.shopee_url)}
                        />
                      </label>
                      <label className="stack auth-field" htmlFor={`tiktok-url-${session.id}`}>
                        <span>TikTok URL</span>
                        <input
                          id={`tiktok-url-${session.id}`}
                          name="tiktok_url"
                          type="url"
                          defaultValue={fieldValue(session.tiktok_url)}
                        />
                      </label>
                    </div>
                    <div className="grid two-up">
                      <label className="stack auth-field" htmlFor={`photo-ref-${session.id}`}>
                        <span>Product photo</span>
                        <select
                          id={`photo-ref-${session.id}`}
                          name="product_photo_drive_item_ref_id"
                          defaultValue={fieldValue(session.product_photo_drive_item_ref_id)}
                        >
                          <option value="">None</option>
                          {driveItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {driveItemLabel(item)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="stack auth-field" htmlFor={`screenshot-ref-${session.id}`}>
                        <span>Screenshot</span>
                        <select
                          id={`screenshot-ref-${session.id}`}
                          name="screenshot_drive_item_ref_id"
                          defaultValue={fieldValue(session.screenshot_drive_item_ref_id)}
                        >
                          <option value="">None</option>
                          {driveItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {driveItemLabel(item)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="grid two-up">
                      <label className="stack auth-field" htmlFor={`status-${session.id}`}>
                        <span>Status</span>
                        <select id={`status-${session.id}`} name="status" defaultValue={session.status}>
                          {selectOptions(INTAKE_STATUSES)}
                        </select>
                      </label>
                      <label className="stack auth-field" htmlFor={`raw-notes-${session.id}`}>
                        <span>Notes</span>
                        <textarea id={`raw-notes-${session.id}`} name="raw_notes" rows={3} defaultValue={fieldValue(session.raw_notes)} />
                      </label>
                    </div>
                    <FormActions>
                      <button className="button primary" type="submit">
                        <Save size={16} aria-hidden="true" />
                        Save changes
                      </button>
                    </FormActions>
                  </form>
                </details>

                <details>
                  <summary>Product</summary>
                  <div className="grid two-up">
                    <form className="stack" action={saveIntake}>
                      <input type="hidden" name="intent" value="link_product" />
                      <input type="hidden" name="id" value={session.id} />
                      <label className="stack auth-field" htmlFor={`link-product-${session.id}`}>
                        <span>Existing product</span>
                        <select id={`link-product-${session.id}`} name="product_id" defaultValue={fieldValue(session.product_id)}>
                          <option value="">Choose product</option>
                          {products.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.product_code} - {item.product_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <FormActions>
                        <button className="button" type="submit" disabled={!products.length}>
                          <Link2 size={16} aria-hidden="true" />
                          Link product
                        </button>
                      </FormActions>
                    </form>

                    <form className="stack" action={saveIntake}>
                      <input type="hidden" name="intent" value="create_product" />
                      <input type="hidden" name="id" value={session.id} />
                      <label className="stack auth-field" htmlFor={`create-product-code-${session.id}`}>
                        <span>Product code</span>
                        <input id={`create-product-code-${session.id}`} name="product_code" type="text" placeholder="Auto if empty" />
                      </label>
                      <label className="stack auth-field" htmlFor={`create-product-name-${session.id}`}>
                        <span>Product name</span>
                        <input
                          id={`create-product-name-${session.id}`}
                          name="product_name"
                          type="text"
                          defaultValue={fieldValue(session.product_title)}
                          required
                        />
                      </label>
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`create-niche-${session.id}`}>
                          <span>Niche</span>
                          <input id={`create-niche-${session.id}`} name="niche" type="text" placeholder="Optional" />
                        </label>
                        <label className="stack auth-field" htmlFor={`create-product-notes-${session.id}`}>
                          <span>Notes</span>
                          <textarea id={`create-product-notes-${session.id}`} name="product_notes" rows={2} />
                        </label>
                      </div>
                      <FormActions>
                        <button className="button primary" type="submit">
                          <Package size={16} aria-hidden="true" />
                          Create product
                        </button>
                      </FormActions>
                    </form>
                  </div>
                </details>

                <details>
                  <summary>Review</summary>
                  <form className="stack grid" action={saveIntake}>
                    <input type="hidden" name="intent" value="review_metadata" />
                    <input type="hidden" name="id" value={session.id} />
                    <div className="grid two-up">
                      <label className="stack auth-field" htmlFor={`review-title-${session.id}`}>
                        <span>Title</span>
                        <input
                          id={`review-title-${session.id}`}
                          name="review_title"
                          type="text"
                          defaultValue={metadataValue(reviewedMetadata, "title") || fieldValue(session.product_title)}
                        />
                      </label>
                      <label className="stack auth-field" htmlFor={`review-category-${session.id}`}>
                        <span>Category</span>
                        <input
                          id={`review-category-${session.id}`}
                          name="review_category"
                          type="text"
                          defaultValue={metadataValue(reviewedMetadata, "category")}
                        />
                      </label>
                    </div>
                    <div className="grid two-up">
                      <label className="stack auth-field" htmlFor={`review-price-${session.id}`}>
                        <span>Price</span>
                        <input
                          id={`review-price-${session.id}`}
                          name="review_price_text"
                          type="text"
                          defaultValue={metadataValue(reviewedMetadata, "price_text")}
                        />
                      </label>
                      <label className="stack auth-field" htmlFor={`review-shop-${session.id}`}>
                        <span>Shop</span>
                        <input
                          id={`review-shop-${session.id}`}
                          name="review_shop_name"
                          type="text"
                          defaultValue={metadataValue(reviewedMetadata, "shop_name")}
                        />
                      </label>
                    </div>
                    <div className="grid two-up">
                      <label className="stack auth-field" htmlFor={`review-rating-${session.id}`}>
                        <span>Rating</span>
                        <input
                          id={`review-rating-${session.id}`}
                          name="review_rating_text"
                          type="text"
                          defaultValue={metadataValue(reviewedMetadata, "rating_text")}
                        />
                      </label>
                      <label className="stack auth-field" htmlFor={`review-sold-${session.id}`}>
                        <span>Sold</span>
                        <input
                          id={`review-sold-${session.id}`}
                          name="review_sold_count_text"
                          type="text"
                          defaultValue={metadataValue(reviewedMetadata, "sold_count_text")}
                        />
                      </label>
                    </div>
                    <label className="stack auth-field" htmlFor={`review-notes-${session.id}`}>
                      <span>Notes</span>
                      <textarea
                        id={`review-notes-${session.id}`}
                        name="review_notes"
                        rows={3}
                        defaultValue={metadataValue(reviewedMetadata, "notes")}
                      />
                    </label>
                    <FormActions>
                      <button className="button primary" type="submit">
                        <BadgeCheck size={16} aria-hidden="true" />
                        Mark reviewed
                      </button>
                    </FormActions>
                  </form>
                </details>

                <details>
                  <summary>Sources</summary>
                  {product ? (
                    <form className="stack grid" action={saveIntake}>
                      <input type="hidden" name="intent" value="save_sources" />
                      <input type="hidden" name="id" value={session.id} />
                      <SectionCard icon={Tags} badge="Shopee" title="Shopee source" actions={shopeeSource ? <StatusBadge status={shopeeSource.status} /> : null}>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`shopee-url-source-${session.id}`}>
                            <span>Product URL</span>
                            <input
                              id={`shopee-url-source-${session.id}`}
                              name="shopee_product_url"
                              type="url"
                              defaultValue={fieldValue(shopeeSource?.product_url ?? session.shopee_url)}
                            />
                          </label>
                          <label className="stack auth-field" htmlFor={`shopee-affiliate-url-${session.id}`}>
                            <span>Affiliate URL</span>
                            <input
                              id={`shopee-affiliate-url-${session.id}`}
                              name="shopee_affiliate_url"
                              type="url"
                              defaultValue={fieldValue(shopeeSource?.affiliate_url)}
                            />
                          </label>
                        </div>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`shopee-title-${session.id}`}>
                            <span>Title</span>
                            <input
                              id={`shopee-title-${session.id}`}
                              name="shopee_title"
                              type="text"
                              defaultValue={fieldValue(shopeeSource?.title ?? (session.shopee_url ? session.product_title : null))}
                            />
                          </label>
                          <label className="stack auth-field" htmlFor={`shopee-category-${session.id}`}>
                            <span>Category</span>
                            <input
                              id={`shopee-category-${session.id}`}
                              name="shopee_category"
                              type="text"
                              defaultValue={fieldValue(shopeeSource?.category)}
                            />
                          </label>
                        </div>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`shopee-price-${session.id}`}>
                            <span>Price</span>
                            <input
                              id={`shopee-price-${session.id}`}
                              name="shopee_price_text"
                              type="text"
                              defaultValue={fieldValue(shopeeSource?.price_text)}
                            />
                          </label>
                          <label className="stack auth-field" htmlFor={`shopee-shop-${session.id}`}>
                            <span>Shop</span>
                            <input
                              id={`shopee-shop-${session.id}`}
                              name="shopee_shop_name"
                              type="text"
                              defaultValue={fieldValue(shopeeSource?.shop_name)}
                            />
                          </label>
                        </div>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`shopee-rating-${session.id}`}>
                            <span>Rating</span>
                            <input
                              id={`shopee-rating-${session.id}`}
                              name="shopee_rating_text"
                              type="text"
                              defaultValue={fieldValue(shopeeSource?.rating_text)}
                            />
                          </label>
                          <label className="stack auth-field" htmlFor={`shopee-sold-${session.id}`}>
                            <span>Sold</span>
                            <input
                              id={`shopee-sold-${session.id}`}
                              name="shopee_sold_count_text"
                              type="text"
                              defaultValue={fieldValue(shopeeSource?.sold_count_text)}
                            />
                          </label>
                        </div>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`shopee-screenshot-${session.id}`}>
                            <span>Screenshot</span>
                            <select
                              id={`shopee-screenshot-${session.id}`}
                              name="shopee_screenshot_drive_item_ref_id"
                              defaultValue={fieldValue(shopeeSource?.screenshot_drive_item_ref_id ?? session.screenshot_drive_item_ref_id)}
                            >
                              <option value="">None</option>
                              {driveItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {driveItemLabel(item)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="stack auth-field" htmlFor={`shopee-status-${session.id}`}>
                            <span>Status</span>
                            <select id={`shopee-status-${session.id}`} name="shopee_status" defaultValue={shopeeSource?.status ?? "DRAFT"}>
                              {selectOptions(MARKETPLACE_SOURCE_STATUSES)}
                            </select>
                          </label>
                        </div>
                        <label className="stack auth-field" htmlFor={`shopee-notes-${session.id}`}>
                          <span>Notes</span>
                          <textarea id={`shopee-notes-${session.id}`} name="shopee_notes" rows={2} defaultValue={fieldValue(shopeeSource?.notes)} />
                        </label>
                      </SectionCard>

                      <SectionCard icon={Tags} badge="TikTok" title="TikTok source" actions={tiktokSource ? <StatusBadge status={tiktokSource.status} /> : null}>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`tiktok-url-source-${session.id}`}>
                            <span>Product URL</span>
                            <input
                              id={`tiktok-url-source-${session.id}`}
                              name="tiktok_product_url"
                              type="url"
                              defaultValue={fieldValue(tiktokSource?.product_url ?? session.tiktok_url)}
                            />
                          </label>
                          <label className="stack auth-field" htmlFor={`tiktok-affiliate-url-${session.id}`}>
                            <span>Affiliate URL</span>
                            <input
                              id={`tiktok-affiliate-url-${session.id}`}
                              name="tiktok_affiliate_url"
                              type="url"
                              defaultValue={fieldValue(tiktokSource?.affiliate_url)}
                            />
                          </label>
                        </div>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`tiktok-title-${session.id}`}>
                            <span>Title</span>
                            <input
                              id={`tiktok-title-${session.id}`}
                              name="tiktok_title"
                              type="text"
                              defaultValue={fieldValue(tiktokSource?.title ?? (session.tiktok_url ? session.product_title : null))}
                            />
                          </label>
                          <label className="stack auth-field" htmlFor={`tiktok-category-${session.id}`}>
                            <span>Category</span>
                            <input
                              id={`tiktok-category-${session.id}`}
                              name="tiktok_category"
                              type="text"
                              defaultValue={fieldValue(tiktokSource?.category)}
                            />
                          </label>
                        </div>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`tiktok-price-${session.id}`}>
                            <span>Price</span>
                            <input
                              id={`tiktok-price-${session.id}`}
                              name="tiktok_price_text"
                              type="text"
                              defaultValue={fieldValue(tiktokSource?.price_text)}
                            />
                          </label>
                          <label className="stack auth-field" htmlFor={`tiktok-shop-${session.id}`}>
                            <span>Shop</span>
                            <input
                              id={`tiktok-shop-${session.id}`}
                              name="tiktok_shop_name"
                              type="text"
                              defaultValue={fieldValue(tiktokSource?.shop_name)}
                            />
                          </label>
                        </div>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`tiktok-rating-${session.id}`}>
                            <span>Rating</span>
                            <input
                              id={`tiktok-rating-${session.id}`}
                              name="tiktok_rating_text"
                              type="text"
                              defaultValue={fieldValue(tiktokSource?.rating_text)}
                            />
                          </label>
                          <label className="stack auth-field" htmlFor={`tiktok-sold-${session.id}`}>
                            <span>Sold</span>
                            <input
                              id={`tiktok-sold-${session.id}`}
                              name="tiktok_sold_count_text"
                              type="text"
                              defaultValue={fieldValue(tiktokSource?.sold_count_text)}
                            />
                          </label>
                        </div>
                        <div className="grid two-up">
                          <label className="stack auth-field" htmlFor={`tiktok-screenshot-${session.id}`}>
                            <span>Screenshot</span>
                            <select
                              id={`tiktok-screenshot-${session.id}`}
                              name="tiktok_screenshot_drive_item_ref_id"
                              defaultValue={fieldValue(tiktokSource?.screenshot_drive_item_ref_id ?? session.screenshot_drive_item_ref_id)}
                            >
                              <option value="">None</option>
                              {driveItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {driveItemLabel(item)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="stack auth-field" htmlFor={`tiktok-status-${session.id}`}>
                            <span>Status</span>
                            <select id={`tiktok-status-${session.id}`} name="tiktok_status" defaultValue={tiktokSource?.status ?? "DRAFT"}>
                              {selectOptions(MARKETPLACE_SOURCE_STATUSES)}
                            </select>
                          </label>
                        </div>
                        <label className="stack auth-field" htmlFor={`tiktok-notes-${session.id}`}>
                          <span>Notes</span>
                          <textarea id={`tiktok-notes-${session.id}`} name="tiktok_notes" rows={2} defaultValue={fieldValue(tiktokSource?.notes)} />
                        </label>
                      </SectionCard>

                      <FormActions>
                        <button className="button primary" type="submit">
                          <Tags size={16} aria-hidden="true" />
                          Save sources
                        </button>
                      </FormActions>
                    </form>
                  ) : (
                    <EmptyState icon={Package} title="Link product first." />
                  )}
                </details>

                <details>
                  <summary>Anchor</summary>
                  {product ? (
                    <form className="stack grid" action={saveIntake}>
                      <input type="hidden" name="intent" value="create_anchor" />
                      <input type="hidden" name="id" value={session.id} />
                      <div className="grid two-up">
                        <label className="stack auth-field" htmlFor={`anchor-code-${session.id}`}>
                          <span>Anchor code</span>
                          <input
                            id={`anchor-code-${session.id}`}
                            name="anchor_code"
                            type="text"
                            defaultValue={intakeAnchor?.anchor_code ?? `${product.product_code}-ANCHOR`}
                            required
                          />
                        </label>
                        <label className="stack auth-field" htmlFor={`source-image-${session.id}`}>
                          <span>Source image</span>
                          <select id={`source-image-${session.id}`} name="source_product_image_id" defaultValue="">
                            <option value="">None</option>
                            {productSourceImages.map((image) => {
                              const driveItem = driveItemMap.get(image.drive_item_ref_id);

                              return (
                                <option key={image.id} value={image.id}>
                                  {[driveItem?.name ?? image.id, image.status, image.is_primary ? "Primary" : null].filter(Boolean).join(" - ")}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                      </div>
                      <label className="stack auth-field" htmlFor={`anchor-notes-${session.id}`}>
                        <span>Notes</span>
                        <textarea id={`anchor-notes-${session.id}`} name="anchor_notes" rows={2} defaultValue={fieldValue(intakeAnchor?.notes)} />
                      </label>
                      <FormActions>
                        <button className="button primary" type="submit">
                          <Anchor size={16} aria-hidden="true" />
                          Create anchor
                        </button>
                      </FormActions>
                    </form>
                  ) : (
                    <EmptyState icon={Package} title="Link product first." />
                  )}
                </details>
              </SectionCard>
            );
          })}
        </section>
      ) : (
        <EmptyState icon={Inbox} title="No intake yet." description="Add the first lead." />
      )}
    </div>
  );
}
