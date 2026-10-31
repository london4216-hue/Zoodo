import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('index.html',dir),'utf8');
const ledger=JSON.parse(fs.readFileSync(new URL('verified-links.json',dir),'utf8'));
const originalHrefInventory=[
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
  "'+escapeHtml(x.html_url)+'",
  "'+escapeHtml(x.html_url)+'",
  "'+escapeHtml(c.html_url)+'",
  "'+escapeHtml(x.html_url)+'"
];
const hrefs=[...html.matchAll(/href="([^"]+)"/g)].map(x=>x[1]);
test('original dashboard source hrefs remain present in original order',()=>{
 let cursor=0;
 for(const url of originalHrefInventory){const next=hrefs.indexOf(url,cursor);assert.ok(next>=cursor,'removed or reordered original link: '+url);cursor=next+1;}
});
test('no unverified demo URL is promoted to verified live navigation',()=>{
 assert.equal(ledger.schemaVersion,1);
 assert.deepEqual(ledger.links,[]);
 assert.match(html,/id="needs-verification"/);
 assert.match(html,/id="repair-links"/);
 assert.match(html,/link\.href/);
 assert.match(html,/expectedLandingVerified===true/);
 assert.match(html,/independentCheck===true/);
 assert.match(html,/3600000/);
});
test('source response, evidence refresh and automation run are separate receipts',()=>{
 for(const id of ['checked','sourceSuccess','dashboardEvidenceRefresh','lastAutomationRun'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/scheduler receipt only; functional work and active worker heartbeat NOT established/);
 assert.match(html,/Dashboard evidence refresh:/);
});
