import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProfileMenu } from "@/components/layout/profile-menu";

afterEach(cleanup);

function renderMenu(onLogout = vi.fn()) {
  render(
    <ProfileMenu logoutLabel="Wyloguj się" onLogout={onLogout} size={34}>
      JZ
    </ProfileMenu>,
  );
  return onLogout;
}

describe("ProfileMenu", () => {
  it("awatar otwiera menu z przejściem do ustawień i wylogowaniem", () => {
    renderMenu();
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Profil" }));

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Ustawienia" }).getAttribute("href")).toBe("/settings");
    expect(screen.getByRole("menuitem", { name: "Wyloguj się" })).toBeTruthy();
  });

  it("„Wyloguj się” wylogowuje", () => {
    const onLogout = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Profil" }));

    fireEvent.click(screen.getByRole("menuitem", { name: "Wyloguj się" }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("zamyka się klawiszem Escape i kliknięciem obok", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Profil" });

    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
