import { redirect } from "next/navigation";
import { saveDriveItem } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DRIVE_ITEM_PURPOSES,
  DRIVE_ITEM_STATUSES,
  DRIVE_ITEM_TYPES,
} from "@/lib/drive/validation";
import { listDriveItems } from "@/lib/server/drive-items";

export const dynamic = "force-dynamic";

type DrivePageProps = {
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

export default async function DrivePage({ searchParams }: DrivePageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let driveItems;

  try {
    driveItems = await listDriveItems({ limit: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Drive metadata.";
    return (
      <SectionCard badge="Drive manager error" title="Unable to load Drive metadata." description={message}>
        <EmptyState
          title="Drive items are unavailable."
          description="The owner-scoped metadata query failed before the page could render."
        />
      </SectionCard>
    );
  }

  const message = readSearchParam(searchParams?.message);
  const pageError = readSearchParam(searchParams?.error);

  return (
    <div className="stack">
      <PageHeader
        badge="Sprint 4 Drive manager"
        eyebrow="Affiliate AI Content OS"
        title="Google Drive metadata stays in Supabase."
        description="Drive files and folders are registered here as metadata only. Large assets stay in Google Drive and are never uploaded to Supabase Storage."
        stats={[
          { label: "Items", value: driveItems.length },
          { label: "Source", value: "Google Drive" },
          { label: "Storage", value: <StatusBadge status="Metadata only" tone="success" /> },
        ]}
      />

      {message ? <section className="muted-box" role="status">{message}</section> : null}

      {pageError ? <section className="error-box" role="alert">{pageError}</section> : null}

      <SectionCard
        badge="Manual registration"
        title="Add a Drive file or folder metadata record."
        description="Drive paths are metadata only. Use the locked folder structure, but do not expect this page to create real folders or upload files."
      >
        <form className="stack" action={saveDriveItem}>
          <input type="hidden" name="intent" value="create" />
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-item-type">
              <span>Item Type</span>
              <select id="create-item-type" name="item_type" defaultValue={DRIVE_ITEM_TYPES[0]} required>
                {selectOptions(DRIVE_ITEM_TYPES)}
              </select>
            </label>
            <label className="stack auth-field" htmlFor="create-purpose">
              <span>Purpose</span>
              <select id="create-purpose" name="purpose" defaultValue="OTHER" required>
                {selectOptions(DRIVE_ITEM_PURPOSES)}
              </select>
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-name">
              <span>Name</span>
              <input id="create-name" name="name" type="text" placeholder="AffiliateAI" required />
            </label>
            <label className="stack auth-field" htmlFor="create-status">
              <span>Status</span>
              <select id="create-status" name="status" defaultValue="ACTIVE" required>
                {selectOptions(DRIVE_ITEM_STATUSES)}
              </select>
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-drive-item-id">
              <span>Drive Item ID</span>
              <input id="create-drive-item-id" name="drive_item_id" type="text" placeholder="Optional for manual entry" />
            </label>
            <label className="stack auth-field" htmlFor="create-parent-drive-item-id">
              <span>Google Parent ID</span>
              <input
                id="create-parent-drive-item-id"
                name="parent_drive_item_id"
                type="text"
                placeholder="Optional Google Drive parent ID"
              />
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-parent-id">
              <span>Parent Row ID</span>
              <input id="create-parent-id" name="parent_id" type="text" placeholder="Optional local parent row id" />
            </label>
            <label className="stack auth-field" htmlFor="create-mime-type">
              <span>MIME Type</span>
              <input id="create-mime-type" name="mime_type" type="text" placeholder="Folder or file mime type" />
            </label>
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-drive-url">
              <span>Drive URL</span>
              <input id="create-drive-url" name="drive_url" type="url" placeholder="https://drive.google.com/..." required />
            </label>
            <label className="stack auth-field" htmlFor="create-size-bytes">
              <span>Size Bytes</span>
              <input id="create-size-bytes" name="size_bytes" type="number" min="0" inputMode="numeric" />
            </label>
          </div>
          <label className="stack auth-field" htmlFor="create-drive-path">
            <span>Drive Path</span>
            <input id="create-drive-path" name="drive_path" type="text" placeholder="/AffiliateAI/..." required />
          </label>
          <label className="stack auth-field" htmlFor="create-notes">
            <span>Notes</span>
            <textarea id="create-notes" name="notes" rows={3} placeholder="Optional operational notes" />
          </label>
          <p className="subtle">
            Drive paths are metadata only. Use the locked folder structure, but do not expect this page to create real folders or upload files.
          </p>
          <FormActions>
            <button className="button primary" type="submit">
              Save Drive metadata
            </button>
          </FormActions>
        </form>
      </SectionCard>

      {driveItems.length ? (
        <section className="stack">
          {driveItems.map((item) => (
            <SectionCard
              badge={item.name}
              title={item.item_type}
              description={item.drive_path}
              key={item.id}
              actions={<StatusBadge status={item.status} />}
            >
              <div className="metric-grid">
                <div className="metric">
                  <span>Purpose</span>
                  <strong>
                    <StatusBadge status={item.purpose} tone="info" />
                  </strong>
                </div>
                <div className="metric">
                  <span>Drive ID</span>
                  <strong>{item.drive_item_id ?? "Manual only"}</strong>
                </div>
                <div className="metric">
                  <span>Source</span>
                  <strong>Metadata only</strong>
                </div>
              </div>

              <form className="stack" action={saveDriveItem}>
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="id" value={item.id} />
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor={`item-type-${item.id}`}>
                    <span>Item Type</span>
                    <select id={`item-type-${item.id}`} name="item_type" defaultValue={item.item_type} required>
                      {selectOptions(DRIVE_ITEM_TYPES)}
                    </select>
                  </label>
                  <label className="stack auth-field" htmlFor={`purpose-${item.id}`}>
                    <span>Purpose</span>
                    <select id={`purpose-${item.id}`} name="purpose" defaultValue={item.purpose} required>
                      {selectOptions(DRIVE_ITEM_PURPOSES)}
                    </select>
                  </label>
                </div>
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor={`name-${item.id}`}>
                    <span>Name</span>
                    <input id={`name-${item.id}`} name="name" type="text" defaultValue={item.name} required />
                  </label>
                  <label className="stack auth-field" htmlFor={`status-${item.id}`}>
                    <span>Status</span>
                    <select id={`status-${item.id}`} name="status" defaultValue={item.status} required>
                      {selectOptions(DRIVE_ITEM_STATUSES)}
                    </select>
                  </label>
                </div>
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor={`drive-item-id-${item.id}`}>
                    <span>Drive Item ID</span>
                    <input
                      id={`drive-item-id-${item.id}`}
                      name="drive_item_id"
                      type="text"
                      defaultValue={fieldValue(item.drive_item_id)}
                    />
                  </label>
                  <label className="stack auth-field" htmlFor={`parent-drive-item-id-${item.id}`}>
                    <span>Google Parent ID</span>
                    <input
                      id={`parent-drive-item-id-${item.id}`}
                      name="parent_drive_item_id"
                      type="text"
                      defaultValue={fieldValue(item.parent_drive_item_id)}
                    />
                  </label>
                </div>
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor={`parent-id-${item.id}`}>
                    <span>Parent Row ID</span>
                    <input id={`parent-id-${item.id}`} name="parent_id" type="text" defaultValue={fieldValue(item.parent_id)} />
                  </label>
                  <label className="stack auth-field" htmlFor={`mime-type-${item.id}`}>
                    <span>MIME Type</span>
                    <input
                      id={`mime-type-${item.id}`}
                      name="mime_type"
                      type="text"
                      defaultValue={fieldValue(item.mime_type)}
                    />
                  </label>
                </div>
                <div className="grid two-up">
                  <label className="stack auth-field" htmlFor={`drive-url-${item.id}`}>
                    <span>Drive URL</span>
                    <input id={`drive-url-${item.id}`} name="drive_url" type="url" defaultValue={item.drive_url} required />
                  </label>
                  <label className="stack auth-field" htmlFor={`size-bytes-${item.id}`}>
                    <span>Size Bytes</span>
                    <input
                      id={`size-bytes-${item.id}`}
                      name="size_bytes"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      defaultValue={fieldValue(item.size_bytes)}
                    />
                  </label>
                </div>
                <label className="stack auth-field" htmlFor={`drive-path-${item.id}`}>
                  <span>Drive Path</span>
                  <input id={`drive-path-${item.id}`} name="drive_path" type="text" defaultValue={item.drive_path} required />
                </label>
                <label className="stack auth-field" htmlFor={`notes-${item.id}`}>
                  <span>Notes</span>
                  <textarea id={`notes-${item.id}`} name="notes" rows={3} defaultValue={fieldValue(item.notes)} />
                </label>
                <FormActions>
                  <button className="button primary" type="submit">
                    Save changes
                  </button>
                </FormActions>
              </form>

              <FormActions>
                <form action={saveDriveItem}>
                  <input type="hidden" name="intent" value="archive" />
                  <input type="hidden" name="id" value={item.id} />
                  <button className="button" type="submit">
                    Archive item
                  </button>
                </form>
              </FormActions>
            </SectionCard>
          ))}
        </section>
      ) : (
        <EmptyState
          title="No Drive items yet."
          description="Register the standard Drive folders and files as metadata first. Real Drive creation, OAuth, and file upload are intentionally out of scope for Sprint 4."
        />
      )}
    </div>
  );
}
