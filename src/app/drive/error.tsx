"use client";

import { HardDrive } from "lucide-react";
import { FormActions } from "@/components/operator/form-actions";
import { EmptyState } from "@/components/operator/empty-state";
import { NativeButton } from "@/components/ui/native-button";

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
        <NativeButton className="primary" type="button" onClick={reset}>
          Retry
        </NativeButton>
      </FormActions>
    </div>
  );
}
