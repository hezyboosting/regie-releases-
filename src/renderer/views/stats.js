import { html, useState, useEffect, useRef, act, fmt, toast, PLATFORM, setState, getLang } from '../store.js';
import { Btn, Bay, PageHead, Segments, Empty, Tag, Upsell, Lamp, Field, Select } from '../ui.js';

const METRICS = [
  { value: 'chat', label: 'Messages' }, { value: 'follow', label: 'Suivis' }, { value: 'sub', label: 'Abonnements' }, { value: 'coins', label: 'Pièces' }, { value: 'bitsTotal', label: 'Bits' }, { value: 'money', label: 'Super Chats' }, { value: 'peak', label: 'Pic de spectateurs' },
];
const W = 760; const H = 260; const PAD = { l: 48, r: 86, t: 14, b: 28 };

function niceMax(v) {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const shortDay = (d) => { const [, m, j] = d.split('-'); return `${j}/${m}`; };

// Une seule échelle, une couleur par plateforme, et un survol qui donne les valeurs exactes.
function LineChart({ series, metric }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const platforms = Object.keys(PLATFORM).filter((p) => series.some((row) => row[p]?.[metric]));
  const value = (row, p) => row[p]?.[metric] || 0;
  const max = niceMax(Math.max(1, ...series.flatMap((row) => platforms.map((p) => value(row, p)))));
  const x = (i) => PAD.l + (series.length < 2 ? (W - PAD.l - PAD.r) / 2 : (i / (series.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v) => H - PAD.b - (v / max) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const move = (e) => {
    const box = ref.current.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const step = series.length < 2 ? 1 : (W - PAD.l - PAD.r) / (series.length - 1);
    setHover(Math.max(0, Math.min(series.length - 1, Math.round((px - PAD.l) / step))));
  };
  if (!platforms.length) return html`<${Empty} title="Pas encore de données">Cette mesure se remplit pendant tes lives.<//>`;
  const row = hover !== null ? series[hover] : null;
  return html`<div class="chart">
    <ul class="legend">${platforms.map((p) => html`<li key=${p}><i style=${{ background: PLATFORM[p].chart }}></i>${PLATFORM[p].label}</li>`)}</ul>
    <div class="chart-box">
      <svg ref=${ref} viewBox=${`0 0 ${W} ${H}`} role="img" aria-label="Évolution par jour et par plateforme" onMouseMove=${move} onMouseLeave=${() => setHover(null)}>
        ${ticks.map((t) => html`<g key=${t}><line x1=${PAD.l} x2=${W - PAD.r} y1=${y(t)} y2=${y(t)} class="grid" /><text x=${PAD.l - 8} y=${y(t) + 4} class="tick" text-anchor="end">${fmt(t)}</text></g>`)}
        ${series.map((r, i) => (series.length <= 8 || i % Math.ceil(series.length / 8) === 0) && html`<text key=${r.day} x=${x(i)} y=${H - 8} class="tick" text-anchor="middle">${shortDay(r.day)}</text>`)}
        ${hover !== null && html`<line x1=${x(hover)} x2=${x(hover)} y1=${PAD.t} y2=${H - PAD.b} class="cross" />`}
        ${platforms.map((p) => {
    const pts = series.map((r, i) => `${x(i)},${y(value(r, p))}`).join(' ');
    const lastI = series.length - 1;
    return html`<g key=${p}>
            ${series.length > 1 && html`<polyline points=${pts} fill="none" stroke=${PLATFORM[p].chart} stroke-width="2" stroke-linejoin="round" />`}
            ${(series.length === 1 || hover !== null) && series.map((r, i) => (series.length === 1 || i === hover) && html`<circle key=${i} cx=${x(i)} cy=${y(value(r, p))} r="4.500" fill=${PLATFORM[p].chart} stroke="#1C1736" stroke-width="2" />`)}
            <text x=${x(lastI) + 8} y=${y(value(series[lastI], p)) + 4} class="direct">${PLATFORM[p].label}</text>
          </g>`;
  })}
      </svg>
      ${row && html`<div class="tip" style=${{ left: `${Math.min(78, (x(hover) / W) * 100)}%` }}>
        <b>${shortDay(row.day)}</b>
        ${platforms.map((p) => html`<span key=${p}><i style=${{ background: PLATFORM[p].chart }}></i>${PLATFORM[p].label}<em>${fmt(value(row, p))}</em></span>`)}
      </div>`}
    </div>
  </div>`;
}

// Historique des lives, avec comparaison de deux lives en ULTIMATE.
function Lives({ s }) {
  const [list, setList] = useState([]);
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  useEffect(() => { act('statsLives').then((l) => l && setList(l)); }, [s.channels.filter((c) => c.status.state === 'live').length]);
  if (!list.length) return html`<${Bay} title="Mes lives"><p class="note">Chaque live terminé apparaîtra ici.</p><//>`;
  const mins = (l) => Math.round((l.end - l.start) / 60000);
  const COLS = [['Durée (min)', mins], ['Pic', (l) => l.peak || 0], ['Suivis', (l) => l.follows || 0], ['Messages', (l) => l.messages || 0], ['Pièces', (l) => l.coins || 0], ['Likes', (l) => l.likes || 0]];
  const opts = list.map((l, i) => ({ value: String(i), label: new Date(l.start).toLocaleString(getLang() === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }));
  const x = list[a];
  const y = list[b];
  return html`<${Bay} title="Mes lives">
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th>${COLS.map(([n]) => html`<th key=${n}>${n}</th>`)}<th></th></tr></thead>
      <tbody>${list.slice(0, 15).map((l) => html`<tr key=${l.start}><td>${new Date(l.start).toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'fr-FR')}</td>${COLS.map(([n, f]) => html`<td key=${n}>${fmt(f(l))}</td>`)}<td>${l.recap && html`<button type="button" class="linkish" onClick=${() => setState({ liveRecap: l.recap })}>Récap</button>`}</td></tr>`)}</tbody>
    </table></div>
    ${s.features.liveCompare && list.length > 1 && html`<div class="row wrap">
      <${Field} label="Live A"><${Select} value=${String(a)} options=${opts} onChange=${(v) => setA(Number(v))} /><//>
      <${Field} label="Live B"><${Select} value=${String(b)} options=${opts} onChange=${(v) => setB(Number(v))} /><//>
    </div>
    ${x && y && html`<div class="table-wrap"><table>
      <thead><tr><th></th><th>Live A</th><th>Live B</th><th>Écart</th></tr></thead>
      <tbody>${COLS.map(([n, f]) => html`<tr key=${n}><td>${n}</td><td>${fmt(f(x))}</td><td>${fmt(f(y))}</td><td>${f(x) - f(y) > 0 ? '+' : ''}${fmt(f(x) - f(y))}</td></tr>`)}</tbody>
    </table></div>`}`}
  <//>`;
}

export function Stats({ s }) {
  const [r, setR] = useState(null);
  const [metric, setMetric] = useState('chat');
  const [table, setTable] = useState(false);
  useEffect(() => { act('statsReport').then(setR); }, [s.feed.length]);
  if (!r) return null;
  const t = r.totals;
  const sum = (k) => Object.values(t).reduce((n, b) => n + (b[k] || 0), 0);
  const peak = Math.max(0, ...Object.values(t).map((b) => b.peak || 0));
  const tiles = [
    ['Messages', sum('chat')], ['Suivis', sum('follow')], ['Abonnements', sum('sub') + sum('resub') + sum('subsGifted') + sum('member')], ['Pièces TikTok', sum('coins')], ['Bits', sum('bitsTotal')], ['Pic de spectateurs', peak],
  ];
  return html`<div class="page">
    <${PageHead} title="Stats">
      <${Btn} onClick=${async () => { const r2 = await act('recapNow'); if (r2) setState({ liveRecap: r2 }); }}>Récap du live en cours<//>
      <${Lamp} on=${s.recapCfg?.open !== false} label="Ouvrir le récap à la fin du live" onChange=${async (open) => { const x = await act('updateRecap', { open }); if (x) setState({ recapCfg: x }); }} />
      <${Lamp} on=${Boolean(s.recapCfg?.thanks)} label="Remercier les meilleurs soutiens dans le chat" onChange=${async (thanks) => { const x = await act('updateRecap', { thanks }); if (x) setState({ recapCfg: x }); }} />
      <${Btn} disabled=${!s.features.statsExport} onClick=${async () => { const p = await act('statsExport'); if (p) toast('Stats exportées'); }}>Exporter en CSV<//>
    <//>
    <div class="tiles">${tiles.map(([l, v]) => html`<div class="tile" key=${l}><b>${fmt(v)}</b><span>${l}</span></div>`)}</div>
    <${Bay} title="Par jour" aside=${html`<button class="linkish" onClick=${() => setTable(!table)}>${table ? 'Voir le graphique' : 'Voir le tableau'}</button>`}>
      <${Segments} value=${metric} options=${METRICS} onChange=${setMetric} />
      ${r.series.length === 0 ? html`<${Empty} title="Pas encore de données">Tes stats démarrent à ton premier live connecté.<//>` : table ? html`<div class="table-wrap"><table>
        <thead><tr><th>Jour</th>${Object.values(PLATFORM).map((p) => html`<th key=${p.label}>${p.label}</th>`)}</tr></thead>
        <tbody>${r.series.map((row) => html`<tr key=${row.day}><td>${shortDay(row.day)}</td>${Object.keys(PLATFORM).map((p) => html`<td key=${p}>${fmt(row[p]?.[metric])}</td>`)}</tr>`)}</tbody>
      </table></div>` : html`<${LineChart} series=${r.series} metric=${metric} />`}
      ${r.hidden > 0 && html`<p class="note">${r.hidden} jours plus anciens sont gardés et visibles avec PRO.</p>`}
    <//>
    <${Bay} title="Meilleurs soutiens">
      ${r.top.length ? html`<ol class="toplist">${r.top.map((p, i) => html`<li key=${p.name + i}><span class="rank">${i + 1}</span><${Tag} platform=${p.platform} /><span class="nm">${p.name}</span><b>${fmt(p.points)}</b></li>`)}</ol>` : html`<p class="note">Le classement démarre au premier soutien.</p>`}
    <//>
    <${Lives} s=${s} />
    <${Upsell}>FREE : ${s.features.statsDays} jours d'historique. PRO : 90 jours et l'export CSV. ULTIMATE : tout l'historique et la comparaison des lives.<//>
  </div>`;
}
