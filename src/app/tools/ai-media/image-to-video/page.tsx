import nextDynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAiMediaOverviewSnapshot } from "@/lib/server/ai-media";

const ImageToVideoSteps = nextDynamic(() => import("../_components/image-to-video-steps").then((mod) => mod.ImageToVideoSteps), {
  loading: () => <div className="stack skeleton-block" style={{ minHeight: "320px" }} />,
});

export const revalidate = 60;

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
