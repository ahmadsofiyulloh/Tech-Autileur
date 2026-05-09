"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ChevronLeft, ChevronRight } from "lucide-react";
import { Label, Pie, PieChart } from "recharts";
import { EmptyState } from "@/components/operator/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { NativeButton } from "@/components/ui/native-button";
import type { GeminiUsageCard, GeminiUsageMetric, GeminiUsageOverview } from "@/lib/gemini/usage-types";

type GeminiUsageOverviewPanelProps = {
  overview: GeminiUsageOverview;
  sectionId?: string;
};

type MetricEntry = {
  key: "rpd" | "rpm" | "tpm";
  metric: GeminiUsageMetric;
};

const numberFormatter = new Intl.NumberFormat("id-ID");

const quotaChartConfig = {
  value: {
    label: "Usage",
  },
  rpd: {
    label: "RPD",
    color: "var(--chart-1)",
  },
  rpm: {
    label: "RPM",
    color: "var(--chart-2)",
  },
  tpm: {
    label: "TPM",
    color: "var(--chart-3)",
  },
  empty: {
    label: "Kosong",
    color: "var(--chart-empty)",
  },
} satisfies ChartConfig;

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatRole(value: string) {
  return value.replaceAll("_", " ");
}

function buildMetricEntries(card: GeminiUsageCard): MetricEntry[] {
  return [
    { key: "rpd", metric: card.rpd },
    { key: "rpm", metric: card.rpm },
    { key: "tpm", metric: card.tpm },
  ];
}

function metricPercent(metric: GeminiUsageMetric) {
  return metric.percent ?? 0;
}

function peakMetric(entries: MetricEntry[]) {
  return entries.reduce((current, entry) => (metricPercent(entry.metric) > metricPercent(current.metric) ? entry : current));
}

function metricCopy(metric: GeminiUsageMetric) {
  if (metric.limit === null) {
    return `${formatNumber(metric.used)} / -`;
  }

  return `${formatNumber(metric.used)} / ${formatNumber(metric.limit)}`;
}

