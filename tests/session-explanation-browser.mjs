import assert from "node:assert/strict";
import { chromium } from "playwright-core";

export async function checkExplanationUI({ base, cookie, workspace, run, source, sendLiveUpdate, channel, disconnectSubscription }) {
  const browser = await chromium.launch(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 850 } });
      const [name, value] = cookie.split("=");
      await context.addCookies([{ name, value, url: base.origin }]);
      await context.addInitScript(({ workspace, run }) => {
        sessionStorage.setItem("socket-run:" + workspace, run);
      }, { workspace, run });
      const page = await context.newPage();
      await page.goto(new URL("/realtime?workspace=" + workspace, base).href);
      if (width === 1280) {
        await page.route(url => url.searchParams.has("explain"), route =>
          route.fulfill({ status: 503, json: { error: "History temporarily unavailable" } }), { times: 1 });
      }
      await page.getByRole("button", { name: "Explain this session" }).click({ timeout: 60000 });
      if (width === 1280) {
        await page.getByText("History temporarily unavailable").waitFor();
        await page.getByRole("button", { name: "Retry explanation" }).click();
        await page.getByText("No further updates were recorded after the server error.").waitFor();
        await sendLiveUpdate();
        const updateLink = page.getByRole("link", { name: /One server message arrived/ });
        await updateLink.waitFor();
        assert.equal(await page.getByText(/No further updates were recorded/).count(), 0);
        await updateLink.click();
        assert.match(await page.locator(".ws-event[data-source] pre").innerText(), new RegExp(channel));
        await disconnectSubscription();
        await page.getByText(/The connection closed with reason/).waitFor();
      }
      const link = page.getByRole("link", { name: /rejected the subscription.*channel is missing/ });
      const target = page.locator(`#ws-event-${run}-${source}`);
      assert.equal(await target.count(), 0);
      await link.click();
      await target.locator("summary:focus").waitFor();
      assert.equal(await target.getAttribute("open"), "");
      assert.equal(await target.getAttribute("data-source"), "true");
      assert.match(await target.locator("pre").innerText(), /channel is missing/);
      await page.getByRole("button", { name: "Return to live" }).click();
      await target.waitFor({ state: "detached" });
      assert.ok(await link.evaluate(el => el.closest(".ws-explain").scrollWidth <= el.closest(".ws-explain").clientWidth));
      if (process.env.WS_SCREENSHOTS)
        await page.locator(".ws-explain").screenshot({ path: `${process.env.WS_SCREENSHOTS}/ws-explanation-${width}.png` });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
