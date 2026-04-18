/**
 * TradeEngine – client-side Freelancer trade route calculator.
 * Operates on pre-exported JSON data (systems, bases, commodities, markets, adjacency, travel).
 */
class TradeEngine {
  constructor(data) {
    this.data = data;
    this._pathCache = new Map();
    this._pathAdjacency = this._buildPathAdjacency();
    this._jumpDistanceIndex = this._buildJumpDistanceIndex();
    this._commodityRouteIndex = this._buildCommodityRouteIndex();
  }

  _buildPathAdjacency() {
    const rawAdj = this.data.adjacency || {};
    const timedAdj = Object.create(null);
    let timedEdgeCount = 0;

    for (const [systemNick, neighbors] of Object.entries(rawAdj)) {
      for (const next of neighbors || []) {
        if (!this._hasTravelData(systemNick, next)) continue;
        if (!timedAdj[systemNick]) timedAdj[systemNick] = [];
        timedAdj[systemNick].push(next);
        timedEdgeCount++;
      }
    }

    if (!timedEdgeCount) return rawAdj;

    for (const systemNick of Object.keys(timedAdj)) {
      timedAdj[systemNick].sort();
    }
    return timedAdj;
  }

  _buildJumpDistanceIndex() {
    const adjacency = this._pathAdjacency || {};
    const systems = new Set([
      ...Object.keys(this.data.systems || {}),
      ...Object.keys(adjacency),
    ]);
    for (const neighbors of Object.values(adjacency)) {
      for (const next of neighbors || []) systems.add(next);
    }

    const index = Object.create(null);
    for (const start of systems) {
      const distances = Object.create(null);
      distances[start] = 0;
      const queue = [start];
      let head = 0;
      while (head < queue.length) {
        const current = queue[head++];
        const currentDistance = distances[current];
        for (const next of (adjacency[current] || [])) {
          if (next in distances) continue;
          distances[next] = currentDistance + 1;
          queue.push(next);
        }
      }
      index[start] = distances;
    }
    return index;
  }

  _buildCommodityRouteIndex() {
    const markets = this.data.markets || {};
    const index = Object.create(null);

    for (const commodity of Object.keys(markets)) {
      const rawEntries = Array.isArray(markets[commodity]) ? markets[commodity] : [];
      const accessible = rawEntries.filter(entry => entry && entry.base && !entry.base.includes('_miner'));

      let sources = accessible.filter(entry => entry.src);
      if (!sources.length) sources = accessible.slice();
      const sinks = accessible.filter(entry => !entry.src);
      const sinksBySystem = Object.create(null);

      for (const sink of sinks) {
        if (!sinksBySystem[sink.sys]) sinksBySystem[sink.sys] = [];
        sinksBySystem[sink.sys].push(sink);
      }
      for (const sinkList of Object.values(sinksBySystem)) {
        sinkList.sort((left, right) => {
          const profitDelta = Number(right.price || 0) - Number(left.price || 0);
          if (profitDelta) return profitDelta;
          return String(left.base || '').localeCompare(String(right.base || ''));
        });
      }

      index[commodity] = {
        sources,
        sinksBySystem,
      };
    }

    return index;
  }

  /* ── BFS shortest path ──────────────────────────────────── */

