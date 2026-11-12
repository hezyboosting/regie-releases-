import { html, useState, act, setState, toast, PLATFORM } from '../store.js';
import { ICONS, Btn, Bay, Field, Select, Num, Text, Platforms, Lamp, PageHead, Segments, Empty, Pro, Upsell } from '../ui.js';
import { soundOptions } from './sounds.js';

const PERMS = [{ value: 'all', label: 'Tout le monde' }, { value: 'sub', label: 'Abonnés et membres' }, { value: 'vip', label: 'VIP' }, { value: 'mod', label: 'Modérateurs' }, { value: 'owner', label: 'Toi seulement' }];
const ACTIONS = [
  { value: 'chat', label: 'Écrire dans le chat' }, { value: 'alert', label: 'Afficher une alerte' }, { value: 'show', label: 'Afficher un texte ou une image' }, { value: 'tts', label: 'Lire à voix haute' }, { value: 'sound', label: 'Jouer un son' },
  { value: 'counter', label: 'Modifier un compteur' }, { value: 'goal', label: 'Ajouter à un goal' }, { value: 'timer', label: 'Ajouter du temps' }, { value: 'points', label: 'Donner des points' },
  { value: 'key', label: 'Presser une touche' }, { value: 'overlayFx', label: 'Lancer des confettis' }, { value: 'notify', label: 'M\'envoyer une notification' },
  { value: 'obsScene', label: 'Changer de scène OBS' }, { value: 'obsSource', label: 'Afficher ou masquer une source' }, { value: 'mic', label: 'Couper ou remettre le micro' }, { value: 'replay', label: 'Enregistrer le replay OBS' }, { value: 'clip', label: 'Créer un clip Twitch' },
  { value: 'spotify', label: 'Contrôler Spotify' }, { value: 'arena', label: 'Ouvrir le Chat Battle' }, { value: 'boss', label: 'Lancer le Boss Battle' }, { value: 'minigame', label: 'Lancer un mini-jeu', feature: 'miniGames' }, { value: 'game', label: 'Compter dans le jeu' },
  { value: 'skipAlert', label: 'Passer l\'alerte' }, { value: 'pauseAlerts', label: 'Pause des alertes' }, { value: 'automation', label: 'Activer ou couper une automatisation' }, { value: 'fire', label: 'Lancer un événement personnalisé' },
  { value: 'rcon', label: 'Commande Minecraft', feature: 'rcon' }, { value: 'webhook', label: 'Appeler un webhook', feature: 'webhooks' },
];

