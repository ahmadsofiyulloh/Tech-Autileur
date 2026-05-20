import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  className?: string;
  detail?: ReactNode;
  label: ReactNode;
  progressPercent?: number;
  status?: ReactNode;
  value: ReactNode;
};

function normalizeProgressPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function MetricCard({ className, detail, label, progressPercent, status, value }: MetricCardProps) {
  const style =
    typeof progressPercent === "number"
      ? ({ "--metric-fill": `${normalizeProgressPercent(progressPercent)}%` } as CSSProperties)
      : undefined;
  const hasStatus = Boolean(status);

  return (
    <div
      className={cn("operator-metric-card metric", hasStatus && "operator-metric-card--with-status", className)}
      style={style}
    >
      <span className="operator-metric-card__label">{label}</span>
      <strong className="operator-metric-card__value">{value}</strong>
      {detail ? <small className="operator-metric-card__detail">{detail}</small> : null}
      {status ? <div className="operator-metric-card__status">{status}</div> : null}
      {typeof progressPercent === "number" ? <i className="operator-metric-card__progress" aria-hidden="true" /> : null}
    </div>
  );
}
