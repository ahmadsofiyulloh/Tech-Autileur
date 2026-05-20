import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ImageToVideoSteps } from "../_components/image-to-video-steps";

export const dynamic = "force-dynamic";

export default async function ImageToVideoPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <div className="stack"><ImageToVideoSteps /></div>;
}
