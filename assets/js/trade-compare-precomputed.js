(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TradeComparePrecomputed = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const COMPACT_FIELDS = {
    c: 'commodityNick',
    cn: 'commodity',
    cv: 'commodityVolume',
    ss: 'srcSys',
    sn: 'srcSysNick',
    bb: 'buyBase',
    bn: 'buyBaseNick',
    bp: 'buyPrice',
    ds: 'dstSys',
    dn: 'dstSysNick',
    db: 'sellBase',
    dbn: 'sellBaseNick',
    sp: 'sellPrice',
    j: 'jumps',
    p: 'path',
    pn: 'pathNicks',
    t: 'travelTime',
  };

  function compactRoute(route) {
    return {
      c: route.commodityNick || '',
      cn: route.commodity || '',
      cv: Number(route.commodityVolume || 1),
      ss: route.srcSys || '',
      sn: route.srcSysNick || '',
      bb: route.buyBase || '',
      bn: route.buyBaseNick || '',
      bp: Math.round(Number(route.buyPrice || 0)),
      ds: route.dstSys || '',
      dn: route.dstSysNick || '',
      db: route.sellBase || '',
      dbn: route.sellBaseNick || '',
      sp: Math.round(Number(route.sellPrice || 0)),
      j: Math.max(0, Number(route.jumps || 0)),
      p: Array.isArray(route.path) ? route.path.slice() : [],
      pn: Array.isArray(route.pathNicks) ? route.pathNicks.slice() : [],
      t: route.travelTime == null ? null : Math.round(Number(route.travelTime || 0)),
    };
  }

  function hydratePrecomputedRoute(compact, cargo) {
    const route = {};
    for (const [key, name] of Object.entries(COMPACT_FIELDS)) {
      route[name] = compact[key];
    }
    route.commodity = route.commodity || route.commodityNick;
    route.commodityVolume = Math.max(1, Number(route.commodityVolume || 1));
    route.buyBaseNick = compact.bn || '';
    route.sellBaseNick = compact.dbn || '';
    route.buyPrice = Math.round(Number(route.buyPrice || 0));
    route.sellPrice = Math.round(Number(route.sellPrice || 0));
    route.profitPerUnit = route.sellPrice - route.buyPrice;
    route.cargo = Math.max(1, Number(cargo || 1));
    route.cargoUnits = Math.floor(route.cargo / route.commodityVolume);
    route.totalProfit = route.profitPerUnit * route.cargoUnits;
    route.profitPerMin = route.travelTime && route.travelTime > 0
      ? Math.round(route.totalProfit / (route.travelTime / 60))
      : null;
    return route;
  }

  function analyzePrecomputedDatasets(precomputed, selectedDatasets, cargo, options) {
    if (!precomputed || !precomputed.datasets) return null;
    const dsIds = Array.from(selectedDatasets || [])
      .filter(dsId => !!precomputed.datasets[dsId]);
    if (!dsIds.length) return null;
    const maxJumps = options && Number.isFinite(Number(options.maxJumps))
      ? Number(options.maxJumps)
      : Number.POSITIVE_INFINITY;

    const dayStats = [];
    const commodityMap = Object.create(null);

    for (const dsId of dsIds) {
      const ds = precomputed.datasets[dsId];
      if (!ds) continue;
      const routes = (ds.routes || [])
        .map(route => hydratePrecomputedRoute(route, cargo))
        .filter(route => route.profitPerUnit > 0 && route.cargoUnits > 0 && Number(route.jumps || 0) <= maxJumps)
        .sort((a, b) =>
          (b.profitPerMin || 0) - (a.profitPerMin || 0) ||
          b.totalProfit - a.totalProfit ||
          b.profitPerUnit - a.profitPerUnit
        );

      const commBest = Object.create(null);
      for (const route of routes) {
        const nick = route.commodityNick || route.commodity;
        if (!commBest[nick] || (route.profitPerMin || 0) > (commBest[nick].profitPerMin || 0)) {
          commBest[nick] = route;
        }
      }

      for (const [nick, route] of Object.entries(commBest)) {
        if (!commodityMap[nick]) {
          commodityMap[nick] = { name: route.commodity, nick, perDay: [] };
        }
        commodityMap[nick].perDay.push({
          dsId,
          label: ds.label || dsId,
          bestPPM: route.profitPerMin || 0,
          bestMargin: route.profitPerUnit,
          totalProfit: route.totalProfit,
        });
      }

      const validPPM = routes.filter(route => route.profitPerMin > 0);
      const avgPPM = validPPM.length
        ? Math.round(validPPM.reduce((sum, route) => sum + route.profitPerMin, 0) / validPPM.length)
        : 0;

      dayStats.push({
        dsId,
        label: ds.label || dsId,
        date: ds.date || '',
        topRoutes: routes.slice(0, 10),
        bestRoute: routes[0] || null,
        bestPPM: routes[0] ? (routes[0].profitPerMin || 0) : 0,
        avgPPM,
        topRouteCount: validPPM.length,
      });
    }

    dayStats.sort((a, b) => b.bestPPM - a.bestPPM);

    const commodityStats = Object.values(commodityMap).map(item => {
      const ppms = item.perDay.map(day => day.bestPPM);
      const max = Math.max(...ppms);
      const min = Math.min(...ppms);
      const avg = ppms.reduce((sum, ppm) => sum + ppm, 0) / ppms.length;
      const bestEntry = item.perDay.reduce(
        (best, day) => day.bestPPM > best.bestPPM ? day : best,
        item.perDay[0]
      );
      return {
        ...item,
        avgPPM: Math.round(avg),
        maxPPM: max,
        minPPM: min,
        bestDay: bestEntry.label,
        appearances: item.perDay.length,
        volatility: Math.round(max - min),
      };
    }).sort((a, b) => b.avgPPM - a.avgPPM);

    const heatmapData = Object.create(null);
    for (const item of Object.values(commodityMap)) {
      heatmapData[item.nick] = { name: item.name };
      for (const day of item.perDay) {
        heatmapData[item.nick][day.dsId] = { ppm: day.bestPPM, margin: day.bestMargin };
      }
    }

    return { dayStats, commodityStats, heatmapData, dsIds, cargo, precomputed: true };
  }

  function createPrecomputedTradePayload(precomputed) {
    const order = Array.isArray(precomputed && precomputed.datasetOrder)
      ? precomputed.datasetOrder.filter(id => precomputed.datasets && precomputed.datasets[id])
      : Object.keys((precomputed && precomputed.datasets) || {});
    const datasets = Object.create(null);
    for (const id of order) {
      const entry = precomputed.datasets[id] || {};
      datasets[id] = {
        label: entry.label || id,
        date: entry.date || '',
      };
    }
    return {
      id: precomputed && precomputed.modId || '',
      name: precomputed && precomputed.modId === 'crossfire' ? 'Crossfire 2.0' : '',
      default_dataset: order[order.length - 1] || '',
      dataset_order: order,
      datasets,
      precomputedOnly: true,
    };
  }

  return {
    compactRoute,
    createPrecomputedTradePayload,
    hydratePrecomputedRoute,
    analyzePrecomputedDatasets,
  };
});
