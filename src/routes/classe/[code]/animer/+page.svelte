<!-- src/routes/classe/[code]/animer/+page.svelte
     Écran de l'enseignant, fait pour être projeté : il montre comment
     rejoindre, la question en cours, combien ont répondu, puis la répartition
     des réponses et la correction. La répartition reste cachée tant que les
     réponses sont ouvertes, pour ne pas orienter la classe. -->
<script>
  import { onDestroy, onMount } from 'svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import QcmChoices from '$lib/components/qcm/QcmChoices.svelte';
  import { post, subscribe } from '$lib/qcm/liveClient.js';
  import { lettersOf, questionLabel, resultsToCsv } from '$lib/qcm/results.js';

  export let data;

  let state = data.summary;
  let status = 'connecting';
  let ended = '';
  let results = null;
  let busy = false;
  let actionError = '';
  let showRoster = false;
  let unsubscribe = null;

  onMount(() => {
    unsubscribe = subscribe(data.code, {
      host: true,
      onState: (next) => (state = next),
      onEnd: (reason) => (ended = ended || reason),
      onStatus: (value) => (status = value),
    });
  });
  onDestroy(() => unsubscribe?.());

  async function command(action, index) {
    actionError = '';
    busy = true;
    try {
      const result = await post(`/api/classe/${data.code}/pilotage`, { action, index });
      if (result.ended) {
        results = result.results;
        ended = 'fin';
      }
    } catch (error) {
      actionError = error.message;
    } finally {
      busy = false;
    }
  }

  function endSession() {
    if (confirm('Terminer la session ? Les participants seront déconnectés et le bilan ne sera plus disponible une fois cette page fermée.')) {
      command('end');
    }
  }

  function downloadCsv() {
    const blob = new Blob([resultsToCsv(results)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `qcm-${data.code}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  $: phase = state.phase;
  $: question = state.question;
  $: stats = state.stats;
  $: isLast = state.index >= state.total - 1;
  $: showDistribution = phase === 'closed' || phase === 'revealed';
  $: marks = phase === 'revealed' && question
    ? question.choices.map((_, index) => (state.correction.correct.includes(index) ? 'correct' : ''))
    : null;
  $: successRate = stats && stats.answered > 0 ? Math.round((100 * stats.correct) / stats.answered) : 0;
  $: roster = [...(state.roster ?? [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'));
  $: scoreOf = (participant) => participant.answers.filter((answer) => answer?.correct).length;
</script>

<svelte:head>
  <title>Animer : {state.title} - QCM en direct</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="host">
  {#if ended}
    <section class="panel">
      <h1>Session terminée</h1>
      {#if results}
        <p class="muted">
          {results.participants.length} participant{results.participants.length > 1 ? 's' : ''}, {results.questions.length} question{results.questions.length > 1 ? 's' : ''}.
          Ce bilan n'est conservé nulle part : téléchargez-le avant de quitter la page.
        </p>
        <button type="button" class="btn btn--primary" on:click={downloadCsv}>Télécharger le bilan (CSV)</button>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Participant</th>
                {#each results.questions as item, index}
                  <th scope="col" title={questionLabel(item, index)}>Q{index + 1}</th>
                {/each}
                <th scope="col">Score</th>
              </tr>
              <tr class="key">
                <th scope="row">Réponses justes</th>
                {#each results.questions as item}<td>{lettersOf(item.correct) || '—'}</td>{/each}
                <td></td>
              </tr>
              <tr class="key">
                <th scope="row">Réussite</th>
                {#each results.questions as item}
                  <td>{item.stats.answered ? `${Math.round((100 * item.stats.correct) / item.stats.answered)} %` : '—'}</td>
                {/each}
                <td></td>
              </tr>
            </thead>
            <tbody>
              {#each [...results.participants].sort((a, b) => scoreOf(b) - scoreOf(a)) as participant}
                <tr>
                  <th scope="row">{participant.name}</th>
                  {#each participant.answers as answer}
                    <td class:ok={answer?.correct} class:ko={answer && !answer.correct}>
                      {#if answer}{lettersOf(answer.selection) || '∅'}{:else}<span class="muted">—</span>{/if}
                    </td>
                  {/each}
                  <td class="score">{scoreOf(participant)}/{results.questions.length}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="muted">La session a été fermée ({ended === 'duree' ? 'durée maximale atteinte' : ended === 'inactivite' ? 'inactivité' : 'session introuvable'}).</p>
      {/if}
      <p><a class="link" href="/exercise/list">Retour à ma liste</a></p>
    </section>
  {:else}
    <header class="join">
      <div class="join-qr" aria-hidden="true">{@html data.qr}</div>
      <div class="join-text">
        <p class="join-how">Rejoindre sur <strong>{data.joinHost}/classe</strong> avec le code</p>
        <p class="join-code">{data.code}</p>
        <p class="join-count">
          <strong>{state.participants}</strong> participant{state.participants > 1 ? 's' : ''}
          <span class="muted">· {state.maxParticipants} places{#if state.connected !== undefined && state.connected < state.participants}&nbsp;· {state.connected} connecté{state.connected > 1 ? 's' : ''}{/if}</span>
        </p>
      </div>
      <div class="join-title">
        <p class="kicker">QCM en direct</p>
        <h1>{state.title}</h1>
        <p class="muted">{state.total} question{state.total > 1 ? 's' : ''}</p>
      </div>
    </header>

    {#if phase === 'lobby' || !question}
      <section class="panel center">
        <p class="lobby">En attente des participants…</p>
        {#if state.participants >= state.maxParticipants}
          <p class="warn">La session est complète : les suivants ne pourront pas entrer.</p>
        {/if}
        <button type="button" class="btn btn--primary btn--big" disabled={busy} on:click={() => command('open')}>
          Lancer la première question
        </button>
      </section>
    {:else}
      <section class="panel question">
        <div class="question-head">
          <p class="progress">
            Question {state.index + 1} / {state.total}
            {#if question.of > 1}<span class="serie">série « {question.title} », partie {question.rank}/{question.of}</span>{/if}
          </p>
          <p class="phase phase--{phase}" role="status">
            {#if phase === 'open'}Réponses ouvertes
            {:else if phase === 'closed'}Réponses closes
            {:else}Correction{/if}
          </p>
        </div>

        {#if question.context_html}
          <div class="context"><MathRenderer content={question.context_html} prerendered /></div>
        {/if}
        <div class="stem"><MathRenderer content={question.stem_html} prerendered /></div>

        <QcmChoices
          choices={question.choices}
          readonly
          {marks}
          counts={showDistribution ? stats?.counts : null}
          total={stats?.answered ?? 0}
          prerendered
        />

        {#if phase === 'revealed' && state.correction?.explanation_html}
          <div class="explanation">
            <p class="explanation-title">Explications</p>
            <MathRenderer content={state.correction.explanation_html} prerendered />
          </div>
        {/if}
      </section>

      <section class="controls" aria-label="Pilotage de la session">
        <div class="meter" role="status">
          <span class="meter-value">{stats?.answered ?? 0} / {state.participants}</span>
          <span class="meter-label">ont répondu</span>
          {#if phase === 'revealed' && stats?.answered}
            <span class="meter-rate">{successRate} % de réussite</span>
          {/if}
        </div>

        <div class="buttons">
          <button type="button" class="btn" disabled={busy || state.index <= 0} on:click={() => command('prev')}>← Précédente</button>
          {#if phase === 'open'}
            <button type="button" class="btn btn--primary" disabled={busy} on:click={() => command('close')}>Clore les réponses</button>
          {:else if phase === 'closed'}
            <button type="button" class="btn" disabled={busy} on:click={() => command('open')}>Rouvrir</button>
            <button type="button" class="btn btn--primary" disabled={busy} on:click={() => command('reveal')}>Afficher la correction</button>
          {:else if !isLast}
            <button type="button" class="btn btn--primary" disabled={busy} on:click={() => command('next')}>Question suivante →</button>
          {/if}
          {#if phase !== 'revealed' && !isLast}
            <button type="button" class="btn" disabled={busy} on:click={() => command('next')}>Passer →</button>
          {/if}
          <button type="button" class="btn btn--danger" class:btn--primary-end={phase === 'revealed' && isLast} disabled={busy} on:click={endSession}>
            Terminer
          </button>
        </div>
        {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
      </section>
    {/if}

    <section class="aside">
      {#if state.outline}
        <nav class="outline" aria-label="Questions de la session">
          {#each state.outline as item, index}
            <button
              type="button"
              class="outline-item"
              class:outline-item--current={index === state.index}
              class:outline-item--done={item.done}
              disabled={busy}
              title="{item.title}{item.of > 1 ? ` (${item.rank}/${item.of})` : ''}"
              on:click={() => command('goto', index)}
            >
              {index + 1}{#if item.done}<span aria-hidden="true"> ✓</span>{/if}
            </button>
          {/each}
        </nav>
      {/if}

      <button type="button" class="link-btn" aria-expanded={showRoster} on:click={() => (showRoster = !showRoster)}>
        {showRoster ? 'Masquer' : 'Afficher'} les participants et leurs scores
      </button>
      {#if showRoster}
        <ul class="roster">
          {#each roster as participant}
            <li class:offline={!participant.online}>
              <span>{participant.name}{#if !participant.online} <span class="muted">(déconnecté)</span>{/if}</span>
              <span class="roster-score">{participant.score}/{state.corrected}</span>
            </li>
          {:else}
            <li class="muted">Personne pour l'instant.</li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if status === 'lost'}
      <p class="offline-banner" role="status">Connexion perdue, nouvelle tentative…</p>
    {/if}
  {/if}
</main>

<style>
  .host {
    max-width: 72rem;
    margin: 0 auto;
    padding: 1rem 1rem 4rem;
    display: grid;
    gap: 1rem;
  }

  .panel {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 1.5rem;
    min-width: 0;
  }

  .center {
    text-align: center;
    padding: 2.5rem 1.5rem;
  }

  h1 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 800;
    color: #111827;
  }

  .muted {
    color: #6b7280;
  }

  .kicker {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-brand-700);
  }

  /* Bandeau « comment rejoindre » : lisible du fond de la salle. */
  .join {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 1rem 1.25rem;
  }

  .join-qr {
    width: 7.5rem;
    height: 7.5rem;
    flex-shrink: 0;
  }

  .join-qr :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .join-text {
    flex: 1;
    min-width: 14rem;
  }

  .join-how {
    margin: 0;
    font-size: 1.05rem;
    color: #374151;
  }

  .join-code {
    margin: 0.1rem 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: clamp(2.25rem, 6vw, 3.5rem);
    font-weight: 800;
    letter-spacing: 0.2em;
    color: #111827;
    line-height: 1.1;
  }

  .join-count {
    margin: 0;
    font-size: 1rem;
    color: #374151;
  }

  .join-title {
    text-align: right;
    min-width: 0;
  }

  .join-title p {
    margin: 0;
  }

  .lobby {
    font-size: 1.25rem;
    color: #374151;
    margin: 0 0 1.25rem;
  }

  .warn {
    color: #b45309;
    font-weight: 600;
  }

  .question-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }

  .progress {
    margin: 0;
    font-weight: 700;
    color: #374151;
  }

  .serie {
    margin-left: 0.5rem;
    font-weight: 500;
    color: #6b7280;
  }

  .phase {
    margin: 0;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .phase--open {
    background: #ecfdf5;
    color: #047857;
  }

  .phase--closed {
    background: #fef3c7;
    color: #92400e;
  }

  .phase--revealed {
    background: #e0e7ff;
    color: #3730a3;
  }

  .context {
    padding: 0.85rem 1rem;
    margin-bottom: 1rem;
    background: var(--color-brand-50);
    border-radius: 0.6rem;
    color: #374151;
    font-size: 1.1rem;
    line-height: 1.6;
    overflow-x: auto;
  }

  .stem {
    font-size: 1.3rem;
    line-height: 1.55;
    color: #111827;
    overflow-x: auto;
    overflow-y: hidden;
    padding-block: 0.2rem;
  }

  .stem :global(img),
  .context :global(img) {
    max-width: 100%;
    height: auto;
  }

  .question :global(.qcm-choice) {
    font-size: 1.15rem;
  }

  .explanation {
    margin-top: 1.25rem;
    padding: 1rem 1.15rem;
    border-left: 4px solid #4ade80;
    background: #f0fdf4;
    border-radius: 0 0.5rem 0.5rem 0;
    color: #374151;
    font-size: 1.05rem;
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

  .controls {
    position: sticky;
    bottom: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 1rem;
    padding: 0.85rem 1.1rem;
    box-shadow: 0 6px 20px rgba(17, 24, 39, 0.08);
  }

  .meter {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .meter-value {
    font-size: 1.75rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    color: #111827;
  }

  .meter-label {
    color: #4b5563;
  }

  .meter-rate {
    margin-left: 0.5rem;
    font-weight: 700;
    color: #15803d;
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.6rem 1.1rem;
    border: 1.5px solid #d1d5db;
    border-radius: 0.6rem;
    background: #fff;
    color: #374151;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
  }

  .btn:hover:not(:disabled) {
    border-color: #9ca3af;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn--primary {
    background: var(--color-brand-600);
    border-color: var(--color-brand-600);
    color: #fff;
  }

  .btn--primary:hover:not(:disabled) {
    background: var(--color-brand-700);
    border-color: var(--color-brand-700);
  }

  .btn--big {
    font-size: 1.15rem;
    padding: 0.9rem 1.75rem;
  }

  .btn--danger {
    color: #b91c1c;
    border-color: #fca5a5;
  }

  .btn--primary-end {
    background: #b91c1c;
    border-color: #b91c1c;
    color: #fff;
  }

  .error {
    width: 100%;
    margin: 0;
    color: #b91c1c;
    font-size: 0.9rem;
  }

  .aside {
    display: grid;
    gap: 0.75rem;
  }

  .outline {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .outline-item {
    min-width: 2.4rem;
    padding: 0.35rem 0.6rem;
    border: 1.5px solid #d1d5db;
    border-radius: 0.5rem;
    background: #fff;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #374151;
    cursor: pointer;
  }

  .outline-item--done {
    background: #f0fdf4;
    border-color: #86efac;
    color: #166534;
  }

  .outline-item--current {
    border-color: var(--color-brand-600);
    box-shadow: 0 0 0 2px rgba(73, 178, 178, 0.3);
  }

  .link-btn {
    justify-self: start;
    background: none;
    border: 0;
    padding: 0;
    color: var(--color-brand-700);
    text-decoration: underline;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .link {
    color: var(--color-brand-700);
    text-decoration: underline;
  }

  .roster {
    list-style: none;
    margin: 0;
    padding: 0.75rem 1rem;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 0.75rem;
    columns: 16rem;
    column-gap: 2rem;
  }

  .roster li {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.2rem 0;
    break-inside: avoid;
  }

  .roster li.offline {
    opacity: 0.6;
  }

  .roster-score {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  .table-wrap {
    margin: 1.25rem 0;
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.9rem;
  }

  th,
  td {
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid #e5e7eb;
    text-align: center;
    white-space: nowrap;
  }

  th[scope='row'],
  thead th:first-child {
    text-align: left;
  }

  .key td,
  .key th {
    background: #f9fafb;
    font-weight: 600;
    color: #4b5563;
  }

  td.ok {
    background: #f0fdf4;
    color: #166534;
    font-weight: 600;
  }

  td.ko {
    background: #fef2f2;
    color: #991b1b;
  }

  td.score {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .offline-banner {
    position: fixed;
    left: 50%;
    top: 1rem;
    transform: translateX(-50%);
    margin: 0;
    padding: 0.5rem 1rem;
    border-radius: 999px;
    background: #111827;
    color: #fff;
    font-size: 0.85rem;
    z-index: 50;
  }

  @media (max-width: 640px) {
    .join-title {
      text-align: left;
      width: 100%;
    }

    .stem {
      font-size: 1.1rem;
    }
  }
</style>
