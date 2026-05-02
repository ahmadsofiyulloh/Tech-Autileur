import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Inbox, Link2, Package, Save } from "lucide-react";
import { saveIntake } from "@/app/intake/actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { listDriveItems } from "@/lib/server/drive-items";
import { listIntakeSessions } from "@/lib/server/intake";
import { getCurrentWorkspace } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NewProductPageProps = {
  searchParams: Promise<{ workspace?: string | string[] }>;
};

function driveItemLabel(item: { name: string; purpose: string; drive_path: string }) {
  return [item.name, item.purpose, item.drive_path].filter(Boolean).join(" - ");
}

function fieldValue(value: string | number | null | undefined) {
  return value ?? "Not set";
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const query = await searchParams;
  const showAllWorkspaces = firstParam(query.workspace) === "all";
  let driveItems;
  let sessions;
  let currentWorkspace;

  try {
    currentWorkspace = await getCurrentWorkspace();
    [driveItems, sessions] = await Promise.all([
      listDriveItems({ limit: 200 }),
      listIntakeSessions({
        limit: 20,
        workspaceId: currentWorkspace && !showAllWorkspaces ? currentWorkspace.id : undefined,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load intake.";

    return (
      <SectionCard icon={Inbox} badge="Error" title="Unable to load intake." description={message}>
        <EmptyState icon={Inbox} title="Intake unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const scopeLabel = currentWorkspace && !showAllWorkspaces ? currentWorkspace.workspace_name : "All workspaces";
  const linkedCount = sessions.filter((session) => session.product_id).length;

  return (
    <div className="stack">
      <PageHeader
        icon={Inbox}
        badge="Product intake"
        title="New product intake"
        description={`Capture product links, Drive references, and notes. Scope: ${scopeLabel}.`}
        actions={
          <>
            {currentWorkspace ? (
              <Link className="button" href={showAllWorkspaces ? "/products/new" : "/products/new?workspace=all"}>
                {showAllWorkspaces ? "Current workspace" : "All workspaces"}
              </Link>
            ) : null}
            <Link className="button" href="/products">
              <ArrowLeft size={16} aria-hidden="true" />
              Products
            </Link>
          </>
        }
        stats={[
          { label: "Scope", value: scopeLabel },
          { label: "Drive refs", value: driveItems.length },
          { label: "Recent intake", value: sessions.length },
          { label: "Linked", value: linkedCount },
        ]}
      />

      <SectionCard
        icon={Inbox}
        badge="New"
        title="Product intake form"
        description="Images and screenshots are Drive reference placeholders in this sprint. No upload, scraping, or link-based visual parsing is added."
      >
        <form className="stack" action={saveIntake}>
          <input type="hidden" name="intent" value="create_session" />
          <label className="stack auth-field" htmlFor="create-product-title">
            <span>Product title</span>
            <input id="create-product-title" name="product_title" type="text" placeholder="Product name" />
          </label>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-shopee-url">
              <span>Shopee link</span>
              <input id="create-shopee-url" name="shopee_url" type="url" placeholder="https://..." />
            </label>
            <label className="stack auth-field" htmlFor="create-tiktok-url">
              <span>TikTok link</span>
              <input id="create-tiktok-url" name="tiktok_url" type="url" placeholder="https://..." />
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-product-photo-ref">
              <span>Product image reference</span>
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
              <span>Screenshot image reference</span>
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
          <div className="muted-box stack-tight">
            <strong>Workspace</strong>
            <p>{currentWorkspace ? `New intake saves to ${currentWorkspace.workspace_name}.` : "No workspace selected. Intake saves unassigned."}</p>
          </div>
          <div className="muted-box stack-tight">
            <strong>Visual parsing rule</strong>
            <p>
              Product links are metadata only. If image bytes are unavailable, Gemini intake parsing uses the current text-only
              fallback and states that limitation.
            </p>
          </div>
          <FormActions>
            <button className="button primary" type="submit">
              <Save size={16} aria-hidden="true" />
              Save intake
            </button>
          </FormActions>
        </form>
      </SectionCard>

      <SectionCard icon={Package} title="Recent intake" description={`Newest intake sessions. Scope: ${scopeLabel}.`}>
        {sessions.length ? (
          <ul className="list">
            {sessions.slice(0, 5).map((session) => (
              <li key={session.id}>
                <div className="stack-tight">
                  <strong>{fieldValue(session.product_title)}</strong>
                  <span className="subtle">
                    {[session.shopee_url ? "Shopee" : null, session.tiktok_url ? "TikTok" : null, session.intake_code]
                      .filter(Boolean)
                      .join(" - ")}
                  </span>
                </div>
                <div className="section-card__actions">
                  <StatusBadge status={session.status} />
                  {session.product_id ? (
                    <Link className="button compact" href={`/products/${session.product_id}`}>
                      <Link2 size={15} aria-hidden="true" />
                      Product
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Inbox}
            title={currentWorkspace && !showAllWorkspaces ? "No intake in this workspace." : "No intake yet."}
            description={
              currentWorkspace && !showAllWorkspaces
                ? "Use All workspaces to see unassigned or legacy intake."
                : "Save the first product intake above."
            }
          />
        )}
      </SectionCard>
    </div>
  );
}
