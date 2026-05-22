"use client";

import { Save, X } from "lucide-react";
import { OperatorBottomSheet } from "@/components/operator/bottom-sheet";
import { FormActions } from "@/components/operator/form-actions";
import { NativeButton } from "@/components/ui/native-button";
import { saveProductStatus } from "./actions";
import type { ProductListRow } from "./types";

type ProductStatusSheetProps = {
  product: ProductListRow | null;
  open: boolean;
  onClose: () => void;
  isMobile?: boolean;
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

function ProductStatusForm({ product, onClose }: { product: ProductListRow; onClose: () => void }) {
  return (
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
  );
}

export function ProductStatusSheet({ product, open, onClose, isMobile = true }: ProductStatusSheetProps) {
  if (!product) {
    return null;
  }

  if (isMobile) {
    return (
      <OperatorBottomSheet
        ariaLabel={`Ubah status ${product.product_name}`}
        className="product-status-sheet"
        open={open}
        title="Ubah status"
        onClose={onClose}
      >
        <ProductStatusForm product={product} onClose={onClose} />
      </OperatorBottomSheet>
    );
  }

  if (!open) {
    return null;
  }

  return (
    <aside className="product-status-panel" aria-label={`Ubah status ${product.product_name}`}>
      <div className="product-status-panel__header">
        <div className="product-status-panel__heading">
          <strong>Ubah status</strong>
          <span>{product.product_name}</span>
        </div>
        <NativeButton className="compact product-status-panel__close" type="button" aria-label="Tutup" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </NativeButton>
      </div>
      <div className="product-status-panel__body">
        <ProductStatusForm product={product} onClose={onClose} />
      </div>
    </aside>
  );
}
