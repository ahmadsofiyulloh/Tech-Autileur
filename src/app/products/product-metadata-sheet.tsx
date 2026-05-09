"use client";

import { Save } from "lucide-react";
import { OperatorBottomSheet } from "@/components/operator/bottom-sheet";
import { FormActions } from "@/components/operator/form-actions";
import { NativeButton } from "@/components/ui/native-button";
import { saveProductStatus } from "./actions";
import type { ProductListRow } from "./types";

type ProductStatusSheetProps = {
  product: ProductListRow | null;
  open: boolean;
  onClose: () => void;
};

function StatusSwitchRow({
  defaultChecked,
  label,
  name,
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="settings-native-row settings-switch-row">
      <span className="settings-native-row__copy">
        <strong>{label}</strong>
      </span>
      <input className="settings-switch-row__toggle" defaultChecked={defaultChecked} name={name} type="checkbox" value="on" />
    </label>
  );
}

export function ProductStatusSheet({ product, open, onClose }: ProductStatusSheetProps) {
  if (!product) {
    return null;
  }

  return (
    <OperatorBottomSheet
      ariaLabel={`Ubah status ${product.product_name}`}
      className="product-status-sheet"
      open={open}
      title="Ubah status"
      onClose={onClose}
    >
      <form key={product.id} action={saveProductStatus} className="stack">
        <input type="hidden" name="id" value={product.id} />

        <section className="settings-native-card product-status-sheet__card" aria-label="Status manual">
          <StatusSwitchRow defaultChecked={product.workflow_status_json.video_generated} label="Video" name="workflow_video_generated" />
          <StatusSwitchRow defaultChecked={product.workflow_status_json.uploaded_shopee} label="Shopee" name="workflow_uploaded_shopee" />
          <StatusSwitchRow defaultChecked={product.workflow_status_json.uploaded_tiktok} label="TikTok" name="workflow_uploaded_tiktok" />
        </section>

        <FormActions layout="pair">
          <NativeButton type="button" onClick={onClose}>
            Batal
          </NativeButton>
          <NativeButton className="primary" type="submit">
            <Save size={15} aria-hidden="true" />
            Simpan
          </NativeButton>
        </FormActions>
      </form>
    </OperatorBottomSheet>
  );
}
