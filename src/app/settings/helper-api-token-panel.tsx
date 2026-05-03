"use client";

import { useState } from "react";
import { CopyButton } from "@/components/operator/copy-button";
import { FormActions } from "@/components/operator/form-actions";
import { StatusBadge } from "@/components/operator/status-badge";
import { HELPER_API_TOKEN_CODE } from "@/lib/helper-api-tokens";
import { saveHelperApiToken } from "./actions";

type HelperApiTokenPayload = {
  token_code: string;
  raw_token: string;
  owner_email: string | null;
  created_at: string;
};

type HelperApiTokenRecord = {
  id: string;
  token_code: string;
  status: string;
  last_used_at: string | null;
};

function createTokenPayload(ownerEmail: string | null): HelperApiTokenPayload {
  return {
    token_code: HELPER_API_TOKEN_CODE,
    raw_token: `apt_${crypto.randomUUID().replaceAll("-", "")}`,
    owner_email: ownerEmail,
    created_at: new Date().toISOString(),
  };
}

export function HelperApiTokenPanel({
  ownerEmail,
  currentToken,
}: {
  ownerEmail: string | null;
  currentToken: HelperApiTokenRecord | null;
}) {
  const [payload, setPayload] = useState<HelperApiTokenPayload | null>(null);
  const tokenTone = currentToken?.status === "ACTIVE" ? "success" : "warning";

  const payloadJson = payload ? JSON.stringify(payload, null, 2) : "";

  function handleCreate() {
    setPayload(createTokenPayload(ownerEmail));
  }

  function handleDownload() {
    if (!payload) {
      return;
    }

    const blob = new Blob([payloadJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "app-api-token.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="stack">
      <div className="stack-tight">
        <strong>App API Token</strong>
        <div className="section-card__actions">
          <StatusBadge status={currentToken?.status ?? "Belum ada"} tone={tokenTone} />
          <StatusBadge status={HELPER_API_TOKEN_CODE} tone="info" />
        </div>
        <span className="subtle">Token rahasia hanya tampil sekali.</span>
      </div>

      <div className="muted-box stack-tight">
        {currentToken ? (
          <>
            <strong>{currentToken.token_code}</strong>
            <span className="subtle">{currentToken.last_used_at ? `Terakhir dipakai ${currentToken.last_used_at}` : "Belum dipakai."}</span>
          </>
        ) : (
          <span>Belum ada token aktif.</span>
        )}
      </div>

      {payload ? (
        <div className="stack-tight">
          <pre className="json-block">{payloadJson}</pre>
          <FormActions>
            <CopyButton text={payloadJson} label="Salin" />
            <button className="button compact" type="button" onClick={handleDownload}>
              Unduh JSON
            </button>
          </FormActions>
        </div>
      ) : null}

      <FormActions>
        <button className="button compact primary" type="button" onClick={handleCreate}>
          Buat token
        </button>
        {payload ? (
          <form action={saveHelperApiToken}>
            <input type="hidden" name="intent" value="save_helper_api_token" />
            <input type="hidden" name="token_code" value={payload.token_code} />
            <input type="hidden" name="raw_token" value={payload.raw_token} />
            <button className="button compact" type="submit">
              Simpan hash
            </button>
          </form>
        ) : null}
        <form action={saveHelperApiToken}>
          <input type="hidden" name="intent" value="disable_helper_api_token" />
          <input type="hidden" name="id" value={currentToken?.id ?? ""} />
          <button className="button compact" type="submit" disabled={!currentToken || currentToken.status === "DISABLED"}>
            Cabut token
          </button>
        </form>
      </FormActions>
    </div>
  );
}
