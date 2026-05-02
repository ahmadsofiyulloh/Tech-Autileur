"use client";

import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";

export default function DriveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionCard badge="Drive manager error" title="Unable to load Drive metadata." description={error.message}>
      <FormActions>
        <button className="button primary" type="button" onClick={reset}>
          Retry
        </button>
      </FormActions>
    </SectionCard>
  );
}
