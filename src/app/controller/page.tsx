import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowRight, FileText, Package, Workflow } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { listProducts } from "@/lib/server/products";
import { listPromptPacks } from "@/lib/server/prompt-packs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ControllerPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let promptPacks;
  let products;

  try {
    [promptPacks, products] = await Promise.all([listPromptPacks({ limit: 200 }), listProducts({ limit: 200 })]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load controller.";

    return (
      <SectionCard icon={Workflow} badge="Error" title="Unable to load controller." description={message}>
        <EmptyState icon={Workflow} title="Controller unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const readyPromptPacks = promptPacks.filter((pack) => pack.status === "GENERATED" || pack.status === "NEEDS_REVIEW");

  return (
    <div className="stack">
      <PageHeader
        icon={Workflow}
        badge="Execution"
        title="Controller"
        description="Execution workspace for ready prompts, global Flow tools, queue, and import status."
        stats={[
          { label: "Ready prompts", value: readyPromptPacks.length },
          { label: "Prompt packs", value: promptPacks.length },
          { label: "Flow tools", value: "Global" },
        ]}
      />

      <section className="grid two-up">
        <SectionCard
          icon={FileText}
          title="Ready prompt queue"
          description="Prompts from any product or workspace can be assigned to any available Flow account."
        >
          {readyPromptPacks.length ? (
            <ul className="list">
              {readyPromptPacks.slice(0, 8).map((pack) => {
                const product = productMap.get(pack.product_id);

                return (
                  <li key={pack.id}>
                    <div className="stack-tight">
                      <strong>{pack.prompt_code}</strong>
                      <span className="subtle">
                        {[product?.product_code, product?.product_name, `v${pack.version}`].filter(Boolean).join(" - ")}
                      </span>
                    </div>
                    <div className="section-card__actions">
                      <StatusBadge status={pack.status} />
                      {product ? (
                        <Link className="button compact" href={`/products/${product.id}?tab=prompt`}>
                          <ArrowRight size={15} aria-hidden="true" />
                          Product
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={FileText}
              title="No ready prompts."
              description="Generated prompt packs will appear here for execution."
            />
          )}
        </SectionCard>

        <SectionCard
          icon={Workflow}
          title="Flow account global tool pool"
          description="Flow accounts are global execution tools, not workspace-bound."
        >
          <div className="metric-grid">
            <div className="metric">
              <span>Binding</span>
              <strong>Global per owner</strong>
            </div>
            <div className="metric">
              <span>Account count</span>
              <strong>Dynamic later</strong>
            </div>
            <div className="metric">
              <span>Workspace lock</span>
              <strong>None</strong>
            </div>
          </div>
          <EmptyState
            icon={Workflow}
            title="Flow account tools are scaffolded only."
            description="Credit checks, Chrome profile opening, and batch assignment are not implemented in Sprint 12A."
          />
        </SectionCard>

        <SectionCard icon={Package} title="Execution queue" description="Batch assignment surface for future Flow bridge work.">
          <EmptyState
            icon={Package}
            title="No execution queue yet."
            description="Flow batch tables and batch execution are intentionally out of scope for this sprint."
          />
        </SectionCard>

        <SectionCard icon={Archive} title="Output/import status" description="Status surface for generated files and imports.">
          <EmptyState
            icon={Archive}
            title="No output import status yet."
            description="Output package and import matching are intentionally out of scope for this sprint."
          />
        </SectionCard>
      </section>
    </div>
  );
}
