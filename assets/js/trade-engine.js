/**
 * TradeEngine – client-side Freelancer trade route calculator.
 * Operates on pre-exported JSON data (systems, bases, commodities, markets, adjacency).
 */
class TradeEngine {
  constructor(data) {
    this.data = data;
    this._pathCache = new Map();
  }

  /* ── BFS shortest path ──────────────────────────────────── */

  findPath(src, dst) {
    if (!src || !dst) return [];
    if (src === dst) return [src];
    const key = src + '|' + dst;
    if (this._pathCache.has(key)) return this._pathCache.get(key);

    const adj = this.data.adjacency;
    const queue = [src];
    const prev = Object.create(null);
    prev[src] = '';
    let head = 0;

    while (head < queue.length) {
      const cur = queue[head++];
      const neighbors = adj[cur];
      if (!neighbors) continue;
      for (const next of neighbors) {
        if (next in prev) continue;
        prev[next] = cur;
        if (next === dst) {
          const path = [];
          let n = dst;
          while (n !== '') { path.push(n); n = prev[n]; }
          path.reverse();
          this._pathCache.set(key, path);
          return path;
        }
        queue.push(next);
      }
    }
    this._pathCache.set(key, []);
    return [];
  }

  /* ── Candidate route generation ─────────────────────────── */

  candidateRoutes(cargoCapacity, maxJumps) {
    const routes = [];
    const { markets, commodities, bases, systems } = this.data;

    for (const commodity in markets) {
      const commInfo = commodities[commodity];
      if (!commInfo || commInfo.price <= 0) continue;

      const rawEntries = markets[commodity];
      const accessible = rawEntries.filter(e => !e.base.includes('_miner'));

      let sources = accessible.filter(e => e.src);
      if (!sources.length) sources = accessible.slice();
      const explicitSinks = accessible.filter(e => !e.src);

      const explicitBases = new Set(rawEntries.map(e => e.base));

      if (!sources.length) continue;

      for (const source of sources) {
        // Explicit sinks
        for (const sink of explicitSinks) {
          this._tryAdd(routes, source, sink, commInfo, cargoCapacity, maxJumps);
        }
        // Implicit base-price sinks (every base not listed explicitly)
        const basePrice = commInfo.price;
        for (const baseNick in bases) {
          if (explicitBases.has(baseNick) || baseNick.includes('_miner')) continue;
          this._tryAdd(routes, source,
            { base: baseNick, sys: bases[baseNick].sys, price: basePrice, src: false },
            commInfo, cargoCapacity, maxJumps);
        }
      }
    }
    return routes;
  }

  _tryAdd(routes, source, sink, commInfo, cargo, maxJumps) {
    if (source.base === sink.base) return;
    const ppu = Math.round(sink.price - source.price);
    if (ppu <= 0) return;

    const ss = source.sys, ds = sink.sys;
    let path, jumps;
    if (ss === ds) {
      path = [ss]; jumps = 0;
    } else {
      path = this.findPath(ss, ds);
      if (!path.length) return;
      jumps = path.length - 1;
    }
    if (jumps > maxJumps) return;

    const sys = this.data.systems, bases = this.data.bases;
    routes.push({
      srcSysNick: ss,
      srcSys: sys[ss] || ss,
      buyBaseNick: source.base,
      buyBase: (bases[source.base] && bases[source.base].name) || source.base,
      dstSysNick: ds,
      dstSys: sys[ds] || ds,
      sellBaseNick: sink.base,
      sellBase: (bases[sink.base] && bases[sink.base].name) || sink.base,
      commodity: commInfo.name,
      buyPrice: Math.round(source.price),
      sellPrice: Math.round(sink.price),
      profitPerUnit: ppu,
      cargo: cargo,
      totalProfit: ppu * cargo,
      jumps: jumps,
      path: path.map(s => sys[s] || s),
      pathNicks: path.slice(),
    });
  }

  /* ── Public API ─────────────────────────────────────────── */

  bestRoutesBySystem(cargoCapacity, maxJumps) {
    const candidates = this.candidateRoutes(cargoCapacity, maxJumps);
    const best = Object.create(null);
    for (const r of candidates) {
      const cur = best[r.srcSysNick];
      if (!cur || r.totalProfit > cur.totalProfit) best[r.srcSysNick] = r;
    }
    return Object.values(best).sort((a, b) =>
      b.totalProfit - a.totalProfit || b.profitPerUnit - a.profitPerUnit
    );
  }

  innerSystemRoutes(cargoCapacity) {
    return this.candidateRoutes(cargoCapacity, 0).sort((a, b) =>
      b.totalProfit - a.totalProfit || b.profitPerUnit - a.profitPerUnit
    );
  }

  roundTrips(cargoCapacity, maxJumps, legCount, maxResults) {
    legCount = Math.max(3, Math.min(legCount || 3, 6));
    maxResults = maxResults || 20;
    const candidates = this.candidateRoutes(cargoCapacity, maxJumps);
    if (!candidates.length) return [];

    // Best edge per system pair
    const bestEdge = Object.create(null);
    for (const r of candidates) {
      const key = r.srcSysNick + '|' + r.dstSysNick;
      if (!bestEdge[key] || r.totalProfit > bestEdge[key].totalProfit) bestEdge[key] = r;
    }

    const outgoing = Object.create(null);
    for (const r of Object.values(bestEdge)) {
      if (!outgoing[r.srcSysNick]) outgoing[r.srcSysNick] = [];
      outgoing[r.srcSysNick].push(r);
    }
    for (const k in outgoing) outgoing[k].sort((a, b) => b.totalProfit - a.totalProfit);

    const loops = [];
    const seenCycles = new Set();
    const sys = this.data.systems;

    const canonical = (nodes) => {
      if (nodes.length <= 1) return nodes.join(',');
      const core = nodes.slice(0, -1);
      let min = core.join(',');
      for (let i = 1; i < core.length; i++) {
        const rot = core.slice(i).concat(core.slice(0, i)).join(',');
        if (rot < min) min = rot;
      }
      return min;
    };

    const search = (start, current, visited, legs) => {
      if (legs.length === legCount) {
        if (current !== start) return;
        const cn = [start, ...legs.map(l => l.dstSysNick)];
        const c = canonical(cn);
        if (seenCycles.has(c)) return;
        seenCycles.add(c);
        loops.push({
          startSysNick: start,
          startSys: legs[0].srcSys,
          routeText: [legs[0].srcSys, ...legs.map(l => l.dstSys)].join(' \u2192 '),
          commodities: legs.map(l => l.commodity),
          legs: legs,
          cargo: cargoCapacity,
          totalProfit: legs.reduce((s, l) => s + l.totalProfit, 0),
          totalJumps: legs.reduce((s, l) => s + l.jumps, 0),
        });
        return;
      }

      const remaining = legCount - legs.length;
      for (const route of (outgoing[current] || [])) {
        const next = route.dstSysNick;
        if (remaining === 1) { if (next !== start) continue; }
        else if (visited.has(next)) continue;
        const nv = next === start ? visited : new Set([...visited, next]);
        search(start, next, nv, [...legs, route]);
      }
    };

    for (const start of Object.keys(outgoing).sort()) {
      search(start, start, new Set([start]), []);
    }

    loops.sort((a, b) => b.totalProfit - a.totalProfit || a.totalJumps - b.totalJumps);
    return loops.slice(0, maxResults);
  }
}
