import {originalLinksFor} from './original-live-links.mjs';
// Owner-owned product doors. A recorded URL is not a live verification receipt.
export const ASSETS=[
 {id:'beautypath',name:'BeautyPath',type:'demo',initials:'BP',tone:'sage',category:'Career pathways',references:true,
  description:'Choose a student, graduate, school, salon or owner demo. Your selected BeautyPath layout, ready to open.',
  mobileDescription:'Choose your demo journey.',
  status:'Owner-selected demo',links:[
   ['Open demo','https://beautypath-grad.netlify.app/?v=f5603ca0-mvtxsvfj'],
   ['Workspace','https://beautypaths.io/app'],['Admin workspace','https://beautypaths.io/super'],
   ['Reference tour','https://beautypaths.io/tour'],['Older entry','https://beautypaths.io/enter'],
   ['Reference links','https://beautypaths.io/links'],['Base demo URL','https://beautypath-grad.netlify.app/']]},
 {id:'wonup',name:'WonUp 2',type:'demo',initials:'WU',tone:'lavender',category:'Student experience',
  description:'Choose the student or school-admin experience. Your original demo entry points, together.',
  status:'URL recorded',links:[
   ['Student demo','https://wonup2.transendtiq2.com/demo?as=student'],
   ['Admin demo','https://wonup2.transendtiq2.com/demo?as=school_admin'],
   ['Sign in','https://wonup2.transendtiq2.com/login']]},
 {id:'prestige',name:'Prestige Engage',type:'demo',initials:'PE',tone:'sand',category:'Engagement',
  description:'Open the existing Prestige Engage demo. The original experience stays separate from alternate designs.',
  status:'URL recorded',links:[['Open demo','https://prestigeengage-demo.netlify.app/']]},
 {id:'ezmove',name:'EZ Move AI',type:'demo',initials:'EZ',tone:'blue',category:'Relocation',
  description:'Walk through the relocation prototype and its buyer journey, using synthetic demo data.',
  status:'Prototype',links:[['Open demo','https://ez-move-transcendiq.netlify.app/demo']]},
 {id:'myblock',name:'My Block',type:'demo',initials:'MB',tone:'rose',category:'Creator community',
  description:'Try the creator-first community lab. Posts, membership and controls are local synthetic demonstrations.',
  status:'Synthetic lab',links:[['Open demo','./labs/myblock/index.html'],
   ['View source','https://github.com/london4216-hue/Zoodo/blob/autonomous-engine-replacement-2026-10-29/engine/dashboard/labs/myblock/index.html']]},
 {id:'yearbook',name:'Yearbook 3',type:'demo',initials:'YB',tone:'mint',category:'Student memories',
  description:'Build a fictional yearbook entry in the student lab. Demo submissions stay in your browser.',
  status:'Synthetic lab',links:[['Open demo','./labs/yearbook3/index.html'],
   ['View source','https://github.com/london4216-hue/Zoodo/blob/autonomous-engine-replacement-2026-10-29/engine/dashboard/labs/yearbook3/index.html']]},
 {id:'control-center',name:'Transcend Control Center',type:'asset',initials:'TC',tone:'slate',category:'Portfolio workspace',
  description:'Your existing control center, with its original pitch and control-panel route.',
  status:'URL recorded',links:[['View asset','https://transcendiq-control-panel.netlify.app/pitch/control-panel.html']]},
 {id:'movemint',name:'MoveMint',type:'asset',initials:'MM',tone:'sand',category:'Source collection',
  description:'Access the owned source assets. A public demo destination has not been verified.',
  status:'Source only',links:[['View asset','https://github.com/london4216-hue/TransendIQ/tree/main/apps/movemint/source']]},
 {id:'letshelp',name:"Let's Help",type:'asset',initials:'LH',tone:'lavender',category:'Source collection',
  description:'Open your community-product source collection. No live demo is claimed.',
  status:'Source only',links:[['View asset','https://github.com/london4216-hue/TransendIQ/tree/main/apps/letshelp/source']]},
 {id:'sara',name:'Sara',type:'asset',initials:'SA',tone:'rose',category:'Design & deployment',
  description:'The new UI/UX destination is still unverified. Open the discovery record rather than a guessed demo.',
  status:'Demo link needed',links:[['View discovery record','https://github.com/london4216-hue/Zoodo/issues/24']]},
 {id:'engineering',name:'Engineering source',type:'asset',initials:'ZO',tone:'slate',category:'Repositories',
  description:'Your ZOO and TransendIQ engineering repositories. Private content still requires your own access.',
  status:'Owner access may be required',links:[
   ['ZOO repository','https://github.com/london4216-hue/Zoodo'],
   ['TransendIQ repository','https://github.com/london4216-hue/TransendIQ']]}
];
export function normalizedDirectoryUrl(value,product=''){
 const url=new URL(value,'https://zoo-live-dashboard.netlify.app/');
 if(url.protocol!=='https:'||url.username||url.password)throw new TypeError('Unsafe directory URL');
 url.hash='';url.pathname=url.pathname.replace(/\/+$/,'')||'/';
 // The owner-selected versioned chooser wins over its unversioned base URL.
 // Never collapse real role/query differences such as WonUp's ?as=student.
 if(product==='beautypath'&&url.hostname==='beautypath-grad.netlify.app'&&url.pathname==='/')
  url.searchParams.delete('v');
 url.searchParams.sort();return url.href;
}
export function directoryLinksFor(asset){
 const seen=new Set(),links=[];
 const candidates=[
  ...asset.links.map(([label,url],index)=>({label,url,primary:index===0,
   kind:index===0?(asset.type==='demo'?'demo':'asset'):
    /github\.com/.test(url)?'source':/reference|older|base demo/i.test(label)?'reference':
    /demo/i.test(label)?'demo':/workspace|sign in|login/i.test(label)?'workspace':
    asset.references?'workspace':'reference'})),
  ...originalLinksFor(asset.id)
 ];
 for(const entry of candidates){
  const identity=normalizedDirectoryUrl(entry.url,asset.id);
  if(seen.has(identity)){
   // Preserve approved historical/access notes even when an older address
   // normalizes to a destination already in the current directory.
   const existing=links.find(link=>normalizedDirectoryUrl(link.url,asset.id)===identity);
   if(entry.note)existing.note=entry.note;
   if(!existing.primary)existing.kind=entry.kind;
   continue;
  }
  seen.add(identity);links.push({...entry});
 }
 return links;
}
export function filterAssets(assets,query='',scope='all',product='all'){
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return assets.filter(asset=>(scope==='all'||asset.type===scope)&&
  (product==='all'||asset.id===product)&&
  words.every(word=>[asset.name,asset.category,asset.description,asset.status,
   ...directoryLinksFor(asset).flatMap(link=>[link.label,link.url,link.kind,link.note||''])].join(' ').toLocaleLowerCase().includes(word)));
}
export function assetHost(asset){
 return new URL(asset.links[0][1],'https://zoo-live-dashboard.netlify.app/').hostname;
}
function node(tag,className,text){
 const element=document.createElement(tag);element.className=className;
 if(text!==undefined)element.textContent=text;return element;
}
const purposeByProduct={
 beautypath:'Student, graduate, school, salon and owner journeys.',
 wonup:'Student experience on the recorded app host.',
 prestige:'Existing student-engagement demo.',
 ezmove:'Synthetic relocation and buyer journey.',
 myblock:'Synthetic creator-community lab. Browser-only actions.',
 yearbook:'Fictional yearbook lab. Browser-only submissions.',
 'control-center':'Your original pitch and control-panel workspace.',
 movemint:'Owned source collection. No live demo claimed.',
 letshelp:'Community-product source collection. No live demo claimed.',
 sara:'Discovery record. A new demo address is not yet verified.',
 engineering:'Engineering repositories. Your own access may be required.'
};
const purposeByKind={
 demo:'Recorded demo journey; availability not independently checked.',
 workspace:'Workspace or sign-in; your own access may be required.',
 reference:'Saved for context; current availability not verified.',
 source:'Source record; owner access may be required.',
 design:'Recorded Figma prototype, separate from the synthetic lab.',
 preview:'Recorded preview; current availability not verified.'
};
function linkRow(link,asset){
 const row=node('a','directory-link'+(link.primary?' asset-primary':' asset-secondary'));
 row.href=link.url;row.target='_blank';row.rel='noopener noreferrer';
 row.setAttribute('aria-label',link.label+' · '+asset.name);
 const address=new URL(link.url,'https://zoo-live-dashboard.netlify.app/');
 const purpose=link.note||(link.primary?purposeByProduct[asset.id]:purposeByKind[link.kind])||'Recorded destination; current availability not verified.';
 row.append(node('span','link-label',link.label),
  node('span','link-purpose',(link.kind==='reference'?'Historical reference. ':'')+purpose),
  node('span','link-host',address.hostname));
 const open=node('span','link-open','Open '),arrow=node('b','','↗');
 arrow.setAttribute('aria-hidden','true');open.append(arrow);row.append(open);
 return row;
}
if(typeof document!=='undefined'){
 const search=document.getElementById('asset-search'),filters=[...document.querySelectorAll('[data-library-filter]')],
  product=document.getElementById('product-filter');
 for(const asset of ASSETS){const option=node('option','',asset.name);option.value=asset.id;product.append(option);}
 let scope='all';
 function render(){
  const matches=filterAssets(ASSETS,search.value,scope,product.value);
  for(const type of ['demo','asset']){
   const list=document.getElementById(type+'-cards');list.replaceChildren();
   const entries=matches.filter(asset=>asset.type===type);
   document.getElementById(type+'-section').hidden=entries.length===0;
   document.getElementById(type+'-count').textContent=String(entries.length).padStart(2,'0');
   for(const asset of entries){
    const card=node('article','asset-card');card.dataset.asset=asset.id;
    const heading=node('div','product-heading'),identity=node('div','product-identity');
    identity.append(node('h3','',asset.name),node('span','asset-category',asset.category));
    const status=node('span','asset-status',asset.status);
    if(asset.type==='demo'&&asset.id!=='beautypath'){
     status.textContent+=' · Unverified';
     status.setAttribute('aria-label',asset.status+'. Demo journey standard: not yet verified');
    }
    heading.append(identity,status);card.append(heading);
    const links=directoryLinksFor(asset);
    card.append(linkRow(links[0],asset));
    if(links.length>1){
     const reference=node('details','asset-reference');
     const summary=node('summary','',links.length-1+' more '+(links.length===2?'link':'links'));
     summary.setAttribute('aria-label',summary.textContent+' · '+asset.name);
     reference.append(summary);
     for(const link of links.slice(1))reference.append(linkRow(link,asset));
     // Search results expose matching role/host links rather than hiding the answer.
     reference.open=Boolean(search.value.trim());
     card.append(reference);
    }
    list.append(card);
   }
  }
  document.getElementById('library-result').textContent=matches.length+' products · '+
   matches.reduce((total,asset)=>total+directoryLinksFor(asset).length,0)+' links';
  document.getElementById('library-empty').hidden=matches.length!==0;
  document.getElementById('library-clear').hidden=!search.value&&scope==='all'&&product.value==='all';
  for(const button of filters)button.setAttribute('aria-pressed',String(button.dataset.libraryFilter===scope));
 }
 search.addEventListener('input',render);
 product.addEventListener('change',render);
 for(const button of filters)button.addEventListener('click',()=>{scope=button.dataset.libraryFilter;render()});
 document.getElementById('library-clear').addEventListener('click',()=>{search.value='';scope='all';product.value='all';render();search.focus()});
 for(const link of document.querySelectorAll('[data-library-nav]'))link.addEventListener('click',()=>{
  scope=link.dataset.libraryNav;search.value='';render();
 });
 function navigate(){
  const hash=location.hash,target=document.getElementById(hash.slice(1)),
   activity=hash==='#zoo-activity'||Boolean(target?.closest('#zoo-activity'));
  document.getElementById('library').hidden=Boolean(activity);
  document.getElementById('zoo-activity').hidden=!activity;
  for(const link of document.querySelectorAll('[data-directory-view]')){
   if((link.dataset.directoryView==='activity')===Boolean(activity))link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
  }
  if(hash==='#my-demos'||hash==='#my-assets'){
   scope=hash==='#my-demos'?'demo':'asset';search.value='';product.value='all';render();
  }
  if(activity){
   if(hash!=='#zoo-activity')document.getElementById('operational-details').open=true;
  }
  if(hash==='#library'||hash==='#zoo-activity')window.scrollTo(0,0);
 }
 window.addEventListener('hashchange',navigate);
 render();
 navigate();
}
