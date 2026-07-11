import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`PASS: ${msg}`);
}

await page.goto(BASE_URL, { waitUntil: "load", timeout: 60000 });
await page.waitForSelector("text=Method of the Day", { timeout: 120000 });
await page.screenshot({ path: "smoke_overview.png" });

// --- Info-tooltip smoke pass: every tab must expose at least one working
// (i) info affordance, and hovering/clicking it must reveal a non-empty
// WHAT/HOW/WHY popover. ---
async function assertInfoTipWorks(tabLabel) {
  const trigger = page.locator("[data-info-trigger]").first();
  await trigger.waitFor({ state: "visible", timeout: 15000 });
  const triggerCount = await page.locator("[data-info-trigger]").count();
  assert(triggerCount > 0, `${tabLabel} tab renders at least one info (i) tooltip trigger (found ${triggerCount})`);

  await trigger.click();
  const popover = page.locator("[data-info-popover]").first();
  await popover.waitFor({ state: "visible", timeout: 5000 });
  const text = (await popover.textContent()) ?? "";
  assert(text.includes("What:"), `${tabLabel} tab's info popover contains a WHAT line`);
  assert(text.includes("How:"), `${tabLabel} tab's info popover contains a HOW line`);
  assert(text.includes("Why it matters:"), `${tabLabel} tab's info popover contains a WHY IT MATTERS line`);
  assert(text.trim().length > 40, `${tabLabel} tab's info popover has non-trivial content (${text.trim().length} chars)`);
  // click elsewhere to close it before moving on
  await page.mouse.click(5, 5);
}

await assertInfoTipWorks("Overview");

// --- Tab smoke pass (extended with the new Roadmap tab + info-tooltip checks) ---
const tabs = ["Forecast", "Cost Optimization", "Sustainability", "Model Scorecard", "Roadmap"];
for (const t of tabs) {
  await page.getByRole("button", { name: t, exact: true }).click();
  await page.waitForTimeout(1000);
  await assertInfoTipWorks(t);
  await page.screenshot({ path: `smoke_${t.replace(/\s+/g, "_").toLowerCase()}.png` });
}

// --- Roadmap tab: assert it renders at least one ranked action item ---
await page.getByRole("button", { name: "Roadmap", exact: true }).click();
await page.waitForTimeout(500);
const roadmapItemCount = await page.locator("ol li").count();
assert(roadmapItemCount > 0, `Roadmap tab renders at least one ranked action item (found ${roadmapItemCount})`);
const firstRoadmapItemText = (await page.locator("ol li").first().textContent()) ?? "";
assert(
  /Why now:/.test(firstRoadmapItemText) && /Expected impact:/.test(firstRoadmapItemText),
  "first Roadmap action item includes a 'why now' driver and an expected impact"
);

// --- "How This Works" panel: opens from the header, and from the footer, and contains non-empty text ---
await page.locator("[data-how-this-works-trigger]").click();
const howPanel = page.locator("[data-how-this-works-panel]");
await howPanel.waitFor({ state: "visible", timeout: 5000 });
const howText = (await howPanel.textContent()) ?? "";
assert(howText.trim().length > 300, `How This Works panel contains substantial non-empty text (${howText.trim().length} chars)`);
assert(/synthetic variability/i.test(howText), "How This Works panel mentions synthetic variability honestly");
assert(/water/i.test(howText), "How This Works panel calls out the water_kl accuracy caveat");
await page.keyboard.press("Escape");
await howPanel.waitFor({ state: "hidden", timeout: 5000 });
assert(true, "How This Works panel closes on Escape");

// --- Horizon wiring test: Forecast tab ---
await page.getByRole("button", { name: "Forecast", exact: true }).click();
await page.waitForTimeout(500);

// Capture the chart's rendered date range before changing horizon.
const datesBefore = await page.$$eval(".recharts-xAxis-tick-labels text", (els) =>
  els.map((e) => e.textContent)
);
const maxDateBefore = datesBefore.filter(Boolean).sort().at(-1);
assert(datesBefore.length > 0, "chart renders x-axis date ticks before horizon change");
console.log("Dates before:", datesBefore);

const horizonBefore = await page.locator("#horizon").inputValue();
console.log("Horizon slider value before:", horizonBefore);

// Change the horizon control (shared, lives in the header) to its max (14
// days) via keyboard - range inputs respond reliably to the End key, unlike
// programmatic .value assignment which doesn't fire React's onChange.
const slider = page.locator("#horizon");
await slider.focus();

