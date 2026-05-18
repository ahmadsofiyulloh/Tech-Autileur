"use client";

import { useState } from "react";
import { CopyButton } from "@/components/operator/copy-button";
import { FormActions } from "@/components/operator/form-actions";
import { StatusBadge } from "@/components/operator/status-badge";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { NativeButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { formatAppDateTime, formatAppOffsetIsoString } from "@/lib/app-time";
import { saveHelperApiToken } from "./actions";

type HelperApiTokenPayload = {
  raw_token: string;
  owner_email: string | null;
  created_at: string;
};

type HelperApiTokenRecord = {
  id: string;
  status: string;
  last_used_at: string | null;
};

function createTokenPayload(ownerEmail: string | null): HelperApiTokenPayload {
  return {
    raw_token: `apt_${crypto.randomUUID().replaceAll("-", "")}`,
    owner_email: ownerEmail,
    created_at: formatAppOffsetIsoString(),
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
        </div>
        <span className="subtle">Token rahasia hanya tampil sekali.</span>
      </div>

      <div className="muted-box stack-tight">
        {currentToken ? (
          <>
            <strong>Token aktif</strong>
            <span className="subtle">
              {currentToken.last_used_at ? `Terakhir dipakai ${formatAppDateTime(currentToken.last_used_at)}` : "Belum dipakai."}
            </span>
          </>
        ) : (
          <span>Belum ada token aktif.</span>
        )}
      </div>

      {payload ? (
        <div className="stack-tight">
          <pre className="json-block">{payloadJson}</pre>
          <FormActions className="desktop-action-set" layout="pair">
            <CopyButton className="tertiary" text={payloadJson} label="Salin" />
            <NativeButton className="compact tertiary" type="button" onClick={handleDownload}>
              Unduh JSON
            </NativeButton>
          </FormActions>
          <div className="mobile-card-actions">
            <CopyButton className="primary" text={payloadJson} label="Salin" />
            <OverflowActionMenu>
              <NativeButton className="compact" type="button" onClick={handleDownload}>
                Unduh JSON
              </NativeButton>
            </OverflowActionMenu>
          </div>
        </div>
      ) : null}

      <FormActions className="desktop-action-set" layout={payload ? "triple" : "pair"}>
        <NativeButton className="compact primary" type="button" onClick={handleCreate}>
          Buat token
        </NativeButton>
        {payload ? (
          <form action={saveHelperApiToken}>
            <input type="hidden" name="intent" value="save_helper_api_token" />
            <input type="hidden" name="return_to" value="/settings/account" />
            <input type="hidden" name="raw_token" value={payload.raw_token} />
            <NativeButton className="compact tertiary" type="submit">
              Simpan hash
            </NativeButton>
          </form>
        ) : null}
        <form action={saveHelperApiToken}>
          <input type="hidden" name="intent" value="disable_helper_api_token" />
          <input type="hidden" name="return_to" value="/settings/account" />
          <input type="hidden" name="id" value={currentToken?.id ?? ""} />
          <DeleteActionButton
            confirmMessage="Cabut token ini?"
            disabled={!currentToken || currentToken.status === "DISABLED"}
            label="Cabut token"
          />
        </form>
      </FormActions>
      <div className="mobile-card-actions">
        {payload ? (
          <form action={saveHelperApiToken}>
            <input type="hidden" name="intent" value="save_helper_api_token" />
            <input type="hidden" name="return_to" value="/settings/account" />
            <input type="hidden" name="raw_token" value={payload.raw_token} />
          <NativeButton className="compact primary" type="submit">
            Simpan hash
          </NativeButton>
        </form>
      ) : (
          <NativeButton className="compact primary" type="button" onClick={handleCreate}>
            Buat token
          </NativeButton>
        )}
        {payload || currentToken ? (
          <OverflowActionMenu>
            {payload ? <CopyButton text={payloadJson} label="Salin" /> : null}
            {payload ? (
              <NativeButton className="compact" type="button" onClick={handleDownload}>
                Unduh JSON
              </NativeButton>
            ) : null}
            {payload ? (
              <NativeButton className="compact" type="button" onClick={handleCreate}>
                Buat ulang
              </NativeButton>
            ) : null}
            <form action={saveHelperApiToken}>
              <input type="hidden" name="intent" value="disable_helper_api_token" />
              <input type="hidden" name="return_to" value="/settings/account" />
              <input type="hidden" name="id" value={currentToken?.id ?? ""} />
              <DeleteActionButton
                confirmMessage="Cabut token ini?"
                disabled={!currentToken || currentToken.status === "DISABLED"}
                label="Cabut token"
              />
            </form>
          </OverflowActionMenu>
        ) : null}
      </div>
    </div>
  );
}
