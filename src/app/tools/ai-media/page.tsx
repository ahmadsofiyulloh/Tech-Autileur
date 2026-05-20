import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AiMediaOverviewContent } from "./_components/ai-media-overview-content";

export const dynamic = "force-dynamic";

export default async function AiMediaPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AiMediaOverviewContent />;
}
