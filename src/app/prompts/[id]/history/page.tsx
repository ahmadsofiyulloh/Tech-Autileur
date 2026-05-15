import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Edit3, FileText, History } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { TopbarOverride } from "@/components/operator/topbar-context";
import { NativeLinkButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { getProductById } from "@/lib/server/products";
import { getPromptPackById, listPromptPacks } from "@/lib/server/prompt-packs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PromptPackRecord = Awaited<ReturnType<typeof listPromptPacks>>[number];
type PromptTaskRecord = {
  id: string;
  status: string;
  error_message: string | null;
};

type PromptHistoryPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRegenerationNote(pack: PromptPackRecord) {
  if (!isRecord(pack.personalization_json)) {
    return "";
  }

  const regenerationRequest = pack.personalization_json.regeneration_request;

  if (!isRecord(regenerationRequest)) {
    return "";
  }

  const revisionInstruction = readText(regenerationRequest.revision_instruction);
  const sourceVersion =
    typeof regenerationRequest.source_version === "number" ? `v${regenerationRequest.source_version}` : "versi sebelumnya";

  return revisionInstruction ? `Dari ${sourceVersion}: ${revisionInstruction}` : "";
}

export default async function PromptHistoryPage({ params }: PromptHistoryPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  let selectedPromptPack: Awaited<ReturnType<typeof getPromptPackById>>;

  try {
    selectedPromptPack = await getPromptPackById(id);
  } catch (error) {
    if (error instanceof Error && error.message === "Prompt pack not found.") {
      notFound();
    }

    const description = error instanceof Error ? error.message : "History prompt tidak tersedia.";

    return (
      <SectionCard icon={History} title="History prompt tidak tersedia." description={description}>
        <EmptyState icon={History} title="History tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  if (selectedPromptPack.status === "ARCHIVED") {
    redirect("/prompts?message=Data%20dihapus.");
  }

  const product = await getProductById(selectedPromptPack.product_id);

  if (!product || product.status === "ARCHIVED") {
    notFound();
  }

  let promptPacks: PromptPackRecord[] = [];

  try {
    promptPacks = await listPromptPacks({ workspaceId: product.workspace_id, limit: 200 });
  } catch (error) {
    const description = error instanceof Error ? error.message : "History prompt tidak tersedia.";

    return (
      <SectionCard icon={History} title="History prompt tidak tersedia." description={description}>
        <EmptyState icon={History} title="History tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  const siblingPromptPacks = promptPacks
    .filter((pack) => pack.prompt_code === selectedPromptPack.prompt_code && pack.status !== "ARCHIVED")
    .sort((left, right) => {
      if (left.version !== right.version) {
        return right.version - left.version;
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  const taskIds = Array.from(
    new Set(siblingPromptPacks.map((pack) => pack.ai_task_id).filter((value): value is string => Boolean(value))),
  );
  const taskResult = taskIds.length
    ? await supabase.from("ai_tasks").select("id, status, error_message").eq("user_id", user.id).in("id", taskIds)
    : { data: [], error: null };

  if (taskResult.error) {
    return (
      <SectionCard icon={History} title="Task history tidak tersedia." description={taskResult.error.message}>
        <EmptyState icon={History} title="Task tidak tersedia." description="Coba lagi." />
      </SectionCard>
    );
  }

  const taskMap = new Map((taskResult.data ?? []).map((task) => [task.id, task as PromptTaskRecord]));

  return (
    <div className="stack">
      <TopbarOverride title="History Prompt" subtitle={[product.product_name, `${siblingPromptPacks.length} versi`].join(" - ")} />

      <div className="surface-toolbar">
        <div className="surface-toolbar__actions action-rail action-rail--pair desktop-action-set">
          <NativeLinkButton className="compact" href={`/prompts?detail=${selectedPromptPack.id}`}>
            <ArrowLeft size={16} aria-hidden="true" />
            Editor
          </NativeLinkButton>
          <NativeLinkButton className="compact tertiary" href="/prompts">
            Prompt
          </NativeLinkButton>
        </div>
        <div className="surface-toolbar__actions mobile-action-set">
          <NativeLinkButton className="compact primary" href={`/prompts?detail=${selectedPromptPack.id}`}>
            <ArrowLeft size={16} aria-hidden="true" />
            Editor
          </NativeLinkButton>
          <OverflowActionMenu>
            <NativeLinkButton className="compact" href="/prompts">
              Prompt
            </NativeLinkButton>
          </OverflowActionMenu>
        </div>
      </div>

      <SectionCard icon={History} title="History Generate">
        {siblingPromptPacks.length ? (
          <ul className="list prompt-history-list">
            {siblingPromptPacks.map((pack) => {
              const task = pack.ai_task_id ? taskMap.get(pack.ai_task_id) ?? null : null;
              const regenerationNote = readRegenerationNote(pack);
              const meta = [`v${pack.version}`, pack.status, task?.status].filter(Boolean).join(" - ");

              return (
                <li className="prompt-history-row" key={pack.id}>
                  <div className="prompt-history-row__body">
                    <span className="prompt-history-row__meta">{meta}</span>
                    <strong className="prompt-history-row__note">{regenerationNote || "Generate awal"}</strong>
                    <span className="prompt-history-row__date">{formatDate(pack.created_at)}</span>
                    {pack.error_message ? <span className="error-box">{pack.error_message}</span> : null}
                    {task?.error_message ? <span className="error-box">{task.error_message}</span> : null}
                  </div>
                  <NativeLinkButton className="compact primary prompt-history-row__action" href={`/prompts?detail=${pack.id}`}>
                    <Edit3 size={15} aria-hidden="true" />
                    Buka
                  </NativeLinkButton>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={FileText} title="Belum ada history." description="Versi prompt belum tersedia." />
        )}
      </SectionCard>
    </div>
  );
}
