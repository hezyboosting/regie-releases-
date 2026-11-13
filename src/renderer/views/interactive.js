// Live interactif : roue de la fortune, course aux likes et packs prêts à installer en un clic.
import { html, useState, act, setState, toast, fmt } from '../store.js';
import { ICONS, Btn, Bay, Field, Num, Lazy, Select, Color, Lamp, PageHead } from '../ui.js';
import { Actions } from './commands.js';
import { soundOptions } from './sounds.js';
import { PointsRates } from './ranks.js';

const uid = () => Math.random().toString(36).slice(2, 10);

export function openOverlay(s, type) {
  const o = s.overlays.find((x) => x.type === type);
  if (o) setState({ view: 'overlays', overlayId: o.id, sceneOpen: false });
}

// ---------- Roue de la fortune ----------
function WheelStatus({ s }) {
  const w = s.wheel || { status: 'idle', queue: 0 };
  const text = w.status === 'spinning' ? `Tourne pour ${w.user}` : w.status === 'result' ? `${w.user} : ${w.result}` : 'Prête';
  return html`<div class="fun-status ${w.status}">
    <span class="dot"></span><b>${text}</b>${w.queue > 0 && html`<span class="badge">${w.queue} en attente</span>`}
  </div>`;
}

function Segment({ x, i, total, up, remove, s }) {
  const [open, setOpen] = useState(false);
  const pct = total ? Math.round((Number(x.weight || 0) / total) * 1000) / 10 : 0;
  return html`<div class="seg-card ${open ? 'open' : ''}" style=${{ '--seg': x.color }}>
    <div class="seg-row">
      <${Color} value=${x.color} onChange=${(color) => up(i, { color })} />
      <${Lazy} value=${x.label} aria-label="Nom de la case" onSave=${(label) => up(i, { label })} />
      <${Num} value=${x.weight} min="0" aria-label="Chance" title="Chance" onSave=${(weight) => up(i, { weight })} />
      <span class="seg-pct" title="Probabilité">${pct} %</span>
      <${Num} value=${x.points || 0} aria-label="Points gagnés" title="Points gagnés" onSave=${(points) => up(i, { points })} />
      <button type="button" class="linkish seg-more" onClick=${() => setOpen(!open)}>
        <span class="seg-thumb">${x.image ? html`<img src=${mediaSrc(s, x.image)} alt="" referrerpolicy="no-referrer" />` : x.emoji || ''}</span>
        ${(x.actions || []).length ? `Image et actions (${x.actions.length})` : 'Image et actions'}
      </button>
      <button type="button" class="icon" aria-label="Retirer cette case" onClick=${remove}>${ICONS.x}</button>
    </div>
    ${open && html`<div class="seg-actions">
      <${SegPicture} x=${x} i=${i} up=${up} s=${s} />
      <${Actions} list=${x.actions || []} s=${s} onChange=${(actions) => up(i, { actions })} />
    </div>`}
  </div>`;
}