export function ActionRow({ a, onChange, onRemove, s, delays }) {
  const up = (patch) => onChange({ ...a, ...patch });
  const opts = ACTIONS.map((o) => ({ ...o, disabled: o.feature && !s.features[o.feature] }));
  return html`<div class="action">
    <${Select} value=${a.type} onChange=${(type) => onChange({ type })} options=${opts} />
    ${['chat', 'alert', 'tts', 'notify'].includes(a.type) && html`<${Text} value=${a.text} onChange=${(text) => up({ text })} placeholder="Merci {user} !" />`}
    ${a.type === 'show' && html`<${Text} value=${a.text} onChange=${(text) => up({ text })} placeholder="Texte à afficher" />`}
    ${a.type === 'show' && html`<${Btn} disabled=${!s.features.customMedia} onClick=${async () => { const m = await act('importMedia', 'visual'); if (m) { up({ file: m.name }); setState({ media: m.media }); } }}>${a.file ? 'Changer le fichier' : 'Image ou vidéo'}<//>`}
    ${a.type === 'show' && html`<${Num} value=${a.seconds ?? 5} min="1" aria-label="Durée en secondes" title="Durée en secondes" onSave=${(seconds) => up({ seconds })} />`}
    ${a.type === 'points' && html`<${Num} value=${a.amount ?? 100} aria-label="Points" title="Points" onSave=${(amount) => up({ amount })} />`}
    ${a.type === 'rcon' && html`<${Text} value=${a.text} onChange=${(text) => up({ text })} placeholder="give @a diamond 1" />`}
    ${a.type === 'fire' && html`<${Text} value=${a.name} onChange=${(name) => up({ name })} placeholder="Nom de l'événement" />`}
    ${a.type === 'mic' && html`<${Text} value=${a.input} onChange=${(input) => up({ input })} placeholder="Micro, vide pour le micro par défaut" />`}
    ${a.type === 'spotify' && html`<${Select} value=${a.action || 'pause'} onChange=${(action) => up({ action })} options=${[{ value: 'pause', label: 'Pause' }, { value: 'play', label: 'Lecture' }, { value: 'next', label: 'Suivant' }, { value: 'previous', label: 'Précédent' }]} />`}
    ${a.type === 'minigame' && html`<${Select} value=${a.game || 'roulette'} onChange=${(game) => up({ game })} options=${[{ value: 'roulette', label: 'Roulette' }, { value: 'quiz', label: 'Quiz' }, { value: 'guess', label: 'Devinette' }]} />`}
    ${a.type === 'game' && html`<${Select} value=${a.kind || 'win'} onChange=${(kind) => up({ kind })} options=${[{ value: 'win', label: 'Victoire' }, { value: 'loss', label: 'Défaite' }, { value: 'kill', label: 'Kill' }, { value: 'death', label: 'Mort' }]} />`}
    ${a.type === 'automation' && html`<${Select} value=${a.triggerId || ''} onChange=${(triggerId) => up({ triggerId })} options=${[{ value: '', label: 'Choisir' }, ...s.triggers.map((t) => ({ value: t.id, label: t.name || 'Sans nom' }))]} />`}
    ${a.type === 'sound' && html`<${Select} value=${a.sound || 'pop'} onChange=${(sound) => up({ sound })} options=${soundOptions(s)} />`}
    ${a.type === 'key' && html`<${Select} value=${a.key || ''} onChange=${(key) => up({ key })} options=${[{ value: '', label: 'Choisir la touche' }, ...s.keyNames.map((k) => ({ value: k, label: k }))]} />`}
    ${a.type === 'key' && !s.keysCfg.enabled && html`<span class="note warn">Active les touches simulées dans Mes jeux.</span>`}
    ${a.type === 'webhook' && html`<${Text} value=${a.url} onChange=${(url) => up({ url })} placeholder="https://" />`}
    ${a.type === 'webhook' && html`<${Text} value=${a.body} onChange=${(body) => up({ body })} placeholder='Corps JSON facultatif : {"message":"{user}"}' />`}
    ${a.type === 'obsSource' && html`<${Text} value=${a.scene} onChange=${(scene) => up({ scene })} placeholder="Scène" />`}
    ${a.type === 'obsSource' && html`<${Text} value=${a.source} onChange=${(source) => up({ source })} placeholder="Source" />`}
    ${a.type === 'counter' && html`<${Select} value=${a.counterId} onChange=${(counterId) => up({ counterId })} options=${[{ value: '', label: 'Choisir' }, ...s.tools.counters.map((c) => ({ value: c.id, label: c.name }))]} />`}
    ${a.type === 'goal' && html`<${Select} value=${a.goalId} onChange=${(goalId) => up({ goalId })} options=${[{ value: '', label: 'Choisir' }, ...s.goals.map((g) => ({ value: g.id, label: g.title }))]} />`}
    ${a.type === 'timer' && html`<${Select} value=${a.timerId} onChange=${(timerId) => up({ timerId })} options=${[{ value: '', label: 'Choisir' }, ...s.tools.timers.map((t) => ({ value: t.id, label: t.name }))]} />`}
    ${a.type === 'timer' && html`<${Num} value=${a.seconds ?? 60} onSave=${(seconds) => up({ seconds })} aria-label="Secondes" />`}
    ${a.type === 'obsScene' && html`<${Text} value=${a.scene} onChange=${(scene) => up({ scene })} placeholder="Nom de la scène" />`}
    ${delays && html`<${Num} value=${a.delay ?? 0} min="0" disabled=${!s.features.automationAdvanced} aria-label="Délai en secondes" title="Délai avant cette action, en secondes" onSave=${(delay) => up({ delay })} />`}
    <button type="button" class="icon" aria-label="Retirer cette action" onClick=${onRemove}>${ICONS.x}</button>
  </div>`;
}

export function Actions({ list = [], onChange, s, delays }) {
  return html`<div class="field wide"><span class="f-label">Actions${delays ? ', avec un délai en secondes à droite' : ''}</span>
    ${list.map((a, i) => html`<${ActionRow} key=${i} a=${a} s=${s} delays=${delays} onChange=${(v) => onChange(list.map((x, j) => (i === j ? v : x)))} onRemove=${() => onChange(list.filter((_, j) => j !== i))} />`)}
    <${Btn} onClick=${() => onChange([...list, { type: 'chat', text: '' }])}>Ajouter une action<//>
  </div>`;
}

function CommandForm({ initial, s, onClose }) {
  const [c, set] = useState(initial);
  const up = (patch) => set({ ...c, ...patch });
  const [perPlatform, setPer] = useState(Boolean(Object.values(c.perPlatform || {}).some(Boolean)));
  const save = async (e) => {
    e.preventDefault();
    const r = await act('saveCommand', c);
    if (r) { setState({ commands: r }); toast('Commande enregistrée'); onClose(); }
  };
  return html`<${Bay} title=${c.id ? c.trigger : 'Nouvelle commande'} aside=${html`<button class="icon" aria-label="Fermer" onClick=${onClose}>${ICONS.x}</button>`}>
    <form class="form-grid" onSubmit=${save}>
      <${Field} label="Commande"><${Text} value=${c.trigger} onChange=${(trigger) => up({ trigger })} placeholder="!discord" /><//>
      <${Field} label="Qui peut l'utiliser"><${Select} value=${c.perm} onChange=${(perm) => up({ perm })} options=${PERMS} /><//>
      <${Field} label="Attente générale (s)"><${Num} value=${c.cooldown} min="0" onSave=${(cooldown) => up({ cooldown })} /><//>
      <${Field} label="Attente par viewer (s)"><${Num} value=${c.userCooldown} min="0" onSave=${(userCooldown) => up({ userCooldown })} /><//>
      <div class="field wide"><span class="f-label">Chaînes qui réagissent</span><${Platforms} value=${c.platforms} onChange=${(platforms) => up({ platforms })} /></div>
      <${Field} label="Réponse" wide hint="Variables : {user} {args} {count} {uptime} {song} {viewers} {channel} {platform} {points} {level} {game} {record} {random:1-100} {pick:a|b} {counter:Nom}. Plusieurs réponses au hasard : sépare-les par ||"><${Text} value=${c.response} onChange=${(response) => up({ response })} /><//>
      <div class="field wide">
        <${Lamp} on=${perPlatform} onChange=${setPer} label="Réponse différente selon la plateforme" />
        ${perPlatform && html`<div class="form-grid inner">
          ${['tiktok', 'twitch', 'youtube', 'kick'].map((p) => html`<${Field} key=${p} label=${PLATFORM[p].label}><${Text} value=${c.perPlatform?.[p] || ''} onChange=${(v) => up({ perPlatform: { ...c.perPlatform, [p]: v } })} /><//>`)}
        </div>`}
      </div>
      <${Field} label="Répondre"><${Select} value=${c.replyTo} onChange=${(replyTo) => up({ replyTo })} options=${[{ value: 'origin', label: 'Sur la chaîne d\'origine' }, { value: 'all', label: 'Sur toutes les chaînes', disabled: !s.features.replyAllChannels }]} /><//>
      <${Actions} list=${c.actions} s=${s} onChange=${(actions) => up({ actions })} />
      <div class="row tight wide"><${Btn} kind="primary" type="submit">Enregistrer la commande<//></div>
    </form>
  <//>`;
}

const NEW_CMD = { trigger: '', perm: 'all', cooldown: 30, userCooldown: 60, platforms: ['tiktok', 'twitch', 'youtube', 'kick'], replyTo: 'origin', response: '', perPlatform: {}, actions: [], enabled: true };

export function Commands({ s }) {
  const [edit, setEdit] = useState(null);
  const f = s.features;
  const change = async (c) => { const r = await act('saveCommand', c); if (r) setState({ commands: r }); };
  return html`<div class="page">
    <${PageHead} title="Commandes">
      <span class="count">${s.commands.length}${f.commands !== -1 ? ` sur ${f.commands}` : ''}</span>
      <${Btn} kind="primary" icon=${ICONS.plus} onClick=${() => setEdit({ ...NEW_CMD })}>Nouvelle commande<//>
    <//>
    ${edit && html`<${CommandForm} key=${edit.id || 'new'} initial=${edit} s=${s} onClose=${() => setEdit(null)} />`}
    <${Bay}>
      <ul class="rules">
        ${s.commands.map((c, i) => html`<li class="rule ${c.enabled ? '' : 'off'}" key=${c.id}><div class="rule-line">
          <${Lamp} on=${c.enabled} onChange=${(enabled) => change({ ...c, enabled })} label=${c.trigger} />
          <p class="rule-msg">${c.response || `${c.actions?.length || 0} actions`}</p>
          ${f.commands !== -1 && i >= f.commands && html`<${Pro} />`}
          <span class="tagline">${c.uses || 0} usages</span>
          <${Btn} onClick=${() => setEdit(c)}>Modifier<//>
          <${Btn} kind="danger" onClick=${async () => { const r = await act('removeCommand', c.id); if (r) setState({ commands: r }); }}>Supprimer<//>
        </div></li>`)}
      </ul>
      <p class="note">Toujours disponibles : !commandes, ${s.tts.command} pour le TTS, ${s.spotify.requests.command} pour les demandes de musique, ${s.gaming.command} pour le rang en jeu, !record, !niveau.</p>
    <//>
    <${Upsell}>FREE : ${f.commands} commandes. PRO : sans limite, avec les réponses sur toutes les chaînes en ULTIMATE.<//>
  </div>`;
}
