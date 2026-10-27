# playwright-browser-handler 🎭

[![npm version](https://img.shields.io/npm/v/playwright-browser-handler)](https://www.npmjs.com/package/playwright-browser-handler)

[![npm version](https://img.shields.io/npm/v/playwright-browser-handler.svg)](https://www.npmjs.com/package/playwright-browser-handler)
[![npm downloads](https://img.shields.io/npm/dm/playwright-browser-handler.svg)](https://www.npmjs.com/package/playwright-browser-handler)
[![tests](https://github.com/nivkman/playwright-browser-handler/actions/workflows/test.yml/badge.svg)](https://github.com/nivkman/playwright-browser-handler/actions/workflows/test.yml)
[![license](https://img.shields.io/npm/l/playwright-browser-handler.svg)](./LICENSE)

A convenient wrapper around [Playwright](https://playwright.dev) for browser automation. One line to open a browser, then navigate, click, fill forms, scrape links, take screenshots and collect downloads — while keeping full access to the Playwright `page` whenever you need it.

Same API as [`puppet-browser-handler`](https://github.com/nivkman/puppet-browser-handler), now running on Playwright: Chromium, Firefox **and** WebKit, with browsers managed by Playwright instead of a hard-coded Chrome path.

## 🚀 Installation

Requires Node.js 20 or newer.

```bash
npm install playwright-browser-handler
npx playwright install chromium   # once — downloads the browser (add firefox / webkit if you want them)
```

## ⚡ Quick Start

```javascript
import BrowserHandler from 'playwright-browser-handler';

const browser = new BrowserHandler('./downloads');

await browser.openBrowser();
await browser.goToPage('https://example.com');

const title = await browser.getText('h1');
const links = await browser.getElementsHrefLink('a');
await browser.screenshot('example', 'png');          // ./downloads/example.png

await browser.closeBrowser();
```

Logging in and downloading a report:

```javascript
await browser.openBrowser({ headless: false, slowMo: 50 });
await browser.goToPage('https://app.example.com/login');
await browser.fill('#email', process.env.EMAIL);
await browser.fill('#password', process.env.PASSWORD);
await browser.click('button[type=submit]');

if (await browser.elementExists('#dashboard')) {
  await browser.click('#export-csv');               // lands in ./downloads automatically
  await browser.sleep(3, 1);                        // human-like pause: 1–3 seconds
}
await browser.closeBrowser();
```

Need something the wrapper doesn't cover? Use Playwright directly:

```javascript
await browser.page.getByRole('button', { name: 'Accept' }).click();
await browser.context.storageState({ path: 'auth.json' });
```

## ✨ Features

### 🌐 Browser Management
- One-line launch of **Chromium, Firefox or WebKit** (or your installed Chrome/Edge via `channel`)
- Open and close browser sessions and tabs
- Set cookies before the first navigation — Chrome cookie exports work as-is
- Sensible defaults: 1920×1080 viewport, 60 s navigation timeout, headless

### 🔍 Page Navigation and Interaction
- Navigate to URLs, click elements, fill inputs
- Check element existence with a timeout
- Read text and absolute `href` links from one or many elements
- Scroll to the bottom of infinite pages
- Get Playwright `Locator`s for anything else

### 📥 Downloads & Screenshots
- Every download, on every tab, is saved into your downloads folder
- Full-page screenshots as PNG or JPEG, path returned

### 🛠️ Utilities
- Random human-like `sleep(limit, start)` delays
- Timestamped logging via [`logger-standard`](https://www.npmjs.com/package/logger-standard)
- `.d.ts` types included — great IDE support in plain JavaScript too
- `handler.page`, `handler.context`, `handler.browser` escape hatches, plus `chromium` / `firefox` / `webkit` / `devices` re-exported

## 📖 API Reference

### Constructor

```javascript
const browser = new BrowserHandler(downloadPath = './downloads', { logLevel = 'info' } = {});
```

### Browser control

| Method | Description |
|--------|-------------|
| `openBrowser(options?)` | Launches a browser and opens the first page. See options below. |
| `openBrowser(cookies, headless?, slowMo?)` | Legacy `puppet-browser-handler` signature — still works. |
| `closeBrowser()` | Closes the browser and all its pages. |
| `openNewPage()` | Opens a new tab and makes it the current page. Returns the Playwright `Page`. |
| `closeCurrentPage()` | Closes the current tab; the last remaining tab becomes current. |
| `configureDownloadsFolder()` | Creates the downloads folder and routes all downloads into it (called by `openBrowser`). |

#### `openBrowser` options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `browser` | `'chromium' \| 'firefox' \| 'webkit'` | `'chromium'` | Engine to launch |
| `headless` | `boolean` | `true` | Run without a visible window (`'new'` is accepted for compatibility) |
| `slowMo` | `number` | `30` | Milliseconds to slow each action by |
| `cookies` | `Cookie[]` | `null` | Cookies to set before navigating (`name`, `value` + `url` or `domain`) |
| `viewport` | `{ width, height } \| null` | `1920×1080` | Page size; `null` disables the fixed viewport |
| `navigationTimeout` | `number` | `60000` | Default navigation timeout in ms; `0` disables it |
| `args` | `string[]` | — | Extra command-line flags for the browser |
| `channel` | `string` | — | `'chrome'`, `'msedge'`… to use an installed browser |
| `executablePath` | `string` | — | Use a specific browser binary |
| `timeout` | `number` | — | Launch timeout in ms |

### Navigation & interaction

| Method | Description |
|--------|-------------|
| `goToPage(url, options?)` | Navigates to the URL. Returns the Playwright `Response`. |
| `click(selector, options?)` | Waits for a visible match (`options.timeout` ms, default 5000), then clicks it. Throws if none appears. |
| `fill(selector, text, options?)` | Fills an input, textarea or contenteditable. |
| `getText(selector)` | Trimmed visible text of the first match. |
| `elementExists(selector, timeout = 5000)` | `true` if a visible match appears within the timeout, else `false`. |
| `getElementHrefLink(selector)` | Absolute `href` of the first match. |
| `getElementsHrefLink(selector)` | Absolute `href` of every match (elements without one are skipped). |
| `getElementBySelector(selector)` | Playwright `Locator` for the first match. |
| `getElementsBySelector(selector)` | Array of `Locator`s, one per match. |
| `isElementDisabled(locator)` | `true` if the element is disabled. |
| `scrollDown(distance = 1000, delay = 1000)` | Scrolls `distance` px every `delay` ms until the bottom. |

### Utilities

| Method | Description |
|--------|-------------|
| `screenshot(fileName, fileExt = 'png', options?)` | Full-page screenshot saved as `<downloadPath>/<fileName>.<fileExt>` (`png`, `jpg`, `jpeg`). Returns the path. |
| `sleep(limit, start = 0)` | Waits a random number of **seconds** between `start` and `limit`. |

### Properties

| Property | Description |
|----------|-------------|
| `page` | Current Playwright [`Page`](https://playwright.dev/docs/api/class-page) (`null` until `openBrowser`) |
| `context` | Playwright [`BrowserContext`](https://playwright.dev/docs/api/class-browsercontext) |
| `browser` | Playwright [`Browser`](https://playwright.dev/docs/api/class-browser) |
| `downloadPath` | Folder for screenshots and downloads |

## 🔁 Migrating from puppet-browser-handler

Swap the import — the method names and signatures are the same. What changed:

| | `puppet-browser-handler` | `playwright-browser-handler` |
|---|---|---|
| Engine | Puppeteer + Chrome at `/usr/bin/google-chrome` | Playwright-managed Chromium, Firefox or WebKit |
| Browser install | Install Chrome yourself | `npx playwright install chromium` |
| `openBrowser()` | `(cookies, headless = 'new', slowMo)` | Same, **or** an options object |
| Failures | Many methods logged the error and continued | Methods log **and throw**, so you can `try/catch` |
| `click()` / `getElementHrefLink()` | Existence check didn't actually wait | Waits up to 5 s, then throws a clear error |
| `screenshot(name, 'jpg')` | Always wrote PNG data | Writes real JPEG |
| `getElementsHrefLink()` etc. | Needed `cheerio` (which wasn't imported) | Pure Playwright — no extra dependency |
| Downloads | Current tab only, via CDP | Every tab, including popups |
| Element results | cheerio objects | Playwright `Locator`s |
| Types | — | `.d.ts` included |

New: `fill(selector, text)`, `getText(selector)`, and the `page` / `context` / `browser` properties.

## 🤔 Why playwright-browser-handler?

Playwright gives you three engines, auto-waiting, managed browser binaries and first-class downloads. This package keeps the small, readable API you already know from `puppet-browser-handler` on top of it, so a scraping or automation script is a handful of lines — and when you outgrow the wrapper, `browser.page` is the real Playwright page. Nothing to unlearn.

## 🔒 Error Handling & Logging

Every operation is logged with a timestamp and the `BrowserHandler` service prefix via `logger-standard`. Errors are logged and then thrown, so wrap your flow in `try/catch` and always `closeBrowser()` in a `finally`. Set `{ logLevel: 'error' }` in the constructor to quiet things down.

## 🧪 Tests

```bash
npm install
npx playwright install chromium
npm test
```

The suite runs a real headless Chromium against a local fixture server — no network needed.

## 📄 License

MIT

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Issues

If you find a bug or want to request a new feature, please [open an issue](https://github.com/nivkman/playwright-browser-handler/issues).
