import { html, useState, act, setState, fmt, toast, reload } from '../store.js';
import { Btn, Bay, PageHead, Empty, Select, Pro, Segments } from '../ui.js';

function Hl({ label, name, sub, value, image, fallback }) {
  return html`<div class="hl">
    ${image ? html`<img class="hl-pic" src=${image} alt="" referrerpolicy="no-referrer" />` : html`<span class="hl-pic">${fallback}</span>`}
    <div class="hl-txt"><span>${label}</span><b>${name}</b><span>${sub}</span></div>
    <span class="hl-val">${value}</span>
  </div>`;
}

const LINKS = [['giftfeed', 'Gift Feed'], ['gifttracker', 'Gift Tracker'], ['topgift', 'Top Gift'], ['topstreak', 'Top Streak']];

function Tracker({ s }) {
  const g = s.session || {};
  const open = async (type) => {
    let o = s.overlays.find((x) => x.type === type);
    if (!o) { o = await act('addOverlay', type); if (!o) return; await reload(); }
    setState({ view: 'overlays', overlayId: o.id });
  };
  const tg = g.topGift;
  const ts = g.topStreak;
  return html`<div class="col">
    <div class="tiles">
      <div class="tile"><b>${fmt(g.coins)}</b><span>Valeur reçue</span></div>
      <div class="tile"><b>${fmt(g.count)}</b><span>Cadeaux</span></div>
      <div class="tile"><b>${fmt(g.byGift?.length)}</b><span>Types de cadeaux</span></div>
    </div>
    <div class="highlights">
      <${Hl} label="Top Gift" name=${tg ? tg.user : 'Personne'} sub=${tg ? tg.name : 'En attente du premier cadeau'} value=${tg ? fmt(tg.value) : ''} image=${tg?.image} fallback="1" />
      <${Hl} label="Top Streak" name=${ts ? ts.user : 'Personne'} sub=${ts ? ts.name : 'En attente d\'une série'} value=${ts ? `×${fmt(ts.count)}` : ''} image=${ts?.image} fallback="×" />
    </div>
    <div class="two">
      <${Bay} title="Cadeaux reçus">
        ${g.byGift?.length ? html`<ol class="toplist">${g.byGift.slice(0, 12).map((x) => html`<li key=${x.id}>${x.image ? html`<img src=${x.image} alt="" referrerpolicy="no-referrer" />` : html`<span class="mono">${x.name.slice(0, 1)}</span>`}<span class="nm">${x.name}</span><span class="tagline">×${fmt(x.count)}</span><b>${fmt(x.coins)}</b></li>`)}</ol>` : html`<p class="note">Le tracker se remplit pendant le live.</p>`}
      <//>
      <${Bay} title="Dans tes overlays">
        <div class="pick-list">${LINKS.map(([type, name]) => html`<button type="button" class="pick" key=${type} onClick=${() => open(type)}><b>${name}</b><span>${s.overlays.some((o) => o.type === type) ? 'Régler et copier le lien' : 'Créer cet overlay'}</span></button>`)}</div>
      <//>
    </div>
  </div>`;
}

export function Gifts({ s }) {
  const [tab, setTab] = useState('live');
  return html`<div class="page">
    <${PageHead} title="Cadeaux" />
    <${Segments} value=${tab} onChange=${setTab} options=${[{ value: 'live', label: 'Gift Tracker' }, { value: 'catalog', label: 'Gift Browser' }]} />
    ${tab === 'live' ? html`<${Tracker} s=${s} />` : html`<${Catalog} s=${s} />`}
  </div>`;
}

function Catalog({ s }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('asc');
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(null);
  const load = async () => {
    setLoading(true);
    const list = await act('loadGifts');
    setLoading(false);
    if (list) { setState({ gifts: list }); toast(`${list.length} cadeaux chargés`); }
  };
  const list = s.gifts
    .filter((g) => g.name?.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === 'asc' ? a.cost - b.cost : b.cost - a.cost));
  const b = s.battle;
  const toggleTeam = async (teamIdx, g) => {
    const teams = b.teams.map((t, i) => {
      if (i !== teamIdx) return t;
      const ids = new Set(t.giftIds || []);
      if (ids.has(g.id)) ids.delete(g.id); else ids.add(g.id);
      return { ...t, giftIds: [...ids] };
    });
    const r = await act('updateBattle', { teams });
    if (r) setState({ battle: r });
  };
  const hasGiftTrig = s.features.giftTriggers;
  return html`<div class="col">
    <div class="row tight">
      <input class="in" style=${{ flex: 1, width: 'auto' }} type="search" value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Chercher un cadeau" aria-label="Chercher un cadeau" />
      <span style=${{ width: '170px' }}><${Select} value=${sort} onChange=${setSort} options=${[{ value: 'asc', label: 'Prix croissant' }, { value: 'desc', label: 'Prix décroissant' }]} /></span>
      <${Btn} kind="primary" disabled=${loading} onClick=${load}>${loading ? 'Chargement' : 'Charger le catalogue'}<//>
    </div>
    ${picked && html`<${Bay} title=${`${picked.name}, ${fmt(picked.cost)} pièces`}>
      <div class="row wrap">
        <${Btn} disabled=${!hasGiftTrig} onClick=${() => setState({ view: 'commands', commandsTab: 'triggers', newTrigger: { name: picked.name, on: { type: 'gift', platforms: [], minAmount: 0, giftId: picked.id } } })}>Associer un son ou une action${hasGiftTrig ? '' : html` <${Pro} />`}<//>
        <${Btn} disabled=${!s.features.alertRulesCustom} onClick=${async () => { const base = s.alerts.rules.find((r) => r.type === 'gift'); const a = await act('addRule', 'gift', base.id); if (a) { const rule = a.rules[a.rules.length - 1]; const out = await act('updateRule', rule.id, { giftId: picked.id, minAmount: 0, message: `{user} envoie {amount} × ${picked.name}` }); if (out) { setState({ alerts: out }); toast('Alerte créée pour ce cadeau'); } } }}>Créer une alerte dédiée${s.features.alertRulesCustom ? '' : html` <${Pro} />`}<//>
        ${s.features.battleAllModes && b.teams.slice(0, 2).map((t, i) => html`<${Btn} key=${t.id} onClick=${() => toggleTeam(i, picked)}>${(t.giftIds || []).includes(picked.id) ? 'Retirer de' : 'Ajouter à'} ${t.name}<//>`)}
      </div>
    <//>`}
    ${list.length ? html`<ul class="gift-grid">
      ${list.map((g) => html`<li key=${g.id}><button type="button" class="gift ${picked?.id === g.id ? 'on' : ''}" onClick=${() => setPicked(g)}>
        ${g.image ? html`<img src=${g.image} alt="" loading="lazy" referrerpolicy="no-referrer" />` : html`<span class="gift-ph"></span>`}
        <b>${g.name}</b><span>${fmt(g.cost)}</span>
      </button></li>`)}
    </ul>` : html`<${Empty} title="Catalogue vide">Connecte une chaîne TikTok puis charge le catalogue : il change selon le pays et le live.<//>`}
  </div>`;
}
