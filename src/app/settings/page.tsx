import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ChevronRight,
  KeyRound,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { AffiliateProfileHero } from "@/components/operator/affiliate-profile-hero";
import { AvatarThumbnailFrame } from "@/components/operator/avatar-thumbnail-frame";
import { EmptyState } from "@/components/operator/empty-state";
import { StatusBadge } from "@/components/operator/status-badge";
import { DeleteActionButton } from "@/components/ui/delete-action-button";
import { NativeAnchorButton, NativeButton, NativeLinkButton } from "@/components/ui/native-button";
import { OverflowActionMenu } from "@/components/ui/overflow-action-menu";
import { activateAffiliateProfile, disconnectGoogleDrive } from "./actions";
import {
  getPrimaryAffiliateProfileForWorkspace,
  listAffiliateProfiles,
  type AffiliateProfileRecord,
} from "@/lib/server/affiliate-profiles";
import { resolveAffiliateProfileAvatar } from "@/lib/server/affiliate-profile-avatars";
import { listDriveItemsByIds, type DriveItemRecord } from "@/lib/server/drive-items";
import { getActiveWorkspaceDriveScope } from "@/lib/server/drive-workspace-scope";
import { getGoogleDriveConnection, isGoogleDriveConnectionSchemaMissingError } from "@/lib/server/google-drive-connections";
import { getHelperApiToken, isHelperApiTokenSchemaMissingError } from "@/lib/server/helper-api-tokens";
import { getWorkspaceSelectionState } from "@/lib/server/workspaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tidak dapat memuat pengaturan.";
}

