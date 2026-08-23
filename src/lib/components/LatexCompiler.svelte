<!--
  Compilateur LaTeX réutilisable. Le composant ne connaît pas le moteur : il
  envoie le source et les éventuelles ressources à l'API même origine, qui est
  seule autorisée à joindre le service de compilation configuré.
-->
<script>
  import { onDestroy, onMount } from "svelte";
  import { parseLatexDiagnostics } from "$lib/latex/diagnostics.js";
  import LatexContentOptions from "$lib/components/LatexContentOptions.svelte";

  /** @type {HTMLElement} */
  let editorHost;
  let editor;
  let {
    source,
    assets = [],
    filename = "document.tex",
    endpoint = "/api/latex/compile",
    includeHints = $bindable(true),
    includeSolutions = $bindable(true),
    solutionsAtEnd = $bindable(false),
  } = $props();

  let editableSource = $state(source);
  let previousSource = $state(source);
  let pdfUrl = $state("");
  let compiledSource = $state("");
  let rawLog = $state("");
  let busy = $state(false);
  let requestError = $state("");
  let controller = null;

  $effect(() => {
    if (source !== previousSource) {
      editableSource = source;
      previousSource = source;
      rawLog = "";
      requestError = "";
      replaceEditorSource(source);
    }
  });

  $effect(() => {
    return () => controller?.abort();
  });

  onDestroy(() => {
    controller?.abort();
    editor?.destroy();
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  });

  onMount(() => {
    let cancelled = false;

    async function createEditor() {
      const [stateModule, codemirrorModule, viewModule, latexModule] =
        await Promise.all([
          import("@codemirror/state"),
          import("codemirror"),
          import("@codemirror/view"),
          import("codemirror-lang-latex"),
        ]);

      if (cancelled) return;

      const { EditorState } = stateModule;
      const { EditorView, basicSetup } = codemirrorModule;
      const { keymap } = viewModule;
      const { latex } = latexModule;

      const theme = EditorView.theme({
        "&": {
          height: "36rem",
          border: "1px solid rgb(209 213 219)",
          borderRadius: "0.5rem",
          backgroundColor: "rgb(249 250 251)",
          fontSize: "0.75rem",
        },
        "&.cm-focused": {
          borderColor: "rgb(14 165 233)",
          outline: "1px solid rgb(14 165 233)",
        },
        ".cm-scroller": {
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          lineHeight: "1.625",
        },
        ".cm-content": { padding: "0.75rem" },
        ".cm-gutters": {
          border: "none",
          backgroundColor: "rgb(243 244 246)",
          color: "rgb(107 114 128)",
        },
        ".cm-activeLine": { backgroundColor: "rgb(239 246 255)" },
        ".cm-activeLineGutter": { backgroundColor: "rgb(219 234 254)" },
      });

      editor = new EditorView({
        state: EditorState.create({
          doc: editableSource,
          extensions: [
            basicSetup,
            latex({
              fileName: filename,
              enableLinting: false,
              enableTooltips: true,
              enableAutocomplete: true,
            }),
            EditorView.lineWrapping,
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => {
                  compile();
                  return true;
                },
              },
            ]),
            EditorView.updateListener.of((update) => {
              if (update.docChanged)
                editableSource = update.state.doc.toString();
            }),
            theme,
          ],
        }),
        parent: editorHost,
      });
    }

    createEditor();
    return () => {
      cancelled = true;
    };
  });

  let diagnostics = $derived(parseLatexDiagnostics(rawLog));
  let previewIsStale = $derived(
    Boolean(pdfUrl) && compiledSource !== editableSource,
  );

  function replacePdf(blob) {
    const nextUrl = URL.createObjectURL(blob);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    pdfUrl = nextUrl;
  }

  async function compile() {
    if (!editableSource.trim()) return;

    controller?.abort();
    const currentController = new AbortController();
    controller = currentController;
    busy = true;
    rawLog = "";
    requestError = "";

    const form = new FormData();
    form.append(
      "source",
      new Blob([editableSource], { type: "text/x-tex" }),
      filename,
    );
    for (const asset of assets) form.append("asset", asset, asset.name);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: form,
        signal: currentController.signal,
      });
      if (!response.ok) {
        rawLog = await response.text();
        requestError =
          response.status === 422
            ? "LaTeX a signalé une erreur. Consultez les diagnostics ci-dessous."
            : rawLog ||
              `Le service de compilation a répondu ${response.status}.`;
        return;
      }
      replacePdf(await response.blob());
      compiledSource = editableSource;
    } catch (error) {
      if (error?.name !== "AbortError") {
        requestError =
          "Le service de compilation est indisponible. Réessayez dans un instant.";
      }
    } finally {
      if (controller === currentController) {
        controller = null;
        busy = false;
      }
    }
  }

  function selectLine(line) {
    if (!line || !editor) return;
    const selectedLine = editor.state.doc.line(
      Math.min(line, editor.state.doc.lines),
    );
    editor.focus();
    editor.dispatch({
      selection: { anchor: selectedLine.from, head: selectedLine.to },
      scrollIntoView: true,
    });
  }

  function replaceEditorSource(nextSource) {
    if (!editor || editor.state.doc.toString() === nextSource) return;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: nextSource },
    });
  }

  function downloadPdf() {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = filename.replace(/\.tex$/i, "") + ".pdf";
    link.click();
  }
