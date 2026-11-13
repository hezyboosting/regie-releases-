// Assistant de démarrage : cinq questions, puis Régie installe chaînes, packs, overlays, thème et scène.
import { html, useState, act, setState, getState, getLang, setLang, copy, toast } from '../store.js';
import { Btn, ICONS } from '../ui.js';

const PLATFORMS = [['tiktok', 'TikTok', 'Ton pseudo TikTok'], ['twitch', 'Twitch', 'Ton pseudo Twitch'], ['youtube', 'YouTube', 'Ton @pseudo YouTube'], ['kick', 'Kick', 'Ton pseudo Kick']];
const STYLES = [
  ['calme', 'Posé', 'Alertes, chat et objectif. Simple et propre.'],
  ['interactif', 'Interactif', 'En plus : la roue et les actions qui agissent dans ton jeu.'],
  ['max', 'À fond', 'En plus : course aux likes, avatars des spectateurs et ambiance des plus gros lives.'],
];
const inSeason = (t, m = new Date().getMonth() + 1) => Boolean(t.season) && (t.season[0] <= t.season[1] ? m >= t.season[0] && m <= t.season[1] : m >= t.season[0] || m <= t.season[1]);

export function Setup({ s }) {
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState({ lang: getLang(), accounts: {}, game: s.gaming.active || '', style: 'interactif', theme: (s.themes.find((t) => inSeason(t)) || s.themes[0]).id });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const up = (patch) => setCfg({ ...cfg, ...patch });
  const close = () => setState({ setupOpen: false, settings: { ...getState().settings, onboarded: true } });
  const skip = async () => { await act('finishOnboarding'); close(); };
  const run = async () => {
    setBusy(true);
    try {
      const accounts = Object.entries(cfg.accounts).filter(([, v]) => v && v.trim()).map(([platform, username]) => ({ platform, username: username.trim() }));
      const r = await act('runSetup', { ...cfg, accounts });
      if (r) setResult(r);
    } finally { setBusy(false); }
  };
  const themes = [...s.themes].sort((a, b) => inSeason(b) - inSeason(a)).slice(0, 12);
  const games = s.gameCatalog.filter((g) => g.id !== 'custom');
  const steps = ['Langue', 'Chaînes', 'Jeu', 'Style', 'Thème'];

  if (result) {
    return html`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="su-title"><div class="su">
      <h1 id="su-title">C'est prêt</h1>
      <ul class="su-done">
        ${result.accounts.length > 0 && html`<li>${result.accounts.length} chaîne${result.accounts.length > 1 ? 's' : ''} ajoutée${result.accounts.length > 1 ? 's' : ''}</li>`}
        ${result.packs.length > 0 && html`<li>Packs installés : ${result.packs.map((id) => s.packs.find((p) => p.id === id)?.name || id).join(', ')}</li>`}
        <li>Overlays et thème posés, scène complète prête</li>
      </ul>
      ${result.errors.length > 0 && html`<p class="note warn">${result.errors.join(' · ')}</p>`}
      <p>Dans OBS ou TikTok LIVE Studio, ajoute une source navigateur en 1920 × 1080 avec ce lien : tous tes overlays y sont déjà placés.</p>
      ${result.scene && html`<div class="linkbar"><input class="in" readOnly value=${result.scene.link} aria-label="Lien de la scène" onFocus=${(e) => e.target.select()} /><${Btn} kind="primary" icon=${ICONS.copy} onClick=${() => copy(result.scene.link)}>Copier le lien<//></div>`}
      ${result.vscene && html`<p>En vertical (TikTok LIVE Studio), source 1080 × 1920 :</p><div class="linkbar"><input class="in" readOnly value=${result.vscene.link} aria-label="Lien de la scène verticale" onFocus=${(e) => e.target.select()} /><${Btn} icon=${ICONS.copy} onClick=${() => copy(result.vscene.link)}>Copier<//></div>`}
      <div class="row tight">
        ${s.obs.state === 'connected' && result.scene && html`<${Btn} onClick=${async () => { if (await act('obsAddOverlay', result.scene.id) !== undefined) toast('Scène ajoutée à OBS'); }}>Ajouter à OBS<//>`}
        <${Btn} onClick=${() => { close(); setState({ view: 'overlays', sceneOpen: true, overlayId: null }); }}>Voir la scène<//>
        <${Btn} kind="primary" onClick=${close}>Terminer<//>
      </div>
    </div></div>`;
  }

  return html`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="su-title"><div class="su">
    <div class="su-steps">${steps.map((n, i) => html`<span key=${n} class=${i === step ? 'on' : i < step ? 'ok' : ''}>${n}</span>`)}</div>
    ${step === 0 && html`<div class="su-body">
      <h1 id="su-title">Bienvenue dans ${s.brand.name}</h1>
      <p>Cinq questions et ton live est prêt : chaînes, overlays, jeux interactifs et scène. Tu pourras tout changer ensuite.</p>
      <div class="su-pick">
        ${[['fr', 'Français'], ['en', 'English']].map(([v, l]) => html`<button type="button" key=${v} class="su-card ${cfg.lang === v ? 'on' : ''}" onClick=${() => { up({ lang: v }); setLang(v); }}><b>${l}</b></button>`)}
      </div>
    </div>`}
    ${step === 1 && html`<div class="su-body">
      <h1 id="su-title">Où est-ce que tu streames ?</h1>
      <p>Remplis seulement tes plateformes. Tu pourras en ajouter d'autres dans Connexions.</p>
      <div class="su-acc">${PLATFORMS.map(([id, name, ph]) => html`<label key=${id} class="su-row"><span>${name}</span><input class="in" value=${cfg.accounts[id] || ''} placeholder=${ph} onInput=${(e) => up({ accounts: { ...cfg.accounts, [id]: e.target.value } })} /></label>`)}</div>
    </div>`}
    ${step === 2 && html`<div class="su-body">
      <h1 id="su-title">Tu joues à quoi le plus souvent ?</h1>
      <div class="su-grid">
        <button type="button" class=${`su-card ${!cfg.game ? 'on' : ''}`} onClick=${() => up({ game: '' })}><b>Pas de jeu précis</b></button>
        ${games.map((g) => html`<button type="button" key=${g.id} class="su-card ${cfg.game === g.id ? 'on' : ''}" onClick=${() => up({ game: g.id })}><b>${g.name}</b></button>`)}
      </div>
    </div>`}
    ${step === 3 && html`<div class="su-body">
      <h1 id="su-title">Quel genre de live ?</h1>
      <div class="su-pick col">${STYLES.map(([v, n, d]) => html`<button type="button" key=${v} class="su-card wide ${cfg.style === v ? 'on' : ''}" onClick=${() => up({ style: v })}><b>${n}</b><span>${d}</span></button>`)}</div>
    </div>`}
    ${step === 4 && html`<div class="su-body">
      <h1 id="su-title">Un style pour tes overlays</h1>
      <div class="su-grid">${themes.map((t) => html`<button type="button" key=${t.id} class="su-card ${cfg.theme === t.id ? 'on' : ''}" onClick=${() => up({ theme: t.id })}>
        <span class="su-sw" style=${{ background: `linear-gradient(135deg, ${t.swatch[1]} 0 55%, ${t.swatch[0]} 55% 100%)` }}></span><b>${t.name}</b>${inSeason(t) && html`<small class="look-season">De saison</small>`}
      </button>`)}</div>
    </div>`}
    <div class="row tight su-nav">
      <button type="button" class="linkish" onClick=${skip}>Passer, je règle moi-même</button>
      <span style=${{ flex: 1 }}></span>
      ${step > 0 && html`<${Btn} onClick=${() => setStep(step - 1)}>Retour<//>`}
      ${step < 4 ? html`<${Btn} kind="primary" onClick=${() => setStep(step + 1)}>Continuer<//>` : html`<${Btn} kind="primary" disabled=${busy} onClick=${run}>${busy ? 'Installation…' : 'Tout installer'}<//>`}
    </div>
  </div></div>`;
}
