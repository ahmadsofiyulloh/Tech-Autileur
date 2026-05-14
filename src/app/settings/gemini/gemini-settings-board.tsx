"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, PanelRightOpen, Plus, Save, X } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { StatusBadge } from "@/components/operator/status-badge";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { NativeButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { saveGeminiKey } from "../../gemini/actions";
import { GEMINI_KEY_ROLES, GEMINI_MODEL_OPTIONS, GEMINI_MODELS, getGeminiModelLabel } from "@/lib/gemini/validation";

export type GeminiKeyRecord = {
  id: string;
  label: string;
  google_account_label: string | null;
  project_label: string | null;
  model_name: string;
  role: string;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpm_limit: number | null;
  status: string;
  requests_today?: number | null;
  last_used_at?: string | null;
  cooldown_until?: string | null;
  created_at: string;
  updated_at: string;
};

type GeminiSettingsBoardProps = {
  geminiKeys: GeminiKeyRecord[];
};

function choiceOptions(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

function fieldValue(value: string | number | null | undefined) {
  return value ?? "";
}

function geminiKeyDetail(key: GeminiKeyRecord) {
  return [key.google_account_label, key.project_label].filter(Boolean).join(" - ") || "Detail akun belum diisi.";
}

function isVisibleGeminiKey(key: GeminiKeyRecord) {
  return key.status !== "DISABLED";
}

function geminiMobileMeta(key: GeminiKeyRecord) {
  return [getGeminiModelLabel(key.model_name), key.role].filter(Boolean).join(" - ");
}

export function GeminiSettingsBoard({ geminiKeys }: GeminiSettingsBoardProps) {
  const [selectedKeyId, setSelectedKeyId] = useState(geminiKeys.find(isVisibleGeminiKey)?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const visibleGeminiKeys = useMemo(() => geminiKeys.filter(isVisibleGeminiKey), [geminiKeys]);
  const activeKeyCount = useMemo(() => visibleGeminiKeys.filter((key) => key.status === "ACTIVE").length, [visibleGeminiKeys]);
  const selectedKey =
    isCreating
      ? null
      : visibleGeminiKeys.find((key) => key.id === selectedKeyId) ?? visibleGeminiKeys[0] ?? null;

  useEffect(() => {
    if (!visibleGeminiKeys.length) {
      setSelectedKeyId("");
      return;
    }

    if (!visibleGeminiKeys.some((key) => key.id === selectedKeyId)) {
      setSelectedKeyId(visibleGeminiKeys[0].id);
    }
  }, [visibleGeminiKeys, selectedKeyId]);

  function openCreateDrawer() {
    setIsCreating(true);
    setDrawerOpen(true);
  }

  function openEditDrawer(keyId: string) {
    setIsCreating(false);
    setSelectedKeyId(keyId);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  const initialKey = selectedKey;
  const drawerStatus = isCreating ? "ACTIVE" : initialKey?.status ?? "DRAFT";
  const formKey = isCreating ? "create-gemini-key" : initialKey?.id ?? "edit-gemini-key";
  const disableDisabled = initialKey?.status === "DISABLED";

  return (
    <section className="product-master settings-manager settings-manager--gemini" aria-label="Gemini">
      <div className="product-master__list stack">
        <div className="settings-inline-summary">
          <span>{activeKeyCount} key aktif</span>
          <NativeButton className="compact primary" type="button" onClick={openCreateDrawer}>
            <Plus size={15} aria-hidden="true" />
            Gemini baru
          </NativeButton>
        </div>

        {visibleGeminiKeys.length ? (
          <>
            <div className="table-wrap products-table-desktop">
              <table className="data-table product-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Model / Purpose</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleGeminiKeys.map((key) => (
                    <tr data-active={selectedKey?.id === key.id && !isCreating ? "true" : undefined} key={key.id}>
                      <td>
                        <div className="stack-tight">
                          <strong>{key.label}</strong>
                          <span className="subtle">{geminiKeyDetail(key)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="stack-tight">
                          <span className="subtle">{getGeminiModelLabel(key.model_name)}</span>
                          <StatusBadge status={key.role} tone="info" />
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={key.status} />
                      </td>
                      <td>
                        <div className="product-row-actions">
                          <NativeButton className="compact primary" type="button" onClick={() => openEditDrawer(key.id)}>
                            <PanelRightOpen size={15} aria-hidden="true" />
                            Kelola
                          </NativeButton>
                          <form action={saveGeminiKey}>
                            <input type="hidden" name="intent" value="disable" />
                            <input type="hidden" name="id" value={key.id} />
                            <DeleteActionButton confirmMessage={`Hapus Gemini key "${key.label}"?`} disabled={key.status === "DISABLED"} />
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="products-cards-mobile">
              {visibleGeminiKeys.map((key) => (
                <article className="product-card settings-list-card" key={key.id}>
                  <div className="settings-list-card__header">
                    <div className="stack-tight">
                      <strong>{key.label}</strong>
                      <span className="subtle">{geminiKeyDetail(key)}</span>
                    </div>
                    <StatusBadge status={key.status} />
                  </div>
                  <span className="settings-card-meta-line">{geminiMobileMeta(key)}</span>
                  <div className="mobile-card-actions">
                    <NativeButton className="compact primary" type="button" onClick={() => openEditDrawer(key.id)}>
                      <PanelRightOpen size={15} aria-hidden="true" />
                      Kelola
                    </NativeButton>
                    <OverflowActionMenu>
                      <form action={saveGeminiKey}>
                        <input type="hidden" name="intent" value="disable" />
                        <input type="hidden" name="id" value={key.id} />
                        <DeleteActionButton
                          confirmMessage={`Hapus Gemini key "${key.label}"?`}
                          disabled={key.status === "DISABLED"}
                        />
                      </form>
                    </OverflowActionMenu>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon={KeyRound}
            title="Belum ada Gemini key."
            description="Buat Gemini key pertama."
            action={
              <NativeButton className="compact primary" type="button" onClick={openCreateDrawer}>
                <Plus size={15} aria-hidden="true" />
                Gemini baru
              </NativeButton>
            }
          />
        )}
      </div>

      <div className="product-drawer-backdrop" data-open={drawerOpen ? "true" : "false"} onClick={closeDrawer} />
      <aside className="product-drawer stack" data-open={drawerOpen ? "true" : "false"} aria-label="Detail Gemini key">
        <div className="settings-bottom-sheet__handle" aria-hidden="true" />
        <div className="section-card__actions product-drawer__header">
          <div className="stack-tight">
            <span className="subtle">{isCreating ? "Gemini key baru" : "Detail"}</span>
            <strong>{isCreating ? "Buat Gemini key" : initialKey?.label ?? "Pilih key"}</strong>
            <div className="product-status-stack">
              <StatusBadge status={drawerStatus} />
              {initialKey ? <StatusBadge status={initialKey.role} tone="info" /> : null}
            </div>
          </div>
          <NativeButton className="compact product-drawer__close" type="button" onClick={closeDrawer} aria-label="Tutup detail">
            <X size={16} aria-hidden="true" />
          </NativeButton>
        </div>

        {drawerOpen ? (
          <div className="stack">
            <form key={formKey} className="stack" action={saveGeminiKey}>
              <input type="hidden" name="intent" value={isCreating ? "create" : "update"} />
              {!isCreating && initialKey ? <input type="hidden" name="id" value={initialKey.id} /> : null}
              <input type="hidden" name="status" value={fieldValue(initialKey?.status ?? "ACTIVE")} />
              <input type="hidden" name="google_account_label" value={fieldValue(initialKey?.google_account_label)} />

              <label className="stack auth-field" htmlFor="gemini-key-name">
                <span>Nama</span>
                <input
                  id="gemini-key-name"
                  name="name"
                  type="text"
                  placeholder="Primary Vision Key"
                  defaultValue={fieldValue(initialKey?.label)}
                  required
                />
              </label>

              <label className="stack auth-field" htmlFor="gemini-project-label">
                <span>Project</span>
                <input
                  id="gemini-project-label"
                  name="project_label"
                  type="text"
                  placeholder="AI Studio project"
                  defaultValue={fieldValue(initialKey?.project_label)}
                />
              </label>

              <div className="grid two-up">
                <RelationalPicker
                  defaultValue={initialKey?.model_name ?? GEMINI_MODELS[0]}
                  label="Model"
                  name="model"
                  options={GEMINI_MODEL_OPTIONS}
                  placeholder="Pilih model"
                  required
                  searchable={false}
                />
                <RelationalPicker
                  defaultValue={initialKey?.role ?? GEMINI_KEY_ROLES[0]}
                  label="Purpose"
                  name="purpose"
                  options={choiceOptions(GEMINI_KEY_ROLES)}
                  placeholder="Pilih purpose"
                  required
                  searchable={false}
                />
              </div>

              <label className="stack auth-field" htmlFor="gemini-raw-api-key">
                <span>API Key</span>
                <input
                  id="gemini-raw-api-key"
                  name="raw_api_key"
                  type="password"
                  autoComplete="off"
                  placeholder={isCreating ? "Masukkan API key" : "Biarkan kosong untuk mempertahankan key lama"}
                  required={isCreating}
                />
              </label>

              <FormActions layout="pair">
                <NativeButton className="primary" type="submit">
                  <Save size={16} aria-hidden="true" />
                  {isCreating ? "Buat Gemini key" : "Simpan Gemini key"}
                </NativeButton>
                <NativeButton className="tertiary" type="button" onClick={closeDrawer}>
                  Batal
                </NativeButton>
              </FormActions>
            </form>

            {!isCreating && initialKey ? (
              <FormActions layout="single">
                <form action={saveGeminiKey}>
                  <input type="hidden" name="intent" value="disable" />
                  <input type="hidden" name="id" value={initialKey.id} />
                  <DeleteActionButton confirmMessage={`Hapus Gemini key "${initialKey.label}"?`} disabled={disableDisabled} />
                </form>
              </FormActions>
            ) : null}
          </div>
        ) : null}
      </aside>
    </section>
  );
}
