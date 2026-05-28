import { redirect } from "next/navigation";
import { CircleHelp, Clock3, Copyright, FileClock, GitCommit, Info, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/operator/empty-state";
import { SectionCard } from "@/components/operator/section-card";
import { APP_RELEASE, APP_RELEASE_CHANGELOG, APP_RELEASE_FAQ } from "@/lib/server/app-release";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 300;

type AboutRowProps = {
  detail: string;
  icon: LucideIcon;
  title: string;
};

function AboutRow({ detail, icon: Icon, title }: AboutRowProps) {
  return (
    <div className="settings-native-row settings-native-row--static">
      <span className="settings-native-row__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="settings-native-row__copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </span>
    </div>
  );
}

function AboutGroup({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="settings-native-group">
      <h2>{title}</h2>
      <div className="settings-native-card">{children}</div>
    </section>
  );
}

export default async function SettingsAboutPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const hasReleaseContent = APP_RELEASE_FAQ.length > 0 && APP_RELEASE_CHANGELOG.length > 0;

  if (!hasReleaseContent) {
    return (
      <EmptyState
        icon={Info}
        title="Info aplikasi kosong."
        description="Tidak ada data versi yang tersedia."
      />
    );
  }

  return (
    <div className="stack settings-page-body">
      <AboutGroup title="Informasi aplikasi">
        <AboutRow detail={APP_RELEASE.appName} icon={Info} title="Nama aplikasi" />
        <AboutRow detail={APP_RELEASE.buildNumber} icon={FileClock} title="Versi rilis" />
        <AboutRow detail={APP_RELEASE.releaseDate} icon={Clock3} title="Tanggal rilis" />
        {APP_RELEASE.commitShortSha ? <AboutRow detail={APP_RELEASE.commitShortSha} icon={GitCommit} title="Commit" /> : null}
        <AboutRow detail={APP_RELEASE.ownerName} icon={UserRound} title="Pemilik" />
        <AboutRow detail={APP_RELEASE.copyrightLine} icon={Copyright} title="Hak cipta" />
      </AboutGroup>

      <SectionCard icon={CircleHelp} title="FAQ">
        <div className="stack-tight">
          {APP_RELEASE_FAQ.map((item) => (
            <article className="stack-tight" key={item.question}>
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard icon={FileClock} title="Riwayat rilis">
        <div className="stack-tight">
          {APP_RELEASE_CHANGELOG.map((entry) => (
            <article className="stack-tight" key={entry.version}>
              <strong>{entry.version}</strong>
              <p>{entry.summary}</p>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
