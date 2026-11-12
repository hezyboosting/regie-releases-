// Overlay Spotify maison. Le bras de la platine et les bobines de la cassette suivent la vraie progression du morceau.
import { el, svg, clock, proxied, setVars, isPreview, hexToRgb } from '../lib.js';

const DEMO_COVER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#FF5A3C"/><stop offset="1" stop-color="#3A1C71"/></linearGradient></defs><rect width="300" height="300" fill="url(#a)"/><circle cx="210" cy="92" r="46" fill="#FFD36B"/><path d="M0 232 80 160l70 50 80-70 70 60v100H0Z" fill="#160B2E"/></svg>')}`;
const EMPTY = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const DEMO = { playing: true, progress: 74000, at: Date.now(), track: { id: 'demo', title: 'Nuit sur le périph', artist: 'Les Faisceaux', album: 'Direct', cover: DEMO_COVER, duration: 214000 }, queue: [{ title: 'Grand Paris Express', artist: 'Les Faisceaux' }], requester: '' };

// Extrait une couleur vive et une couleur sombre de la pochette.
async function palette(cover) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 24; c.height = 24;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let best = null; let bestScore = -1; let dark = [0, 0, 0]; let darkN = 0;
        for (let i = 0; i < d.length; i += 4) {
          const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
          const max = Math.max(r, g, b); const min = Math.min(r, g, b);
          const sat = max ? (max - min) / max : 0;
          const score = sat * sat * (max / 255) * (max > 70 ? 1 : 0.2);
          if (score > bestScore) { bestScore = score; best = [r, g, b]; }
          if (max < 110) { dark = [dark[0] + r, dark[1] + g, dark[2] + b]; darkN += 1; }
        }
        const dk = darkN ? dark.map((v) => Math.round((v / darkN) * 0.55)) : best.map((v) => Math.round(v * 0.16));
        resolve({ c1: `rgb(${best.join(',')})`, c2: `rgb(${dk.join(',')})`, lum: (best[0] * 0.3 + best[1] * 0.59 + best[2] * 0.11) });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = cover;
  });
}

function reel(parent, cx, cy) {
  const g = svg('g', {}, parent);
  const tape = svg('circle', { cx, cy, r: 40, fill: '#17120f' }, g);
  svg('circle', { cx, cy, r: 19, fill: '#f3efe4' }, g);
  const hub = svg('g', {}, g);
  for (let i = 0; i < 6; i += 1) {
    const a = (i * Math.PI) / 3;
    svg('rect', { x: cx - 2.4, y: cy - 16, width: 4.8, height: 8, fill: '#3b3631', transform: `rotate(${(a * 180) / Math.PI} ${cx} ${cy})` }, hub);
  }
  svg('circle', { cx, cy, r: 8, fill: '#3b3631' }, g);
  return { tape, hub, cx, cy, angle: 0 };
}

