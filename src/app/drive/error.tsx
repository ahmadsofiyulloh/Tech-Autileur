"use client";

import { HardDrive } from "lucide-react";
import { FormActions } from "@/components/operator/form-actions";
import { EmptyState } from "@/components/operator/empty-state";

export default function DriveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="stack">
      <EmptyState icon={HardDrive} title="Unable to load Drive." description={error.message} />
      <FormActions layout="single">
        <button className="button primary" type="button" onClick={reset}>
          Retry
        </button>
      </FormActions>
    </div>
  );
}
