"use client";

import { token } from "@/design/tokens";
import {
  ArcElement,
  Chart as ChartJS,
  Legend,
  Tooltip,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import type { AllocationSlice } from "@/domain/models/investor-data";

ChartJS.register(ArcElement, Tooltip, Legend);

const palette = ["#176b4d", "#2f5f8f", "#a35d00", "#6c5a49", "#8b4d6b"];

export function AllocationChart({ slices }: { slices: AllocationSlice[] }) {
  return (
    <Doughnut
      data={{
        labels: slices.map((slice) => slice.label),
        datasets: [
          {
            data: slices.map((slice) => slice.percent),
            backgroundColor: palette,
            borderColor: token("surface"),
            borderWidth: 3,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              color: "#445148",
              font: { size: 12 },
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${context.parsed}%`,
            },
          },
        },
      }}
    />
  );
}
