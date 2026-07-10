// src/lib/server/albertQuota.js
// Compteur soft par minute des appels Albert. Permet de dégrader gracieusement
// avant d'atteindre les quotas Etalab (journalier non documenté).

// Limites conservatrices — à ajuster selon l'usage réel observé.
const EMBED_SOFT_LIMIT_PER_MIN = 50;
const RERANK_SOFT_LIMIT_PER_MIN = 25;
const CHAT_SOFT_LIMIT_PER_MIN = 15;

let embedCount = 0;
let rerankCount = 0;
let chatCount = 0;
let windowStart = Date.now();

function tick() {
  if (Date.now() - windowStart > 60_000) {
    embedCount = 0;
    rerankCount = 0;
    chatCount = 0;
    windowStart = Date.now();
  }
}

export function trackAlbertEmbed() {
  tick();
  embedCount++;
}
export function trackAlbertRerank() {
  tick();
  rerankCount++;
}
export function trackAlbertChat() {
  tick();
  chatCount++;
}

export function isEmbedThrottled() {
  tick();
  return embedCount >= EMBED_SOFT_LIMIT_PER_MIN;
}
export function isRerankThrottled() {
  tick();
  return rerankCount >= RERANK_SOFT_LIMIT_PER_MIN;
}
export function isChatThrottled() {
  tick();
  return chatCount >= CHAT_SOFT_LIMIT_PER_MIN;
}

export function getQuotaStats() {
  tick();
  return {
    embedCount,
    rerankCount,
    chatCount,
    windowStart,
    embedLimit: EMBED_SOFT_LIMIT_PER_MIN,
    rerankLimit: RERANK_SOFT_LIMIT_PER_MIN,
    chatLimit: CHAT_SOFT_LIMIT_PER_MIN,
  };
}
