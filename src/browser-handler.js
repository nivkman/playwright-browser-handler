import { chromium, firefox, webkit } from "playwright";
import { Logger } from "logger-standard";
import fs from "node:fs";
import path from "node:path";

const SERVICE_NAME = "BrowserHandler";
const ENGINES = { chromium, firefox, webkit };
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };
const DEFAULT_NAVIGATION_TIMEOUT = 60_000;
const COOKIE_FIELDS = ["name", "value", "url", "domain", "path", "expires", "httpOnly", "secure", "sameSite"];
const SAME_SITE = { strict: "Strict", lax: "Lax", none: "None", no_restriction: "None" };

export default class BrowserHandler {
  /**
   * @param {string} [downloadPath="./downloads"] Where screenshots and downloads are saved.
   * @param {{ logLevel?: "debug"|"info"|"warn"|"error" }} [options]
   */
  constructor(downloadPath = "./downloads", { logLevel = "info" } = {}) {
    this._logger = new Logger({ service: SERVICE_NAME, showDate: true, logLevel });
    this._browser = null;
    this._context = null;
    this._page = null;
    this._watched = new WeakSet();
    this._navigationTimeout = DEFAULT_NAVIGATION_TIMEOUT;
    this.downloadPath = downloadPath;
  }

  /** The underlying Playwright Browser (null until openBrowser). */
  get browser() {
    return this._browser;
  }

  /** The underlying Playwright BrowserContext (null until openBrowser). */
  get context() {
    return this._context;
  }

  /** The current Playwright Page — your escape hatch to the full Playwright API. */
  get page() {
    return this._page;
  }

  // ─── Browser lifecycle ────────────────────────────────────────────────────

  /**
   * Launches a browser and opens the first page.
   * Accepts an options object, or the legacy `(cookies, headless, slowMo)` arguments.
   */
  async openBrowser(cookiesOrOptions = null, headless = true, slowMo = 30) {
    const options = normalizeOpenOptions(cookiesOrOptions, headless, slowMo);
    try {
      await this._launch(options);
      await this.configureDownloadsFolder();
      await this._setCookies(options.cookies);
      this._logger.info(`${options.browser} browser initialized successfully`);
    } catch (error) {
      await this._browser?.close().catch(() => {});
      this._browser = this._context = this._page = null;
      this._fail(error);
    }
  }

  async _launch(options) {
    const engine = ENGINES[options.browser];
    if (!engine) throw new Error(`Unknown browser "${options.browser}". Use "chromium", "firefox" or "webkit".`);
    const { headless, slowMo, args, channel, executablePath, timeout } = options;
    this._browser = await engine.launch({ headless, slowMo, args, channel, executablePath, timeout });
    this._context = await this._browser.newContext({ viewport: options.viewport, acceptDownloads: true });
    this._navigationTimeout = options.navigationTimeout;
    this._page = await this._newPage();
  }

  async _newPage() {
    const page = await this._context.newPage();
    page.setDefaultNavigationTimeout(this._navigationTimeout);
    this._watchDownloads(page);
    return page;
  }

  /** Closes the browser and all its pages. */
  async closeBrowser() {
    try {
      await this._browser?.close();
      this._browser = this._context = this._page = null;
      this._logger.info("Browser terminated successfully");
    } catch (error) {
      this._fail(error);
    }
  }

  /** Opens a new tab and makes it the current page. */
  async openNewPage() {
    this._requireBrowser();
    this._page = await this._newPage();
    return this._page;
  }

  /** Closes the current tab; the last remaining tab becomes current. */
  async closeCurrentPage() {
    if (!this._page) return;
    await this._page.close();
    this._page = this._context.pages().at(-1) ?? null;
  }

  // ─── Downloads & cookies ──────────────────────────────────────────────────

  /** Creates the downloads folder and saves every download (on every tab) into it. */
  async configureDownloadsFolder() {
    this._requireBrowser();
    fs.mkdirSync(this.downloadPath, { recursive: true });
    this._context.on("page", (page) => this._watchDownloads(page));
    this._context.pages().forEach((page) => this._watchDownloads(page));
    this._logger.info(`Downloads folder configured: ${path.resolve(this.downloadPath)}`);
  }

  _watchDownloads(page) {
    if (this._watched.has(page)) return;
    this._watched.add(page);
    page.on("download", (download) => this._saveDownload(download));
  }

  async _saveDownload(download) {
    const target = path.join(this.downloadPath, download.suggestedFilename());
    try {
      await download.saveAs(target);
      this._logger.info(`Download saved to ${target}`);
    } catch (error) {
      this._logger.error(`Download failed: ${error.message}`);
    }
  }

  async _setCookies(cookies) {
    if (!cookies?.length) return;
    await this._context.addCookies(cookies.map(normalizeCookie));
    cookies.forEach((cookie) => this._logger.info(`"${cookie.name}" cookie configured successfully`));
  }

  // ─── Navigation & interaction ─────────────────────────────────────────────

  /** Navigates the current page to `url`. */
  async goToPage(url, options) {
    const page = this._activePage();
    this._logger.info(`Navigating to ${url}`);
    try {
      return await page.goto(url, options);
    } catch (error) {
      this._fail(error);
    }
  }

