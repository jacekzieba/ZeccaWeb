import { expect, test, type Page } from "@playwright/test";

const section = (page: Page, id: string) =>
  page.getByTestId(`dashboard-section-${id}`);

const ALL_SECTIONS = ["summary", "holdings", "allocation", "monthly", "transactions", "portfolios"] as const;

test("dashboard customize stores section visibility and width, and preserves it after reload", async ({ page }) => {
  await page.goto("/dashboard");

  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await expect(main.getByText("Układ sekcji")).toBeVisible();

  await main.getByRole("button", { name: "Przesuń Instrumenty wyżej" }).click();
  await main.getByRole("radiogroup", { name: "Szerokość sekcji Instrumenty" }).getByRole("radio", { name: "4 kolumny" }).click();
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
    holdingsSize: { width: 4 },
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

test("dashboard cards size to content with no internal scrollbars on desktop", async ({ page }) => {
  await page.goto("/dashboard");

  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  for (const id of ALL_SECTIONS) {
    const card = section(page, id).locator(":scope > div");
    const layout = await card.evaluate((node) => ({
      overflowY: getComputedStyle(node).overflowY,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    }));
    expect(layout.overflowY, `${id} card must not scroll internally`).toBe("visible");
    // Content fits within the card — no clipped/scrollable overflow.
    expect(layout.scrollHeight - layout.clientHeight, `${id} card content overflow`).toBeLessThanOrEqual(1);
  }
});

test("dashboard width preset changes the column span and persists", async ({ page }) => {
  await page.goto("/dashboard");

  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  const transactions = section(page, "transactions");
  const initialSpan = await transactions.evaluate((wrapper) => wrapper.style.gridColumn);

  await main.getByRole("button", { name: "Dostosuj" }).click();
  await main
    .getByRole("radiogroup", { name: "Szerokość sekcji Ostatnie transakcje" })
    .getByRole("radio", { name: "4 kolumny" })
    .click();

  await expect.poll(async () => transactions.evaluate((wrapper) => wrapper.style.gridColumn)).toBe("span 4");
  expect(await transactions.evaluate((wrapper) => wrapper.style.gridColumn)).not.toBe(initialSpan);
  await expect.poll(async () => page.evaluate(() => {
    const raw = window.localStorage.getItem("zecca.dashboard.sections.v1");
    return raw ? JSON.parse(raw).sectionSizes?.transactions : null;
  })).toEqual({ width: 4 });

  await page.reload();
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();
  await expect.poll(async () => transactions.evaluate((wrapper) => wrapper.style.gridColumn)).toBe("span 4");
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
      gridColumn: wrapper.style.gridColumn,
      wrapperHeight: wrapper.getBoundingClientRect().height,
      cardClientHeight: card.clientHeight,
      cardScrollHeight: card.scrollHeight,
    };
  });
  // Below the desktop breakpoint every section spans the full single column.
  expect(tabletLayout.gridColumn).toBe("1 / -1");
  expect(tabletLayout.cardClientHeight).toBe(tabletLayout.cardScrollHeight);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await allocation.locator(":scope > div").evaluate((card) =>
    card.scrollHeight - card.clientHeight,
  );
  expect(mobileOverflow).toBe(0);
});

test("dashboard normalizes legacy stored sizes that still carry a height", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("zecca.dashboard.sections.v1", JSON.stringify({
      sectionOrder: ["summary", "holdings", "allocation", "monthly", "transactions", "portfolios"],
      visibleSections: ["summary", "holdings", "allocation", "monthly", "transactions", "portfolios"],
      sectionSizes: { summary: { width: 4, height: 3 }, holdings: { width: 4, height: 3 } },
    }));
  });
  await page.goto("/dashboard");

  const main = page.getByRole("main");
  await expect(main.getByText(/pozycji w portfelu/)).toBeVisible();

  await expect.poll(async () => page.evaluate(() => {
    const raw = window.localStorage.getItem("zecca.dashboard.sections.v1");
    const sizes = raw ? JSON.parse(raw).sectionSizes : null;
    return { summary: sizes?.summary, holdings: sizes?.holdings };
  })).toEqual({ summary: { width: 4 }, holdings: { width: 4 } });
});
