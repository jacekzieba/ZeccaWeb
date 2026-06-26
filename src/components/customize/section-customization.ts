"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

export type SectionSize = { width: 1 | 2 | 3 | 4 };
export type SectionCategory = { id: string; label: string; desc: string; icon: LucideIcon };
export type SectionDef<Id extends string> = {
  id: Id;
  label: string;
  desc: string;
  category: string;
  icon: LucideIcon;
  sizePresets: SectionSize[];
};
export type SectionRegistry<Id extends string> = {
  storageKey: string;
  sections: SectionDef<Id>[];
  categories: SectionCategory[];
  categoryOrder: string[];
};
export type SectionConfig<Id extends string> = {
  sectionOrder: Id[];
  visibleSections: Id[];
  sectionSizes: Partial<Record<Id, SectionSize>>;
  knownSections: Id[];
};
export type SectionDropPlacement = "before" | "after";

export function mixHex(hex: string, pct: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${pct})`;
}

function allIds<Id extends string>(registry: SectionRegistry<Id>): Id[] {
  return registry.sections.map((section) => section.id);
}

/** Moves `id` one slot up (`-1`) or down (`1`) within the subsequence of
 * VISIBLE sections, skipping hidden ones. Returns a new order array; the two
 * swapped ids exchange slots so every other section (visible or hidden) stays
 * put. No-op when `id` is already at the visible edge in that direction. */
export function reorderVisibleSection<Id extends string>(
  order: Id[],
  visible: Id[],
  id: Id,
  dir: -1 | 1,
): Id[] {
  const visibleSet = new Set<Id>(visible);
  const index = order.indexOf(id);
  if (index < 0) return order;
  let target = index + dir;
  while (target >= 0 && target < order.length && !visibleSet.has(order[target])) {
    target += dir;
  }
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function reorderVisibleSectionTo<Id extends string>(
  order: Id[],
  visible: Id[],
  id: Id,
  targetId: Id,
  placement: SectionDropPlacement,
): Id[] {
  if (id === targetId) return order;
  const visibleSet = new Set<Id>(visible);
  if (!visibleSet.has(id) || !visibleSet.has(targetId)) return order;

  const visibleOrder = order.filter((sectionId) => visibleSet.has(sectionId));
  if (!visibleOrder.includes(id) || !visibleOrder.includes(targetId)) return order;

  const nextVisibleOrder = visibleOrder.filter((sectionId) => sectionId !== id);
  const targetIndex = nextVisibleOrder.indexOf(targetId);
  if (targetIndex < 0) return order;

  nextVisibleOrder.splice(placement === "before" ? targetIndex : targetIndex + 1, 0, id);
  if (nextVisibleOrder.every((sectionId, index) => sectionId === visibleOrder[index])) return order;

  let visibleIndex = 0;
  return order.map((sectionId) => (
    visibleSet.has(sectionId) ? nextVisibleOrder[visibleIndex++] : sectionId
  ));
}

export function defaultSizes<Id extends string>(registry: SectionRegistry<Id>): Record<Id, SectionSize> {
  return Object.fromEntries(
    registry.sections.map((section) => [section.id, section.sizePresets[0]]),
  ) as Record<Id, SectionSize>;
}

export function defaultConfig<Id extends string>(registry: SectionRegistry<Id>): SectionConfig<Id> {
  const ids = allIds(registry);
  return {
    sectionOrder: [...ids],
    visibleSections: [...ids],
    sectionSizes: defaultSizes(registry),
    knownSections: [...ids],
  };
}

function sanitizeOrder<Id extends string>(registry: SectionRegistry<Id>, value: unknown): Id[] {
  const ids = allIds(registry);
  const allowed = new Set<string>(ids);
  const source = Array.isArray(value) ? value : ids;
  const order = source.filter((item): item is Id => typeof item === "string" && allowed.has(item));
  const missing = ids.filter((id) => !order.includes(id));
  return [...order, ...missing];
}

function sanitizeVisible<Id extends string>(registry: SectionRegistry<Id>, value: unknown): Id[] {
  const ids = allIds(registry);
  const allowed = new Set<string>(ids);
  const visible = Array.isArray(value)
    ? value.filter((item): item is Id => typeof item === "string" && allowed.has(item))
    : ids;
  return visible.length > 0 ? visible : [...ids];
}

function sanitizeSizes<Id extends string>(
  registry: SectionRegistry<Id>,
  value: unknown,
): Record<Id, SectionSize> {
  const fallback = defaultSizes(registry);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const result = {} as Record<Id, SectionSize>;
  for (const section of registry.sections) {
    const raw = (value as Record<string, unknown>)[section.id];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const width = (raw as Record<string, unknown>).width;
      const match = section.sizePresets.find((preset) => preset.width === width);
      result[section.id] = match ?? fallback[section.id];
    } else {
      result[section.id] = fallback[section.id];
    }
  }
  return result;
}

export function readConfig<Id extends string>(registry: SectionRegistry<Id>): SectionConfig<Id> {
  if (typeof window === "undefined") return defaultConfig(registry);
  try {
    const raw = window.localStorage.getItem(registry.storageKey);
    if (!raw) return defaultConfig(registry);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { ...defaultConfig(registry), visibleSections: sanitizeVisible(registry, parsed) };
    }
    if (!parsed || typeof parsed !== "object") return defaultConfig(registry);
    const config = parsed as Record<string, unknown>;
    const ids = allIds(registry);
    const sectionOrder = sanitizeOrder(registry, config.sectionOrder);
    const visible = sanitizeVisible(registry, config.visibleSections);
    const isKnownId = (id: unknown): id is Id => typeof id === "string" && (ids as string[]).includes(id);
    const known = (
      Array.isArray(config.knownSections)
        ? config.knownSections
        : Array.isArray(config.sectionOrder)
          ? config.sectionOrder
          : []
    ).filter(isKnownId);
    const newlyShipped = ids.filter((id) => !known.includes(id) && !visible.includes(id));
    return {
      sectionOrder,
      visibleSections: [...visible, ...newlyShipped],
      sectionSizes: sanitizeSizes(registry, config.sectionSizes),
      knownSections: [...ids],
    };
  } catch {
    return defaultConfig(registry);
  }
}

export function saveConfig<Id extends string>(registry: SectionRegistry<Id>, config: SectionConfig<Id>) {
  try {
    window.localStorage.setItem(
      registry.storageKey,
      JSON.stringify({
        sectionOrder: sanitizeOrder(registry, config.sectionOrder),
        visibleSections: sanitizeVisible(registry, config.visibleSections),
        sectionSizes: sanitizeSizes(registry, config.sectionSizes),
        knownSections: allIds(registry),
      }),
    );
  } catch {
    // Local UI preference only; ignore storage failures.
  }
}

export function useSectionCustomization<Id extends string>(registry: SectionRegistry<Id>) {
  const [config, setConfig] = useState<SectionConfig<Id>>(() => readConfig(registry));

  useEffect(() => {
    saveConfig(registry, config);
    // registry is a stable module-level constant, not a per-render object, so
    // keying on registry.storageKey (not the whole registry reference) prevents
    // spurious re-saves when callers pass an inline registry whose identity
    // changes each render while the storage key stays the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, registry.storageKey]);

  const toggle = (id: Id) =>
    setConfig((current) => {
      const visible = new Set(current.visibleSections);
      if (visible.has(id)) visible.delete(id);
      else visible.add(id);
      if (visible.size === 0) return current;
      return { ...current, visibleSections: current.sectionOrder.filter((s) => visible.has(s)) };
    });

  // Reorders within the visible subsequence (skipping hidden sections), so the
  // flat "Układ" list can move a section across category boundaries.
  const reorder = (id: Id, dir: -1 | 1) =>
    setConfig((current) => ({
      ...current,
      sectionOrder: reorderVisibleSection(
        current.sectionOrder,
        current.visibleSections,
        id,
        dir,
      ),
    }));

  const reorderTo = (id: Id, targetId: Id, placement: SectionDropPlacement) =>
    setConfig((current) => ({
      ...current,
      sectionOrder: reorderVisibleSectionTo(
        current.sectionOrder,
        current.visibleSections,
        id,
        targetId,
        placement,
      ),
    }));

  const resize = (id: Id, size: SectionSize) =>
    setConfig((current) => ({ ...current, sectionSizes: { ...current.sectionSizes, [id]: size } }));

  const reset = () => setConfig(defaultConfig(registry));

  return { config, toggle, reorder, reorderTo, resize, reset };
}