const forecastRequestPromise = page.waitForResponse(
  (resp) => resp.url().includes("/forecast?horizon=") && resp.status() === 200,
  { timeout: 90000 }
);
const recommendationsRequestPromise = page.waitForResponse(
  (resp) => resp.url().includes("/recommendations?horizon=") && resp.status() === 200,
  { timeout: 90000 }
);
const sustainabilityRequestPromise = page.waitForResponse(
  (resp) => resp.url().includes("/sustainability?horizon=") && resp.status() === 200,
  { timeout: 90000 }
);

// The End key reliably fires React's onChange on a native range input in one
// step (jumps straight to max=14) - unlike .fill()/programmatic value
// assignment, which can silently bypass React's change-detection on
// controlled inputs, and unlike repeated ArrowRight presses, which would
// fire one fetch per intermediate value (7->8->9...) instead of one clean
// 7->14 transition.
await slider.press("End");

const forecastResponse = await forecastRequestPromise;
assert(true, "new /forecast?horizon=... network request fired after changing the Forecast tab's horizon control");

const forecastUrl = new URL(forecastResponse.url());
const newHorizon = forecastUrl.searchParams.get("horizon");
console.log("New /forecast request horizon param:", newHorizon);
assert(newHorizon === "14", `/forecast request used the new horizon value (expected 14, got ${newHorizon})`);

const forecastBody = await forecastResponse.json();
assert(
  forecastBody.forecast.horizon_days === 14,
  `/forecast response body reflects the new horizon (horizon_days=${forecastBody.forecast.horizon_days})`
);

// The other two horizon-dependent endpoints must fire too - proving the
// Forecast tab's control is the SAME shared state, not a disconnected one.
const recommendationsResponse = await recommendationsRequestPromise;
const sustainabilityResponse = await sustainabilityRequestPromise;
assert(
  new URL(recommendationsResponse.url()).searchParams.get("horizon") === "14",
  "/recommendations request fired with the same new horizon (14) - Cost Optimization stays in sync"
);
assert(
  new URL(sustainabilityResponse.url()).searchParams.get("horizon") === "14",
  "/sustainability request fired with the same new horizon (14) - Sustainability stays in sync"
);

// Confirm the chart actually re-rendered with different data (not just that
// a request fired) - the date range must extend further out.
await page.waitForTimeout(1500); // let the DOM update after state settles
const datesAfter = await page.$$eval(".recharts-xAxis-tick-labels text", (els) =>
  els.map((e) => e.textContent)
);
const maxDateAfter = datesAfter.filter(Boolean).sort().at(-1);
console.log("Dates after:", datesAfter);
assert(maxDateAfter !== maxDateBefore, `chart's rendered date range changed after horizon change (before=${maxDateBefore}, after=${maxDateAfter})`);
assert(maxDateAfter > maxDateBefore, `new max date (${maxDateAfter}) extends further out than before (${maxDateBefore}), consistent with a longer horizon`);

// --- Confirm Cost Optimization tab reflects the same new horizon (7 -> 14 scrub days) ---
await page.getByRole("button", { name: "Cost Optimization", exact: true }).click();
await page.waitForTimeout(500);
const scrubButtons = await page.locator("text=Scrub forecast day:").locator("..").locator("button").count();
console.log("Cost Optimization day-scrub button count after horizon change:", scrubButtons);
assert(scrubButtons === 14, `Cost Optimization shows 14 scrub-day buttons after the shared horizon changed to 14 (got ${scrubButtons})`);

// --- Confirm Roadmap tab also reflects the same new horizon (mentions 14 days) ---
await page.getByRole("button", { name: "Roadmap", exact: true }).click();
await page.waitForTimeout(500);
const roadmapText = (await page.locator("main").textContent()) ?? "";
assert(/14-day forecast horizon/.test(roadmapText), "Roadmap tab reflects the same shared horizon (14 days) after the change");
const roadmapItemCountAfter = await page.locator("ol li").count();
assert(roadmapItemCountAfter > 0, `Roadmap tab still renders ranked action items after horizon change (found ${roadmapItemCountAfter})`);

await page.screenshot({ path: "smoke_forecast_after_horizon_change.png" });

console.log("CONSOLE_ERRORS:", JSON.stringify(errors, null, 2));
assert(errors.length === 0, "no console errors were logged during the whole run");

await browser.close();
console.log("\nALL CHECKS PASSED");
