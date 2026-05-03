import { redirect } from "next/navigation";
import { Archive, HardDrive, Save } from "lucide-react";
import { saveDriveItem } from "./actions";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DRIVE_FOLDER_PURPOSES, DRIVE_ITEM_STATUSES } from "@/lib/drive/validation";
import { listDriveItems } from "@/lib/server/drive-items";

export const dynamic = "force-dynamic";

function pickerOptions(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

function fieldValue(value: string | number | null | undefined) {
  return value ?? "";
}

export default async function DrivePage() {
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
    const message = error instanceof Error ? error.message : "Unable to load Drive.";
    return (
      <SectionCard icon={HardDrive} title="Unable to load Drive." description={message}>
        <EmptyState icon={HardDrive} title="Drive unavailable." description="Try again." />
      </SectionCard>
    );
  }

  const folderItems = driveItems.filter((item) => item.item_type === "FOLDER");

  return (
    <div className="stack">
      <SectionCard
        icon={HardDrive}
        title="Tambah folder"
      >
        <form className="stack" action={saveDriveItem}>
          <input type="hidden" name="intent" value="create" />
          <input type="hidden" name="item_type" value="FOLDER" />
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-name">
              <span>Nama</span>
              <input id="create-name" name="name" type="text" placeholder="AffiliateAI" required />
            </label>
            <RelationalPicker
              defaultValue={DRIVE_FOLDER_PURPOSES[0]}
              label="Purpose"
              name="purpose"
              options={pickerOptions(DRIVE_FOLDER_PURPOSES)}
              placeholder="Pilih purpose"
              required
              searchPlaceholder="Cari tujuan folder"
            />
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-drive-item-id">
              <span>Drive Item ID</span>
              <input id="create-drive-item-id" name="drive_item_id" type="text" placeholder="Optional Drive folder id" />
            </label>
            <RelationalPicker
              defaultValue="ACTIVE"
              label="Status"
              name="status"
              options={pickerOptions(DRIVE_ITEM_STATUSES)}
              placeholder="Pilih status"
              required
              searchable={false}
            />
          </div>
          <div className="grid two-up">
            <label className="stack auth-field" htmlFor="create-drive-url">
              <span>Drive URL</span>
              <input id="create-drive-url" name="drive_url" type="url" placeholder="https://drive.google.com/..." required />
            </label>
            <label className="stack auth-field" htmlFor="create-drive-path">
              <span>Folder Path</span>
              <input id="create-drive-path" name="drive_path" type="text" placeholder="/AffiliateAI/..." required />
            </label>
          </div>
          <FormActions>
            <button className="button primary" type="submit">
              <Save size={16} aria-hidden="true" />
              Save folder
            </button>
          </FormActions>
        </form>
      </SectionCard>

      {folderItems.length ? (
        <section className="stack">
          {folderItems.map((item) => (
            <SectionCard
              icon={HardDrive}
              title="Folder"
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
                  <span>Drive Item ID</span>
                  <strong>{item.drive_item_id ?? "Manual only"}</strong>
                </div>
                <div className="metric">
                  <span>Source</span>
                  <strong>Folder metadata</strong>
                </div>
              </div>

              <details>
                <summary>Edit</summary>
                <form className="stack" action={saveDriveItem}>
                  <input type="hidden" name="intent" value="update" />
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="item_type" value="FOLDER" />
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor={`name-${item.id}`}>
                      <span>Nama</span>
                      <input id={`name-${item.id}`} name="name" type="text" defaultValue={item.name} required />
                    </label>
                    <RelationalPicker
                      defaultValue={item.purpose}
                      label="Purpose"
                      name="purpose"
                      options={pickerOptions(DRIVE_FOLDER_PURPOSES)}
                      placeholder="Pilih purpose"
                      required
                      searchPlaceholder="Cari tujuan folder"
                    />
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
                    <RelationalPicker
                      defaultValue={item.status}
                      label="Status"
                      name="status"
                      options={pickerOptions(DRIVE_ITEM_STATUSES)}
                      placeholder="Pilih status"
                      required
                      searchable={false}
                    />
                  </div>
                  <div className="grid two-up">
                    <label className="stack auth-field" htmlFor={`drive-url-${item.id}`}>
                      <span>Drive URL</span>
                      <input id={`drive-url-${item.id}`} name="drive_url" type="url" defaultValue={item.drive_url} required />
                    </label>
                    <label className="stack auth-field" htmlFor={`drive-path-${item.id}`}>
                      <span>Folder Path</span>
                      <input id={`drive-path-${item.id}`} name="drive_path" type="text" defaultValue={item.drive_path} required />
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

              <FormActions>
                <form action={saveDriveItem}>
                  <input type="hidden" name="intent" value="archive" />
                  <input type="hidden" name="id" value={item.id} />
                  <button className="button" type="submit">
                    <Archive size={16} aria-hidden="true" />
                    Archive folder
                  </button>
                </form>
              </FormActions>
            </SectionCard>
          ))}
        </section>
      ) : (
        <EmptyState icon={HardDrive} title="No folder metadata yet." description="Add a Drive folder." />
      )}
    </div>
  );
}
