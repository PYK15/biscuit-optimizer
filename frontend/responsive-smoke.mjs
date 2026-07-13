import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812, touch: true },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "desktop", width: 1440, height: 900, touch: false },
];
const TABS = ["Overview", "Forecast", "Cost Optimization", "Sustainability", "Model Scorecard", "Roadmap"];

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`PASS: ${msg}`);
}

const browser = await chromium.launch();
const allErrors = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(BASE_URL, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("text=Method of the Day", { timeout: 120000 });

  async function assertNoOverflow(label) {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert(
      scrollWidth <= clientWidth + 2,
      `[${vp.name}] ${label}: no horizontal overflow (scrollWidth=${scrollWidth}, viewport=${clientWidth})`
    );
  }

  async function gotoTab(label) {
    if (vp.width < 768) {
      await page.locator("[data-mobile-nav-trigger]").click();
      await page.waitForTimeout(150);
      await page.getByRole("button", { name: label, exact: true }).click();
    } else {
      await page.getByRole("button", { name: label, exact: true }).click();
    }
    await page.waitForTimeout(400);
  }

  await assertNoOverflow("initial load (Overview)");

  for (const tabLabel of TABS) {
    await gotoTab(tabLabel);
    await assertNoOverflow(tabLabel);

    // Nav present and reachable at this breakpoint
    if (vp.width < 768) {
      assert(await page.locator("[data-mobile-nav-trigger]").isVisible(), `[${vp.name}] ${tabLabel}: hamburger menu button visible`);
    } else {
      assert(
        await page.getByRole("button", { name: tabLabel, exact: true }).isVisible(),
        `[${vp.name}] ${tabLabel}: desktop nav tab visible`
      );
    }

    // Horizon control present
    assert(await page.locator("#horizon").isVisible(), `[${vp.name}] ${tabLabel}: horizon control visible`);

    // Stage/driver filter present on Cost Optimization and Sustainability
    if (tabLabel === "Cost Optimization" || tabLabel === "Sustainability") {
      const filterCount = await page.locator("select").count();
      assert(filterCount > 0, `[${vp.name}] ${tabLabel}: filter dropdown present (found ${filterCount})`);
    }

    // Print button and dark-mode toggle: exactly one visible instance
    // (a mobile set and a desktop set both exist in the DOM, toggled via
    // CSS display at the lg breakpoint - :visible picks whichever is shown).
    const printBtn = page.locator("[data-print-button]:visible");
    assert((await printBtn.count()) === 1, `[${vp.name}] ${tabLabel}: exactly one visible print button (found ${await printBtn.count()})`);
    const darkBtn = page.locator("[data-dark-mode-toggle]:visible");
    assert((await darkBtn.count()) === 1, `[${vp.name}] ${tabLabel}: exactly one visible dark-mode toggle (found ${await darkBtn.count()})`);
  }

  // Touch target size check (WCAG 2.2 AA minimum 24x24; we target ~44x44 for
  // primary controls) on the mobile viewport specifically.
  if (vp.name === "mobile") {
    const darkBtnBox = await page.locator("[data-dark-mode-toggle]:visible").boundingBox();
    assert(
      !!darkBtnBox && darkBtnBox.width >= 40 && darkBtnBox.height >= 40,
      `[mobile] dark-mode toggle meets the ~44px touch target guidance (${darkBtnBox?.width}x${darkBtnBox?.height})`
    );
    const printBtnBox = await page.locator("[data-print-button]:visible").boundingBox();
    assert(
      !!printBtnBox && printBtnBox.width >= 40 && printBtnBox.height >= 40,
      `[mobile] print button meets the ~44px touch target guidance (${printBtnBox?.width}x${printBtnBox?.height})`
    );

    // Horizon slider responds on a touch-emulated viewport (keyboard-driven,
    // same reliable technique used in smoke.mjs - programmatic drag gestures
    // on a native range input are not meaningfully testable via Playwright).
    await gotoTab("Forecast");
    const slider = page.locator("#horizon");
    await slider.focus();
    await slider.press("End");
    await page.waitForTimeout(300);
    assert((await slider.inputValue()) === "14", "[mobile] horizon slider responds to interaction on a touch-emulated viewport");
  }

  // Dark mode toggle actually flips the .dark class
  await page.locator("[data-dark-mode-toggle]:visible").click();
  await page.waitForTimeout(200);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  assert(isDark, `[${vp.name}] dark-mode toggle applies the .dark class`);
  await assertNoOverflow("after enabling dark mode");
  await page.locator("[data-dark-mode-toggle]:visible").click();
  await page.waitForTimeout(200);
  const isLightAgain = await page.evaluate(() => !document.documentElement.classList.contains("dark"));
  assert(isLightAgain, `[${vp.name}] dark-mode toggle flips back off`);

  await page.screenshot({ path: `responsive_${vp.name}.png`, fullPage: false });

  allErrors.push(...errors.map((e) => `[${vp.name}] ${e}`));
  await page.close();
}

console.log("CONSOLE_ERRORS:", JSON.stringify(allErrors, null, 2));
assert(allErrors.length === 0, `no console errors across all three viewports (found ${allErrors.length})`);

await browser.close();
console.log("\nALL RESPONSIVE CHECKS PASSED");
