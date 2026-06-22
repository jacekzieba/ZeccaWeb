import { expect, test, type Page } from "@playwright/test";

const section = (page: Page, id: string) =>
  page.getByTestId(`dashboard-section-${id}`);

test("dashboard customize stores section visibility and preserves it after reload", async ({ page }) => {
  await page.goto("/dashboard");

  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await expect(main.getByText("Układ sekcji")).toBeVisible();

  await main.getByRole("button", { name: "Przesuń Instrumenty wyżej" }).click();
  await main.getByRole("radiogroup", { name: "Rozmiar sekcji Instrumenty" }).getByRole("radio", { name: "4×3" }).click();
  await expect.poll(async () => {
    return page.evaluate(() => {
      const raw = window.localStorage.getItem("zecca.dashboard.sections.v1");
      const config = raw ? JSON.parse(raw) : {};
      return {
        firstTwo: config.sectionOrder?.slice(0, 2),
        holdingsSize: config.sectionSizes?.holdings,
      };
    });
  }).toMatchObject({
    firstTwo: ["holdings", "summary"],
    holdingsSize: { width: 4, height: 3 },
  });

  await main.getByRole("checkbox", { name: "Pokaż sekcję Instrumenty" }).uncheck();

  await expect(main.getByText(/pozycji w portfelu/)).toHaveCount(0);
  await expect.poll(async () => {
    return page.evaluate(() => {
      const raw = window.localStorage.getItem("zecca.dashboard.sections.v1");
      return raw ? JSON.parse(raw).visibleSections : [];
    });
  }).not.toContain("holdings");

  await page.reload();
  await expect(main.getByText(/pozycji w portfelu/)).toHaveCount(0);

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await main.getByRole("button", { name: "Przywróć domyślne" }).click();
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();
});

test("dashboard applies modular desktop heights and keeps overflowing content inside cards", async ({ page }) => {
  await page.goto("/dashboard");

  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  const transactions = section(page, "transactions");
  const portfolios = section(page, "portfolios");
  const allocation = section(page, "allocation");

  const [transactionsBox, portfoliosBox] = await Promise.all([
    transactions.boundingBox(),
    portfolios.boundingBox(),
  ]);
  expect(transactionsBox).not.toBeNull();
  expect(portfoliosBox).not.toBeNull();
  expect(transactionsBox!.y).toBeCloseTo(portfoliosBox!.y, 0);
  expect(transactionsBox!.height).toBeCloseTo(portfoliosBox!.height, 0);
  expect(transactionsBox!.height).toBeCloseTo(494, 0);

  const allocationScroll = await allocation.locator(":scope > div").evaluate((card) => ({
    clientHeight: card.clientHeight,
    scrollHeight: card.scrollHeight,
    overflowY: getComputedStyle(card).overflowY,
  }));
  expect(allocationScroll.overflowY).toBe("auto");
  expect(allocationScroll.scrollHeight).toBeGreaterThan(allocationScroll.clientHeight);

  const initialHeight = transactionsBox!.height;
  await main.getByRole("button", { name: "Dostosuj" }).click();
  await main
    .getByRole("radiogroup", { name: "Rozmiar sekcji Ostatnie transakcje" })
    .getByRole("radio", { name: "4×3" })
    .click();

  await expect.poll(async () => (await transactions.boundingBox())?.height).toBe(748);
  expect((await transactions.boundingBox())!.height).toBeGreaterThan(initialHeight);
  await expect.poll(async () => page.evaluate(() => {
    const raw = window.localStorage.getItem("zecca.dashboard.sections.v1");
    return raw ? JSON.parse(raw).sectionSizes?.transactions : null;
  })).toEqual({ width: 4, height: 3 });

  await page.reload();
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();
  await expect.poll(async () => (await transactions.boundingBox())?.height).toBe(748);
});

test("dashboard uses natural section heights below the desktop breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/dashboard");

  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  const allocation = section(page, "allocation");
  const tabletLayout = await allocation.evaluate((wrapper) => {
    const card = wrapper.firstElementChild as HTMLElement;
    return {
      gridRow: wrapper.style.gridRow,
      wrapperHeight: wrapper.getBoundingClientRect().height,
      cardClientHeight: card.clientHeight,
      cardScrollHeight: card.scrollHeight,
    };
  });
  expect(tabletLayout.gridRow).toBe("auto");
  expect(tabletLayout.wrapperHeight).toBeGreaterThan(240);
  expect(tabletLayout.cardClientHeight).toBe(tabletLayout.cardScrollHeight);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => allocation.evaluate((wrapper) => wrapper.style.gridRow)).toBe("auto");
  const mobileOverflow = await allocation.locator(":scope > div").evaluate((card) =>
    card.scrollHeight - card.clientHeight,
  );
  expect(mobileOverflow).toBe(0);
});

test("dashboard normalizes the removed oversized summary preset", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("zecca.dashboard.sections.v1", JSON.stringify({
      sectionOrder: ["summary", "holdings", "allocation", "monthly", "transactions", "portfolios"],
      visibleSections: ["summary", "holdings", "allocation", "monthly", "transactions", "portfolios"],
      sectionSizes: { summary: { width: 4, height: 3 } },
    }));
  });
  await page.goto("/dashboard");

  const summary = section(page, "summary");
  await expect.poll(async () => (await summary.boundingBox())?.height).toBe(494);
  await expect.poll(async () => page.evaluate(() => {
    const raw = window.localStorage.getItem("zecca.dashboard.sections.v1");
    return raw ? JSON.parse(raw).sectionSizes?.summary : null;
  })).toEqual({ width: 4, height: 2 });
});