  findPath(src, dst) {
    if (!src || !dst) return [];
    if (src === dst) return [src];
    const key = src + '|' + dst;
    if (this._pathCache.has(key)) return this._pathCache.get(key);

    const adj = this._pathAdjacency;
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

  _gateEntries(systemNick) {
    const sysTravel = (this.data.travel || {})[systemNick];
    return (sysTravel && sysTravel.gates) || [];
  }

  _surfaceIntraSystemBreakdown(systemNick, fromPos, toPos) {
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

  _gateNodeLabel(gate, fallback) {
    return gate.nick || gate.target || fallback;
  }

  _findGatePos(systemNick, targetSystem) {
    const gate = this._gateEntries(systemNick).find(g => g.goto === targetSystem && Array.isArray(g.pos));
    return gate ? gate.pos : null;
  }

  _findArrivalGatePos(systemNick, sourceSystem) {
    const explicit = this._findGatePos(systemNick, sourceSystem);
    if (explicit) return explicit;
    const gate = this._gateEntries(systemNick).find(g => g.goto === systemNick && Array.isArray(g.pos));
    return gate ? gate.pos : null;
  }

  _hasTravelData(fromSystemNick, toSystemNick) {
    return !!this._findGatePos(fromSystemNick, toSystemNick) && !!this._findArrivalGatePos(toSystemNick, fromSystemNick);
  }

  _intraSystemBreakdown(systemNick, fromPos, toPos) {
    const gates = this._gateEntries(systemNick)
      .map((gate, index) => ({ ...gate, _index: index }))
      .filter(gate => Array.isArray(gate.pos));
    const gateByNick = new Map();
    for (const gate of gates) {
      if (gate.nick) gateByNick.set(gate.nick, gate);
    }

    const shortcutEdges = gates
      .filter(gate => gate.goto === systemNick && gate.target && gateByNick.has(gate.target))
      .map(gate => ({
        fromId: 'gate:' + gate._index,
        toId: 'gate:' + gateByNick.get(gate.target)._index,
        fromLabel: this._gateNodeLabel(gate, 'Gate ' + (gate._index + 1)),
        toLabel: this._gateNodeLabel(gateByNick.get(gate.target), 'Gate ' + (gateByNick.get(gate.target)._index + 1)),
      }));

    if (!shortcutEdges.length) {
      return this._surfaceIntraSystemBreakdown(systemNick, fromPos, toPos);
    }

    const nodes = [
      { id: 'start', pos: fromPos, label: 'Start' },
      { id: 'end', pos: toPos, label: 'Destination' },
      ...gates.map(gate => ({
        id: 'gate:' + gate._index,
        pos: gate.pos,
        label: this._gateNodeLabel(gate, 'Gate ' + (gate._index + 1)),
      })),
    ];

    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const moveCache = new Map();
    const dist = new Map();
    const prev = new Map();
    const visited = new Set();

    const moveBreakdown = (fromId, toId) => {
      const cacheKey = fromId + '=>' + toId;
      if (!moveCache.has(cacheKey)) {
        const fromNode = nodeById.get(fromId);
        const toNode = nodeById.get(toId);
        moveCache.set(cacheKey, this._surfaceIntraSystemBreakdown(systemNick, fromNode.pos, toNode.pos));
      }
      return moveCache.get(cacheKey);
    };

    for (const node of nodes) dist.set(node.id, Infinity);
    dist.set('start', 0);

    while (visited.size < nodes.length) {
      let currentId = '';
      let currentDist = Infinity;
      for (const node of nodes) {
        if (visited.has(node.id)) continue;
        const candidate = dist.get(node.id);
        if (candidate < currentDist) {
          currentDist = candidate;
          currentId = node.id;
        }
      }
      if (!currentId || !isFinite(currentDist)) break;
      if (currentId === 'end') break;
      visited.add(currentId);

      for (const node of nodes) {
        if (node.id === currentId || visited.has(node.id)) continue;
        const breakdown = moveBreakdown(currentId, node.id);
        const nextDist = currentDist + breakdown.totalTime;
        if (nextDist < dist.get(node.id)) {
          dist.set(node.id, nextDist);
          prev.set(node.id, { fromId: currentId, kind: 'move', breakdown });
        }
      }

      for (const edge of shortcutEdges) {
        if (edge.fromId !== currentId || visited.has(edge.toId)) continue;
        const nextDist = currentDist + TradeEngine.GATE_TIME;
        if (nextDist < dist.get(edge.toId)) {
          dist.set(edge.toId, nextDist);
          prev.set(edge.toId, {
            fromId: currentId,
            kind: 'intra_jump',
            segment: {
              type: 'intra_jump',
              systemNick,
              from: edge.fromLabel,
              to: edge.toLabel,
              seconds: TradeEngine.GATE_TIME,
            },
          });
        }
      }
    }

    if (!isFinite(dist.get('end'))) {
      return this._surfaceIntraSystemBreakdown(systemNick, fromPos, toPos);
    }

    const segments = [];
    let cursor = 'end';
    while (cursor !== 'start') {
      const step = prev.get(cursor);
      if (!step) break;
      if (step.kind === 'move') {
        segments.unshift(...step.breakdown.segments);
      } else if (step.kind === 'intra_jump') {
        segments.unshift(step.segment);
      }
      cursor = step.fromId;
    }

    return {
      totalTime: dist.get('end'),
      segments,
    };
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
          fromPos = this._findArrivalGatePos(path[i], path[i - 1]);
          toPos = dstBase.pos;
          fromLabel = systems[path[i - 1]] || path[i - 1];
          toLabel = dstBase.name || route.sellBase;
        } else {
          fromPos = this._findArrivalGatePos(path[i], path[i - 1]);
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

  _setTravelMetrics(route, includeReturnTrip) {
    const outbound = this.travelBreakdown(route);
    if (!outbound) {
      route.oneWayTravelTime = null;
      route.travelTime = null;
      route.returnTravelIncluded = !!includeReturnTrip;
      route.returnTravelTime = 0;
      route.profitPerMin = null;
      return;
    }

    const oneWay = outbound.totalTime;
    let effective = oneWay;
    let returnTravelTime = 0;

    if (includeReturnTrip) {
      const returnRoute = {
        buyBaseNick: route.sellBaseNick,
        buyBase: route.sellBase,
        sellBaseNick: route.buyBaseNick,
        sellBase: route.buyBase,
        pathNicks: Array.isArray(route.pathNicks) ? route.pathNicks.slice().reverse() : [],
      };
      const inbound = this.travelBreakdown(returnRoute);
      if (!inbound) {
        effective = null;
      } else {
        returnTravelTime = inbound.totalTime;
        effective += inbound.totalTime;
      }
    }

    route.oneWayTravelTime = oneWay;
    route.travelTime = effective;
    route.returnTravelIncluded = !!includeReturnTrip;
    route.returnTravelTime = returnTravelTime;
    route.profitPerMin = (effective && effective > 0) ? Math.round(route.totalProfit / (effective / 60)) : null;
  }

  _applyTravelMetrics(routes, includeReturnTrip) {
    for (const r of routes) {
      this._setTravelMetrics(r, includeReturnTrip);
    }
  }

  /* ── Candidate route generation ─────────────────────────── */

  _buildCandidateRoute(source, sink, commInfo, cargo, maxJumps) {
    if (source.base === sink.base) return null;
    const ppu = Math.round(sink.price - source.price);
    if (ppu <= 0) return null;
    const volume = (commInfo && Number(commInfo.volume) > 0) ? Number(commInfo.volume) : 1;
    const units = Math.floor(cargo / volume);
    if (units <= 0) return null;

    const ss = source.sys, ds = sink.sys;
    let path, jumps;
    if (ss === ds) {
      path = [ss]; jumps = 0;
    } else {
      path = this.findPath(ss, ds);
      if (!path.length) return null;
      jumps = path.length - 1;
    }
    if (jumps > maxJumps) return null;

    const sys = this.data.systems, bases = this.data.bases;
    return {
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
    };
  }

  _forEachCandidateRoute(cargoCapacity, maxJumps, tlOnly, visit) {
    const { markets, commodities, bases } = this.data;

    for (const commodity in markets) {
      const commInfo = commodities[commodity];
      if (!commInfo || commInfo.price <= 0) continue;

      const indexed = this._commodityRouteIndex[commodity];
      if (!indexed) continue;
      const sources = indexed.sources;
      const sinksBySystem = indexed.sinksBySystem;

      if (!sources.length) continue;

      for (const source of sources) {
        if (tlOnly && !(bases[source.base] && bases[source.base].tl)) continue;

        const sourcePrice = Number(source.price || 0);
        const reachableSystems = this._jumpDistanceIndex[source.sys] || {};
        for (const [sinkSystem, sinkList] of Object.entries(sinksBySystem)) {
          const jumps = sinkSystem === source.sys ? 0 : reachableSystems[sinkSystem];
          if (jumps == null || jumps > maxJumps) continue;
          if (!sinkList.length || Number(sinkList[0].price || 0) <= sourcePrice) continue;

          for (const sink of sinkList) {
            if (Number(sink.price || 0) <= sourcePrice) break;
            if (tlOnly && !(bases[sink.base] && bases[sink.base].tl)) continue;
            if (source.base === sink.base) continue;
            const route = this._buildCandidateRoute(source, sink, commInfo, cargoCapacity, maxJumps);
            if (route) visit(route);
          }
        }
      }
    }
  }

  candidateRoutes(cargoCapacity, maxJumps, tlOnly) {
    const routes = [];
    this._forEachCandidateRoute(cargoCapacity, maxJumps, tlOnly, route => routes.push(route));
    return routes;
  }

  _tryAdd(routes, source, sink, commInfo, cargo, maxJumps) {
    const route = this._buildCandidateRoute(source, sink, commInfo, cargo, maxJumps);
    if (route) routes.push(route);
  }

  _compareSystemRoutePreference(left, right) {
    const leftPpm = Number(left && left.profitPerMin);
    const rightPpm = Number(right && right.profitPerMin);
    const safeLeftPpm = Number.isFinite(leftPpm) ? leftPpm : -Infinity;
    const safeRightPpm = Number.isFinite(rightPpm) ? rightPpm : -Infinity;
    if (safeLeftPpm !== safeRightPpm) return safeLeftPpm - safeRightPpm;

    const leftProfit = Number(left && left.totalProfit);
    const rightProfit = Number(right && right.totalProfit);
    if (leftProfit !== rightProfit) return leftProfit - rightProfit;

    const leftPpu = Number(left && left.profitPerUnit);
    const rightPpu = Number(right && right.profitPerUnit);
    if (leftPpu !== rightPpu) return leftPpu - rightPpu;

    const leftJumps = Number(left && left.jumps);
    const rightJumps = Number(right && right.jumps);
    return rightJumps - leftJumps;
  }

  /* ── Public API ─────────────────────────────────────────── */

  bestRoutesBySystem(cargoCapacity, maxJumps, tlOnly, includeReturnTrip) {
    const best = Object.create(null);
    this._forEachCandidateRoute(cargoCapacity, maxJumps, tlOnly, route => {
      this._setTravelMetrics(route, includeReturnTrip);
      const cur = best[route.srcSysNick];
      if (!cur || this._compareSystemRoutePreference(route, cur) > 0) {
        best[route.srcSysNick] = route;
      }
    });

    const routes = Object.values(best);
    return routes.sort((a, b) =>
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