function buildChartData(entries: MetricEntry[]) {
  const slices = entries
    .map((entry) => ({
      quota: entry.key,
      value: metricPercent(entry.metric),
      fill: `var(--color-${entry.key})`,
    }))
    .filter((entry) => entry.value > 0);

  return slices.length ? slices : [{ quota: "empty", value: 1, fill: "var(--color-empty)" }];
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

function GeminiUsageDonut({ entries }: { entries: MetricEntry[] }) {
  const chartData = useMemo(() => buildChartData(entries), [entries]);
  const peak = useMemo(() => peakMetric(entries), [entries]);
  const peakPercent = peak.metric.percent;
  const centerValue = peakPercent === null ? "-" : `${peakPercent}%`;
  const { ref, size } = useElementSize<HTMLDivElement>();
  const canRenderChart = size.width > 0 && size.height > 0;

  return (
    <ChartContainer config={quotaChartConfig} className="gemini-usage-donut" ref={ref}>
      {canRenderChart ? (
        <PieChart width={size.width} height={size.height}>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="quota"
            innerRadius="50%"
            outerRadius="92%"
            paddingAngle={1}
            rootTabIndex={-1}
            strokeWidth={3}
          >
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text dominantBaseline="middle" textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                      <tspan className="gemini-usage-donut__value" x={viewBox.cx} y={viewBox.cy}>
                        {centerValue}
                      </tspan>
                      <tspan className="gemini-usage-donut__label" x={viewBox.cx} y={(viewBox.cy || 0) + 22}>
                        {peak.metric.label}
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </Pie>
        </PieChart>
      ) : null}
    </ChartContainer>
  );
}

function MetricRow({ entry }: { entry: MetricEntry }) {
  const percent = entry.metric.percent;

  return (
    <div className="gemini-usage-metric-row">
      <span className={`gemini-usage-metric-row__dot gemini-usage-metric-row__dot--${entry.key}`} aria-hidden="true" />
      <span className="gemini-usage-metric-row__label">{entry.metric.label}</span>
      <span className="gemini-usage-metric-row__value">{metricCopy(entry.metric)}</span>
      <span className="gemini-usage-metric-row__meta">{percent === null ? "-" : `${percent}%`}</span>
    </div>
  );
}

function GeminiUsageCardView({ card }: { card: GeminiUsageCard }) {
  const entries = useMemo(() => buildMetricEntries(card), [card]);

  return (
    <Card className="gemini-usage-card">
      <CardContent className="gemini-usage-card__content">
        <div className="gemini-usage-card__chart" aria-label={`Penggunaan ${card.label}`}>
          <GeminiUsageDonut entries={entries} />
        </div>

        <div className="gemini-usage-context">
          <div className="gemini-usage-context__header">
            <div className="stack-tight">
              <strong>{card.label}</strong>
              <span>{card.modelName}</span>
              <span>{card.status}</span>
              <span>{formatRole(card.role)}</span>
            </div>
          </div>

          <div className="gemini-usage-metrics">
            {entries.map((entry) => (
              <MetricRow entry={entry} key={entry.key} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function GeminiUsageOverviewPanel({ overview, sectionId }: GeminiUsageOverviewPanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const cards = overview.cards;
  const hasCarousel = cards.length > 1;

  useEffect(() => {
    if (activeIndex >= cards.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, cards.length]);

  function scrollToIndex(index: number) {
    const viewport = viewportRef.current;
    const nextIndex = Math.max(0, Math.min(index, cards.length - 1));

    setActiveIndex(nextIndex);

    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      left: viewport.clientWidth * nextIndex,
      behavior: "smooth",
    });
  }

  function goPrevious() {
    if (!cards.length) {
      return;
    }

    scrollToIndex((activeIndex - 1 + cards.length) % cards.length);
  }

  function goNext() {
    if (!cards.length) {
      return;
    }

    scrollToIndex((activeIndex + 1) % cards.length);
  }

  function handleCarouselScroll() {
    const viewport = viewportRef.current;

    if (!viewport || !viewport.clientWidth) {
      return;
    }

    const nextIndex = Math.round(viewport.scrollLeft / viewport.clientWidth);

    if (nextIndex !== activeIndex && nextIndex >= 0 && nextIndex < cards.length) {
      setActiveIndex(nextIndex);
    }
  }

  return (
    <section className="gemini-usage-overview" id={sectionId} aria-label="Penggunaan Gemini">
      <div className="gemini-usage-overview__header">
        <h2>Penggunaan Gemini</h2>
        <span>{cards.length} key</span>
      </div>

      {!cards.length ? (
        <EmptyState
          icon={Archive}
          title={overview.unavailableMessage ? "Penggunaan Gemini belum tersedia." : "Belum ada Gemini key."}
          description={
            overview.unavailableMessage ? overview.unavailableMessage : "Tambahkan key agar carousel usage muncul di dashboard."
          }
        />
      ) : (
        <div className="gemini-usage-carousel" data-carousel={hasCarousel ? "true" : "false"}>
          {hasCarousel ? (
            <NativeButton
              className="compact tertiary gemini-usage-carousel__button"
              type="button"
              onClick={goPrevious}
              aria-label="Gemini key sebelumnya"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </NativeButton>
          ) : null}

          <div className="gemini-usage-carousel__viewport" ref={viewportRef} onScroll={handleCarouselScroll}>
            <div className="gemini-usage-carousel__track">
              {cards.map((card) => (
                <div className="gemini-usage-carousel__slide" key={card.id}>
                  <GeminiUsageCardView card={card} />
                </div>
              ))}
            </div>
          </div>

          {hasCarousel ? (
            <NativeButton
              className="compact tertiary gemini-usage-carousel__button"
              type="button"
              onClick={goNext}
              aria-label="Gemini key berikutnya"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </NativeButton>
          ) : null}
        </div>
      )}

      {hasCarousel ? (
        <div className="gemini-usage-dots" aria-label="Gemini key">
          {cards.map((card, index) => (
            <button
              aria-label={card.label}
              aria-pressed={index === activeIndex}
              className="gemini-usage-dot"
              key={card.id}
              type="button"
              onClick={() => scrollToIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
