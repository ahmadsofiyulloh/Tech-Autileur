import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listAiMediaHistory } from "@/lib/server/ai-media";
import type { ExternalGenerationToolType, ExternalTaskStatus } from "@/lib/server/ai-media";
import { AiMediaPageHeader } from "../_components/ai-media-page-header";
import { AiMediaHistoryBoard } from "./history-board";

export const dynamic = "force-dynamic";

const VALID_TOOL_TYPES: ExternalGenerationToolType[] = ["MOTION_CONTROL", "IMAGE_TO_VIDEO", "UPSCALER"];
const VALID_STATUSES: ExternalTaskStatus[] = [
  "QUEUED",
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "RETRYING",
  "WAITING_FOR_KEY",
  "CANCELLED",
];

function readPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const num = raw ? Number(raw) : 1;
  return Number.isFinite(num) && num >= 1 ? Math.floor(num) : 1;
}

function readPageSize(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const num = raw ? Number(raw) : 20;
  if (!Number.isFinite(num)) return 20;
  return Math.min(Math.max(Math.floor(num), 1), 100);
}

function readToolType(value: string | string[] | undefined): ExternalGenerationToolType | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && (VALID_TOOL_TYPES as string[]).includes(raw)) {
    return raw as ExternalGenerationToolType;
  }
  return null;
}

function readStatus(value: string | string[] | undefined): ExternalTaskStatus | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && (VALID_STATUSES as string[]).includes(raw)) {
    return raw as ExternalTaskStatus;
  }
  return null;
}

type AiMediaHistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AiMediaHistoryPage({ searchParams }: AiMediaHistoryPageProps) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const page = readPage(params.page);
  const pageSize = readPageSize(params.page_size);
  const toolType = readToolType(params.tool_type);
  const status = readStatus(params.status);

  let projection: Awaited<ReturnType<typeof listAiMediaHistory>> = null;
  let loadError: string | null = null;

  try {
    projection = await listAiMediaHistory({ page, pageSize, toolType, status });
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Gagal memuat history.";
  }

  return (
    <div className="stack">
      <AiMediaPageHeader backHref="/tools/ai-media" />
      <AiMediaHistoryBoard
        projection={projection}
        loadError={loadError}
        filterToolType={toolType}
        filterStatus={status}
      />
    </div>
  );
}
