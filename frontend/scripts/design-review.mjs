import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const browser = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const origin = process.env.DESIGN_REVIEW_ORIGIN || "http://127.0.0.1:5173";
const outputDir = resolve("../data/design-review");
const profile = mkdtempSync(join(tmpdir(), "oil-design-review-"));
const routeOption = process.argv.find((arg) => arg.startsWith("--routes="))?.slice(9);
const widthOption = process.argv.find((arg) => arg.startsWith("--widths="))?.slice(9);
const routes = (routeOption || "/,/products,/buy,/sell,/about,/stock,/staff,/portal").split(",");
const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
].filter(({ width }) => !widthOption || widthOption.split(",").includes(String(width)));
const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));

async function waitForPort() {
  const portFile = join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(portFile)) return Number(readFileSync(portFile, "utf8").split("\n")[0]);
    await pause(100);
  }
  throw new Error("Chrome did not open a debugging port");
}

async function run() {
  if (!existsSync(browser)) throw new Error(`Chrome not found: ${browser}`);
  mkdirSync(outputDir, { recursive: true });
  const chrome = spawn(browser, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-extensions",
    "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { windowsHide: true, stdio: "ignore" });
  let socket;
  try {
    const port = await waitForPort();
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = targets.find((item) => item.type === "page");
    if (!target) throw new Error("Chrome did not create a page target");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolveOpen, rejectOpen) => {
      socket.addEventListener("open", resolveOpen, { once: true });
      socket.addEventListener("error", rejectOpen, { once: true });
    });
    let nextId = 1;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const { resolveResult, rejectResult } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectResult(new Error(message.error.message));
      else resolveResult(message.result);
    });
    const command = (method, params = {}) => new Promise((resolveResult, rejectResult) => {
      const id = nextId++;
      pending.set(id, { resolveResult, rejectResult });
      socket.send(JSON.stringify({ id, method, params }));
    });
    await command("Page.enable");
    await command("Runtime.enable");
    if (process.env.DESIGN_REVIEW_STAFF_EMAIL && process.env.DESIGN_REVIEW_STAFF_PASSWORD) {
      await command("Page.navigate", { url: `${origin}/staff` });
      await pause(500);
      const login = await command("Runtime.evaluate", {
        expression: `fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(${JSON.stringify({
            email: process.env.DESIGN_REVIEW_STAFF_EMAIL,
            password: process.env.DESIGN_REVIEW_STAFF_PASSWORD,
          })})
        }).then((response) => response.status)`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (login.result.value !== 200) throw new Error(`Isolated staff sign-in failed: HTTP ${login.result.value}`);
    }
    if (process.env.DESIGN_REVIEW_PORTAL_EMAIL && process.env.DESIGN_REVIEW_PORTAL_PASSWORD) {
      await command("Page.navigate", { url: `${origin}/portal` });
      await pause(500);
      const login = await command("Runtime.evaluate", {
        expression: `fetch('/api/portal/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(${JSON.stringify({
            email: process.env.DESIGN_REVIEW_PORTAL_EMAIL,
            password: process.env.DESIGN_REVIEW_PORTAL_PASSWORD,
          })})
        }).then((response) => response.status)`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (login.result.value !== 200) throw new Error(`Isolated portal sign-in failed: HTTP ${login.result.value}`);
    }
    const findings = [];
    for (const viewport of viewports) {
      await command("Emulation.setDeviceMetricsOverride", {
        ...viewport, deviceScaleFactor: 1, mobile: viewport.width < 720,
      });
      for (const route of routes) {
        await command("Page.navigate", { url: `${origin}${route}` });
        await pause(900);
        const result = await command("Runtime.evaluate", {
          expression: `(() => ({
            width: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            title: document.querySelector('h1')?.textContent?.trim() || '',
            font: getComputedStyle(document.body).fontFamily,
            header: getComputedStyle(document.querySelector('.site-header')).backgroundColor,
            menuVisible: getComputedStyle(document.querySelector('.menu-toggle')).display !== 'none',
            overflowNodes: [...document.querySelectorAll('body *')]
              .filter((node) => node.getBoundingClientRect().right > window.innerWidth + 1)
              .slice(0, 12)
              .map((node) => ({ tag: node.tagName, className: typeof node.className === 'string' ? node.className : '', right: Math.round(node.getBoundingClientRect().right) })),
            errorText: document.querySelector('[role="alert"]')?.textContent?.trim() || ''
          }))()`,
          returnByValue: true,
        });
        const metrics = result.result.value;
        const pageName = route === "/" ? "home" : route.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-");
        const file = join(outputDir, `${pageName}-${viewport.width}.png`);
        const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
        writeFileSync(file, Buffer.from(screenshot.data, "base64"));
        if (viewport.width === 390) {
          const interaction = await command("Runtime.evaluate", {
            expression: `(async () => {
              const wait = () => new Promise((done) => setTimeout(done, 0));
              const menu = document.querySelector('.menu-toggle');
              menu.click();
              await wait();
              const menuOpens = menu.getAttribute('aria-expanded') === 'true' &&
                getComputedStyle(document.querySelector('#primary-navigation')).display !== 'none';
              menu.click();
              await wait();
              const filter = document.querySelector('.mx-mobile-filter-toggle');
              let filterOpens = null;
              if (filter) {
                filter.click();
                await wait();
                filterOpens = filter.getAttribute('aria-expanded') === 'true' &&
                  document.querySelector('.mx-filter-sidebar').classList.contains('is-open');
              }
              return { menuOpens, filterOpens };
            })()`,
            awaitPromise: true,
            returnByValue: true,
          });
          Object.assign(metrics, interaction.result.value);
        }
        if (metrics.scrollWidth <= metrics.width + 1) delete metrics.overflowNodes;
        findings.push({ route, viewport: viewport.width, ...metrics, overflow: metrics.scrollWidth > metrics.width + 1 });
      }
    }
    console.log(JSON.stringify(findings, null, 2));
    if (findings.some((item) => item.overflow || item.errorText || item.menuOpens === false || item.filterOpens === false)) process.exitCode = 1;
  } finally {
    socket?.close();
    chrome.kill();
    if (resolve(profile).startsWith(resolve(tmpdir()) + sep) && profile.includes("oil-design-review-")) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await pause(200);
        try {
          rmSync(profile, { recursive: true, force: true });
          break;
        } catch (error) {
          if (error.code !== "EPERM" && error.code !== "EBUSY") throw error;
          if (attempt === 9) console.warn(`Temporary Chrome profile is still in use: ${profile}`);
        }
      }
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
