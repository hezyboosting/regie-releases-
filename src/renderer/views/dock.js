// Chat unifié : le même chat dans un dock OBS, une fenêtre flottante ou un navigateur.
import { html, useState, useEffect, act, copy, toast, setState, reload } from '../store.js';
import { ICONS, Btn, Bay, PageHead, Field, Lazy, Num, Lamp, Select } from '../ui.js';
import { TranslateBay } from './interactive.js';

export function DockView({ s }) {
  const [link, setLink] = useState('');
  useEffect(() => { act('dockLink').then(setLink); }, []);
  return html`<div class="page">
    <${PageHead} title="Chat unifié">
      <${Btn} onClick=${() => act('openDock')}>Ouvrir en fenêtre flottante<//>
      <${Btn} kind="primary" icon=${ICONS.copy} onClick=${() => copy(link, 'Lien du dock copié')}>Copier le lien du dock<//>
    <//>
    <div class="dock-page">
      <div class="dock-frame">${link && html`<iframe title="Chat unifié" src=${link}></iframe>`}</div>
      <div class="col">
        <${Bay} title="Dans OBS Studio">
          <ol class="steps">
            <li>Copie le lien du dock.</li>
            <li>Dans OBS, ouvre le menu Docks, puis Docks de navigateur personnalisés.</li>
            <li>Donne-lui un nom, colle le lien, puis clique sur Appliquer.</li>
          </ol>
        <//>
        <${Bay} title="Dans Streamlabs, TikTok LIVE Studio et les autres">
          <p class="note">Ouvre la fenêtre flottante : elle reste au-dessus de ton logiciel, même pendant un jeu en plein écran fenêtré.</p>
          <div class="row tight"><${Btn} onClick=${() => { act('openDock'); toast('Fenêtre du chat ouverte'); }}>Ouvrir la fenêtre flottante<//></div>
        <//>
        <${Bay} title="Sur un autre écran">
          <p class="note">Le lien marche aussi dans un navigateur sur ce PC. Garde-le pour toi : il donne accès à ton chat.</p>
        <//>
        <${SpotBay} s=${s} />
        <${TagsBay} s=${s} />
        <${ModBay} s=${s} />
        <${TranslateBay} s=${s} />
      </div>
    </div>
  </div>`;
}

// Message à l'écran : le bouton ⋯ › Afficher en live du dock l'envoie dans cet overlay.
function SpotBay({ s }) {
  const o = s.overlays.find((x) => x.type === 'highlight');
  return html`<${Bay} title="Message à l'écran">
    <p class="note">Dans le dock, le bouton ⋯ d'un message puis Afficher en live le montre en grand sur ton live, avec la photo et le pseudo. Le style se règle dans Overlays, comme les autres.</p>
    <div class="row tight">
      ${o ? html`<${Btn} icon=${ICONS.copy} onClick=${() => copy(o.link, 'Lien de l\'overlay copié')}>Copier le lien de l'overlay<//>
        <${Btn} onClick=${() => act('testOverlay', 'highlight')}>Tester<//>`
    : html`<${Btn} kind="primary" onClick=${async () => { if (await act('addOverlay', 'highlight')) { await reload(); toast('Overlay Message à l\'écran créé'); } }}>Créer l'overlay<//>`}
    </div>
  <//>`;
}

