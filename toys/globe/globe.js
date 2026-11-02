// World Globe: a real Earth you can spin and zoom. Tap a country to light it up, see its flag and hear its name.
// Tap the sea to hear its name. Zoom in and tiny places get a ring so small fingers can find them.
import * as THREE from 'three';

const d3 = window.d3, topojson = window.topojson;
const $ = id => document.getElementById(id);
const cl = (x, a, b) => Math.max(a, Math.min(b, x));
const DEG = Math.PI / 180;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TEST = /[?&]test\b/.test(location.search);

/* ---------------- renderer ---------------- */
const stage = $('stage'), canvas = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
const DPR = Math.min(devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
const ANISO = renderer.capabilities.getMaxAnisotropy();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 150);
const globe = new THREE.Group(); globe.rotation.order = 'XYZ'; scene.add(globe);

// layers sit a hair above each other so they never flicker
// every sphere and tile shares one 1.40625-degree grid, so the layers line up exactly even up close
const R_TILE = l => 1 + 0.00002 * l, R_PATCH = 1.00015, R_BORDER = 1.00025, R_OUTLINE = 1.0003;

// stars, fixed in the sky
{
  const n = 900, pos = new Float32Array(n * 3);
  let s = 9; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1, t = r() * Math.PI * 2, q = Math.sqrt(1 - u * u); pos.set([q * Math.cos(t) * 40, u * 40, q * Math.sin(t) * 40 - 10], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xFFF4C9, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.8 })));
}

/* ---------------- the Earth: one shader for the base sphere and every detail tile ---------------- */
const loader = new THREE.TextureLoader();
const shared = { nightT: { value: null }, sunDir: { value: new THREE.Vector3(1, 0, 0) } };
const VERT = `
  varying vec2 vUv; varying vec3 vN; varying vec3 vNv; varying vec3 vView;
  void main() {
    vUv = uv; vN = normal; vNv = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  uniform sampler2D dayT, nightT; uniform vec3 sunDir; uniform vec4 rect;
  varying vec2 vUv; varying vec3 vN; varying vec3 vNv; varying vec3 vView;
  void main() {
    vec3 day = texture2D(dayT, vUv).rgb;
    vec3 night = texture2D(nightT, rect.xy + vUv * rect.zw).rgb;   // night map is always the whole world
    float d = dot(normalize(vN), sunDir);
    float k = smoothstep(-0.16, 0.22, d);
    vec3 lit = day * (0.70 + 0.45 * max(d, 0.0));
    vec3 dark = day * 0.34 + night * 1.15;           // night side stays readable for kids
    vec3 col = mix(dark, lit, k);
    float rim = pow(1.0 - max(dot(vNv, vView), 0.0), 3.0);
    col += vec3(0.32, 0.58, 1.0) * rim * 0.42;
    gl_FragColor = vec4(col, 1.0);
  }`;
function earthMaterial(tex, rect, night) {   // a tile with its own night picture uses all of it; otherwise its corner of the world one
  return new THREE.ShaderMaterial({
    uniforms: { dayT: { value: tex }, nightT: night ? { value: night } : shared.nightT, sunDir: shared.sunDir, rect: { value: new THREE.Vector4(...(night ? [0, 0, 1, 1] : rect)) } },
    vertexShader: VERT, fragmentShader: FRAG
  });
}
const baseMat = earthMaterial(null, [0, 0, 1, 1]);
const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 256, 128), baseMat);
globe.add(earth);

