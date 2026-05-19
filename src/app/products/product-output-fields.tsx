import { Archive } from "lucide-react";
import { CopyableReadOnlyField } from "@/components/operator/copyable-readonly-field";
import { EmptyState } from "@/components/operator/empty-state";
import { StatusBadge } from "@/components/operator/status-badge";

export type ProductOutputLegacyClipRow = {
  label: string;
  status: string;
  driveItemName: string | null;
  driveItemUrl: string | null;
};

type ProductOutputFieldsProps = {
  status: string;
  productName: string;
  keyword: string;
  caption: string;
  tags: string;
  folderDrive: string;
  legacyClipRows: ProductOutputLegacyClipRow[];
};

function toneForSummaryStatus(status: string) {
  if (status === "Output Siap" || status === "Metadata Siap") {
    return "success" as const;
  }

  if (status === "Output Parsial") {
    return "info" as const;
  }

  return "neutral" as const;
}

function toneForLegacyClipStatus(status: string) {
  if (status === "Approved") {
    return "success" as const;
  }

  if (status === "Imported") {
    return "info" as const;
  }

  return "neutral" as const;
}

export function ProductOutputFields({
  status,
  productName,
  keyword,
  caption,
  tags,
  folderDrive,
  legacyClipRows,
}: ProductOutputFieldsProps) {
  return (
    <div className="stack product-output-fields">
      <div className="section-card__actions product-output-fields__status">
        <span className="subtle">Siap copy</span>
        <StatusBadge status={status} tone={toneForSummaryStatus(status)} />
      </div>

      <section className="prompt-output-grid" aria-label="Output siap copy">
        <details className="prompt-output-section" open>
          <summary>Metadata final</summary>
          <div className="prompt-output-section__body">
            <CopyableReadOnlyField label="Nama Produk" value={productName} />
            <CopyableReadOnlyField label="Keyword Etalase" value={keyword} />
          </div>
        </details>

        <details className="prompt-output-section" open>
          <summary>Output copy</summary>
          <div className="prompt-output-section__body">
            <CopyableReadOnlyField label="Caption" value={caption} />
            <CopyableReadOnlyField label="Tags" value={tags} />
            <CopyableReadOnlyField label="Folder Drive" value={folderDrive} />
          </div>
        </details>
      </section>

      {legacyClipRows.length ? (
        <details className="prompt-output-section">
          <summary>Clip output</summary>
          <div className="prompt-output-section__body">
            <section className="grid two-up product-output-clip-grid" aria-label="Status clip output">
              {legacyClipRows.map((row) => (
                <div className="muted-box stack-tight" key={row.label}>
                  <div className="section-card__actions">
                    <strong>{row.label}</strong>
                    <StatusBadge status={row.status} tone={toneForLegacyClipStatus(row.status)} />
                  </div>
                  {row.driveItemUrl ? (
                    <a href={row.driveItemUrl} target="_blank" rel="noreferrer">
                      {row.driveItemName ?? row.label}
                    </a>
                  ) : (
                    <EmptyState icon={Archive} title={`${row.label} belum ada.`} description="Drive link belum tersedia." />
                  )}
                </div>
              ))}
            </section>
          </div>
        </details>
      ) : null}
    </div>
  );
}
