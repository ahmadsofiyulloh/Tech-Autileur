import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowRightLeft, ChevronRight, FolderKanban, KeyRound, Settings, UserRound, Users, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/operator/empty-state";
import { PwaInstallCard } from "@/components/operator/pwa-install-card";
import { StatusBadge } from "@/components/operator/status-badge";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { disconnectGoogleDrive, setDefaultAffiliateProfile } from "./actions";
import {
  getDefaultAffiliateProfileForWorkspace,
  listAffiliateProfiles,
  type AffiliateProfileRecord,
} from "@/lib/server/affiliate-profiles";
import { listDriveItems, type DriveItemRecord } from "@/lib/server/drive-items";
import { resolveAffiliateProfileAvatar } from "@/lib/server/affiliate-profile-avatars";
import { getGoogleDriveConnection, isGoogleDriveConnectionSchemaMissingError } from "@/lib/server/google-drive-connections";
import type { GeminiUsageOverview } from "@/lib/gemini/usage-types";
import { getGeminiUsageOverview } from "@/lib/server/gemini-usage-overview";
import { getHelperApiToken, isHelperApiTokenSchemaMissingError } from "@/lib/server/helper-api-tokens";
import { getWorkspaceSelectionState, isWorkspaceSchemaMissingError } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GeminiUsageOverviewPanel } from "./gemini-usage-overview";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tidak dapat memuat pengaturan.";
}

type SettingsCard = {
  key: string;
  href?: string;
  title: string;
  icon?: LucideIcon;
  iconSrc?: string;
  status: ReactNode;
  detail: string;
  action?: ReactNode;
};

function SettingsRow({ card }: { card: SettingsCard }) {
  const Icon = card.icon;
  const status = typeof card.status === "number" ? <StatusBadge status={`${card.status}`} tone="info" /> : card.status;
  const icon = card.iconSrc ? (
    <span className="settings-native-row__icon settings-native-row__icon--asset" aria-hidden="true">
      <img alt="" src={card.iconSrc} />
    </span>
  ) : (
    <span className="settings-native-row__icon" aria-hidden="true">
      {Icon ? <Icon size={18} /> : null}
    </span>
  );

  const content = (
    <>
      {icon}
      <span className="settings-native-row__copy">
        <strong>{card.title}</strong>
        <span>{card.detail}</span>
      </span>
      <span className="section-card__actions">
        {status}
        {card.action ?? (card.href ? <ChevronRight size={18} aria-hidden="true" /> : null)}
      </span>
    </>
  );

  return card.href ? (
    <Link className="settings-native-row" href={card.href}>
      {content}
    </Link>
  ) : (
    <div className="settings-native-row settings-native-row--static">{content}</div>
  );
}

function SettingsGroup({ title, cards }: { title: string; cards: SettingsCard[] }) {
  return (
    <section className="settings-native-group">
      <h2>{title}</h2>
      <div className="settings-native-card">
        {cards.map((card) => (
          <SettingsRow card={card} key={card.key} />
        ))}
      </div>
    </section>
  );
}

function affiliateInitials(profileName: string) {
  const parts = profileName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase()).join("") || "A";
}

function affiliateNicheLabel(profile: AffiliateProfileRecord) {
  return profile.niche?.trim() || "Niche belum diisi";
}

