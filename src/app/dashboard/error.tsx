"use client";

import { ErrorState } from "@/components/operator/error-state";
import { NativeButton } from "@/components/ui/native-button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      title="Dashboard tidak tersedia."
      action={
        <NativeButton className="primary" type="button" onClick={reset}>
          Coba lagi
        </NativeButton>
      }
    />
  );
}
