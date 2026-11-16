// Day 16 film + stills. node pipeline/film.mjs  (env: ROOT, OUT, LIST, DSF, STILLS=1)
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.env.ROOT || path.resolve('docs'), OUT = process.env.OUT || path.resolve('frames');
const FPS = 30, DUR = 22, LIST = process.env.LIST ? process.env.LIST.split(',').map(Number) : null;
fs.mkdirSync(OUT, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; fs.readFile(path.join(root, u), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(u)] || 'application/octet-stream' }); r.end(d); }); }).listen(8781);
const DSF = +process.env.DSF || 1;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: DSF });
p.on('pageerror', e => console.log('ERR', e.message));
const DECK = process.env.DECK_JS; if (DECK && fs.existsSync(DECK)) await p.route(/unpkg\.com\/deck\.gl@9\.0\.38\/dist\.min\.js/, rt => rt.fulfill({ path: DECK, contentType: 'text/javascript' }));
await p.goto(`http://localhost:8781/?film&dpr=${DSF}`, { waitUntil: 'load' });
await p.waitForFunction(() => window.Film && window.Film.ready, null, { timeout: 120000 });
await p.evaluate(() => document.fonts.ready);
await p.evaluate(({ FPS }) => {
  const F = window.Film, S = F.S, pct = F.pct, fmt = F.fmt;
  const ease = u => u < .5 ? 4*u*u*u : 1 - Math.pow(-2*u+2, 3)/2, cl = v => Math.max(0, Math.min(1, v));
  const fade = (t, a, b, f = 0.35) => t < a ? 0 : t < a + f ? (t - a)/f : t < b - f ? 1 : t < b ? (b - t)/f : 0;
  const V = (lon, lat, zoom, pitch, bearing) => ({ longitude: lon, latitude: lat, zoom, pitch, bearing });
  const lerpV = (A, B, u) => ({ longitude: A.longitude + (B.longitude - A.longitude)*u, latitude: A.latitude + (B.latitude - A.latitude)*u,
    zoom: A.zoom + (B.zoom - A.zoom)*u, pitch: A.pitch + (B.pitch - A.pitch)*u, bearing: A.bearing + (B.bearing - A.bearing)*u });
  const W0 = V(13.40, 52.485, 10.35, 48, -20), W1 = V(13.40, 52.49, 10.55, 50, -6), W2 = V(13.40, 52.492, 10.6, 50, 8), W3 = V(13.395, 52.50, 11.05, 52, 18), W4 = V(13.40, 52.49, 10.4, 48, 30);
  const uYes = pct(S.yes, S.tagged), uUnk = pct(S.places - S.tagged, S.places), ub = pct(F.tyes('ubahn'), F.tsum('ubahn'));
  window.__state = t => {
    const o = {};
    if (t < 7) { o.tab = 0; o.grow = ease(cl((t - 0.4) / 2.2)); o.view = lerpV(W0, W1, ease(t / 7)); }
    else if (t < 7.5) { o.tab = 0; o.grow = 1 - ease((t - 7) / 0.5); o.view = W1; }
    else if (t < 13.5) { o.tab = 1; o.grow = ease(cl((t - 7.5) / 1.6)); o.view = lerpV(W1, W2, ease((t - 7.5) / 6)); }
    else if (t < 14.0) { o.tab = 1; o.grow = 1 - ease((t - 13.5) / 0.5); o.view = W2; }
    else if (t < 19.0) { o.tab = 2; o.grow = ease(cl((t - 14) / 1.4)); o.view = lerpV(W2, W3, ease((t - 14) / 5)); }
    else { o.tab = 2; o.grow = 1; o.view = lerpV(W3, W4, ease(cl((t - 19) / 2.5))); }
    let q = '', c = '';
    if (t < 7.3) { q = '<small>Berlin · OpenStreetMap · 1 / 3</small>How step-free is Berlin?'; c = `<b>${uYes}%</b><span>of ${fmt(S.tagged)} places<br>with wheelchair info<br>are step-free</span>`; }
    else if (t < 13.8) { q = '<small>Built by volunteers · 2 / 3</small>Where has nobody checked yet?'; c = `<b>${uUnk}%</b><span>of Berlin's ${fmt(S.places)}<br>places: wheelchair<br>access unknown</span>`; }
    else { q = '<small>The way there · 3 / 3</small>Can you even get there?'; c = `<b>${ub}%</b><span>of U-Bahn stations<br>are step-free</span>`; }
    o.fq = q; o.fqo = t < 19 ? (fade(t, -1, 7.3) + fade(t, 7.5, 13.8) + fade(t, 14.0, 19.0)) : 0;
    o.fc = c; o.fco = t < 19 ? (fade(t, 0.8, 7.3) + fade(t, 8.2, 13.8) + fade(t, 14.8, 19.0)) : 0;
    o.fa = `Wheelchair access is a map we draw together<small>Add what you know on Wheelmap or OpenStreetMap · explore the 3D map: link in the post</small>`; o.fao = fade(t, 19.2, 30);
    o.fs = 'Data: © OpenStreetMap contributors (ODbL) · wheelchair tags as mapped by volunteers';
    return o;
  };
  const Dd = S.districts.filter(d => d.t > 50), bySF = Dd.slice().sort((a, b) => b.yes_of_tagged - a.yes_of_tagged), byMap = Dd.slice().sort((a, b) => b.tagged - a.tagged);
  const sw = c => `<span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${c};vertical-align:-2px;margin:0 6px 0 14px"></span>`;
  const tr = S.transit.tram || {}, trT = F.tsum('tram');
  window.__still = i => [
    `Old Berlin has more steps<small>Friedrichshain-Kreuzberg: ${Math.round(bySF.at(-1).yes_of_tagged)}% step-free · ${bySF[0].name}: ${Math.round(bySF[0].yes_of_tagged)}%<br>${sw('#1f5f9e')}step-free${sw('#efe1c9')}mixed${sw('#b4441b')}not accessible · height: places with info</small>`,
    `Half of Berlin's places are still a blank<small>Best mapped: ${byMap[0].name} ${Math.round(byMap[0].tagged)}% · least: ${byMap.at(-1).name} ${Math.round(byMap.at(-1).tagged)}%<br>${sw('#e7edf2')}well mapped${sw('#7c4fa6')}mostly unknown · height: all places</small>`,
    `Trains are mapped, trams are not<small>S-Bahn ${pct(F.tyes('sbahn'), F.tsum('sbahn'))}% step-free · U-Bahn ${ub}% · tram stops: ${pct(tr.unknown || 0, trT)}% not recorded<br>${sw('#1f5f9e')}step-free${sw('#e0a43a')}partly${sw('#b4441b')}no${sw('#a39d92')}not recorded</small>`][i];
  window.__shot = async (fr, still) => { const o = window.__state(fr / FPS); if (still !== undefined) { o.fa = window.__still(still); o.fao = 1; } await F.set(o); };
}, { FPS });
if (process.env.STILLS) {
  const stills = [[5.8, 'still_1_accessible'], [12.4, 'still_2_blindspots'], [18.2, 'still_3_transit']];
  for (const [i, [t, n]] of stills.entries()) { await p.evaluate(([fr, i]) => window.__shot(fr, i), [Math.round(t * FPS), i]); await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${n}.jpg`, type: 'jpeg', quality: 93 }); console.log('still', n); }
} else {
  for (let f = 0; f < DUR * FPS; f++) {
    if (LIST && !LIST.includes(f)) continue;
    await p.evaluate(fr => window.__shot(fr), f);
    await p.screenshot({ path: `${OUT}/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 92 });
    if (f % 60 === 0) console.log('frame', f);
  }
}
await b.close(); srv.close();
