type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";
type StatusBadgeSize = "sm" | "md";
type StatusBadgeVariant = "pill" | "badge";

type StatusBadgeProps = {
  status: string;
  tone?: StatusTone;
  size?: StatusBadgeSize;
  variant?: StatusBadgeVariant;
  muted?: boolean;
};

function inferTone(status: string): StatusTone {
  const value = status.toUpperCase();

  if (value === "CLOSED") {
    return "neutral";
  }

  if (value === "NEED_MANUAL_MATCH") {
    return "danger";
  }

  if (value === "PARTIALLY_IMPORTED" || value === "RUNNING") {
    return "warning";
  }

  if (value === "UNAVAILABLE" || value === "NOT PAIRED" || value === "PERKIRAAN TIDAK TERSEDIA") {
    return "warning";
  }

  if (
    value === "READY_TO_EXPORT" ||
    value === "IMPORTED" ||
    value === "AVAILABLE" ||
    value === "PERKIRAAN TERSEDIA"
  ) {
    return "success";
  }

  if (value === "EXPORTED" || value === "IMPORTING") {
    return "info";
  }

  if (
    value.includes("SUCCESS") ||
    value.includes("ACTIVE") ||
    value.includes("ATTACHED") ||
    value.includes("ANALYZED") ||
    value.includes("READY") ||
    value.includes("APPROVED")
  ) {
    return "success";
  }

  if (
    value.includes("WAITING") ||
    value.includes("QUEUE") ||
    value.includes("RUNNING") ||
    value.includes("DRAFT") ||
    value.includes("PROMPT") ||
    value.includes("REVIEW")
  ) {
    return "info";
  }

  if (value.includes("COOLDOWN") || value.includes("RATE") || value.includes("NEED")) {
    return "warning";
  }

  if (value.includes("ERROR") || value.includes("FAILED") || value.includes("DISABLED") || value.includes("REJECT")) {
    return "danger";
  }

  if (value.includes("ARCHIVED") || value.includes("REPLACED") || value.includes("CANCELLED")) {
    return "neutral";
  }

  return "info";
}

function inferMuted(status: string) {
  return status.toUpperCase() === "CLOSED";
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

export function StatusBadge({ status, tone, size = "md", variant = "badge", muted }: StatusBadgeProps) {
  const resolvedMuted = muted ?? inferMuted(status);
  const resolvedTone = resolvedMuted ? "neutral" : tone ?? inferTone(status);
  const className = [
    "status-badge",
    `status-badge--${resolvedTone}`,
    `status-badge--${size}`,
    `status-badge--${variant}`,
    resolvedMuted ? "status-badge--muted" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={className}>{formatStatus(status)}</span>;
}
