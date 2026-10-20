import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { LastSyncLabel } from "@/features/dashboard/dashboard-overview";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-16T10:00:00"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LastSyncLabel", () => {
  // Etykieta odświeża się sama — dashboard nie musi się przerysowywać co 30 s.
  it("sama aktualizuje czas od ostatniej synchronizacji", () => {
    const { container } = render(<LastSyncLabel lastSyncedAt={Date.now()} />);
    expect(container.textContent).toBe("Zsynchronizowano przed chwilą");

    act(() => {
      vi.advanceTimersByTime(3 * 60_000);
    });
    expect(container.textContent).toBe("Synchronizacja 3 min temu");
  });

  it("bez synchronizacji pokazuje brak", () => {
    const { container } = render(<LastSyncLabel lastSyncedAt={null} />);
    expect(container.textContent).toBe("Brak synchronizacji");
  });
});
