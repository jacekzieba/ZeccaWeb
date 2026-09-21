import { type Locator } from "@playwright/test";

/** Wybór opcji we własnym komponencie Select (`role=combobox` + `role=listbox`).
 *
 * Natywne `selectOption` działa tylko na <select>; po zamianie selectów na komponent
 * `src/components/ui/select.tsx` zawodziło z „Element is not a <select> element”.
 * Opcja zatwierdza się na mousedown, co robi zwykłe kliknięcie. */
export async function chooseOption(combobox: Locator, name: string | RegExp) {
  await combobox.click();
  await combobox.page().getByRole("option", { name }).first().click();
}
