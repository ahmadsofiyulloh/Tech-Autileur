import { redirect } from "next/navigation";
import { Archive, Image, Package, Save } from "lucide-react";
import { saveProduct, saveProductImage } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDriveItems } from "@/lib/server/drive-items";
import { listProducts } from "@/lib/server/products";
import { PRODUCT_IMAGE_STATUSES, PRODUCT_STATUSES } from "@/lib/products/validation";

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

export default async function ProductsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let products;
  let driveItems;

  try {
    [products, driveItems] = await Promise.all([listProducts({ limit: 200 }), listDriveItems({ limit: 200 })]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load products.";
    return (
      <SectionCard icon={Package} badge="Error" title="Unable to load products." description={message}>
        <EmptyState
          icon={Package}
          title="Products unavailable."
          description="Try again."
        />
      </SectionCard>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        icon={Package}
        badge="Work"
        title="Products"
        description="Product records and source images."
        stats={[
          { label: "Products", value: products.length },
          { label: "Drive refs", value: driveItems.length },
          { label: "Pipeline", value: <StatusBadge status="Queued" tone="neutral" /> },
        ]}
      />

      <SectionCard
        icon={Package}
        badge="New"
        title="Add product"
        description="Save the record, then attach an image."
      >
        <form className="stack" action={saveProduct}>
          <input type="hidden" name="intent" value="create" />
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-product-code">
              <span>Product Code</span>
              <input id="create-product-code" name="product_code" type="text" placeholder="HORG0001" required />
            </label>
            <label className="stack auth-field" htmlFor="create-product-name">
              <span>Product Name</span>
              <input id="create-product-name" name="product_name" type="text" placeholder="Product name" required />
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-niche">
              <span>Niche</span>
              <input id="create-niche" name="niche" type="text" placeholder="Fashion" />
            </label>
            <label className="stack auth-field" htmlFor="create-marketplace">
              <span>Marketplace</span>
              <input id="create-marketplace" name="marketplace" type="text" placeholder="Shopee" />
            </label>
          </div>
          <label className="stack auth-field" htmlFor="create-marketplace-product-link">
            <span>Marketplace Product Link</span>
            <input
              id="create-marketplace-product-link"
              name="marketplace_product_link"
              type="url"
              placeholder="https://..."
            />
          </label>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-status">
              <span>Status</span>
              <select id="create-status" name="status" defaultValue="DRAFT" required>
                {selectOptions(PRODUCT_STATUSES)}
              </select>
            </label>
            <label className="stack auth-field" htmlFor="create-notes">
              <span>Notes</span>
              <textarea id="create-notes" name="notes" rows={3} placeholder="Optional notes" />
            </label>
          </div>
          <FormActions>
            <button className="button primary" type="submit">
              <Save size={16} aria-hidden="true" />
              Save product
            </button>
          </FormActions>
        </form>
      </SectionCard>

      {products.length ? (
        <section className="stack">
          {products.map((product) => {
            const driveItemListId = `drive-items-${product.id}`;

            return (
              <SectionCard
                badge={product.product_code}
                icon={Package}
                title={product.product_name}
                description={[product.marketplace, product.niche].filter(Boolean).join(" - ") || "No marketplace set."}
                key={product.id}
                actions={<StatusBadge status={product.status} />}
              >
                <div className="metric-grid">
                  <div className="metric">
                    <span>Status</span>
                    <strong>
                      <StatusBadge status={product.status} />
                    </strong>
                  </div>
                  <div className="metric">
                    <span>Marketplace</span>
                    <strong>{product.marketplace ?? "Not set"}</strong>
                  </div>
                  <div className="metric">
                    <span>Niche</span>
                    <strong>{product.niche ?? "Not set"}</strong>
                  </div>
                </div>

                <form className="stack" action={saveProduct}>
                  <input type="hidden" name="intent" value="update" />
                  <input type="hidden" name="id" value={product.id} />
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor={`product-code-${product.id}`}>
                      <span>Product Code</span>
                      <input
                        id={`product-code-${product.id}`}
                        name="product_code"
                        type="text"
                        defaultValue={product.product_code}
                        required
                      />
                    </label>
                    <label className="stack auth-field" htmlFor={`product-name-${product.id}`}>
                      <span>Product Name</span>
                      <input
                        id={`product-name-${product.id}`}
                        name="product_name"
                        type="text"
                        defaultValue={product.product_name}
                        required
                      />
                    </label>
                  </div>
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor={`niche-${product.id}`}>
                      <span>Niche</span>
                      <input id={`niche-${product.id}`} name="niche" type="text" defaultValue={fieldValue(product.niche)} />
                    </label>
                    <label className="stack auth-field" htmlFor={`marketplace-${product.id}`}>
                      <span>Marketplace</span>
                      <input
                        id={`marketplace-${product.id}`}
                        name="marketplace"
                        type="text"
                        defaultValue={fieldValue(product.marketplace)}
                      />
                    </label>
                  </div>
                  <label className="stack auth-field" htmlFor={`marketplace-product-link-${product.id}`}>
                    <span>Marketplace Product Link</span>
                    <input
                      id={`marketplace-product-link-${product.id}`}
                      name="marketplace_product_link"
                      type="url"
                      defaultValue={fieldValue(product.marketplace_product_link)}
                    />
                  </label>
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor={`status-${product.id}`}>
                      <span>Status</span>
                      <select id={`status-${product.id}`} name="status" defaultValue={product.status} required>
                        {selectOptions(PRODUCT_STATUSES)}
                      </select>
                    </label>
                    <label className="stack auth-field" htmlFor={`notes-${product.id}`}>
                      <span>Notes</span>
                      <textarea id={`notes-${product.id}`} name="notes" rows={3} defaultValue={fieldValue(product.notes)} />
                    </label>
                  </div>
                  <FormActions>
                    <button className="button primary" type="submit">
                      <Save size={16} aria-hidden="true" />
                      Save changes
                    </button>
                  </FormActions>
                </form>

                <SectionCard icon={Image} badge="Image" title="Attach source image" description="Use an existing Drive reference.">
                  <form className="stack" action={saveProductImage}>
                    <input type="hidden" name="product_id" value={product.id} />
                    <datalist id={driveItemListId}>
                      {driveItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </datalist>
                    <div className="grid two-up">
                      <label className="stack auth-field" htmlFor={`drive-item-ref-id-${product.id}`}>
                        <span>Drive Item Reference</span>
                        <input
                          id={`drive-item-ref-id-${product.id}`}
                          name="drive_item_ref_id"
                          type="text"
                          list={driveItemListId}
                          placeholder="Select or enter a Drive row id"
                          required
                        />
                      </label>
                      <label className="stack auth-field" htmlFor={`is-primary-${product.id}`}>
                        <span>Primary Image</span>
                        <input id={`is-primary-${product.id}`} name="is_primary" type="checkbox" />
                      </label>
                    </div>
                    <div className="grid two-up">
                      <label className="stack auth-field" htmlFor={`image-status-${product.id}`}>
                        <span>Image Status</span>
                        <select id={`image-status-${product.id}`} name="status" defaultValue="ATTACHED" required>
                          {selectOptions(PRODUCT_IMAGE_STATUSES)}
                        </select>
                      </label>
                      <label className="stack auth-field" htmlFor={`image-notes-${product.id}`}>
                        <span>Notes</span>
                        <textarea id={`image-notes-${product.id}`} name="notes" rows={3} placeholder="Optional notes" />
                      </label>
                    </div>
                    <p className="subtle">
                      Select an existing Drive item.
                    </p>
                    <FormActions>
                      <button className="button" type="submit">
                        <Image size={16} aria-hidden="true" />
                        Attach source image
                      </button>
                    </FormActions>
                  </form>
                </SectionCard>

                <FormActions>
                  <form action={saveProduct}>
                    <input type="hidden" name="intent" value="archive" />
                    <input type="hidden" name="id" value={product.id} />
                    <button className="button" type="submit">
                      <Archive size={16} aria-hidden="true" />
                      Archive product
                    </button>
                  </form>
                </FormActions>
              </SectionCard>
            );
          })}
        </section>
      ) : (
        <EmptyState
          icon={Package}
          title="No products yet."
          description="Add a product to start."
        />
      )}
    </div>
  );
}
