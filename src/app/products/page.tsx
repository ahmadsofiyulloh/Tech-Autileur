import { redirect } from "next/navigation";
import { saveProduct, saveProductImage } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDriveItems } from "@/lib/server/drive-items";
import { listProducts } from "@/lib/server/products";
import { PRODUCT_IMAGE_STATUSES, PRODUCT_STATUSES } from "@/lib/products/validation";

export const dynamic = "force-dynamic";

type ProductsPageProps = {
  searchParams?: {
    message?: string | string[];
    error?: string | string[];
  };
};

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

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

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
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
    const message = error instanceof Error ? error.message : "Unable to load product metadata.";
    return (
      <section className="error-box stack" role="alert">
        <div className="stack">
          <p className="eyebrow">Products error</p>
          <h2>Unable to load product metadata.</h2>
          <p>{message}</p>
        </div>
      </section>
    );
  }

  const message = readSearchParam(searchParams?.message);
  const pageError = readSearchParam(searchParams?.error);

  return (
    <div className="stack">
      <section className="hero">
        <div className="chip">Sprint 5 products</div>
        <div className="stack">
          <p className="eyebrow">Affiliate AI Content OS</p>
          <h2>Product metadata and source images are owner-scoped.</h2>
          <p>
            Products stay in Supabase. Source images link back to Drive metadata, not Supabase Storage or direct file
            uploads.
          </p>
        </div>
        <div className="metric-grid">
          <div className="metric">
            <span>Product scope</span>
            <strong>Metadata only</strong>
          </div>
          <div className="metric">
            <span>Source images</span>
            <strong>Drive-backed</strong>
          </div>
          <div className="metric">
            <span>Pipeline</span>
            <strong>Deferred</strong>
          </div>
        </div>
      </section>

      {message ? (
        <section className="muted-box" role="status">
          {message}
        </section>
      ) : null}

      {pageError ? (
        <section className="error-box" role="alert">
          {pageError}
        </section>
      ) : null}

      <section className="panel stack">
        <div className="stack">
          <p className="eyebrow">Create product</p>
          <h3>Add product metadata.</h3>
        </div>
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
              <textarea id="create-notes" name="notes" rows={3} placeholder="Optional operational notes" />
            </label>
          </div>
          <div className="auth-actions">
            <button className="button primary" type="submit">
              Save product
            </button>
          </div>
        </form>
      </section>

      {products.length ? (
        <section className="stack">
          {products.map((product) => {
            const driveItemListId = `drive-items-${product.id}`;

            return (
              <article className="panel stack" key={product.id}>
                <div className="stack">
                  <p className="eyebrow">{product.product_name}</p>
                  <h3>{product.product_code}</h3>
                </div>

                <div className="metric-grid">
                  <div className="metric">
                    <span>Status</span>
                    <strong>{product.status}</strong>
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
                  <div className="auth-actions">
                    <button className="button primary" type="submit">
                      Save changes
                    </button>
                  </div>
                </form>

                <section className="panel stack">
                  <div className="stack">
                    <p className="eyebrow">Attach source image</p>
                    <h4>Link an existing Drive item metadata row.</h4>
                  </div>
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
                          placeholder="Select or enter a Drive metadata row id"
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
                      Only existing Drive metadata rows can be attached. No upload, no Drive API call, and no Supabase
                      Storage are used here.
                    </p>
                    <div className="auth-actions">
                      <button className="button" type="submit">
                        Attach source image
                      </button>
                    </div>
                  </form>
                </section>

                <form action={saveProduct}>
                  <input type="hidden" name="intent" value="archive" />
                  <input type="hidden" name="id" value={product.id} />
                  <button className="button" type="submit">
                    Archive product
                  </button>
                </form>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="panel stack">
          <div>
            <p className="eyebrow">Empty state</p>
            <h3>No products yet.</h3>
          </div>
          <div className="muted-box">
            <p>
              Add product metadata first, then attach a source image from an existing Drive metadata row. Prompt
              pipeline work remains deferred for later sprints.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
