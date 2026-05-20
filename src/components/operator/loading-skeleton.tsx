type SkeletonCountProps = {
  count?: number;
  className?: string;
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

export function SkeletonControllerHeader() {
  return (
    <header className="controller-workflow-header loading-skeleton-static" aria-hidden="true">
      <div className="controller-workflow-header__workspace">
        <SkeletonLine size="short" />
        <SkeletonLine size="medium" />
        <SkeletonLine size="short" />
      </div>
      <div className="controller-workflow-header__badges">
        <span className="skeleton-pill" />
        <span className="skeleton-pill" />
      </div>
    </header>
  );
}

export function SkeletonControllerRail() {
  return (
    <ol className="controller-stepper-rail loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, index) => (
        <li className="controller-stepper-rail__item" key={index}>
          <span className="controller-stepper-rail__button">
            <span className="controller-stepper-rail__index skeleton-icon skeleton-icon--small" />
            <span className="controller-stepper-rail__copy">
              <SkeletonLine size="medium" />
              <SkeletonLine size="short" />
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function SkeletonControllerCard() {
  return (
    <article className="controller-lane-card controller-batch-card loading-skeleton-static" aria-hidden="true">
      <div className="controller-batch-info-grid">
        <span className="stack-tight">
          <SkeletonLine size="medium" />
          <SkeletonLine size="short" />
        </span>
        <span className="controller-card-status-stack">
          <span className="skeleton-pill" />
          <span className="skeleton-pill" />
        </span>
      </div>
      <div className="controller-lane-card__meta controller-batch-card__meta">
        <SkeletonLine size="short" />
        <SkeletonLine size="short" />
        <SkeletonLine size="medium" />
        <SkeletonLine size="short" />
      </div>
      <div className="controller-card-section controller-card-section--stage">
        <div className="controller-stage-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <div className="controller-stage-row" key={index}>
              <span className="stack-tight">
                <SkeletonLine size="medium" />
                <SkeletonLine size="short" />
              </span>
              <span className="skeleton-pill" />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export function SkeletonFilterTabs({ count = 3, className }: SkeletonCountProps) {
  return (
    <div className={`content-filter-tabs loading-skeleton-static${className ? ` ${className}` : ""}`.trim()} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span className="content-filter-tab skeleton-tab" key={index} />
      ))}
    </div>
  );
}

export function SkeletonUploadCard() {
  return (
    <section className="image-preview-upload-card stack-tight loading-skeleton-static" aria-hidden="true">
      <div className="image-preview-upload-card__header">
        <SkeletonLine size="medium" />
        <SkeletonLine size="short" />
      </div>
      <div className="image-preview-upload-card__frame skeleton-preview-frame" />
      <div className="image-preview-upload-card__actions">
        <SkeletonButton />
      </div>
    </section>
  );
}

export function SkeletonIntakeStepper() {
  return (
    <section className="intake-stepper loading-skeleton-static" aria-hidden="true">
      <ol className="intake-stepper__rail">
        {Array.from({ length: 4 }).map((_, index) => (
          <li className="intake-stepper__rail-item" key={index}>
            <span className="intake-stepper__rail-button">
              <span className="intake-stepper__rail-dot skeleton-icon skeleton-icon--small" />
              <span className="intake-stepper__rail-copy">
                <span className="skeleton medium" />
                <span className="skeleton short" />
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="intake-stepper__stack">
        <section className="intake-stepper__step" data-expanded="true" aria-hidden="true">
          <div className="intake-stepper__step-header">
            <span className="intake-stepper__step-header-copy">
              <span className="intake-stepper__step-dot skeleton-icon skeleton-icon--small" />
              <span className="intake-stepper__step-copy">
                <span className="skeleton medium" />
                <span className="skeleton short" />
              </span>
            </span>
            <span className="skeleton-pill" />
          </div>
          <div className="intake-stepper__step-body">
            <SkeletonUploadCard />
            <div className="form-actions">
              <SkeletonButton />
            </div>
          </div>
        </section>

        <section className="intake-stepper__step" data-expanded="false" aria-hidden="true">
          <div className="intake-stepper__step-header">
            <span className="intake-stepper__step-header-copy">
              <span className="intake-stepper__step-dot skeleton-icon skeleton-icon--small" />
              <span className="intake-stepper__step-copy">
                <span className="skeleton medium" />
                <span className="skeleton short" />
              </span>
            </span>
            <span className="skeleton-pill" />
          </div>
        </section>

        <section className="intake-stepper__step" data-expanded="false" aria-hidden="true">
          <div className="intake-stepper__step-header">
            <span className="intake-stepper__step-header-copy">
              <span className="intake-stepper__step-dot skeleton-icon skeleton-icon--small" />
              <span className="intake-stepper__step-copy">
                <span className="skeleton medium" />
                <span className="skeleton short" />
              </span>
            </span>
            <span className="skeleton-pill" />
          </div>
        </section>

        <section className="intake-stepper__step" data-expanded="false" aria-hidden="true">
          <div className="intake-stepper__step-header">
            <span className="intake-stepper__step-header-copy">
              <span className="intake-stepper__step-dot skeleton-icon skeleton-icon--small" />
              <span className="intake-stepper__step-copy">
                <span className="skeleton medium" />
                <span className="skeleton short" />
              </span>
            </span>
            <span className="skeleton-pill" />
          </div>
          <div className="intake-stepper__step-body">
            <SkeletonIntakeMetadataPreview />
          </div>
        </section>
      </div>
    </section>
  );
}

export function SkeletonIntakeEvidenceGrid() {
  return (
    <div className="intake-evidence-grid" aria-hidden="true">
      <SkeletonUploadCard />
      <SkeletonUploadCard />
      <SkeletonUploadCard />
    </div>
  );
}

export function SkeletonIntakeMetadataPreview() {
  return (
    <section className="prompt-preview-panel stack loading-skeleton-static" aria-hidden="true">
      <div className="section-card__actions">
        <div className="stack-tight">
          <SkeletonLine size="medium" />
          <SkeletonLine size="short" />
        </div>
        <span className="skeleton-pill" />
      </div>

      <div className="grid two-up">
        <div className="stack-tight">
          <SkeletonLine size="short" />
          <SkeletonLine size="long" />
        </div>
        <div className="stack-tight">
          <SkeletonLine size="short" />
          <SkeletonLine size="long" />
        </div>
        <div className="stack-tight">
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
        </div>
        <div className="stack-tight">
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
        </div>
        <div className="stack-tight">
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
        </div>
        <div className="stack-tight">
          <SkeletonLine size="short" />
          <SkeletonLine size="long" />
        </div>
        <div className="stack-tight">
          <SkeletonLine size="short" />
          <SkeletonLine size="medium" />
        </div>
        <div className="stack-tight">
          <SkeletonLine size="short" />
          <SkeletonLine size="short" />
        </div>
      </div>

      <div className="form-actions action-rail--pair">
        <SkeletonButton />
        <SkeletonButton />
      </div>
    </section>
  );
}

export function SkeletonPromptFieldStepper() {
  return (
    <section className="prompt-field-stepper loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <section className="prompt-field-stepper__step" key={index}>
          <div className="prompt-field-stepper__header">
            <div className="prompt-field-stepper__header-copy">
              <span className="prompt-field-stepper__index skeleton-pill skeleton-pill--compact" />
              <div className="stack-tight">
                <SkeletonLine size="short" />
                <SkeletonLine size="medium" />
              </div>
            </div>
            <SkeletonButton />
          </div>
          <div className="prompt-field-stepper__body">
            <div className="prompt-readonly-field">
              <div className="prompt-readonly-field__header">
                <SkeletonLine size="short" />
                <SkeletonButton />
              </div>
              <div className="prompt-readonly-field__body">
                <SkeletonLine size="long" />
                <SkeletonLine size="long" />
                <SkeletonLine size="medium" />
              </div>
            </div>
          </div>
        </section>
      ))}
    </section>
  );
}

export function SkeletonPromptDetailContent() {
  return (
    <div className="stack loading-skeleton-static" aria-hidden="true">
      <section className="grid two-up" aria-label="Caption dan tags">
        <div className="prompt-readonly-field">
          <div className="prompt-readonly-field__header">
            <SkeletonLine size="short" />
            <SkeletonButton />
          </div>
          <div className="prompt-readonly-field__body">
            <SkeletonLine size="long" />
            <SkeletonLine size="medium" />
          </div>
        </div>
        <div className="prompt-readonly-field">
          <div className="prompt-readonly-field__header">
            <SkeletonLine size="short" />
            <SkeletonButton />
          </div>
          <div className="prompt-readonly-field__body">
            <SkeletonLine size="medium" />
            <SkeletonLine size="short" />
          </div>
        </div>
      </section>

      <div className="section-card__actions">
        <SkeletonLine size="short" />
        <span className="skeleton-pill" />
      </div>

      <section className="prompt-output-grid" aria-label="Prompt per clip">
        {Array.from({ length: 2 }).map((_, index) => (
          <details className="prompt-output-section" key={index} open={index === 0}>
            <summary>
              <SkeletonLine size="medium" />
              <SkeletonLine size="short" />
            </summary>
            <div className="prompt-output-section__body">
              <SkeletonPromptFieldStepper />
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

export function SkeletonPromptDetailRegenerate() {
  return (
    <div className="stack loading-skeleton-static" aria-hidden="true">
      <SkeletonLine size="short" />
      <div className="prompt-readonly-field">
        <div className="prompt-readonly-field__header">
          <SkeletonLine size="short" />
          <SkeletonButton />
        </div>
        <div className="prompt-readonly-field__body">
          <SkeletonLine size="long" />
          <SkeletonLine size="long" />
          <SkeletonLine size="medium" />
        </div>
      </div>
      <div className="form-actions action-rail--pair">
        <SkeletonButton />
        <SkeletonButton />
      </div>
    </div>
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
              <div className="visual-list-card__status">
                <span className="skeleton-pill" />
                <SkeletonLine size="short" />
              </div>
            </div>
            <div className="visual-list-card__footer">
              <SkeletonLine size="short" />
              <SkeletonLine size="short" />
            </div>
            <div className="mobile-card-actions">
              <SkeletonButton />
              <span className="skeleton-icon skeleton-icon--small" />
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
  const groups = [1, 1, 1, 2];

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

export function SkeletonDashboardLiveCycleChart({ rows = 7 }: { rows?: number }) {
  const barWidths = [86, 42, 72, 30, 64, 48, 58];

  return (
    <section className="dashboard-analysis-chart loading-skeleton-static" aria-hidden="true">
      <div className="dashboard-summary-note dashboard-analysis-chart__summary">
        <span className="skeleton-pill" />
        <span className="skeleton-pill" />
        <span className="skeleton-pill" />
      </div>

      <div className="dashboard-analysis-chart__plot">
        <div className="dashboard-analysis-chart__skeleton-frame">
          <div className="dashboard-analysis-chart__skeleton-axis">
            <SkeletonLine size="short" />
            <SkeletonLine size="short" />
            <SkeletonLine size="short" />
            <SkeletonLine size="short" />
          </div>

          <div className="dashboard-analysis-chart__skeleton-bars">
            {Array.from({ length: rows }).map((_, index) => (
              <div className="dashboard-analysis-chart__skeleton-row" key={index}>
                <SkeletonLine size="medium" />
                <div className="dashboard-analysis-chart__skeleton-bar">
                  <span style={{ width: `${barWidths[index % barWidths.length]}%` }} />
                </div>
                <SkeletonLine size="short" />
              </div>
            ))}
          </div>
        </div>
        <div className="dashboard-analysis-chart__footer">
          <div className="dashboard-analysis-chart__skeleton-legend">
            {Array.from({ length: rows }).map((_, index) => (
              <span className="dashboard-analysis-chart__skeleton-legend-item" key={index}>
                <span className="dashboard-analysis-chart__skeleton-legend-dot skeleton-icon skeleton-icon--small" />
                <SkeletonLine size="short" />
                <SkeletonLine size="short" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export const SkeletonDashboardAnalysisTable = SkeletonDashboardLiveCycleChart;

export function SkeletonSettingsShortcutCard() {
  return (
    <section className="settings-native-group loading-skeleton-static" aria-hidden="true">
      <SkeletonLine size="short" />
      <div className="settings-native-card">
        <div className="settings-native-row">
          <span className="settings-native-row__icon skeleton-icon" />
          <span className="settings-native-row__copy">
            <SkeletonLine size="medium" />
            <SkeletonLine size="long" />
          </span>
          <span className="skeleton-pill" />
        </div>
      </div>
    </section>
  );
}

export function SkeletonSettingsProfileHero() {
  return (
    <section className="settings-native-card settings-profile-hero settings-profile-hero--overview loading-skeleton-static" aria-hidden="true">
      <span className="settings-profile-hero__avatar skeleton-avatar skeleton-avatar--xl" />
      <span className="settings-profile-hero__copy">
        <SkeletonLine size="short" />
        <SkeletonLine size="long" />
        <div className="settings-profile-hero__meta">
          <SkeletonLine size="short" />
        </div>
        <div className="settings-profile-hero__footer">
          <SkeletonButton />
        </div>
      </span>
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

export function SkeletonIntakeTelemetryComparison() {
  return (
    <div className="dashboard-telemetry-list loading-skeleton-static" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, index) => (
        <article className="dashboard-telemetry-row" key={index}>
          <div className="dashboard-telemetry-row__header">
            <div className="dashboard-telemetry-row__copy">
              <SkeletonLine size="medium" />
              <SkeletonLine size="short" />
            </div>
            <span className="skeleton-pill" />
          </div>

          <div className="dashboard-telemetry-row__stats">
            {Array.from({ length: 7 }).map((__, statIndex) => (
              <div className="dashboard-telemetry-stat" key={statIndex}>
                <SkeletonLine size="short" />
                <SkeletonLine size="medium" />
                <SkeletonLine size="short" />
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
