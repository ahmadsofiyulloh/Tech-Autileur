"use client";

import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";

export default function NewProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionCard badge="Error" title="Intake produk tidak bisa dimuat." description={error.message}>
      <FormActions>
        <button className="button primary" type="button" onClick={reset}>
          Coba lagi
        </button>
      </FormActions>
    </SectionCard>
  );
}
