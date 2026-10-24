import { after, before, describe, it as baseIt } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import BrowserHandler, { BrowserHandler as Named, chromium } from "../src/index.js";
import { startServer } from "./helpers/server.js";

const it = (name, fn) => baseIt(name, { timeout: 30_000 }, fn);
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "pbh-test-"));
const waitForFile = async (file, ms = 10_000) => {
  const deadline = Date.now() + ms;
  while (!fs.existsSync(file) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  return fs.existsSync(file);
};

let server, url;
before(async () => ({ server, url } = await startServer()));
after(() => server.close());

describe("exports", () => {
  it("exposes the class as default and named export, plus Playwright engines", () => {
    assert.equal(BrowserHandler, Named);
    assert.equal(typeof chromium.launch, "function");
  });
});

describe("before openBrowser", () => {
  it("throws a friendly error instead of a TypeError", async () => {
    const handler = new BrowserHandler(tmpDir(), { logLevel: "error" });
    assert.equal(handler.page, null);
    await assert.rejects(handler.goToPage(url), /Browser is not open/);
    await assert.rejects(handler.elementExists("#title"), /Browser is not open/);
    await assert.rejects(handler.openNewPage(), /Browser is not open/);
  });

  it("rejects an unknown browser name", async () => {
    const handler = new BrowserHandler(tmpDir(), { logLevel: "error" });
    await assert.rejects(handler.openBrowser({ browser: "opera" }), /Unknown browser "opera"/);
  });
});

describe("BrowserHandler (chromium)", () => {
  const downloadPath = tmpDir();
  const handler = new BrowserHandler(downloadPath, { logLevel: "error" });

  before(async () => {
    await handler.openBrowser({ slowMo: 0, cookies: [{ name: "token", value: "abc", url }] });
  });
  after(async () => {
    await handler.closeBrowser();
    fs.rmSync(downloadPath, { recursive: true, force: true });
  });

  it("exposes browser, context and page", () => {
    assert.ok(handler.browser.isConnected());
    assert.equal(handler.context.pages().length, 1);
    assert.equal(handler.page, handler.context.pages()[0]);
  });

  it("navigates and reads text", async () => {
    await handler.goToPage(url);
    assert.equal(await handler.getText("#title"), "Hello Playwright");
  });

  it("applies cookies before the first navigation", async () => {
    assert.equal(await handler.getText("#cookie"), "token=abc");
  });

  it("checks element existence with a timeout", async () => {
    assert.equal(await handler.elementExists("#title"), true);
    assert.equal(await handler.elementExists("#missing", 200), false);
  });

  it("clicks elements and fails fast on missing ones", async () => {
    await handler.click("#btn");
    assert.equal(await handler.getText("#title"), "Clicked");
    await assert.rejects(handler.click("#missing", { timeout: 300 }), /Failed to click element: #missing/);
  });

  it("fills inputs", async () => {
    await handler.fill("#name", "Niv");
    assert.equal(await handler.page.inputValue("#name"), "Niv");
    await assert.rejects(handler.fill("#missing", "x", { timeout: 300 }), /Failed to fill element: #missing/);
  });

  it("returns absolute href links", async () => {
    assert.equal(await handler.getElementHrefLink("#first"), `${url}/page2`);
    assert.deepEqual(await handler.getElementsHrefLink("a.item"), [`${url}/a`, `${url}/b`]);
    await assert.rejects(handler.getElementHrefLink("#missing"), /Failed to get href link/);
  });

  it("returns locators and reports disabled state", async () => {
    const items = await handler.getElementsBySelector("a.item");
    assert.equal(items.length, 3);
    assert.equal(await handler.isElementDisabled(await handler.getElementBySelector("#disabled")), true);
    assert.equal(await handler.isElementDisabled(await handler.getElementBySelector("#btn")), false);
    await assert.rejects(handler.getElementBySelector("#missing"), /The element cannot be found/);
  });

  it("saves screenshots in the format of the extension", async () => {
    const png = await handler.screenshot("shot", "png");
    const jpg = await handler.screenshot("shot", "jpg");
    assert.equal(png, path.join(downloadPath, "shot.png"));
    assert.deepEqual([...fs.readFileSync(png).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.deepEqual([...fs.readFileSync(jpg).subarray(0, 2)], [0xff, 0xd8]);
  });

  it("saves downloads into the downloads folder", async () => {
    await handler.click("#dl");
    assert.equal(await waitForFile(path.join(downloadPath, "hello.txt")), true);
    assert.equal(fs.readFileSync(path.join(downloadPath, "hello.txt"), "utf8"), "hello from the server");
  });

  it("scrolls to the bottom of the page", async () => {
    await handler.goToPage(`${url}/tall`);
    await handler.scrollDown(1000, 10);
    assert.ok((await handler.page.evaluate(() => window.scrollY)) >= 3000);
  });

  it("opens and closes tabs, keeping a current page", async () => {
    const first = handler.page;
    const second = await handler.openNewPage();
    assert.notEqual(second, first);
    assert.equal(handler.page, second);
    await handler.goToPage(`${url}/page2`);
    assert.equal(await handler.getText("#title"), "Page 2");
    await handler.closeCurrentPage();
    assert.equal(handler.page, first);
  });

  it("downloads from a new tab are saved too", async () => {
    await handler.openNewPage();
    await handler.goToPage(url);
    fs.rmSync(path.join(downloadPath, "hello.txt"), { force: true });
    await handler.click("#dl");
    assert.equal(await waitForFile(path.join(downloadPath, "hello.txt")), true);
    await handler.closeCurrentPage();
  });

  it("sleeps for a random time inside the range", async () => {
    const started = Date.now();
    await handler.sleep(0.2, 0.1);
    const elapsed = Date.now() - started;
    assert.ok(elapsed >= 90 && elapsed < 1000, `elapsed ${elapsed}ms`);
  });
});

describe("legacy puppet-browser-handler signature", () => {
  it("accepts (cookies, headless, slowMo) and a domain cookie", async () => {
    const downloadPath = tmpDir();
    const handler = new BrowserHandler(downloadPath, { logLevel: "error" });
    await handler.openBrowser([{ name: "legacy", value: "1", domain: "127.0.0.1" }], "new", 0);
    try {
      await handler.goToPage(url);
      assert.equal(await handler.getText("#cookie"), "legacy=1");
    } finally {
      await handler.closeBrowser();
      fs.rmSync(downloadPath, { recursive: true, force: true });
    }
    assert.equal(handler.browser, null);
    assert.equal(handler.page, null);
  });
});
