import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Workflow } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { SettingsSectionNav } from "../settings-section-nav";
import { getFlowAccountPool, type FlowAccountPoolRecord } from "@/lib/server/flow-accounts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Flow tidak tersedia.";
}

export default async function FlowSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let flowAccounts: FlowAccountPoolRecord[] = [];
  let flowAccountsError: string | null = null;

  try {
    flowAccounts = await getFlowAccountPool();
  } catch (error) {
    flowAccountsError = errorMessage(error);
  }

  const activeAccounts = flowAccounts.filter((account) => account.status === "ACTIVE");
  const availableAccounts = flowAccounts.filter((account) => account.is_available);

  return (
    <div className="stack">
      <SettingsSectionNav />

      <SectionCard
        icon={Workflow}
        title="Flow link"
        actions={
          <Link className="button primary" href="/controller">
            <ArrowRight size={16} aria-hidden="true" />
            Flow Control
          </Link>
        }
      >
        {flowAccountsError ? (
          <EmptyState icon={Workflow} title="Flow account pool unavailable." description={flowAccountsError} />
        ) : flowAccounts.length ? (
          <div className="stack">
            <div className="metric-grid">
              <div className="metric">
                <span>Total akun</span>
                <strong>{flowAccounts.length}</strong>
              </div>
              <div className="metric">
                <span>Aktif</span>
                <strong>{activeAccounts.length}</strong>
              </div>
              <div className="metric">
                <span>Tersedia</span>
                <strong>{availableAccounts.length}</strong>
              </div>
            </div>

            <ul className="list">
              {flowAccounts.map((account) => (
                <li key={account.id}>
                  <div className="stack-tight">
                    <strong>{account.account_type.replace("FLOW_", "Flow ")}</strong>
                    <span className="subtle">
                      {[
                        account.account_type,
                        `${account.credits_remaining}/${account.observed_daily_credit} kredit tersisa`,
                        `${account.slots_remaining}/${account.max_parallel_allowed} slot tersedia`,
                        account.cooldown_remaining_minutes ? `${account.cooldown_remaining_minutes} menit cooldown` : null,
                      ]
                        .filter(Boolean)
                        .join(" - ")}
                    </span>
                    <div className="section-card__actions">
                      <StatusBadge status={account.status} />
                      <StatusBadge status={account.is_available ? "Ready" : "Tertahan"} tone={account.is_available ? "success" : "warning"} />
                      <StatusBadge status={`Rekomendasi ${account.recommended_max_jobs} job`} tone="info" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState icon={Workflow} title="Belum ada akun Flow." description="Kelola akun Flow dari Flow Control." />
        )}
      </SectionCard>
    </div>
  );
}
