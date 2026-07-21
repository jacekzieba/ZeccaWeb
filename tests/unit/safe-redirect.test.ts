import { describe, expect, it } from "vitest";
import { safeRelativePath } from "@/lib/safe-redirect";

describe("safeRelativePath", () => {
  it("passes through safe same-origin relative paths", () => {
    expect(safeRelativePath("/dashboard")).toBe("/dashboard");
    expect(safeRelativePath("/reset-password")).toBe("/reset-password");
    expect(safeRelativePath("/path?x=1")).toBe("/path?x=1");
  });

  it("falls back for protocol-relative and control-char bypass attempts", () => {
    expect(safeRelativePath("//evil.com")).toBe("/dashboard");
    // Backslash folds to `/` in URL parsers → `//evil.com`.
    expect(safeRelativePath("/\\evil.com")).toBe("/dashboard");
    // Tab is stripped by URL parsers → `///evil.com` → protocol-relative.
    expect(safeRelativePath("/\t//evil.com")).toBe("/dashboard");
    expect(safeRelativePath("https://evil.com")).toBe("/dashboard");
  });

  it("falls back for empty and nullish input", () => {
    expect(safeRelativePath(null)).toBe("/dashboard");
    expect(safeRelativePath("")).toBe("/dashboard");
  });
});