function buildCassette(host, refs) {
  const s = svg('svg', { viewBox: '0 0 560 352' }, host);
  svg('rect', { x: 3, y: 3, width: 554, height: 346, rx: 18, fill: 'var(--c1)', stroke: 'rgba(0,0,0,.55)', 'stroke-width': 2 }, s);
  svg('rect', { x: 14, y: 14, width: 532, height: 324, rx: 10, fill: 'none', stroke: 'rgba(0,0,0,.18)', 'stroke-width': 2 }, s);
  for (const [cx, cy] of [[24, 24], [536, 24], [24, 328], [536, 328]]) svg('circle', { cx, cy, r: 5, fill: 'rgba(0,0,0,.4)' }, s);
  svg('rect', { x: 40, y: 34, width: 480, height: 208, rx: 7, fill: '#f3efe4' }, s);
  svg('rect', { x: 40, y: 34, width: 480, height: 16, fill: 'var(--c2)' }, s);
  for (const y of [86, 114]) svg('line', { x1: 56, x2: 504, y1: y, y2: y, stroke: 'rgba(0,0,0,.14)', 'stroke-width': 1.5 }, s);
  refs.title = svg('text', { x: 58, y: 82, fill: '#1c1a17', 'font-size': 29, style: 'font-family:"Segoe Print","Bradley Hand","Comic Sans MS",cursive;font-weight:700' }, s);
  refs.artist = svg('text', { x: 58, y: 110, fill: '#3b3631', 'font-size': 20, style: 'font-family:"Segoe Print","Bradley Hand","Comic Sans MS",cursive' }, s);
  svg('text', { x: 500, y: 110, fill: '#1c1a17', 'font-size': 26, 'text-anchor': 'end', 'font-weight': 900 }, s).textContent = 'A';
  svg('rect', { x: 110, y: 130, width: 340, height: 100, rx: 50, fill: 'var(--c2)' }, s);
  const win = svg('clipPath', { id: 'tapewin' }, s);
  svg('rect', { x: 110, y: 130, width: 340, height: 100, rx: 50 }, win);
  const g = svg('g', { 'clip-path': 'url(#tapewin)' }, s);
  svg('rect', { x: 110, y: 130, width: 340, height: 100, fill: '#1a1613' }, g);
  refs.left = reel(g, 170, 180);
  refs.right = reel(g, 390, 180);
  svg('rect', { x: 228, y: 148, width: 104, height: 64, rx: 4, fill: 'rgba(255,255,255,.1)' }, s);
  refs.bar = svg('rect', { x: 234, y: 176, width: 0, height: 8, fill: 'var(--c1)' }, s);
  svg('path', { d: 'M92 346 L116 268 H444 L468 346 Z', fill: 'rgba(0,0,0,.2)' }, s);
  for (const x of [190, 280, 370]) svg('circle', { cx: x, cy: 310, r: 9, fill: 'rgba(0,0,0,.45)' }, s);
  refs.next = svg('text', { x: 280, y: 288, fill: '#fff', 'font-size': 15, 'text-anchor': 'middle', 'font-weight': 600, opacity: 0.9 }, s);
  refs.req = svg('text', { x: 58, y: 64, fill: '#fff', 'font-size': 0 }, s);
}