// Image d'une case : ton image, un vrai cadeau TikTok du catalogue, ou un émoji.
const mediaSrc = (s, v) => (!v ? '' : /^https?:/.test(v) ? v : `http://127.0.0.1:${s.port}/media/${encodeURIComponent(v)}?k=${encodeURIComponent(s.overlayToken)}`);
function SegPicture({ x, i, up, s }) {
  const gifts = (s.gifts || []).filter((g) => g.image);
  const pick = async () => { const r = await act('importMedia', 'image'); if (r) { up(i, { image: r.name, emoji: '' }); setState({ media: r.media }); } };
  return html`<div class="seg-pic">
    <span class="seg-pic-prev">${x.image ? html`<img src=${mediaSrc(s, x.image)} alt="" referrerpolicy="no-referrer" />` : x.emoji ? html`<span>${x.emoji}</span>` : html`<small>Pas d'image</small>`}</span>
    <${Btn} onClick=${pick}>Importer une image<//>
    ${gifts.length > 0 && html`<${Select} value="" onChange=${(id) => { const g = gifts.find((y) => y.id === id); if (g) up(i, { image: g.image, emoji: '' }); }} options=${[{ value: '', label: 'Un cadeau TikTok…' }, ...gifts.map((g) => ({ value: g.id, label: `${g.name} (${g.cost})` }))]} />`}
    <${Lazy} value=${x.emoji || ''} placeholder="Ou un émoji" aria-label="Émoji de la case" onSave=${(emoji) => up(i, { emoji: emoji.trim().slice(0, 8), image: '' })} />
    ${(x.image || x.emoji) && html`<button type="button" class="linkish" onClick=${() => up(i, { image: '', emoji: '' })}>Retirer l'image</button>`}
  </div>`;
}

function WheelPanel({ s, page = false }) {
  const c = s.tools.wheel;
  const save = async (patch) => { const r = await act('wheelControl', 'config', patch); if (r) setState({ tools: { ...s.tools, wheel: r } }); };
  const control = async (action) => { const r = await act('wheelControl', action); if (r) setState({ tools: { ...s.tools, wheel: r } }); };
  const segs = c.segments || [];
  const total = segs.reduce((n, x) => n + Number(x.weight || 0), 0);
  const up = (i, patch) => save({ segments: segs.map((x, j) => (i === j ? { ...x, ...patch } : x)) });
  const giftOpts = [{ value: '', label: 'Selon le montant' }, ...s.gifts.map((g) => ({ value: g.id, label: `${g.name} (${g.cost})` }))];
  return html`<${Bay} title=${page ? 'Réglages' : 'Roue de la fortune'} class="fun-bay" aside=${html`<${Lamp} on=${c.enabled !== false} label="Active" onChange=${(enabled) => save({ enabled })} />`}>
    <div class="fun-top">
      <${WheelStatus} s=${s} />
      <div class="row tight">
        <${Btn} kind="primary" icon=${ICONS.play} onClick=${() => control('spin')}>Faire tourner<//>
        <${Btn} onClick=${() => control('skip')}>Passer<//>
        <${Btn} onClick=${() => control('clear')}>Vider la file<//>
        ${!page && html`<${Btn} icon=${ICONS.overlays} onClick=${() => openOverlay(s, 'wheel')}>Overlay<//>`}
      </div>
    </div>
    <h4 class="fun-h">Ce qui la fait tourner</h4>
    <div class="form-grid">
      <${Field} label="Commande du chat"><${Lazy} value=${c.command} placeholder="!roue" onSave=${(command) => save({ command })} /><//>
      <${Field} label="Prix en points" hint="0 pour gratuit"><${Num} value=${c.cost || 0} min="0" onSave=${(cost) => save({ cost })} /><//>
      <${Field} label="Attente par spectateur (s)"><${Num} value=${c.cooldown || 0} min="0" onSave=${(cooldown) => save({ cooldown })} /><//>
      <${Field} label="Cadeau précis"><${Select} value=${c.giftId || ''} onChange=${(giftId) => save({ giftId })} options=${giftOpts} /><//>
      ${!c.giftId && html`<${Field} label="Cadeau d'au moins (pièces)" hint="0 pour aucun"><${Num} value=${c.minCoins || 0} min="0" onSave=${(minCoins) => save({ minCoins })} /><//>`}
      <${Field} label="Tous les X likes" hint="0 pour aucun"><${Num} value=${c.likesEvery || 0} min="0" onSave=${(likesEvery) => save({ likesEvery })} /><//>
    </div>
    <div class="row wrap tight">
      <${Lamp} on=${c.onFollow} label="À chaque suivi" onChange=${(onFollow) => save({ onFollow })} />
      <${Lamp} on=${c.onSub} label="À chaque abonnement" onChange=${(onSub) => save({ onSub })} />
      <${Lamp} on=${c.onShare} label="À chaque partage" onChange=${(onShare) => save({ onShare })} />
      <${Lamp} on=${c.announce} label="Annoncer le résultat dans le chat" onChange=${(announce) => save({ announce })} />
    </div>
    <div class="form-grid">
      <${Field} label="Titre"><${Lazy} value=${c.title} onSave=${(title) => save({ title })} /><//>
      <${Field} label="Durée du tour (s)"><${Num} value=${c.spinSeconds || 6} min="2" max="20" onSave=${(spinSeconds) => save({ spinSeconds })} /><//>
      <${Field} label="Résultat affiché (s)"><${Num} value=${c.resultSeconds || 6} min="2" max="60" onSave=${(resultSeconds) => save({ resultSeconds })} /><//>
      ${c.announce && html`<${Field} label="Message d'annonce" hint="{user} et {result}"><${Lazy} value=${c.announceText} placeholder="🎡 {user} tombe sur : {result}" onSave=${(announceText) => save({ announceText })} /><//>`}
    </div>
    <h4 class="fun-h">Sons et voix</h4>
    <div class="form-grid">
      <${Field} label="Son pendant le tour"><${Select} value=${c.spinSound || ''} onChange=${(spinSound) => save({ spinSound })} options=${[{ value: '', label: 'Aucun son' }, ...soundOptions(s)]} /><//>
      <${Field} label="Son du résultat"><${Select} value=${c.resultSound || ''} onChange=${(resultSound) => save({ resultSound })} options=${[{ value: '', label: 'Aucun son' }, ...soundOptions(s)]} /><//>
    </div>
    <${Lamp} on=${c.voice} label="Annoncer le résultat à voix haute" onChange=${(voice) => save({ voice })} />
    <h4 class="fun-h">Les cases <small>chance, probabilité, points gagnés, puis ce que la case déclenche</small></h4>
    <div class="seg-list">
      ${segs.map((x, i) => html`<${Segment} key=${x.id} x=${x} i=${i} total=${total} up=${up} s=${s} remove=${() => save({ segments: segs.filter((_, j) => j !== i) })} />`)}
    </div>
    <div class="row tight">
      <${Btn} icon=${ICONS.plus} onClick=${() => save({ segments: [...segs, { id: uid(), label: 'Nouvelle case', color: '#8B3DFF', weight: 10, points: 0, actions: [] }] })}>Ajouter une case<//>
    </div>
    <p class="note">Une case peut presser une touche dans ton jeu, envoyer une commande Minecraft, jouer un son, changer de scène OBS ou relancer la roue.</p>
  <//>`;
}

