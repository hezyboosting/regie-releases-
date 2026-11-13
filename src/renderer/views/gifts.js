import { html, useState, useEffect, act, setState, fmt, toast, reload } from '../store.js';
import { Btn, Bay, PageHead, Empty, Select, Pro, Segments, Lamp, Num, Field } from '../ui.js';
import { Actions } from './commands.js';

function Hl({ label, name, sub, value, image, fallback }) {
  return html`<div class="hl">
    ${image ? html`<img class="hl-pic" src=${image} alt="" referrerpolicy="no-referrer" />` : html`<span class="hl-pic">${fallback}</span>`}
    <div class="hl-txt"><span>${label}</span><b>${name}</b><span>${sub}</span></div>
    <span class="hl-val">${value}</span>
  </div>`;
}

const LINKS = [['giftfeed', 'Fil des cadeaux'], ['gifttracker', 'Suivi des cadeaux'], ['topgift', 'Meilleur cadeau'], ['topstreak', 'Meilleure série']];

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
      <${Hl} label="Meilleur cadeau" name=${tg ? tg.user : 'Personne'} sub=${tg ? tg.name : 'En attente du premier cadeau'} value=${tg ? fmt(tg.value) : ''} image=${tg?.image} fallback="1" />
      <${Hl} label="Meilleure série" name=${ts ? ts.user : 'Personne'} sub=${ts ? ts.name : 'En attente d\'une série'} value=${ts ? `×${fmt(ts.count)}` : ''} image=${ts?.image} fallback="×" />
    </div>
    <div class="two">
      <${Bay} title="Cadeaux reçus">
        ${g.byGift?.length ? html`<ol class="toplist">${g.byGift.slice(0, 12).map((x) => html`<li key=${x.id}>${x.image ? html`<img src=${x.image} alt="" referrerpolicy="no-referrer" />` : html`<span class="mono">${x.name.slice(0, 1)}</span>`}<span class="nm">${x.name}</span><span class="tagline">×${fmt(x.count)}</span><b>${fmt(x.coins)}</b></li>`)}</ol>` : html`<p class="note">Le suivi se remplit pendant le live.</p>`}
      <//>
      <${Bay} title="Dans tes overlays">
        <div class="pick-list">${LINKS.map(([type, name]) => html`<button type="button" class="pick" key=${type} onClick=${() => open(type)}><b>${name}</b><span>${s.overlays.some((o) => o.type === type) ? 'Régler et copier le lien' : 'Créer cet overlay'}</span></button>`)}</div>
      <//>
    </div>
  </div>`;
}

// Liste de base quand le catalogue TikTok n'est pas encore chargé : on reconnaît alors le cadeau par son nom.
const BASIC = [['Rose', 1], ['TikTok', 1], ['GG', 1], ['Ice Cream Cone', 1], ['Heart Me', 1], ['Finger Heart', 5], ['Friendship Necklace', 10], ['Perfume', 20], ['Doughnut', 30], ['Hand Hearts', 100], ['Confetti', 100], ['Money Gun', 500], ['Galaxy', 1000], ['Lion', 29999], ['Universe', 44999]].map(([name, cost]) => ({ id: '', name, cost, image: '' }));
// Raccourcis : un clic ajoute l'action la plus courante, réglable ensuite.
const QUICK = [
  ['Son', { type: 'sound', sound: 'fanfare', volume: 80 }], ['Touche du jeu', { type: 'key', key: 'Space', hold: 80 }], ['Bouton manette', { type: 'pad', input: 'a', hold: 150 }],
  ['Roue', { type: 'wheel' }], ['Confettis', { type: 'overlayFx' }], ['Texte à l\'écran', { type: 'show', text: '🎁 {user} : {gift}', seconds: 5 }],
  ['Voix', { type: 'tts', text: 'Merci {user} pour {gift} !' }], ['Commande serveur', { type: 'rcon', text: 'say Merci {user} !' }], ['Message dans le chat', { type: 'chat', text: 'Merci {user} pour {gift} ❤️' }],
];

function GiftActions({ s }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const pro = s.features.giftTriggers;
  const gifts = s.gifts.length ? s.gifts : BASIC;
  const keyOf = (g) => String(g.id || g.name);
  const byKey = new Map(s.triggers.filter((t) => t.giftAction).map((t) => [t.giftAction, t]));
  const list = gifts.filter((g) => g.name?.toLowerCase().includes(q.toLowerCase())).sort((a, b) => ((byKey.has(keyOf(b)) - byKey.has(keyOf(a))) || a.cost - b.cost));
  const t = picked ? byKey.get(keyOf(picked)) : null;
  const save = async (patch) => { const r = await act('saveGiftAction', { id: picked.id, name: picked.name }, patch); if (r) setState({ triggers: r }); };
  return html`<div class="col">
    <p class="lead">Clique sur un cadeau et choisis ce qu'il déclenche : une touche dans ton jeu, un bouton de manette, la roue, un son, une voix, une commande sur ton serveur… ${!pro && html`<${Pro} />`}</p>
    ${!s.gifts.length && html`<p class="note">Liste de base. Ouvre Catalogue TikTok et clique sur Mettre à jour pour avoir tous les cadeaux officiels avec leur image.</p>`}
    <input class="in" type="search" value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Chercher un cadeau" aria-label="Chercher un cadeau" />
    ${picked && html`<${Bay} title=${`Quand quelqu'un envoie ${picked.name}`} class="ga-panel">
      <div class="row wrap tight">${QUICK.map(([label, a]) => html`<button type="button" class="chip" key=${label} disabled=${!pro} onClick=${() => save({ actions: [...(t?.actions || []), { ...a }] })}>+ ${label}</button>`)}</div>
      ${t ? html`
        <${Actions} list=${t.actions || []} s=${s} onChange=${(actions) => save({ actions })} />
        <div class="row wrap tight">
          <${Lamp} on=${t.enabled} label="Active" onChange=${(enabled) => save({ enabled })} />
          <${Lamp} on=${t.repeat} label="Répéter pour chaque cadeau d'un combo" onChange=${(repeat) => save({ repeat })} />
          <${Field} label="Attente entre deux (s)"><${Num} value=${t.cooldown || 0} min="0" onSave=${(cooldown) => save({ cooldown })} /><//>
          <${Btn} kind="danger" onClick=${async () => { const r = await act('deleteGiftAction', keyOf(picked)); if (r) setState({ triggers: r }); }}>Tout retirer<//>
          <${Btn} onClick=${() => act('simulate', 'gift', 'tiktok', { fields: { gift: { id: picked.id || 'demo', name: picked.name, cost: picked.cost, image: picked.image || '', count: 1 }, amount: 1, value: picked.cost } })}>Tester<//>
        </div>` : html`<p class="note">Aucune action pour ce cadeau. Choisis un raccourci au-dessus.</p>`}
    <//>`}
    <ul class="gift-grid">
      ${list.map((g) => {
    const has = byKey.get(keyOf(g));
    return html`<li key=${keyOf(g)}><button type="button" class="gift ${picked && keyOf(picked) === keyOf(g) ? 'on' : ''} ${has ? 'has' : ''}" onClick=${() => setPicked(g)}>
          ${g.image ? html`<img src=${g.image} alt="" loading="lazy" referrerpolicy="no-referrer" />` : html`<span class="gift-ph">🎁</span>`}
          <b>${g.name}</b><span>${fmt(g.cost)}</span>
          ${has && html`<i class="gift-n" title="Actions">${(has.actions || []).length}</i>`}
        </button></li>`;
  })}
    </ul>
  </div>`;
}

// Pages du menu Cadeaux.
export function GiftActionsPage({ s }) {
  return html`<div class="page"><${PageHead} title="Actions par cadeau" /><${GiftActions} s=${s} /></div>`;
}
export function GiftLivePage({ s }) {
  return html`<div class="page"><${PageHead} title="Cadeaux du live" /><${Tracker} s=${s} /></div>`;
}
export function GiftCatalogPage({ s }) {
  return html`<div class="page"><${Catalog} s=${s} /></div>`;
}
export function Gifts({ s }) { return html`<${GiftActionsPage} s=${s} />`; }

const BANDS = [{ value: 'all', label: 'Tous' }, { value: 'small', label: '1 à 99' }, { value: 'mid', label: '100 à 999' }, { value: 'big', label: '1 000 à 9 999' }, { value: 'huge', label: '10 000 et plus' }];
const inBand = (c, b) => b === 'all' || (b === 'small' && c < 100) || (b === 'mid' && c >= 100 && c < 1000) || (b === 'big' && c >= 1000 && c < 10000) || (b === 'huge' && c >= 10000);

// Catalogue officiel des cadeaux TikTok : chargé tout seul, images gardées sur le PC.
function Catalog({ s }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('asc');
  const [band, setBand] = useState('all');
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(null);
  // Un cadeau choisi depuis la recherche (Ctrl K) s'ouvre directement.
  useEffect(() => {
    if (!s.giftPick) return;
    const g = s.gifts.find((x) => x.id === s.giftPick);
    if (g) { setPicked(g); setQ(''); setBand('all'); }
    setState({ giftPick: null });
  }, [s.giftPick]);
  const load = async () => {
    setLoading(true);
    const list = await act('loadGifts');
    setLoading(false);
    if (list) { setState({ gifts: list, giftCacheAt: Date.now() }); toast(`${list.length} cadeaux officiels chargés`); }
  };
  const list = s.gifts
    .filter((g) => g.name?.toLowerCase().includes(q.toLowerCase()) && inBand(g.cost, band))
    .sort((a, b) => (sort === 'asc' ? a.cost - b.cost : sort === 'desc' ? b.cost - a.cost : a.name.localeCompare(b.name)));
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
  const addToWheel = async (g) => {
    const w = s.tools.wheel;
    const r = await act('wheelControl', 'config', { segments: [...(w.segments || []), { id: `w${Date.now()}`, label: g.name, color: '#8B3DFF', weight: 10, points: 0, actions: [], image: g.image }] });
    if (r) { setState({ tools: { ...s.tools, wheel: r } }); toast(`${g.name} ajouté à la roue`); }
  };
  const when = s.giftCacheAt ? new Date(s.giftCacheAt).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  return html`<div class="col">
    <${PageHead} title="Catalogue TikTok">
      <${Btn} kind="primary" disabled=${loading} onClick=${load}>${loading ? 'Mise à jour…' : 'Mettre à jour'}<//>
    <//>
    <p class="lead">Tous les cadeaux officiels de TikTok, avec leur vraie image et leur prix en pièces. Régie les récupère chez TikTok et garde les images sur ton PC : quand quelqu'un t'envoie une Galaxie, tes overlays montrent la Galaxie de TikTok.</p>
    ${s.gifts.length > 0 && html`<p class="note">${when ? `${s.gifts.length} cadeaux, mis à jour le ${when}.` : `${s.gifts.length} cadeaux.`}</p>`}
    <div class="cat-bar">
      <input class="in" type="search" value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Chercher un cadeau" aria-label="Chercher un cadeau" />
      <${Segments} value=${band} onChange=${setBand} options=${BANDS} />
      <span class="cat-sort"><${Select} value=${sort} onChange=${setSort} options=${[{ value: 'asc', label: 'Prix croissant' }, { value: 'desc', label: 'Prix décroissant' }, { value: 'name', label: 'Nom' }]} /></span>
    </div>
    ${picked && html`<${Bay} title=${picked.name} class="cat-pick" aside=${html`<button type="button" class="linkish" onClick=${() => setPicked(null)}>Fermer</button>`}>
      <div class="cat-pick-body">
        ${picked.image && html`<img src=${picked.image} alt="" referrerpolicy="no-referrer" />`}
        <div class="col">
          <b class="cat-cost">${fmt(picked.cost)} pièces</b>
          <div class="row wrap tight">
            <${Btn} kind="primary" onClick=${() => act('simulate', 'gift', 'tiktok', { fields: { gift: { id: picked.id, name: picked.name, cost: picked.cost, image: picked.image, count: 1 }, amount: 1, value: picked.cost } })}>Tester ce cadeau<//>
            <${Btn} onClick=${() => setState({ view: 'gifts' })}>Lui donner une action<//>
            <${Btn} disabled=${!s.features.alertRulesCustom} onClick=${async () => { const base = s.alerts.rules.find((r) => r.type === 'gift'); const a = await act('addRule', 'gift', base.id); if (a) { const rule = a.rules[a.rules.length - 1]; const out = await act('updateRule', rule.id, { giftId: picked.id, minAmount: 0, message: `{user} envoie ${picked.name} !` }); if (out) { setState({ alerts: out }); toast('Alerte créée pour ce cadeau'); } } }}>Alerte rien que pour lui<//>
            <${Btn} onClick=${() => addToWheel(picked)}>Ajouter à la roue<//>
            ${s.features.battleAllModes && b.teams.slice(0, 2).map((t, i) => html`<${Btn} key=${t.id} onClick=${() => toggleTeam(i, picked)}>${(t.giftIds || []).includes(picked.id) ? `Retirer de ${t.name}` : `Ajouter à ${t.name}`}<//>`)}
          </div>
        </div>
      </div>
    <//>`}
    ${list.length ? html`<ul class="gift-grid cat-grid">
      ${list.map((g) => html`<li key=${g.id}><button type="button" class="gift ${picked?.id === g.id ? 'on' : ''}" onClick=${() => setPicked(g)}>
        ${g.image ? html`<img src=${g.image} alt="" loading="lazy" referrerpolicy="no-referrer" />` : html`<span class="gift-ph"></span>`}
        <b>${g.name}</b><span class="cat-coin">${fmt(g.cost)}</span>
      </button></li>`)}
    </ul>` : html`<${Empty} title=${s.gifts.length ? 'Aucun cadeau ne correspond' : 'Catalogue pas encore chargé'}>${s.gifts.length ? 'Change la recherche ou la tranche de prix.' : 'Clique sur Mettre à jour : Régie récupère tous les cadeaux officiels chez TikTok, même sans être en live.'}<//>`}
  </div>`;
}
