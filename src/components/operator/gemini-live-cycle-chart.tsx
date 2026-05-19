"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { StatusBadge } from "@/components/operator/status-badge";

type GeminiLiveCycleRow = {
  status: string;
  label: string;
  count: number;
  share: number;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

type GeminiLiveCycleChartProps = {
  rows: GeminiLiveCycleRow[];
  summary: {
    active: number;
    issue: number;
    total: number;
  };
};

const GEMINI_LIVE_CYCLE_COLORS: Record<string, string> = {
  QUEUED: "var(--muted-strong)",
  RUNNING: "var(--color-status-info)",
  SUCCESS: "var(--color-status-success)",
  FAILED: "var(--color-status-error)",
  RETRYING: "var(--color-status-warning)",
  WAITING_FOR_KEY: "var(--color-status-warning)",
  CANCELLED: "var(--muted-strong)",
};

function formatCount(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatPercentRatio(value: number) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function GeminiLiveCycleLegend({ rows }: { rows: GeminiLiveCycleRow[] }) {
  return (
    <div className="dashboard-analysis-chart__legend" aria-label="Rincian status Gemini">
      {rows.map((row) => (
        <span className="dashboard-analysis-chart__legend-item" key={row.status}>
          <i
            aria-hidden="true"
            className="dashboard-analysis-chart__legend-dot"
            style={{ backgroundColor: GEMINI_LIVE_CYCLE_COLORS[row.status] ?? "var(--muted)" }}
          />
          <span className="dashboard-analysis-chart__legend-label">{row.label}</span>
          <span className="dashboard-analysis-chart__legend-meta">
            {formatCount(row.count)} ({formatPercentRatio(row.share)})
          </span>
        </span>
      ))}
    </div>
  );
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();

      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    ref,
    size,
  };
}

export function GeminiLiveCycleChart({ rows, summary }: GeminiLiveCycleChartProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const canRenderChart = size.width > 0 && size.height > 0;

  return (
    <div className="dashboard-analysis-chart">
      <div className="dashboard-summary-note dashboard-analysis-chart__summary">
        <StatusBadge status={`Total ${formatCount(summary.total)}`} tone="neutral" />
        <StatusBadge status={`Aktif ${formatCount(summary.active)}`} tone="info" />
        <StatusBadge status={`Issue ${formatCount(summary.issue)}`} tone="warning" />
      </div>

      <div className="dashboard-analysis-chart__plot">
        <div className="dashboard-analysis-chart__canvas" ref={ref}>
          {canRenderChart ? (
            <BarChart
              data={rows}
              height={size.height}
              layout="vertical"
              margin={{ top: 6, right: 18, bottom: 0, left: 0 }}
              width={size.width}
              barCategoryGap={10}
              barGap={8}
            >
              <CartesianGrid horizontal={false} stroke="var(--color-border-standard)" strokeDasharray="3 3" opacity={0.35} />
              <XAxis axisLine={false} dataKey="count" hide tickLine={false} type="number" />
              <YAxis
                axisLine={false}
                dataKey="label"
                interval={0}
                tickLine={false}
                type="category"
                width={112}
                tick={{ fill: "var(--muted)" }}
              />
              <Bar dataKey="count" radius={[0, 999, 999, 0]} barSize={14}>
                {rows.map((entry) => (
                  <Cell fill={GEMINI_LIVE_CYCLE_COLORS[entry.status] ?? "var(--muted)"} key={entry.status} />
                ))}
                <LabelList
                  dataKey="count"
                  fill="var(--text-strong)"
                  formatter={(value) => formatCount(Number(value))}
                  position="right"
                />
              </Bar>
            </BarChart>
          ) : null}
        </div>
        <div className="dashboard-analysis-chart__footer">
          <GeminiLiveCycleLegend rows={rows} />
        </div>
      </div>
    </div>
  );
}