// ---------- Course aux likes ----------
function RacePanel({ s, page = false }) {
  const c = s.tools.likeRace;
  const r = s.likeRace || { status: 'idle', racers: [] };
  const save = async (patch) => { const x = await act('raceControl', 'config', patch); if (x) setState({ tools: { ...s.tools, likeRace: x } }); };
  const control = (action) => act('raceControl', action);
  const state = r.status === 'running' ? 'En course' : r.status === 'won' ? `Gagnée par ${r.winner?.name || '?'}` : 'Arrêtée';
  return html`<${Bay} title=${page ? 'Réglages' : 'Course aux likes'} class="fun-bay" aside=${html`<${Lamp} on=${c.enabled} label="Active" onChange=${(enabled) => save({ enabled })} />`}>
    <div class="fun-top">
      <div class="fun-status ${r.status}"><span class="dot"></span><b>${state}</b>${r.round > 0 && html`<span class="badge">Course n° ${r.round}</span>`}</div>
      <div class="row tight">
        <${Btn} kind="primary" icon=${ICONS.play} onClick=${() => control('start')}>Nouvelle course<//>
        <${Btn} onClick=${() => control('stop')}>Arrêter<//>
        ${!page && html`<${Btn} icon=${ICONS.overlays} onClick=${() => openOverlay(s, 'likerace')}>Overlay<//>`}
      </div>
    </div>
    ${r.racers?.length > 0 && html`<ol class="race-mini">
      ${r.racers.map((x) => html`<li key=${x.key}><span class="race-name">${x.name}</span><span class="race-bar"><i style=${{ width: `${Math.min(100, (x.score / (r.target || 1)) * 100)}%` }}></i></span><b>${x.score}</b></li>`)}
    </ol>`}
    <div class="form-grid">
      <${Field} label="Ligne d'arrivée (likes)"><${Num} value=${c.target} min="10" onSave=${(target) => save({ target })} /><//>
      <${Field} label="Pistes affichées"><${Num} value=${c.lanes || 5} min="1" max="10" onSave=${(lanes) => save({ lanes })} /><//>
      <${Field} label="Titre"><${Lazy} value=${c.title} onSave=${(title) => save({ title })} /><//>
      <${Field} label="Points gagnés par le vainqueur"><${Num} value=${c.prize || 0} min="0" onSave=${(prize) => save({ prize })} /><//>
    </div>
    <div class="row wrap tight">
      <${Lamp} on=${c.autoStart} label="Démarre toute seule au premier like" onChange=${(autoStart) => save({ autoStart })} />
      <${Lamp} on=${c.autoRestart} label="Relance une course après chaque victoire" onChange=${(autoRestart) => save({ autoRestart })} />
      <${Lamp} on=${c.announce} label="Annoncer le vainqueur dans le chat" onChange=${(announce) => save({ announce })} />
    </div>
    <h4 class="fun-h">Ce qui fait avancer <small>pour Twitch, YouTube et Kick, qui n'ont pas de likes</small></h4>
    <div class="form-grid">
      <${Field} label="Par message"><${Num} value=${c.chatPoints || 0} min="0" onSave=${(chatPoints) => save({ chatPoints })} /><//>
      <${Field} label="Par pièce de cadeau"><${Num} value=${c.coinPoints || 0} min="0" onSave=${(coinPoints) => save({ coinPoints })} /><//>
      <${Field} label="Par partage"><${Num} value=${c.sharePoints || 0} min="0" onSave=${(sharePoints) => save({ sharePoints })} /><//>
      <${Field} label="Par suivi"><${Num} value=${c.followPoints || 0} min="0" onSave=${(followPoints) => save({ followPoints })} /><//>
      ${c.autoRestart && html`<${Field} label="Pause entre deux courses (s)"><${Num} value=${c.restartSeconds || 15} min="3" onSave=${(restartSeconds) => save({ restartSeconds })} /><//>`}
      ${c.announce && html`<${Field} label="Message d'annonce" hint="{winner}"><${Lazy} value=${c.announceText} placeholder="🏁 {winner} gagne la course aux likes !" onSave=${(announceText) => save({ announceText })} /><//>`}
    </div>
    <h4 class="fun-h">Sons et voix</h4>
    <div class="form-grid">
      <${Field} label="Son au départ"><${Select} value=${c.startSound || ''} onChange=${(startSound) => save({ startSound })} options=${[{ value: '', label: 'Aucun son' }, ...soundOptions(s)]} /><//>
      <${Field} label="Son de la victoire"><${Select} value=${c.winSound || ''} onChange=${(winSound) => save({ winSound })} options=${[{ value: '', label: 'Aucun son' }, ...soundOptions(s)]} /><//>
    </div>
    <${Lamp} on=${c.voice} label="Annoncer le vainqueur à voix haute" onChange=${(voice) => save({ voice })} />
    <h4 class="fun-h">À l'arrivée</h4>
    <${Actions} list=${c.actions || []} s=${s} onChange=${(actions) => save({ actions })} />
  <//>`;
}

