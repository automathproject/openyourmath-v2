import { writable, type Writable } from 'svelte/store';

export const immersiveMode = writable(false);

// Clé versionnée : jusqu'ici la valeur `false` était écrite par des chemins qui
// n'étaient pas des choix de l'utilisateur (vider le champ de recherche, fermer
// la prévisualisation sur téléphone). Les préférences enregistrées avant la
// correction ne veulent donc rien dire, et laissaient la colonne repliée pour
// toujours : on repart de la valeur par défaut.
const PREVIEW_PANEL_KEY = 'search-ui:preview-panel-open:v2';

function createPersistedBooleanStore(storageKey: string, defaultValue: boolean): Writable<boolean> {
  const store = writable(defaultValue);

  if (typeof window !== 'undefined') {
    const raw = window.localStorage.getItem(storageKey);
    if (raw !== null) {
      store.set(raw === 'true');
    }

    store.subscribe((value) => {
      window.localStorage.setItem(storageKey, value ? 'true' : 'false');
    });
  }

  return store;
}

export const previewPanelOpen = createPersistedBooleanStore(PREVIEW_PANEL_KEY, true);

export const uiActions = {
  togglePreviewPanel() {
    previewPanelOpen.update((value) => !value);
  },

  setPreviewPanelOpen(value: boolean) {
    previewPanelOpen.set(Boolean(value));
  }
};
