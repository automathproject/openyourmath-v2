// src/routes/classe/+page.server.js
import { occupancy } from '$lib/server/classe/sessions.js';

export function load() {
  const { sessions, limits } = occupancy();
  return {
    full: sessions >= limits.maxSessions,
    maxParticipants: limits.maxParticipants,
    maxQuestions: limits.maxQuestions,
    maxMinutes: limits.maxMinutes,
  };
}
