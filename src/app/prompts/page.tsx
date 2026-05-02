import { redirect } from "next/navigation";
import { Archive, FileText, FlaskConical, Package, Play, Save } from "lucide-react";
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
  return value ? JSON.stringify(value, null, 2) : "No output yet.";
}

export default async function PromptsPage() {
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
    const message = error instanceof Error ? error.message : "Unable to load prompts.";
    return (
      <SectionCard badge="Error" title="Unable to load prompts." description={message}>
        <EmptyState
          icon={FileText}
          title="Prompts unavailable."
          description="Try again."
        />
      </SectionCard>
    );
  }

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
      <SectionCard badge="Error" title="Unable to load tasks." description={promptPackTasks.error.message}>
        <EmptyState
          icon={FileText}
          title="Tasks unavailable."
          description="Try again."
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
        icon={FileText}
        badge="Compatibility"
        title="Prompts"
        description="Compatibility manager. Product Detail is the main prompt history surface; Controller is the execution surface."
        stats={[
          { label: "Prompt packs", value: promptPacks.length },
          { label: "Drafts", value: draftCount },
          { label: "Generated", value: generatedCount },
          { label: "Needs review", value: reviewCount },
          { label: "Archived", value: archivedCount },
        ]}
      />

      <SectionCard
        icon={FileText}
        badge="Shape"
        title="Prompt set"
        description="Vision, i2i, and i2v slots."
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
        icon={FileText}
        badge="New"
        title="Add prompt pack"
        description="Choose a product and version."
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
              <span>Source image row</span>
              <input
                id="create-source-product-image-id"
                name="source_product_image_id"
                type="text"
                list="prompt-source-image-options"
                placeholder="Optional row id"
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
              <textarea id="create-notes" name="notes" rows={3} placeholder="Optional notes" />
            </label>
            <p className="subtle">
              Source image is optional for drafts.
            </p>
            <FormActions>
              <button className="button primary" type="submit">
                <Save size={16} aria-hidden="true" />
                Save prompt pack
              </button>
            </FormActions>
          </form>
        </SectionCard>
      ) : (
        <EmptyState
          icon={Package}
          title="Create a product first."
          description="Prompts need a product."
          action={
            <a className="button primary" href="/products/new">New intake</a>
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
                icon={FileText}
                title={`${product?.product_name ?? "Unknown product"} - v${pack.version}`}
                description={[
                  product?.product_code ? `Product ${product.product_code}` : null,
                  sourceImage ? `Source image ${sourceImage.id}` : null,
                  sourceDriveItem?.name ?? sourceDriveItem?.drive_path ?? null,
                ]
                  .filter(Boolean)
                  .join(" - ") || "No source image."}
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

              {generationTask?.error_message ? (
                <section
                  className={generationTask.status === "FAILED" ? "error-box" : "muted-box"}
                  role={generationTask.status === "FAILED" ? "alert" : "status"}
                >
                  {generationTask.error_message}
                </section>
              ) : null}

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
                    <span>Source image row</span>
                    <input
                      id={`source-product-image-id-${pack.id}`}
                      name="source_product_image_id"
                      type="text"
                      list="prompt-source-image-options"
                      defaultValue={fieldValue(pack.source_product_image_id)}
                      placeholder="Optional row id"
                    />
                  </label>
                  <label className="stack auth-field" htmlFor={`notes-${pack.id}`}>
                    <span>Notes</span>
                    <textarea id={`notes-${pack.id}`} name="notes" rows={3} defaultValue={fieldValue(pack.notes)} />
                  </label>
                  <FormActions>
                  <button className="button primary" type="submit">
                    <Save size={16} aria-hidden="true" />
                    Save changes
                  </button>
                </FormActions>
                </form>

                <FormActions>
                  <form action={savePromptPack}>
                    <input type="hidden" name="intent" value="generate" />
                    <input type="hidden" name="generation_mode" value="gemini" />
                    <input type="hidden" name="id" value={pack.id} />
                    <button className="button primary" type="submit">
                      <Play size={16} aria-hidden="true" />
                      Generate with Gemini
                    </button>
                  </form>
                  <form action={savePromptPack}>
                    <input type="hidden" name="intent" value="generate" />
                    <input type="hidden" name="generation_mode" value="mock" />
                    <input type="hidden" name="id" value={pack.id} />
                    <button className="button" type="submit">
                      <FlaskConical size={16} aria-hidden="true" />
                      Generate mock
                    </button>
                  </form>
                  <form action={savePromptPack}>
                    <input type="hidden" name="intent" value="archive" />
                    <input type="hidden" name="id" value={pack.id} />
                    <button className="button" type="submit">
                      <Archive size={16} aria-hidden="true" />
                      Archive pack
                    </button>
                  </form>
                </FormActions>

                <details open>
                <summary>Vision analysis</summary>
                <pre className="json-block">{analysisJson}</pre>
              </details>
              <details>
                <summary>I2I prompts</summary>
                <pre className="json-block">{i2iJson}</pre>
              </details>
              <details>
                <summary>I2V prompts</summary>
                <pre className="json-block">{i2vJson}</pre>
              </details>
              <details>
                <summary>Consistency rules</summary>
                <pre className="json-block">{rulesJson}</pre>
              </details>
              </SectionCard>
            );
          })}
        </section>
      ) : (
        <EmptyState
          icon={FileText}
          title="No prompt packs yet."
          description="Create a pack for a product."
        />
      )}
    </div>
  );
}
