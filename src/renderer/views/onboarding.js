import { html, act, setState, getState } from '../store.js';
import { Btn, go } from '../ui.js';

const finish = async () => {
  await act('finishOnboarding');
  setState({ settings: { ...getState().settings, onboarded: true } });
};

export function Onboarding({ s }) {
  const start = async (view, extra) => { await finish(); go(view, extra); };
  return html`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ob-title">
    <div class="ob">
      <h1 id="ob-title">Bienvenue dans ${s.brand.name}</h1>
      <p>Trois gestes pour être prêt avant ton prochain live :</p>
      <ol class="steps">
        <li>Ajoute tes chaînes TikTok, Twitch ou YouTube dans le tableau de bord.</li>
        <li>Copie un lien d'overlay et colle-le dans OBS ou TikTok LIVE Studio.</li>
        <li>Essaie une alerte pour vérifier que tout s'affiche.</li>
      </ol>
      <div class="row tight">
        <${Btn} kind="primary" onClick=${() => start('dashboard')}>Ajouter ma première chaîne<//>
        <${Btn} onClick=${() => start('settings', { settingsTab: 'licence' })}>J'ai une clé<//>
      </div>
    </div>
  </div>`;
}
