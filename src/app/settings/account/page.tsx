import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { ChromePairingPanel } from "../chrome-pairing-panel";
import { HelperApiTokenPanel } from "../helper-api-token-panel";
import { getHelperApiToken, isHelperApiTokenSchemaMissingError, type HelperApiTokenRecord } from "@/lib/server/helper-api-tokens";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Account tidak tersedia.";
}

export default async function AccountSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let helperApiToken: HelperApiTokenRecord | null = null;
  let helperApiTokenSchemaMissing = false;
  let helperApiTokenLoadError: string | null = null;

  try {
    helperApiToken = await getHelperApiToken();
  } catch (error) {
    helperApiTokenSchemaMissing = isHelperApiTokenSchemaMissingError(error);
    helperApiTokenLoadError = helperApiTokenSchemaMissing ? "Apply the S6 helper token migration before using App API Token." : errorMessage(error);
  }

  return (
    <div className="stack">
      <SectionCard icon={UserRound} title="Account">
        <div className="stack">
          <ChromePairingPanel ownerEmail={user.email ?? null} />
          {helperApiTokenSchemaMissing ? (
            <EmptyState icon={UserRound} title="App API Token schema pending." description={helperApiTokenLoadError ?? "Apply the S6 migration first."} />
          ) : helperApiTokenLoadError ? (
            <EmptyState icon={UserRound} title="App API Token unavailable." description={helperApiTokenLoadError} />
          ) : (
            <HelperApiTokenPanel ownerEmail={user.email ?? null} currentToken={helperApiToken} />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