// Commandes de modo : tes modos excluent ou bannissent depuis n'importe quel chat, TikTok compris.
function ModBay({ s }) {
  const c = s.modCommands || {};
  const save = async (patch) => { const r = await act('updateModCommands', patch); if (r) setState({ modCommands: r }); };
  return html`<${Bay} title="Commandes de modo dans le chat" aside=${html`<${Lamp} on=${c.enabled !== false} label="Actives" onChange=${(enabled) => save({ enabled })} />`}>
    <p class="note">Tes modérateurs (et toi) tapent ces commandes dans n'importe quel chat. Régie cherche le pseudo dans le chat récent de toutes tes plateformes : la personne est bloquée dans Régie, et sanctionnée sur sa plateforme quand c'est possible (pas sur TikTok).</p>
    <div class="form-grid">
      <${Field} label="Exclure" hint=${`${c.timeout || '!exclure'} pseudo 10m (ou 30s, 1h, 1j)`}><${Lazy} value=${c.timeout || '!exclure'} onSave=${(timeout) => save({ timeout })} /><//>
      <${Field} label="Bannir" hint=${`${c.ban || '!ban'} pseudo`}><${Lazy} value=${c.ban || '!ban'} onSave=${(ban) => save({ ban })} /><//>
      <${Field} label="Débloquer" hint=${`${c.unban || '!debannir'} pseudo`}><${Lazy} value=${c.unban || '!debannir'} onSave=${(unban) => save({ unban })} /><//>
      <${Field} label="Avertir" hint=${`${c.warn || '!avertir'} pseudo raison`}><${Lazy} value=${c.warn || '!avertir'} onSave=${(warn) => save({ warn })} /><//>
      <${Field} label="Exclusion sans durée (minutes)"><${Num} value=${c.minutes || 10} min=${1} max=${10080} onSave=${(minutes) => save({ minutes })} /><//>
    </div>
    <div class="row wrap tight">
      <${Lamp} on=${c.confirm !== false} label="Confirmer dans le chat" onChange=${(confirm) => save({ confirm })} />
    </div>
    <h4 class="fun-h">Avertissements</h4>
    <p class="note">Chaque avertissement est annoncé dans le chat (@pseudo avertissement 1/3). Au dernier, la sanction tombe toute seule. Le compteur repart de zéro 24 h après le dernier avertissement. Tu peux aussi avertir depuis le dock (bouton ⋯).</p>
    <div class="form-grid">
      <${Field} label="Sanction au bout de"><${Select} value=${String(c.warnLimit || 3)} onChange=${(v) => save({ warnLimit: Number(v) })} options=${[2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} avertissements` }))} /><//>
      <${Field} label="Sanction"><${Select} value=${c.warnAction || 'timeout'} onChange=${(warnAction) => save({ warnAction })} options=${[{ value: 'timeout', label: 'Exclure' }, { value: 'ban', label: 'Bannir' }]} /><//>
      ${(c.warnAction || 'timeout') === 'timeout' && html`<${Field} label="Durée de l'exclusion (minutes)"><${Num} value=${c.warnMinutes || 10} min=${1} max=${10080} onSave=${(warnMinutes) => save({ warnMinutes })} /><//>`}
    </div>
  <//>`;
}

// Repères : qui écrit pour la première fois, qui revient souvent, qui soutient beaucoup.
function TagsBay({ s }) {
  const c = s.chatTags || {};
  const save = async (patch) => { const r = await act('updateChatTags', patch); if (r) setState({ chatTags: r }); };
  return html`<${Bay} title="Repères dans le dock" aside=${html`<${Lamp} on=${c.enabled !== false} label="Actifs" onChange=${(enabled) => save({ enabled })} />`}>
    <p class="note">Une petite marque à côté du pseudo, sur son premier message du live, pour savoir tout de suite qui accueillir ou remercier.</p>
    <div class="row wrap tight">
      <${Lamp} on=${c.newcomer !== false} label="Premier message" onChange=${(newcomer) => save({ newcomer })} />
      <${Lamp} on=${c.regular !== false} label="Habitué" onChange=${(regular) => save({ regular })} />
      <${Lamp} on=${c.fan !== false} label="Gros soutien" onChange=${(fan) => save({ fan })} />
    </div>
    <div class="form-grid">
      <${Field} label="Habitué : venu au moins (jours, sur 2 mois)"><${Num} value=${c.regularDays || 5} min=${2} max=${60} onSave=${(regularDays) => save({ regularDays })} /><//>
      <${Field} label="Gros soutien : au moins (pièces au total)" hint="Les bits, abonnements et Super Chats comptent aussi, convertis en pièces."><${Num} value=${c.fanCoins || 1000} min=${1} onSave=${(fanCoins) => save({ fanCoins })} /><//>
    </div>
    <div class="row wrap tight"><${Lamp} on=${Boolean(c.always)} label="Sur tous leurs messages, pas seulement le premier du live" onChange=${(always) => save({ always })} /></div>
  <//>`;
}
