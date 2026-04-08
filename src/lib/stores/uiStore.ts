import { writable, type Writable } from 'svelte/store';

const PREVIEW_PANEL_KEY = 'search-ui:preview-panel-open';

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
