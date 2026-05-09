"use client";

import { FormActions } from "@/components/operator/form-actions";
import { SectionCard } from "@/components/operator/section-card";
import { NativeButton } from "@/components/ui/native-button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SectionCard title="Unable to load dashboard." description={error.message}>
      <FormActions layout="single">
        <NativeButton className="primary" type="button" onClick={reset}>
          Retry
        </NativeButton>
      </FormActions>
    </SectionCard>
  );
}
