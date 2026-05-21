import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listMagnificKeys } from "@/lib/server/ai-media/keys";
import { MagnificSettingsBoard } from "./magnific-settings-board";

export const dynamic = "force-dynamic";

export default async function MagnificSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const keys = await listMagnificKeys();

  return (
    <div className="stack settings-page-body settings-page-body--wide">
      <MagnificSettingsBoard magnificKeys={keys} />
    </div>
  );
}
