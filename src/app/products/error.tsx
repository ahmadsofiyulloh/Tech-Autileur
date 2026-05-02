"use client";

import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionCard badge="Products error" title="Unable to load product metadata." description={error.message}>
      <FormActions>
        <button className="button primary" type="button" onClick={reset}>
          Retry
        </button>
      </FormActions>
    </SectionCard>
  );
}
