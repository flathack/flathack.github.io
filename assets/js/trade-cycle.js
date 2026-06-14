(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TradeCycle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_CROSSFIRE_CYCLE = {
    anchorDate: '2026-04-07',
    cycleDays: 26,
  };

  function parseIsoDay(dateText) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText || ''));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  function daysBetween(leftText, rightText) {
    const left = parseIsoDay(leftText);
    const right = parseIsoDay(rightText);
    if (!left || !right) return null;
    return Math.round((right.getTime() - left.getTime()) / 86400000);
  }

  function positiveModulo(value, modulo) {
    return ((value % modulo) + modulo) % modulo;
  }

  function cyclePhase(dateText, cycle) {
    const config = cycle || DEFAULT_CROSSFIRE_CYCLE;
    const cycleDays = Number(config.cycleDays || config.cycle_days || 0);
    const anchorDate = config.anchorDate || config.anchor_date || '';
    const delta = daysBetween(anchorDate, dateText);
    if (!anchorDate || !cycleDays || delta == null) return null;
    return positiveModulo(delta, cycleDays) + 1;
  }

  function resolveCycleDataset(requestedDate, datedDatasets, cycle) {
    const config = cycle || DEFAULT_CROSSFIRE_CYCLE;
    const phase = cyclePhase(requestedDate, config);
    if (phase == null) return null;

    const dated = (Array.isArray(datedDatasets) ? datedDatasets : [])
      .filter(item => item && item.id && item.date && parseIsoDay(item.date))
      .map(item => ({
        id: item.id,
        date: item.date,
        label: item.label || item.id,
        phase: cyclePhase(item.date, config),
      }))
      .filter(item => item.phase != null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const exact = dated.find(item => item.date === requestedDate);
    if (exact) {
      return {
        datasetId: exact.id,
        datasetDate: exact.date,
        requestedDate,
        exact: true,
        phase,
      };
    }

    const candidates = dated.filter(item => item.phase === phase);
    if (!candidates.length) return null;
    const previous = candidates.filter(item => item.date <= requestedDate).pop();
    const match = previous || candidates[candidates.length - 1];
    return {
      datasetId: match.id,
      datasetDate: match.date,
      requestedDate,
      exact: false,
      phase,
    };
  }

  return {
    DEFAULT_CROSSFIRE_CYCLE,
    cyclePhase,
    resolveCycleDataset,
  };
});
