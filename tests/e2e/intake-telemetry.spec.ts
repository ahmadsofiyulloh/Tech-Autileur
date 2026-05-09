import { expect, test } from "@playwright/test";
import {
  buildIntakeTelemetryPayload,
  classifyIntakeDeviceBucket,
  classifyIntakeFailureKind,
  normalizeIntakeClientContext,
  summarizeIntakeTelemetryRows,
  type IntakeTelemetryTaskRow,
} from "../../src/lib/intake/analysis-telemetry";

function buildTelemetryTaskRow(input: {
  status: "SUCCESS" | "FAILED";
  telemetry: ReturnType<typeof buildIntakeTelemetryPayload>;
  errorMessage?: string | null;
}): IntakeTelemetryTaskRow {
  return {
    status: input.status,
    input_json: {
      pipeline: "intake_vision",
      telemetry: input.telemetry,
    },
    output_json: {
      pipeline: "intake_vision",
      telemetry: input.telemetry,
    },
    error_message: input.errorMessage ?? null,
    started_at: input.telemetry.request_started_at,
    finished_at: input.telemetry.request_finished_at,
    created_at: input.telemetry.request_finished_at ?? input.telemetry.request_started_at ?? new Date().toISOString(),
  };
}

test.describe("intake telemetry", () => {
  test("classifies device buckets from normalized client context", () => {
    const mobilePwa = normalizeIntakeClientContext({
      is_mobile: true,
      display_mode: "standalone",
      browser_family: "chrome",
      viewport_width: 390,
      network_effective_type: "4g",
      save_data: false,
    });
    const mobileBrowser = normalizeIntakeClientContext({
      is_mobile: true,
      display_mode: "browser",
      browser_family: "chrome",
      viewport_width: 390,
      network_effective_type: "4g",
      save_data: false,
    });
    const desktopBrowser = normalizeIntakeClientContext({
      is_mobile: false,
      display_mode: "browser",
      browser_family: "chrome",
      viewport_width: 1440,
      network_effective_type: "4g",
      save_data: false,
    });

    expect(classifyIntakeDeviceBucket(mobilePwa)).toBe("mobile_pwa");
    expect(classifyIntakeDeviceBucket(mobileBrowser)).toBe("mobile_browser");
    expect(classifyIntakeDeviceBucket(desktopBrowser)).toBe("desktop_browser");
  });

  test("classifies failure kinds from error messages and upstream status", () => {
    expect(
      classifyIntakeFailureKind({
        errorMessage: "Intake vision output must be a JSON object.",
        telemetryFailureKind: null,
      }),
    ).toBe("MODEL_RESPONSE_SHAPE");
    expect(
      classifyIntakeFailureKind({
        errorMessage: "Total upload terlalu besar untuk analisis Gemini live.",
        telemetryFailureKind: null,
      }),
    ).toBe("INPUT_LIMIT");
    expect(
      classifyIntakeFailureKind({
        errorMessage: "Gemini request failed.",
        upstreamStatus: 429,
        telemetryFailureKind: null,
      }),
    ).toBe("TRANSIENT_GEMINI");
    expect(
      classifyIntakeFailureKind({
        errorMessage: "Authentication required.",
        telemetryFailureKind: null,
      }),
    ).toBe("AUTH_OR_SUPABASE");
    expect(
      classifyIntakeFailureKind({
        errorMessage: "Google Drive upload failed.",
        telemetryFailureKind: null,
      }),
    ).toBe("DRIVE_UPLOAD");
  });

  test("summarizes telemetry rows by bucket and failure kind", () => {
    const mobileTelemetry = buildIntakeTelemetryPayload({
      clientContext: {
        is_mobile: true,
        display_mode: "standalone",
        browser_family: "chrome",
        viewport_width: 390,
        network_effective_type: "4g",
        save_data: false,
      },
      analysisPath: "saved_capture",
      freshEvidenceCount: 2,
      savedEvidenceCount: 1,
      clientUploadBytes: 2_048_000,
      totalUploadBytes: 5_242_880,
      maxFileBytes: 2_048_000,
      requestStartedAt: "2026-05-08T00:00:00.000Z",
      requestFinishedAt: "2026-05-08T00:00:04.000Z",
      requestDurationMs: 4000,
      repairAttempted: true,
      repairSuccess: true,
      failureKind: "MODEL_RESPONSE_SHAPE",
      responseTextExcerpt: "Intake vision output must be a JSON object.",
      repairResponseTextExcerpt: "fixed",
      modelName: "gemini-2.5-flash",
    });
    const desktopTelemetry = buildIntakeTelemetryPayload({
      clientContext: {
        is_mobile: false,
        display_mode: "browser",
        browser_family: "chrome",
        viewport_width: 1440,
        network_effective_type: "4g",
        save_data: false,
      },
      analysisPath: "live_upload",
      freshEvidenceCount: 3,
      savedEvidenceCount: 0,
      clientUploadBytes: 4_096_000,
      totalUploadBytes: 4_096_000,
      maxFileBytes: 2_048_000,
      requestStartedAt: "2026-05-08T00:10:00.000Z",
      requestFinishedAt: "2026-05-08T00:10:03.000Z",
      requestDurationMs: 3000,
      repairAttempted: false,
      repairSuccess: false,
      failureKind: null,
      responseTextExcerpt: "ok",
      modelName: "gemini-2.5-flash",
    });

    const summary = summarizeIntakeTelemetryRows([
      buildTelemetryTaskRow({
        status: "FAILED",
        telemetry: mobileTelemetry,
        errorMessage: "Intake vision output must be a JSON object.",
      }),
      buildTelemetryTaskRow({
        status: "SUCCESS",
        telemetry: desktopTelemetry,
      }),
    ]);

    expect(summary.total).toBe(2);
    expect(summary.success).toBe(1);
    expect(summary.failure).toBe(1);
    expect(summary.repair_attempted).toBe(1);
    expect(summary.repair_success).toBe(1);
    expect(summary.shape_failures).toBe(1);
    expect(summary.failure_kinds.MODEL_RESPONSE_SHAPE).toBe(1);
    expect(summary.buckets.mobile_pwa.total).toBe(1);
    expect(summary.buckets.mobile_pwa.failure).toBe(1);
    expect(summary.buckets.desktop_browser.total).toBe(1);
    expect(summary.buckets.desktop_browser.success).toBe(1);
    expect(summary.buckets.mobile_pwa.request_duration_ms).toEqual([4000]);
    expect(summary.buckets.mobile_pwa.client_upload_bytes).toEqual([2_048_000]);
  });
});
