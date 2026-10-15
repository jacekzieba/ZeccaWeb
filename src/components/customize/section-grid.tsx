"use client";

import type { ReactNode } from "react";
import type { SectionSize } from "@/components/customize/section-customization";

export function SectionGrid<Id extends string>({
  orderedVisibleSections,
  sizeOf,
  renderSection,
  isMobile,
  isTablet,
  testIdPrefix,
  gap = 14,
  pairWidthOne = false,
}: {
  orderedVisibleSections: Id[];
  sizeOf: (id: Id) => SectionSize;
  renderSection: (id: Id) => ReactNode;
  isMobile: boolean;
  isTablet: boolean;
  testIdPrefix: string;
  gap?: number;
  /** Na wąskim ekranie sekcje o szerokości 1 (kafelki KPI) idą parami zamiast pojedynczo. */
  pairWidthOne?: boolean;
}) {
  const single = isMobile || isTablet;
  return (
    <div
      data-testid={`${testIdPrefix}-grid`}
      style={{
        display: "grid",
        gridTemplateColumns: single ? (pairWidthOne ? "repeat(2, minmax(0, 1fr))" : "1fr") : "repeat(4, minmax(0, 1fr))",
        gridAutoRows: "auto",
        // Gęste upakowanie: mniejsza sekcja wskakuje w lukę po szerokiej,
        // zamiast zostawiać dziurę w siatce 4-kolumnowej.
        gridAutoFlow: "row dense",
        gap,
        alignItems: "stretch",
      }}
    >
      {orderedVisibleSections.map((id) => {
        const rendered = renderSection(id);
        if (rendered == null) return null;
        const size = sizeOf(id);
        return (
          <div
            key={id}
            data-testid={`${testIdPrefix}-section-${id}`}
            style={{
              gridColumn: single
                ? pairWidthOne && size.width === 1 ? "span 1" : "1 / -1"
                : `span ${size.width}`,
              height: single ? "auto" : "100%",
              minHeight: 0,
              minWidth: 0,
            }}
          >
            {rendered}
          </div>
        );
      })}
    </div>
  );
}
