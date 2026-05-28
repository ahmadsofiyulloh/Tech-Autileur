import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const AiMediaOverviewContent = nextDynamic(() => import("./_components/ai-media-overview-content").then((mod) => mod.AiMediaOverviewContent), {
  loading: () => <div className="stack skeleton-block" style={{ minHeight: "400px" }} />,
});

export const revalidate = 60;

export default async function AiMediaPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AiMediaOverviewContent />;
}
