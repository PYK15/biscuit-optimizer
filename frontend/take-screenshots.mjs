import { chromium } from "playwright";

const BASE_URL = "http://localhost:5173";
const OUT_DIR = "../screenshots";
const VIEWPORTS = [
  { name: "overview-mobile", width: 375, height: 812 },
  { name: "overview-tablet", width: 768, height: 1024 },
  { name: "overview-desktop", width: 1440, height: 900 },
];

const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(BASE_URL, { waitUntil: "load", timeout: 60000 });
  await page.waitForSelector("text=Method of the Day", { timeout: 120000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT_DIR}/${vp.name}.png` });
  console.log(`Saved ${vp.name}.png`);
  await page.close();
}
await browser.close();
