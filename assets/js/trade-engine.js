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
  static BUY_AND_LAUNCH_TIME = 15; // seconds to buy cargo and launch from a base
  static LAND_AND_SELL_TIME = 20;  // seconds to land and sell cargo at a base

  _findGatePos(systemNick, targetSystem) {
    const sysTravel = (this.data.travel || {})[systemNick];
    if (!sysTravel || !sysTravel.gates) return null;
    const gate = sysTravel.gates.find(g => g.goto === targetSystem);
    return gate ? gate.pos : null;
  }

  _intraSystemBreakdown(systemNick, fromPos, toPos) {
    const dx = toPos[0] - fromPos[0], dz = toPos[1] - fromPos[1];
    const directDist = Math.hypot(dx, dz);
    const directTime = directDist / TradeEngine.CRUISE_SPEED;

    const sysTravel = (this.data.travel || {})[systemNick];
    if (!sysTravel || !sysTravel.tl || !sysTravel.tl.length) {
      return {
        totalTime: directTime,
        segments: [{ type: 'open_space', systemNick, seconds: directTime, distance: directDist }],
      };
    }

    let best = {
      totalTime: directTime,
      segments: [{ type: 'open_space', systemNick, seconds: directTime, distance: directDist }],
    };

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
      if (total < best.totalTime) {
        const segments = [];
        if (timeToTL > 0.01) segments.push({ type: 'open_space', systemNick, seconds: timeToTL, distance: nearFromDist });
        if (timeTL > 0.01) segments.push({ type: 'trade_lane', systemNick, seconds: timeTL });
        if (timeFromTL > 0.01) segments.push({ type: 'open_space', systemNick, seconds: timeFromTL, distance: nearToDist });
        best = { totalTime: total, segments };
      }
    }

    return best;
  }

  _intraSystemTime(systemNick, fromPos, toPos) {
    return this._intraSystemBreakdown(systemNick, fromPos, toPos).totalTime;
  }

  travelBreakdown(route) {
    const bases = this.data.bases;
    const systems = this.data.systems || {};
    const srcBase = bases[route.buyBaseNick];
    const dstBase = bases[route.sellBaseNick];
    if (!srcBase || !srcBase.pos || !dstBase || !dstBase.pos) return null;

    const path = route.pathNicks;
    if (!path || !path.length) return null;

    const segments = [];
    let totalTime = 0;

    if (path.length === 1) {
      segments.push({
        type: 'buy_start',
        systemNick: path[0],
        system: systems[path[0]] || path[0],
        station: srcBase.name || route.buyBase,
        seconds: TradeEngine.BUY_AND_LAUNCH_TIME,
      });
      totalTime += TradeEngine.BUY_AND_LAUNCH_TIME;

      const intra = this._intraSystemBreakdown(path[0], srcBase.pos, dstBase.pos);
      intra.segments.forEach(segment => {
        segments.push({
          ...segment,
          system: systems[path[0]] || path[0],
        });
      });
      totalTime += intra.totalTime;

      segments.push({
        type: 'dock_sell',
        systemNick: path[0],
        system: systems[path[0]] || path[0],
        station: dstBase.name || route.sellBase,
        seconds: TradeEngine.LAND_AND_SELL_TIME,
      });
      totalTime += TradeEngine.LAND_AND_SELL_TIME;
    } else {
      for (let i = 0; i < path.length; i++) {
        let fromPos, toPos, fromLabel, toLabel;

        if (i === 0) {
          fromPos = srcBase.pos;
          toPos = this._findGatePos(path[i], path[i + 1]);
          fromLabel = srcBase.name || route.buyBase;
          toLabel = systems[path[i + 1]] || path[i + 1];
        } else if (i === path.length - 1) {
          fromPos = this._findGatePos(path[i], path[i - 1]);
          toPos = dstBase.pos;
          fromLabel = systems[path[i - 1]] || path[i - 1];
          toLabel = dstBase.name || route.sellBase;
        } else {
          fromPos = this._findGatePos(path[i], path[i - 1]);
          toPos = this._findGatePos(path[i], path[i + 1]);
          fromLabel = systems[path[i - 1]] || path[i - 1];
          toLabel = systems[path[i + 1]] || path[i + 1];
        }

        if (!fromPos || !toPos) return null;
        if (i === 0) {
          segments.push({
            type: 'buy_start',
            systemNick: path[i],
            system: systems[path[i]] || path[i],
            station: srcBase.name || route.buyBase,
            seconds: TradeEngine.BUY_AND_LAUNCH_TIME,
          });
          totalTime += TradeEngine.BUY_AND_LAUNCH_TIME;
        }

        const intra = this._intraSystemBreakdown(path[i], fromPos, toPos);
        intra.segments.forEach(segment => {
          segments.push({
            ...segment,
            system: systems[path[i]] || path[i],
            from: fromLabel,
            to: toLabel,
          });
        });
        totalTime += intra.totalTime;

        if (i < path.length - 1) {
          segments.push({
            type: 'jump',
            fromSystemNick: path[i],
            toSystemNick: path[i + 1],
            from: systems[path[i]] || path[i],
            to: systems[path[i + 1]] || path[i + 1],
            seconds: TradeEngine.GATE_TIME,
          });
          totalTime += TradeEngine.GATE_TIME;
        }

        if (i === path.length - 1) {
          segments.push({
            type: 'dock_sell',
            systemNick: path[i],
            system: systems[path[i]] || path[i],
            station: dstBase.name || route.sellBase,
            seconds: TradeEngine.LAND_AND_SELL_TIME,
          });
          totalTime += TradeEngine.LAND_AND_SELL_TIME;
        }
      }
    }

    return {
      totalTime: Math.round(totalTime),
      segments: segments.map(segment => ({
        ...segment,
        seconds: Math.round(segment.seconds),
      })),
    };
  }

  travelTime(route, options = {}) {
    const includeReturnTrip = !!options.includeReturnTrip;
    const outbound = this.travelBreakdown(route);
    if (!outbound) return null;
    if (!includeReturnTrip) return outbound.totalTime;

    const returnRoute = {
      buyBaseNick: route.sellBaseNick,
      buyBase: route.sellBase,
      sellBaseNick: route.buyBaseNick,
      sellBase: route.buyBase,
      pathNicks: Array.isArray(route.pathNicks) ? route.pathNicks.slice().reverse() : [],
    };
    const inbound = this.travelBreakdown(returnRoute);
    if (!inbound) return null;
    return outbound.totalTime + inbound.totalTime;
  }

  _applyTravelMetrics(routes, includeReturnTrip) {
    for (const r of routes) {
      const oneWay = this.travelTime(r);
      const effective = this.travelTime(r, { includeReturnTrip });
      r.oneWayTravelTime = oneWay;
      r.travelTime = effective;
      r.returnTravelIncluded = !!includeReturnTrip;
      r.returnTravelTime = includeReturnTrip && oneWay != null && effective != null ? Math.max(0, effective - oneWay) : 0;
      r.profitPerMin = (effective && effective > 0) ? Math.round(r.totalProfit / (effective / 60)) : null;
    }
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

  bestRoutesBySystem(cargoCapacity, maxJumps, tlOnly, includeReturnTrip) {
    const candidates = this.candidateRoutes(cargoCapacity, maxJumps, tlOnly);
    this._applyTravelMetrics(candidates, includeReturnTrip);
    const best = Object.create(null);
    for (const r of candidates) {
      const cur = best[r.srcSysNick];
      if (!cur || r.totalProfit > cur.totalProfit) best[r.srcSysNick] = r;
    }
    return Object.values(best).sort((a, b) =>
      b.totalProfit - a.totalProfit || b.profitPerUnit - a.profitPerUnit
    );
  }

  innerSystemRoutes(cargoCapacity, tlOnly, includeReturnTrip) {
    const candidates = this.candidateRoutes(cargoCapacity, 0, tlOnly);
    this._applyTravelMetrics(candidates, includeReturnTrip);
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
