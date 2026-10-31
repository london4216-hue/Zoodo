// Owner-owned product doors. A recorded URL is not a live verification receipt.
export const ASSETS=[
 {id:'beautypath',name:'BeautyPath',type:'demo',initials:'BP',tone:'sage',category:'Career pathways',references:true,
  description:'Choose a student, graduate, school, salon or owner demo. Your selected BeautyPath layout, ready to open.',
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
export function filterAssets(assets,query='',scope='all'){
 const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return assets.filter(asset=>(scope==='all'||asset.type===scope)&&
  words.every(word=>[asset.name,asset.category,asset.description,asset.status,...asset.links.flat()].join(' ').toLocaleLowerCase().includes(word)));
}
export function assetHost(asset){
 return new URL(asset.links[0][1],'https://zoo-live-dashboard.netlify.app/').hostname;
}
function node(tag,className,text){
 const element=document.createElement(tag);element.className=className;
 if(text!==undefined)element.textContent=text;return element;
}
if(typeof document!=='undefined'){
 const search=document.getElementById('asset-search'),filters=[...document.querySelectorAll('[data-library-filter]')];
 let scope='all';
 function render(){
  const matches=filterAssets(ASSETS,search.value,scope);
  for(const type of ['demo','asset']){
   const list=document.getElementById(type+'-cards');list.replaceChildren();
   const entries=matches.filter(asset=>asset.type===type);
   document.getElementById(type+'-section').hidden=entries.length===0;
   document.getElementById(type+'-count').textContent=String(entries.length).padStart(2,'0');
   for(const asset of entries){
    const card=node('article','asset-card '+asset.tone);card.dataset.asset=asset.id;
    const top=node('div','asset-card-top');
    top.append(node('span','asset-initials',asset.initials),node('span','asset-status',asset.status));
    card.append(top,node('p','asset-category',asset.category),node('h3','',asset.name),
     node('p','asset-host',assetHost(asset)),node('p','asset-description',asset.description));
    if(asset.type==='demo'&&asset.id!=='beautypath')
     card.append(node('p','asset-standard','Demo journey standard: not yet verified'));
    const links=node('div','asset-actions');
    const reference=asset.references?node('details','asset-reference'):null;
    if(reference)reference.append(node('summary','','Workspace & reference links'));
    asset.links.forEach(([label,url],index)=>{
     const link=node('a',index===0?'asset-primary':'asset-secondary',label);
     link.href=url;link.target='_blank';link.rel='noopener noreferrer';
     link.setAttribute('aria-label',label+' · '+asset.name);
     if(index>0&&reference)reference.append(link);else links.append(link);
    });
    if(reference)links.append(reference);
    card.append(links);list.append(card);
   }
  }
  document.getElementById('library-result').textContent=matches.length+' of '+ASSETS.length+' destinations'+
   (search.value.trim()?' matching “'+search.value.trim()+'”':'');
  document.getElementById('library-empty').hidden=matches.length!==0;
  document.getElementById('library-clear').hidden=!search.value&&scope==='all';
  for(const button of filters)button.setAttribute('aria-pressed',String(button.dataset.libraryFilter===scope));
 }
 search.addEventListener('input',render);
 for(const button of filters)button.addEventListener('click',()=>{scope=button.dataset.libraryFilter;render()});
 document.getElementById('library-clear').addEventListener('click',()=>{search.value='';scope='all';render();search.focus()});
 for(const link of document.querySelectorAll('[data-library-nav]'))link.addEventListener('click',()=>{
  scope=link.dataset.libraryNav;search.value='';render();
 });
 render();
}
