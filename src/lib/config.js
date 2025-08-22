// src/lib/config.js
import path from 'path';

export const config = {
  db: {
    path: path.resolve('data/exercises.sqlite'),
    options: { readonly: true }
  },
  api: {
    maxLimit: 100,
    defaultLimit: 20
  }
};