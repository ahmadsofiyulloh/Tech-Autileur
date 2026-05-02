type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

type StatusBadgeProps = {
  status: string;
  tone?: StatusTone;
};

function inferTone(status: string): StatusTone {
  const value = status.toUpperCase();

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

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

export function StatusBadge({ status, tone }: StatusBadgeProps) {
  const resolvedTone = tone ?? inferTone(status);

  return <span className={`status-badge status-badge--${resolvedTone}`}>{formatStatus(status)}</span>;
}
