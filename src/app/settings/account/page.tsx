import { redirect } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { FormActions } from "@/components/operator/form-actions";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { ChromePairingPanel } from "../chrome-pairing-panel";
import { HelperApiTokenPanel } from "../helper-api-token-panel";
import { SettingsSectionNav } from "../settings-section-nav";
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
      <PageHeader
        icon={UserRound}
        badge="Pengaturan"
        title="Account"
        stats={[
          { label: "Akun", value: user.email ?? "Signed in" },
          {
            label: "App API Token",
            value:
              helperApiTokenSchemaMissing ? <StatusBadge status="Pending" tone="warning" />
              : helperApiTokenLoadError ? <StatusBadge status="Error" tone="danger" />
              : <StatusBadge status={helperApiToken?.status ?? "Belum ada"} tone={helperApiToken?.status === "ACTIVE" ? "success" : "warning"} />,
          },
        ]}
      />

      <SettingsSectionNav />

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
        <FormActions>
          <form action="/auth/signout" method="post">
            <button className="button" type="submit">
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </form>
        </FormActions>
      </SectionCard>
    </div>
  );
}
