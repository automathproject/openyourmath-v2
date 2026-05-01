// src/lib/server/rateLimiter.js
// Sliding-window in-memory rate limiter. Suffisant pour une instance Docker unique.

/** @type {Map<string, number[]>} ip → timestamps (ms) dans la fenêtre */
const windows = new Map();

/**
 * Vérifie et enregistre une requête pour une IP donnée.
 * @param {string} ip
 * @param {number} limit  nombre max de requêtes dans la fenêtre
 * @param {number} [windowMs=60000]
 * @returns {{ allowed: boolean, retryAfter?: number }}
 */
export function checkRateLimit(ip, limit, windowMs = 60_000) {
  const now = Date.now();
  const prev = (windows.get(ip) ?? []).filter(t => now - t < windowMs);
  if (prev.length >= limit) {
    return { allowed: false, retryAfter: Math.ceil((prev[0] + windowMs - now) / 1000) };
  }
  prev.push(now);
  windows.set(ip, prev);
  return { allowed: true };
}

// Nettoyage toutes les 5 min pour éviter la fuite mémoire sur IPs uniques (bots, crawlers).
const gc = setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [ip, ts] of windows) {
    if (!ts.some(t => t > cutoff)) windows.delete(ip);
  }
}, 300_000);
gc.unref?.(); // ne pas bloquer le shutdown Node.js
