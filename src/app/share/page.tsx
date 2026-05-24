import { SharePlatformGrid } from "./_components/share-platform-grid";
import { ShareKpiSummary } from "./_components/share-kpi-summary";

export const metadata = {
  title: "Share",
};

export default function SharePage() {
  return (
    <div className="stack">
      <ShareKpiSummary />
      <SharePlatformGrid />
    </div>
  );
}