function buildMeter(host, label) {
  const s = svg('svg', { viewBox: '0 0 340 190' }, host);
  svg('rect', { x: 2, y: 2, width: 336, height: 186, rx: 8, fill: '#F1E7C9', stroke: 'rgba(0,0,0,.5)', 'stroke-width': 2 }, s);
  const cx = 170; const cy = 214; const R = 168;
  const pt = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const arc = (a1, a2, r) => { const [x1, y1] = pt(a1, r); const [x2, y2] = pt(a2, r); return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`; };
  svg('path', { d: arc(-44, 18, R), fill: 'none', stroke: '#1e1a12', 'stroke-width': 3 }, s);
  svg('path', { d: arc(18, 44, R), fill: 'none', stroke: '#C4291C', 'stroke-width': 8 }, s);
  for (let d = -44; d <= 44; d += 11) {
    const [x1, y1] = pt(d, R); const [x2, y2] = pt(d, R + 11);
    svg('line', { x1, y1, x2, y2, stroke: d > 18 ? '#C4291C' : '#1e1a12', 'stroke-width': 2.5 }, s);
  }
  svg('text', { x: 312, y: 150, 'text-anchor': 'end', 'font-size': 26, 'font-weight': 800, fill: '#1e1a12' }, s).textContent = 'VU';
    const needle = svg('line', { x1: cx, y1: cy, x2: cx, y2: cy - R - 2, stroke: '#141210', 'stroke-width': 2.4, transform: `rotate(-46 ${cx} ${cy})` }, s);
  svg('rect', { x: 2, y: 160, width: 336, height: 28, rx: 4, fill: '#D5CAA6' }, s);
  svg('text', { x: 18, y: 180, 'font-size': 15, 'font-weight': 700, fill: '#1e1a12' }, s).textContent = label;
  return { needle, cx, cy, value: 0 };
}

export function mount(root) {
  let s = {};
  let st = isPreview ? DEMO : { playing: false, track: null, queue: [] };
  const box = el('div', 'sp scaled');
  root.append(box);
  let built = '';
  let refs = {};
  let lastCover = null;
  let levels = { l: 0, r: 0, bass: 0, bands: [] };
  let levelsAt = 0;

  const now = () => (st.playing ? (st.progress || 0) + (Date.now() - (st.at || Date.now())) : st.progress || 0);
  const coverUrl = () => { const c = st.track?.cover; return !c ? '' : c.startsWith('data:') ? c : proxied(c); };

  function txt(parent, cls, key) { const n = el('div', cls); refs[key] = n; parent.append(n); return n; }
  function progressBar(parent) { const p = el('div', 'pr'); refs.pr = el('i'); p.append(refs.pr); parent.append(p); }

  function build() {
    box.textContent = '';
    refs = {};
    box.className = `sp scaled ${s.theme}`;
    if (s.theme === 'capsule') {
      refs.cover = el('img', 'cv'); refs.cover.alt = ''; box.append(refs.cover);
      const t = el('div', 'tx'); txt(t, 'sp-t', 'title'); txt(t, 'sp-a', 'artist'); progressBar(t); box.append(t);
      refs.eq = el('div', 'eq'); for (let i = 0; i < 6; i += 1) refs.eq.append(el('i')); box.append(refs.eq);
    } else if (s.theme === 'platine') {
      const deck = el('div', 'deck');
      refs.strobe = svg('svg', { class: 'strobe', viewBox: '0 0 224 224' }, deck);
      refs.dots = [];
      for (let i = 0; i < 64; i += 1) {
        const a = (i / 64) * Math.PI * 2;
        refs.dots.push(svg('circle', { cx: 112 + 108 * Math.cos(a), cy: 112 + 108 * Math.sin(a), r: 2, fill: 'var(--c1)', opacity: 0.25 }, refs.strobe));
      }
      const disc = el('div', 'disc'); refs.cover = el('img'); refs.cover.alt = ''; disc.append(refs.cover); deck.append(disc, el('div', 'spindle'));
      const arm = el('div', 'arm');
      const a = svg('svg', { width: 30, height: 150, viewBox: '0 0 30 150' }, arm);
      svg('circle', { cx: 14, cy: 14, r: 12, fill: '#c9c5ba' }, a);
      svg('path', { d: 'M14 14 L14 104 L5 132', fill: 'none', stroke: '#e6e2d6', 'stroke-width': 4, 'stroke-linecap': 'round' }, a);
      svg('rect', { x: -2, y: 128, width: 14, height: 22, rx: 2, fill: 'var(--c1)', transform: 'rotate(18 5 132)' }, a);
      svg('circle', { cx: 14, cy: 14, r: 5, fill: '#3b3631' }, a);
      refs.arm = a; deck.append(arm); box.append(deck);
      const info = el('div', 'pl-info');
      txt(info, 'sp-t', 'title'); txt(info, 'sp-a', 'artist');
      const time = el('div', 'pl-time'); refs.t1 = el('span'); time.append(refs.t1); progressBar(time); refs.t2 = el('span'); time.append(refs.t2); info.append(time);
      txt(info, 'sp-next', 'next'); refs.req = el('div', 'sp-req'); info.append(refs.req);
      box.append(info);
    } else if (s.theme === 'cassette') {
      buildCassette(box, refs);
      refs.req = el('div', 'sp-req'); box.append(refs.req);
    } else if (s.theme === 'vu') {
      refs.ml = buildMeter(box, 'Gauche'); refs.mr = buildMeter(box, 'Droite');
      const p = el('div', 'plate'); txt(p, 'sp-t', 'title'); txt(p, 'sp-a', 'artist'); txt(p, 'tm2', 'time'); box.append(p);
    } else {
      box.append(el('div', 'bar'));
      refs.cover = el('img'); refs.cover.alt = ''; box.append(refs.cover);
      const t = el('div', 'tx'); txt(t, 'sp-t', 'title'); txt(t, 'sp-a', 'artist'); progressBar(t); box.append(t);
    }
    built = s.theme;
    lastCover = null;
  }

  async function render() {
    if (built !== s.theme) build();
    const tr = st.track;
    box.classList.toggle('hidden', !tr || (s.hidePaused && !st.playing));
    box.style.setProperty('--play', st.playing ? 'running' : 'paused');
    if (!tr) return;
    const nextTxt = s.showNext && st.queue?.[0] ? `Ensuite : ${st.queue[0].title}` : '';
    if (refs.title) refs.title.textContent = tr.title;
    if (refs.artist) refs.artist.textContent = tr.artist;
    if (refs.next) refs.next.textContent = nextTxt;
    if (refs.req) {
      const show = s.showRequester && st.requester;
      if (refs.req.style) refs.req.style.display = show ? 'inline-block' : 'none';
      refs.req.textContent = show ? `Demandé par ${st.requester}` : '';
    }
    if (s.theme === 'bandeau') { box.classList.remove('swap'); void box.offsetWidth; box.classList.add('swap'); }
    if (tr.cover !== lastCover) {
      lastCover = tr.cover;
      const url = coverUrl();
      if (refs.cover) refs.cover.src = url || EMPTY;
      const p = s.autoColor && url ? await palette(url) : null;
      if (p) setVars(box, { c1: p.c1, c2: p.c2 });
      else setVars(box, { c1: s.accent, c2: '#14181D' });
    }
  }

  function simulated(t) {
    const beat = Math.pow(Math.max(0, Math.sin(t / 230)), 6);
    const l = 0.42 + 0.26 * Math.sin(t / 310) * Math.sin(t / 127) + 0.34 * beat;
    const r = 0.42 + 0.26 * Math.sin(t / 287) * Math.sin(t / 141) + 0.34 * beat;
    const bands = Array.from({ length: 16 }, (_, i) => Math.abs(Math.sin(t / (130 + i * 37) + i)) * (0.5 + beat * 0.5));
    return { l, r, bass: beat, bands };
  }

  function frame() {
    requestAnimationFrame(frame);
    if (!st.track) return;
    const t = performance.now();
    const pos = Math.min(now(), st.track.duration || 1);
    const p = st.track.duration ? pos / st.track.duration : 0;
    const live = s.reactive && Date.now() - levelsAt < 1500;
    const lv = !st.playing ? { l: 0, r: 0, bass: 0, bands: [] } : live ? levels : simulated(t);

    // Certains lecteurs ne donnent pas la durée : on retire alors la barre plutôt qu'afficher 0:00.
    const timed = st.track.duration > 0;
    if (refs.pr) { refs.pr.style.width = `${p * 100}%`; refs.pr.parentElement.style.visibility = timed ? '' : 'hidden'; }
    if (refs.t1) refs.t1.textContent = timed ? clock(pos / 1000) : '';
    if (refs.t2) refs.t2.textContent = timed ? `-${clock((st.track.duration - pos) / 1000)}` : '';
    if (refs.time) refs.time.textContent = timed ? `${clock(pos / 1000)} / ${clock(st.track.duration / 1000)}` : '';
    if (refs.eq) [...refs.eq.children].forEach((b, i) => { b.style.transform = `scaleY(${Math.max(0.08, Math.min(1, lv.bands[i * 2] ?? 0))})`; });
    // Le bras avance du bord vers le centre du disque, comme sur une vraie platine.
    if (refs.arm) {
      const angle = st.playing || pos > 0 ? 8 + p * 24 : -14;
      refs.arm.style.transform = `rotate(${angle}deg)`;
    }
    if (refs.dots) {
      const lit = lv.bass;
      refs.dots.forEach((d, i) => d.setAttribute('opacity', (0.18 + 0.82 * Math.max(0, lit - Math.abs(Math.sin(i * 0.8 + t / 500)) * 0.25)).toFixed(2)));
    }
    // Bobines : la bande passe de gauche à droite, le diamètre suit le temps restant.
    if (refs.left) {
      const area = (x) => Math.sqrt(19 * 19 + (54 * 54 - 19 * 19) * x);
      refs.left.tape.setAttribute('r', area(1 - p).toFixed(1));
      refs.right.tape.setAttribute('r', area(p).toFixed(1));
      if (st.playing) { refs.left.angle += 1.1; refs.right.angle += 1.1; }
      refs.left.hub.setAttribute('transform', `rotate(${refs.left.angle} ${refs.left.cx} ${refs.left.cy})`);
      refs.right.hub.setAttribute('transform', `rotate(${refs.right.angle} ${refs.right.cx} ${refs.right.cy})`);
      refs.bar.setAttribute('width', (92 * p).toFixed(1));
    }
    if (refs.ml) {
      for (const [m, v] of [[refs.ml, lv.l], [refs.mr, lv.r]]) {
        m.value += (Math.min(1.08, v) - m.value) * 0.28;
        m.needle.setAttribute('transform', `rotate(${(-46 + m.value * 84).toFixed(2)} ${m.cx} ${m.cy})`);
      }
    }
  }
  requestAnimationFrame(frame);

  return {
    update(settings, data) {
      s = settings;
      setVars(root, { text: s.text });
      setVars(box, { c1: s.accent });
      if (data?.spotify?.track) st = data.spotify;
      lastCover = null;
      render();
    },
    on(msg) {
      if (msg.t === 'spotify') { st = msg.spotify.track || !isPreview ? msg.spotify : DEMO; render(); }
      if (msg.t === 'audio') { levels = msg.levels; levelsAt = Date.now(); }
    },
  };
}
