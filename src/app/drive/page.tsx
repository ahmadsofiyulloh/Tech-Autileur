import { redirect } from "next/navigation";
import { saveDriveItem } from "./actions";
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
      <section className="error-box stack" role="alert">
        <div className="stack">
          <p className="eyebrow">Drive manager error</p>
          <h2>Unable to load Drive metadata.</h2>
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
        <div className="chip">Sprint 4 Drive manager</div>
        <div className="stack">
          <p className="eyebrow">Affiliate AI Content OS</p>
          <h2>Google Drive metadata stays in Supabase.</h2>
          <p>
            Drive files and folders are registered here as metadata only. Large assets stay in Google Drive and are
            never uploaded to Supabase Storage.
          </p>
        </div>
        <div className="metric-grid">
          <div className="metric">
            <span>Source</span>
            <strong>Google Drive</strong>
          </div>
          <div className="metric">
            <span>Storage</span>
            <strong>Metadata only</strong>
          </div>
          <div className="metric">
            <span>Scope</span>
            <strong>Sprint 4</strong>
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
          <p className="eyebrow">Manual registration</p>
          <h3>Add a Drive file or folder metadata record.</h3>
        </div>
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
            Drive paths are metadata only. Use the locked folder structure, but do not expect this page to create real
            folders or upload files.
          </p>
          <div className="auth-actions">
            <button className="button primary" type="submit">
              Save Drive metadata
            </button>
          </div>
        </form>
      </section>

      {driveItems.length ? (
        <section className="stack">
          {driveItems.map((item) => (
            <article className="panel stack" key={item.id}>
              <div className="stack">
                <p className="eyebrow">{item.name}</p>
                <h3>{item.item_type}</h3>
              </div>

              <div className="metric-grid">
                <div className="metric">
                  <span>Purpose</span>
                  <strong>{item.purpose}</strong>
                </div>
                <div className="metric">
                  <span>Status</span>
                  <strong>{item.status}</strong>
                </div>
                <div className="metric">
                  <span>Drive ID</span>
                  <strong>{item.drive_item_id ?? "Manual only"}</strong>
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
                <div className="auth-actions">
                  <button className="button primary" type="submit">
                    Save changes
                  </button>
                </div>
              </form>

              <form action={saveDriveItem}>
                <input type="hidden" name="intent" value="archive" />
                <input type="hidden" name="id" value={item.id} />
                <button className="button" type="submit">
                  Archive item
                </button>
              </form>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel stack">
          <div>
            <p className="eyebrow">Empty state</p>
            <h3>No Drive items yet.</h3>
          </div>
          <div className="muted-box">
            <p>
              Register the standard Drive folders and files as metadata first. Real Drive creation, OAuth, and file
              upload are intentionally out of scope for Sprint 4.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
