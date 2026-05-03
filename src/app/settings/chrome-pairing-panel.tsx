"use client";

import { useState } from "react";
import { CopyButton } from "@/components/operator/copy-button";
import { FormActions } from "@/components/operator/form-actions";

type ChromePairingPayload = {
  pairing_code: string;
  owner_email: string | null;
  created_at: string;
};

function createPairingPayload(ownerEmail: string | null): ChromePairingPayload {
  return {
    pairing_code: `PAIR-${crypto.randomUUID()}`,
    owner_email: ownerEmail,
    created_at: new Date().toISOString(),
  };
}

export function ChromePairingPanel({ ownerEmail }: { ownerEmail: string | null }) {
  const [payload, setPayload] = useState<ChromePairingPayload | null>(null);

  const payloadJson = payload ? JSON.stringify(payload, null, 2) : "";

  function handleCreate() {
    setPayload(createPairingPayload(ownerEmail));
  }

  function handleDownload() {
    if (!payload) {
      return;
    }

    const blob = new Blob([payloadJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "chrome-pairing.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleRelease() {
    setPayload(null);
  }

  return (
    <div className="stack">
      <div className="stack-tight">
        <strong>Chrome pairing</strong>
        {payload ? <pre className="json-block">{payloadJson}</pre> : <div className="muted-box">Belum paired.</div>}
      </div>
      <FormActions>
        <button className="button compact" type="button" onClick={handleCreate}>
          Buat
        </button>
        {payload ? <CopyButton text={payloadJson} label="Salin" /> : null}
        <button className="button compact" type="button" onClick={handleDownload} disabled={!payload}>
          Unduh JSON
        </button>
        <button className="button compact" type="button" onClick={handleRelease} disabled={!payload}>
          Lepas Pairing
        </button>
      </FormActions>
    </div>
  );
}
