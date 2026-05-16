"use client";

import { useCallback, useEffect, useRef } from "react";
import type { BulkImportJobSnapshot, BulkImportJobStatus } from "@/lib/bulk-import/types";

const ACTIVE_JOB_STATUSES: BulkImportJobStatus[] = ["QUEUED", "RUNNING", "CANCEL_REQUESTED"];

function isRunnableJob(snapshot: BulkImportJobSnapshot | null) {
  return snapshot ? ACTIVE_JOB_STATUSES.includes(snapshot.job.status) : false;
}

async function readActiveSnapshot() {
  const response = await fetch("/api/products/bulk-import/jobs/active", {
    cache: "no-store",
  });
  const payload = (await response.json()) as { snapshot?: BulkImportJobSnapshot | null; error?: string };

  if (!response.ok) {
    return null;
  }

  return payload.snapshot ?? null;
}

export function BulkImportJobRunner() {
  const runningJobIds = useRef(new Set<string>());

  const runJob = useCallback(async (jobId: string) => {
    if (runningJobIds.current.has(jobId)) {
      return;
    }

    runningJobIds.current.add(jobId);
    try {
      await fetch(`/api/products/bulk-import/jobs/${jobId}/run`, {
        method: "POST",
      });
    } finally {
      runningJobIds.current.delete(jobId);
    }
  }, []);

  const resumeActiveJob = useCallback(async () => {
    const snapshot = await readActiveSnapshot();

    if (snapshot && isRunnableJob(snapshot)) {
      await runJob(snapshot.job.id);
    }
  }, [runJob]);

  useEffect(() => {
    void resumeActiveJob().catch(() => undefined);
    const timer = window.setInterval(() => {
      void resumeActiveJob().catch(() => undefined);
    }, 8000);

    return () => {
      window.clearInterval(timer);
    };
  }, [resumeActiveJob]);

  return null;
}