// Roue de la fortune : sa propre page.
export function WheelPage({ s }) {
  return html`<div class="page">
    <${PageHead} title="Roue de la fortune">
      <${Btn} icon=${ICONS.overlays} onClick=${() => openOverlay(s, 'wheel')}>Overlay<//>
      <${Btn} onClick=${() => setState({ view: 'packs' })}>Packs prêts<//>
    <//>
    <p class="lead">La roue tourne sur un cadeau, une commande payée en points, un palier de likes, un suivi ou un partage. Chaque case peut donner des points et agir dans ton jeu.</p>
    <${WheelPanel} s=${s} page />
  </div>`;
}

// Course aux likes : sa propre page.
export function RacePage({ s }) {
  return html`<div class="page">
    <${PageHead} title="Course aux likes">
      <${Btn} icon=${ICONS.overlays} onClick=${() => openOverlay(s, 'likerace')}>Overlay<//>
    <//>
    <p class="lead">Chaque like fait avancer le spectateur ; sur Twitch, YouTube et Kick, ce sont les messages, cadeaux, partages ou suivis. Le premier arrivé gagne.</p>
    <${RacePanel} s=${s} page />
  </div>`;
}

// Compatibilité : l'ancienne page qui réunissait tout.
export function InteractiveView({ s }) { return html`<${WheelPage} s=${s} />`; }

