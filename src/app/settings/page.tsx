import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronRight, FolderKanban, HardDrive, KeyRound, Settings, UserRound, Users, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { StatusBadge } from "@/components/operator/status-badge";
import {
  isAffiliateProfileSchemaMissingError,
  listAffiliateProfiles,
} from "@/lib/server/affiliate-profiles";
import { listDriveItems } from "@/lib/server/drive-items";
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

function SettingsRow({ card }: { card: SettingsCard }) {
  const Icon = card.icon;

  return (
    <Link className="settings-native-row" href={card.href}>
      <span className="settings-native-row__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="settings-native-row__copy">
        <strong>{card.title}</strong>
        <span>{card.detail}</span>
      </span>
      <span className="section-card__actions">
        {typeof card.status === "number" ? <StatusBadge status={`${card.status}`} tone="info" /> : card.status}
        <ChevronRight size={18} aria-hidden="true" />
      </span>
    </Link>
  );
}

function SettingsGroup({ title, cards }: { title: string; cards: SettingsCard[] }) {
  return (
    <section className="settings-native-group">
      <h2>{title}</h2>
      <div className="settings-native-card">
        {cards.map((card) => (
          <SettingsRow card={card} key={card.href} />
        ))}
      </div>
    </section>
  );
}

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
    await getHelperApiToken();
  } catch (error) {
    accountStatus = <StatusBadge status={isHelperApiTokenSchemaMissingError(error) ? "Pending" : "Error"} tone="warning" />;
  }

  const cards: SettingsCard[] = [
    { href: "/settings/account", title: "Account", icon: UserRound, status: accountStatus, detail: user.email ?? "Signed in." },
    { href: "/settings/workspace", title: "Workspace", icon: FolderKanban, status: workspaceCount, detail: workspaceDetail },
    { href: "/settings/affiliate-profiles", title: "Akun Affiliate", icon: Users, status: affiliateCount, detail: affiliateDetail },
    { href: "/settings/drive", title: "Google Drive", icon: HardDrive, status: driveCount, detail: driveDetail },
    { href: "/settings/gemini", title: "Gemini", icon: KeyRound, status: <StatusBadge status="Open" tone="info" />, detail: "Konfigurasi API Gemini." },
  ];
  const accountCards = cards.filter((card) => card.href === "/settings/account");
  const workspaceCards = cards.filter((card) => card.href === "/settings/workspace");
  const profileCards = cards.filter((card) => card.href === "/settings/affiliate-profiles");
  const serviceCards = cards.filter((card) => card.href === "/settings/drive" || card.href === "/settings/gemini");

  return (
    <div className="stack">
      {cards.length ? (
        <section className="settings-native-list">
          <SettingsGroup title="Account" cards={accountCards} />
          <SettingsGroup title="Workspace" cards={workspaceCards} />
          <SettingsGroup title="Akun Affiliate" cards={profileCards} />
          <SettingsGroup title="Connected Services" cards={serviceCards} />
        </section>
      ) : (
        <EmptyState icon={Settings} title="Pengaturan kosong." description="Belum ada section." />
      )}
    </div>
  );
}
