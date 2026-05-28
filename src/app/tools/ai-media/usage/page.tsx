import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AiMediaUsageContent } from "./usage-content";

export const revalidate = 60;

export default async function AiMediaUsagePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AiMediaUsageContent />;
}
