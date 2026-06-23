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
}: {
  orderedVisibleSections: Id[];
  sizeOf: (id: Id) => SectionSize;
  renderSection: (id: Id) => ReactNode;
  isMobile: boolean;
  isTablet: boolean;
  testIdPrefix: string;
  gap?: number;
}) {
  const single = isMobile || isTablet;
  return (
    <div
      data-testid={`${testIdPrefix}-grid`}
      style={{
        display: "grid",
        gridTemplateColumns: single ? "1fr" : "repeat(4, minmax(0, 1fr))",
        gridAutoRows: "auto",
        gap,
        alignItems: "stretch",
      }}
    >
      {orderedVisibleSections.map((id) => {
        const size = sizeOf(id);
        return (
          <div
            key={id}
            data-testid={`${testIdPrefix}-section-${id}`}
            style={{
              gridColumn: single ? "1 / -1" : `span ${size.width}`,
              height: single ? "auto" : "100%",
              minHeight: 0,
              minWidth: 0,
            }}
          >
            {renderSection(id)}
          </div>
        );
      })}
    </div>
  );
}
