import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ASSETS,filterAssets,assetHost} from '../asset-directory.mjs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('owned demos and assets lead the page before technical details',()=>{
 const html=read('index.html');
 assert.match(html,/<title>ZOO \| My demos &amp; assets<\/title>|<title>ZOO \| My demos & assets<\/title>/);
 for(const id of ['library','my-demos','my-assets','zoo-activity','asset-search','library-empty','operational-details'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.indexOf('id="library"')<html.indexOf('id="operational-details"'));
 assert.doesNotMatch(html,/<details[^>]*id="operational-details"[^>]* open/);
 assert.ok(html.indexOf('id="demo-cards"')<html.indexOf('id="zoo-activity"'));
 assert.match(html,/aria-label="Main navigation"/);
});
test('directory contains unique products, original demo doors and clear hosts without fabricating live status',()=>{
 assert.equal(new Set(ASSETS.map(x=>x.id)).size,ASSETS.length);
 const links=ASSETS.flatMap(x=>x.links.map(link=>link[1]));
 for(const url of ['https://beautypaths.io/app','https://beautypaths.io/enter','https://beautypaths.io/tour',
  'https://wonup2.transendtiq2.com/demo?as=student','https://wonup2.transendtiq2.com/demo?as=school_admin',
  'https://prestigeengage-demo.netlify.app/','https://ez-move-transcendiq.netlify.app/demo',
  './labs/myblock/index.html','./labs/yearbook3/index.html',
  'https://transcendiq-control-panel.netlify.app/pitch/control-panel.html'])
  assert.ok(links.includes(url),url);
 assert.equal(ASSETS.filter(x=>x.type==='demo').length,6);
 for(const asset of ASSETS){
  assert.ok(assetHost(asset).includes('.'));
  assert.ok(asset.description.length>35);assert.ok(asset.category.length>3);
  assert.doesNotMatch(asset.status,/verified live|all healthy|repair complete/i);
  for(const [,url] of asset.links)assert.ok(url.startsWith('https://')||url.startsWith('./labs/'));
 }
});
test('search is case insensitive, multiword, host-aware, and correctly scoped',()=>{
 assert.equal(filterAssets(ASSETS,'BEAUTYPATH','demo').length,1);
 assert.equal(filterAssets(ASSETS,'My Block','all')[0].id,'myblock');
 assert.ok(filterAssets(ASSETS,'school student','demo').some(asset=>asset.id==='wonup'));
 assert.equal(filterAssets(ASSETS,'beautypath-grad.netlify.app','demo')[0].id,'beautypath');
 assert.equal(filterAssets(ASSETS,'nothing-matches-839234').length,0);
 assert.equal(filterAssets(ASSETS,'','all').length,ASSETS.length);
 assert.ok(filterAssets(ASSETS,'','asset').every(x=>x.type==='asset'));
});
test('hosting is collapsed operational context, never a fabricated operational backup',()=>{
 const html=read('index.html');
 assert.match(html,/id="hosting-recovery"/);assert.match(html,/No independent recovery host is verified here/);
 assert.match(html,/A connected provider is not an operational backup/);
 assert.match(html,/cost and portability comparison/);
 assert.doesNotMatch(html,/<details[^>]*id="hosting-recovery"[^>]* open/);
 assert.ok(ASSETS.every(asset=>asset.links.every(([,url])=>!url.includes('vercel.app'))));
});
test('owner-selected BeautyPath layout is the exact primary destination, old workspaces secondary',()=>{
 const bp=ASSETS.find(asset=>asset.id==='beautypath');
 assert.deepEqual(bp.links[0],['Open demo','https://beautypath-grad.netlify.app/?v=f5603ca0-mvtxsvfj']);
 assert.equal(assetHost(bp),'beautypath-grad.netlify.app');
 assert.equal(ASSETS.filter(asset=>asset.name.startsWith('BeautyPath')).length,1);
 assert.equal(bp.status,'Owner-selected demo');
 assert.ok(bp.links.slice(1).some(([label,url])=>label==='Workspace'&&url==='https://beautypaths.io/app'));
 assert.match(read('index.html'),/Public demos\. Clear tenant and role journeys\. Production sign-in stays separate/);
 assert.match(read('asset-directory.mjs'),/Demo journey standard: not yet verified/);
});
test('large touch controls, responsive cards and text-only safe rendering are present',()=>{
 const css=read('library.css'),module=read('asset-directory.mjs');
 assert.match(css,/font-size:16px/);assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/grid-template-columns:1fr/);assert.match(css,/min-height:45px/);
 assert.match(css,/:focus-visible/);assert.match(module,/textContent/);
 assert.doesNotMatch(module,/innerHTML|Authorization|Bearer/);
 assert.match(module,/aria-pressed/);assert.match(module,/library-clear/);
 const prep=read('scripts/prepare-mirror.mjs');
 assert.ok(prep.includes("'asset-directory.mjs'"));assert.ok(prep.includes("'library.css'"));
});
