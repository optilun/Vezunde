import { chromium } from 'playwright-core';
const b = await chromium.launch({ args: ['--no-sandbox'] });
const out = [];
for (const [w, h, page] of [[1114, 857, 'map'], [1440, 900, 'map'], [390, 844, 'list'], [320, 640, 'list']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`http://localhost:4173/?s=full${page === 'map' ? '&page=map' : ''}`, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const measure = (label) => p.evaluate((label) => {
    const list = document.getElementById('list') || document.querySelector('[class*=overflow-y-auto][class*=overscroll-contain]');
    const root = list.firstElementChild;              // radacina MatchResults
    const tabs = root.children[0];                     // randul cu file
    const sticky = root.children[1];                   // randul zona + filtre (+ etichete)
    const r = (e) => { const b = e.getBoundingClientRect(); return { y: Math.round(b.y), h: Math.round(b.height), w: Math.round(b.width) }; };
    const tabBtns = [...tabs.querySelectorAll('button')].map((e) => ({ t: e.textContent.trim().slice(0, 22), h: Math.round(e.getBoundingClientRect().height), lines: Math.round(e.querySelector('span').getBoundingClientRect().height) }));
    const pills = [...sticky.firstElementChild.children].map((e) => ({ t: e.textContent.trim().slice(0, 18), ...r(e) }));
    const chipRow = sticky.children[1];
    return { label, listW: Math.round(list.getBoundingClientRect().width), tabsH: r(tabs).h, tabBtns, stickyH: r(sticky).h, pos: getComputedStyle(sticky).position, pillsRowSameLine: new Set(pills.map((x) => x.y)).size === 1, pills, chipsH: chipRow ? r(chipRow).h : 0, docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, clipTabs: tabs.firstElementChild.scrollWidth > tabs.firstElementChild.clientWidth + 1 };
  }, label);
  out.push({ w, base: await measure('sem filtre') });
  await p.getByRole('button', { name: /Filtre/ }).click();
  await p.waitForTimeout(250);
  const rows = p.locator('[data-radix-popper-content-wrapper] label');
  await rows.nth(0).click(); await p.waitForTimeout(120);
  await rows.nth(rows.count ? (await rows.count()) - 1 : 5).click(); await p.waitForTimeout(120);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  out.push({ w, cu2filtre: await measure('2 filtre') });
  await p.close();
}
for (const o of out) console.log(JSON.stringify(o));
await b.close();
