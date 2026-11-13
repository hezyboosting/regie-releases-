// Récap de fin de live : s'ouvre tout seul quand le live s'arrête, et se rouvre depuis Stats.
import { html, setState, copy, fmt, tr, getLang } from '../store.js';
import { Btn, ICONS } from '../ui.js';

const dur = (ms) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
};

function Kpi({ label, value, prev }) {
  const diff = prev === undefined || prev === null ? null : value - prev;
  return html`<div class="rc-kpi">
    <span>${label}</span><b>${fmt(value)}</b>
    ${diff !== null && diff !== 0 && html`<small class=${diff > 0 ? 'up' : 'down'}>${diff > 0 ? '▲' : '▼'} ${fmt(Math.abs(diff))}</small>`}
  </div>`;
}

// Le résumé copiable, à coller sur Discord ou ailleurs.
function summary(r) {
  const L = (fr) => tr(fr);
  const lines = [
    `${L('Récap du live')} · ${new Date(r.start).toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'fr-FR')} · ${dur(r.duration)} · ${r.game}`,
    `${L('Pic de spectateurs')} : ${r.peak} · ${L('Suivis')} : ${r.follows} · ${L('Abonnements')} : ${r.subs} · ${L('Pièces')} : ${r.coins} · ${L('Likes')} : ${r.likes} · ${L('Messages')} : ${r.messages}`,
  ];
  if (r.top.length) lines.push(`${L('Meilleurs soutiens')} : ${r.top.map((t) => t.name).join(', ')}`);
  return lines.join('\n');
}

export function RecapModal({ recap: r }) {
  if (!r) return null;
  const close = () => setState({ liveRecap: null });
  const p = r.prev || {};
  return html`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="rc-title" onClick=${(e) => { if (e.target === e.currentTarget) close(); }}>
    <div class="rc">
      <header class="rc-head">
        <div><h1 id="rc-title">Récap du live</h1><p>${new Date(r.start).toLocaleString(getLang() === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'full', timeStyle: 'short' })} · ${dur(r.duration)} · ${r.game}</p></div>
        <button type="button" class="icon" aria-label="Fermer" onClick=${close}>${ICONS.x}</button>
      </header>
      <div class="rc-kpis">
        <${Kpi} label="Pic de spectateurs" value=${r.peak} prev=${p.peak} />
        <${Kpi} label="Suivis" value=${r.follows} prev=${p.follows} />
        <${Kpi} label="Abonnements" value=${r.subs} prev=${p.subs} />
        <${Kpi} label="Pièces" value=${r.coins} prev=${p.coins} />
        <${Kpi} label="Likes" value=${r.likes} prev=${p.likes} />
        <${Kpi} label="Messages" value=${r.messages} prev=${p.messages} />
      </div>
      ${r.prev && html`<p class="note">Les flèches comparent avec ton live précédent.</p>`}
      <div class="rc-cols">
        <section>
          <h2>Meilleurs soutiens</h2>
          ${r.top.length ? html`<ol class="rc-top">${r.top.map((t, i) => html`<li key=${t.name}><i>${i + 1}</i><span>${t.name}</span><b>${fmt(t.points)}</b></li>`)}</ol>` : html`<p class="note">Pas de cadeau pendant ce live.</p>`}
          ${r.biggestGift && html`<p class="rc-gift">Plus gros cadeau : <b>${r.biggestGift.user}</b>, ${r.biggestGift.gift} (${fmt(r.biggestGift.value)} pièces)</p>`}
        </section>
        <section>
          <h2>Le chat</h2>
          <p class="rc-line"><b>${fmt(r.viewers)}</b> personnes ont participé</p>
          ${r.chatty.length > 0 && html`<p class="rc-line">Les plus bavards : ${r.chatty.map((c) => c.name).join(', ')}</p>`}
          ${r.newFollowers.length > 0 && html`<p class="rc-line">Nouveaux : ${r.newFollowers.join(', ')}</p>`}
          ${(r.spins > 0 || r.raceWinners.length > 0) && html`<p class="rc-line">${r.spins > 0 ? html`<b>${r.spins}</b> tours de roue` : ''}${r.spins > 0 && r.raceWinners.length ? ' · ' : ''}${r.raceWinners.length ? html`Courses gagnées par ${r.raceWinners.join(', ')}` : ''}</p>`}
        </section>
      </div>
      <div class="row tight">
        <${Btn} kind="primary" icon=${ICONS.copy} onClick=${() => copy(summary(r), 'Récap copié')}>Copier le récap<//>
        <${Btn} onClick=${() => { close(); setState({ view: 'stats' }); }}>Voir mes stats<//>
        <${Btn} onClick=${close}>Fermer<//>
      </div>
    </div>
  </div>`;
}
