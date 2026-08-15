<!--
  ImportDropzone — glisser-déposer d'un PDF, d'une image ou d'un fichier .tex.
  - .tex : chargé directement dans l'éditeur.
  - PDF : pages rendues en images via pdfjs-dist (import dynamique), puis
    restructuration IA (/api/create/import) vers le format .tex du site.
  - Image : réduite (canvas → JPEG) puis même restructuration IA.

  Callback `onimported(texSources, sourceLabel)` avec une ou plusieurs sources
  .tex détectées.
-->

<script>
  /**
   * @typedef {Object} Props
   * @property {(texSources: string[], sourceLabel: string) => void} onimported
   */
  /** @type {Props} */
  let { onimported } = $props();

  const MAX_PDF_PAGES = 4;
  const MAX_DIMENSION = 1600;
  const JPEG_QUALITY = 0.85;

  let dragOver = $state(false);
  let busy = $state(false);
  let statusText = $state('');
  let errorText = $state('');
  let fileInput;

  /** Le séparateur est demandé au modèle entre deux exercices autonomes. */
  function splitExercises(tex) {
    return String(tex || '')
      .split(/\n?%\s*===\s*OYM_EXERCISE_BREAK\s*===\s*%\n?/)
      .map((source) => source.trim())
      .filter(Boolean);
  }

  function reset() {
    busy = false;
    statusText = '';
  }

  /** Rend un canvas en data-URL JPEG, fond blanc, taille bornée. */
  function canvasToDataUrl(source, width, height) {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  }

  async function imageFileToDataUrl(file) {
    const bitmap = await createImageBitmap(file);
    try {
      return canvasToDataUrl(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  }

  async function pdfFileToDataUrls(file) {
    statusText = 'Lecture du PDF…';
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const pages = [];

    for (let i = 1; i <= pageCount; i++) {
      statusText = `Conversion de la page ${i}/${pageCount}…`;
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      pages.push(canvasToDataUrl(canvas, canvas.width, canvas.height));
    }

    if (pdf.numPages > MAX_PDF_PAGES) {
      statusText = `⚠️ PDF de ${pdf.numPages} pages : seules les ${MAX_PDF_PAGES} premières sont importées.`;
    }
    return pages;
  }

  async function restructureWithAi(pages) {
    statusText = 'Restructuration par IA (Albert)… Cela peut prendre une minute.';
    const res = await fetch('/api/create/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Erreur ${res.status}`);
    }
    return data.tex;
  }

  async function handleFile(file) {
    if (!file || busy) return;
    errorText = '';
    busy = true;

    try {
      const name = file.name || 'document';

      if (/\.tex$/i.test(name)) {
        const tex = await file.text();
        onimported?.(splitExercises(tex), name);
        return;
      }

      let pages;
      if (file.type === 'application/pdf' || /\.pdf$/i.test(name)) {
        pages = await pdfFileToDataUrls(file);
      } else if (/^image\/(jpeg|png|webp)$/.test(file.type)) {
        statusText = "Préparation de l'image…";
        pages = [await imageFileToDataUrl(file)];
      } else {
        throw new Error('Format non pris en charge : déposez un PDF, une image (JPEG/PNG/WebP) ou un fichier .tex.');
      }

      const tex = await restructureWithAi(pages);
      onimported?.(splitExercises(tex), name);
    } catch (err) {
      console.error('[import]', err);
      errorText = err.message || "L'import a échoué.";
    } finally {
      reset();
    }
  }

  function onDrop(event) {
    event.preventDefault();
    dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    handleFile(file);
  }

  function onFileChange(event) {
    const file = event.currentTarget.files?.[0];
    handleFile(file);
    event.currentTarget.value = '';
  }
</script>

<div
  class="dropzone"
  class:dropzone--over={dragOver}
  class:dropzone--busy={busy}
  role="button"
  tabindex="0"
  aria-label="Importer un PDF, une image ou un fichier .tex"
  ondragover={(e) => { e.preventDefault(); dragOver = true; }}
  ondragleave={() => (dragOver = false)}
  ondrop={onDrop}
  onclick={() => !busy && fileInput?.click()}
  onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) { e.preventDefault(); fileInput?.click(); } }}
>
  <input
    bind:this={fileInput}
    type="file"
    accept=".pdf,.tex,image/jpeg,image/png,image/webp"
    class="sr-only"
    onchange={onFileChange}
  />

  {#if busy}
    <div class="dropzone-status">
      <span class="dropzone-spinner" aria-hidden="true"></span>
      <span>{statusText}</span>
    </div>
  {:else}
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
    <p class="dropzone-title">Importer un document</p>
    <p class="dropzone-hint">
      Déposez un <strong>PDF</strong> ou une <strong>image</strong> : l'IA le restructure au format
      de la plateforme. Un fichier <strong>.tex</strong> est chargé directement.
    </p>
  {/if}
</div>

{#if errorText}
  <p class="dropzone-error" role="alert">{errorText}</p>
{/if}

<style>
  .dropzone {
    @apply flex flex-col items-center justify-center gap-1 px-4 py-5 rounded-lg cursor-pointer
           border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 text-center
           transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700;
  }

  .dropzone--over {
    @apply border-brand-400 bg-brand-50 text-brand-700;
  }

  .dropzone--busy {
    @apply cursor-wait;
  }

  .dropzone-title {
    @apply text-sm font-semibold m-0;
  }

  .dropzone-hint {
    @apply text-xs m-0 leading-relaxed;
  }

  .dropzone-status {
    @apply flex items-center gap-2 text-sm text-brand-700;
  }

  .dropzone-spinner {
    @apply inline-block w-4 h-4 rounded-full border-2 border-brand-300 border-t-brand-600;
    animation: dropzone-spin 0.8s linear infinite;
  }

  @keyframes dropzone-spin {
    to { transform: rotate(360deg); }
  }

  .dropzone-error {
    @apply text-sm text-red-600 mt-2;
  }
</style>
