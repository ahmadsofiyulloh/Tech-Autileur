"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import type { TooltipContentProps } from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a ChartContainer.");
  }

  return context;
}

function ChartStyle({ config, id }: { config: ChartConfig; id: string }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
[data-chart="${id}"] {
${colorConfig.map(([key, item]) => `  --color-${key}: ${item.color};`).join("\n")}
}
`,
      }}
    />
  );
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
    config: ChartConfig;
  }
>(({ children, className, config, id, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div className={cn("chart-container", className)} data-chart={chartId} ref={ref} {...props}>
        <ChartStyle config={config} id={chartId} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipPayloadItem = NonNullable<TooltipContentProps["payload"]>[number];

type ChartTooltipContentProps = React.ComponentProps<"div"> &
  Partial<Pick<TooltipContentProps, "active" | "label" | "payload">> & {
    hideIndicator?: boolean;
    hideLabel?: boolean;
    labelKey?: string;
    nameKey?: string;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPayloadRecord(item: TooltipPayloadItem) {
  return isRecord(item.payload) ? item.payload : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getPayloadKey(item: TooltipPayloadItem, nameKey?: string) {
  const record = readPayloadRecord(item);
  const keyedName = nameKey && record ? readString(record[nameKey]) : null;

  return keyedName ?? readString(item.name) ?? readString(item.dataKey) ?? null;
}

function getPayloadColor(item: TooltipPayloadItem) {
  const record = readPayloadRecord(item);
  return readString(record?.fill) ?? readString(item.color) ?? readString(item.fill) ?? "var(--color-primary)";
}

function formatTooltipValue(value: unknown) {
  return typeof value === "number" ? value.toLocaleString("id-ID") : `${value ?? ""}`;
}

function ChartTooltipContent({
  active,
  className,
  hideIndicator = false,
  hideLabel = false,
  label,
  labelKey,
  nameKey,
  payload,
  ...props
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  const firstPayload = payload[0];
  const firstRecord = readPayloadRecord(firstPayload);
  const labelConfigKey = labelKey && firstRecord ? readString(firstRecord[labelKey]) : readString(label);
  const labelValue = labelConfigKey ? config[labelConfigKey]?.label ?? labelConfigKey : label;

  return (
    <div className={cn("chart-tooltip", className)} {...props}>
      {!hideLabel && labelValue ? <div className="chart-tooltip__label">{labelValue}</div> : null}
      <div className="chart-tooltip__items">
        {payload.map((item, index) => {
          const key = getPayloadKey(item, nameKey);
          const itemConfig = key ? config[key] : undefined;
          const indicatorColor = getPayloadColor(item);

          return (
            <div className="chart-tooltip__item" key={`${key ?? item.dataKey ?? "value"}-${index}`}>
              {!hideIndicator ? (
                <span className="chart-tooltip__indicator" style={{ backgroundColor: indicatorColor }} />
              ) : null}
              <span className="chart-tooltip__name">{itemConfig?.label ?? key ?? item.name}</span>
              <span className="chart-tooltip__value">{formatTooltipValue(item.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
