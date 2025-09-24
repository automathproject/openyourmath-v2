// src/lib/hooks/useDebounce.js
import { writable } from 'svelte/store';

/**
 * Hook pour débouncer une fonction
 * @param {Function} callback - Fonction à débouncer
 * @param {number} delay - Délai en millisecondes
 * @returns {Function} - Fonction débouncée
 */
export function useDebounce(callback, delay = 300) {
  let timeoutId = null;

  return function debouncedFunction(...args) {
    // Annuler le timeout précédent
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Créer un nouveau timeout
    timeoutId = setTimeout(() => {
      callback.apply(this, args);
    }, delay);
  };
}

/**
 * Hook pour débouncer une valeur réactive
 * @param {any} value - Valeur à débouncer
 * @param {number} delay - Délai en millisecondes
 * @returns {Writable} - Store avec la valeur débouncée
 */
export function useDebouncedValue(initialValue = '', delay = 300) {
  const value = writable(initialValue);
  const debouncedValue = writable(initialValue);
  
  let timeoutId = null;

  // S'abonner aux changements de valeur
  value.subscribe(($value) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      debouncedValue.set($value);
    }, delay);
  });

  return {
    value,           // Valeur immédiate (pour l'input)
    debouncedValue,  // Valeur débouncée (pour la recherche)
    set: value.set,
    update: value.update
  };
}

/**
 * Hook pour débouncer spécifiquement les recherches
 * @param {Function} searchFunction - Fonction de recherche à exécuter
 * @param {number} delay - Délai en millisecondes
 * @returns {Object} - Objet avec les méthodes de recherche
 */
export function useSearchDebounce(searchFunction, delay = 300) {
  let timeoutId = null;
  const isSearching = writable(false);

  function debouncedSearch(query, ...args) {
    // Annuler la recherche précédente
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Si la query est vide, exécuter immédiatement
    if (!query || query.trim() === '') {
      isSearching.set(false);
      searchFunction(query, ...args);
      return;
    }

    // Sinon, débouncer
    isSearching.set(true);
    timeoutId = setTimeout(async () => {
      try {
        await searchFunction(query, ...args);
      } finally {
        isSearching.set(false);
      }
    }, delay);
  }

  function cancelSearch() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      isSearching.set(false);
    }
  }

  function immediateSearch(query, ...args) {
    cancelSearch();
    isSearching.set(true);
    searchFunction(query, ...args).finally(() => {
      isSearching.set(false);
    });
  }

  return {
    debouncedSearch,
    cancelSearch,
    immediateSearch,
    isSearching
  };
}

/**
 * Utilitaire pour créer un debouncer avec état de chargement
 * @param {Function} asyncFunction - Fonction asynchrone à débouncer
 * @param {number} delay - Délai en millisecondes
 * @returns {Object} - Objet avec fonction débouncée et état de chargement
 */
export function createAsyncDebouncer(asyncFunction, delay = 200) {
  let timeoutId = null;
  const loading = writable(false);
  const error = writable(null);

  async function debouncedFunction(...args) {
    // Annuler l'exécution précédente
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    error.set(null);
    loading.set(true);

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await asyncFunction(...args);
          loading.set(false);
          resolve(result);
        } catch (err) {
          loading.set(false);
          error.set(err);
          reject(err);
        }
      }, delay);
    });
  }

  function cancel() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      loading.set(false);
    }
  }

  return {
    execute: debouncedFunction,
    cancel,
    loading,
    error
  };
}