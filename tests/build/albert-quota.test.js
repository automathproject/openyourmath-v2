// tests/build/albert-quota.test.js
// Détection des quotas journaliers d'Albert : inutile de relancer une requête
// rejetée pour quota, et les scripts basculent ou s'arrêtent.

import { describe, it, expect } from 'vitest';

import { isQuotaExceeded } from '../../src/lib/ia/albert.js';

describe('isQuotaExceeded', () => {
  it('reconnaît le quota de requêtes et celui de jetons d\'entrée', () => {
    expect(isQuotaExceeded(new Error('Albert /chat/completions → 429: {"detail":"1000 requests per day exceeded"}'))).toBe(true);
    expect(isQuotaExceeded(new Error('Albert /chat/completions → 429: {"detail":"1280000 input tokens per day exceeded (remaining: 0)."}'))).toBe(true);
  });

  it('laisse passer une saturation passagère', () => {
    expect(isQuotaExceeded(new Error('Albert /chat/completions → 429: {"detail":"10 requests per minute exceeded"}'))).toBe(false);
    expect(isQuotaExceeded(new Error('Albert /chat/completions → 503: Service Unavailable'))).toBe(false);
  });
});
