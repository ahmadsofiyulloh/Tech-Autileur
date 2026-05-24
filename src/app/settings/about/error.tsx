"use client";

import { Info } from "lucide-react";
import { ErrorState } from "@/components/operator/error-state";
import { NativeButton } from "@/components/ui/native-button";

export default function SettingsAboutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      icon={Info}
      title="Tentang aplikasi tidak dapat dimuat."
      description={error.message}
      action={
        <NativeButton className="primary" type="button" onClick={reset}>
          Coba lagi
        </NativeButton>
      }
    />
  );
}
