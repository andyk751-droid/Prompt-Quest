// Prompt Quest build tool
// Makes two versions from ONE master game file:
//   dist/trial/  -> free trial (Worlds 1-2), installable on phones, goes on GitHub Pages
//   dist/full/   -> full game (all 6 worlds), zipped for Gumroad
//
// Usage:  node tools/build.mjs path/to/master/index.html
// dist/full is for selling only. Never commit it to a public repo.
//
// Links: set BUY_URL (Ko-fi Shop item) and TIP_URL (Ko-fi page) below, or pass them in:
//   BUY_URL=https://ko-fi.com/s/xxxx TIP_URL=https://ko-fi.com/yourname node tools/build.mjs index.html

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BUY_URL = process.env.BUY_URL || 'https://ko-fi.com/s/cbce6e01b8'; // <-- your Ko-fi Shop item link for the full game
const TIP_URL = process.env.TIP_URL || 'https://ko-fi.com/akratechnologies'; // <-- paste your Buy Me a Coffee link here (blank = button hidden)
const FREE_STAGES = 1; // how many stages of World 1 are free
// Visitor counter (GoatCounter: free, no cookies, no personal data). Trial only. Blank = turned off.
const GC_CODE = process.env.GC_CODE ?? 'akratech'; // <-- your GoatCounter account name, e.g. 'akratech'

const src = process.argv[2] || 'index.html';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(src, 'utf8');

function swap(text, find, repl, label) {
  const n = text.split(find).length - 1;
  if (n !== 1) throw new Error(`Build step "${label}" expected 1 match, found ${n}. The game file may have changed.`);
  return text.replace(find, () => repl);
}


// "Buy me a coffee" button on the home screen (both versions), only if TIP_URL is set.
function addTip(text, label) {
  text = swap(text, "const MODULES = [", `const TIP_URL='${TIP_URL}';\nconst MODULES = [`, label + ' tip link');
  return swap(text, "h('button',{class:'btn ghost sm',onclick:askReset},'Reset progress')",
    "(TIP_URL?h('a',{class:'btn sm',href:TIP_URL,target:'_blank',rel:'noopener'},'☕ Buy me a coffee'):null),h('button',{class:'btn ghost sm',onclick:askReset},'Reset progress')",
    label + ' tip button');
}

// ---------- 1. Pull the world list out of the game ----------
const start = html.indexOf('const MODULES = [');
const end = html.indexOf('];', html.indexOf('/* ---------- MODULE 6'));
if (start < 0 || end < 0) throw new Error('Could not find the world list (MODULES).');
const arrText = html.slice(start + 'const MODULES = '.length, end + 1);
const MODULES = new Function('return ' + arrText)();

// Everything past the free stage(s) is stripped out of the trial file.
// Only titles/descriptions stay (for the locked map), plus the two snippets the Cheat Sheet shows.
const PH = ['ce', 'pp', 'gen', 'dev', 'apply'];
const trialMods = MODULES.map((m, i) => {
  const keep = i === 0 ? FREE_STAGES : 0;
  const stub = { id: m.id, title: m.title, bloom: m.bloom, lvl: m.lvl, obj: m.obj, free: keep, phases: {} };
  if (keep === 0) stub.full = true;
  PH.slice(0, keep).forEach(k => { stub.phases[k] = m.phases[k]; });
  const g = m.phases.gen || {};
  if (g.mnemonic || g.template) stub.phases.gen = Object.assign(stub.phases.gen || {}, g.mnemonic ? { mnemonic: g.mnemonic } : {}, g.template ? { template: g.template } : {});
  return stub;
});

// Rebuild the whole world list as stubs.
let trial = html.slice(0, start) + 'const MODULES = [\n' + trialMods.map(s => JSON.stringify(s)).join(',\n') + '\n' + html.slice(end);

