type SkeletonCountProps = {
  count?: number;
};

type SkeletonLineProps = {
  size?: "short" | "medium" | "long";
};

export function SkeletonLine({ size = "medium" }: SkeletonLineProps) {
  return <span className={`skeleton ${size}`} aria-hidden="true" />;
}

export function SkeletonButton() {
  return <span className="skeleton-button" aria-hidden="true" />;
}

export function SkeletonPwaInstallCard() {
  return (
    <section className="pwa-install-card loading-skeleton-static" aria-hidden="true">
      <span className="pwa-install-card__icon skeleton-icon" />
      <span className="pwa-install-card__copy">
        <SkeletonLine size="short" />
        <SkeletonLine size="medium" />
      </span>
      <SkeletonButton />
    </section>
  );
}

export function SkeletonSearchToolbar() {
  return (
    <div className="settings-list-toolbar loading-skeleton-static" aria-hidden="true">
      <div className="product-search skeleton-search-field">
        <span className="skeleton-icon skeleton-icon--small" />
        <SkeletonLine size="long" />
      </div>
    </div>
  );
}

export function SkeletonInlineSummary({ action = true }: { action?: boolean }) {
  return (
    <div className="settings-inline-summary loading-skeleton-static" aria-hidden="true">
      <SkeletonLine size="short" />
      {action ? <SkeletonButton /> : <SkeletonLine size="medium" />}
    </div>
  );
}

export function SkeletonFilterTabs({ count = 3 }: SkeletonCountProps) {
  return (
    <div className="content-filter-tabs loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span className="content-filter-tab skeleton-tab" key={index} />
      ))}
    </div>
  );
}

export function SkeletonUploadCard({ withCamera = false }: { withCamera?: boolean }) {
  return (
    <section className="image-preview-upload-card stack-tight loading-skeleton-static" aria-hidden="true">
      <div className="image-preview-upload-card__header">
        <SkeletonLine size="medium" />
        <SkeletonLine size="short" />
      </div>
      <div className="image-preview-upload-card__frame skeleton-preview-frame" />
      <div className="image-preview-upload-card__actions">
        <SkeletonButton />
        {withCamera ? <SkeletonButton /> : null}
      </div>
    </section>
  );
}

