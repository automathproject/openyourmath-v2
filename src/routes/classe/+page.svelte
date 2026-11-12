<!-- src/routes/classe/+page.svelte : rejoindre une session de qcm en direct. -->
<script>
  import { goto } from '$app/navigation';

  export let data;

  let code = '';
  let error = '';
  let checking = false;

  const clean = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  async function join() {
    error = '';
    const target = clean(code);
    if (target.length < 6) {
      error = 'Le code comporte six caractères.';
      return;
    }
    checking = true;
    try {
      const response = await fetch(`/api/classe/${target}`);
      if (!response.ok) {
        error = 'Aucune session ouverte avec ce code.';
        return;
      }
      await goto(`/classe/${target}`);
    } catch {
      error = 'Connexion impossible. Vérifiez votre réseau.';
    } finally {
      checking = false;
    }
  }
</script>

<svelte:head>
  <title>QCM en direct - OpenYourMath</title>
  <meta name="description" content="Rejoindre une session de QCM en direct avec le code donné par l'enseignant." />
</svelte:head>

<main class="classe-home">
  <section class="classe-card">
    <h1>QCM en direct</h1>
    <p class="lead">Saisissez le code affiché par votre enseignant.</p>

    <form on:submit|preventDefault={join}>
      <label for="code">Code de la session</label>
      <input
        id="code"
        class="code-input"
        bind:value={code}
        on:input={() => (code = clean(code))}
        inputmode="text"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="6"
        placeholder="ABC234"
        aria-describedby={error ? 'code-error' : undefined}
      />
      {#if error}<p id="code-error" class="error" role="alert">{error}</p>{/if}
      <button type="submit" class="primary" disabled={checking}>{checking ? 'Recherche…' : 'Rejoindre'}</button>
    </form>
    <p class="note">Aucun compte n'est nécessaire : un pseudonyme suffit, et rien n'est conservé après la session.</p>
  </section>

  <section class="classe-teacher">
    <h2>Vous enseignez ?</h2>
    <ol>
      <li>Ajoutez des QCM à <a href="/exercise/list">votre liste</a> depuis la <a href="/?qcm=1">recherche</a> (filtre « QCM »). La liste peut aussi contenir des exercices : seuls les QCM sont joués en direct.</li>
      <li>Depuis la liste, ou depuis la page d'un QCM, choisissez « Session en direct ».</li>
      <li>Projetez l'écran d'animation : la classe rejoint par code ou QR code, vous ouvrez chaque question, voyez qui a répondu, puis affichez la répartition et la correction.</li>
    </ol>
    <p class="note">
      Une session accueille jusqu'à {data.maxParticipants} participants et {data.maxQuestions} questions, et se ferme d'elle-même
      au bout de {Math.round(data.maxMinutes / 60)} h.
      {#if data.full}<strong>Le nombre maximal de sessions simultanées est atteint pour le moment.</strong>{/if}
    </p>
  </section>
</main>

<style>
  .classe-home {
    max-width: 44rem;
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
    display: grid;
    gap: 1.5rem;
  }

  .classe-card,
  .classe-teacher {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    padding: 1.5rem;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 800;
    margin: 0 0 0.25rem;
    color: #111827;
  }

  h2 {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0 0 0.75rem;
    color: #111827;
  }

  .lead {
    margin: 0 0 1.25rem;
    color: #4b5563;
  }

  label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.35rem;
  }

  .code-input {
    width: 100%;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: 0.35em;
    text-align: center;
    text-transform: uppercase;
    padding: 0.6rem 0.5rem;
    border: 2px solid #d1d5db;
    border-radius: 0.75rem;
    color: #111827;
  }

  .code-input:focus {
    outline: none;
    border-color: var(--color-brand-500);
    box-shadow: 0 0 0 3px rgba(73, 178, 178, 0.25);
  }

  .primary {
    margin-top: 1rem;
    width: 100%;
    padding: 0.8rem 1rem;
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
    opacity: 0.6;
  }

  .error {
    margin: 0.5rem 0 0;
    color: #b91c1c;
    font-size: 0.9rem;
  }

  .note {
    margin: 1rem 0 0;
    font-size: 0.85rem;
    color: #6b7280;
    line-height: 1.5;
  }

  ol {
    margin: 0;
    padding-left: 1.25rem;
    list-style: decimal;
    display: grid;
    gap: 0.5rem;
    color: #374151;
    line-height: 1.5;
  }

  a {
    color: var(--color-brand-700);
    text-decoration: underline;
  }
</style>
