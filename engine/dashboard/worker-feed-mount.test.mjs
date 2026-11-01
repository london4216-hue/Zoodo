import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const links=[...html.matchAll(/\\bhref\\s*=\\s*["']([^"']+)["']/g)].map(m=>m[1]);
const originalLinks=[
  "./accountability.html",
  "https://github.com/london4216-hue/TransendIQ/pull/787",
  "https://github.com/london4216-hue/TransendIQ/pull/1070",
  "https://github.com/london4216-hue/TransendIQ/pull/782",
  "https://github.com/london4216-hue/TransendIQ/pull/788",
  "https://github.com/london4216-hue/Zoodo/issues/24",
  "./priority-watch.json",
  "https://github.com/london4216-hue/Zoodo/issues/25",
  "https://github.com/london4216-hue/Zoodo/issues/27",
  "https://github.com/london4216-hue/Zoodo/issues/25",
  "https://github.com/london4216-hue/Zoodo/issues/27",
  "https://github.com/london4216-hue/Zoodo/issues/27",
  "https://github.com/london4216-hue/Zoodo/issues/17",
  "#queue-panel",
  "#labs",
  "https://github.com/london4216-hue/TransendIQ/blob/main/ops/scorecard-ledger.jsonl",
  "https://github.com/london4216-hue/TransendIQ/blob/main/ops/scorecard-ledger.jsonl",
  "./handoff-ledger.json",
  "https://github.com/london4216-hue/Zoodo/issues/18",
  "https://beautypaths.io/app",
  "https://beautypaths.io/super",
  "https://beautypaths.io/tour",
  "https://beautypaths.io/enter",
  "https://beautypath-grad.netlify.app/",
  "https://ez-move-transcendiq.netlify.app/demo",
  "https://wonup2.transendtiq2.com/login",
  "https://wonup2.transendtiq2.com/demo?as=student",
  "https://wonup2.transendtiq2.com/demo?as=school_admin",
  "https://beautypaths.io/links",
  "https://prestigeengage-demo.netlify.app/",
  "https://transcendiq-control-panel.netlify.app/pitch/control-panel.html",
  "https://app.netlify.com/projects/zoo-live-dashboard/overview",
  "https://github.com/london4216-hue/Zoodo",
  "https://github.com/london4216-hue/TransendIQ",
  "https://app.netlify.com/",
  "https://ez-move-transcendiq.netlify.app/demo",
  "https://github.com/london4216-hue/Zoodo/blob/autonomous-engine-replacement-2026-10-29/engine/dashboard/labs/myblock/index.html",
  "https://github.com/london4216-hue/Zoodo/blob/autonomous-engine-replacement-2026-10-29/engine/dashboard/labs/yearbook3/index.html",
  "https://github.com/london4216-hue/TransendIQ/tree/main/apps/movemint/source",
  "https://github.com/london4216-hue/TransendIQ/tree/main/apps/letshelp/source",
  "https://github.com/london4216-hue/Zoodo/blob/autonomous-engine-replacement-2026-10-29/engine/ARCHITECTURE_REVIEW_2026-10-30.md",
  "https://github.com/london4216-hue/Zoodo/pull/6",
  "https://github.com/london4216-hue/TransendIQ/issues/999",
  "/",
  "/labs/myblock/index.html",
  "/labs/yearbook3/index.html"
];
test('original owner links remain in order',()=>{
 let i=0;for(const link of links)if(link===originalLinks[i])i++;
 assert.equal(i,originalLinks.length,'A canonical owner link was removed or reordered');
});
test('existing dashboard mounts one receipt-backed roster without claiming live automation',()=>{
 assert.equal((html.match(/id="worker-feed-status"/g)||[]).length,1);
 assert.equal((html.match(/id="worker-feed-rows"/g)||[]).length,1);
 assert.equal((html.match(/src="\\.\\/worker-feed-panel\\.mjs"/g)||[]).length,1);
 assert.match(html,/UNKNOWN · Awaiting a valid, recent published worker feed/);
 assert.match(html,/static snapshot is not an authenticated heartbeat/);
 assert.match(html,/id="accountability"/);
 assert.match(html,/src="\\.\\/priority-watch\\.mjs"/);
});
