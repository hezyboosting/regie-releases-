// Assistant IA : analyse les lives et propose des idées, avec la clé API du streamer.
import { html, useState, act, setState } from '../store.js';
import { ICONS, Btn, Bay, Field, Lazy, PageHead, Pro } from '../ui.js';

const KINDS = [['analyse', 'Analyser mes lives', 'Trois améliorations classées par impact.'], ['titres', 'Trouver des titres', 'Dix titres de live pour ton jeu.'], ['commandes', 'Proposer des commandes', 'Cinq commandes de chat utiles.'], ['idees', 'Idées d\'interactions', 'Des idées adaptées à ton jeu.'], ['scenario', 'Scénarios d\'automatisation', 'Trois recettes SI et ALORS.']];

export function AssistantView({ s }) {
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const locked = !s.features.aiAssistant;
  const run = async (kind, prompt) => {
    setBusy(true);
    setOut('');
    const r = await act('aiAssist', kind, prompt);
    setBusy(false);
    if (r) setOut(r);
  };
  const noKey = !s.keys.anthropicKey;
  return html`<div class="page">
    <${PageHead} title="Assistant IA">${locked ? html`<${Pro} tier="ULTIMATE" />` : ''}<//>
    ${noKey && html`<p class="note warn">Ajoute ta clé API Claude dans Réglages, Connexions. L'assistant utilise ton compte API.</p>`}
    <div class="pick-list">
      ${KINDS.map(([k, name, blurb]) => html`<button type="button" class="pick" key=${k} disabled=${locked || busy} onClick=${() => run(k)}><b>${name}</b><span>${blurb}</span></button>`)}
    </div>
    <${Bay} title="Pose une question">
      <form class="ai-box" onSubmit=${(e) => { e.preventDefault(); if (q.trim()) run('config', q); }}>
        <input class="in" value=${q} disabled=${locked || busy} onInput=${(e) => setQ(e.target.value)} placeholder="Comment afficher mes alertes dans TikTok LIVE Studio ?" />
        <${Btn} kind="primary" type="submit" disabled=${locked || busy || !q.trim()} icon=${ICONS.spark}>${busy ? 'Réflexion en cours' : 'Demander'}<//>
      </form>
    <//>
    ${out && html`<${Bay} title="Réponse"><p class="ai-out">${out}</p><//>`}
  </div>`;
}
void setState; void Field; void Lazy;
