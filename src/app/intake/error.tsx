"use client";

import { Inbox, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { NativeButton } from "@/components/ui/native-button";

export default function IntakeError({ reset }: { reset: () => void }) {
  return (
    <div className="stack">
      <SectionCard icon={Inbox} title="Intake unavailable">
        <EmptyState
          icon={Inbox}
          title="Try again."
          action={
            <NativeButton type="button" onClick={reset}>
              <RotateCcw size={16} aria-hidden="true" />
              Retry
            </NativeButton>
          }
        />
      </SectionCard>
    </div>
  );
}
