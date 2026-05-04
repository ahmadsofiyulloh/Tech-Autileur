"use client";

import { Ban, KeyRound, Plus, Save, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { RelationalPicker } from "@/components/operator/relational-picker";
import { SettingsBottomSheet } from "@/components/operator/settings-bottom-sheet";
import { StatusBadge } from "@/components/operator/status-badge";
import { saveGeminiKey } from "../../gemini/actions";
import { GEMINI_KEY_ROLES, GEMINI_MODELS } from "@/lib/gemini/validation";

type GeminiKeyRecord = {
  id: string;
  label: string;
  provider: string;
  google_account_label: string | null;
  project_label: string | null;
  model_name: string;
  role: string;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpm_limit: number | null;
  status: string;
  updated_at: string;
};

type GeminiSettingsBoardProps = {
  geminiKeys: GeminiKeyRecord[];
};

type SheetMode = { type: "create" } | { type: "edit"; keyId: string };

function pickerOptions(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

function fieldValue(value: string | number | null | undefined) {
  return value ?? "";
}

export function GeminiSettingsBoard({ geminiKeys }: GeminiSettingsBoardProps) {
  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null);

  const selectedKey = useMemo(
    () => (sheetMode?.type === "edit" ? geminiKeys.find((geminiKey) => geminiKey.id === sheetMode.keyId) ?? null : null),
    [geminiKeys, sheetMode],
  );
  const isCreating = sheetMode?.type === "create";

  useEffect(() => {
    if (sheetMode?.type === "edit" && !geminiKeys.some((geminiKey) => geminiKey.id === sheetMode.keyId)) {
      setSheetMode(null);
    }
  }, [geminiKeys, sheetMode]);

  const sheetTitle = isCreating ? "Buat Gemini key" : selectedKey?.label ?? "Gemini key";
  const sheetDescription = isCreating
    ? "Buat key Gemini baru untuk analisis dan prompt generation."
    : selectedKey
      ? `${selectedKey.model_name} - ${selectedKey.role}`
      : "Pilih key untuk diedit.";
  const sheetActions = selectedKey ? (
    <div className="section-card__actions">
      <StatusBadge status={selectedKey.status} />
      <StatusBadge status={selectedKey.role} tone="info" />
      <StatusBadge status={selectedKey.model_name} tone="neutral" />
    </div>
  ) : null;

  return (
    <section className="stack">
      <div className="section-card__actions">
        {geminiKeys.length ? <StatusBadge status={`${geminiKeys.length} key`} tone="info" /> : <StatusBadge status="Belum ada key" tone="warning" />}
        <button className="button compact primary" type="button" onClick={() => setSheetMode({ type: "create" })}>
          <Plus size={15} aria-hidden="true" />
          Gemini key baru
        </button>
      </div>

      {geminiKeys.length ? (
        <ul className="list">
          {geminiKeys.map((geminiKey) => (
            <li key={geminiKey.id}>
              <div className="stack-tight">
                <strong>{geminiKey.label}</strong>
                <span className="subtle">{geminiKey.model_name}</span>
                <span className="subtle">{geminiKey.role}</span>
                <div className="section-card__actions">
                  <StatusBadge status={geminiKey.status} />
                  <StatusBadge status={geminiKey.role} tone="info" />
                </div>
              </div>
              <button className="button compact primary" type="button" onClick={() => setSheetMode({ type: "edit", keyId: geminiKey.id })}>
                <Settings2 size={15} aria-hidden="true" />
                Kelola
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={KeyRound} title="Belum ada Gemini key." description="Buat key pertama dari bottom sheet." />
      )}

      <SettingsBottomSheet
        actions={sheetActions}
        description={sheetDescription}
        onClose={() => setSheetMode(null)}
        open={sheetMode !== null}
        title={sheetTitle}
      >
        {isCreating ? (
          <GeminiForm key="create" currentKey={null} onCancel={() => setSheetMode(null)} />
        ) : selectedKey ? (
          <GeminiForm key={selectedKey.id} currentKey={selectedKey} onCancel={() => setSheetMode(null)} />
        ) : null}
      </SettingsBottomSheet>
    </section>
  );
}

function GeminiForm({
  currentKey,
  onCancel,
}: {
  currentKey: GeminiKeyRecord | null;
  onCancel: () => void;
}) {
  const hasKey = Boolean(currentKey);

  return (
    <div className="stack">
      <form className="stack" action={saveGeminiKey}>
        <input type="hidden" name="intent" value={hasKey ? "update" : "create"} />
        {currentKey ? <input type="hidden" name="id" value={currentKey.id} /> : null}
        {currentKey ? <input type="hidden" name="status" value={currentKey.status} /> : null}
        {currentKey ? <input type="hidden" name="google_account_label" value={fieldValue(currentKey.google_account_label)} /> : null}
        {currentKey ? <input type="hidden" name="project_label" value={fieldValue(currentKey.project_label)} /> : null}
        {currentKey ? <input type="hidden" name="rpm_limit" value={fieldValue(currentKey.rpm_limit)} /> : null}
        {currentKey ? <input type="hidden" name="rpd_limit" value={fieldValue(currentKey.rpd_limit)} /> : null}
        {currentKey ? <input type="hidden" name="tpm_limit" value={fieldValue(currentKey.tpm_limit)} /> : null}

        <div className="grid two-up">
          <label className="stack auth-field" htmlFor="gemini-name">
            <span>Nama</span>
            <input
              id="gemini-name"
              name="name"
              type="text"
              defaultValue={fieldValue(currentKey?.label)}
              placeholder="Primary Vision Key"
              required
            />
          </label>
          <RelationalPicker
            defaultValue={currentKey?.model_name ?? GEMINI_MODELS[0]}
            label="Model"
            name="model"
            options={pickerOptions(GEMINI_MODELS)}
            placeholder="Pilih model"
            required
            searchable={false}
          />
        </div>

        <div className="grid two-up">
          <RelationalPicker
            defaultValue={currentKey?.role ?? GEMINI_KEY_ROLES[0]}
            label="Purpose"
            name="purpose"
            options={pickerOptions(GEMINI_KEY_ROLES)}
            placeholder="Pilih purpose"
            required
            searchable={false}
          />
          <label className="stack auth-field" htmlFor="gemini-raw-api-key">
            <span>API Key</span>
            <input
              id="gemini-raw-api-key"
              name="raw_api_key"
              type="password"
              autoComplete="off"
              placeholder={hasKey ? "Leave blank to keep current key" : "Enter API key"}
              required={!hasKey}
            />
          </label>
        </div>

        <FormActions>
          <button className="button primary" type="submit">
            <Save size={16} aria-hidden="true" />
            Save Gemini key
          </button>
          <button className="button" type="button" onClick={onCancel}>
            Batal
          </button>
        </FormActions>
      </form>

      {currentKey ? (
        <FormActions>
          <form action={saveGeminiKey}>
            <input type="hidden" name="intent" value="disable" />
            <input type="hidden" name="id" value={currentKey.id} />
            <button className="button compact" type="submit" disabled={currentKey.status === "DISABLED"}>
              <Ban size={16} aria-hidden="true" />
              Disable key
            </button>
          </form>
        </FormActions>
      ) : null}
    </div>
  );
}
