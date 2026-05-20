import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AiMediaPageHeader } from "../_components/ai-media-page-header";
import { AiMediaHistoryBoard } from "./history-board";

export const dynamic = "force-dynamic";

export default async function AiMediaHistoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="stack">
      <AiMediaPageHeader backHref="/tools/ai-media" />
      <AiMediaHistoryBoard />
    </div>
  );
}