// ---------- Traduction du chat ----------
const LANG_OPTS = [['auto', 'Langue de l\'appli'], ['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['it', 'Italiano'], ['pt', 'Português'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['tr', 'Türkçe'], ['ar', 'العربية'], ['ru', 'Русский'], ['ja', '日本語'], ['ko', '한국어'], ['zh', '中文']];
export function TranslateBay({ s }) {
  const c = s.chatTranslate || {};
  const save = async (patch) => { const r = await act('updateChatTranslate', patch); if (r) setState({ chatTranslate: r }); };
  return html`<${Bay} title="Traduction du chat en direct" aside=${html`<${Lamp} on=${c.enabled} label="Active" onChange=${(enabled) => save({ enabled })} />`}>
    <p class="note">Les messages écrits dans une autre langue s'affichent traduits, dans l'appli et dans l'overlay de chat. Les commandes et les emojis seuls ne sont pas traduits.</p>
    <div class="form-grid">
      <${Field} label="Traduire vers"><${Select} value=${c.target || 'auto'} onChange=${(target) => save({ target })} options=${LANG_OPTS.map(([value, label]) => ({ value, label }))} /><//>
      <${Field} label="Service"><${Select} value=${c.engine || 'google'} onChange=${(engine) => save({ engine })} options=${[{ value: 'google', label: 'Google Traduction (sans clé)' }, { value: 'deepl', label: s.hasDeepl ? 'DeepL' : 'DeepL (ajoute ta clé dans Réglages)' }]} /><//>
      <${Field} label="Affichage"><${Select} value=${c.mode || 'below'} onChange=${(mode) => save({ mode })} options=${[{ value: 'below', label: 'Sous le message' }, { value: 'replace', label: 'À la place du message' }]} /><//>
    </div>
    <div class="row wrap tight">
      <${Lamp} on=${c.showLang !== false} label="Montrer la langue d'origine" onChange=${(showLang) => save({ showLang })} />
      <${Lamp} on=${c.tts} label="Lire les traductions à voix haute" onChange=${(tts) => save({ tts })} />
      <${Btn} onClick=${async () => { const r = await act('testTranslate'); if (r) toast(`${r.from.toUpperCase()} : ${r.text}`); }}>Tester<//>
    </div>
  <//>`;
}

// ---------- Packs prêts ----------
const GAMES = [['all', 'Tous'], ['any', 'N\'importe quel jeu'], ['fps', 'FPS'], ['minecraft', 'Minecraft'], ['rocketleague', 'Rocket League'], ['mine', 'Packs importés']];
const NEEDS = { keys: 'Touches simulées (PRO), réglables dans Mes jeux', rcon: 'Serveur de jeu en RCON (PRO), dans Mes jeux', pad: 'Manette virtuelle (PRO), dans Mes jeux' };

// Partager sa config : on choisit ce qui part dans le fichier .regiepack.
function SharePack({ onClose }) {
  const [f, setF] = useState({ name: '', blurb: '', author: '', include: { triggers: true, commands: true, wheel: true, likeRace: true, overlays: true } });
  const inc = (k, v) => setF({ ...f, include: { ...f.include, [k]: v } });
  const go = async () => { if (await act('exportPack', f)) { toast('Pack enregistré'); onClose(); } };
  return html`<${Bay} title="Partager ma config en pack">
    <div class="form-grid">
      <${Field} label="Nom du pack"><${Lazy} value=${f.name} placeholder="Mon live Fortnite" onSave=${(name) => setF({ ...f, name })} /><//>
      <${Field} label="Ton pseudo"><${Lazy} value=${f.author} onSave=${(author) => setF({ ...f, author })} /><//>
      <${Field} label="Description"><${Lazy} value=${f.blurb} placeholder="Ce que fait ton pack" onSave=${(blurb) => setF({ ...f, blurb })} /><//>
    </div>
    <div class="row wrap tight">
      <${Lamp} on=${f.include.triggers} label="Automatisations" onChange=${(v) => inc('triggers', v)} />
      <${Lamp} on=${f.include.commands} label="Commandes" onChange=${(v) => inc('commands', v)} />
      <${Lamp} on=${f.include.wheel} label="Roue" onChange=${(v) => inc('wheel', v)} />
      <${Lamp} on=${f.include.likeRace} label="Course aux likes" onChange=${(v) => inc('likeRace', v)} />
      <${Lamp} on=${f.include.overlays} label="Liste des overlays" onChange=${(v) => inc('overlays', v)} />
    </div>
    <p class="note">Tes clés, mots de passe, sons importés et webhooks ne partent jamais dans le pack.</p>
    <div class="row tight"><${Btn} kind="primary" disabled=${!f.name.trim()} onClick=${go}>Enregistrer le pack<//><${Btn} onClick=${onClose}>Annuler<//></div>
  <//>`;
}

export function PacksView({ s }) {
  const [game, setGame] = useState('all');
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState('');
  const installed = s.installedPacks || {};
  const list = (s.packs || []).filter((p) => game === 'all' || (game === 'mine' ? p.custom : p.game === game));
  const name = (type) => s.overlayTypes[type]?.name || type;
  const install = async (p) => {
    setBusy(p.id);
    try {
      const r = await act('installPack', p.id);
      if (r) toast(`Pack installé : ${p.name}`);
    } finally { setBusy(''); }
  };
  const remove = async (p) => { if (await act('removePack', p.id)) toast(`Pack retiré : ${p.name}`); };
  return html`<div class="page">
    <${PageHead} title="Packs prêts">
      <${Btn} onClick=${async () => { const p = await act('importPack'); if (p) toast(`Pack ajouté : ${p.name}`); }}>Importer un pack<//>
      <${Btn} onClick=${() => setShare(!share)}>Partager ma config<//>
      <${Btn} onClick=${() => setState({ view: 'interactive' })}>Roue de la fortune<//>
    <//>
    ${share && html`<${SharePack} onClose=${() => setShare(false)} />`}
    <p class="lead">Un clic installe un live interactif complet : roue, course aux likes, automatisations, commandes et overlays. Tout reste modifiable, et un pack se retire sans toucher au reste.</p>
    <div class="segs" role="radiogroup" aria-label="Jeu">
      ${GAMES.map(([v, label]) => html`<button type="button" role="radio" key=${v} aria-checked=${game === v} class="seg ${game === v ? 'on' : ''}" onClick=${() => setGame(v)}>${label}</button>`)}
    </div>
    <div class="pack-grid">
      ${list.map((p) => html`<article class="pack ${installed[p.id] ? 'on' : ''}" key=${p.id} style=${{ '--pack': p.color }}>
        <header><b>${p.name}</b>${installed[p.id] && html`<span class="badge ok"><i></i>Installé</span>`}</header>
        ${p.custom && html`<small class="pack-by">${p.author ? `Pack importé, par ${p.author}` : 'Pack importé'}</small>`}
        <p>${p.blurb}</p>
        <ul class="pack-chips">
          ${p.counts.segments > 0 && html`<li>Roue de ${p.counts.segments} cases</li>`}
          ${p.counts.race && html`<li>Course aux likes</li>`}
          ${p.counts.triggers > 0 && html`<li>${p.counts.triggers} automatisation${p.counts.triggers > 1 ? 's' : ''}</li>`}
          ${p.counts.commands > 0 && html`<li>${p.counts.commands} commande${p.counts.commands > 1 ? 's' : ''}</li>`}
          ${p.overlays.map((t) => html`<li class="ov" key=${t}>${name(t)}</li>`)}
        </ul>
        ${p.needs.length > 0 && html`<p class="note warn">${p.needs.map((n) => NEEDS[n]).join(' · ')}</p>`}
        ${p.counts.segments > 0 && html`<p class="note">Remplace les cases actuelles de la roue.</p>`}
        <div class="row tight">
          <${Btn} kind="primary" disabled=${busy === p.id} onClick=${() => install(p)}>${busy === p.id ? 'Installation…' : installed[p.id] ? 'Réinstaller' : 'Installer'}<//>
          ${installed[p.id] && html`<${Btn} onClick=${() => remove(p)}>Retirer<//>`}
          ${p.custom && html`<${Btn} kind="danger" onClick=${async () => { if (await act('deleteCustomPack', p.id)) toast('Pack supprimé'); }}>Supprimer<//>`}
        </div>
      </article>`)}
    </div>
  </div>`;
}

// ---------- Boutique de points ----------
const SHOP_PRESETS = [
  { emoji: '🎉', name: 'Confettis', desc: 'Une pluie de confettis à l\'écran', cost: 300, cooldown: 20, userCooldown: 60, actions: [{ type: 'overlayFx' }] },
  { emoji: '🎡', name: 'Tour de roue', desc: 'Fais tourner la roue de la fortune', cost: 500, cooldown: 30, userCooldown: 120, actions: [{ type: 'wheel' }] },
  { emoji: '💬', name: 'Message à l\'écran', desc: 'Ton texte affiché en grand', cost: 400, cooldown: 30, userCooldown: 120, needsText: true, actions: [{ type: 'show', text: '{user} : {args}', seconds: 8 }] },
  { emoji: '🔥', name: 'Défi pour le streamer', desc: 'Le défi s\'affiche et est lu à voix haute', cost: 1000, cooldown: 120, userCooldown: 300, stock: 3, needsText: true, actions: [{ type: 'show', text: '🔥 Défi de {user} : {args}', seconds: 10 }, { type: 'tts', text: 'Défi de {user} : {args}' }] },
  { emoji: '🏁', name: 'Nouvelle course aux likes', desc: 'Relance la course', cost: 800, cooldown: 120, userCooldown: 300, actions: [{ type: 'likeRace' }] },
  { emoji: '🎮', name: 'Touche dans le jeu', desc: 'Le spectateur presse une touche', cost: 600, cooldown: 20, userCooldown: 60, actions: [{ type: 'key', key: 'Space', hold: 80 }] },
  { emoji: '🗣️', name: 'Lire mon message', desc: 'Ton message lu à voix haute', cost: 250, cooldown: 15, userCooldown: 60, needsText: true, actions: [{ type: 'tts', text: '{user} dit : {args}' }] },
];

function RewardCard({ x, i, s }) {
  const [open, setOpen] = useState(false);
  const save = async (patch) => { const o = await act('saveReward', { ...x, ...patch }); if (o) setState({ rewards: o }); };
  return html`<div class="rw-card ${x.enabled === false ? 'off' : ''}">
    <div class="rw-row">
      <span class="rw-n">${i + 1}</span>
      <input class="in rw-emoji" value=${x.emoji || '🎁'} aria-label="Icône" maxLength="4" onChange=${(e) => save({ emoji: e.target.value })} />
      <${Lazy} value=${x.name} aria-label="Nom" onSave=${(name) => save({ name })} />
      <${Num} value=${x.cost} min="0" aria-label="Prix en points" title="Prix en points" onSave=${(cost) => save({ cost })} />
      <${Lamp} on=${x.enabled !== false} label="" onChange=${(enabled) => save({ enabled })} />
      <button type="button" class="linkish" onClick=${() => setOpen(!open)}>${open ? 'Fermer' : 'Régler'}</button>
      <button type="button" class="icon" aria-label="Supprimer cette récompense" onClick=${async () => { const o = await act('removeReward', x.id); if (o) setState({ rewards: o }); }}>${ICONS.x}</button>
    </div>
    ${open && html`<div class="rw-more">
      <div class="form-grid">
        <${Field} label="Description"><${Lazy} value=${x.desc || ''} onSave=${(desc) => save({ desc })} /><//>
        <${Field} label="Stock par live" hint="0 pour illimité"><${Num} value=${x.stock || 0} min="0" onSave=${(stock) => save({ stock })} /><//>
        <${Field} label="Recharge (s)" hint="Pour tout le monde"><${Num} value=${x.cooldown || 0} min="0" onSave=${(cooldown) => save({ cooldown })} /><//>
        <${Field} label="Attente par spectateur (s)"><${Num} value=${x.userCooldown || 0} min="0" onSave=${(userCooldown) => save({ userCooldown })} /><//>
        <${Field} label="Commande directe" hint="Facultatif, par exemple !confettis"><${Lazy} value=${x.command || ''} onSave=${(command) => save({ command })} /><//>
      </div>
      <${Lamp} on=${x.needsText} label="Le spectateur écrit un texte après la commande ({args})" onChange=${(needsText) => save({ needsText })} />
      <${Actions} list=${x.actions || []} s=${s} onChange=${(actions) => save({ actions })} />
      <div class="row tight"><${Btn} onClick=${() => act('testShop', x.id)}>Tester cet achat<//></div>
    </div>`}
  </div>`;
}

export function PointShopView({ s }) {
  const r = s.rewards;
  const up = async (patch) => { const o = await act('updateRewards', patch); if (o) setState({ rewards: o }); };
  const add = async (preset) => { const o = await act('saveReward', { enabled: true, stock: 0, command: '', ...preset }); if (o) { setState({ rewards: o }); toast(`Ajouté : ${preset.name}`); } };
  const log = s.shop?.log || [];
  return html`<div class="page">
    <${PageHead} title="Boutique de points">
      <${Btn} onClick=${() => act('testShop', r.list[0]?.id)}>Tester un achat<//>
      <${Btn} icon=${ICONS.overlays} onClick=${() => openOverlay(s, 'pointshop')}>Overlay<//>
    <//>
    <p class="lead">Tes spectateurs gagnent des points en discutant, en likant et en offrant des cadeaux, puis les dépensent ici : ${r.commandShop || '!boutique'} pour voir la liste, ${r.commandBuy || '!acheter'} 2 pour acheter.</p>
    <${Bay} title="Réglages">
      <div class="row wrap tight">
        <${Lamp} on=${r.enabled} label="Boutique ouverte" onChange=${(enabled) => up({ enabled })} />
        <${Lamp} on=${r.announce !== false} label="Annoncer chaque achat dans le chat" onChange=${(announce) => up({ announce })} />
      </div>
      <div class="form-grid">
        <${Field} label="Voir la boutique"><${Lazy} value=${r.commandShop || ''} placeholder="!boutique" onSave=${(commandShop) => up({ commandShop })} /><//>
        <${Field} label="Acheter"><${Lazy} value=${r.commandBuy || ''} placeholder="!acheter" onSave=${(commandBuy) => up({ commandBuy })} /><//>
        <${Field} label="Voir ses points"><${Lazy} value=${r.commandPoints} onSave=${(commandPoints) => up({ commandPoints })} /><//>
      </div>
    <//>
    <${PointsRates} s=${s} />
    <${Bay} title="Récompenses">
      <div class="rw-list">${r.list.map((x, i) => html`<${RewardCard} key=${x.id} x=${x} i=${i} s=${s} />`)}</div>
      ${!r.list.length && html`<p class="note">La boutique est vide. Ajoute un modèle ci-dessous.</p>`}
      <h4 class="fun-h">Ajouter un modèle</h4>
      <div class="row wrap tight">${SHOP_PRESETS.map((p) => html`<button type="button" class="chip" key=${p.name} onClick=${() => add(p)}>${p.emoji} ${p.name}</button>`)}</div>
      <div class="row tight"><${Btn} icon=${ICONS.plus} onClick=${() => add({ emoji: '🎁', name: 'Nouvelle récompense', cost: 100, cooldown: 0, userCooldown: 60, actions: [] })}>Récompense vide<//></div>
    <//>
    <${Bay} title="Derniers achats">
      ${log.length ? html`<ul class="tool-list">${log.map((p, i) => html`<li key=${i}><b>${p.user}</b><span class="tagline">${p.emoji} ${p.reward}, ${fmt(p.cost)} points${p.text ? ` · « ${p.text} »` : ''}</span></li>`)}</ul>` : html`<p class="note">Aucun achat pendant ce live.</p>`}
    <//>
  </div>`;
}
