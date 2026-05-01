// src/hooks.server.js
// Vite charge les variables de .env dans son propre système ($env/static/private)
// mais ne les injecte pas dans process.env pour le code SSR. Les modules $lib/ia/*
// et $lib/db/* lisent process.env (pour fonctionner aussi en scripts Node standalone) —
// on fait le pont ici, une seule fois au démarrage du serveur.
import {
  ALBERT_API_KEY,
  ALBERT_BASE_URL,
  OLLAMA_BASE_URL,
  OLLAMA_CHAT_MODEL,
  OLLAMA_EMBED_MODEL
} from '$env/static/private';

const BRIDGE = { ALBERT_API_KEY, ALBERT_BASE_URL, OLLAMA_BASE_URL, OLLAMA_CHAT_MODEL, OLLAMA_EMBED_MODEL };
for (const [key, value] of Object.entries(BRIDGE)) {
  if (value && !process.env[key]) process.env[key] = value;
}

/** @type {import('@sveltejs/kit').Handle} */
export const handle = ({ event, resolve }) => resolve(event);
