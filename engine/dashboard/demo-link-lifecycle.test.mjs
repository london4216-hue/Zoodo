import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.parentElement=null;this.textContent='';}
 appendChild(child){child.remove();this.children.push(child);child.parentElement=this;return child;}
 insertBefore(child,before){if(child===before)return child;child.remove();const i=this.children.indexOf(before);this.children.splice(i<0?this.children.length:i,0,child);child.parentElement=this;return child;}
 remove(){if(this.parentElement){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}}
 get firstChild(){return this.children[0]||null;}
 querySelector(selector){return this.children.find(x=>selector==='.time'?x.className==='time':x.tag==='a'&&x.dataset.zooHome)||null;}
 querySelectorAll(){return this.children.filter(x=>x.tag==='a'&&x.href);}
}
function setup(){
 const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const start=html.indexOf('const repairRows=new Map();');
 const end=html.indexOf('let mirrorCheckInFlight=false;',start);
 assert.ok(start>=0&&end>start);
 const nav=new Element(),repair=new Element(),link=new Element('a');
 link.href='https://example.com/demo';link.textContent='Existing demo';nav.appendChild(link);
 let receipts=[];
 const ctx=vm.createContext({Date,Map,Number,Error,AbortSignal,
 document:{querySelector:()=>nav,createElement:tag=>new Element(tag)},
 $:()=>repair,fetch:async()=>({ok:true,json:async()=>({links:receipts})})});
 vm.runInContext('let linkRefreshInFlight=false,directoryLinks=null;'+html.slice(start,end),ctx);
 return {nav,repair,link,refresh:()=>vm.runInContext('classifyDemoLinks()',ctx),
 verify:()=>{receipts=[{url:link.href,expectedLandingVerified:true,independentCheck:true,commitSha:'a'.repeat(40),receiptUrl:'https://github.com/owner/repo/commit/x',checkedAt:new Date().toISOString()}];},
 expire:()=>{receipts=[];}};
}
test('repeated verification and expiry preserve each demo link in the visible destination',async()=>{
 const s=setup();
 for(let cycle=0;cycle<3;cycle++){
  s.expire();await s.refresh();
  assert.notEqual(s.link.parentElement,s.nav,'unverified link must leave the hidden launchpad');
  assert.equal(s.link.parentElement.parentElement,s.repair,'unverified link must be available in repair list');
  assert.equal(s.link.href,'https://example.com/demo');
  s.verify();await s.refresh();
  assert.equal(s.link.parentElement,s.nav);
  assert.equal(s.link.dataset.zooVerified,'true');
 }
});
