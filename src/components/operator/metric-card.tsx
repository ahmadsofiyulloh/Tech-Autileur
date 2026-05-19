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

  return (
    <div className={cn("operator-metric-card metric", className)} style={style}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
      {status}
      {typeof progressPercent === "number" ? <i aria-hidden="true" /> : null}
    </div>
  );
}
