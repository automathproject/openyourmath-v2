<!-- src/routes/classe/[code]/+page.svelte
     Vue d'un participant à une session de qcm en direct : il entre avec un
     pseudonyme, répond à la question que l'enseignant a ouverte, puis voit la
     correction quand elle est montrée à la classe. -->
<script>
  import { onDestroy, onMount } from 'svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import QcmChoices from '$lib/components/qcm/QcmChoices.svelte';
  import { post, subscribe } from '$lib/qcm/liveClient.js';
  import { instructionFor } from '$lib/qcm/blocks.js';

  export let data;

  let name = data.name;
  let pseudo = '';
  let joinError = '';
  let joining = false;

  let state = data.summary;
  let status = 'connecting';
  let ended = '';
  let unsubscribe = null;

  // Réponse en cours de saisie, et celle que le serveur a enregistrée.
  let selected = [];
  let sent = null;
  let sending = false;
  let sendError = '';
  let questionKey = '';

  function applyState(next) {
    state = next;
    const key = `${next.index}`;
    if (key !== questionKey) {
      // Nouvelle question : on repart de la réponse déjà enregistrée, s'il y en a une.
      questionKey = key;
      selected = next.answer ? [...next.answer] : [];
      sendError = '';
    }
    sent = next.answer ?? null;
    if (next.me?.name) name = next.me.name;
  }

  function connect() {
    unsubscribe?.();
    unsubscribe = subscribe(data.code, {
      onState: applyState,
      onEnd: (reason) => (ended = reason),
      onStatus: (value) => (status = value),
    });
  }

  async function join() {
    joinError = '';
    joining = true;
    try {
      const joined = await post(`/api/classe/${data.code}`, { name: pseudo });
      name = joined.name;
      connect();
    } catch (error) {
      joinError = error.message;
    } finally {
      joining = false;
    }
  }

  async function sendAnswer() {
    sendError = '';
    sending = true;
    try {
      const result = await post(`/api/classe/${data.code}/reponse`, { question: state.index, selection: selected });
      sent = result.answer;
    } catch (error) {
      sendError = error.message;
    } finally {
      sending = false;
    }
  }

  onMount(() => {
    if (name) connect();
  });
  onDestroy(() => unsubscribe?.());

  const sameSelection = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

  $: question = state.question;
  $: phase = state.phase;
  $: dirty = !sameSelection(selected, sent);
  $: canSend = phase === 'open' && (selected.length > 0 || question?.type === 'zerotoall') && !sending;
  $: marks = phase === 'revealed' && state.correction && question
    ? question.choices.map((_, index) => {
        const isCorrect = state.correction.correct.includes(index);
        const chosen = (sent ?? []).includes(index);
        if (isCorrect) return chosen ? 'good' : 'missed';
        return chosen ? 'bad' : '';
      })
    : null;
  $: wasRight = marks ? marks.every((mark) => mark === 'good' || mark === '') : false;

  const END_MESSAGES = {
    fin: "L'enseignant a terminé la session.",
    duree: 'La session a atteint sa durée maximale.',
    inactivite: "La session a été fermée faute d'activité.",
    introuvable: "La session n'existe plus.",
  };
</script>