export function SkeletonProfileCarousel({ count = 2 }: SkeletonCountProps) {
  return (
    <section className="stack-tight loading-skeleton-static" aria-hidden="true">
      <SkeletonLine size="short" />
      <div className="profile-carousel">
        {Array.from({ length: count }).map((_, index) => (
          <div className="profile-card" key={index}>
            <span className="profile-card__avatar skeleton-avatar" />
            <span className="profile-card__copy">
              <SkeletonLine size="medium" />
              <SkeletonLine size="short" />
            </span>
            <SkeletonButton />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SkeletonVisualListCards({ count = 2 }: SkeletonCountProps) {
  return (
    <div className="products-cards-mobile loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <article className="visual-list-card" key={index}>
          <span className="visual-list-card__thumb skeleton-media-thumb" />
          <div className="visual-list-card__body">
            <div className="visual-list-card__header">
              <div className="visual-list-card__copy">
                <SkeletonLine size="long" />
                <SkeletonLine size="medium" />
                <SkeletonLine size="short" />
              </div>
              <span className="skeleton-pill" />
            </div>
            <div className="visual-list-card__footer">
              <SkeletonLine size="short" />
              <SkeletonLine size="short" />
            </div>
            <div className="mobile-card-actions">
              <SkeletonButton />
              <SkeletonButton />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function SkeletonPromptCards({ count = 2 }: SkeletonCountProps) {
  return (
    <section className="stack prompt-list-stack loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <article className="prompt-list-card stack" key={index}>
          <div className="prompt-list-card__header">
            <div className="prompt-list-card__copy">
              <SkeletonLine size="short" />
              <SkeletonLine size="long" />
              <SkeletonLine size="medium" />
            </div>
            <span className="skeleton-pill" />
          </div>
          <div className="prompt-list-card__meta-row">
            <span className="skeleton-chip" />
            <span className="skeleton-chip skeleton-chip--wide" />
          </div>
          <div className="prompt-list-card__divider" />
          <div className="mobile-card-actions prompt-list-card__mobile-actions">
            <SkeletonButton />
            <SkeletonButton />
          </div>
        </article>
      ))}
    </section>
  );
}

export function SkeletonDriveGrid({ count = 8 }: SkeletonCountProps) {
  return (
    <div className="drive-visual-grid loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="drive-tile" key={index}>
          <span className="drive-tile__thumb skeleton-media-thumb" />
          <span className="drive-tile__header">
            <span className="drive-tile__copy">
              <SkeletonLine size="medium" />
              <SkeletonLine size="short" />
            </span>
            <span className="skeleton-pill" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function SkeletonSettingsNativeList() {
  const groups = [1, 1, 2, 2];

  return (
    <section className="settings-native-list loading-skeleton-static" aria-hidden="true">
      {groups.map((rowCount, groupIndex) => (
        <section className="settings-native-group" key={groupIndex}>
          <SkeletonLine size="short" />
          <div className="settings-native-card">
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <div className="settings-native-row" key={rowIndex}>
                <span className="settings-native-row__icon skeleton-icon" />
                <span className="settings-native-row__copy">
                  <SkeletonLine size="medium" />
                  <SkeletonLine size="long" />
                </span>
                <span className="skeleton-pill" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

export function SkeletonGeminiUsageOverview() {
  return (
    <section className="gemini-usage-overview loading-skeleton-static" aria-hidden="true">
      <div className="gemini-usage-overview__header">
        <SkeletonLine size="medium" />
        <SkeletonLine size="short" />
      </div>
      <div className="gemini-usage-carousel">
        <div className="gemini-usage-carousel__viewport">
          <div className="gemini-usage-carousel__track">
            <div className="gemini-usage-carousel__slide">
              <div className="gemini-usage-card">
                <div className="gemini-usage-card__content">
                  <div className="gemini-usage-card__chart">
                    <span className="skeleton-donut" />
                  </div>
                  <div className="gemini-usage-context">
                    <div className="gemini-usage-context__header">
                      <div className="stack-tight">
                        <SkeletonLine size="medium" />
                        <SkeletonLine size="short" />
                      </div>
                      <SkeletonLine size="short" />
                    </div>
                    <div className="gemini-usage-metrics">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div className="gemini-usage-metric-row" key={index}>
                          <span className="gemini-usage-metric-row__dot skeleton-icon skeleton-icon--small" />
                          <SkeletonLine size="medium" />
                          <SkeletonLine size="short" />
                          <SkeletonLine size="short" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SkeletonManagerCards({ count = 2, withAvatar = false }: SkeletonCountProps & { withAvatar?: boolean }) {
  return (
    <div className="products-cards-mobile loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <article className="product-card settings-list-card" key={index}>
          <div className="settings-list-card__header">
            <div className={withAvatar ? "affiliate-profile-card__main" : "stack-tight"}>
              {withAvatar ? <span className="affiliate-profile-card__avatar skeleton-avatar" /> : null}
              <span className={withAvatar ? "affiliate-profile-card__copy" : "stack-tight"}>
                <SkeletonLine size="medium" />
                <SkeletonLine size="long" />
              </span>
            </div>
            <span className="skeleton-pill" />
          </div>
          <SkeletonLine size="medium" />
          <div className="mobile-card-actions">
            <SkeletonButton />
            <SkeletonButton />
          </div>
        </article>
      ))}
    </div>
  );
}

export function SkeletonMetricGrid({ count = 4 }: SkeletonCountProps) {
  return (
    <div className="metric-grid loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="metric" key={index}>
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTabNav({ count = 3 }: SkeletonCountProps) {
  return (
    <nav className="tab-nav tab-nav--flush loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span className="tab-link skeleton-tab" key={index} />
      ))}
    </nav>
  );
}

export function SkeletonDashboardActionRail() {
  return (
    <ul className="dashboard-action-grid loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <li className={index === 0 ? "dashboard-action-card dashboard-action-card--primary" : "dashboard-action-card"} key={index}>
          <div className="dashboard-action-card__content">
            <span className="dashboard-action-card__orb skeleton-icon" />
            <div className="dashboard-action-card__copy">
              <div className="dashboard-action-card__title-row">
                <SkeletonLine size="medium" />
                <span className="skeleton-pill" />
              </div>
              <SkeletonLine size="long" />
            </div>
          </div>
          <SkeletonButton />
        </li>
      ))}
    </ul>
  );
}
