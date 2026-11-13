// src/lib/qcm/liveClient.js
// Côté navigateur d'une session en direct : flux d'état et commandes.

/**
 * S'abonne à l'état d'une session.
 *
 * @param {string} code
 * @param {{ host?: boolean, onState: (state: object) => void, onEnd: (reason: string, data?: object) => void,
 *   onStatus?: (status: 'connecting' | 'open' | 'lost') => void }} handlers
 * @returns {() => void} fonction de désabonnement
 */
export function subscribe(code, { host = false, onState, onEnd, onStatus = () => {} }) {
  let source = null;
  let closed = false;
  let failures = 0;

  const connect = () => {
    onStatus('connecting');
    source = new EventSource(`/api/classe/${code}/flux${host ? '?role=hote' : ''}`);
    source.addEventListener('open', () => {
      failures = 0;
      onStatus('open');
    });
    source.addEventListener('etat', (event) => onState(JSON.parse(event.data)));
    source.addEventListener('fin', (event) => {
      closed = true;
      source.close();
      const data = JSON.parse(event.data);
      onEnd(data.reason, data);
    });
    source.addEventListener('error', async () => {
      if (closed) return;
      onStatus('lost');
      failures++;
      // EventSource se reconnecte seul tant que le serveur répond ; une session
      // disparue (terminée, serveur redémarré) répond 404 : on arrête.
      if (failures >= 2) {
        try {
          const response = await fetch(`/api/classe/${code}`);
          if (response.status === 404 || response.status === 410) {
            closed = true;
            source.close();
            onEnd('introuvable');
          }
        } catch {
          // hors ligne : EventSource réessaiera
        }
      }
    });
  };

  connect();
  return () => {
    closed = true;
    source?.close();
  };
}

/** Envoie une commande JSON ; lève une erreur portant le message du serveur. */
export async function post(path, body = {}) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Erreur du serveur.');
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}
