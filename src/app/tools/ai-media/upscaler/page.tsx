import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UpscalerSteps } from "../_components/upscaler-steps";

export const dynamic = "force-dynamic";

export default async function UpscalerPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <div className="stack"><UpscalerSteps /></div>;
}
