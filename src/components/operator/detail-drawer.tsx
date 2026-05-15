import type { ReactNode } from "react";
import { X } from "lucide-react";
import { NativeLinkButton } from "@/components/ui/native-button";

type OperatorDetailDrawerProps = {
  ariaLabel: string;
  children: ReactNode;
  closeHref: string;
  subtitle?: string | null;
  title: string;
};

export function OperatorDetailDrawer({ ariaLabel, children, closeHref, subtitle, title }: OperatorDetailDrawerProps) {
  return (
    <aside className="operator-detail-drawer" aria-label={ariaLabel}>
      <div className="operator-detail-drawer__header">
        <div className="operator-detail-drawer__heading">
          <strong title={title}>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        <NativeLinkButton className="compact operator-detail-drawer__close" href={closeHref} aria-label="Tutup detail">
          <X size={16} aria-hidden="true" />
        </NativeLinkButton>
      </div>
      <div className="operator-detail-drawer__body">{children}</div>
    </aside>
  );
}
