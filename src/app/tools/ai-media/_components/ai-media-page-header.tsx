import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type AiMediaPageHeaderProps = {
  backHref: string;
  backLabel?: string;
  actions?: ReactNode;
};

export function AiMediaPageHeader({ backHref, backLabel = "Kembali", actions }: AiMediaPageHeaderProps) {
  return (
    <div className="ai-media-lobby__header">
      <div className="ai-media-lobby__header-top">
        <Link href={backHref} className="button compact tertiary native-button">
          <ArrowLeft size={14} />
          {backLabel}
        </Link>
        {actions && <div className="ai-media-lobby__header-actions">{actions}</div>}
      </div>
    </div>
  );
}
