import type { Browser, BrowserContext, Locator, Page, PageScreenshotOptions, Response } from "playwright";

export { chromium, firefox, webkit, devices } from "playwright";

export type BrowserName = "chromium" | "firefox" | "webkit";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface CookieInput {
  name: string;
  value: string;
  /** Either `url`, or `domain` (+ optional `path`, defaults to "/") is required. */
  url?: string;
  domain?: string;
  path?: string;
  /** Unix time in seconds. `expirationDate` (Chrome export format) is accepted too. */
  expires?: number;
  expirationDate?: number;
  httpOnly?: boolean;
  secure?: boolean;
  /** "Strict" | "Lax" | "None"; lowercase and Chrome's "no_restriction" are accepted. */
  sameSite?: string;
  [extra: string]: unknown;
}

export interface OpenBrowserOptions {
  /** Which engine to launch. Default: "chromium". */
  browser?: BrowserName;
  /** Default: true. The legacy value "new" also means headless. */
  headless?: boolean | "new";
  /** Milliseconds to slow every Playwright action by. Default: 30. */
  slowMo?: number;
  /** Cookies to set before the first navigation. */
  cookies?: CookieInput[] | null;
  /** Default: { width: 1920, height: 1080 }. Pass null to disable the fixed viewport. */
  viewport?: { width: number; height: number } | null;
  /** Default navigation timeout in ms. Default: 60000. Use 0 to disable. */
  navigationTimeout?: number;
  /** Extra command-line arguments for the browser executable. */
  args?: string[];
  /** Browser distribution channel, e.g. "chrome" or "msedge" to use an installed browser. */
  channel?: string;
  /** Path to a browser executable instead of the one Playwright manages. */
  executablePath?: string;
  /** Launch timeout in ms. */
  timeout?: number;
}

export interface BrowserHandlerOptions {
  /** Minimum log level of the built-in logger-standard logger. Default: "info". */
  logLevel?: LogLevel;
}

export default class BrowserHandler {
  constructor(downloadPath?: string, options?: BrowserHandlerOptions);

  /** Folder where screenshots and downloads are saved. */
  downloadPath: string;

  readonly browser: Browser | null;
  readonly context: BrowserContext | null;
  readonly page: Page | null;

  openBrowser(options?: OpenBrowserOptions | null): Promise<void>;
  openBrowser(cookies: CookieInput[] | null, headless?: boolean | "new", slowMo?: number): Promise<void>;
  closeBrowser(): Promise<void>;
  openNewPage(): Promise<Page>;
  closeCurrentPage(): Promise<void>;
  configureDownloadsFolder(): Promise<void>;

  goToPage(url: string, options?: Parameters<Page["goto"]>[1]): Promise<Response | null>;
  click(selector: string, options?: Parameters<Page["click"]>[1]): Promise<void>;
  fill(selector: string, text: string, options?: Parameters<Page["fill"]>[2]): Promise<void>;
  getText(selector: string): Promise<string>;
  elementExists(selector: string, timeout?: number): Promise<boolean>;
  getElementHrefLink(selector: string): Promise<string>;
  getElementsHrefLink(selector: string): Promise<string[]>;
  getElementBySelector(selector: string): Promise<Locator>;
  getElementsBySelector(selector: string): Promise<Locator[]>;
  isElementDisabled(element: Locator): Promise<boolean>;
  scrollDown(distance?: number, delay?: number): Promise<void>;

  screenshot(fileName: string, fileExt?: "png" | "jpg" | "jpeg", options?: PageScreenshotOptions): Promise<string>;
  sleep(limit: number, start?: number): Promise<void>;
}

export { BrowserHandler };
