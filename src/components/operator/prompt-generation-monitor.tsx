"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type PromptGenerationMonitorProps = {
  enabled: boolean;
  promptPackId: string;
};

export function PromptGenerationMonitor({ enabled, promptPackId }: PromptGenerationMonitorProps) {
  const router = useRouter();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!enabled || hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    void (async () => {
      try {
        await fetch(`/api/prompts/${promptPackId}/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });
      } finally {
        router.refresh();
      }
    })();
  }, [enabled, promptPackId, router]);

  return null;
}
