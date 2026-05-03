"use client";

import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";

export default function PromptsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionCard title="Prompt tidak tersedia." description={error.message}>
      <FormActions>
        <button className="button primary" type="button" onClick={reset}>
          Coba lagi
        </button>
      </FormActions>
    </SectionCard>
  );
}
