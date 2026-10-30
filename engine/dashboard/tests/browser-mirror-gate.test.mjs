import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const inline=html.match(/<script type="module">([\\s\\S]*?)<\\/script>/)?.[1]||'';
const source=inline.match(/async function checkHostingMirrors\\(\\)\\{[\\s\\S]*?\\n\\}\\nconst fmt=/)?.[0].replace(/\\nconst fmt=$/,'');
assert.ok(source,'browser mirror check must be present');

function element(tag='div'){
 return {tag,children:[],textContent:'',className:'',
  append(...nodes){this.children.push(...nodes)},
  replaceChildren(){this.children=[]}
 };
}
function mockResponse(url,body,{redirect=null}={}){
 return {ok:true,status:200,url:redirect||String(url),
   json:async()=>body,text:async()=>String(body)};
}
async function inspect({manifestSha='a'.repeat(40),badHtml=false,redirect=false}={}){
 const sha='a'.repeat(40), box=element(), stamp=element();
 const fixtures={
  '/build-proof.json':{schema_version:1,build_tests:'PASSED',source_commit:sha},
  '/mirror-manifest.json':{schema_version:1,source_commit:manifestSha,browser_verified:false},
  '/index.html':badHtml?'<main>WRONG DASHBOARD</main>':'<main id="accountability">ZOO</main>',
  '/evidence-clock.mjs':'export function evaluateEvidence() {}',
  '/labs/myblock/index.html':'My Block · Creator-first lab',
  '/labs/myblock/logic.mjs':'export function publishPost() {}',
  '/labs/yearbook3/index.html':'Yearbook 3 · Student Lab',
  '/labs/yearbook3/logic.mjs':'export function submitEntry() {}'
 };
 const fetcher=async url=>{
  if(String(url)==='./hosting-mirrors.json')
   return mockResponse('https://primary.example/hosting-mirrors.json',
    {primary:{provider:'Netlify'},mirrors:[{provider:'Vercel',url:'https://mirror.example/'}]});
  if(String(url)==='./build-proof.json')
   return mockResponse('https://primary.example/build-proof.json',fixtures['/build-proof.json']);
  const path=new URL(String(url)).pathname;
  assert.ok(Object.hasOwn(fixtures,path),'unexpected asset request '+path);
  return mockResponse(url,fixtures[path],{redirect:redirect&&path==='/index.html'?'https://different.example/index.html':null});
 };
 const context={URL,AbortSignal,fetch:fetcher,Date,
  $:id=>id==='hostMirrorRows'?box:stamp,
  document:{createElement:element}};
 const check=vm.runInNewContext('let mirrorCheckInFlight=false;\\n'+source+'\\ncheckHostingMirrors',context);
 await check();
 const rows=box.children.filter(x=>x.tag==='div');
 const anchors=rows.flatMap(x=>x.children.filter(y=>y.tag==='a'));
 return {anchors,rows,stamp};
}
test('matching SHA plus real dashboard and lab assets permits a static mirror link',async()=>{
 const r=await inspect();
 assert.equal(r.anchors.length,1);
 assert.match(r.rows[0].children.find(x=>x.className==='time').textContent,/STATIC ASSETS CHECKED/);
});
test('a green build receipt with wrong dashboard HTML never promotes a mirror',async()=>{
 assert.equal((await inspect({badHtml:true})).anchors.length,0);
});
test('a mismatched manifest SHA never promotes a mirror',async()=>{
 assert.equal((await inspect({manifestSha:'b'.repeat(40)})).anchors.length,0);
});
test('redirect to a different host never promotes a mirror',async()=>{
 assert.equal((await inspect({redirect:true})).anchors.length,0);
});
test('public mirror configs permit cross-origin verification of HTML and lab JS',()=>{
 const prep=readFileSync(resolve(root,'scripts/prepare-mirror.mjs'),'utf8');
 const vercel=JSON.parse(readFileSync(resolve(root,'vercel.json'),'utf8'));
 const render=readFileSync(resolve(root,'../../render.yaml'),'utf8');
 assert.match(prep,/'\\/\\*'/);
 assert.ok(vercel.headers.some(x=>x.source==='/(.*)'&&x.headers.some(h=>h.key==='Access-Control-Allow-Origin'&&h.value==='*')));
 assert.match(render,/path: \\/\\*/);
});
