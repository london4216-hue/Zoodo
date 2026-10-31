import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]||'';
const begin=script.indexOf('let linkRefreshInFlight=');
const end=script.indexOf('const fmt=',begin);
assert.ok(begin>=0&&end>begin,'link classifier exists');

class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.parentElement=null;this.dataset={};this.href='';this.className='';this.textContent='';}
 appendChild(child){if(child.parentElement)child.parentElement.children=child.parentElement.children.filter(x=>x!==child);this.children.push(child);child.parentElement=this;return child;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
 querySelectorAll(sel){return sel==='a[href]'?this.children.filter(x=>x.tag==='a'&&x.href):[];}
 querySelector(sel){if(sel==='a[data-zoo-home]')return this.children.find(x=>x.tag==='a'&&x.dataset.zooHome)||null;
  if(sel==='.time')return this.children.find(x=>x.className==='time')||null;return null;}
}
test('fresh link is promoted, expires without page reload, and can be reverified',async()=>{
 const nav=new Element(),repair=new Element();
 const a=new Element('a');a.href='https://example.test/a';
 const b=new Element('a');b.href='https://example.test/b';
 nav.appendChild(a);nav.appendChild(b);
 let now=Date.parse('2026-10-30T15:00:00Z');
 const original=now;
 let ledger={links:[{url:a.href,checkedAt:new Date(now).toISOString(),expectedLandingVerified:true,independentCheck:true,
  commitSha:'a'.repeat(40),receiptUrl:'https://github.com/example/receipt'}]};
 class Clock extends Date {static now(){return now;}}
 const context={Date:Clock,Map,Number,Error,document:{
  querySelector:()=>nav,getElementById:()=>repair,createElement:tag=>new Element(tag)},
  $:()=>repair,fetch:async()=>({ok:true,json:async()=>ledger})};
 vm.runInNewContext(script.slice(begin,end)+'\nthis.classifyDemoLinks=classifyDemoLinks;',context);
 await context.classifyDemoLinks();
 assert.equal(a.parentElement,nav);
 assert.equal(b.parentElement.tag,'div');
 assert.equal(repair.children.length,1);
 now=original+61*60000;
 await context.classifyDemoLinks();
 assert.equal(repair.children.length,2,'stale verified receipt must be demoted');
 assert.ok(nav.children.some(x=>x.dataset.zooHome),'dashboard home remains visible');
 ledger={links:[{url:b.href,checkedAt:new Date(now).toISOString(),expectedLandingVerified:true,independentCheck:true,
  commitSha:'b'.repeat(40),receiptUrl:'https://github.com/example/new-receipt'}]};
 await context.classifyDemoLinks();
 assert.equal(b.parentElement,nav,'new verified link must be promoted without reload');
 assert.equal(a.parentElement.tag,'div');
 assert.equal(repair.children.length,1);
 assert.ok(!nav.children.some(x=>x.dataset.zooHome),'fallback home removed when verified link returns');
});
test('failed verification-ledger fetch does not retain stale green navigation',async()=>{
 const nav=new Element(),repair=new Element(),a=new Element('a');a.href='https://example.test/a';nav.appendChild(a);
 const context={Date,Map,Number,Error,document:{querySelector:()=>nav,getElementById:()=>repair,createElement:tag=>new Element(tag)},
  $:()=>repair,fetch:async()=>{throw Error('offline')}};
 vm.runInNewContext(script.slice(begin,end)+'\nthis.classifyDemoLinks=classifyDemoLinks;',context);
 await context.classifyDemoLinks();
 assert.equal(repair.children.length,1);
 assert.match(repair.children[0].querySelector('.time').textContent,/ledger unavailable/);
 assert.ok(nav.children.some(x=>x.dataset.zooHome));
});
