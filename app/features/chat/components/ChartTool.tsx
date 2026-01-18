// /app/features/chat/components/ChartTool.tsx
"use client";

import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

/** Tooltip payload entry from recharts */
interface TooltipPayloadEntry {
  name: string;
  value: number | string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-(--surface) border border-(--border) p-3 rounded-lg shadow-xl backdrop-blur-md">
        <p className="font-bold text-(--text-primary) mb-1">{label}</p>
        {payload.map((entry: TooltipPayloadEntry, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/** Chart data point */
interface ChartDataPoint {
  [key: string]: string | number;
}

interface ChartToolProps {
  type: string;
  chartType?: string;
  title?: string;
  data: ChartDataPoint[];
  xKey: string;
  yKeys: string[];
  colors?: string[];
}

export default function ChartTool({
  type,
  chartType,
  title,
  data,
  xKey,
  yKeys,
  colors = COLORS,
}: ChartToolProps) {
  // Backend sends type="chart" and chartType="bar"
  // We need to resolve the actual visualization type
  const vizType = type === "chart" && chartType ? chartType : type;

  // Common chart props
  const commonProps = {
    data: data,
    margin: { top: 10, right: 30, left: 0, bottom: 0 },
  };

  const AxisProps = {
    stroke: "var(--text-secondary)",
    fontSize: 12,
    tickLine: false,
    axisLine: false,
  };

  const renderChart = () => {
    switch (vizType) {
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey={xKey} {...AxisProps} />
            <YAxis {...AxisProps} />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "var(--surface-muted)", opacity: 0.2 }}
            />
            <Legend wrapperStyle={{ paddingTop: "10px" }} />
            {yKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
                radius={[4, 4, 0, 0]}
                animationDuration={1500}
              />
            ))}
          </BarChart>
        );

      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey={xKey} {...AxisProps} />
            <YAxis {...AxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: "10px" }} />
            {yKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
                animationDuration={1500}
              />
            ))}
          </LineChart>
        );

      case "area":
        return (
          <AreaChart {...commonProps}>
            <defs>
              {yKeys.map((key, index) => (
                <linearGradient
                  key={`gradient-${key}`}
                  id={`color${key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey={xKey} {...AxisProps} />
            <YAxis {...AxisProps} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: "10px" }} />
            {yKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                fillOpacity={1}
                fill={`url(#color${key})`}
                animationDuration={1500}
              />
            ))}
          </AreaChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              fill="#8884d8"
              paddingAngle={5}
              dataKey={yKeys[0]} // Pie usually takes one value key
              nameKey={xKey} // And one name key
              animationDuration={1500}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                  stroke="var(--surface)"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        );

      default:
        return null;
    }
  };

  const chartContent = renderChart();

  if (!chartContent) {
    return (
      <div className="w-full max-w-2xl mx-auto my-4 bg-(--surface-muted)/30 border border-red-500/20 rounded-xl p-4 text-center text-red-400">
        Unsupported chart type: {vizType || type}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto my-4 bg-(--surface-muted)/30 border border-(--border) rounded-xl p-4 shadow-sm backdrop-blur-sm overflow-hidden">
      {title && (
        <h3 className="text-lg font-bold text-(--text-primary) mb-4 text-center">{title}</h3>
      )}
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartContent}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
