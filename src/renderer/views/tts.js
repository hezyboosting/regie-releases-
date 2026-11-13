import { html, useState, useEffect, act, setState } from '../store.js';
import { Btn, Bay, Field, Lamp, Lazy, Num, Select, Fader, Platforms, Segments, PageHead, Pro, Upsell } from '../ui.js';

const READ = [['command', 'Commande de synthèse vocale'], ['chat', 'Tout le chat'], ['gift', 'Cadeaux'], ['superchat', 'Super Chats'], ['bits', 'Bits avec message'], ['sub', 'Messages d\'abonnement']];

export function TtsView({ s }) {
  const t = s.tts;
  const [text, setText] = useState('Bonjour, ceci est un essai de la voix du live.');
  const [voices11, setVoices] = useState([]);
  const up = async (patch) => { const r = await act('updateTts', patch); if (r) setState({ tts: r }); };
  const locked = !s.features.ttsPremiumVoices;
  const q = s.ttsQueue || { current: null, queue: [] };
  const [allowed, setAllowed] = useState(null);
  useEffect(() => { act('allowedVoices').then(setAllowed); }, [s.voices?.length, s.role]);
  const ok = new Set((allowed || []).map((v) => v.id));
  const voices = (s.voices || []).map((v) => ({ value: v.id, label: `${v.name} (${v.lang})`, disabled: allowed && !ok.has(v.id) }));
  const frFirst = [...voices].sort((a, b) => (b.label.includes('fr') ? 1 : 0) - (a.label.includes('fr') ? 1 : 0));
  return html`<div class="page">
    <${PageHead} title="Synthèse vocale">
      <${Lamp} on=${t.enabled} onChange=${(enabled) => up({ enabled })} label="Synthèse vocale active" />
      <${Btn} onClick=${() => act('ttsSkip')}>Passer<//>
      <${Btn} onClick=${() => act('ttsClear')}>Vider la file<//>
    <//>
    <${Bay} title="Voix">
      <${Segments} value=${t.provider} locked=${locked} onChange=${(provider) => up({ provider })} options=${[{ value: 'system', label: 'Voix Windows' }, { value: 'eleven', label: 'ElevenLabs', premium: true }]} />
      <div class="row wrap">
        ${t.provider === 'system' ? html`
          <${Field} label="Voix"><${Select} value=${t.voice} onChange=${(voice) => up({ voice })} options=${[{ value: '', label: voices.length ? 'Voix française par défaut' : 'Aucune voix trouvée' }, ...frFirst]} /><//>
          <${Field} label="Vitesse"><${Fader} value=${t.rate} min="0.5" max="2" step="0.1" onChange=${(rate) => up({ rate })} /><//>
          <${Field} label="Hauteur"><${Fader} value=${t.pitch} min="0" max="2" step="0.1" onChange=${(pitch) => up({ pitch })} /><//>
        ` : html`
          <${Field} label="Voix ElevenLabs"><${Select} value=${t.elevenVoice} onChange=${(elevenVoice) => up({ elevenVoice })} options=${[{ value: '', label: 'Choisir une voix' }, ...voices11.map((v) => ({ value: v.id, label: v.name }))]} /><//>
          <${Btn} onClick=${async () => { const v = await act('elevenVoices'); if (v) setVoices(v); }}>Charger mes voix<//>
        `}
        <${Field} label="Volume"><${Fader} value=${t.volume} min="0" max="100" step="1" unit=" %" onChange=${(volume) => up({ volume })} /><//>
      </div>
      <form class="row" onSubmit=${(e) => { e.preventDefault(); act('ttsTest', text); }}>
        <${Field} label="Phrase d'essai" wide><input class="in" value=${text} onInput=${(e) => setText(e.target.value)} /><//>
        <${Btn} kind="primary" type="submit">Écouter<//>
      </form>
    <//>
    <div class="two">
      <${Bay} title="Ce qui est lu">
        <div class="col">
          ${READ.map(([k, l]) => html`<${Lamp} key=${k} on=${t.read[k]} label=${l} onChange=${(v) => up({ read: { ...t.read, [k]: v } })} />`)}
          <div class="field"><span class="f-label">Plateformes</span><${Platforms} value=${t.platforms} onChange=${(platforms) => up({ platforms })} /></div>
        </div>
      <//>
      <${Bay} title="Permissions et filtres">
        <div class="col">
          <${Field} label="Commande"><${Lazy} value=${t.command} onSave=${(command) => up({ command })} /><//>
          <${Field} label="Qui peut l'utiliser"><${Select} value=${t.perm} onChange=${(perm) => up({ perm })} options=${[{ value: 'all', label: 'Tout le monde' }, { value: 'sub', label: 'Abonnés' }, { value: 'vip', label: 'VIP' }, { value: 'mod', label: 'Modérateurs' }]} /><//>
          <${Field} label="Toujours autorisés" hint="Pseudos séparés par des virgules"><${Lazy} value=${(t.allowUsers || []).join(', ')} onSave=${(v) => up({ allowUsers: v.split(',').map((x) => x.trim()).filter(Boolean) })} /><//>
          <${Field} label="Jamais lus" hint="Pseudos séparés par des virgules"><${Lazy} value=${(t.blockUsers || []).join(', ')} onSave=${(v) => up({ blockUsers: v.split(',').map((x) => x.trim()).filter(Boolean) })} /><//>
          <${Field} label="Longueur max"><${Num} value=${t.maxLength} min="10" max="500" onSave=${(maxLength) => up({ maxLength })} /><//>
          <${Field} label="Attente par spectateur (s)"><${Num} value=${t.cooldown} min="0" onSave=${(cooldown) => up({ cooldown })} /><//>
          <${Lamp} on=${t.stripLinks} label="Ne pas lire les liens" onChange=${(stripLinks) => up({ stripLinks })} />
          <${Lamp} on=${t.stripEmoji} label="Ne pas lire les émojis" onChange=${(stripEmoji) => up({ stripEmoji })} />
          <${Field} label="Mots bloqués" hint="Séparés par des virgules"><${Lazy} value=${(t.blocked || []).join(', ')} onSave=${(v) => up({ blocked: v.split(',').map((x) => x.trim()).filter(Boolean) })} /><//>
        </div>
      <//>
    </div>
    <${Bay} title=${html`Une voix par spectateur ${!s.features.ttsPerUserVoice ? html`<${Pro} />` : ''}`}>
      <${Field} label="pseudo = voix, une par ligne" wide hint="Copie l'identifiant de la voix depuis la liste ci-dessus"><${Lazy} area disabled=${!s.features.ttsPerUserVoice} value=${Object.entries(t.userVoices || {}).map(([k, v]) => `${k} = ${v}`).join('\n')} onSave=${(v) => up({ userVoices: Object.fromEntries(v.split('\n').map((l) => l.split('=').map((x) => x.trim())).filter((p) => p[0] && p[1]).map(([a, b]) => [a.toLowerCase(), b])) })} /><//>
    <//>
    <${Bay} title="File de lecture">
      ${q.current ? html`<p><b>${q.current.user}</b> ${q.current.display}</p>` : html`<p class="note">Rien en cours.</p>`}
      ${q.queue.length > 0 && html`<ol class="queue">${q.queue.map((j) => html`<li key=${j.id}><b>${j.user}</b> ${j.text}</li>`)}</ol>`}
    <//>
    <${Upsell}>FREE : une voix par langue. PRO : toutes les voix, ElevenLabs et une voix par spectateur.<//>
  </div>`;
}
