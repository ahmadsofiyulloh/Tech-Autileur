"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, PanelRightOpen, Plus, Save, X } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { StatusBadge } from "@/components/operator/status-badge";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { NativeButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { saveMagnificKeyAction, testMagnificKeyAction } from "./actions";
import type { MagnificSaveResult, MagnificTestResult } from "./actions";

async function disableKeyAction(formData: FormData): Promise<void> {
  await saveMagnificKeyAction(formData);
}

export type MagnificKeyRecord = {
  id: string;
  label: string;
  provider: string;
  status: string;
  requestsToday: number;
  lastUsedAt: string | null;
  lastTestedAt: string | null;
  lastErrorMessage: string | null;
  cooldownUntil: string | null;
  fallbackEligible: boolean;
};

type MagnificSettingsBoardProps = {
  magnificKeys: MagnificKeyRecord[];
};

function isVisibleKey(key: MagnificKeyRecord) {
  return key.status !== "DISABLED";
}

function formatTestedAt(value: string | null) {
  if (!value) return null;
  try {
    const date = new Date(value);
    return date.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

function mobileMeta(key: MagnificKeyRecord) {
  const parts: string[] = [];
  if (key.requestsToday > 0) parts.push(`${key.requestsToday} req hari ini`);
  const tested = formatTestedAt(key.lastTestedAt);
  if (tested) parts.push(`Dites: ${tested}`);
  return parts.join(" · ") || "Belum digunakan";
}

export function MagnificSettingsBoard({ magnificKeys }: MagnificSettingsBoardProps) {
  const [selectedKeyId, setSelectedKeyId] = useState(magnificKeys.find(isVisibleKey)?.id ?? "");
  const [isCreating, setIsCreating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const visibleKeys = useMemo(() => magnificKeys.filter(isVisibleKey), [magnificKeys]);
  const activeKeyCount = useMemo(() => visibleKeys.filter((k) => k.status === "ACTIVE").length, [visibleKeys]);
  const selectedKey =
    isCreating
      ? null
      : visibleKeys.find((k) => k.id === selectedKeyId) ?? visibleKeys[0] ?? null;

  useEffect(() => {
    if (!visibleKeys.length) {
      setSelectedKeyId("");
      return;
    }
    if (!visibleKeys.some((k) => k.id === selectedKeyId)) {
      setSelectedKeyId(visibleKeys[0].id);
    }
  }, [visibleKeys, selectedKeyId]);

  function openCreateDrawer() {
    setIsCreating(true);
    setDrawerOpen(true);
    setSaveMessage(null);
    setTestMessage(null);
  }

  function openEditDrawer(keyId: string) {
    setIsCreating(false);
    setSelectedKeyId(keyId);
    setDrawerOpen(true);
    setSaveMessage(null);
    setTestMessage(null);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSaveMessage(null);
    setTestMessage(null);
  }

  async function handleSave(formData: FormData) {
    setSaveMessage(null);
    setTestMessage(null);
    const result: MagnificSaveResult = await saveMagnificKeyAction(formData);
    if (result.success) {
      setSaveMessage("Tersimpan.");
      if (isCreating) {
        setIsCreating(false);
      }
    } else {
      setSaveMessage(result.error ?? "Gagal menyimpan.");
    }
  }

  async function handleTest() {
    if (!selectedKey) return;
    setIsTesting(true);
    setTestMessage(null);
    try {
      const formData = new FormData();
      formData.set("key_id", selectedKey.id);
      const result: MagnificTestResult = await testMagnificKeyAction(formData);
      setTestMessage(result.success ? "Tes berhasil." : (result.error ?? "Tes gagal."));
    } catch {
      setTestMessage("Tes gagal.");
    } finally {
      setIsTesting(false);
    }
  }

  const formKey = isCreating ? "create-magnific-key" : selectedKey?.id ?? "edit-magnific-key";

  return (
    <section className="product-master settings-manager settings-manager--magnific" data-has-detail={drawerOpen ? "true" : undefined} aria-label="Magnific">
      <div className="product-master__list stack">
        <div className="settings-inline-summary">
          <span>{activeKeyCount} key aktif</span>
          <NativeButton className="compact primary" type="button" onClick={openCreateDrawer}>
            <Plus size={15} aria-hidden="true" />
            Key baru
          </NativeButton>
        </div>

        {visibleKeys.length ? (
          <>
            <div className="table-wrap products-table-desktop">
              <table className="data-table product-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Status</th>
                    {!drawerOpen && <th>Penggunaan</th>}
                    {!drawerOpen && <th>Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleKeys.map((key) => (
                    <tr data-active={selectedKey?.id === key.id && !isCreating ? "true" : undefined} key={key.id} onClick={() => openEditDrawer(key.id)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className="stack-tight">
                          <strong>{key.label}</strong>
                          {key.lastErrorMessage && <span className="subtle danger">{key.lastErrorMessage}</span>}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={key.status} />
                      </td>
                      {!drawerOpen && (
                        <td>
                          <div className="stack-tight">
                            <span className="subtle">{key.requestsToday} req hari ini</span>
                            {key.lastTestedAt && <span className="subtle">Dites: {formatTestedAt(key.lastTestedAt)}</span>}
                          </div>
                        </td>
                      )}
                      {!drawerOpen && (
                        <td>
                          <div className="product-row-actions">
                            <NativeButton className="compact primary" type="button" onClick={() => openEditDrawer(key.id)}>
                              <PanelRightOpen size={15} aria-hidden="true" />
                              Kelola
                            </NativeButton>
                            <form action={disableKeyAction}>
                              <input type="hidden" name="intent" value="disable" />
                              <input type="hidden" name="key_id" value={key.id} />
                              <DeleteActionButton confirmMessage={`Hapus key "${key.label}"?`} disabled={key.status === "DISABLED"} />
                            </form>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="products-cards-mobile">
              {visibleKeys.map((key) => (
                <article className="product-card settings-list-card" key={key.id}>
                  <div className="settings-list-card__header">
                    <div className="stack-tight">
                      <strong>{key.label}</strong>
                      {key.lastErrorMessage && <span className="subtle danger">{key.lastErrorMessage}</span>}
                    </div>
                    <StatusBadge status={key.status} />
                  </div>
                  <span className="settings-card-meta-line">{mobileMeta(key)}</span>
                  <div className="mobile-card-actions">
                    <NativeButton className="compact primary" type="button" onClick={() => openEditDrawer(key.id)}>
                      <PanelRightOpen size={15} aria-hidden="true" />
                      Kelola
                    </NativeButton>
                    <OverflowActionMenu>
                      <form action={disableKeyAction}>
                        <input type="hidden" name="intent" value="disable" />
                        <input type="hidden" name="key_id" value={key.id} />
                        <DeleteActionButton confirmMessage={`Hapus key "${key.label}"?`} disabled={key.status === "DISABLED"} />
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
            title="Belum ada Magnific key."
            description="Tambahkan API key pertama untuk mulai menggunakan Magnific."
            action={
              <NativeButton className="compact primary" type="button" onClick={openCreateDrawer}>
                <Plus size={15} aria-hidden="true" />
                Key baru
              </NativeButton>
            }
          />
        )}
      </div>

      <div className="product-drawer-backdrop" data-open={drawerOpen ? "true" : "false"} onClick={closeDrawer} />
      <aside className="product-drawer stack" data-open={drawerOpen ? "true" : "false"} aria-label="Detail Magnific key">
        <div className="settings-bottom-sheet__handle" aria-hidden="true" />
        <div className="section-card__actions product-drawer__header">
          <div className="stack-tight">
            <span className="subtle">{isCreating ? "Key baru" : "Detail"}</span>
            <strong>{isCreating ? "Tambah Magnific key" : selectedKey?.label ?? "Pilih key"}</strong>
            <div className="product-status-stack">
              <StatusBadge status={isCreating ? "ACTIVE" : selectedKey?.status ?? "DRAFT"} />
              {selectedKey?.fallbackEligible && <StatusBadge status="FALLBACK" tone="info" />}
            </div>
          </div>
          <NativeButton className="compact product-drawer__close" type="button" onClick={closeDrawer} aria-label="Tutup detail">
            <X size={16} aria-hidden="true" />
          </NativeButton>
        </div>

        {drawerOpen ? (
          <div className="stack">
            <form key={formKey} className="stack" action={handleSave}>
              <input type="hidden" name="intent" value={isCreating ? "create" : "update"} />
              {!isCreating && selectedKey ? <input type="hidden" name="key_id" value={selectedKey.id} /> : null}

              <label className="stack auth-field" htmlFor="magnific-key-name">
                <span>Nama key</span>
                <input
                  id="magnific-key-name"
                  name="label"
                  type="text"
                  placeholder="Main Magnific"
                  defaultValue={isCreating ? "" : selectedKey?.label ?? ""}
                  required
                />
              </label>

              <label className="stack auth-field" htmlFor="magnific-api-key">
                <span>API Key</span>
                <input
                  id="magnific-api-key"
                  name="api_key"
                  type="password"
                  autoComplete="off"
                  placeholder={isCreating ? "Masukkan API key" : "Biarkan kosong untuk mempertahankan key lama"}
                  required={isCreating}
                />
              </label>

              {saveMessage && (
                <p className="settings-card-meta-line">{saveMessage}</p>
              )}

              <FormActions layout="pair">
                <NativeButton className="primary" type="submit">
                  <Save size={16} aria-hidden="true" />
                  {isCreating ? "Simpan key baru" : "Simpan"}
                </NativeButton>
                {!isCreating && selectedKey && (
                  <NativeButton className="tertiary" type="button" onClick={handleTest} disabled={isTesting}>
                    <KeyRound size={14} aria-hidden="true" />
                    {isTesting ? "Menguji..." : "Tes koneksi"}
                  </NativeButton>
                )}
              </FormActions>
            </form>

            {testMessage && (
              <p className="settings-card-meta-line">{testMessage}</p>
            )}

            {!isCreating && selectedKey ? (
              <FormActions layout="single">
                <form action={disableKeyAction}>
                  <input type="hidden" name="intent" value="disable" />
                  <input type="hidden" name="key_id" value={selectedKey.id} />
                  <DeleteActionButton confirmMessage={`Hapus key "${selectedKey.label}"?`} disabled={selectedKey.status === "DISABLED"} />
                </form>
              </FormActions>
            ) : null}
          </div>
        ) : null}
      </aside>
    </section>
  );
}
