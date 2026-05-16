import { listPromptQueueSnapshot } from "@/lib/server/prompt-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot = await listPromptQueueSnapshot();

    return Response.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Antrian prompt tidak tersedia.";
    const status = message.includes("Authentication") ? 401 : 400;

    return Response.json({ error: message }, { status });
  }
}
