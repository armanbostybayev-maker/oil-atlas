import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const require = createRequire(
  existsSync(new URL("../node_modules/@playwright/test", import.meta.url))
    ? new URL("../package.json", import.meta.url)
    : new URL("../../frontend/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const dir = fileURLToPath(new URL("../artifacts/", import.meta.url));
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [],
  consoleErrors = [],
  failed = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("requestfailed", (r) =>
  failed.push({ url: r.url(), error: r.failure()?.errorText }),
);
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
async function rendered() {
  await page.waitForFunction(
    () => {
      const m = window.__oilAtlasMap;
      return (
        m?.getLayer("countries-fill") &&
        !m.isMoving() &&
        m.isSourceLoaded("countries") &&
        m.isSourceLoaded("refineries") &&
        m.queryRenderedFeatures({ layers: ["countries-fill"] }).length > 0
      );
    },
    {},
    { timeout: 30000 },
  );
  await page.waitForTimeout(250);
}
async function clickCoordinate(coordinates) {
  const p = await page.evaluate((c) => {
    const m = window.__oilAtlasMap;
    m.jumpTo({ center: c, zoom: 4 });
    return m.project(c);
  }, coordinates);
  await rendered();
  await page.mouse.click(p.x, p.y);
}
async function search(q, label) {
  await page
    .getByRole("combobox", { name: "Search country, refinery or owner" })
    .fill(q);
  await page.getByRole("option").filter({ hasText: label }).first().click();
}
async function mode(label) {
  await page
    .getByRole("button", { name: "Open analytics menu", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: label, exact: false })
    .click();
  await page
    .getByRole("button", { name: "Close analytics menu", exact: true })
    .click();
}
try {
  if (process.argv.includes('--overlay')) {
    const { checkOverlay } = await import('./overlay.mjs'); await checkOverlay(page, check, dir);
  } else if(process.argv.includes('--owners-layout')){
    const {checkOwnersLayout}=await import('./owners-layout.mjs');await checkOwnersLayout(page,check,dir);
  } else if (process.argv.includes("--interface")) {
    const { checkInterface } = await import("./interface.mjs");
    await checkInterface(page, check, dir);
  } else if (process.argv.includes("--production")) {
    await page.goto("http://127.0.0.1:5181", { waitUntil: "networkidle" });
    await page
      .locator('.world-map[data-ready="true"]')
      .waitFor({ timeout: 30000 });
    await page.screenshot({ path: dir + "production-build.png" });
    await search("United States", "United States");
    await page
      .getByRole("complementary", { name: "Country details" })
      .waitFor();
    checks.push("Production build: local worker, rendered map, country search");
    console.log("PASS Production build");
  } else {
    await page.goto(process.env.OIL_STAT_URL || "http://127.0.0.1:5180", {
      waitUntil: "networkidle",
    });
    await page.locator(".maplibregl-canvas").waitFor();
    await page.waitForFunction(
      () =>
        window.__oilAtlasMap?.queryRenderedFeatures({
          layers: ["countries-fill"],
        }).length > 100 &&
        window.__oilAtlasMap?.queryRenderedFeatures({
          layers: ["refinery-circles"],
        }).length > 100,
      {},
      { timeout: 30000 },
    );
    await page.waitForTimeout(600);
    await check("World overview", async () => {
      await page.locator('.owners-trigger').click();
      if ((await page.locator(".owner-results li").count()) <= 10)
        throw Error("Owner ranking missing");
      await page.locator('.owners-trigger').click();
      await page.screenshot({ path: dir + "overview.png" });
    });
    await check("United States country card", async () => {
      await clickCoordinate([-101, 40]);
      await page
        .getByRole("complementary", { name: "Country details" })
        .waitFor();
      await page
        .locator(".details h2")
        .filter({ hasText: "United States" })
        .waitFor();
      await rendered();
      await page.screenshot({ path: dir + "country.png" });
    });
    await check("Compare United States and Kazakhstan", async () => {
      await page.getByRole("button", { name: "Compare countries" }).click();
      await page
        .getByLabel("Compare with")
        .selectOption({ label: "Kazakhstan" });
      if ((await page.locator(".comparison table tbody tr").count()) < 9)
        throw Error("Compare incomplete");
      await page.screenshot({ path: dir + "compare.png" });
      await page.getByRole("button", { name: "Close comparison" }).click();
      await page.getByRole("button", { name: "Close details" }).click();
    });
    for (const label of [
      "Oil Balance",
      "Refining Capacity",
      "Production",
      "Consumption",
      "Refinery Infrastructure",
      "Refinery Age",
      "Refinery Status",
      "Product Mix",
      "Economics",
      "Fuel Prices",
      "Owners",
      "Anomalies",
    ])
      await check("Mode " + label, async () => {
        await mode(label);
        await page.waitForTimeout(150);
      });
    await check("Owner selection and clear", async () => {
      await page.locator('.owners-trigger').click();
      await page.locator(".owner-results li button").first().click();
      await page.locator('.owners-trigger').click();
      await page.getByRole("button", { name: "Clear owner filter" }).waitFor();
      await page.getByRole("button", { name: "Clear owner filter" }).click();
      await page.locator('.owners-trigger').click();
    });
    await check("Reset View", async () => {
      await page.getByRole("button", { name: "Reset View" }).click();
      if ((await page.getByLabel("Status filter").inputValue()) !== "")
        throw Error("Status not reset");
    });
    await check("Refinery profile", async () => {
      await search("Jamnagar", "Jamnagar");
      await page
        .getByRole("complementary", { name: "Refinery details" })
        .waitFor();
      await page.getByRole("button", { name: "Close details" }).click();
      const point = await page.evaluate(async () => {
        const a = await (await fetch("/data/atlas.json")).json();
        return a.refineries
          .filter((r) => r.capacity !== null)
          .sort((a, b) => b.capacity - a.capacity)[0].coordinates;
      });
      if (!point) throw Error("Largest refinery source feature missing");
      await clickCoordinate(point);
      await page
        .getByRole("complementary", { name: "Refinery details" })
        .waitFor();
      await page.getByRole("button", { name: "Close details" }).click();
    });
    await check("Small refinery country", async () => {
      await search("New Zealand", "New Zealand");
      await page
        .getByRole("complementary", { name: "Country details" })
        .waitFor();
      await page.getByRole("button", { name: "Close details" }).click();
    });
    await check("Missing-data country", async () => {
      await search("Antarctica", "Antarctica");
      await page
        .getByRole("complementary", { name: "Country details" })
        .waitFor();
      if (
        !(await page
          .locator(".details")
          .getByText("No data", { exact: true })
          .count())
      )
        throw Error("Missing data not shown");
      await page.getByRole("button", { name: "Close details" }).click();
    });
    for (const base of [
      "osm",
      "positron",
      "dark",
      "satellite",
      "topo",
      "atlas",
    ])
      await check("Basemap " + base, async () => {
        await page.evaluate(() =>
          window.__oilAtlasMap.jumpTo({ center: [0, 18], zoom: 1 }),
        );
        const host = {
          osm: "tile.openstreetmap.org",
          satellite: "services.arcgisonline.com",
          topo: "tile.opentopomap.org",
        }[base];
        const tile = host
          ? page.waitForResponse(
              (r) => r.url().includes(host) && r.status() === 200,
              { timeout: 20000 },
            )
          : null;
        await page.getByLabel("Basemap", { exact: true }).selectOption(base);
        if (tile) await tile;
        if (["positron", "dark"].includes(base))
          await page
            .getByRole("status")
            .filter({ hasText: "requires a provider API key" })
            .waitFor();
        await page.waitForTimeout(700);
      });
    await check("URL persistence", async () => {
      await mode("Production");
      await page.reload({ waitUntil: "networkidle" });
      await rendered();
      if (
        (await page.getByLabel("Indicator", { exact: true }).inputValue()) !==
        "production"
      )
        throw Error("Mode lost");
    });
    await check("World zoom", async () => {
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    });
    await rendered();
    await page.screenshot({ path: dir + "production.png" });
    await check("Narrow viewport", async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "Reset View" }).click();
      await rendered();
      await page.screenshot({ path: dir + "mobile.png" });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Horizontal overflow");
      await search("Kazakhstan", "Kazakhstan");
      await page.waitForTimeout(900);
      await page.screenshot({ path: dir + "mobile-country.png" });
      await page.getByRole("button", { name: "Close details" }).click();
    });
  }
  if (errors.length || consoleErrors.length)
    throw Error([...errors, ...consoleErrors].join("\n"));
} finally {
  writeFileSync(
    dir +
      (process.argv.includes('--overlay') ? 'overlay-report.json' : process.argv.includes('--owners-layout')?'owners-layout-report.json':process.argv.includes("--interface")
        ? "interface-report.json"
        : process.argv.includes("--production")
          ? "production-report.json"
          : "browser-report.json"),
    JSON.stringify({ checks, errors, consoleErrors, failed }, null, 2),
  );
  await browser.close();
}