function AffiliateProfileSwitchCard({
  currentWorkspaceId,
  currentProfileId,
  profile,
  avatarUrl,
}: {
  currentWorkspaceId: string;
  currentProfileId: string | null;
  profile: AffiliateProfileRecord;
  avatarUrl: string | null;
}) {
  const isCurrent = currentProfileId === profile.id;

  return (
    <article className="settings-affiliate-profile-card" data-active={isCurrent ? "true" : undefined}>
      <span className="settings-affiliate-profile-card__avatar" aria-hidden="true">
        {avatarUrl ? <img alt="" src={avatarUrl} /> : <span>{affiliateInitials(profile.profile_name)}</span>}
      </span>
      <div className="settings-affiliate-profile-card__copy">
        <strong>{profile.profile_name}</strong>
        <span className="subtle">{affiliateNicheLabel(profile)}</span>
      </div>
      <div className="settings-affiliate-profile-card__actions">
        <form action={setDefaultAffiliateProfile} className="settings-affiliate-profile-card__action desktop-action-set">
          <input type="hidden" name="return_to" value="/settings" />
          <input type="hidden" name="workspace_id" value={currentWorkspaceId} />
          <input type="hidden" name="affiliate_profile_id" value={profile.id} />
          <button className="button compact tertiary" type="submit" disabled={isCurrent}>
            <ArrowRightLeft size={15} aria-hidden="true" />
            {isCurrent ? "Aktif" : "Pilih"}
          </button>
        </form>
        <Link className="button compact tertiary desktop-action-set" href="/settings/affiliate-profiles">
          <ChevronRight size={15} aria-hidden="true" />
          Kelola
        </Link>
        <div className="mobile-card-actions">
          <form action={setDefaultAffiliateProfile} className="settings-affiliate-profile-card__action">
            <input type="hidden" name="return_to" value="/settings" />
            <input type="hidden" name="workspace_id" value={currentWorkspaceId} />
            <input type="hidden" name="affiliate_profile_id" value={profile.id} />
            <button className="button compact primary" type="submit" disabled={isCurrent}>
              <ArrowRightLeft size={15} aria-hidden="true" />
              {isCurrent ? "Aktif" : "Pilih"}
            </button>
          </form>
          <OverflowActionMenu>
            <Link className="button compact" href="/settings/affiliate-profiles">
              <ChevronRight size={15} aria-hidden="true" />
              Kelola
            </Link>
          </OverflowActionMenu>
        </div>
      </div>
    </article>
  );
}

