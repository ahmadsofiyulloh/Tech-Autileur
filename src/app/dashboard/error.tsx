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
    <div className="dashboard-page dashboard-page--command">
      <ErrorState
        title="Dashboard tidak tersedia."
        description="Muat ulang untuk melihat ringkasan operasi."
        action={
          <NativeButton className="primary" type="button" onClick={reset}>
            Coba lagi
          </NativeButton>
        }
      />
    </div>
  );
}
