/**
 * Real-screenshot capture of the running app (dev API + client on :3000)
 * using puppeteer-core + the npm-packaged chromium. Output: /home/user/shots/*.png
 */
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { mkdirSync } from "node:fs";

const OUT = "/home/user/shots";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  args: [...chromium.args, "--disable-web-security"],
  executablePath: await chromium.executablePath(),
  headless: "shell",
  defaultViewport: { width: 480, height: 960, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
const shot = async (name) => {
  await new Promise((r) => setTimeout(r, 450));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot:", name);
};

// 1. Welcome
await page.goto("http://localhost:3000/", { waitUntil: "networkidle0" });
await shot("01-welcome");

// 2. Seed demo → Home
await page.click("#btn-demo");
await page.waitForSelector(".hero .amount", { timeout: 15000 });
await shot("02-home");

// 3. Plan
await page.click('[data-tab="plan"]');
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("protected money"));
await shot("03-plan");

// 4. Spend + quick add preview
await page.click('[data-tab="transactions"]');
await page.waitForSelector("#tx-text");
await page.type("#tx-text", "Spent 950 on dinner");
await page.click("#tx-parse");
await page.waitForSelector("#tx-save", { timeout: 15000 });
await shot("04-spend");

// 5. Insights (month-end review)
await page.click('[data-tab="insights"]');
await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("month-end review"));
await shot("05-insights");

// 6. Assistant answer
await page.type("#chat-in", "Can I spend 5000 on shoes?");
await page.click("#chat-send");
await page.waitForFunction(() => document.body.innerText.includes("grounded in"), { timeout: 15000 });
await shot("06-assistant");

await browser.close();
console.log("DONE");
