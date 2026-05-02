"use client";

import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionCard badge="Dashboard error" title="Unable to load the protected placeholder." description={error.message}>
      <FormActions>
        <button className="button primary" type="button" onClick={reset}>
          Retry
        </button>
      </FormActions>
    </SectionCard>
  );
}
