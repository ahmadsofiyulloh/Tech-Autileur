"use client";

import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";

export default function OutputsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionCard title="Unable to load outputs." description={error.message}>
      <FormActions layout="single">
        <button className="button primary" type="button" onClick={reset}>
          Retry
        </button>
      </FormActions>
    </SectionCard>
  );
}