function mergeDriveItemsById(items: DriveItemRecord[], extraItems: DriveItemRecord[]) {
  const itemMap = new Map(items.map((item) => [item.id, item]));

  for (const item of extraItems) {
    itemMap.set(item.id, item);
  }

  return Array.from(itemMap.values());
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

type AffiliateProfileOverviewRecord = AffiliateProfileRecord & {
  avatarUrl: string | null;
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

function AffiliateProfileSwitchGroup({
  currentProfileId,
  profiles,
}: {
  currentProfileId: string | null;
  profiles: AffiliateProfileOverviewRecord[];
}) {
  const activeProfiles = profiles.filter((profile) => profile.status === "ACTIVE");

  if (!activeProfiles.length) {
    return null;
  }

  return (
    <section className="settings-native-group">
      <h2>Akun Affiliate</h2>
      <div className="settings-native-card">
        {activeProfiles.map((profile) => {
          const isCurrent = profile.id === currentProfileId;

          return (
            <div className="settings-native-row settings-native-row--static" key={profile.id}>
              <AvatarThumbnailFrame
                className="affiliate-profile-card__avatar"
                iconSize={18}
                src={profile.avatarUrl}
              />
              <span className="settings-native-row__copy">
                <strong>{profile.profile_name}</strong>
                <span>{profile.account_label?.trim() || profile.niche?.trim() || profile.platform}</span>
              </span>
              <span className="section-card__actions">
                {isCurrent ? (
                  <StatusBadge status="Aktif" tone="success" />
                ) : (
                  <form action={activateAffiliateProfile}>
                    <input type="hidden" name="return_to" value="/settings" />
                    <input type="hidden" name="affiliate_profile_id" value={profile.id} />
                    <NativeButton className="compact primary" type="submit">
                      Aktifkan
                    </NativeButton>
                  </form>
                )}
              </span>
            </div>
          );
        })}
        <div className="settings-native-row settings-native-row--static">
          <span className="settings-native-row__icon" aria-hidden="true">
            <UserRound size={18} />
          </span>
          <span className="settings-native-row__copy">
            <strong>Kelola akun</strong>
            <span>{profiles.length} profile</span>
          </span>
          <span className="section-card__actions">
            <NativeLinkButton className="compact tertiary" href="/settings/affiliate-profiles">
              Kelola
            </NativeLinkButton>
          </span>
        </div>
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

  let currentAffiliateProfile: AffiliateProfileRecord | null = null;
  let affiliateProfiles: AffiliateProfileRecord[] = [];
  let driveDetail = "Belum ada folder.";
  let driveItems: DriveItemRecord[] = [];
  let driveStatus: ReactNode = <StatusBadge status="Belum terhubung" tone="warning" />;
  let driveIsConnected = false;
  let accountStatus: ReactNode = <StatusBadge status="Ready" tone="success" />;
  let workspaceId: string | null = null;

  const [workspaceResult, affiliateProfilesResult, driveScopeResult, driveConnectionResult, helperApiTokenResult] = await Promise.allSettled([
    getWorkspaceSelectionState(),
    listAffiliateProfiles({ limit: 200 }),
    getActiveWorkspaceDriveScope({ limit: 200 }),
    getGoogleDriveConnection(),
    getHelperApiToken(),
  ]);

  if (workspaceResult.status === "fulfilled") {
    workspaceId = workspaceResult.value.currentWorkspace?.id ?? null;
  } else {
    workspaceId = null;
    currentAffiliateProfile = null;
  }

  if (affiliateProfilesResult.status === "fulfilled") {
    affiliateProfiles = affiliateProfilesResult.value;
  }

  if (driveScopeResult.status === "fulfilled") {
    driveItems = driveScopeResult.value.items.filter((item) => item.status !== "ARCHIVED");
    const folders = driveItems.filter((item) => item.item_type === "FOLDER");
    driveDetail = `${folders.length} folder, ${driveItems.length} item di workspace aktif.`;
  } else {
    driveDetail = errorMessage(driveScopeResult.reason);
  }

  if (driveConnectionResult.status === "fulfilled") {
    driveIsConnected = driveConnectionResult.value?.status === "CONNECTED";
    driveStatus =
      driveIsConnected ? (
        <StatusBadge status="Connected" tone="success" />
      ) : (
        <StatusBadge status={driveConnectionResult.value?.status ?? "Belum terhubung"} tone="warning" />
      );
  } else {
    driveStatus = (
      <StatusBadge status={isGoogleDriveConnectionSchemaMissingError(driveConnectionResult.reason) ? "Pending" : "Error"} tone="warning" />
    );
  }

  if (helperApiTokenResult.status === "rejected") {
    accountStatus = <StatusBadge status={isHelperApiTokenSchemaMissingError(helperApiTokenResult.reason) ? "Pending" : "Error"} tone="warning" />;
  }

  try {
    if (workspaceId) {
      currentAffiliateProfile = await getPrimaryAffiliateProfileForWorkspace(workspaceId);
    }
  } catch {
    currentAffiliateProfile = null;
  }

  try {
    const profileDriveItemRefs = affiliateProfiles.flatMap((profile) => [
      profile.seed_character_drive_item_ref_id,
      profile.environment_drive_item_ref_id,
    ]);
    const profileDriveItems = (await listDriveItemsByIds(profileDriveItemRefs)).filter((item) => item.status !== "ARCHIVED");
    driveItems = mergeDriveItemsById(driveItems, profileDriveItems);
  } catch {
    driveItems = driveItems.filter((item) => item.status !== "ARCHIVED");
  }

  const cards: SettingsCard[] = [
    { key: "account", href: "/settings/account", title: "Account", icon: UserRound, status: accountStatus, detail: user.email ?? "Signed in." },
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
        <NativeAnchorButton className="compact primary settings-drive-connect-button" href="/api/google-drive/oauth/start">
          <img alt="" src="/google-drive.svg" />
          Connect
        </NativeAnchorButton>
      ),
    },
    { key: "gemini", href: "/settings/gemini", title: "Gemini", icon: KeyRound, status: <StatusBadge status="Open" tone="info" />, detail: "Konfigurasi API Gemini." },
  ];
  const accountCards = cards.filter((card) => card.key === "account");
  const serviceCards = cards.filter((card) => card.key === "google-drive" || card.key === "gemini");
  const driveItemMap = new Map(driveItems.map((item) => [item.id, item]));
  const currentAffiliateProfileAvatarUrl = currentAffiliateProfile ? resolveAffiliateProfileAvatar(currentAffiliateProfile, driveItemMap) : null;
  const affiliateProfilesWithAvatars = affiliateProfiles.map((profile) => ({
    ...profile,
    avatarUrl: resolveAffiliateProfileAvatar(profile, driveItemMap),
  }));

  return (
    <div className="stack">
      <AffiliateProfileHero
        accountLabel={currentAffiliateProfile?.account_label?.trim() || null}
        avatarUrl={currentAffiliateProfileAvatarUrl}
        actionLabel="Buka setting"
        eyebrow="Akun Affiliate aktif"
        href="/settings/affiliate-profiles"
        title={currentAffiliateProfile?.profile_name ?? "Belum ada profile aktif."}
        variant="overview"
      />
      <section className="settings-native-list">
        <AffiliateProfileSwitchGroup
          currentProfileId={currentAffiliateProfile?.id ?? null}
          profiles={affiliateProfilesWithAvatars}
        />
        <SettingsGroup title="Account" cards={accountCards} />
        <SettingsGroup title="Connected Services" cards={serviceCards} />
      </section>
      {cards.length ? null : (
        <EmptyState icon={Settings} title="Pengaturan kosong." description="Belum ada section." />
      )}
    </div>
  );
}
