"use client";

import { token } from "@/design/tokens";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { ValuationPoint } from "@/domain/models/investor-data";
import { formatCurrencyCompact } from "@/lib/money";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

export function PortfolioValueChart({ points }: { points: ValuationPoint[] }) {
  return (
    <Line
      data={{
        labels: points.map((point) => point.label),
        datasets: [
          {
            label: "Wartość portfela",
            data: points.map((point) => point.value),
            borderColor: "#176b4d",
            backgroundColor: "rgb(23 107 77 / 0.12)",
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.32,
            fill: true,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) =>
                formatCurrencyCompact(Number(context.parsed.y), "PLN"),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: token("inkMuted"), font: { size: 11 } },
          },
          y: {
            border: { display: false },
            grid: { color: "rgb(23 32 28 / 0.08)" },
            ticks: {
              color: token("inkMuted"),
              font: { size: 11 },
              callback: (value) => formatCurrencyCompact(Number(value), "PLN"),
            },
          },
        },
      }}
    />
  );
}
