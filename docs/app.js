// Day 16 · Berlin, step-free? Three 3D maps from OpenStreetMap wheelchair tags (deck.gl).
(async () => {
const Q = new URLSearchParams(location.search), FILM = Q.has('film');
const $ = id => document.getElementById(id);
const J = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
const [hex, districts, berlin, transit, stats, base] = await Promise.all(
  ['data/hex.json', 'data/districts.geojson', 'data/berlin.geojson', 'data/transit.json', 'data/stats.json', 'data/base.json'].map(J));
const pb = await fetch('data/places.bin').then(r => r.arrayBuffer()).catch(() => new ArrayBuffer(0));
const PV = new DataView(pb), NP = pb.byteLength / 10, PL = [];
for (let i = 0; i < NP; i++) PL.push([PV.getFloat32(i*10, true), PV.getFloat32(i*10+4, true), PV.getUint8(i*10+8), PV.getUint8(i*10+9)]);

// ---- colours (colour-blind safe: blue = step-free, orange = not)
const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i+2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const ramp = (stops) => v => { for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) { const [a, ca] = stops[i-1], [b, cb] = stops[i]; return mix(hexRGB(ca), hexRGB(cb), (v - a) / (b - a)); } return hexRGB(stops.at(-1)[1]); };
const ACC = ramp([[0, '#b4441b'], [0.3, '#e08a4f'], [0.5, '#efe1c9'], [0.7, '#7fa9cf'], [1, '#1f5f9e']]);
const UNK = ramp([[0, '#e7edf2'], [0.25, '#e7edf2'], [0.45, '#b9a7cf'], [0.65, '#7c4fa6'], [0.85, '#3f1c63'], [1, '#3f1c63']]);
const ST = { yes: '#1f5f9e', designated: '#1f5f9e', limited: '#e0a43a', no: '#b4441b', unknown: '#a39d92' };
const PC = ['#b4441b', '#e0a43a', '#1f5f9e'];

// ---- stats + text
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const S = stats || { places: 0, tagged: 0, yes: 0, limited: 0, no: 0, transit: {}, districts: [] };
const tsum = k => Object.values(S.transit[k] || {}).reduce((a, b) => a + b, 0);
const tyes = k => ((S.transit[k] || {}).yes || 0) + ((S.transit[k] || {}).designated || 0);
const fmt = n => n.toLocaleString('en-US');
const TABS = [
  { h1: 'How step-free is Berlin?',
    lede: `<b>${fmt(S.tagged)}</b> places in OpenStreetMap say whether a wheelchair gets in. <b>${pct(S.yes, S.tagged)}%</b> say yes, ${pct(S.limited, S.tagged)}% partly, ${pct(S.no, S.tagged)}% no.`,
    stats: [[pct(S.yes, S.tagged) + '%', 'step-free'], [pct(S.limited, S.tagged) + '%', 'partly'], [pct(S.no, S.tagged) + '%', 'not accessible']],
    rank: d => d.yes_of_tagged, rankLab: d => `${Math.round(d.yes_of_tagged)}% step-free`, col: d => ACC(d.yes_of_tagged / 100) },
  { h1: 'Where nobody has checked yet',
    lede: `This map is built by volunteers. Of <b>${fmt(S.places)}</b> places in Berlin, <b>${pct(S.places - S.tagged, S.places)}%</b> have no wheelchair information at all. Unknown isn't "no": nobody has looked yet.`,
    stats: [[pct(S.tagged, S.places) + '%', 'have wheelchair info'], [fmt(S.places - S.tagged), 'places still unknown'], [S.districts[0] ? S.districts[0].name.split('-')[0] : '–', 'best-mapped district']],
    rank: d => d.tagged, rankLab: d => `${Math.round(d.tagged)}% mapped`, col: d => UNK(1 - d.tagged / 100) },
  { h1: 'Can you get there?',
    lede: `A step-free café is little use if the station isn't. Stations and stops as tagged in OpenStreetMap; lifts as small dots.`,
    stats: [[pct(tyes('ubahn'), tsum('ubahn')) + '%', `of ${tsum('ubahn')} U-Bahn stations step-free`], [pct(tyes('sbahn'), tsum('sbahn')) + '%', `of ${tsum('sbahn')} S-Bahn stations`], [pct(tyes('tram'), tsum('tram')) + '%', `of ${fmt(tsum('tram'))} tram stops`]],
    rank: null },
];
let tab = 0;
function panel() {
  const T = TABS[tab];
  $('h1').textContent = T.h1; $('lede').innerHTML = T.lede;
  $('stats').innerHTML = T.stats.map(([b, s]) => `<div class="st"><b class="mono">${b}</b><span>${s}</span></div>`).join('');
  if (T.rank) {
    const D = S.districts.filter(d => d.t > 50).slice().sort((a, b) => T.rank(b) - T.rank(a)), mx = Math.max(...D.map(T.rank));
    $('rank').innerHTML = D.map(d => `<li><span>${d.name}</span><span class="mono">${T.rankLab(d)}</span><i><b style="width:${T.rank(d) / mx * 100}%;background:rgb(${T.col(d)})"></b></i></li>`).join('');
  } else {
    const rows = [['U-Bahn', 'ubahn'], ['S-Bahn', 'sbahn'], ['Tram', 'tram'], ['Regional rail', 'rail'], ['Lifts', 'elevator']];
    $('rank').innerHTML = rows.map(([n, k]) => { const o = S.transit[k] || {}, t = tsum(k);
      return `<li><span>${n}</span><span class="mono">${t ? pct(tyes(k), t) + '% yes' : '–'}</span><i>${['yes', 'limited', 'no', 'unknown'].map(w => `<b style="position:relative;display:inline-block;height:5px;width:${t ? ((o[w] || 0) + (w === 'yes' ? (o.designated || 0) : 0)) / t * 100 : 0}%;background:${ST[w]}"></b>`).join('')}</i></li>`; }).join('');
  }
  legend();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', +b.dataset.t === tab));
}
function legend() {
  const ticks = (a, b) => `<div class="tick mono"><span>${a}</span><span>${b}</span></div>`;
  if (tab === 0) $('legend').innerHTML = `<h4>Step-free share of places with info</h4><div class="ramp">${[0, .2, .35, .5, .65, .8, 1].map(v => `<i style="background:rgb(${ACC(v)})"></i>`).join('')}</div>${ticks('0%', '100%')}<h4>Height</h4><div class="lg-row">places with wheelchair info</div><div class="lg-row"><span class="swatch" style="background:${PC[2]}"></span>yes <span class="swatch" style="background:${PC[1]};margin-left:8px"></span>partly <span class="swatch" style="background:${PC[0]};margin-left:8px"></span>no (dots, zoom in)</div>`;
  if (tab === 1) $('legend').innerHTML = `<h4>Places with no wheelchair info</h4><div class="ramp">${[0, .2, .4, .6, .8, 1].map(v => `<i style="background:rgb(${UNK(v)})"></i>`).join('')}</div>${ticks('0%', '100%')}<h4>Height</h4><div class="lg-row">all places</div>`;
  if (tab === 2) $('legend').innerHTML = `<h4>Wheelchair access</h4>${[['yes', 'step-free'], ['limited', 'partly'], ['no', 'not accessible'], ['unknown', 'not recorded']].map(([k, l]) => `<div class="lg-row"><span class="swatch" style="background:${ST[k]}"></span>${l}</div>`).join('')}<div class="lg-row" style="margin-top:6px;color:var(--ink-3)">Tall: U/S-Bahn & rail · short: tram · dots: lifts</div>`;
}

// ---- deck
let grow = 1, view = FILM ? null : { longitude: innerWidth > 760 ? 13.30 : 13.40, latitude: 52.50, zoom: innerWidth > 760 ? 10.2 : 9.4, pitch: 48, bearing: -12 };
const HEX = (hex || []).filter(d => d.t > 0);
const maxT = Math.max(1, ...HEX.map(d => d.t)), maxTG = Math.max(1, ...HEX.map(d => d.tg));
const DC = (districts ? districts.features : []).map(f => { const c = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
  let x = 0, y = 0; for (const p of c) { x += p[0]; y += p[1]; } return { name: f.properties.name, c: [x / c.length, y / c.length] }; });
const TR = (transit || []);
function layers() {
  const L = [];
  if (base) L.push(new deck.BitmapLayer({ id: 'base', image: 'data/base.jpg', bounds: base.bounds }));
  if (berlin) L.push(new deck.GeoJsonLayer({ id: 'berlin', data: berlin, filled: false, stroked: true, getLineColor: [43, 41, 37, 140], getLineWidth: 2, lineWidthUnits: 'pixels' }));
  if (districts) L.push(new deck.GeoJsonLayer({ id: 'dist', data: districts, filled: false, stroked: true, getLineColor: [111, 106, 97, 110], getLineWidth: 1, lineWidthUnits: 'pixels' }));
  if (tab === 0) {
    L.push(new deck.PolygonLayer({ id: 'hex0', data: HEX.filter(d => d.tg >= 3), extruded: true, wireframe: false, pickable: true,
      getPolygon: d => d.p, getElevation: d => d.tg / maxTG * 4200 * grow, getFillColor: d => [...ACC(d.y / d.tg), 235],
      material: { ambient: 0.55, diffuse: 0.6, shininess: 12 }, updateTriggers: { getElevation: grow } }));
    L.push(new deck.ScatterplotLayer({ id: 'pts', data: PL, visible: (view ? view.zoom : 10) > 12.6, getPosition: d => [d[0], d[1]], getRadius: 5, radiusMinPixels: 2,
      getFillColor: d => hexRGB(PC[d[2]]), pickable: false }));
  } else if (tab === 1) {
    L.push(new deck.PolygonLayer({ id: 'hex1', data: HEX.filter(d => d.t >= 3), extruded: true, pickable: true,
      getPolygon: d => d.p, getElevation: d => d.t / maxT * 4200 * grow, getFillColor: d => [...UNK(1 - d.tg / d.t), 235],
      material: { ambient: 0.55, diffuse: 0.6, shininess: 12 }, updateTriggers: { getElevation: grow } }));
  } else {
    const st = TR.filter(d => d.k !== 'elevator'), el = TR.filter(d => d.k === 'elevator');
    L.push(new deck.ScatterplotLayer({ id: 'lift', data: el, getPosition: d => d.c, getRadius: 22, radiusMinPixels: 1.5, getFillColor: d => [...hexRGB(ST[d.w] || ST.unknown), 200] }));
    L.push(new deck.ColumnLayer({ id: 'st', data: st, diskResolution: 12, radius: 110, extruded: true, pickable: true,
      getPosition: d => d.c, getElevation: d => (d.k === 'tram' ? 500 : 1700) * grow, getFillColor: d => hexRGB(ST[d.w] || ST.unknown),
      material: { ambient: 0.6, diffuse: 0.55 }, updateTriggers: { getElevation: grow } }));
  }
  L.push(new deck.TextLayer({ id: 'lbl', data: DC, getPosition: d => d.c, getText: d => d.name, getSize: FILM ? 26 : 13, getColor: [43, 41, 37, 230],
    fontFamily: 'DM Sans, sans-serif', fontWeight: 600, outlineWidth: 4, outlineColor: [253, 251, 247, 230], fontSettings: { sdf: true }, characterSet: 'auto',
    getPixelOffset: [0, 0], billboard: true }));
  return L;
}
const tipEl = $('tip');
const D = new deck.Deck({
  parent: $('map'), controller: !FILM, ...(FILM ? { viewState: { longitude: 13.4, latitude: 52.51, zoom: 10, pitch: 45, bearing: 0 } } : { initialViewState: view }),
  layers: layers(), useDevicePixels: FILM ? (+Q.get('dpr') || 1) : true,
  onViewStateChange: ({ viewState }) => { const z0 = view && view.zoom; view = viewState; if ((z0 > 12.6) !== (view.zoom > 12.6)) D.setProps({ layers: layers() }); },
  onHover: ({ object, x, y, layer }) => {
    if (!object || FILM) { tipEl.hidden = true; return; }
    let h = '';
    if (layer.id.startsWith('hex')) h = `<b>${fmt(object.t)} places</b>${fmt(object.tg)} with wheelchair info (${pct(object.tg, object.t)}%)<br>${object.tg ? `${pct(object.y, object.tg)}% step-free · ${pct(object.l, object.tg)}% partly · ${pct(object.n, object.tg)}% no` : ''}`;
    if (layer.id === 'st') h = `<b>${object.n || 'Station'}</b>${{ ubahn: 'U-Bahn', sbahn: 'S-Bahn', tram: 'Tram stop', rail: 'Rail station' }[object.k]} · ${{ yes: 'step-free', designated: 'step-free', limited: 'partly', no: 'not accessible' }[object.w] || 'not recorded'}`;
    tipEl.innerHTML = h; tipEl.hidden = false; tipEl.style.left = (x + 14) + 'px'; tipEl.style.top = (y + 14) + 'px';
  },
});
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = +b.dataset.t; panel(); D.setProps({ layers: layers() }); });
panel();
$('load').classList.add('gone');
if (FILM) { document.body.classList.add('film'); $('film').hidden = false; }

window.Film = {
  ready: true, S, pct, tsum, tyes, fmt,
  async set(o) {
    if (o.tab !== undefined && o.tab !== tab) { tab = o.tab; panel(); }
    if (o.grow !== undefined) grow = o.grow;
    if (o.view) view = o.view;
    for (const id of ['fq', 'fa', 'fc', 'fs']) { if (o[id] !== undefined) $(id).innerHTML = o[id]; if (o[id + 'o'] !== undefined) $(id).style.opacity = o[id + 'o']; }
    D.setProps({ viewState: view, layers: layers() });
    for (let i = 0; i < 3; i++) { await new Promise(r => requestAnimationFrame(r)); D.redraw(true); }
  },
  idle: () => new Promise(r => { const chk = () => (D.isInitialized && !D.needsRedraw() && D.props.layers.every(l => l.isLoaded !== false)) ? r() : setTimeout(chk, 50); chk(); }),
};
})();
