// Address-only reconciliation with the owner's uploaded 29 October directory.
// Historical labels are not current availability or access-control receipts.
// Never import old grades, private infrastructure inventory, missing-link placeholders,
// the retired builder-only BeautyPath address, or the removed Vercel deployment.
export const ORIGINAL_LIVE_LINKS = [
  {product:'control-center',label:'Control panel entrance',url:'https://transcendiq-control-panel.netlify.app/',kind:'workspace',note:'Owner workspace; PIN access required.'},
  {product:'control-center',label:'Original address directory',url:'https://transcendiq-control-panel.netlify.app/super/directory',kind:'workspace',note:'Historical owner directory; PIN access required. Not a current verification report.'},
  {product:'control-center',label:'Control panel',url:'https://transcendiq-control-panel.netlify.app/pitch/control-panel.html',kind:'workspace'},
  {product:'control-center',label:'Film preview',url:'https://transcendiq-film-preview.netlify.app',kind:'preview'},
  {product:'control-center',label:'Lane status page',url:'https://transcendiq-lane-api.netlify.app',kind:'workspace'},
  {product:'control-center',label:'Company website · historical',url:'https://transendtiq2.com',kind:'reference',note:'The 29 October directory reported different branding here. Not a verified company site.'},
  {product:'control-center',label:'Older student preview',url:'https://student-preview--transcendiq.netlify.app',kind:'reference',note:'The 29 October directory recorded HTTP 404. Retained as a historical reference, not a working-demo claim.'},
  {product:'control-center',label:'Early public website',url:'https://transcendiq2-site.netlify.app',kind:'reference',note:'The 29 October directory recorded HTTP 404. Retained as a historical reference, not a working-demo claim.'},
  {product:'beautypath',label:'Base demo address',url:'https://beautypath-grad.netlify.app',kind:'reference'},
  {product:'beautypath',label:'Production sign-in',url:'https://beautypaths.io/app',kind:'workspace'},
  {product:'beautypath',label:'Production admin',url:'https://beautypaths.io/super',kind:'workspace'},
  {product:'beautypath',label:'Login',url:'https://beautypaths.io/login',kind:'workspace'},
  {product:'beautypath',label:'Older code-entry demo',url:'https://beautypaths.io/enter',kind:'reference'},
  {product:'wonup',label:'Student demo · original host',url:'https://wonup2-demos-prestige.netlify.app/demo?as=student',kind:'demo'},
  {product:'wonup',label:'Pre-enrolled demo · original host',url:'https://wonup2-demos-prestige.netlify.app/demo?as=pre_enrolled',kind:'demo'},
  {product:'wonup',label:'School admin demo · original host',url:'https://wonup2-demos-prestige.netlify.app/demo?as=school_admin',kind:'demo'},
  {product:'wonup',label:'Super admin demo · original host',url:'https://wonup2-demos-prestige.netlify.app/demo?as=super_admin',kind:'demo'},
  {product:'prestige',label:'Prestige Engage demo',url:'https://prestigeengage-demo.netlify.app',kind:'demo'},
  {product:'wonup',label:'App entrance',url:'https://wonup2.transendtiq2.com/',kind:'workspace'},
  {product:'wonup',label:'Original builder address',url:'https://won-up-2-ccca51a9.base44.app',kind:'reference'},
  {product:'ezmove',label:'Buyer journey',url:'https://ez-move-transcendiq.netlify.app/demo',kind:'demo'},
  {product:'ezmove',label:'Original EZ Move app',url:'https://ez-move-ai.base44.app',kind:'reference',note:'The 29 October directory recorded HTTP 404. Retained as a historical reference, not a working-demo claim.'},
  {product:'myblock',label:'Figma prototype',url:'https://www.figma.com/proto/o6ZkVgPfnGAViNwoqsYPyW/My-Block',kind:'design'}
];

export function originalLinksFor(product) {
  return ORIGINAL_LIVE_LINKS.filter(link => link.product === product);
}