// ---------- 2. Trial-only changes ----------
trial = swap(trial, '<title>Prompt Quest</title>',
  `<title>Prompt Quest: Free Trial</title>
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#F0623F">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Prompt Quest">${GC_CODE?`\n<script data-goatcounter="https://${GC_CODE}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`:''}`, 'title + install tags');

trial = swap(trial, 'const MODULES = [', `const BUY_URL='${BUY_URL}';\nconst MODULES = [`, 'buy link');
trial = addTip(trial, 'trial');

// Paid worlds and stages never unlock in the trial (even with old "unlock all" saves).
trial = swap(trial, 'const modUnlocked=i=>S.unlockAll||',
  'const isPaid=(mi,pi)=>pi>=(MODULES[mi].free??5);\nconst modUnlocked=i=>!MODULES[i].full&&(S.unlockAll||', 'lock paid worlds (open)');
trial = swap(trial, "!!S.done[pk(MODULES[i-1].id,'apply')];",
  "!!S.done[pk(MODULES[i-1].id,'apply')]);", 'lock paid worlds (close)');
trial = swap(trial, 'phaseUnlocked=(mi,pi)=>modUnlocked(mi)&&',
  'phaseUnlocked=(mi,pi)=>!isPaid(mi,pi)&&modUnlocked(mi)&&', 'lock paid stages');
// Anything that tries to open a paid stage shows the upgrade screen instead.
trial = swap(trial, "if(!phaseUnlocked(mi,pi)){return go('home');}",
  "if(!phaseUnlocked(mi,pi)){if(isPaid(mi,pi)){view.screen='home';render();return upsell();}return go('home');}", 'upsell on paid stage');

// Remove the "Unlock all worlds" button.
trial = swap(trial,
  "h('button',{class:'btn ghost sm',onclick:()=>{S.unlockAll=!S.unlockAll;save();render();}},S.unlockAll?'Unlock all worlds: on':'Unlock all worlds'),",
  '', 'remove unlock-all button');

// Locked paid worlds on the map get a "Get the full game" button.
trial = swap(trial,
  "h('span',{class:'muted',style:'font-size:13.5px;font-weight:700'},'Locked')",
  "(m.full?h('a',{class:'btn sm primary',href:BUY_URL,target:'_blank',rel:'noopener'},'Get the full game'):h('span',{class:'muted',style:'font-size:13.5px;font-weight:700'},'Locked'))",
  'buy button on locked worlds');

// Banner above the map.
trial = swap(trial,
  "app.append(h('div',{class:'sec-h'},h('h2',{},'The Map')",
  "app.append(trialBanner());app.append(h('div',{class:'sec-h'},h('h2',{},'The Map')",
  'trial banner');

// The "Next stage" button after the free stage becomes "Unlock the full game".
trial = swap(trial, ":`Next stage →`);",
  ":(isPaid(mi,pi+1)?'Unlock the full game →':`Next stage →`));", 'upsell button label');

// Helper functions, styles, and phone-install support.
const extras = `
/* ============ FREE TRIAL ============ */
/* Counts a few anonymous events (no names, no cookies) so you can see where trial players go. */
function track(name){try{if(window.goatcounter&&goatcounter.count)goatcounter.count({path:name,title:name,event:true});}catch(e){}}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href]');if(!a)return;if(a.href===BUY_URL)track('buy-click');else if(TIP_URL&&a.href===TIP_URL)track('tip-click');});
{const _cp=completePhase;completePhase=function(mi,pi,extra){const first=!S.done[pk(MODULES[mi].id,PHASES[pi].k)];_cp(mi,pi,extra);if(first)track('stage-cleared-w'+(mi+1)+'-s'+(pi+1));};}
function upsell(){track('upsell-shown');const m=h('div',{class:'modal',role:'dialog','aria-modal':'true'},h('div',{class:'card'},
  h('div',{class:'eyebrow'},'Free stage complete'),
  h('h2',{},'Nice work. Ready for the rest?'),
  h('p',{class:'muted'},'The full game has 6 worlds and 30 stages. Spot the six prompt ingredients, fix broken prompts, build your own from scratch, judge like a pro, and create a reusable Signature Prompt. Finish to earn your Champion card.'),
  h('div',{class:'row'},h('a',{class:'btn primary big',href:BUY_URL,target:'_blank',rel:'noopener'},'Get the full game – $2.99'),h('button',{class:'btn',onclick:()=>{m.remove();go('home');}},'Back to the map'))));
  $('#modalRoot').append(m);}
function trialBanner(){return h('div',{class:'trialbar'},
  h('div',{},h('b',{},'Free trial: Stage 1'),h('span',{},' Unlock all 6 worlds, 30 stages, and your Champion card.')),
  h('div',{class:'row',style:'margin:0'},TIP_URL?h('a',{class:'btn sm',href:TIP_URL,target:'_blank',rel:'noopener'},'☕ Tip'):null,h('a',{class:'btn primary sm',href:BUY_URL,target:'_blank',rel:'noopener'},'Get the full game – $2.99')));}
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
`;
trial = swap(trial, "$('#brand').onclick=()=>go('home');", extras + "$('#brand').onclick=()=>go('home');", 'trial helpers');
trial = swap(trial, '</style>\n\n</head>',
  `.trialbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:28px 0 0;padding:14px 16px;border:2px solid var(--accent);border-radius:16px;background:color-mix(in srgb,var(--accent) 10%,var(--surface))}
.trialbar span{color:var(--muted)}
</style>\n\n</head>`, 'trial styles');

// ---------- 3. Write the trial ----------
const tdir = path.join(root, 'dist', 'trial');
fs.rmSync(tdir, { recursive: true, force: true });
fs.mkdirSync(tdir, { recursive: true });
fs.writeFileSync(path.join(tdir, 'index.html'), trial);
fs.writeFileSync(path.join(tdir, 'manifest.webmanifest'), JSON.stringify({
  name: 'Prompt Quest', short_name: 'Prompt Quest',
  description: 'A hands-on game for learning to get great results from AI.',
  start_url: './', scope: './', display: 'standalone',
  background_color: '#EDF0FA', theme_color: '#F0623F',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ]
}, null, 2));
const ver = Date.now();
fs.writeFileSync(path.join(tdir, 'sw.js'), `// Lets Prompt Quest work offline once installed. Version ${ver}
const C='pq-${ver}';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'])));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true})));});
`);
for (const f of ['icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(root, 'tools', f), path.join(tdir, f));

// ---------- 4. Write the full version ----------
const fdir = path.join(root, 'dist', 'full');
const pkg = path.join(fdir, 'Prompt Quest');
fs.rmSync(fdir, { recursive: true, force: true });
fs.mkdirSync(pkg, { recursive: true });
fs.writeFileSync(path.join(pkg, 'Prompt Quest.html'), addTip(html, 'full'));
for (const f of ['How to Play.txt', 'License.txt']) fs.copyFileSync(path.join(root, 'tools', f), path.join(pkg, f));
execSync(`cd "${fdir}" && zip -qr "PromptQuest-Full.zip" "Prompt Quest"`);

console.log('Trial: World 1, stage(s) 1 to', FREE_STAGES);
console.log('Full worlds :', MODULES.map(m => m.title).join(', '));
if (BUY_URL.startsWith('PASTE')) console.warn('WARNING: BUY_URL is still a placeholder. Do not publish the trial until it is set.');
console.log('Visitor counter:', GC_CODE ? `on (https://${GC_CODE}.goatcounter.com)` : 'off (set GC_CODE to turn it on)');
console.log('Done -> dist/trial and dist/full/PromptQuest-Full.zip');
