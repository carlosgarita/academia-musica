"use client";

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from "recharts";

function getGaugeColor(percent: number): string {
  if (percent >= 80) return "#22c55e"; // green
  if (percent >= 50) return "#ea580c"; // orange
  if (percent >= 20) return "#f97316"; // orange lighter
  if (percent > 0) return "#ef4444"; // red
  return "#9ca3af"; // gray (sin evaluar)
}

export function GaugeChart({
  value,
  label,
  scaleName,
}: {
  value: number;
  label: string;
  scaleName: string;
}) {
  const fillColor = getGaugeColor(value);
  const clampedValue = Math.min(100, Math.max(0, value));
  const data = [{ value: clampedValue, fill: fillColor }];

  return (
    <div className="flex flex-col items-center min-w-[120px]">
      <ResponsiveContainer width={100} height={100}>
        <RadialBarChart
          data={data}
          startAngle={612}
          endAngle={288}
          innerRadius="60%"
          outerRadius="95%"
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={10}
            background={{ fill: "#e5e7eb" }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <p className="text-sm font-semibold text-gray-900 mt-1 text-center px-2">
        {label}
      </p>
      <p className="text-xs font-medium text-gray-600 mt-2 text-center w-full break-words px-1">
        {scaleName}
      </p>
    </div>
  );
}
