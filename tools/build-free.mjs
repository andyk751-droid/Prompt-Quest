// Builds the FREE version of Prompt Quest for GitHub Pages.
// All 6 worlds plus the Power User Pack (built in). No buy buttons. Keeps the coffee tip button.
//
// Usage: node tools/build-free.mjs <master index.html> <pack1-master.html>
// Output: dist/free/ (index.html, sw.js, manifest.webmanifest, icons). Copy these to the repo root.
import fs from 'fs';
import path from 'path';

const TIP_URL = process.env.TIP_URL || 'https://ko-fi.com/akratechnologies'; // blank = no tip button
const GC_CODE = process.env.GC_CODE ?? 'akratech'; // GoatCounter account (anonymous visit counts)

const [src, packSrc] = process.argv.slice(2);
if (!src || !packSrc) { console.error('Usage: node tools/build-free.mjs <master index.html> <pack1-master.html>'); process.exit(1); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let html = fs.readFileSync(src, 'utf8');

function swap(text, find, repl, label) {
  const n = text.split(find).length - 1;
  if (n !== 1) throw new Error(`Could not apply "${label}" (found ${n} matches)`);
  return text.replace(find, () => repl);
}

// ---------- Built-in Power User Pack ----------
const pm = fs.readFileSync(packSrc, 'utf8').match(/<script type="application\/json" id="pq-pack">([\s\S]*?)<\/script>/);
if (!pm) throw new Error('No pack data found in ' + packSrc);
const pack = JSON.parse(pm[1]);
if (pack.id !== 'poweruser' || pack.worlds.length !== 4) throw new Error('Unexpected pack data');
delete pack.glyphs; // built-in content uses the game's own icons only
const packJson = JSON.stringify(pack).replace(/</g, '\\u003c');

// ---------- Page head: title, phone install, visitor counter ----------
html = swap(html, '<title>Prompt Quest</title>',
  `<title>Prompt Quest</title>
<meta name="description" content="A free, hands-on game for learning to get great results from AI.">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#F0623F">
<link rel="apple-touch-icon" href="icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Prompt Quest">${GC_CODE ? `\n<script data-goatcounter="https://${GC_CODE}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : ''}`, 'head tags');

// ---------- Coffee tip button on the home screen ----------
html = swap(html, 'const MODULES = [', `const TIP_URL='${TIP_URL}';\nconst MODULES = [`, 'tip link');
html = swap(html,
  "h('button',{class:'btn ghost sm',onclick:askReset},'Reset progress')",
  "(TIP_URL?h('a',{class:'btn sm',href:TIP_URL,target:'_blank',rel:'noopener'},'☕ Buy me a coffee'):null),h('button',{class:'btn ghost sm',onclick:askReset},'Reset progress')",
  'tip button');

// ---------- Add-ons: Power User Pack is included and free; no shop, no file install ----------
html = swap(html, "const ADDON_LINKS={poweruser:'https://ko-fi.com/s/a8ffea83fd',creator:'',agent:''};",
  `const ADDON_LINKS={poweruser:'',creator:'',agent:''};\nconst BUILTIN_PACKS=[${packJson}];`, 'built-in pack data');
html = swap(html, "if(!IS_PACK){Object.values(loadPacks()).forEach(p=>{try{applyPack(p);}catch(e){}});}",
  "if(!IS_PACK){BUILTIN_PACKS.forEach(p=>{try{applyPack(p);}catch(e){}});}", 'load built-in pack only');
html = swap(html,
  "'New worlds for Prompt Quest. Install a pack once and its worlds join your map, with the same coins, levels, and trophies.')),\n    h('button',{class:'btn primary',onclick:pickPackFile,html:`${ico('addon',18)} Install a pack`})));",
  "'Extra worlds for Prompt Quest, free. They sit on your map after World 6, with the same coins, levels, and trophies.'))));",
  'add-ons header');
html = swap(html,
  "app.append(h('div',{class:'addon-help',html:`${spark('happy')}<span>Bought a pack? Click <b>Install a pack</b> and choose the file you downloaded from Ko-fi. It ends in .html.</span>`}));",
  "app.append(h('div',{class:'addon-help',html:`${spark('happy')}<span>The <b>Power User Pack</b> is already on your map. More packs are on the way.</span>`}));",
  'add-ons help line');
html = swap(html,
  "if(installed)actions=[h('span',{class:'chip ok'},'✓ Installed'),",
  "const builtin=BUILTIN_PACKS.some(p=>p.id===c.id)&&first>=0;\n    if(builtin)actions=[h('span',{class:'chip ok'},'✓ Included free'),h('button',{class:'btn primary sm',onclick:()=>{const ff=PHASES.findIndex(p=>!S.done[pk(MODULES[first].id,p.k)]);go('module',first,ff<0?0:ff);}},'Play')];\n    else if(installed)actions=[h('span',{class:'chip ok'},'✓ Installed'),",
  'included pack card');
html = swap(html, "const installed=!!inst[c.id]&&MODULES.some(m=>m.pack===c.id);const link=ADDON_LINKS[c.id];const first=MODULES.findIndex(m=>m.pack===c.id);",
  "const first=MODULES.findIndex(m=>m.pack===c.id);const installed=!!inst[c.id]&&first>=0;const link=ADDON_LINKS[c.id];", 'card order');

// ---------- Anonymous event counts + offline support ----------
html = swap(html, "$('#brand').onclick=()=>go('home');\nrender();",
  `function track(name){try{if(window.goatcounter&&goatcounter.count)goatcounter.count({path:name,title:name,event:true});}catch(e){}}
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href]');if(a&&TIP_URL&&a.href===TIP_URL)track('tip-click');});
{const _cp=completePhase;completePhase=function(mi,pi,extra){const first=!S.done[pk(MODULES[mi].id,PHASES[pi].k)];_cp(mi,pi,extra);if(first)track('stage-cleared-'+MODULES[mi].id+'-s'+(pi+1));};}
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
$('#brand').onclick=()=>go('home');
render();`, 'tracking + offline');

if (/ko-fi\.com\/s\//.test(html)) throw new Error('A Ko-fi shop link is still in the page');

// ---------- Write ----------
const out = path.join(root, 'dist', 'free');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Prompt Quest', short_name: 'Prompt Quest',
  description: 'A free, hands-on game for learning to get great results from AI.',
  start_url: './', scope: './', display: 'standalone',
  background_color: '#EDF0FA', theme_color: '#F0623F',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ]
}, null, 2));
const ver = Date.now();
fs.writeFileSync(path.join(out, 'sw.js'), `// Lets Prompt Quest work offline once installed. Version ${ver}
const C='pq-${ver}';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'])));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true})));});
`);
for (const f of ['icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(root, 'tools', f), path.join(out, f));
console.log('Free build: 6 worlds + Power User Pack (4 worlds). Tip button:', TIP_URL ? 'on' : 'off', '. Output: dist/free');