  /** Clicks the first visible element matching `selector` (waits `options.timeout` ms, default 5000). */
  async click(selector, options) {
    await this._require(selector, `Failed to click element: ${selector}`, options?.timeout);
    await this._activePage().click(selector, options);
  }

  /** Fills an input, textarea or contenteditable matching `selector` (waits `options.timeout` ms, default 5000). */
  async fill(selector, text, options) {
    await this._require(selector, `Failed to fill element: ${selector}`, options?.timeout);
    await this._activePage().fill(selector, text, options);
  }

  /** Returns the trimmed visible text of the first element matching `selector`. */
  async getText(selector) {
    await this._require(selector, `Failed to get text from element: ${selector}`);
    return (await this._activePage().locator(selector).first().innerText()).trim();
  }

  /** Resolves true if a visible element matching `selector` appears within `timeout` ms. */
  async elementExists(selector, timeout = 5000) {
    const page = this._activePage();
    try {
      await page.locator(selector).first().waitFor({ state: "visible", timeout });
      return true;
    } catch {
      return false;
    }
  }

  /** Returns the absolute `href` of the first element matching `selector`. */
  async getElementHrefLink(selector) {
    await this._require(selector, `Failed to get href link from element: ${selector}`);
    return this._activePage().locator(selector).first().evaluate((el) => el.href);
  }

  /** Returns the absolute `href` of every element matching `selector` (elements without one are skipped). */
  async getElementsHrefLink(selector) {
    const links = await this._activePage().locator(selector).evaluateAll((els) => els.map((el) => el.href));
    return links.filter(Boolean);
  }

  /** Returns a Playwright Locator for the first element matching `selector`. */
  async getElementBySelector(selector) {
    await this._require(selector, `The element cannot be found: ${selector}`);
    return this._activePage().locator(selector).first();
  }

  /** Returns a Playwright Locator for each element matching `selector`. */
  async getElementsBySelector(selector) {
    return this._activePage().locator(selector).all();
  }

  /** Resolves true if the element (a Locator) is disabled. */
  async isElementDisabled(element) {
    return element.isDisabled();
  }

  /** Scrolls to the bottom of the page, `distance` px every `delay` ms. */
  async scrollDown(distance = 1000, delay = 1000) {
    await this._activePage().evaluate(scrollToBottom, { distance, delay });
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  /** Saves a full-page screenshot to `<downloadPath>/<fileName>.<fileExt>` and returns its path. */
  async screenshot(fileName, fileExt = "png", options = {}) {
    const page = this._activePage();
    fs.mkdirSync(this.downloadPath, { recursive: true });
    const filePath = path.join(this.downloadPath, `${fileName}.${fileExt}`);
    await page.screenshot({ path: filePath, fullPage: true, type: screenshotType(fileExt), ...options });
    this._logger.info(`Screenshot saved to ${filePath}`);
    return filePath;
  }

  /** Waits a random number of seconds between `start` and `limit`. */
  async sleep(limit, start = 0) {
    const seconds = Math.random() * (limit - start) + start;
    return new Promise((resolve) => setTimeout(resolve, Math.floor(seconds * 1000)));
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  _activePage() {
    if (!this._page) throw new Error("Browser is not open. Call openBrowser() first.");
    return this._page;
  }

  _requireBrowser() {
    if (!this._context) throw new Error("Browser is not open. Call openBrowser() first.");
  }

  async _require(selector, message, timeout = 5000) {
    if (!(await this.elementExists(selector, timeout))) throw new Error(message);
  }

  _fail(error) {
    this._logger.error(error.message);
    throw error;
  }
}

function normalizeOpenOptions(cookiesOrOptions, headless, slowMo) {
  const legacy = cookiesOrOptions === null || Array.isArray(cookiesOrOptions);
  const options = legacy ? { cookies: cookiesOrOptions, headless, slowMo } : { ...cookiesOrOptions };
  return {
    browser: "chromium",
    slowMo: 30,
    viewport: DEFAULT_VIEWPORT,
    navigationTimeout: DEFAULT_NAVIGATION_TIMEOUT,
    cookies: null,
    ...options,
    headless: options.headless !== false, // true, undefined and the legacy "new" all mean headless
  };
}

function normalizeCookie(cookie) {
  const entries = COOKIE_FIELDS.filter((key) => cookie[key] !== undefined).map((key) => [key, cookie[key]]);
  const clean = Object.fromEntries(entries);
  if (clean.expires === undefined && cookie.expirationDate) clean.expires = cookie.expirationDate;
  if (clean.sameSite !== undefined) clean.sameSite = SAME_SITE[String(clean.sameSite).toLowerCase()];
  if (clean.sameSite === undefined) delete clean.sameSite;
  if (!clean.url && !clean.path) clean.path = "/";
  return clean;
}

function screenshotType(fileExt) {
  return /^jpe?g$/i.test(fileExt) ? "jpeg" : "png";
}

// Runs inside the browser — must not reference anything outside its own scope.
function scrollToBottom({ distance, delay }) {
  return new Promise((resolve) => {
    let total = 0;
    const timer = setInterval(() => {
      window.scrollBy(0, distance);
      total += distance;
      if (total >= document.body.scrollHeight) {
        clearInterval(timer);
        resolve();
      }
    }, delay);
  });
}
