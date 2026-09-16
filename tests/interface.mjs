import assert from "node:assert/strict";
export async function checkInterface(page, check, dir) {
  await page.goto("http://127.0.0.1:5180/", { waitUntil: "networkidle" });
  await page
    .locator('.world-map[data-ready="true"]')
    .waitFor({ timeout: 30000 });
  await page.evaluate(() => (window.__originalMap = window.__oilAtlasMap));
  await check("Panel width +30%, text +60%", async () => {
    await page.locator('.owners-trigger').click();
    const dimensions = await page
      .locator(".owners-dropdown")
      .evaluate((e) => ({
        width: e.getBoundingClientRect().width,
        font: parseFloat(
          getComputedStyle(e.querySelector(".eyebrow")).fontSize,
        ),
      }));
    assert.ok(Math.abs(dimensions.width - 266 * 1.3) < 1);
    assert.ok(Math.abs(dimensions.font - 9 * 1.6) < 0.1);
    await page.locator('.owners-trigger').click();
  });
  await page.screenshot({ path: dir + "interface-en.png" });
  await check("Russian switch, labels and live map preserved", async () => {
    await page.getByLabel("Language / Язык").selectOption("ru");
    await page.getByRole("heading", { name: "Обзор", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Открыть меню анализа", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() => window.__oilAtlasMap === window.__originalMap),
      true,
    );
    assert.ok(
      (await page.locator(".owners-picker").innerText()).includes(
        "Все компании",
      ),
    );
  });
  await check(
    "All 13 analysis help dialogs, no mode change and focus return",
    async () => {
      await page
        .getByRole("button", { name: "Открыть меню анализа", exact: true })
        .click();
      assert.equal(await page.locator(".mode-info").count(), 13);
      for (let i = 0; i < 13; i++) {
        const before = page.url();
        await page.locator(".mode-info").nth(i).click();
        await page.getByRole("dialog").waitFor();
        assert.equal(await page.locator(".mode-help section").count(), 3);
        assert.equal(page.url(), before);
        if (i === 1)
          await page.screenshot({ path: dir + "analysis-help-ru.png" });
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden" });
        assert.equal(
          await page
            .locator(".mode-info")
            .nth(i)
            .evaluate((e) => e === document.activeElement),
          true,
        );
      }
      await page
        .getByRole("button", { name: "Закрыть меню анализа", exact: true })
        .click();
    },
  );
  await check(
    "Russian status filter preserves source IDs and URL",
    async () => {
      await page.getByLabel("Фильтр статуса").selectOption("Closed");
      await page.waitForFunction(() => {
        const m = window.__oilAtlasMap;
        const f = m.queryRenderedFeatures({ layers: ["refinery-circles"] });
        return f.length > 0 && f.every((f) => f.properties.status === "Closed");
      });
      assert.equal(new URL(page.url()).searchParams.get("status"), "Closed");
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Обзор", exact: true }).waitFor();
      assert.equal(await page.getByLabel("Language / Язык").inputValue(), "ru");
      assert.equal(
        await page.getByLabel("Фильтр статуса").inputValue(),
        "Closed",
      );
      await page.getByLabel("Фильтр статуса").selectOption("");
    },
  );
  await page.locator('.world-map[data-ready="true"]').waitFor();
  await page.screenshot({ path: dir + "interface-ru.png" });
  await check("Russian country details and comparison", async () => {
    await page
      .getByRole("combobox", { name: "Поиск страны, НПЗ или владельца" })
      .fill("Kazakhstan");
    await page
      .getByRole("option")
      .filter({ hasText: "Kazakhstan" })
      .first()
      .click();
    await page
      .getByRole("complementary", { name: "Карточка страны" })
      .waitFor();
    await page.getByRole("button", { name: "Сравнить страны" }).click();
    await page.getByLabel("Сравнить с").selectOption({ label: "Norway" });
    assert.ok(
      (await page.locator(".comparison").innerText()).includes("Добыча нефти"),
    );
    await page.screenshot({ path: dir + "comparison-ru.png" });
    await page.getByRole("button", { name: "Закрыть сравнение" }).click();
    await page.getByRole("button", { name: "Закрыть карточку" }).click();
  });
  await check("Russian diagnostic text", async () => {
    await page.getByRole("button", { name: "Открыть качество данных" }).click();
    await page.getByRole("heading", { name: "Ограничения данных" }).waitFor();
    await page.screenshot({ path: dir + "quality-ru.png" });
    await page.getByRole("button", { name: "Закрыть качество данных" }).click();
  });
  await check("Laptop layout", async () => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.screenshot({ path: dir + "interface-laptop.png" });
    const search = await page.locator(".search").boundingBox(),
      owners = await page.locator(".owners-picker").boundingBox();
    assert.ok(
      search.x + search.width < owners.x || search.y + search.height < owners.y,
    );
  });
  await check("Narrow layout and dialog scrolling", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Сбросить вид", exact: false })
      .click();
    await page.waitForTimeout(900);
    for (const selector of [
      ".brand",
      ".search",
      ".language-switcher",
      ".map-controls",
      ".kpis",
      ".bottom-tools",
    ]) {
      const r = await page.locator(selector).boundingBox();
      assert.ok(
        r.x >= 0 && r.x + r.width <= 391,
        `${selector} outside viewport`,
      );
    }
    await page.screenshot({ path: dir + "interface-mobile.png" });
    await page
      .getByRole("button", { name: "Открыть меню анализа", exact: true })
      .click();
    await page.locator(".mode-info").nth(1).click();
    const r = await page.getByRole("dialog").boundingBox();
    assert.ok(r.height <= 800 && r.width <= 390);
    await page.screenshot({ path: dir + "help-mobile.png" });
    await page.getByRole("button", { name: "Закрыть описание" }).click();
    await page
      .getByRole("button", { name: "Закрыть меню анализа", exact: true })
      .click();
  });
  await check("Return to English", async () => {
    await page.getByLabel("Language / Язык").selectOption("en");
    await page
      .getByRole("button", { name: "Open analytics menu", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Overview", exact: true })
      .waitFor();
  });
}
