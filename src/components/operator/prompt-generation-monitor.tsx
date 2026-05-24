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
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      return;
    }

    async function triggerGeneration() {
      try {
        const res = await fetch(`/api/prompts/${promptPackId}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();

          if (data.status === "SUCCESS" || data.status === "RUNNING" || data.started) {
            router.refresh();

            if (retryIntervalRef.current) {
              clearInterval(retryIntervalRef.current);
              retryIntervalRef.current = null;
            }
          }
        }
      } catch {
        // Network error — keep polling on next interval.
      }
    }

    if (!hasStarted.current) {
      hasStarted.current = true;
      void triggerGeneration();
    }

    if (!retryIntervalRef.current) {
      retryIntervalRef.current = setInterval(() => {
        void triggerGeneration();
      }, 15_000);
    }

    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
    };
  }, [enabled, promptPackId, router]);

  return null;
}