async function AffiliateProfilesQuickSwitchSection({
  currentAffiliateProfile,
  currentWorkspaceId,
  driveItemMap,
  profiles,
}: {
  currentAffiliateProfile: AffiliateProfileRecord | null;
  currentWorkspaceId: string | null;
  driveItemMap: Map<string, DriveItemRecord>;
  profiles: AffiliateProfileRecord[];
}) {
  const profileCards = await Promise.all(
    profiles.map(async (profile) => ({
      profile,
      avatarUrl: resolveAffiliateProfileAvatar(profile, driveItemMap),
    })),
  );

  return (
    <section className="settings-native-group">
      <h2>Akun Affiliate</h2>
      <div className="settings-native-card settings-affiliate-overview">
        {currentWorkspaceId ? (
          profileCards.length ? (
            <div className="settings-affiliate-overview__list">
              {profileCards.map(({ profile, avatarUrl }) => (
                <AffiliateProfileSwitchCard
                  currentProfileId={currentAffiliateProfile?.id ?? null}
                  currentWorkspaceId={currentWorkspaceId}
                  key={profile.id}
                  profile={profile}
                  avatarUrl={avatarUrl}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="Belum ada profile aktif."
              description="Profile yang terhubung ke workspace ini akan muncul di sini."
            />
          )
        ) : (
            <EmptyState icon={Users} title="Workspace aktif belum ada." description="Pilih workspace aktif dulu." />
          )}
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
  let currentAffiliateProfile: AffiliateProfileRecord | null = null;
  let affiliateProfiles: AffiliateProfileRecord[] = [];
  let driveDetail = "Belum ada folder.";
  let driveItems: DriveItemRecord[] = [];
  let driveStatus: ReactNode = <StatusBadge status="Belum terhubung" tone="warning" />;
  let driveIsConnected = false;
  let accountStatus: ReactNode = <StatusBadge status="Ready" tone="success" />;
  let workspaceId: string | null = null;
  let geminiUsageOverview: GeminiUsageOverview = {
    cards: [],
    generatedAt: new Date().toISOString(),
    unavailableMessage: null,
  };

  try {
    const workspaceState = await getWorkspaceSelectionState();
    const workspaces = workspaceState.workspaces.filter((workspace) => workspace.status !== "ARCHIVED");
    workspaceId = workspaceState.currentWorkspace?.id ?? null;
    workspaceCount = workspaces.length;
    workspaceDetail = workspaceState.currentWorkspace ? `Aktif: ${workspaceState.currentWorkspace.workspace_name}` : "Pilih workspace aktif.";
  } catch (error) {
    workspaceCount = <StatusBadge status="Pending" tone="warning" />;
    workspaceDetail = isWorkspaceSchemaMissingError(error) ? "Schema workspace pending." : errorMessage(error);
  }

  try {
    if (workspaceId) {
      [affiliateProfiles, currentAffiliateProfile] = await Promise.all([
        listAffiliateProfiles({ workspaceId, status: "ACTIVE", limit: 200 }),
        getDefaultAffiliateProfileForWorkspace(workspaceId),
      ]);
    }
  } catch (error) {
    affiliateProfiles = [];
  }

  try {
    driveItems = (await listDriveItems({ limit: 200 })).filter((item) => item.status !== "ARCHIVED");
    const folders = driveItems.filter((item) => item.item_type === "FOLDER");
    driveDetail = `${folders.length} folder, ${driveItems.length} item.`;
  } catch (error) {
    driveDetail = errorMessage(error);
  }

  try {
    const driveConnection = await getGoogleDriveConnection();
    driveIsConnected = driveConnection?.status === "CONNECTED";
    driveStatus =
      driveIsConnected ? (
        <StatusBadge status="Connected" tone="success" />
      ) : (
        <StatusBadge status={driveConnection?.status ?? "Belum terhubung"} tone="warning" />
      );
  } catch (error) {
    driveStatus = (
      <StatusBadge status={isGoogleDriveConnectionSchemaMissingError(error) ? "Pending" : "Error"} tone="warning" />
    );
  }

  try {
    await getHelperApiToken();
  } catch (error) {
    accountStatus = <StatusBadge status={isHelperApiTokenSchemaMissingError(error) ? "Pending" : "Error"} tone="warning" />;
  }

  try {
    geminiUsageOverview = await getGeminiUsageOverview(user.id);
  } catch (error) {
    geminiUsageOverview = {
      cards: [],
      generatedAt: new Date().toISOString(),
      unavailableMessage: errorMessage(error),
    };
  }

  const cards: SettingsCard[] = [
    { key: "account", href: "/settings/account", title: "Account", icon: UserRound, status: accountStatus, detail: user.email ?? "Signed in." },
    { key: "workspace", href: "/settings/workspace", title: "Workspace", icon: FolderKanban, status: workspaceCount, detail: workspaceDetail },
    {
      key: "google-drive",
      title: "Google Drive",
      iconSrc: "/google-drive.svg",
      status: driveStatus,
      detail: driveDetail,
      action: driveIsConnected ? (
        <>
          <form action={disconnectGoogleDrive} className="desktop-action-set">
            <input type="hidden" name="return_to" value="/settings" />
            <DeleteActionButton
              confirmMessage="Putuskan koneksi Google Drive?"
              label="Putuskan"
              variant="iconOnly"
            />
          </form>
          <span className="settings-native-row__mobile-action settings-native-row__action">
            <OverflowActionMenu>
              <form action={disconnectGoogleDrive}>
                <input type="hidden" name="return_to" value="/settings" />
                <DeleteActionButton
                  confirmMessage="Putuskan koneksi Google Drive?"
                  label="Putuskan"
                />
              </form>
            </OverflowActionMenu>
          </span>
        </>
      ) : (
        <a className="button compact primary settings-drive-connect-button" href="/api/google-drive/oauth/start">
          <img alt="" src="/google-drive.svg" />
          Connect
        </a>
      ),
    },
    { key: "gemini", href: "/settings/gemini", title: "Gemini", icon: KeyRound, status: <StatusBadge status="Open" tone="info" />, detail: "Konfigurasi API Gemini." },
  ];
  const accountCards = cards.filter((card) => card.key === "account");
  const workspaceCards = cards.filter((card) => card.key === "workspace");
  const serviceCards = cards.filter((card) => card.key === "google-drive" || card.key === "gemini");
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));

  return (
    <div className="stack">
      <GeminiUsageOverviewPanel overview={{ cards: geminiUsageOverview.cards }} />
      <PwaInstallCard />
      {cards.length ? (
        <section className="settings-native-list">
          <SettingsGroup title="Account" cards={accountCards} />
          <SettingsGroup title="Workspace" cards={workspaceCards} />
          <AffiliateProfilesQuickSwitchSection
            currentAffiliateProfile={currentAffiliateProfile}
            currentWorkspaceId={workspaceId}
            driveItemMap={driveItemMap}
            profiles={affiliateProfiles}
          />
          <SettingsGroup title="Connected Services" cards={serviceCards} />
        </section>
      ) : (
        <EmptyState icon={Settings} title="Pengaturan kosong." description="Belum ada section." />
      )}
    </div>
  );
}