<svelte:head>
  <title>{state.title} - QCM en direct</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="live">
  <header class="live-head">
    <div>
      <p class="live-kicker">QCM en direct · {data.code}</p>
      <h1>{state.title}</h1>
    </div>
    {#if name}
      <div class="live-me">
        <span class="live-name">{name}</span>
        {#if state.me && state.corrected > 0}
          <span class="live-score" title="Questions réussies sur questions corrigées">{state.me.score}/{state.corrected}</span>
        {/if}
      </div>
    {/if}
  </header>

  {#if ended}
    <section class="panel center">
      <h2>Session terminée</h2>
      <p>{END_MESSAGES[ended] ?? END_MESSAGES.fin}</p>
      {#if state.me && state.corrected > 0}
        <p class="final-score">{state.me.score} / {state.corrected}</p>
        <p class="muted">questions réussies</p>
      {/if}
      <a class="link" href="/classe">Rejoindre une autre session</a>
    </section>
  {:else if !name}
    <section class="panel">
      <h2>Entrer dans la session</h2>
      {#if data.host}
        <p class="muted">Vous animez cette session : <a class="link" href="/classe/{data.code}/animer">ouvrir l'écran d'animation</a>.</p>
      {/if}
      <form on:submit|preventDefault={join}>
        <label for="pseudo">Votre prénom ou un pseudonyme</label>
        <input id="pseudo" class="text-input" bind:value={pseudo} maxlength="24" autocomplete="off" placeholder="Facultatif" />
        <p class="muted small">Il sera visible de l'enseignant. Aucun compte n'est créé.</p>
        {#if joinError}<p class="error" role="alert">{joinError}</p>{/if}
        <button type="submit" class="primary" disabled={joining}>{joining ? 'Entrée…' : 'Rejoindre'}</button>
      </form>
      <p class="muted small">{state.participants} participant{state.participants > 1 ? 's' : ''} sur {state.maxParticipants} places.</p>
    </section>
  {:else if phase === 'lobby' || !question}
    <section class="panel center">
      <div class="pulse" aria-hidden="true"></div>
      <h2>Vous êtes dans la session</h2>
      <p class="muted">La première question s'affichera ici dès que l'enseignant la lancera.</p>
    </section>
  {:else}
    <section class="panel">
      <p class="progress">
        Question {state.index + 1} sur {state.total}
        {#if question.of > 1}<span class="serie">· série, partie {question.rank}/{question.of}</span>{/if}
      </p>

      {#if question.context_html}
        <div class="context"><MathRenderer content={question.context_html} prerendered /></div>
      {/if}
      <div class="stem"><MathRenderer content={question.stem_html} prerendered /></div>

      {#if phase === 'open'}<p class="instruction">{instructionFor(question)}</p>{/if}

      <QcmChoices
        choices={question.choices}
        bind:selected
        single={question.single}
        disabled={phase !== 'open'}
        {marks}
        prerendered
        name="live-{state.index}"
      />

      {#if phase === 'open'}
        <div class="actions">
          <button type="button" class="primary" disabled={!canSend || (!dirty && sent !== null)} on:click={sendAnswer}>
            {#if sending}Envoi…{:else if sent === null}Envoyer ma réponse{:else if dirty}Modifier ma réponse{:else}Réponse envoyée ✓{/if}
          </button>
          {#if sent !== null && !dirty}
            <p class="muted small" role="status">Vous pouvez encore la changer tant que les réponses sont ouvertes.</p>
          {/if}
          {#if sendError}<p class="error" role="alert">{sendError}</p>{/if}
        </div>
      {:else if phase === 'closed'}
        <p class="banner" role="status">
          {sent === null ? "Réponses closes : vous n'avez pas répondu." : 'Réponses closes. La correction arrive.'}
        </p>
      {:else if phase === 'revealed'}
        <p class="banner" class:banner--good={sent !== null && wasRight} class:banner--bad={sent === null || !wasRight} role="status">
          {#if sent === null}Vous n'avez pas répondu à cette question.
          {:else if wasRight}✓ Bonne réponse
          {:else}✗ Réponse inexacte ou incomplète{/if}
        </p>
        {#if state.correction?.explanation_html}
          <div class="explanation">
            <p class="explanation-title">Explications</p>
            <MathRenderer content={state.correction.explanation_html} prerendered />
          </div>
        {/if}
      {/if}
    </section>
  {/if}

  {#if name && !ended && status === 'lost'}
    <p class="offline" role="status">Connexion perdue, nouvelle tentative…</p>
  {/if}
</main>

<style>
  .live {
    max-width: 42rem;
    margin: 0 auto;
    padding: 1rem 0.9rem 4rem;
  }

  .live-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .live-kicker {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-brand-700);
  }

  h1 {
    margin: 0.1rem 0 0;
    font-size: 1.25rem;
    font-weight: 800;
    color: #111827;
  }

  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.15rem;
    font-weight: 700;
    color: #111827;
  }

  .live-me {
    text-align: right;
    flex-shrink: 0;
  }

  .live-name {
    display: block;
    font-weight: 600;
    color: #374151;
    font-size: 0.9rem;
  }

  .live-score {
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    color: var(--color-brand-700);
  }

  .panel {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 1.25rem;
  }

  .center {
    text-align: center;
    padding: 2.5rem 1.25rem;
  }

  .progress {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: #4b5563;
  }

  .serie {
    font-weight: 500;
  }

  .context {
    padding: 0.75rem 0.9rem;
    margin-bottom: 0.9rem;
    background: var(--color-brand-50);
    border-radius: 0.6rem;
    color: #374151;
    line-height: 1.6;
    overflow-x: auto;
  }

  .stem {
    color: #111827;
    font-size: 1.05rem;
    line-height: 1.6;
    overflow-x: auto;
    overflow-y: hidden;
    padding-block: 0.2rem;
  }

  .stem :global(img),
  .context :global(img) {
    max-width: 100%;
    height: auto;
  }

  .instruction {
    margin: 0.6rem 0 0;
    font-size: 0.85rem;
    color: #4b5563;
  }

  .actions {
    margin-top: 1rem;
  }

  .primary {
    width: 100%;
    padding: 0.85rem 1rem;
    border: 0;
    border-radius: 0.75rem;
    background: var(--color-brand-600);
    color: #fff;
    font-size: 1.05rem;
    font-weight: 700;
    cursor: pointer;
  }

  .primary:hover:not(:disabled) {
    background: var(--color-brand-700);
  }

  .primary:disabled {
    opacity: 0.65;
    cursor: default;
  }

  label {
    display: block;
    font-size: 0.9rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.35rem;
  }

  .text-input {
    width: 100%;
    padding: 0.7rem 0.8rem;
    font-size: 1.05rem;
    border: 2px solid #d1d5db;
    border-radius: 0.6rem;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--color-brand-500);
  }

  .muted {
    color: #6b7280;
  }

  .small {
    font-size: 0.85rem;
    margin: 0.5rem 0;
  }

  .error {
    color: #b91c1c;
    font-size: 0.9rem;
    margin: 0.5rem 0;
  }

  .link {
    color: var(--color-brand-700);
    text-decoration: underline;
  }

  .banner {
    margin: 1rem 0 0;
    padding: 0.75rem 0.9rem;
    border-radius: 0.6rem;
    background: #f3f4f6;
    font-weight: 700;
    color: #374151;
  }

  .banner--good {
    background: #f0fdf4;
    color: #15803d;
  }

  .banner--bad {
    background: #fef2f2;
    color: #b91c1c;
  }

  .explanation {
    margin-top: 1rem;
    padding: 0.85rem 1rem;
    border-left: 4px solid #4ade80;
    background: #f0fdf4;
    border-radius: 0 0.5rem 0.5rem 0;
    color: #374151;
    line-height: 1.6;
    overflow-x: auto;
  }

  .explanation-title {
    margin: 0 0 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #15803d;
  }

  .final-score {
    margin: 1rem 0 0;
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--color-brand-700);
    font-variant-numeric: tabular-nums;
  }

  .pulse {
    width: 0.9rem;
    height: 0.9rem;
    margin: 0 auto 1rem;
    border-radius: 50%;
    background: var(--color-brand-500);
    animation: pulse 1.6s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.35; transform: scale(0.85); }
    50% { opacity: 1; transform: scale(1.15); }
  }

  @media (prefers-reduced-motion: reduce) {
    .pulse { animation: none; }
  }

  .offline {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    margin: 0;
    padding: 0.5rem 1rem;
    border-radius: 999px;
    background: #111827;
    color: #fff;
    font-size: 0.85rem;
  }
</style>
