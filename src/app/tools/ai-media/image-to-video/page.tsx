import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAiMediaOverviewSnapshot } from "@/lib/server/ai-media";
import { ImageToVideoSteps } from "../_components/image-to-video-steps";

export const dynamic = "force-dynamic";

export default async function ImageToVideoPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const snapshot = await getAiMediaOverviewSnapshot();
  const provider = snapshot?.provider ?? null;

  return <div className="stack"><ImageToVideoSteps provider={provider} /></div>;
}
