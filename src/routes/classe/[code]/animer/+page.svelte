<!-- src/routes/classe/[code]/animer/+page.svelte
     Écran de l'enseignant, fait pour être projeté : il montre comment
     rejoindre, la question en cours, combien ont répondu, puis la répartition
     des réponses et la correction. La répartition reste cachée tant que les
     réponses sont ouvertes, pour ne pas orienter la classe. À la fin, le
     bilan donne la réussite par question et permet de revoir chacune avec
     ses réponses justes ; la session reste ouverte jusqu'à « Terminer ». -->
<script>
  import { onDestroy, onMount } from 'svelte';
  import MathRenderer from '$lib/components/MathRenderer.svelte';
  import QcmChoices from '$lib/components/qcm/QcmChoices.svelte';
  import { post, subscribe } from '$lib/qcm/liveClient.js';
  import { askedCount, lettersOf, participantScore, questionLabel, resultsToCsv } from '$lib/qcm/results.js';

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
    if (confirm("Terminer la session ? Les participants ne pourront plus répondre mais gardent leur bilan à l'écran. Le vôtre ne sera plus disponible une fois cette page fermée.")) {
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

  const rateOf = (correct, answered) => (answered > 0 ? Math.round((100 * correct) / answered) : 0);

  $: phase = state.phase;
  $: reviewing = phase === 'review';
  $: overview = reviewing && state.reviewIndex === null;
  $: focus = reviewing ? state.reviewIndex : state.index;
  $: question = state.question;
  $: stats = state.stats;
  $: isLast = state.index >= state.total - 1;
  $: outline = state.outline ?? [];
  $: focusAsked = outline[focus]?.asked !== false;
  // Feuilleter le bilan ne passe que par les questions posées.
  $: askedIndexes = outline.flatMap((item, index) => (item.asked ? [index] : []));
  $: prevAsked = askedIndexes.filter((index) => index < focus).at(-1) ?? null;
  $: nextAsked = askedIndexes.find((index) => index > focus) ?? null;
  $: totals = outline.reduce((sum, item) => ({ answered: sum.answered + (item.answered || 0), correct: sum.correct + (item.correct || 0) }), { answered: 0, correct: 0 });
  $: showDistribution = phase === 'closed' || phase === 'revealed' || (reviewing && focusAsked);
  $: marks = (phase === 'revealed' || reviewing) && question
    ? question.choices.map((_, index) => (state.correction.correct.includes(index) ? 'correct' : ''))
    : null;
  $: successRate = stats ? rateOf(stats.correct, stats.answered) : 0;
  $: roster = [...(state.roster ?? [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'));
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
                  <th scope="col" class:muted={item.asked === false} title="{questionLabel(item, index)}{item.asked === false ? ' (non posée)' : ''}">Q{index + 1}</th>
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
              {#each [...results.participants].sort((a, b) => participantScore(b) - participantScore(a)) as participant}
                <tr>
                  <th scope="row">{participant.name}</th>
                  {#each participant.answers as answer}
                    <td class:ok={answer?.correct} class:ko={answer && !answer.correct}>
                      {#if answer}{lettersOf(answer.selection) || '∅'}{:else}<span class="muted">—</span>{/if}
                    </td>
                  {/each}
                  <td class="score">{participantScore(participant)}/{askedCount(results)}</td>
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

    {#if phase === 'lobby' || (!question && !reviewing)}
      <section class="panel center">
        <p class="lobby">En attente des participants…</p>
        {#if state.participants >= state.maxParticipants}
          <p class="warn">La session est complète : les suivants ne pourront pas entrer.</p>
        {/if}
        <button type="button" class="btn btn--primary btn--big" disabled={busy} on:click={() => command('open')}>
          Lancer la première question
        </button>
      </section>
    {:else if overview}
      <section class="panel">
        <div class="question-head">
          <h2 class="review-title">Bilan de la session</h2>
          <p class="phase phase--review" role="status">Bilan</p>
        </div>
        <p class="muted review-sub">
          {state.asked} question{state.asked > 1 ? 's' : ''} posée{state.asked > 1 ? 's' : ''} sur {state.total}
          · {state.participants} participant{state.participants > 1 ? 's' : ''}.
          Les participants voient sur leur téléphone leurs réponses et les réponses justes.
        </p>
        <ol class="review-list">
          {#each outline as item, index}
            {@const rate = rateOf(item.correct, item.answered)}
            <li>
              <button type="button" class="review-row" class:review-row--skipped={!item.asked} disabled={busy} on:click={() => command('review', index)}>
                <span class="review-num">Q{index + 1}</span>
                <span class="review-label">{item.title}{#if item.of > 1}<span class="muted"> ({item.rank}/{item.of})</span>{/if}</span>
                {#if item.asked}
                  <span class="review-bar" aria-hidden="true"><span style="width: {rate}%" class:low={rate < 50}></span></span>
                  <span class="review-rate">{item.answered ? `${rate} %` : 'aucune réponse'}{#if item.answered}<span class="muted"> · {item.correct}/{item.answered}</span>{/if}</span>
                {:else}
                  <span class="review-bar review-bar--empty" aria-hidden="true"></span>
                  <span class="review-rate muted">non posée</span>
                {/if}
              </button>
            </li>
          {/each}
        </ol>
      </section>

      <section class="controls" aria-label="Pilotage du bilan">
        <div class="meter" role="status">
          <span class="meter-value">{rateOf(totals.correct, totals.answered)} %</span>
          <span class="meter-label">de bonnes réponses</span>
        </div>
        <div class="buttons">
          <button type="button" class="btn" disabled={busy} on:click={() => command('goto', state.index)}>← Reprendre les questions</button>
          <a class="btn" href="/api/classe/{data.code}/resultats?format=csv" download="qcm-{data.code}.csv">Télécharger (CSV)</a>
          <button type="button" class="btn btn--primary" disabled={busy || askedIndexes.length === 0} on:click={() => command('review', askedIndexes[0])}>
            Revoir les questions une à une →
          </button>
          <button type="button" class="btn btn--danger" disabled={busy} on:click={endSession}>Terminer la session</button>
        </div>
        {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
      </section>
    {:else}
      <section class="panel question">
        <div class="question-head">
          <p class="progress">
            {#if reviewing}<span class="kicker-inline">Revue ·</span>{/if}
            Question {focus + 1} / {state.total}
            {#if question.of > 1}<span class="serie">série « {question.title} », partie {question.rank}/{question.of}</span>{/if}
          </p>
          <p class="phase phase--{reviewing ? (focusAsked ? 'revealed' : 'skipped') : phase}" role="status">
            {#if reviewing}{focusAsked ? 'Correction' : 'Non posée'}
            {:else if phase === 'open'}Réponses ouvertes
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

        {#if (phase === 'revealed' || reviewing) && state.correction?.explanation_html}
          <div class="explanation">
            <p class="explanation-title">Explications</p>
            <MathRenderer content={state.correction.explanation_html} prerendered />
          </div>
        {/if}
      </section>

      <section class="controls" aria-label="Pilotage de la session">
        <div class="meter" role="status">
          {#if reviewing && !focusAsked}
            <span class="meter-label">Question non posée à la classe</span>
          {:else}
            <span class="meter-value">{stats?.answered ?? 0} / {state.participants}</span>
            <span class="meter-label">ont répondu</span>
            {#if (phase === 'revealed' || reviewing) && stats?.answered}
              <span class="meter-rate">{successRate} % de réussite</span>
            {/if}
          {/if}
        </div>

        {#if reviewing}
          <div class="buttons">
            <button type="button" class="btn" disabled={busy || prevAsked === null} on:click={() => command('review', prevAsked)}>← Précédente</button>
            <button type="button" class="btn" class:btn--primary={nextAsked === null} disabled={busy} on:click={() => command('review')}>Vue d'ensemble</button>
            {#if nextAsked !== null}
              <button type="button" class="btn btn--primary" disabled={busy} on:click={() => command('review', nextAsked)}>Suivante →</button>
            {/if}
          </div>
        {:else}
        <div class="buttons">
          <button type="button" class="btn" disabled={busy || state.index <= 0} on:click={() => command('prev')}>← Précédente</button>
          {#if phase === 'open'}
            <button type="button" class="btn btn--primary" disabled={busy} on:click={() => command('close')}>Clore les réponses</button>
          {:else if phase === 'closed'}
            <button type="button" class="btn" disabled={busy} on:click={() => command('open')}>Rouvrir</button>
            <button type="button" class="btn btn--primary" disabled={busy} on:click={() => command('reveal')}>Afficher la correction</button>
          {:else if !isLast}
            <button type="button" class="btn btn--primary" disabled={busy} on:click={() => command('next')}>Question suivante →</button>
          {:else}
            <button type="button" class="btn btn--primary" disabled={busy} on:click={() => command('review')}>Voir le bilan →</button>
          {/if}
          {#if phase !== 'revealed' && !isLast}
            <button type="button" class="btn" disabled={busy} on:click={() => command('next')}>Passer →</button>
          {/if}
          <button type="button" class="btn btn--danger" disabled={busy} on:click={endSession}>Terminer</button>
        </div>
        {/if}
        {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
      </section>
    {/if}

    <section class="aside">
      {#if state.outline && phase !== 'lobby'}
        <nav class="outline" aria-label="Questions de la session">
          {#each outline as item, index}
            <button
              type="button"
              class="outline-item"
              class:outline-item--current={index === focus}
              class:outline-item--done={item.done}
              disabled={busy}
              title="{item.title}{item.of > 1 ? ` (${item.rank}/${item.of})` : ''}"
              on:click={() => command(reviewing ? 'review' : 'goto', index)}
            >
              {index + 1}{#if item.done}<span aria-hidden="true"> ✓</span>{/if}
            </button>
          {/each}
          <button
            type="button"
            class="outline-item outline-item--bilan"
            class:outline-item--current={overview}
            disabled={busy || !state.asked}
            on:click={() => command('review')}
          >
            Bilan
          </button>
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

  a.btn {
    text-decoration: none;
    display: inline-block;
  }

  .phase--review {
    background: #e0e7ff;
    color: #3730a3;
  }

  .phase--skipped {
    background: #f3f4f6;
    color: #4b5563;
  }

  .kicker-inline {
    color: var(--color-brand-700);
    margin-right: 0.25rem;
  }

  .review-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 800;
    color: #111827;
  }

  .review-sub {
    margin: -0.5rem 0 1rem;
  }

  .review-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }

  .review-row {
    width: 100%;
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr) minmax(6rem, 14rem) 9rem;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.6rem;
    background: #fff;
    text-align: left;
    font-size: 1rem;
    color: #111827;
    cursor: pointer;
  }

  .review-row:hover:not(:disabled) {
    border-color: var(--color-brand-500);
    background: var(--color-brand-50);
  }

  .review-row--skipped {
    color: #6b7280;
  }

  .review-num {
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .review-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .review-bar {
    height: 0.6rem;
    border-radius: 999px;
    background: #f3f4f6;
    overflow: hidden;
  }

  .review-bar span {
    display: block;
    height: 100%;
    background: #22c55e;
  }

  .review-bar span.low {
    background: #f59e0b;
  }

  .review-bar--empty {
    background: repeating-linear-gradient(45deg, #f3f4f6 0 6px, #fff 6px 12px);
  }

  .review-rate {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .outline-item--bilan {
    font-weight: 700;
    color: var(--color-brand-700);
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

    .review-row {
      grid-template-columns: 2.5rem minmax(0, 1fr) auto;
    }

    .review-bar {
      display: none;
    }
  }
</style>