</script>

<section class="latex-compiler" aria-label="Compilation LaTeX">
  <div class="compiler-source-pane">
    <div class="compiler-toolbar">
      <div>
        <h2>Source LaTeX</h2>
        <p>Modifiez le document si nécessaire, puis lancez la compilation.</p>
      </div>
      <div class="compiler-actions">
        <button
          type="button"
          class="primary"
          disabled={!editableSource.trim()}
          onclick={compile}
        >
          {busy ? "Recompiler" : "Compiler le PDF"}
        </button>
      </div>
    </div>

    <p class="compiler-hint">
      Raccourci : Ctrl/Cmd + Entrée. Le document est envoyé à TeXLive.net.{assets.length
        ? ` ${assets.length} ressource${assets.length > 1 ? "s" : ""} jointe${assets.length > 1 ? "s" : ""}.`
        : ""}
    </p>
    <LatexContentOptions
      bind:includeHints
      bind:includeSolutions
      bind:solutionsAtEnd
      compact
    />
    <div
      bind:this={editorHost}
      class="latex-editor"
      aria-label="Source LaTeX à compiler"
    ></div>

    {#if requestError}
      <p class="compiler-error" role="alert">{requestError}</p>
    {/if}
    {#if diagnostics.length}
      <ul class="diagnostics" aria-label="Diagnostics LaTeX">
        {#each diagnostics as diagnostic}
          <li class:error={diagnostic.severity === "error"}>
            <button
              type="button"
              disabled={!diagnostic.line}
              onclick={() => selectLine(diagnostic.line)}
            >
              {diagnostic.severity === "error"
                ? "Erreur"
                : "Avertissement"}{diagnostic.line
                ? `, ligne ${diagnostic.line}`
                : ""} : {diagnostic.message}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if rawLog}
      <details class="raw-log">
        <summary>Journal LaTeX complet</summary>
        <pre>{rawLog}</pre>
      </details>
    {/if}
  </div>

  <aside class="compiler-pdf-pane" aria-label="Aperçu PDF">
    <div class="compiler-toolbar">
      <div>
        <h2>Aperçu PDF</h2>
        <p>La dernière version compilée reste disponible ici.</p>
      </div>
      {#if pdfUrl}
        <button type="button" class="secondary" onclick={downloadPdf}
          >Télécharger le PDF</button
        >
      {/if}
    </div>
    {#if pdfUrl}
      {#if previewIsStale}
        <p class="stale">
          Le PDF correspond à une version précédente du source.
        </p>
      {/if}
      <iframe title="Aperçu du PDF compilé" src={pdfUrl}></iframe>
    {:else}
      <p class="pdf-empty">Le PDF compilé apparaîtra ici.</p>
    {/if}
  </aside>
</section>

<style>
  .latex-compiler {
    @apply grid grid-cols-1 gap-5 xl:grid-cols-2;
  }
  .compiler-source-pane,
  .compiler-pdf-pane {
    @apply flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4;
  }
  .compiler-toolbar {
    @apply flex items-start justify-between gap-3 flex-wrap;
  }
  h2 {
    @apply text-sm font-semibold text-gray-800;
  }
  .compiler-toolbar p,
  .compiler-hint {
    @apply text-xs text-gray-500;
  }
  .compiler-actions {
    @apply flex gap-2;
  }
  button {
    @apply text-xs font-medium rounded-md px-2.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed;
  }
  .primary {
    @apply bg-brand-600 text-white hover:bg-brand-700;
  }
  .secondary {
    @apply border border-gray-300 text-gray-700 hover:bg-gray-50;
  }
  .latex-editor {
    @apply min-h-[36rem] w-full flex-1;
  }
  .compiler-error {
    @apply rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700;
  }
  .diagnostics {
    @apply space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2;
  }
  .diagnostics li {
    @apply text-xs text-amber-900;
  }
  .diagnostics li.error {
    @apply text-red-800;
  }
  .diagnostics button {
    @apply p-0 text-left underline decoration-dotted enabled:hover:text-brand-700;
  }
  .raw-log {
    @apply text-xs text-gray-600;
  }
  .raw-log pre {
    @apply mt-2 max-h-48 overflow-auto rounded bg-gray-900 p-3 text-gray-100 whitespace-pre-wrap;
  }
  .stale {
    @apply rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800;
  }
  iframe {
    @apply block h-[42rem] w-full flex-1 rounded-lg border border-gray-200 bg-gray-100;
  }
  .pdf-empty {
    @apply py-12 text-center text-sm text-gray-400;
  }
</style>
