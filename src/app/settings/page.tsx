import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRight, FolderKanban, HardDrive, KeyRound, Settings, UserRound, Users, Workflow, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PageHeader } from "@/components/operator/page-header";
import { SectionCard } from "@/components/operator/section-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { SettingsSectionNav } from "./settings-section-nav";
import {
  isAffiliateProfileSchemaMissingError,
  listAffiliateProfiles,
} from "@/lib/server/affiliate-profiles";
import { listDriveItems } from "@/lib/server/drive-items";
import { getFlowAccountPool } from "@/lib/server/flow-accounts";
import { getHelperApiToken, isHelperApiTokenSchemaMissingError } from "@/lib/server/helper-api-tokens";
import { getWorkspaceSelectionState, isWorkspaceSchemaMissingError } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tidak dapat memuat pengaturan.";
}

type SettingsCard = {
  href: string;
  title: string;
  icon: LucideIcon;
  status: ReactNode;
  detail: string;
};

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let workspaceCount: number | ReactNode = 0;
  let workspaceDetail = "Belum ada workspace.";
  let affiliateCount: number | ReactNode = 0;
  let affiliateDetail = "Belum ada profil.";
  let driveCount: number | ReactNode = 0;
  let driveDetail = "Belum ada folder.";
  let flowCount: number | ReactNode = 0;
  let flowDetail = "Belum ada akun Flow.";
  let accountStatus: ReactNode = <StatusBadge status="Ready" tone="success" />;

  try {
    const workspaceState = await getWorkspaceSelectionState();
    const workspaces = workspaceState.workspaces;
    workspaceCount = workspaces.length;
    workspaceDetail = workspaceState.currentWorkspace ? `Aktif: ${workspaceState.currentWorkspace.workspace_name}` : "Pilih workspace aktif.";
  } catch (error) {
    workspaceCount = <StatusBadge status="Pending" tone="warning" />;
    workspaceDetail = isWorkspaceSchemaMissingError(error) ? "Schema workspace pending." : errorMessage(error);
  }

  try {
    const profiles = await listAffiliateProfiles({ limit: 200 });
    affiliateCount = profiles.length;
    affiliateDetail = `${profiles.filter((profile) => profile.status === "ACTIVE").length} aktif.`;
  } catch (error) {
    affiliateCount = <StatusBadge status={isAffiliateProfileSchemaMissingError(error) ? "Pending" : "Error"} tone="warning" />;
    affiliateDetail = errorMessage(error);
  }

  try {
    const driveItems = await listDriveItems({ limit: 200 });
    const folders = driveItems.filter((item) => item.item_type === "FOLDER");
    driveCount = folders.length;
    driveDetail = `${driveItems.length} item Drive.`;
  } catch (error) {
    driveCount = <StatusBadge status="Error" tone="danger" />;
    driveDetail = errorMessage(error);
  }

  try {
    const flowAccounts = await getFlowAccountPool();
    flowCount = flowAccounts.length;
    flowDetail = `${flowAccounts.filter((account) => account.is_available).length} tersedia.`;
  } catch (error) {
    flowCount = <StatusBadge status="Error" tone="danger" />;
    flowDetail = errorMessage(error);
  }

  try {
    await getHelperApiToken();
  } catch (error) {
    accountStatus = <StatusBadge status={isHelperApiTokenSchemaMissingError(error) ? "Pending" : "Error"} tone="warning" />;
  }

  const cards: SettingsCard[] = [
    { href: "/settings/workspace", title: "Workspace", icon: FolderKanban, status: workspaceCount, detail: workspaceDetail },
    { href: "/settings/affiliate-profiles", title: "Akun Affiliate", icon: Users, status: affiliateCount, detail: affiliateDetail },
    { href: "/settings/gemini", title: "Gemini", icon: KeyRound, status: <StatusBadge status="Open" tone="info" />, detail: "Konfigurasi API Gemini." },
    { href: "/settings/drive", title: "Drive", icon: HardDrive, status: driveCount, detail: driveDetail },
    { href: "/settings/flow", title: "Flow", icon: Workflow, status: flowCount, detail: flowDetail },
    { href: "/settings/account", title: "Account", icon: UserRound, status: accountStatus, detail: user.email ?? "Signed in." },
  ];

  return (
    <div className="stack">
      <PageHeader
        icon={Settings}
        badge="Pengaturan"
        title="Pengaturan"
        description="Hub konfigurasi."
        stats={[
          { label: "Workspace", value: workspaceCount },
          { label: "Profil", value: affiliateCount },
          { label: "Drive", value: driveCount },
          { label: "Flow", value: flowCount },
          { label: "Akun", value: user.email ?? "Signed in" },
        ]}
      />

      <SettingsSectionNav />

      {cards.length ? (
        <section className="grid two-up">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <SectionCard
                actions={
                  <Link className="button compact primary" href={card.href}>
                    <ArrowRight size={16} aria-hidden="true" />
                    Open
                  </Link>
                }
                icon={Icon}
                key={card.href}
                title={card.title}
              >
                <div className="stack-tight">
                  <div className="section-card__actions">
                    {typeof card.status === "number" ? <strong>{card.status}</strong> : card.status}
                  </div>
                  <span className="subtle">{card.detail}</span>
                </div>
              </SectionCard>
            );
          })}
        </section>
      ) : (
        <EmptyState icon={Settings} title="Pengaturan kosong." description="Belum ada section." />
      )}
    </div>
  );
}
