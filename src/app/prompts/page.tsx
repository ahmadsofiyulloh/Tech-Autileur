import { redirect } from "next/navigation";
import { savePromptPack } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listDriveItems } from "@/lib/server/drive-items";
import { listProductImages, listProducts } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import {
  PROMPT_I2I_SLOT_KEYS,
  PROMPT_I2V_SLOT_KEYS,
  PROMPT_PACK_STATUSES,
} from "@/lib/prompts/validation";

export const dynamic = "force-dynamic";

type PromptsPageProps = {
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

function prettyJson(value: unknown) {
  return value ? JSON.stringify(value, null, 2) : "No structured output yet.";
}

export default async function PromptsPage({ searchParams }: PromptsPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let promptPacks;
  let products;
  let productImages;
  let driveItems;

  try {
    [promptPacks, products, productImages, driveItems] = await Promise.all([
      listPromptPacks({ limit: 200 }),
      listProducts({ limit: 200 }),
      listProductImages({ limit: 200 }),
      listDriveItems({ limit: 200 }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load prompt metadata.";
    return (
      <SectionCard badge="Prompts error" title="Unable to load prompt metadata." description={message}>
        <EmptyState
          title="Prompt packs are unavailable."
          description="The owner-scoped metadata query failed before the page could render."
        />
      </SectionCard>
    );
  }

  const message = readSearchParam(searchParams?.message);
  const pageError = readSearchParam(searchParams?.error);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const sourceImageMap = new Map(productImages.map((image) => [image.id, image]));
  const aiTaskIds = Array.from(new Set(promptPacks.map((pack) => pack.ai_task_id).filter((value): value is string => Boolean(value))));
  const promptPackTasks = aiTaskIds.length
    ? await supabase
        .from("ai_tasks")
        .select("id, user_id, task_type, status, error_message, started_at, finished_at, created_at, updated_at")
        .eq("user_id", user.id)
        .in("id", aiTaskIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (promptPackTasks.error) {
    return (
      <SectionCard badge="Prompts error" title="Unable to load prompt task metadata." description={promptPackTasks.error.message}>
        <EmptyState
          title="Prompt tasks are unavailable."
          description="The owner-scoped AI task lookup failed before the page could render."
        />
      </SectionCard>
    );
  }

  const promptTaskMap = new Map((promptPackTasks.data ?? []).map((task) => [task.id, task]));

  const draftCount = promptPacks.filter((pack) => pack.status === "DRAFT").length;
  const generatedCount = promptPacks.filter((pack) => pack.status === "GENERATED").length;
  const reviewCount = promptPacks.filter((pack) => pack.status === "NEEDS_REVIEW").length;
  const archivedCount = promptPacks.filter((pack) => pack.status === "ARCHIVED").length;

  const sourceImageOptions = productImages.map((image) => {
    const product = productMap.get(image.product_id);
    const driveItem = driveItemMap.get(image.drive_item_ref_id);
    const label = [
      product?.product_code ?? product?.product_name ?? "Product",
      image.is_primary ? "primary" : null,
      image.status,
      driveItem?.name ?? driveItem?.drive_item_id ?? image.drive_item_ref_id,
    ]
      .filter(Boolean)
      .join(" - ");

    return { value: image.id, label };
  });

  return (
    <div className="stack">
      <PageHeader
        badge="Sprint 6 prompt packs"
        eyebrow="Affiliate AI Content OS"
        title="Prompt pack metadata stays versioned in Supabase."
        description="Each prompt pack stores one vision analysis payload, four i2i prompt slots, two i2v prompt slots, and consistency rules. This sprint is mock/manual only."
        stats={[
          { label: "Prompt packs", value: promptPacks.length },
          { label: "Drafts", value: draftCount },
          { label: "Generated", value: generatedCount },
          { label: "Needs review", value: reviewCount },
          { label: "Archived", value: archivedCount },
        ]}
      />

      {message ? <section className="muted-box" role="status">{message}</section> : null}

      {pageError ? <section className="error-box" role="alert">{pageError}</section> : null}

      <SectionCard
        badge="Locked workload"
        title="Prompt pack output contract."
        description="One vision analysis, four i2i prompts, two i2v prompts, and consistency rules. The actual Gemini runner comes later."
      >
        <div className="metric-grid">
          <div className="metric">
            <span>Vision analysis</span>
            <strong>1</strong>
          </div>
          <div className="metric">
            <span>I2I slots</span>
            <strong>{PROMPT_I2I_SLOT_KEYS.length}</strong>
          </div>
          <div className="metric">
            <span>I2V slots</span>
            <strong>{PROMPT_I2V_SLOT_KEYS.length}</strong>
          </div>
        </div>
      </SectionCard>

      {products.length ? (
        <SectionCard
          badge="Create prompt pack"
          title="Add a versioned prompt pack for a product."
          description="Select a product, optionally attach a source product image row, and save mock/manual output metadata."
        >
          <form className="stack" action={savePromptPack}>
            <input type="hidden" name="intent" value="create" />
            <div className="grid two-up">
              <label className="stack auth-field" htmlFor="create-product-id">
                <span>Product</span>
                <select id="create-product-id" name="product_id" defaultValue={products[0]?.id ?? ""} required>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.product_code} - {product.product_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack auth-field" htmlFor="create-prompt-code">
                <span>Prompt Code</span>
                <input id="create-prompt-code" name="prompt_code" type="text" placeholder="HORG0001-PROMPT" required />
              </label>
            </div>
            <div className="grid two-up">
              <label className="stack auth-field" htmlFor="create-version">
                <span>Version</span>
                <input id="create-version" name="version" type="number" min="1" inputMode="numeric" defaultValue={1} required />
              </label>
              <label className="stack auth-field" htmlFor="create-status">
                <span>Status</span>
                <select id="create-status" name="status" defaultValue="DRAFT" required>
                  {selectOptions(PROMPT_PACK_STATUSES)}
                </select>
              </label>
            </div>
            <label className="stack auth-field" htmlFor="create-source-product-image-id">
              <span>Source Product Image Row ID</span>
              <input
                id="create-source-product-image-id"
                name="source_product_image_id"
                type="text"
                list="prompt-source-image-options"
                placeholder="Optional product_images row id"
              />
            </label>
            <datalist id="prompt-source-image-options">
              {sourceImageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </datalist>
            <label className="stack auth-field" htmlFor="create-notes">
              <span>Notes</span>
              <textarea id="create-notes" name="notes" rows={3} placeholder="Optional prompt pack notes" />
            </label>
            <p className="subtle">
              The source image reference is the local <code>product_images</code> row id. It may be left blank for a draft pack.
            </p>
            <FormActions>
              <button className="button primary" type="submit">
                Save prompt pack
              </button>
            </FormActions>
          </form>
        </SectionCard>
      ) : (
        <EmptyState
          title="Create a product first."
          description="Prompt packs are linked to owner-scoped products. Add product metadata before creating a prompt pack."
          action={
            <a className="button primary" href="/products">
              Open products
            </a>
          }
        />
      )}

      {promptPacks.length ? (
        <section className="stack">
          {promptPacks.map((pack) => {
            const product = productMap.get(pack.product_id);
            const sourceImage = pack.source_product_image_id ? sourceImageMap.get(pack.source_product_image_id) ?? null : null;
            const sourceDriveItem = sourceImage ? driveItemMap.get(sourceImage.drive_item_ref_id) ?? null : null;
            const generationTask = pack.ai_task_id ? promptTaskMap.get(pack.ai_task_id) ?? null : null;
            const analysisJson = prettyJson(pack.product_analysis_json);
            const i2iJson = prettyJson(pack.i2i_prompts_json);
            const i2vJson = prettyJson(pack.i2v_prompts_json);
            const rulesJson = prettyJson(pack.consistency_rules_json);

            return (
              <SectionCard
                badge={pack.prompt_code}
                title={`${product?.product_name ?? "Unknown product"} - v${pack.version}`}
                description={[
                  product?.product_code ? `Product ${product.product_code}` : null,
                  sourceImage ? `Source image ${sourceImage.id}` : null,
                  sourceDriveItem?.name ?? sourceDriveItem?.drive_path ?? null,
                ]
                  .filter(Boolean)
                  .join(" - ") || "No source product image attached yet."}
                key={pack.id}
                actions={<StatusBadge status={pack.status} />}
              >
                <div className="metric-grid">
                  <div className="metric">
                    <span>Product</span>
                    <strong>{product?.product_name ?? "Unknown"}</strong>
                  </div>
                  <div className="metric">
                    <span>Source image</span>
                    <strong>{sourceImage ? (sourceDriveItem?.name ?? sourceImage.id) : "Not attached"}</strong>
                  </div>
                  <div className="metric">
                    <span>Version</span>
                    <strong>{pack.version}</strong>
                  </div>
                  {generationTask ? (
                    <div className="metric">
                      <span>Generation task</span>
                      <strong>
                        <StatusBadge status={generationTask.status} />
                      </strong>
                    </div>
                  ) : null}
                </div>

                {pack.error_message ? <section className="error-box" role="status">{pack.error_message}</section> : null}

                <form className="stack" action={savePromptPack}>
                  <input type="hidden" name="intent" value="update" />
                  <input type="hidden" name="id" value={pack.id} />
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor={`product-id-${pack.id}`}>
                      <span>Product</span>
                      <select id={`product-id-${pack.id}`} name="product_id" defaultValue={pack.product_id} required>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.product_code} - {product.product_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="stack auth-field" htmlFor={`prompt-code-${pack.id}`}>
                      <span>Prompt Code</span>
                      <input id={`prompt-code-${pack.id}`} name="prompt_code" type="text" defaultValue={pack.prompt_code} required />
                    </label>
                  </div>
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor={`version-${pack.id}`}>
                      <span>Version</span>
                      <input id={`version-${pack.id}`} name="version" type="number" min="1" inputMode="numeric" defaultValue={pack.version} required />
                    </label>
                    <label className="stack auth-field" htmlFor={`status-${pack.id}`}>
                      <span>Status</span>
                      <select id={`status-${pack.id}`} name="status" defaultValue={pack.status} required>
                        {selectOptions(PROMPT_PACK_STATUSES)}
                      </select>
                    </label>
                  </div>
                  <label className="stack auth-field" htmlFor={`source-product-image-id-${pack.id}`}>
                    <span>Source Product Image Row ID</span>
                    <input
                      id={`source-product-image-id-${pack.id}`}
                      name="source_product_image_id"
                      type="text"
                      list="prompt-source-image-options"
                      defaultValue={fieldValue(pack.source_product_image_id)}
                      placeholder="Optional product_images row id"
                    />
                  </label>
                  <label className="stack auth-field" htmlFor={`notes-${pack.id}`}>
                    <span>Notes</span>
                    <textarea id={`notes-${pack.id}`} name="notes" rows={3} defaultValue={fieldValue(pack.notes)} />
                  </label>
                  <FormActions>
                    <button className="button primary" type="submit">
                      Save changes
                    </button>
                  </FormActions>
                </form>

                <FormActions>
                  <form action={savePromptPack}>
                    <input type="hidden" name="intent" value="generate" />
                    <input type="hidden" name="id" value={pack.id} />
                    <button className="button" type="submit">
                      Run mock prompt pack
                    </button>
                  </form>
                  <form action={savePromptPack}>
                    <input type="hidden" name="intent" value="archive" />
                    <input type="hidden" name="id" value={pack.id} />
                    <button className="button" type="submit">
                      Archive pack
                    </button>
                  </form>
                </FormActions>

                <details open>
                  <summary>Vision analysis JSON</summary>
                  <pre className="json-block">{analysisJson}</pre>
                </details>
                <details>
                  <summary>I2I prompts JSON</summary>
                  <pre className="json-block">{i2iJson}</pre>
                </details>
                <details>
                  <summary>I2V prompts JSON</summary>
                  <pre className="json-block">{i2vJson}</pre>
                </details>
                <details>
                  <summary>Consistency rules JSON</summary>
                  <pre className="json-block">{rulesJson}</pre>
                </details>
              </SectionCard>
            );
          })}
        </section>
      ) : (
        <EmptyState
          title="No prompt packs yet."
          description="Create the first versioned prompt pack for a product. You can keep it in draft until mock output is generated."
        />
      )}
    </div>
  );
}
