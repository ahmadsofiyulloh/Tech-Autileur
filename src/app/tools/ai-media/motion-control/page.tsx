import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MotionControlSteps } from "../_components/motion-control-steps";

export const dynamic = "force-dynamic";

export default async function MotionControlPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <div className="stack"><MotionControlSteps /></div>;
}
