// Chat unifié : le même chat dans un dock OBS, une fenêtre flottante ou un navigateur.
import { html, useState, useEffect, act, copy, toast } from '../store.js';
import { ICONS, Btn, Bay, PageHead } from '../ui.js';
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
        <${TranslateBay} s=${s} />
      </div>
    </div>
  </div>`;
}
