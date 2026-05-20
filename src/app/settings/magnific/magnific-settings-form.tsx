"use client";

import { Suspense, useState } from "react";
import { KeyRound } from "lucide-react";
import { ErrorState } from "@/components/operator/error-state";
import { SkeletonLine, SkeletonButton } from "@/components/operator/loading-skeleton";
import { StatusBadge } from "@/components/operator/status-badge";
import { NativeButton } from "@/components/ui/native-button";
import { useAiMediaDemoState } from "@/lib/ai-media/use-demo-state";

type TestState = "idle" | "loading" | "success" | "failed" | "saved" | "invalid";

function statusLabel(state: TestState, hasSaved: boolean) {
  if (state === "loading") return "TESTING";
  if (state === "success") return "SUCCESS";
  if (state === "failed") return "FAILED";
  if (state === "invalid") return "INVALID";
  if (state === "saved" || hasSaved) return "SAVED";
  return "NO KEY";
}

function statusTone(state: TestState, hasSaved: boolean) {
  if (state === "success" || state === "saved" || hasSaved) return "success" as const;
  if (state === "failed" || state === "invalid") return "danger" as const;
  if (state === "loading") return "warning" as const;
  return "neutral" as const;
}

function SettingsFormInner() {
  const { isLoading, isError } = useAiMediaDemoState();
  const [keyName, setKeyName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [savedKeyName, setSavedKeyName] = useState("");
  const [state, setState] = useState<TestState>("idle");
  const [message, setMessage] = useState("Belum ada key.");

  if (isLoading) {
    return (
      <div className="stack loading-skeleton-static" aria-hidden="true">
        <SkeletonLine size="medium" />
        <SkeletonLine size="long" />
        <SkeletonLine size="long" />
        <SkeletonButton />
      </div>
    );
  }

  if (isError) return <ErrorState title="Gagal memuat settings." />;

  const hasSaved = Boolean(savedKeyName);

  function handleTest() {
    if (!apiKey.trim() && !hasSaved) { setState("idle"); setMessage("API key belum diisi."); return; }
    if (apiKey.trim().length < 8) { setState("invalid"); setMessage("API key tidak valid."); return; }
    setState("loading"); setMessage("Tes koneksi...");
    setTimeout(() => {
      if (apiKey.trim().toLowerCase().includes("fail")) { setState("failed"); setMessage("Tes gagal."); }
      else { setState("success"); setMessage("Tes berhasil."); }
    }, 800);
  }

  function handleSave() {
    if (!keyName.trim()) { setState("invalid"); setMessage("Nama key wajib."); return; }
    if (apiKey.trim().length < 8) { setState("invalid"); setMessage("API key tidak valid."); return; }
    setSavedKeyName(keyName.trim());
    setApiKey("");
    setState("saved");
    setMessage("Key tersimpan.");
  }

  return (
    <div className="stack">
      <div className="settings-list-summary">
        <div className="stack-tight">
          <strong>Magnific</strong>
          <span className="settings-card-meta-line">{hasSaved ? savedKeyName : "Belum ada key"}</span>
        </div>
        <StatusBadge status={statusLabel(state, hasSaved)} tone={statusTone(state, hasSaved)} size="sm" />
      </div>

      <div className="stack">
        <div className="ai-media-step-field">
          <label className="ai-media-step-field__label" htmlFor="magnific-key-name">Nama key</label>
          <input id="magnific-key-name" type="text" placeholder="Main Magnific" value={keyName} onChange={(e) => setKeyName(e.target.value)} disabled={state === "loading"} autoComplete="off" />
        </div>
        <div className="ai-media-step-field">
          <label className="ai-media-step-field__label" htmlFor="magnific-api-key">API key</label>
          <input id="magnific-api-key" type="password" placeholder={hasSaved ? "************" : "Masukkan API key"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={state === "loading"} autoComplete="off" />
          {hasSaved && <span className="ai-media-step-field__hint">Tersimpan: ************</span>}
        </div>
      </div>

      <div className="settings-card-actions">
        <NativeButton className="tertiary" type="button" onClick={handleTest} disabled={state === "loading"}>
          <KeyRound size={14} />
          {state === "loading" ? "Menguji..." : "Tes koneksi"}
        </NativeButton>
        <NativeButton className="primary" type="button" onClick={handleSave} disabled={state === "loading"}>
          Simpan
        </NativeButton>
      </div>

      <div className="settings-list-summary">
        <div className="stack-tight">
          <strong>Status</strong>
          <span className="settings-card-meta-line">{message}</span>
        </div>
      </div>
    </div>
  );
}

export function MagnificSettingsForm() {
  return (
    <Suspense fallback={<div className="stack loading-skeleton-static"><SkeletonLine size="long" /><SkeletonButton /></div>}>
      <SettingsFormInner />
    </Suspense>
  );
}
