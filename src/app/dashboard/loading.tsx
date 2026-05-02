export default function DashboardLoading() {
  return (
    <section className="panel stack" aria-label="Loading dashboard">
      <div className="skeleton short" />
      <div className="skeleton long" />
      <div className="skeleton medium" />
      <div className="grid two-up">
        <div className="muted-box stack">
          <div className="skeleton long" />
          <div className="skeleton medium" />
        </div>
        <div className="muted-box stack">
          <div className="skeleton long" />
          <div className="skeleton medium" />
        </div>
      </div>
    </section>
  );
}
