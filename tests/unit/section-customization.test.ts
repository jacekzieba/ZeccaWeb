import { describe, expect, it, beforeEach } from "vitest";
import { LayoutDashboard } from "lucide-react";
import {
  defaultConfig,
  readConfig,
  saveConfig,
  mixHex,
  reorderVisibleSection,
  reorderVisibleSectionTo,
  type SectionRegistry,
} from "@/components/customize/section-customization";

type Id = "a" | "b" | "c";

const registry: SectionRegistry<Id> = {
  storageKey: "test.sections.v1",
  categoryOrder: ["g1", "g2"],
  categories: [
    { id: "g1", label: "G1", desc: "", icon: LayoutDashboard },
    { id: "g2", label: "G2", desc: "", icon: LayoutDashboard },
  ],
  sections: [
    { id: "a", label: "A", desc: "", category: "g1", icon: LayoutDashboard, sizePresets: [{ width: 1 }, { width: 2 }] },
    { id: "b", label: "B", desc: "", category: "g1", icon: LayoutDashboard, sizePresets: [{ width: 4 }, { width: 2 }] },
    { id: "c", label: "C", desc: "", category: "g2", icon: LayoutDashboard, sizePresets: [{ width: 3 }] },
  ],
};

beforeEach(() => {
  const store: Record<string, string> = {};
  const mock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => { delete store[k]; }); },
  };
  Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
});

describe("section-customization", () => {
  it("defaultConfig exposes every section, ordered, with first-preset sizes", () => {
    const cfg = defaultConfig(registry);
    expect(cfg.sectionOrder).toEqual(["a", "b", "c"]);
    expect(cfg.visibleSections).toEqual(["a", "b", "c"]);
    expect(cfg.sectionSizes).toEqual({ a: { width: 1 }, b: { width: 4 }, c: { width: 3 } });
    expect(cfg.knownSections).toEqual(["a", "b", "c"]);
  });

  it("readConfig returns defaults when storage is empty", () => {
    expect(readConfig(registry)).toEqual(defaultConfig(registry));
  });

  it("readConfig drops unknown ids and back-fills missing ones in order", () => {
    window.localStorage.setItem(registry.storageKey, JSON.stringify({
      sectionOrder: ["c", "zzz", "a"],
      visibleSections: ["c", "a"],
      sectionSizes: {},
      knownSections: ["a", "b", "c"],
    }));
    const cfg = readConfig(registry);
    expect(cfg.sectionOrder).toEqual(["c", "a", "b"]);
    expect(cfg.visibleSections).toEqual(["c", "a"]);
  });

  it("readConfig coerces an out-of-preset size to the section default", () => {
    window.localStorage.setItem(registry.storageKey, JSON.stringify({
      sectionOrder: ["a", "b", "c"],
      visibleSections: ["a", "b", "c"],
      sectionSizes: { a: { width: 4, height: 3 }, b: { width: 2 } },
      knownSections: ["a", "b", "c"],
    }));
    const cfg = readConfig(registry);
    expect(cfg.sectionSizes.a).toEqual({ width: 1 }); // 4 not a preset for "a" -> default; height stripped
    expect(cfg.sectionSizes.b).toEqual({ width: 2 }); // 2 is a valid preset for "b"
  });

  it("readConfig accepts the legacy array-only shape as visibleSections", () => {
    window.localStorage.setItem(registry.storageKey, JSON.stringify(["a", "b"]));
    const cfg = readConfig(registry);
    expect(cfg.visibleSections).toEqual(["a", "b"]);
    expect(cfg.sectionOrder).toEqual(["a", "b", "c"]);
  });

  it("readConfig surfaces sections shipped after the saved config exactly once", () => {
    window.localStorage.setItem(registry.storageKey, JSON.stringify({
      sectionOrder: ["a", "b"],
      visibleSections: ["a"],
      sectionSizes: {},
      knownSections: ["a", "b"], // "c" shipped later
    }));
    const cfg = readConfig(registry);
    expect(cfg.visibleSections).toEqual(["a", "c"]);
  });

  it("saveConfig round-trips through readConfig", () => {
    const cfg = { ...defaultConfig(registry), visibleSections: ["a", "c"] as Id[] };
    saveConfig(registry, cfg);
    expect(readConfig(registry).visibleSections).toEqual(["a", "c"]);
  });

  it("reorderVisibleSection moves a section across category boundaries", () => {
    // a,b are g1; c is g2. Moving b down past c puts a g1 item below a g2 item.
    expect(reorderVisibleSection(["a", "b", "c"], ["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(reorderVisibleSection(["a", "b", "c"], ["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
  });

  it("reorderVisibleSection skips hidden sections so the visible order shifts by one", () => {
    // b is hidden: moving a "down" should swap with the next VISIBLE section (c).
    expect(reorderVisibleSection(["a", "b", "c"], ["a", "c"], "a", 1)).toEqual(["c", "b", "a"]);
  });

  it("reorderVisibleSection is a no-op at the visible edges", () => {
    expect(reorderVisibleSection(["a", "b", "c"], ["a", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(reorderVisibleSection(["a", "b", "c"], ["a", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });

  it("reorderVisibleSectionTo moves a section before or after a target", () => {
    expect(reorderVisibleSectionTo(["a", "b", "c"], ["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"]);
    expect(reorderVisibleSectionTo(["a", "b", "c"], ["a", "b", "c"], "a", "c", "after")).toEqual(["b", "c", "a"]);
  });

  it("reorderVisibleSectionTo keeps hidden sections in their stored slots", () => {
    expect(reorderVisibleSectionTo(["a", "b", "c"], ["a", "c"], "c", "a", "before")).toEqual(["c", "b", "a"]);
  });

  it("mixHex turns a hex + alpha into rgba", () => {
    expect(mixHex("#161D18", 0.05)).toBe("rgba(22,29,24,0.05)");
  });
});
