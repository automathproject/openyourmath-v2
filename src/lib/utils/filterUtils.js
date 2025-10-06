export function cycleTri(value) {
  if (value === '' || value === undefined || value === null) return '1';
  if (value === '1' || value === true) return '0';
  return '';
}

export function formatDifficultyLabel(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value === 'null') return 'Sans difficulté';
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && numeric > 0) {
    return '★'.repeat(Math.min(numeric, 5));
  }
  return String(value);
}

export function buildOptions(baseList, counts, activeValue, formatLabel, preferCountsOnly = false) {
  const options = [];
  const seen = new Set();

  (baseList || []).forEach((item) => {
    const value = item.value ?? item;
    if (!value && value !== 0) return;
    const key = String(value);
    const hasCounts = counts && Object.prototype.hasOwnProperty.call(counts, key);
    const count = preferCountsOnly
      ? (hasCounts ? counts[key] : 0)
      : (hasCounts ? counts[key] : item.count ?? 0);
    options.push({
      value: key,
      count,
      active: String(activeValue ?? '') === key,
      label: formatLabel ? formatLabel(key) : key
    });
    seen.add(key);
  });

  if (counts) {
    Object.entries(counts).forEach(([key, count]) => {
      if (!key || seen.has(key)) return;
      options.push({
        value: key,
        count,
        active: String(activeValue ?? '') === key,
        label: formatLabel ? formatLabel(key) : key
      });
    });
  }

  options.sort((a, b) => a.value.localeCompare(b.value, 'fr', { sensitivity: 'base' }));
  return options;
}
