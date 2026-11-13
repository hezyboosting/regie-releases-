// Scene Manager : les scènes OBS, leurs sources, les transitions et le direct.
import { html, useState, useEffect, act, setState, toast, copy, reload } from '../store.js';
import { ICONS, Btn, Bay, Field, Text, Select, Lamp, PageHead, Empty, Pro, Segments, Num } from '../ui.js';

function Connect({ s }) {
  const o = s.obs;
  const [host, setHost] = useState(o.host);
  const [port, setPort] = useState(o.port);
  const [pw, setPw] = useState('');
  return html`<${Bay} title="Connecter OBS">
    <ol class="steps">
      <li>Dans OBS, ouvre Outils, puis Paramètres du serveur WebSocket.</li>
      <li>Coche Activer le serveur WebSocket et copie le mot de passe.</li>
      <li>Colle-le ici et connecte OBS.</li>
    </ol>
    <form class="row wrap" onSubmit=${(e) => { e.preventDefault(); act('obsConnect', { host, port, password: pw }); }}>
      <${Field} label="Adresse"><${Text} value=${host} onChange=${setHost} /><//>
      <${Field} label="Port"><${Text} type="number" value=${port} onChange=${setPort} /><//>
      <${Field} label="Mot de passe"><${Text} type="password" value=${pw} onChange=${setPw} placeholder=${o.hasPassword ? 'Déjà enregistré' : ''} /><//>
      <${Btn} kind="primary" type="submit">Connecter OBS<//>
    </form>
    ${o.detail && html`<p class="note warn">${o.detail}</p>`}
  <//>`;
}

export { Connect as ObsConnect };

export function Scenes({ s }) {
  const connected = s.obs.state === 'connected';
  const [data, setData] = useState({ current: '', scenes: [] });
  const [thumbs, setThumbs] = useState({});
  const [picked, setPicked] = useState('');
  const [sources, setSources] = useState([]);
  const [trans, setTrans] = useState({ current: '', list: [] });
  const [newName, setNewName] = useState('');
  const c = s.scenes;
  const current = s.obsCurrent || data.current;
  const load = async () => {
    const d = await act('obsScenes');
    if (d) { setData(d); setPicked((p) => p || d.current); }
    const t = await act('obsTransitions');
    if (t) setTrans(t);
  };
  useEffect(() => { if (connected) load(); }, [connected, s.obsTick]);
  useEffect(() => { if (connected && picked) act('obsSources', picked).then((l) => l && setSources(l)); }, [picked, connected, s.obsTick]);
  useEffect(() => {
    if (!connected || !data.scenes.length) return undefined;
    let stop = false;
    const refresh = async () => {
      for (const name of data.scenes) {
        if (stop) return;
        try { const img = await window.regie.call('obsThumb', name); setThumbs((t) => ({ ...t, [name]: img })); } catch { /* scène indisponible */ }
      }
    };
    refresh();
    const t = setInterval(refresh, 8000);
    return () => { stop = true; clearInterval(t); };
  }, [connected, data.scenes.join('|')]);
  const upScenes = async (patch) => { const r = await act('updateScenes', patch); if (r) setState({ scenes: r }); };
  const overlay = s.overlays.find((o) => o.type === 'transition');
  const locked = !s.features.customTransitions;
  return html`<div class="page">
    <${PageHead} title="Scènes OBS">
      ${connected && html`<${Btn} onClick=${() => act('obsToggleMic')}>Micro<//>`}
      ${connected && html`<${Btn} onClick=${() => act('obsToggleRecord')}>Enregistrement<//>`}
      ${connected && html`<${Btn} kind=${s.obs.streaming ? 'danger' : 'primary'} onClick=${() => act('obsToggleStream')}>${s.obs.streaming ? 'Arrêter le stream' : 'Lancer le stream'}<//>`}
      ${connected && html`<${Btn} onClick=${() => act('obsDisconnect')}>Déconnecter<//>`}
    <//>
    ${!connected ? html`<${Connect} s=${s} />` : html`
      ${data.scenes.length ? html`<div class="scenes">
        ${data.scenes.map((name) => html`<button type="button" class="scene ${current === name ? 'on' : ''}" key=${name} onClick=${() => { setPicked(name); act('obsSetScene', name); }}>
          ${thumbs[name] ? html`<img class="scene-thumb" src=${thumbs[name]} alt="" />` : html`<span class="scene-thumb"></span>`}
          <b>${name}</b>
        </button>`)}
      </div>` : html`<${Empty} title="Aucune scène">Crée une scène dans OBS, elle apparaîtra ici.<//>`}
      <div class="row tight">
        <input class="in scene-new" value=${newName} onInput=${(e) => setNewName(e.target.value)} placeholder="Nom de la nouvelle scène" aria-label="Nom de la nouvelle scène" />
        <${Btn} icon=${ICONS.plus} disabled=${!newName.trim()} onClick=${async () => { await act('obsCreateScene', newName.trim()); setNewName(''); load(); }}>Créer<//>
        ${picked && html`<${Btn} onClick=${async () => { await act('obsDuplicateScene', picked); load(); }}>Dupliquer ${picked}<//>`}
        ${picked && data.scenes.length > 1 && html`<${Btn} kind="danger" onClick=${async () => { await act('obsRemoveScene', picked); setPicked(''); load(); }}>Supprimer ${picked}<//>`}
      </div>
      <div class="two">
        <${Bay} title=${`Sources de ${picked || 'la scène'}`}>
          <div class="col">
            ${sources.map((src) => html`<${Lamp} key=${src.id} on=${src.enabled} label=${src.name} onChange=${async (v) => { await act('obsSetSource', picked, src.id, v); setSources(sources.map((x) => (x.id === src.id ? { ...x, enabled: v } : x))); }} />`)}
            ${!sources.length && html`<p class="note">Cette scène n'a pas de source.</p>`}
          </div>
        <//>
        <${Bay} title="Transitions">
          <div class="col">
            <${Field} label="Transition d'OBS"><${Select} value=${trans.current} options=${trans.list.map((t) => ({ value: t, label: t }))} onChange=${async (v) => { await act('obsSetTransition', v); setTrans({ ...trans, current: v }); }} /><//>
            <${Lamp} on=${c.useTransition && !locked} locked=${locked} label="Utiliser une transition Régie" onChange=${(useTransition) => upScenes({ useTransition })} />
            <${Segments} value=${c.transitionStyle} locked=${false} onChange=${(transitionStyle) => upScenes({ transitionStyle })} options=${[{ value: 'volet', label: 'Volet' }, { value: 'diagonale', label: 'Diagonale' }, { value: 'bandes', label: 'Bandes' }, { value: 'iris', label: 'Iris' }]} />
            <${Field} label="Durée (millisecondes)"><${Num} value=${c.transitionMs} min="300" max="4000" step="100" onSave=${(transitionMs) => upScenes({ transitionMs })} /><//>
            ${overlay ? html`<${Btn} icon=${ICONS.copy} onClick=${() => copy(overlay.link)}>Copier le lien de la transition<//>` : html`<${Btn} onClick=${async () => { const o = await act('addOverlay', 'transition'); if (o) reload(); }}>Créer l'overlay de transition<//>`}
            <p class="note">Ajoute ce lien en source navigateur tout en haut de chaque scène, en 1920 × 1080.${locked ? ' ' : ''}${locked ? html`<${Pro} />` : ''}</p>
          </div>
        <//>
      </div>
    `}
  </div>`;
}
void toast;