// atmosphere glow
const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.09, 96, 72), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform float fade; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.72 - dot(vN, vec3(0.0,0.0,1.0))), 3.2); gl_FragColor = vec4(0.36, 0.62, 1.0, 1.0) * i * 1.6 * fade; }`,
  uniforms: { fade: { value: 1 } }
}));
scene.add(atmo);

/* where the sun is right now (subsolar point), so day and night are real */
function llVec(lonDeg, latDeg, r = 1, out = new THREE.Vector3()) {
  const lo = lonDeg * DEG, la = latDeg * DEG;
  return out.set(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);
}
function updateSun() {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0), doy = (now - start) / 864e5;
  const decl = -23.44 * Math.cos(2 * Math.PI / 365 * (doy + 10));
  const hours = now.getUTCHours() + now.getUTCMinutes() / 60;
  llVec(-15 * (hours - 12), decl, 1, shared.sunDir.value);
}
updateSun(); setInterval(updateSun, 60000);

/* ---------------- view: which point of Earth faces us, and how close ---------------- */
const view = { lon: 0, lat: 15 * DEG, dist: 3.4 };
const target = { lon: null, lat: null, dist: null };
let vel = { lon: 0, lat: 0 }, idle = !reduce;
const LAT_MAX = 85 * DEG, D_MAX = 5.2, PPD_MAX = 240;   // closest zoom: the sharpest photo has 240 pixels per degree
let K = 1000;                                            // (half height) / tan(half fov), in css px
// screen px per radian of Earth at the middle of the view (the spot right under the camera)
const radiusPx = (d = view.dist) => K / (d - 1);
const distForR = R => 1 + K / R;
const R_MIN = () => radiusPx(D_MAX), R_MAX = () => PPD_MAX / DEG;
const clampDist = d => cl(d, distForR(R_MAX()), D_MAX);
function applyView() {
  globe.rotation.x = view.lat;
  globe.rotation.y = -Math.PI / 2 - view.lon;
  camera.position.set(0, 0, view.dist); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const near = cl((view.dist - 1) * 0.4, 0.002, 0.5);
  if (Math.abs(camera.near - near) > near * 0.05) { camera.near = near; camera.updateProjectionMatrix(); }
  atmo.material.uniforms.fade.value = cl((view.dist - 1.15) / 0.6, 0, 1);
  globe.updateMatrixWorld(true);
}
function homeView() {
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
  const south = /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Fiji|Chatham)|^America\/(Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima)|^Africa\/(Johannesburg|Maputo|Harare|Windhoek|Lusaka|Gaborone)|^Indian\/(Mauritius|Reunion)/.test(tz);
  return { lon: -new Date().getTimezoneOffset() / 60 * 15 * DEG, lat: (south ? -25 : 15) * DEG };
}
function flyTo(lon, lat, dist) {
  let d = lon - view.lon; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  target.lon = view.lon + d; target.lat = cl(lat, -LAT_MAX, LAT_MAX); if (dist) target.dist = clampDist(dist);
}
function zoomBy(f) { view.dist = clampDist(distForR(cl(radiusPx() * f, R_MIN(), R_MAX()))); target.dist = null; }

/* ---------------- size ---------------- */
let cssW = 1, cssH = 1;
function resize() {
  const r = stage.getBoundingClientRect(); if (!r.width) return;
  cssW = r.width; cssH = r.height;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  // keep the whole Earth in view on tall phones
  camera.fov = r.width < r.height ? 2 * Math.atan(Math.tan(16 * DEG) * (r.height / r.width) * 0.9) / DEG : 32;
  camera.updateProjectionMatrix();
  K = (r.height / 2) / Math.tan(camera.fov * DEG / 2);
  view.dist = clampDist(view.dist);
  dirty = true;
}
let dirty = true;
new ResizeObserver(resize).observe(stage); resize();

/* screen <-> globe */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), unit = new THREE.Sphere(new THREE.Vector3(), 1), hitV = new THREE.Vector3();
const invG = new THREE.Matrix4();
function llAtScreen(x, y) {             // css px inside the stage -> [lon, lat] or null
  ndc.set(x / cssW * 2 - 1, -y / cssH * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectSphere(unit, hitV)) return null;
  hitV.applyMatrix4(invG).normalize();
  return [Math.atan2(-hitV.z, hitV.x) / DEG, Math.asin(cl(hitV.y, -1, 1)) / DEG];
}
const projV = new THREE.Vector3();
function screenOf(lon, lat, out) {      // -> {x, y, z: facing (1 = straight at us, <0 = behind)}
  llVec(lon, lat, 1, projV).applyMatrix4(globe.matrixWorld);
  const facing = (projV.z - 1 / view.dist) / (1 - 1 / view.dist);   // 1 at the centre, 0 at the edge
  projV.project(camera);
  out.x = (projV.x + 1) / 2 * cssW; out.y = (1 - projV.y) / 2 * cssH; out.z = facing;
  return out;
}

/* ---------------- detail tiles: sharper pictures stream in as you zoom ---------------- */
const LV = { 1: { nx: 4, ny: 2, segs: 64 }, 2: { nx: 16, ny: 8, segs: 16 }, 3: { nx: 32, ny: 16, segs: 8 }, 4: { nx: 64, ny: 32, segs: 4 } };
// the two sharpest levels only exist where there's land; open ocean uses the level below
let tileMap = null;
const haveTile = (l, x, y) => l <= 2 || (tileMap && tileMap[l][y * LV[l].nx + x] === '1');
const tiles = new Map();      // key -> { mesh, ready, used }
let tilesOn = false, inflight = 0;
const queue = [];
function tileKey(l, x, y) { return l + '/' + x + '_' + y; }
function tileBox(l, x, y) {
  const { nx, ny } = LV[l], w = 360 / nx, h = 180 / ny;
  return { L0: -180 + x * w, L1: -180 + (x + 1) * w, B0: 90 - (y + 1) * h, B1: 90 - y * h };
}
function wantTile(l, x, y, pri) {
  const k = tileKey(l, x, y); let t = tiles.get(k);
  if (!t) { t = { l, x, y, mesh: null, ready: false, used: 0, pri }; tiles.set(k, t); queue.push(t); }
  t.used = performance.now(); t.pri = Math.min(t.pri ?? pri, pri);
  return t;
}
function pump() {
  queue.sort((a, b) => a.pri - b.pri);
  while (inflight < 4 && queue.length) {
    const t = queue.shift(); if (!tiles.has(tileKey(t.l, t.x, t.y))) continue;
    inflight++;
    // each tile has a day picture and a night picture (city lights) of the same patch
    let day = null, night = null, left = 2;
    const done = () => {
      if (--left) return;
      inflight--;
      if (!day || !tiles.has(tileKey(t.l, t.x, t.y))) { day?.dispose(); night?.dispose(); return pump(); }
      day.anisotropy = ANISO;
      const { L0, L1, B0, B1 } = tileBox(t.l, t.x, t.y), s = LV[t.l].segs;
      const geo = new THREE.SphereGeometry(R_TILE(t.l), s, s, (L0 + 180) * DEG, (L1 - L0) * DEG, (90 - B1) * DEG, (B1 - B0) * DEG);
      t.mesh = new THREE.Mesh(geo, earthMaterial(day, [(L0 + 180) / 360, (B0 + 90) / 180, (L1 - L0) / 360, (B1 - B0) / 180], night));
      t.mesh.renderOrder = t.l; t.mesh.visible = false; globe.add(t.mesh); t.ready = true; dirty = true;
      pump();
    };
    loader.load('tiles/' + tileKey(t.l, t.x, t.y) + '.jpg', tex => { day = tex; done(); }, undefined, done);
    loader.load('night/' + tileKey(t.l, t.x, t.y) + '.jpg', tex => { night = tex; done(); }, undefined, done);
  }
}
function dropTile(t) {
  tiles.delete(tileKey(t.l, t.x, t.y));
  if (!t.mesh) return;
  const u = t.mesh.material.uniforms;
  globe.remove(t.mesh); t.mesh.geometry.dispose(); u.dayT.value.dispose(); if (u.nightT !== shared.nightT) u.nightT.value.dispose(); t.mesh.material.dispose();
}
const tmpS = { x: 0, y: 0, z: 0 };
function updateTiles() {
  if (!tilesOn) return;
  const ppd = radiusPx() * DEG * DPR;              // device px per degree at the centre of the view
  const level = ppd > 150 ? 4 : ppd > 75 ? 3 : ppd > 30 ? 2 : ppd > 14 ? 1 : 0;
  const need = new Set();
  if (level) {
    // sample the screen, find which tiles are under it; the middle loads first
    const n = 9;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const sx = i / n * cssW, sy = j / n * cssH, ll = llAtScreen(sx, sy); if (!ll) continue;
      const pri = Math.hypot(sx - cssW / 2, sy - cssH / 2);
      for (let l = 1; l <= level; l++) {
        const { nx, ny } = LV[l];
        const x = cl(Math.floor((ll[0] + 180) / 360 * nx), 0, nx - 1), y = cl(Math.floor((90 - ll[1]) / 180 * ny), 0, ny - 1);
        if (haveTile(l, x, y)) need.add(wantTile(l, x, y, pri + (level - l) * 50));
      }
    }
  }
  for (const t of tiles.values()) if (t.mesh) t.mesh.visible = need.has(t);
  pump();
  // keep a small cache, forget the least recently used
  const all = [...tiles.values()].filter(t => !need.has(t));
  if (tiles.size > 40) all.sort((a, b) => a.used - b.used).slice(0, tiles.size - 40).forEach(dropTile);
}

/* ---------------- places and water ---------------- */
let places = [], byA2 = {}, waters = [], wlabels = [], ready = false;
function bboxOf(f) { return d3.geoBounds(f); }
function inBounds(b, lon, lat, pad = 0.3) {
  const [[x0, y0], [x1, y1]] = b;
  if (lat < y0 - pad || lat > y1 + pad) return false;
  return x0 <= x1 ? (lon >= x0 - pad && lon <= x1 + pad) : (lon >= x0 - pad || lon <= x1 + pad);
}
let borderFine = null, borderCoarse = null;
const borderMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
function linesToGeometry(lines, minStepDeg) {
  const out = [], a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const line of lines) {
    let prev = line[0];
    for (let i = 1; i < line.length; i++) {
      const p = line[i];
      if (minStepDeg && i < line.length - 1 && d3.geoDistance(prev, p) / DEG < minStepDeg) continue;
      llVec(prev[0], prev[1], R_BORDER, a); llVec(p[0], p[1], R_BORDER, b);
      out.push(a.x, a.y, a.z, b.x, b.y, b.z); prev = p;
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}
async function loadData() {
  const get = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  const [topo, nm, wtopo, wl] = await Promise.all([get('data/countries.json'), get('data/names.json'), get('data/water.json'), get('data/water-labels.json')]);
  // countries, grouped by their two-letter code (some places come in several pieces)
  const feats = topojson.feature(topo, topo.objects.countries).features.filter(f => f.properties.a2 && nm[f.properties.a2]);
  const groups = {};
  for (const f of feats) {
    // a few tiny islands in the source map are wound backwards and would cover the whole planet: turn them round
    const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of polys) if (d3.geoArea({ type: 'Polygon', coordinates: p }) > 2 * Math.PI) p.forEach(r => r.reverse());
    f.b = bboxOf(f); f.area = d3.geoArea(f);
    (groups[f.properties.a2] ||= []).push(f);
  }
  places = Object.entries(groups).map(([a2, fs]) => {
    // the biggest piece of land, or for tiny places the piece the ring sits on
    const polys = fs.flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
    let big = polys[0], ba = -1;
    for (const p of polys) { const a = d3.geoArea({ type: 'Polygon', coordinates: p }); if (a > ba) { ba = a; big = p; } }
    const area = fs.reduce((s, f) => s + f.area, 0);
    const geo = { type: 'MultiPolygon', coordinates: polys };
    return { a2, name: nm[a2], feats: fs, geo, area, size: Math.sqrt(area), c: d3.geoCentroid({ type: 'Polygon', coordinates: big }), el: null };
  });
  places.sort((a, b) => b.area - a.area);
  for (const p of places) byA2[p.a2] = p;
  // light borders, drawn as real lines so they stay sharp at every zoom
  const mesh = topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b).coordinates;
  borderFine = new THREE.LineSegments(linesToGeometry(mesh, 0), borderMat);
  borderCoarse = new THREE.LineSegments(linesToGeometry(mesh, 0.12), borderMat);
  borderFine.renderOrder = borderCoarse.renderOrder = 5;
  globe.add(borderFine, borderCoarse);
  // seas, oceans and lakes
  waters = topojson.feature(wtopo, wtopo.objects.water).features;
  for (const w of waters) { w.b = bboxOf(w); w.area = d3.geoArea(w); }
  wlabels = wl.map(l => ({ ...l, el: null, w: 0, on: false }));
  ready = true; dirty = true;
}
function landAt(lon, lat) {
  for (const p of places) for (const f of p.feats) if (inBounds(f.b, lon, lat) && d3.geoContains(f, [lon, lat])) return p;
  return null;
}
function lakeAt(lon, lat) {
  for (const w of waters) if (w.properties.k === 'lake' && inBounds(w.b, lon, lat, 0.05) && d3.geoContains(w, [lon, lat])) return { n: w.properties.n, geo: w };
  return null;
}
function waterAt(lon, lat) {
  let best = null;
  for (const w of waters) {
    if (!inBounds(w.b, lon, lat, 0.05) || !d3.geoContains(w, [lon, lat])) continue;
    const lake = w.properties.k === 'lake';
    if (!best || (lake && best.properties.k !== 'lake') || (lake === (best.properties.k === 'lake') && w.area < best.area)) best = w;
  }
  if (best) return { n: best.properties.n, geo: best };
  // open water that no named sea covers: the nearest ocean
  let bd = Infinity, bn = null;
  for (const l of wlabels) if (l.t === 0) { const d = d3.geoDistance([l.lon, l.lat], [lon, lat]); if (d < bd) { bd = d; bn = l.n; } }
  const geo = waters.find(w => w.properties.n === bn);
  return bn ? { n: bn, geo } : null;
}

/* ---------------- rings for tiny places, names for the water ---------------- */
const marks = $('marks'), wlab = $('wlabels');
const RING = 14;       // a place smaller than this many px across keeps a ring
const TIER_PPD = [12, 16, 24, 35, 51];   // oceans, big seas, seas and big lakes, gulfs and lakes, small bays
const RING_PPD = 16;                     // rings for tiny places appear from about country-sized views
let shownMarks = [];
function updateOverlays() {
  if (!ready) return;
  const R = radiusPx(), ppd = R * DEG;
  // rings
  shownMarks = [];
  for (const p of places) {      // bigger first: when two rings would overlap, the better-known place shows, the other appears as you come closer
    const small = ppd >= RING_PPD && p.size * R < RING, isSel = sel && sel.kind === 'place' && sel.p === p;
    let show = false;
    if (small || (isSel && p.size * R < RING)) {
      screenOf(p.c[0], p.c[1], tmpS);
      if (tmpS.z > 0.08 && tmpS.x > -20 && tmpS.y > -20 && tmpS.x < cssW + 20 && tmpS.y < cssH + 20) {
        show = isSel || !shownMarks.some(m => Math.hypot(m.x - tmpS.x, m.y - tmpS.y) < 10);
      }
    }
    if (show) {
      if (!p.el) { p.el = document.createElement('i'); p.el.className = 'mk'; marks.appendChild(p.el); }
      p.el.style.transform = `translate(${tmpS.x.toFixed(1)}px,${tmpS.y.toFixed(1)}px)`;
      p.el.style.opacity = cl(tmpS.z * 5, 0, 1).toFixed(2);
      p.el.classList.toggle('sel', isSel);
      p.el.style.display = '';
      shownMarks.push({ x: tmpS.x, y: tmpS.y, p });
    } else if (p.el && p.el.style.display !== 'none') p.el.style.display = 'none';
  }
  // water names: oceans always, smaller seas and lakes as you come closer
  const boxes = [];
  for (const l of wlabels) {
    let on = false;
    if (ppd >= TIER_PPD[l.t]) {
      screenOf(l.lon, l.lat, tmpS);
      if (tmpS.z > 0.3) {
        if (!l.el) {
          l.el = document.createElement('span'); l.el.className = 'wl t' + l.t + (l.k === 'lake' ? ' lake' : ''); l.el.textContent = l.n;
          wlab.appendChild(l.el); l.w = l.el.offsetWidth; l.h = l.el.offsetHeight;
        }
        const bx = { x0: tmpS.x - l.w / 2 - 6, x1: tmpS.x + l.w / 2 + 6, y0: tmpS.y - l.h / 2 - 4, y1: tmpS.y + l.h / 2 + 4 };
        if (bx.x0 > 0 && bx.x1 < cssW && bx.y0 > 0 && bx.y1 < cssH && !boxes.some(b => b.x0 < bx.x1 && bx.x0 < b.x1 && b.y0 < bx.y1 && bx.y0 < b.y1)
          && !shownMarks.some(m => m.x > bx.x0 && m.x < bx.x1 && m.y > bx.y0 && m.y < bx.y1)) {
          on = true; boxes.push(bx);
          l.el.style.transform = `translate(${(tmpS.x - l.w / 2).toFixed(1)}px,${(tmpS.y - l.h / 2).toFixed(1)}px)`;
        }
      }
    }
    if (l.el && on !== l.on) l.el.classList.toggle('on', on);
    l.on = on;
  }
  // borders: simpler lines from far away, every wiggle up close
  if (borderFine) {
    const fine = ppd > 9;
    borderFine.visible = fine; borderCoarse.visible = !fine;
    borderMat.opacity = cl(0.22 + ppd * 0.006, 0.22, 0.42);
  }
}

/* ---------------- highlights: painted fresh for each pick, so they stay crisp up close ---------------- */
let patch = null, outline = null, patchFade = 0;
function clearHighlight() {
  for (const m of [patch, outline]) if (m) { globe.remove(m); m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
  patch = outline = null;
}
function highlight(geo, fill, stroke, lineColor) {
  clearHighlight(); if (!geo) return;
  let [[x0, y0], [x1, y1]] = d3.geoBounds(geo);
  if (x1 < x0) x1 += 360;
  const pad = 0.4;
  x0 -= pad; x1 += pad; y0 = Math.max(-90, y0 - pad); y1 = Math.min(90, y1 + pad);
  if (x1 - x0 > 359) { x0 = -180; x1 = 180; }
  const cx = (x0 + x1) / 2, lw = x1 - x0, lh = y1 - y0;
  const k = 2048 / Math.max(lw, lh), W = Math.max(16, Math.round(lw * k)), H = Math.max(16, Math.round(lh * k));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const proj = d3.geoEquirectangular().rotate([-cx, 0]).scale(k / DEG).translate([W / 2, k * y1]).precision(0.05);
  const path = d3.geoPath(proj, c);
  c.fillStyle = fill; c.strokeStyle = stroke; c.lineJoin = 'round'; c.lineWidth = Math.max(3, W / 400);
  c.beginPath(); path(geo); c.fill(); c.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = ANISO;
  const geom = new THREE.SphereGeometry(R_PATCH, cl(Math.ceil(lw / 0.35), 4, 600), cl(Math.ceil(lh / 0.35), 4, 300), (x0 + 180) * DEG, lw * DEG, (90 - y1) * DEG, lh * DEG);
  patch = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
  patch.renderOrder = 4; globe.add(patch);
  // a crisp edge on top, as real lines
  const rings = (geo.type === 'Polygon' ? [geo.coordinates] : geo.type === 'MultiPolygon' ? geo.coordinates : []).flat();
  const og = linesToGeometry(rings, 0); og.attributes.position.array.forEach((v, i, a) => { a[i] = v * R_OUTLINE / R_BORDER; });
  outline = new THREE.LineSegments(og, new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: 0, depthWrite: false }));
  outline.renderOrder = 6; globe.add(outline);
  patchFade = 0; dirty = true;
}

/* ---------------- tapping ---------------- */
const card = $('card'), flag = $('flag'), wave = $('wave'), nameEl = $('name');
let sel = null;
function showCard(name, a2) {
  if (a2) { flag.src = 'flags/' + a2.toLowerCase() + '.svg'; flag.alt = 'Flag of ' + name; flag.hidden = false; wave.hidden = true; }
  else { flag.hidden = true; flag.removeAttribute('src'); wave.hidden = false; }
  nameEl.textContent = name;
  card.hidden = false; card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
}
function select(s) {
  sel = s;
  if (!s) { clearHighlight(); card.hidden = true; dirty = true; return; }
  if (s.kind === 'place') {
    const p = s.p;
    highlight(p.geo, 'rgba(255,200,61,0.55)', '#FFC83D', 0xFFC83D);
    showCard(p.name, p.a2); tok(); chime(); say(p.name);
    // the Earth stays where it is: only the place lights up
  } else {
    highlight(s.w.geo, 'rgba(120,190,255,0.28)', 'rgba(170,220,255,0.9)', 0xAADCFF);
    showCard(s.w.n, null); splash(); say(s.w.n);
  }
  dirty = true;
}
function tapAt(x, y) {            // css px inside the stage
  if (!ready) return null;
  const ll = llAtScreen(x, y);
  const pick = p => (select({ kind: 'place', p }), sel);
  let ring = null, rd = Infinity;
  for (const m of shownMarks) { const d = Math.hypot(m.x - x, m.y - y); if (d < rd) { rd = d; ring = m.p; } }
  const land = ll ? landAt(ll[0], ll[1]) : null;
  // 1. right on a tiny place's own land: that's the one
  if (land && land.size * radiusPx() < RING) return pick(land);
  // 2. inside a ring
  if (ring && rd < 11) return pick(ring);
  if (!ll) return select(null), null;
  // 3. a lake (the map's countries cover their lakes, so lakes go first)
  const lake = lakeAt(ll[0], ll[1]);
  if (lake) return select({ kind: 'water', w: lake }), sel;
  // 4. land under the finger
  if (land) return pick(land);
  // 5. near a ring, within a fingertip
  if (ring && rd < 18) return pick(ring);
  // 6. just off a coast: look a few px around
  const rDeg = 5 / radiusPx() / DEG;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, la = ll[1] + Math.sin(a) * rDeg, lo = ll[0] + Math.cos(a) * rDeg / Math.max(0.2, Math.cos(ll[1] * DEG));
    const p = landAt(lo, la); if (p) return pick(p);
  }
  // 7. the sea
  const w = waterAt(ll[0], ll[1]);
  return select(w ? { kind: 'water', w } : null), sel;
}
card.addEventListener('click', () => { unlock(); if (sel) say(sel.kind === 'place' ? sel.p.name : sel.w.n); });
card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (sel) say(sel.kind === 'place' ? sel.p.name : sel.w.n); } });

/* ---------------- spinning and pinching ---------------- */
const ptrs = new Map(); let down = null, pinch0 = null;
const DEAD = 14, FOLLOW = 0.75, FLING = 14, GLIDE = 0.88;   // touch feel, tuned for toddlers
const local = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
canvas.addEventListener('pointerdown', e => {
  unlock(); canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  idle = false; target.lon = target.lat = target.dist = null;
  if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, lx: e.clientX, ly: e.clientY, lt: performance.now() };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), R: radiusPx() }; if (down) down.moved = true; }
});
canvas.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2 && pinch0) {
    const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    view.dist = clampDist(distForR(cl(pinch0.R * d / Math.max(10, pinch0.d), R_MIN(), R_MAX()))); dirty = true; return;
  }
  if (!down) return;
  const now = performance.now();
  // small fingers wobble when they tap: nothing turns until the finger has really travelled
  if (!down.moved) {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < DEAD) return;
    down.moved = true; down.lx = e.clientX; down.ly = e.clientY; down.lt = now;
  }
  const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
  const k = FOLLOW / radiusPx();
  view.lon -= dx * k; view.lat = cl(view.lat + dy * k, -LAT_MAX, LAT_MAX);
  // a gentle, capped glide after letting go, so a flick can't send the Earth whirling
  const dt = Math.max(8, now - down.lt);
  const sx = cl(dx / dt * 16, -FLING, FLING), sy = cl(dy / dt * 16, -FLING, FLING);
  vel.lon = vel.lon * 0.5 - sx * k * 0.5; vel.lat = vel.lat * 0.5 + sy * k * 0.5;
  down.lx = e.clientX; down.ly = e.clientY; down.lt = now; dirty = true;
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch0 = null;
  if (ptrs.size === 0 && down) {
    if (!down.moved && performance.now() - down.t < 1000) {
      vel.lon = vel.lat = 0;
      const [x, y] = local(e); tapAt(x, y);
    } else if (performance.now() - down.lt > 80) { vel.lon = vel.lat = 0; }
    down = null;
  }
}
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { e.preventDefault(); idle = false; zoomBy(Math.exp(-e.deltaY * 0.0015)); dirty = true; }, { passive: false });
window.addEventListener('keydown', e => {
  const k = 30 / radiusPx();
  if (e.key === 'ArrowLeft') view.lon -= k; if (e.key === 'ArrowRight') view.lon += k;
  if (e.key === 'ArrowUp') view.lat = cl(view.lat - k, -LAT_MAX, LAT_MAX); if (e.key === 'ArrowDown') view.lat = cl(view.lat + k, -LAT_MAX, LAT_MAX);
  if (e.key === '+' || e.key === '=') zoomBy(1.25); if (e.key === '-') zoomBy(0.8);
  idle = false; dirty = true;
});

$('mine').addEventListener('click', () => {
  unlock(); idle = false; vel.lon = vel.lat = 0;
  const h = homeView(); flyTo(h.lon, h.lat, 3.0); whoosh(); say('Your side of the world');
});
$('chip').addEventListener('click', () => { unlock(); say('Earth'); });

/* ---------------- loop ---------------- */
let last = performance.now(), lastTiles = 0, prevKey = '';
function frame(ms) {
  const dt = Math.min(0.05, (ms - last) / 1000); last = ms;
  if (idle) view.lon += 4 * DEG * dt;
  else if (!down) {
    view.lon += vel.lon; view.lat = cl(view.lat + vel.lat, -LAT_MAX, LAT_MAX);
    vel.lon *= GLIDE; vel.lat *= GLIDE;
    if (Math.abs(vel.lon) < 1e-6) vel.lon = 0; if (Math.abs(vel.lat) < 1e-6) vel.lat = 0;
  }
  const f = reduce ? 1 : Math.min(1, dt * 3.2);
  if (target.lon != null) { view.lon += (target.lon - view.lon) * f; view.lat += (target.lat - view.lat) * f; if (Math.abs(target.lon - view.lon) < 1e-5 && Math.abs(target.lat - view.lat) < 1e-5) target.lon = target.lat = null; }
  if (target.dist != null) {
    // ease in altitude, so zooming close feels even
    const a = Math.log(view.dist - 1), b = Math.log(target.dist - 1);
    view.dist = 1 + Math.exp(a + (b - a) * f);
    if (Math.abs(a - b) < 1e-3) { view.dist = target.dist; target.dist = null; }
  }
  if (patch && patchFade < 1) { patchFade = Math.min(1, patchFade + dt * (reduce ? 99 : 4)); patch.material.opacity = patchFade; outline.material.opacity = patchFade * 0.95; }
  applyView();
  invG.copy(globe.matrixWorld).invert();
  const key = view.lon.toFixed(5) + view.lat.toFixed(5) + view.dist.toFixed(5) + cssW + cssH;
  if (key !== prevKey || dirty) { updateOverlays(); prevKey = key; }
  if (ms - lastTiles > 150) { updateTiles(); lastTiles = ms; }
  dirty = false;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------------- sound + voice ---------------- */
let AC = null, master = null, noiseBuf = null, muted = false;
try { muted = localStorage.getItem('ps-muted') === '1'; } catch (e) {}
function unlock() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(AC.destination);
  const len = AC.sampleRate; noiseBuf = AC.createBuffer(1, len, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}
const ok = () => AC && !muted;
function tone(f, dur, o = {}) {
  if (!ok()) return; const t0 = AC.currentTime + (o.delay || 0), os = AC.createOscillator(), g = AC.createGain();
  os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t0); if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.vol || 0.12, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  os.connect(g); g.connect(master); os.start(t0); os.stop(t0 + dur + 0.05);
}
function noise(dur, f0, f1, vol, q = 1) {
  if (!ok()) return; const t0 = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.9);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.05);
}
const whoosh = () => noise(1, 400, 2400, 0.12);
const splash = () => { noise(0.7, 1800, 500, 0.09, 0.8); tone(420, 0.25, { to: 640, vol: 0.05, delay: 0.05 }); };
const tok = () => { tone(520, 0.08, { type: 'triangle', vol: 0.15 }); tone(260, 0.1, { vol: 0.07 }); };
const chime = () => [659, 988].forEach((f, i) => tone(f, 0.45, { type: 'triangle', vol: 0.07, delay: 0.06 + i * 0.1 }));
let sayT = 0;
function say(text) {
  if (muted || !('speechSynthesis' in window) || !text) return;
  clearTimeout(sayT);
  sayT = setTimeout(() => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.85; u.lang = 'en-US'; speechSynthesis.speak(u); } catch (e) {} }, 200);
}
const snd = $('sound');
function setMuted(m) {
  muted = m; snd.setAttribute('aria-pressed', m ? 'false' : 'true');
  try { localStorage.setItem('ps-muted', m ? '1' : '0'); } catch (e) {}
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, AC.currentTime, 0.05);
  if (m && 'speechSynthesis' in window) try { speechSynthesis.cancel(); } catch (e) {}
  if (!m) { tone(660, 0.12, { vol: 0.1 }); tone(990, 0.15, { vol: 0.1, delay: 0.1 }); }
}
snd.addEventListener('click', () => { unlock(); setMuted(!muted); });
snd.setAttribute('aria-pressed', muted ? 'false' : 'true');
document.addEventListener('visibilitychange', () => { if (!AC) return; document.hidden ? AC.suspend() : AC.resume(); });

/* grown-ups and credits: one panel open at a time, a tap anywhere else closes it */
const panels = [[$('gu'), $('guPanel')], [$('credits'), $('creditsPanel')]];
function togglePanel(btn) {
  for (const [b, p] of panels) { const open = b === btn && p.hidden; p.hidden = !open; b.setAttribute('aria-expanded', open ? 'true' : 'false'); }
}
for (const [b] of panels) b.addEventListener('click', e => { e.stopPropagation(); togglePanel(b); });
document.addEventListener('pointerdown', e => { if (!e.target.closest('.gu-wrap')) togglePanel(null); });

/* ---------------- start: a small Earth at once, then sharper pictures, then the map ---------------- */
{ const h = homeView(); view.lon = h.lon - 40 * DEG; view.lat = h.lat; flyTo(h.lon, h.lat); }
applyView();
const tex = (url, aniso) => new Promise((res, rej) => loader.load(url, t => { if (aniso) t.anisotropy = ANISO; res(t); }, undefined, rej));
const t0 = performance.now();
Promise.all([tex('img/day-1k.jpg', true), tex('img/night-1k.jpg')]).then(([d, n]) => {
  baseMat.uniforms.dayT.value = d; shared.nightT.value = n;
  $('loading').classList.add('gone');
  window.__t1k = performance.now() - t0;
  loadData().then(() => { window.__tdata = performance.now() - t0; });
  return Promise.all([tex('img/day-4k.jpg', true), tex('img/night-4k.jpg')]);
}).then(([d, n]) => {
  const od = baseMat.uniforms.dayT.value, on = shared.nightT.value;
  baseMat.uniforms.dayT.value = d; shared.nightT.value = n; od.dispose(); on.dispose();
  fetch('data/tiles.json').then(r => r.json()).then(m => { tileMap = m; }).catch(() => {});
  tilesOn = true; window.__t4k = performance.now() - t0;
});
requestAnimationFrame(frame);

/* test hook, only with ?test in the address */
if (TEST) window.__globe = {
  ready: () => ready, places: () => places.map(p => p.a2),
  info: a2 => { const p = byA2[a2]; if (!p) return null; let c = p.c; if (landAt(c[0], c[1]) !== p) { for (let r = 0.05; r < 3 && landAt(c[0], c[1]) !== p; r *= 1.3) for (let i = 0; i < 16; i++) { const q = [p.c[0] + Math.cos(i / 8 * Math.PI) * r, p.c[1] + Math.sin(i / 8 * Math.PI) * r]; if (landAt(q[0], q[1]) === p) { c = q; break; } } } return { name: p.name, c, size: p.size }; },
  look(lon, lat, dist) { idle = false; vel.lon = vel.lat = 0; target.lon = target.lat = target.dist = null; view.lon = lon * DEG; view.lat = lat * DEG; if (dist) view.dist = clampDist(dist); applyView(); invG.copy(globe.matrixWorld).invert(); updateOverlays(); },
  screenOf(lon, lat) { const o = {}; screenOf(lon, lat, o); return o; },
  tap(x, y) { const s = tapAt(x, y); target.lon = target.lat = target.dist = null; return s ? (s.kind === 'place' ? s.p.a2 : 'water:' + s.w.n) : null; },
  marks: () => shownMarks.map(m => m.p.a2), labels: () => wlabels.filter(l => l.on).map(l => l.n),
  R: () => radiusPx(), dist: () => view.dist, tiles: () => [...tiles.values()].filter(t => t.ready).length,
};
