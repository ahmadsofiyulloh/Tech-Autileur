"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton } from "@/components/ui/native-button";
import { saveMagnificKeyAction, testMagnificKeyAction } from "./actions";
import type { MagnificSaveResult, MagnificTestResult } from "./actions";

type MagnificSettingsFormProps = {
  keyId: string | null;
  label: string;
  status: string | null;
  lastTestedAt: string | null;
  lastErrorMessage: string | null;
  hasSecret: boolean;
};

function statusLabel(status: string | null, hasSecret: boolean) {
  if (!hasSecret) return "NO KEY";
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "RATE_LIMITED") return "RATE_LIMITED";
  if (status === "ERROR") return "ERROR";
  if (status === "DISABLED") return "DISABLED";
  if (status === "COOLDOWN") return "COOLDOWN";
  return "SAVED";
}

function statusTone(status: string | null, hasSecret: boolean) {
  if (!hasSecret) return "neutral" as const;
  if (status === "ACTIVE") return "success" as const;
  if (status === "ERROR" || status === "DISABLED") return "danger" as const;
  if (status === "RATE_LIMITED" || status === "COOLDOWN") return "warning" as const;
  return "success" as const;
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

export function MagnificSettingsForm({
  keyId,
  label: savedLabel,
  status,
  lastTestedAt,
  lastErrorMessage,
  hasSecret,
}: MagnificSettingsFormProps) {
  const [keyName, setKeyName] = useState(savedLabel);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(lastErrorMessage);
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const [saveState, saveAction, isSaving] = useActionState(
    async (_prev: MagnificSaveResult | null, formData: FormData) => {
      setMessage(null);
      const result = await saveMagnificKeyAction(formData);
      if (result.success) {
        setApiKey("");
        setMessage("Key tersimpan.");
      } else {
        setMessage(result.error ?? "Gagal menyimpan.");
      }
      return result;
    },
    null,
  );

  async function handleTest() {
    setIsTesting(true);
    setTestMessage(null);
    try {
      const formData = new FormData();
      formData.set("key_id", keyId ?? "");
      const result: MagnificTestResult = await testMagnificKeyAction(formData);
      if (result.success) {
        setTestMessage("Tes berhasil.");
      } else {
        setTestMessage(result.error ?? "Tes gagal.");
      }
    } catch {
      setTestMessage("Tes gagal.");
    } finally {
      setIsTesting(false);
    }
  }

  const testedAtLabel = formatTestedAt(lastTestedAt);
  const isProcessing = isSaving || isTesting;
  const displayMessage = testMessage ?? message ?? (hasSecret ? null : "Belum ada key.");

  return (
    <div className="stack">
      <div className="settings-list-summary">
        <div className="stack-tight">
          <strong>Magnific</strong>
          <span className="settings-card-meta-line">{hasSecret ? savedLabel : "Belum ada key"}</span>
        </div>
        <StatusBadge status={statusLabel(status, hasSecret)} tone={statusTone(status, hasSecret)} size="sm" />
      </div>

      <form action={saveAction}>
        {keyId && <input type="hidden" name="key_id" value={keyId} />}

        <div className="stack">
          <div className="ai-media-step-field">
            <label className="ai-media-step-field__label" htmlFor="magnific-key-name">Nama key</label>
            <input
              id="magnific-key-name"
              name="label"
              type="text"
              placeholder="Main Magnific"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              disabled={isProcessing}
              autoComplete="off"
            />
          </div>
          <div className="ai-media-step-field">
            <label className="ai-media-step-field__label" htmlFor="magnific-api-key">API key</label>
            <input
              id="magnific-api-key"
              name="api_key"
              type="password"
              placeholder={hasSecret ? "************" : "Masukkan API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isProcessing}
              autoComplete="off"
            />
            {hasSecret && <span className="ai-media-step-field__hint">Tersimpan: ************</span>}
          </div>
        </div>

        <div className="settings-card-actions">
          <NativeButton
            className="tertiary"
            type="button"
            onClick={handleTest}
            disabled={isProcessing || !hasSecret}
          >
            <KeyRound size={14} />
            {isTesting ? "Menguji..." : "Tes koneksi"}
          </NativeButton>
          <NativeButton className="primary" type="submit" disabled={isProcessing}>
            {isSaving ? "Menyimpan..." : "Simpan"}
          </NativeButton>
        </div>
      </form>

      <div className="settings-list-summary">
        <div className="stack-tight">
          <strong>Status</strong>
          <span className="settings-card-meta-line">
            {displayMessage ?? (status === "ACTIVE" ? "Key aktif." : "—")}
          </span>
          {testedAtLabel && (
            <span className="settings-card-meta-line">Terakhir dites: {testedAtLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}
