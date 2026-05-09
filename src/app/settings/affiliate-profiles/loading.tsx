import {
  SkeletonInlineSummary,
  SkeletonManagerCards,
  SkeletonSettingsProfileHero,
  SkeletonSearchToolbar,
} from "@/components/operator/loading-skeleton";

export default function AffiliateProfilesSettingsLoading() {
  return (
    <div className="stack settings-page-body" aria-busy="true">
      <section className="product-master settings-manager settings-manager--affiliate" aria-label="Memuat akun affiliate">
        <div className="product-master__list stack">
          <SkeletonSettingsProfileHero />
          <SkeletonSearchToolbar />
          <SkeletonInlineSummary />
          <SkeletonManagerCards count={2} withAvatar />
        </div>
      </section>
    </div>
  );
}
