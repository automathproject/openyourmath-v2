// src/routes/api/exercises/random/+server.js
import { json } from '@sveltejs/kit';
import { getRandomExercises } from '$lib/db/queries.js';

export async function GET({ url }) {
  try {
    const requested = parseInt(url.searchParams.get('limit') || '12', 10);
    const limit = Number.isFinite(requested) ? requested : 12;
    const exercises = await getRandomExercises(limit);
    return json({ exercises });
  } catch (error) {
    console.error('Random exercises API error:', error);
    return json(
      { error: 'Failed to fetch random exercises', message: error.message },
      { status: 500 }
    );
  }
}
