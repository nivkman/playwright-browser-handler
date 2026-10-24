import BrowserHandler from "./browser-handler.js";

// Full access to Playwright, straight from this package.
export { chromium, firefox, webkit, devices } from "playwright";
export { BrowserHandler };
export default BrowserHandler;
