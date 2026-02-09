import { writable, type Writable } from 'svelte/store';

const FILTERS_PANEL_KEY = 'search-ui:filters-panel-open';
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

export const filtersPanelOpen = createPersistedBooleanStore(FILTERS_PANEL_KEY, true);
export const previewPanelOpen = createPersistedBooleanStore(PREVIEW_PANEL_KEY, true);

export const uiActions = {
  toggleFiltersPanel() {
    filtersPanelOpen.update((value) => !value);
  },

  setFiltersPanelOpen(value: boolean) {
    filtersPanelOpen.set(Boolean(value));
  },

  togglePreviewPanel() {
    previewPanelOpen.update((value) => !value);
  },

  setPreviewPanelOpen(value: boolean) {
    previewPanelOpen.set(Boolean(value));
  }
};
