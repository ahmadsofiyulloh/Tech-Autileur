import { runNextPromptQueueTask } from "@/lib/server/prompt-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await runNextPromptQueueTask();
    const status = result.started ? 200 : result.reason === "RUNNING" ? 202 : 200;

    return Response.json(result, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Antrian prompt gagal dijalankan.";
    const status = message.includes("Authentication") ? 401 : 400;

    return Response.json({ error: message }, { status });
  }
}
