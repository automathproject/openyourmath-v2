<!-- src/lib/components/qcm/LiveResultsTable.svelte
     Tableau de fin d'une session en direct, pour l'enseignant : une ligne par
     participant (meilleurs scores en tête), une colonne par question, avec
     les réponses justes et la réussite en en-tête. Même contenu que l'export
     CSV (resultsToCsv). -->
<script>
  import { askedCount, lettersOf, participantScore, questionLabel, successRate } from '$lib/qcm/results.js';

  /** Bilan tel que le renvoie sessionResults(). */
  export let results;

  $: asked = askedCount(results);
  $: participants = [...results.participants].sort((a, b) => participantScore(b) - participantScore(a));
</script>

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
          <td>{item.stats.answered ? `${successRate(item.stats.correct, item.stats.answered)} %` : '—'}</td>
        {/each}
        <td></td>
      </tr>
    </thead>
    <tbody>
      {#each participants as participant}
        <tr>
          <th scope="row">{participant.name}</th>
          {#each participant.answers as answer}
            <td class:ok={answer?.correct} class:ko={answer && !answer.correct}>
              {#if answer}{lettersOf(answer.selection) || '∅'}{:else}<span class="muted">—</span>{/if}
            </td>
          {/each}
          <td class="score">{participantScore(participant)}/{asked}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .muted {
    color: #6b7280;
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
</style>
