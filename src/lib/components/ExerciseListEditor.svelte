<!-- src/lib/components/ExerciseListEditor.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  import MathRenderer from './MathRenderer.svelte';

  export let exercises = [];
  export let selectedIndex = 0;
  export let isEditMode = false;

  const dispatch = createEventDispatcher();

  let draggedIndex = null;
  let insertIndex = null; // index de drop entre 0 et exercises.length
  let selectedForDeletion = new Set();
  let isDragging = false;
  let container; // ref vers le scroll container
  let dragGhostEl = null;

  // ---------------- Helpers (drag ghost) ----------------
  function makeDragGhost(text) {
    const el = document.createElement('div');
    el.textContent = text || 'Déplacer';
    el.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      padding: 6px 10px;
      font: 500 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: rgba(17,24,39,.96);
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,.25);
      pointer-events: none;
      z-index: 9999;
    `;
    document.body.appendChild(el);
    dragGhostEl = el;
    return el;
  }

  function cleanupDragGhost() {
    if (dragGhostEl) {
      dragGhostEl.remove();
      dragGhostEl = null;
    }
  }

  // ---------------- Drag & drop ----------------
  function handleDragStart(event, index) {
    draggedIndex = index;
    isDragging = true;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));

    const label =
      exercises[index]?.title ||
      `Exercice ${exercises[index]?.uuid?.slice(0, 8) || ''}`;
    const ghost = makeDragGhost(label);
    event.dataTransfer.setDragImage(ghost, 0, 0);
  }

  function handleDragEnd() {
    draggedIndex = null;
    insertIndex = null;
    isDragging = false;
    cleanupDragGhost();
  }

  // Auto-scroll + snap top/bottom
  function handleContainerDragOver(e) {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const margin = 40;
    const speed = 16;

    if (e.clientY < rect.top + margin) {
      container.scrollTop -= speed;
    } else if (e.clientY > rect.bottom - margin) {
      container.scrollTop += speed;
    }

    if (draggedIndex !== null) {
      if (e.clientY < rect.top + margin * 0.6) {
        insertIndex = 0; // snap top
      } else if (e.clientY > rect.bottom - margin * 0.6) {
        insertIndex = exercises.length; // snap bottom
      }
    }
  }

  // Drop-slot avant l'élément d'index i (i ∈ [0..exercises.length])
  function handleSlotDragOver(event, slotIndex) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    insertIndex = slotIndex;
  }

  function handleDropOnSlot(event, slotIndex) {
    event.preventDefault();
    if (draggedIndex === null || insertIndex === null) return;

    let finalIndex = insertIndex;
    if (draggedIndex < insertIndex) {
      finalIndex = insertIndex - 1;
    }

    const newExercises = [...exercises];
    const [draggedItem] = newExercises.splice(draggedIndex, 1);
    newExercises.splice(finalIndex, 0, draggedItem);

    let newSelectedIndex = selectedIndex;
    if (selectedIndex === draggedIndex) {
      newSelectedIndex = finalIndex;
    } else if (draggedIndex < selectedIndex && finalIndex >= selectedIndex) {
      newSelectedIndex = selectedIndex - 1;
    } else if (draggedIndex > selectedIndex && finalIndex <= selectedIndex) {
      newSelectedIndex = selectedIndex + 1;
    }

    dispatch('reorder', { exercises: newExercises, newSelectedIndex });
    insertIndex = null;
  }

  // ---------------- Sélection pour suppression ----------------
  function toggleSelection(index) {
    if (selectedForDeletion.has(index)) selectedForDeletion.delete(index);
    else selectedForDeletion.add(index);
    selectedForDeletion = new Set(selectedForDeletion); // trigger reactivity
  }

  function selectAll() {
    selectedForDeletion = new Set(exercises.map((_, i) => i));
  }

  function clearSelection() {
    selectedForDeletion = new Set();
  }

  function deleteSelected() {
    if (selectedForDeletion.size === 0) return;
    const sortedIndices = Array.from(selectedForDeletion).sort((a, b) => b - a);
    dispatch('deleteMultiple', { indices: sortedIndices });
    clearSelection();
  }

  // ---------------- Boutons ↑↓ (fallback) ----------------
  function moveUp(index) {
    if (index === 0) return;
    const newExercises = [...exercises];
    [newExercises[index - 1], newExercises[index]] = [
      newExercises[index],
      newExercises[index - 1]
    ];
    const newSelectedIndex =
      selectedIndex === index
        ? index - 1
        : selectedIndex === index - 1
        ? index
        : selectedIndex;
    dispatch('reorder', { exercises: newExercises, newSelectedIndex });
  }

  function moveDown(index) {
    if (index === exercises.length - 1) return;
    const newExercises = [...exercises];
    [newExercises[index], newExercises[index + 1]] = [
      newExercises[index + 1],
      newExercises[index]
    ];
    const newSelectedIndex =
      selectedIndex === index
        ? index + 1
        : selectedIndex === index + 1
        ? index
        : selectedIndex;
    dispatch('reorder', { exercises: newExercises, newSelectedIndex });
  }

  // ---------------- Sélection simple ----------------
  function selectExercise(index) {
    dispatch('select', { index });
  }

  function removeExercise(index) {
    dispatch('remove', { index });
  }
</script>

<div class="exercise-list-editor" class:edit-mode={isEditMode}>
  {#if isEditMode}
    <div class="edit-header">
      <h3 class="edit-title">Mode édition</h3>
      <div class="edit-actions">
        <button
          class="edit-btn edit-btn--select-all"
          on:click={selectAll}
          disabled={exercises.length === 0}
        >
          Tout sélectionner
        </button>
        <button
          class="edit-btn edit-btn--clear"
          on:click={clearSelection}
          disabled={selectedForDeletion.size === 0}
        >
          Désélectionner
        </button>
        <button
          class="edit-btn edit-btn--delete"
          on:click={deleteSelected}
          disabled={selectedForDeletion.size === 0}
        >
          Supprimer ({selectedForDeletion.size})
        </button>
      </div>
    </div>
    <div class="edit-help">Glissez-déposez entre les lignes vertes, ou utilisez ↑↓</div>
  {/if}

  <div
    class="exercise-items"
    bind:this={container}
    class:dragging={isDragging}
    on:dragover={handleContainerDragOver}
    role="list"
  >
    {#if isEditMode}
      <div
        class="drop-slot drop-slot--head"
        class:drop-slot--active={insertIndex === 0 && draggedIndex !== null}
        on:dragenter={(e) => handleSlotDragOver(e, 0)}
        on:dragover={(e) => handleSlotDragOver(e, 0)}
        on:drop={(e) => handleDropOnSlot(e, 0)}
        role="region"
        aria-label="Zone de dépôt avant le premier exercice"
      >
        <span>Déposer ici</span>
      </div>
    {/if}

    {#each exercises as exercise, index}
      <div
        class="exercise-item"
        class:exercise-item--selected={index === selectedIndex}
        class:exercise-item--edit={isEditMode}
        class:exercise-item--dragging={draggedIndex === index}
        class:exercise-item--selected-for-deletion={selectedForDeletion.has(index)}
        class:exercise-item--error={exercise.error}
        draggable={isEditMode}
        on:dragstart={(e) => handleDragStart(e, index)}
        on:dragend={handleDragEnd}
        role="listitem"
      >
        {#if isEditMode}
          <div class="exercise-checkbox">
            <input
              type="checkbox"
              checked={selectedForDeletion.has(index)}
              on:change={() => toggleSelection(index)}
              id={"checkbox-" + index}
            />
            <label for={"checkbox-" + index} class="sr-only">
              Sélectionner l'exercice {exercise.title}
            </label>
          </div>
        {/if}

        <button
          class="exercise-content"
          on:click={() => selectExercise(index)}
          disabled={isEditMode}
        >
          <div class="exercise-number">{index + 1}</div>

          <div class="exercise-info">
            <h4 class="exercise-title">
              <MathRenderer
                content={exercise.title || `Exercice ${exercise.uuid?.slice(0, 8) ?? ''}...`}
                inline={true}
              />
            </h4>

            <div class="exercise-meta">
              {#if exercise.chapter}
                <span class="exercise-chapter">{exercise.chapter}</span>
              {/if}

              {#if exercise.difficulty}
                <div class="exercise-difficulty">
                  {#each Array(exercise.difficulty) as _}
                    <div class="difficulty-dot difficulty-dot--filled"></div>
                  {/each}
                  {#each Array(5 - exercise.difficulty) as _}
                    <div class="difficulty-dot"></div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </button>

        {#if isEditMode}
          <div class="exercise-actions">
            <button
              class="action-btn action-btn--move"
              on:click={() => moveUp(index)}
              disabled={index === 0}
              title="Déplacer vers le haut"
            >
              ▲
            </button>

            <button
              class="action-btn action-btn--move"
              on:click={() => moveDown(index)}
              disabled={index === exercises.length - 1}
              title="Déplacer vers le bas"
            >
              ▼
            </button>

            <div class="drag-handle" title="Glisser pour réorganiser">⋮⋮</div>
          </div>
        {/if}
      </div>
        <div
          class="drop-slot"
          class:drop-slot--active={insertIndex === index + 1 && draggedIndex !== null}
          on:dragenter={(e) => handleSlotDragOver(e, index + 1)}
          on:dragover={(e) => handleSlotDragOver(e, index + 1)}
          on:drop={(e) => handleDropOnSlot(e, index + 1)}
          role="region"
          aria-label="Zone de dépôt après l'exercice {index + 1}"
        >
          <span>Déposer ici</span>
        </div>
    {/each}
  </div>
</div>

<style>
  .exercise-list-editor { 
    height: 100%; 
    display: flex; 
    flex-direction: column; 
  }

  .edit-mode { 
    background: rgb(254 249 195); 
    border-radius: 0.5rem; 
    padding: 0.5rem; 
  }

  .edit-header { 
    display:flex; 
    justify-content:space-between; 
    align-items:center; 
    margin-bottom:.5rem; 
    padding-bottom:.5rem; 
    border-bottom:1px solid rgb(229 231 235); 
  }

  .edit-title { 
    font-size:.875rem; 
    font-weight:600; 
    color: rgb(133 77 14); 
    margin:0; 
  }

  .edit-actions { 
    display:flex; 
    gap:.25rem; 
  }

  .edit-btn { 
    padding:.25rem .5rem; 
    font-size:.75rem; 
    border:1px solid transparent; 
    border-radius:.25rem; 
    cursor:pointer; 
    transition:all .15s; 
  }

  .edit-btn--select-all { 
    background: rgb(219 234 254); 
    color: rgb(37 99 235); 
  }

  .edit-btn--clear { 
    background: rgb(229 231 235); 
    color: rgb(75 85 99); 
  }

  .edit-btn--delete { 
    background: rgb(254 226 226); 
    color: rgb(220 38 38); 
  }

  .edit-btn:hover:not(:disabled) { 
    transform: translateY(-1px); 
    box-shadow: 0 2px 4px rgb(0 0 0 / 0.1); 
  }

  .edit-btn:disabled { 
    opacity:.5; 
    cursor:not-allowed; 
  }

  .edit-help { 
    font-size:.75rem; 
    color: rgb(120 113 108); 
    margin:.5rem 0 .75rem; 
    text-align:center; 
    font-style:italic; 
  }

  .exercise-items { 
    flex:1; 
    overflow-y:auto; 
    display:flex; 
    flex-direction:column; 
    gap:.25rem; 
    padding: .125rem 0; 
  }

  /* ==== Mode non-édition : aucun sur-espacement ==== */
  .exercise-list-editor:not(.edit-mode) .exercise-items {
    gap: 0;
    padding: 0;
  }
  .exercise-list-editor:not(.edit-mode) .drop-slot {
    display: none !important;
    height: 0;
    margin: 0;
    opacity: 0;
    pointer-events: none;
  }

  /* --- DROP SLOTS (grandes zones entre items) --- */
  .drop-slot {
    position: relative;
    height: 22px;
    margin: 2px 0;
    border-radius: 6px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity .12s ease, transform .12s ease;
    pointer-events: none; /* activé pendant le drag via .exercise-items.dragging */
  }

  /* Pendant un drag: activer toutes les drop-slots + légère visibilité */
  .exercise-items.dragging .drop-slot {
    pointer-events: auto;
    opacity: .18;
  }

  /* Head slot (avant le 1er item) interactive pendant le drag */
  .exercise-items.dragging .drop-slot--head {
    pointer-events: auto;
  }

  /* Ligne de base (fine) */
  .drop-slot::before {
    content: '';
    position: absolute;
    left: 6px; 
    right: 6px;
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(
      90deg, 
      transparent 0%, 
      rgba(34,197,94,.8) 12%, 
      rgba(34,197,94,.8) 88%, 
      transparent 100%
    );
    box-shadow: 0 0 6px rgba(34,197,94,.25);
    transition: height .12s ease, box-shadow .12s ease, filter .12s ease;
  }

  /* Pastille "Déposer ici" (muette tant que non active) */
  .drop-slot span {
    position: relative;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: .7rem;
    font-weight: 600;
    color: white;
    background: rgb(34 197 94);
    box-shadow: 0 2px 8px rgba(0,0,0,.2);
    opacity: 0;
    transform: translateY(-2px) scale(.96);
    transition: opacity .12s ease, transform .12s ease;
    pointer-events: none; /* ne bloque pas dragover */
  }

  /* État HOVER (plus visible) */
  .drop-slot:hover { 
    opacity: .95; 
    transform: scaleY(1.02); 
  }

  /* État ACTIF = cible courante (très visible + pulse) */
  .drop-slot.drop-slot--active { 
    opacity: 1; 
  }
  .drop-slot.drop-slot--active::before {
    height: 8px;
    box-shadow:
      0 0 18px rgba(34,197,94,.55),
      0 0 2px rgba(34,197,94,.9) inset;
    animation: slotGlow 1.2s ease-in-out infinite;
    filter: saturate(1.2);
  }
  .drop-slot.drop-slot--active span {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  @keyframes slotGlow {
    0%, 100% { box-shadow: 0 0 14px rgba(34,197,94,.45), 0 0 2px rgba(34,197,94,.9) inset; }
    50%      { box-shadow: 0 0 22px rgba(34,197,94,.7),  0 0 3px rgba(34,197,94,1) inset; }
  }

  /* --- ITEMS --- */
  .exercise-item {
    display:flex; 
    align-items:center; 
    gap:.5rem;
    padding:.75rem; 
    background:white;
    border:1px solid rgb(229 231 235);
    border-radius:.5rem; 
    transition:all .15s ease; 
    position:relative;
  }

  .exercise-item--selected { 
    border-color: rgb(59 130 246); 
    background: rgb(239 246 255); 
  }

  .exercise-item--edit { 
    cursor: grab; 
  }

  .exercise-item--edit:active { 
    cursor: grabbing; 
  }

  .exercise-item--dragging { 
    opacity: .6; 
    transform: scale(.99); 
    box-shadow: 0 8px 24px rgba(0,0,0,.12); 
  }

  .exercise-item--selected-for-deletion { 
    border-color: rgb(239 68 68); 
    background: rgb(254 242 242); 
  }

  .exercise-item--error { 
    border-color: rgb(249 115 22); 
    background: rgb(255 247 237); 
  }

  .exercise-checkbox { 
    flex-shrink: 0; 
  }

  .exercise-checkbox input { 
    width: 1rem; 
    height: 1rem; 
    cursor: pointer; 
  }

  .exercise-content { 
    flex:1; 
    display:flex; 
    align-items:center; 
    gap:.75rem; 
    padding:0; 
    border:none; 
    background:transparent; 
    cursor:pointer; 
    text-align:left; 
    width: 100%; /* ne jamais élargir la carte */
  }

  .exercise-content:disabled { 
    cursor: default; 
  }

  .exercise-number {
    width:2rem; 
    height:2rem; 
    border-radius:50%;
    background: rgb(243 244 246); 
    color: rgb(75 85 99);
    display:flex; 
    align-items:center; 
    justify-content:center;
    font-weight:600; 
    font-size:.875rem; 
    flex-shrink:0;
  }

  .exercise-item--selected .exercise-number { 
    background: rgb(59 130 246); 
    color: white; 
  }

  .exercise-info { 
    flex:1 1 auto; 
    min-width:0; 
    overflow:hidden; /* clippe les titres trop longs */
  }

  .exercise-title { 
    font-size:.875rem; 
    font-weight:500; 
    color: rgb(17 24 39); 
    margin:0 0 .25rem 0; 
    overflow:hidden; 
    text-overflow:ellipsis; 
    white-space:nowrap; 
    display:block; 
    max-width:100%;
  }

  .exercise-meta { 
    display:flex; 
    align-items:center; 
    gap:.5rem; 
  }

  .exercise-chapter { 
    font-size:.75rem; 
    color: rgb(107 114 128); 
    overflow:hidden; 
    text-overflow:ellipsis; 
    white-space:nowrap; 
  }

  .exercise-difficulty { 
    display:flex; 
    gap:1px; 
  }

  .difficulty-dot { 
    width:.25rem; 
    height:.25rem; 
    border-radius:50%; 
    background: rgb(209 213 219); 
  }

  .difficulty-dot--filled { 
    background: rgb(245 158 11); 
  }

  .exercise-actions { 
    display:flex; 
    align-items:center; 
    gap:.25rem; 
    flex-shrink:0; 
  }

  .action-btn { 
    width:1.5rem; 
    height:1.5rem; 
    border:none; 
    border-radius:.25rem; 
    background: rgb(243 244 246); 
    color: rgb(75 85 99); 
    cursor:pointer; 
    display:flex; 
    align-items:center; 
    justify-content:center; 
    transition:all .15s; 
  }

  .action-btn:hover:not(:disabled) { 
    background: rgb(229 231 235); 
  }

  .action-btn:disabled { 
    opacity:.4; 
    cursor:not-allowed; 
  }

  .drag-handle { 
    width:1.5rem; 
    height:1.5rem; 
    display:flex; 
    align-items:center; 
    justify-content:center; 
    color: rgb(156 163 175); 
    cursor: grab; 
  }

  .drag-handle:active { 
    cursor: grabbing; 
  }

  .sr-only { 
    position:absolute; 
    width:1px; 
    height:1px; 
    padding:0; 
    margin:-1px; 
    overflow:hidden; 
    clip:rect(0,0,0,0); 
    white-space:nowrap; 
    border:0; 
  }

  /* Empêche le double cadre bleu au clic souris,
   mais conserve un focus clair au clavier */
.exercise-content {
  outline: none;
  -webkit-tap-highlight-color: transparent; /* mobile */
}

/* Pas d’anneau quand le focus n’est pas "visible" (clic souris) */
.exercise-content:focus:not(:focus-visible) {
  outline: none;
  box-shadow: none;
}

/* Focus visible (tab clavier) : anneau propre et discret */
.exercise-content:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
  border-radius: .5rem;
}

/* Optionnel : si l’item est déjà sélectionné, adoucir encore le focus clavier */
.exercise-item--selected .exercise-content:focus-visible {
  box-shadow:
    0 0 0 2px rgba(59,130,246,.25),
    0 0 0 6px rgba(59,130,246,.12);
border-radius: .5rem;
}

/* Optionnel : si l’item est déjà sélectionné, adoucir encore le focus clavier */
.exercise-item--selected .exercise-content:focus-visible {
  box-shadow:
    0 0 0 2px rgba(59,130,246,.25),
    0 0 0 6px rgba(59,130,246,.12);
}

/* Ne pas clipper les éléments "au-dessus" */
.edit-mode { position: relative; overflow: visible; }

/* Contexte d’empilement propre pour la liste */
.exercise-items { position: relative; isolation: isolate; }

/* Assurer l’empilement des éléments du slot */
.drop-slot { position: relative; z-index: 0; }
.drop-slot::before { z-index: 1; }
.drop-slot span { position: relative; z-index: 2; }

/* Mettre le slot actif au-dessus des cards et du fond jaune */
.drop-slot.drop-slot--active { z-index: 10; }

/* Détacher visuellement la pastille du fond jaune (anneau blanc) */
.drop-slot.drop-slot--active span {
  box-shadow:
    0 0 0 3px #fff,                 /* anneau blanc anti-camouflage */
    0 2px 8px rgba(0,0,0,.25),
    0 0 14px rgba(34,197,94,.45);
}


</style>
