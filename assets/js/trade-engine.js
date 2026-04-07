/**
 * TradeEngine – client-side Freelancer trade route calculator.
 * Operates on pre-exported JSON data (systems, bases, commodities, markets, adjacency, travel).
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

  /* ── Travel time calculation ────────────────────────────── */

  static CRUISE_SPEED = 300;   // m/s
  static TL_SPEED = 2500;     // m/s
  static GATE_TIME = 10;      // seconds per jump gate/hole docking+transition
  static DOCK_TIME = 10;      // seconds to dock at a base
  static SELL_TIME = 5;       // seconds to sell cargo

  _findGatePos(systemNick, targetSystem) {
    const sysTravel = (this.data.travel || {})[systemNick];
    if (!sysTravel || !sysTravel.gates) return null;
    const gate = sysTravel.gates.find(g => g.goto === targetSystem);
    return gate ? gate.pos : null;
  }

  _intraSystemTime(systemNick, fromPos, toPos) {
    const dx = toPos[0] - fromPos[0], dz = toPos[1] - fromPos[1];
    const directDist = Math.hypot(dx, dz);
    const directTime = directDist / TradeEngine.CRUISE_SPEED;

    const sysTravel = (this.data.travel || {})[systemNick];
    if (!sysTravel || !sysTravel.tl || !sysTravel.tl.length) return directTime;

    let bestTime = directTime;

    for (const polyline of sysTravel.tl) {
      let nearFromIdx = 0, nearFromDist = Infinity;
      let nearToIdx = 0, nearToDist = Infinity;

      for (let j = 0; j < polyline.length; j++) {
        const r = polyline[j];
        const dF = Math.hypot(r[0] - fromPos[0], r[1] - fromPos[1]);
        const dT = Math.hypot(r[0] - toPos[0], r[1] - toPos[1]);
        if (dF < nearFromDist) { nearFromDist = dF; nearFromIdx = j; }
        if (dT < nearToDist) { nearToDist = dT; nearToIdx = j; }
      }

      // Fly to TL, ride it, fly from TL
      const timeToTL = nearFromDist / TradeEngine.CRUISE_SPEED;
      const timeFromTL = nearToDist / TradeEngine.CRUISE_SPEED;

      let tlDist = 0;
      const si = Math.min(nearFromIdx, nearToIdx);
      const ei = Math.max(nearFromIdx, nearToIdx);
      for (let j = si; j < ei; j++) {
        tlDist += Math.hypot(
          polyline[j + 1][0] - polyline[j][0],
          polyline[j + 1][1] - polyline[j][1]
        );
      }
      const timeTL = tlDist / TradeEngine.TL_SPEED;

      const total = timeToTL + timeTL + timeFromTL;
      if (total < bestTime) bestTime = total;
    }

    return bestTime;
  }

  travelTime(route) {
    const bases = this.data.bases;
    const srcBase = bases[route.buyBaseNick];
    const dstBase = bases[route.sellBaseNick];
    if (!srcBase || !srcBase.pos || !dstBase || !dstBase.pos) return null;

    const path = route.pathNicks;
    if (!path || !path.length) return null;

    let totalTime = 0;

    if (path.length === 1) {
      totalTime = this._intraSystemTime(path[0], srcBase.pos, dstBase.pos);
    } else {
      for (let i = 0; i < path.length; i++) {
        let fromPos, toPos;

        if (i === 0) {
          fromPos = srcBase.pos;
          toPos = this._findGatePos(path[i], path[i + 1]);
        } else if (i === path.length - 1) {
          fromPos = this._findGatePos(path[i], path[i - 1]);
          toPos = dstBase.pos;
        } else {
          fromPos = this._findGatePos(path[i], path[i - 1]);
          toPos = this._findGatePos(path[i], path[i + 1]);
        }

        if (!fromPos || !toPos) return null;
        totalTime += this._intraSystemTime(path[i], fromPos, toPos);
      }
      // Add gate transition times
      totalTime += (path.length - 1) * TradeEngine.GATE_TIME;
    }

    // Dock at buy base + sell at destination
    totalTime += TradeEngine.DOCK_TIME + TradeEngine.SELL_TIME;

    return Math.round(totalTime);
  }

  /* ── Candidate route generation ─────────────────────────── */

  candidateRoutes(cargoCapacity, maxJumps, tlOnly) {
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

      if (!sources.length) continue;

      for (const source of sources) {
        if (tlOnly && !(bases[source.base] && bases[source.base].tl)) continue;
        for (const sink of explicitSinks) {
          if (tlOnly && !(bases[sink.base] && bases[sink.base].tl)) continue;
          this._tryAdd(routes, source, sink, commInfo, cargoCapacity, maxJumps);
        }
      }
    }
    return routes;
  }

  _tryAdd(routes, source, sink, commInfo, cargo, maxJumps) {
    if (source.base === sink.base) return;
    const ppu = Math.round(sink.price - source.price);
    if (ppu <= 0) return;
    const volume = (commInfo && Number(commInfo.volume) > 0) ? Number(commInfo.volume) : 1;
    const units = Math.floor(cargo / volume);
    if (units <= 0) return;

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
      commodityVolume: volume,
      buyPrice: Math.round(source.price),
      sellPrice: Math.round(sink.price),
      profitPerUnit: ppu,
      cargo: cargo,
      cargoUnits: units,
      totalProfit: ppu * units,
      jumps: jumps,
      path: path.map(s => sys[s] || s),
      pathNicks: path.slice(),
    });
  }

  /* ── Public API ─────────────────────────────────────────── */

  bestRoutesBySystem(cargoCapacity, maxJumps, tlOnly) {
    const candidates = this.candidateRoutes(cargoCapacity, maxJumps, tlOnly);
    // Compute travel time + $/min for each route
    for (const r of candidates) {
      const tt = this.travelTime(r);
      r.travelTime = tt;
      r.profitPerMin = (tt && tt > 0) ? Math.round(r.totalProfit / (tt / 60)) : null;
    }
    const best = Object.create(null);
    for (const r of candidates) {
      const cur = best[r.srcSysNick];
      if (!cur || r.totalProfit > cur.totalProfit) best[r.srcSysNick] = r;
    }
    return Object.values(best).sort((a, b) =>
      b.totalProfit - a.totalProfit || b.profitPerUnit - a.profitPerUnit
    );
  }

  innerSystemRoutes(cargoCapacity, tlOnly) {
    const candidates = this.candidateRoutes(cargoCapacity, 0, tlOnly);
    for (const r of candidates) {
      const tt = this.travelTime(r);
      r.travelTime = tt;
      r.profitPerMin = (tt && tt > 0) ? Math.round(r.totalProfit / (tt / 60)) : null;
    }
    return candidates.sort((a, b) =>
      b.totalProfit - a.totalProfit || b.profitPerUnit - a.profitPerUnit
    );
  }

  routesAlongJourney(cargoCapacity, startSysNick, targetSysNick, tlOnly) {
    const journeyPath = this.findPath(startSysNick, targetSysNick);
    if (!journeyPath.length) return [];

    const journeyIndex = Object.create(null);
    journeyPath.forEach((sysNick, idx) => { journeyIndex[sysNick] = idx; });

    const candidates = this.candidateRoutes(cargoCapacity, journeyPath.length - 1, tlOnly);
    const filtered = candidates.filter(route => {
      if (!(route.srcSysNick in journeyIndex) || !(route.dstSysNick in journeyIndex)) return false;
      const srcIdx = journeyIndex[route.srcSysNick];
      const dstIdx = journeyIndex[route.dstSysNick];
      if (srcIdx > dstIdx) return false;

      const expectedPath = journeyPath.slice(srcIdx, dstIdx + 1);
      if (expectedPath.length !== route.pathNicks.length) return false;
      for (let i = 0; i < expectedPath.length; i++) {
        if (expectedPath[i] !== route.pathNicks[i]) return false;
      }
      return true;
    });

    for (const r of filtered) {
      const tt = this.travelTime(r);
      r.travelTime = tt;
      r.profitPerMin = (tt && tt > 0) ? Math.round(r.totalProfit / (tt / 60)) : null;
      r.corridorStart = this.data.systems[startSysNick] || startSysNick;
      r.corridorTarget = this.data.systems[targetSysNick] || targetSysNick;
      r.corridorPath = journeyPath.map(sysNick => this.data.systems[sysNick] || sysNick);
      r.corridorPathNicks = journeyPath.slice();
    }

    return filtered.sort((a, b) =>
      (b.profitPerMin || -1) - (a.profitPerMin || -1) ||
      b.totalProfit - a.totalProfit ||
      a.jumps - b.jumps
    );
  }

  roundTrips(cargoCapacity, maxJumps, legCount, maxResults, tlOnly) {
    legCount = Math.max(3, Math.min(legCount || 3, 6));
    maxResults = maxResults || 20;
    const candidates = this.candidateRoutes(cargoCapacity, maxJumps, tlOnly);
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
        const totalProfit = legs.reduce((s, l) => s + l.totalProfit, 0);
        const totalJumps = legs.reduce((s, l) => s + l.jumps, 0);
        // Compute travel time for each leg and sum
        let totalTravelTime = 0;
        let hasTime = true;
        for (const leg of legs) {
          const tt = this.travelTime(leg);
          leg.travelTime = tt;
          if (tt != null) totalTravelTime += tt;
          else hasTime = false;
        }
        loops.push({
          startSysNick: start,
          startSys: legs[0].srcSys,
          routeText: [legs[0].srcSys, ...legs.map(l => l.dstSys)].join(' \u2192 '),
          commodities: legs.map(l => l.commodity),
          legs: legs,
          cargo: cargoCapacity,
          totalProfit: totalProfit,
          totalJumps: totalJumps,
          travelTime: hasTime ? Math.round(totalTravelTime) : null,
          profitPerMin: hasTime && totalTravelTime > 0 ? Math.round(totalProfit / (totalTravelTime / 60)) : null,
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
