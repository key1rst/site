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
const bottomReview = process.argv.includes("--bottom");
const targetReview = process.argv.find((arg) => arg.startsWith("--target="))?.slice(9);
const routes = (routeOption || "/,/products,/buy,/sell,/about,/stock,/staff,/portal").split(",");
const widths = (widthOption || "390,768,1280").split(",").map(Number);
if (widths.some((width) => !Number.isInteger(width) || width < 320 || width > 2560)) {
  throw new Error("Review widths must be whole numbers from 320 to 2560");
}
const viewports = widths.map((width) => ({
  width,
  height: width < 600 ? 844 : width < 1024 ? 1024 : 900,
}));
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
    if (process.env.DESIGN_REVIEW_LOCALE) {
      const reviewLocale = process.env.DESIGN_REVIEW_LOCALE;
      if (!["en", "fa"].includes(reviewLocale)) throw new Error("DESIGN_REVIEW_LOCALE must be en or fa");
      await command("Page.navigate", { url: origin });
      await pause(400);
      await command("Runtime.evaluate", {
        expression: `localStorage.setItem('oil-platform-language', ${JSON.stringify(reviewLocale)})`,
      });
    }
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
        if (route === "/staff" && process.env.DESIGN_REVIEW_STAFF_VIEW) {
          const reviewView = process.env.DESIGN_REVIEW_STAFF_VIEW;
          if (!/^[a-z]+$/.test(reviewView)) throw new Error("Invalid review view");
          await command("Runtime.evaluate", {
            expression: `document.querySelector('.workspace-nav [data-view=${JSON.stringify(reviewView)}]')?.click()`,
          });
          await pause(900);
        }
        if (route === "/staff" && process.env.DESIGN_REVIEW_OPEN_FIRST_INQUIRY) {
          await command("Runtime.evaluate", {
            expression: `document.querySelector('.inbox-list .inbox-item')?.click()`,
          });
          await pause(900);
        }
        const result = await command("Runtime.evaluate", {
          expression: `(() => ({
            width: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            lang: document.documentElement.lang,
            dir: document.documentElement.dir,
            urlLang: new URLSearchParams(location.search).get('lang'),
            linkedLocale: document.querySelector('#primary-navigation a[href^="/products"]')?.getAttribute('href')?.includes('lang=fa') || false,
            title: document.querySelector('h1')?.textContent?.trim() || '',
            font: getComputedStyle(document.body).fontFamily,
            header: getComputedStyle(document.querySelector('.site-header')).backgroundColor,
            menuVisible: getComputedStyle(document.querySelector('.menu-toggle')).display !== 'none',
            overflowNodes: [...document.querySelectorAll('body *')]
              .filter((node) => node.getBoundingClientRect().right > window.innerWidth + 1)
              .slice(0, 12)
              .map((node) => ({ tag: node.tagName, className: typeof node.className === 'string' ? node.className : '', right: Math.round(node.getBoundingClientRect().right) })),
            errorText: document.querySelector('[role="alert"]')?.textContent?.trim() || '',
            englishText: ${process.env.DESIGN_REVIEW_AUDIT_TRANSLATIONS ? `(() => {
              const walker = document.createTreeWalker(document.querySelector('#root'), NodeFilter.SHOW_TEXT);
              const results = [];
              while (walker.nextNode()) {
                if (walker.currentNode.parentElement?.closest('[hidden]')) continue;
                const value = walker.currentNode.nodeValue.trim();
                if (/[A-Za-z]{3}/.test(value) && value.length < 220) results.push(value);
              }
              return [...new Set(results)].slice(0, 120);
            })()` : `[]`}
          }))()`,
          returnByValue: true,
        });
        const metrics = result.result.value;
        if (route === "/staff" && process.env.DESIGN_REVIEW_AUDIT_VIEWS) {
          const reviewViews = process.env.DESIGN_REVIEW_AUDIT_VIEWS.split(",");
          if (reviewViews.some((view) => !/^[a-z]+$/.test(view))) throw new Error("Invalid review views");
          const viewAudit = await command("Runtime.evaluate", {
            expression: `(async () => {
              const output = [];
              for (const view of ${JSON.stringify(reviewViews)}) {
                document.querySelector('.workspace-nav [data-view="' + view + '"]')?.click();
                await new Promise((done) => setTimeout(done, 900));
                const walker = document.createTreeWalker(document.querySelector('.workspace-content'), NodeFilter.SHOW_TEXT);
                const values = [];
                while (walker.nextNode()) {
                  if (walker.currentNode.parentElement?.closest('[hidden]')) continue;
                  const value = walker.currentNode.nodeValue.trim();
                  if (/[A-Za-z]{3}/.test(value) && value.length < 220) values.push(value);
                }
                output.push({ view, englishText: [...new Set(values)].slice(0, 140) });
              }
              return output;
            })()`,
            awaitPromise: true,
            returnByValue: true,
          });
          metrics.staffViews = viewAudit.result.value;
        }
        if (route === "/portal" && process.env.DESIGN_REVIEW_AUDIT_PORTAL_VIEWS) {
          const reviewViews = process.env.DESIGN_REVIEW_AUDIT_PORTAL_VIEWS.split(",");
          if (reviewViews.some((view) => !/^[a-z]+$/.test(view))) throw new Error("Invalid portal review views");
          const viewAudit = await command("Runtime.evaluate", {
            expression: `(async () => {
              const output = [];
              for (const view of ${JSON.stringify(reviewViews)}) {
                document.querySelector('.workspace-nav [data-view="' + view + '"]')?.click();
                await new Promise((done) => setTimeout(done, 900));
                const walker = document.createTreeWalker(document.querySelector('.workspace-content'), NodeFilter.SHOW_TEXT);
                const values = [];
                while (walker.nextNode()) {
                  if (walker.currentNode.parentElement?.closest('[hidden]')) continue;
                  const value = walker.currentNode.nodeValue.trim();
                  if (/[A-Za-z]{3}/.test(value) && value.length < 220) values.push(value);
                }
                output.push({ view, englishText: [...new Set(values)].slice(0, 140) });
              }
              return output;
            })()`,
            awaitPromise: true,
            returnByValue: true,
          });
          metrics.portalViews = viewAudit.result.value;
        }
        const pageName = route === "/" ? "home" : route.replace(/^\/+/, "").replace(/[^a-z0-9]+/gi, "-");
        if (bottomReview) {
          await command("Runtime.evaluate", { expression: "document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, document.documentElement.scrollHeight)" });
          await pause(150);
        }
        if (targetReview) {
          await command("Runtime.evaluate", {
            expression: `document.documentElement.style.scrollBehavior = 'auto'; document.querySelector(${JSON.stringify(targetReview)})?.scrollIntoView({ block: 'start', behavior: 'auto' })`,
          });
          await pause(150);
        }
        const targetSuffix = targetReview ? `-${targetReview.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}` : "";
        const file = join(outputDir, `${pageName}-${viewport.width}${bottomReview ? "-bottom" : ""}${targetSuffix}.png`);
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
              let catalogFilterWorks = null;
              if (location.pathname === '/products') {
                const categories = [...document.querySelectorAll('.mx-filter-sidebar fieldset:first-of-type label')];
                const category = categories.find((label) => label.textContent.trim() === 'Base Oils')?.querySelector('input[type="checkbox"]');
                if (category) {
                  const initialParams = new URLSearchParams(location.search);
                  category.click();
                  await new Promise((done) => setTimeout(done, 100));
                  const expectedCategory = initialParams.get('category') === 'Base Oils' ? null : 'Base Oils';
                  catalogFilterWorks = new URLSearchParams(location.search).get('category') === expectedCategory &&
                    (initialParams.size > 0 || document.querySelectorAll('.mx-catalog-card').length === 4);
                } else {
                  catalogFilterWorks = false;
                }
              }
              let unitValuePreserved = null;
              if (location.pathname === '/buy' || location.pathname === '/sell') {
                const units = document.querySelector('select[name="unit"]');
                unitValuePreserved = [...units.options].some((option) => option.value === 'MT') &&
                  [...units.options].some((option) => option.value === 'Barrel');
              }
              let languageSwitches = null;
              if (${Boolean(process.env.DESIGN_REVIEW_LOCALE)}) {
                const toggle = document.querySelector('.language-toggle');
                const before = document.documentElement.lang;
                toggle.click();
                await wait();
                const changed = document.documentElement.lang !== before &&
                  new URLSearchParams(location.search).get('lang') !== before;
                toggle.click();
                await wait();
                languageSwitches = changed && document.documentElement.lang === before &&
                  new URLSearchParams(location.search).get('lang') === (before === 'fa' ? 'fa' : null);
              }
              return { menuOpens, filterOpens, catalogFilterWorks, unitValuePreserved, languageSwitches };
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
    if (findings.some((item) => item.overflow || item.errorText || item.menuOpens === false || item.filterOpens === false || item.catalogFilterWorks === false || item.unitValuePreserved === false || item.languageSwitches === false || (process.env.DESIGN_REVIEW_LOCALE && item.lang !== process.env.DESIGN_REVIEW_LOCALE) || (process.env.DESIGN_REVIEW_LOCALE === "fa" && (item.urlLang !== "fa" || !item.linkedLocale)))) process.exitCode = 1;
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
