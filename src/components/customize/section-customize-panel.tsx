"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import {
  mixHex,
  type SectionConfig,
  type SectionRegistry,
  type SectionSize,
} from "@/components/customize/section-customization";

export type SectionPanelTheme = {
  card: string;   // #rrggbb
  ink: string;    // #rrggbb
  brand: string;  // #rrggbb
  muted: string;
  subtle: string;
  line: string;
  fontUi: string;
  fontSerif: string;
  fontMono: string;
};

function widthLabel(width: number) {
  if (width === 1) return "1 kolumna";
  if (width < 5) return `${width} kolumny`;
  return `${width} kolumn`;
}

function smallControlStyle(disabled: boolean, theme: SectionPanelTheme) {
  return {
    border: `0.5px solid ${theme.line}`,
    borderRadius: 8,
    background: theme.card,
    color: disabled ? mixHex(theme.ink, 0.25) : theme.ink,
    cursor: disabled ? "not-allowed" : "pointer",
    padding: "5px 7px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  } as const;
}

export function SectionCustomizePanel<Id extends string>({
  registry,
  config,
  visibleSections,
  onToggle,
  onMove,
  onResize,
  onReset,
  theme,
  eyebrow,
  title,
  subtitle,
}: {
  registry: SectionRegistry<Id>;
  config: SectionConfig<Id>;
  visibleSections: Set<Id>;
  onToggle: (id: Id) => void;
  onMove: (id: Id, dir: -1 | 1) => void;
  onResize: (id: Id, size: SectionSize) => void;
  onReset: () => void;
  theme: SectionPanelTheme;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  const categoryPanelId = useId();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const sectionById = Object.fromEntries(registry.sections.map((s) => [s.id, s])) as Record<Id, (typeof registry.sections)[number]>;
  const categoryById = Object.fromEntries(registry.categories.map((c) => [c.id, c]));
  const grouped = registry.categoryOrder
    .map((categoryId) => ({
      categoryId,
      sections: config.sectionOrder.filter((id) => sectionById[id]?.category === categoryId),
    }))
    .filter((group) => group.sections.length > 0);
  const toggleCategory = (categoryId: string) =>
    setExpandedCategories((current) => ({ ...current, [categoryId]: !current[categoryId] }));

  return (
    <div
      style={{
        background: theme.card,
        border: `0.5px solid ${theme.line}`,
        borderRadius: 16,
        padding: 22,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: theme.fontUi, fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: theme.subtle }}>
            {eyebrow}
          </div>
          <div style={{ fontFamily: theme.fontSerif, fontSize: 19, fontWeight: 500, color: theme.ink, marginTop: 3 }}>{title}</div>
          <div style={{ fontFamily: theme.fontUi, fontSize: 12, color: theme.muted, marginTop: 3 }}>{subtitle}</div>
        </div>
        <button
          type="button"
          onClick={onReset}
          style={{
            border: `0.5px solid ${theme.line}`,
            borderRadius: 9,
            background: theme.card,
            color: theme.ink,
            cursor: "pointer",
            fontFamily: theme.fontUi,
            fontSize: 12,
            fontWeight: 700,
            padding: "7px 11px",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
          Przywróć domyślne
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {grouped.map(({ categoryId, sections }) => {
          const category = categoryById[categoryId];
          const CategoryIcon = category.icon;
          const expanded = expandedCategories[categoryId] ?? false;
          const visibleCount = sections.filter((id) => visibleSections.has(id)).length;
          const panelId = `${categoryPanelId}-${categoryId}`;
          return (
            <div key={categoryId} style={{ border: `0.5px solid ${theme.line}`, borderRadius: 12, background: mixHex(theme.ink, 0.014), overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => toggleCategory(categoryId)}
                aria-expanded={expanded}
                aria-controls={panelId}
                style={{
                  width: "100%",
                  border: 0,
                  background: expanded ? mixHex(theme.brand, 0.06) : "transparent",
                  color: theme.ink,
                  cursor: "pointer",
                  padding: "11px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                }}
              >
                <span style={{ width: 28, height: 28, borderRadius: 8, background: mixHex(theme.brand, 0.11), color: theme.brand, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                  <CategoryIcon size={15.5} strokeWidth={2} aria-hidden="true" />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontFamily: theme.fontUi, fontSize: 13, fontWeight: 800, color: theme.ink }}>{category.label}</span>
                  <span style={{ display: "block", fontFamily: theme.fontUi, fontSize: 11.5, color: theme.muted, marginTop: 2, lineHeight: 1.35 }}>{category.desc}</span>
                </span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 11, fontWeight: 700, color: theme.muted, background: theme.card, border: `0.5px solid ${theme.line}`, borderRadius: 999, padding: "3px 7px", whiteSpace: "nowrap" }}>
                  {visibleCount}/{sections.length}
                </span>
                {expanded ? <ChevronUp size={16} strokeWidth={2} aria-hidden="true" /> : <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />}
              </button>
              {expanded && (
                <div id={panelId} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 10px 10px" }}>
                  {sections.map((sectionId) => {
                    const section = sectionById[sectionId];
                    if (!section) return null;
                    const checked = visibleSections.has(sectionId);
                    const currentSize = config.sectionSizes[sectionId] ?? section.sizePresets[0];
                    const sectionIndex = config.sectionOrder.indexOf(sectionId);
                    const SectionIcon = section.icon;
                    return (
                      <div key={sectionId} style={{ border: `0.5px solid ${checked ? mixHex(theme.brand, 0.42) : theme.line}`, borderRadius: 11, background: checked ? mixHex(theme.brand, 0.055) : theme.card, padding: "11px 12px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <input type="checkbox" checked={checked} onChange={() => onToggle(sectionId)} aria-label={`Pokaż sekcję ${section.label}`} style={{ marginTop: 6 }} />
                          <span style={{ width: 26, height: 26, borderRadius: 8, background: checked ? mixHex(theme.brand, 0.12) : mixHex(theme.ink, 0.045), color: checked ? theme.brand : theme.muted, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                            <SectionIcon size={14.5} strokeWidth={2} aria-hidden="true" />
                          </span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontFamily: theme.fontUi, fontSize: 13, fontWeight: 700, color: theme.ink }}>{section.label}</div>
                                <div style={{ fontFamily: theme.fontUi, fontSize: 11.5, color: theme.muted, marginTop: 2, lineHeight: 1.35 }}>{section.desc}</div>
                              </div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button type="button" onClick={() => onMove(sectionId, -1)} disabled={sectionIndex === 0} aria-label={`Przesuń ${section.label} wyżej`} style={smallControlStyle(sectionIndex === 0, theme)}>
                                  <ArrowUp size={14} strokeWidth={2.1} aria-hidden="true" />
                                </button>
                                <button type="button" onClick={() => onMove(sectionId, 1)} disabled={sectionIndex === config.sectionOrder.length - 1} aria-label={`Przesuń ${section.label} niżej`} style={smallControlStyle(sectionIndex === config.sectionOrder.length - 1, theme)}>
                                  <ArrowDown size={14} strokeWidth={2.1} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                            <div role="radiogroup" aria-label={`Szerokość sekcji ${section.label}`} style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                              {section.sizePresets.map((preset) => {
                                const selected = currentSize.width === preset.width;
                                return (
                                  <button
                                    key={preset.width}
                                    type="button"
                                    role="radio"
                                    aria-checked={selected}
                                    onClick={() => onResize(sectionId, preset)}
                                    style={{ border: `0.5px solid ${selected ? mixHex(theme.brand, 0.48) : theme.line}`, borderRadius: 8, background: selected ? mixHex(theme.brand, 0.1) : theme.card, color: selected ? theme.brand : theme.muted, cursor: "pointer", fontFamily: theme.fontMono, fontSize: 11, fontWeight: 700, padding: "5px 8px" }}
                                  >
                                    {widthLabel(preset.width)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
