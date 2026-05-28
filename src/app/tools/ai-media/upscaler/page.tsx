import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAiMediaOverviewSnapshot } from "@/lib/server/ai-media";

const UpscalerSteps = nextDynamic(() => import("../_components/upscaler-steps").then((mod) => mod.UpscalerSteps), {
  loading: () => <div className="stack skeleton-block" style={{ minHeight: "320px" }} />,
});

export const revalidate = 60;

export default async function UpscalerPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const snapshot = await getAiMediaOverviewSnapshot();
  const provider = snapshot?.provider ?? null;

  return <div className="stack"><UpscalerSteps provider={provider} /></div>;
}
