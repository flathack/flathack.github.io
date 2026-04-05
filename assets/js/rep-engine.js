/**
 * rep-engine.js — Freelancer Reputation Planner Engine
 *
 * Simulates faction reputation changes from kills, missions, and bribes.
 * Uses a greedy algorithm to find the optimal action sequence
 * to reach a user-defined target reputation profile.
 */

/* ── Data Loading ──────────────────────────────────────────────── */

const RepEngine = (function () {
  "use strict";

  /** @type {{ mod: string, factions: Array }} */
  let DATA = null;
  /** Faction index for fast lookup: nick → index */
  let FACTION_INDEX = {};

  /**
   * Load reputation data for a mod.
   * @param {string} modId – e.g. "hamburg-city"
   * @returns {Promise<object>}
   */
  async function loadData(modId) {
    const resp = await fetch("../data/reputation/" + modId + ".json");
    if (!resp.ok) throw new Error("Failed to load reputation data for " + modId);
    DATA = await resp.json();
    FACTION_INDEX = {};
    DATA.factions.forEach(function (f, i) {
      FACTION_INDEX[f.nick] = i;
    });
    return DATA;
  }

  function getFactions() {
    return DATA ? DATA.factions : [];
  }

  function getModName() {
    return DATA ? DATA.mod : "";
  }

  /** Get faction by nick */
  function getFaction(nick) {
    if (!DATA) return null;
    var idx = FACTION_INDEX[nick];
    return idx !== undefined ? DATA.factions[idx] : null;
  }

  /** List of shootable factions (can be killed to change rep) */
  function getShootable() {
    return DATA ? DATA.factions.filter(function (f) { return f.shootable; }) : [];
  }

  /** List of changeable factions (rep can move) */
  function getChangeable() {
    return DATA ? DATA.factions.filter(function (f) { return f.changeable; }) : [];
  }

  /** List of locked factions (rep cannot change through kills) */
  function getLocked() {
    return DATA ? DATA.factions.filter(function (f) { return !f.changeable; }) : [];
  }

  /** Build default rep map: nick → defaultRep */
  function getDefaultReps() {
    var reps = {};
    if (!DATA) return reps;
    DATA.factions.forEach(function (f) {
      reps[f.nick] = f.defaultRep;
    });
    return reps;
  }

  /* ── Simulation ────────────────────────────────────────────── */

  /** Reputation threshold: missions available when rep >= this value */
  var MISSION_THRESHOLD = -0.1;
  /** Reputation threshold: bribes available when rep < this value */
  var BRIBE_THRESHOLD = 0.4;
  /** Bribe always sets reputation to this value (no empathy cascade) */
  var BRIBE_TARGET_REP = 0.6;

  /**
   * Generic event simulation: apply a delta to a faction and cascade via empathy.
   *
   * @param {Object<string,number>} reps – current reputation map (mutated in place)
   * @param {string} factionNick – faction nick
   * @param {number} delta – the base rep change (e.g. objectDestruction or missionSuccess)
   * @returns {Object<string,number>} – the changes applied (nick → delta)
   */
  function simulateEvent(reps, factionNick, delta) {
    var faction = getFaction(factionNick);
    if (!faction) return {};

    var changes = {};
    // Direct change to the faction
    var newVal = clampRep((reps[factionNick] || 0) + delta);
    changes[factionNick] = newVal - (reps[factionNick] || 0);
    reps[factionNick] = newVal;

    // Empathy cascades
    var empathy = faction.empathy || {};
    for (var targetNick in empathy) {
      if (!empathy.hasOwnProperty(targetNick)) continue;
      if (reps[targetNick] === undefined) continue;

      var empDelta = delta * empathy[targetNick];
      var tNew = clampRep(reps[targetNick] + empDelta);
      changes[targetNick] = (changes[targetNick] || 0) + (tNew - reps[targetNick]);
      reps[targetNick] = tNew;
    }

    return changes;
  }

  /**
   * Simulate killing one ship / destroying one depot of a given faction.
   */
  function simulateKill(reps, killedNick) {
    var faction = getFaction(killedNick);
    if (!faction || !faction.objectDestruction) return {};
    return simulateEvent(reps, killedNick, faction.objectDestruction);
  }

  /**
   * Simulate completing one mission for a given faction.
   */
  function simulateMission(reps, factionNick) {
    var faction = getFaction(factionNick);
    if (!faction || !faction.missionSuccess) return {};
    return simulateEvent(reps, factionNick, faction.missionSuccess);
  }

  /**
   * Simulate buying a bribe for a given faction.
   * Bribes set rep to BRIBE_TARGET_REP and cascade via empathy.
   * Only one bribe per faction is possible.
   */
  function simulateBribe(reps, factionNick) {
    var faction = getFaction(factionNick);
    if (!faction || !faction.bribes || faction.bribes.length === 0) return {};

    var changes = {};
    var oldVal = reps[factionNick] || 0;
    var newVal = BRIBE_TARGET_REP;
    var delta = newVal - oldVal;
    changes[factionNick] = delta;
    reps[factionNick] = newVal;

    // Empathy cascades
    var empathy = faction.empathy || {};
    for (var targetNick in empathy) {
      if (!empathy.hasOwnProperty(targetNick)) continue;
      if (reps[targetNick] === undefined) continue;

      var empDelta = delta * empathy[targetNick];
      var tNew = clampRep(reps[targetNick] + empDelta);
      changes[targetNick] = (changes[targetNick] || 0) + (tNew - reps[targetNick]);
      reps[targetNick] = tNew;
    }

    return changes;
  }

  /** List of factions that can give missions */
  function getMissionable() {
    return DATA ? DATA.factions.filter(function (f) { return !!f.missionSuccess; }) : [];
  }

  /** List of factions that can be bribed */
  function getBribeable() {
    return DATA ? DATA.factions.filter(function (f) { return f.bribes && f.bribes.length > 0; }) : [];
  }

  /** Can the player currently take missions for this faction? */
  function canDoMission(reps, nick) {
    var f = getFaction(nick);
    return f && f.missionSuccess && (reps[nick] || 0) >= MISSION_THRESHOLD;
  }

  /** Can the player currently buy a bribe for this faction? */
  function canDoBribe(reps, nick) {
    var f = getFaction(nick);
    return f && f.bribes && f.bribes.length > 0 && (reps[nick] || 0) < BRIBE_THRESHOLD;
  }

  /**
   * Calculate the total squared error between current reps and target reps.
   * Only considers changeable factions.
   * Asymmetric weighting: being too hostile (below target) is penalised
   * more heavily than being too friendly (above target), so the planner
   * prioritises raising hostile factions toward neutral.
   *
   * @param {Object<string,number>} reps
   * @param {Object<string,number>} targets
   * @param {Object<string,boolean>} [skip] – factions to ignore (unreachable)
   */
  function calcError(reps, targets, skip) {
    var error = 0;
    var HOSTILE_WEIGHT = 2.5;
    for (var nick in targets) {
      if (!targets.hasOwnProperty(nick)) continue;
      if (skip && skip[nick]) continue;
      var f = getFaction(nick);
      if (!f || !f.changeable) continue;
      var diff = (reps[nick] || 0) - targets[nick];
      var w = diff < 0 ? HOSTILE_WEIGHT : 1;
      error += w * diff * diff;
    }
    return error;
  }

  /**
   * Analyse which factions can be moved toward their target using the
   * available action types.  A faction is "reachable" if there exists at
   * least one action that moves it in the RIGHT direction.
   *
   * @returns {Object<string,boolean>} unreachable – nick → true for factions that cannot be reached
   */
  function analyseReachability(startReps, targetReps, useKills, useMissions, useBribes) {
    var unreachable = {};
    var factions = getFactions();
    var shootable = useKills ? getShootable() : [];
    var missionable = useMissions ? getMissionable() : [];
    var bribeable = useBribes ? getBribeable() : [];

    factions.forEach(function (f) {
      if (!f.changeable) return;
      var nick = f.nick;
      var current = startReps[nick] || 0;
      var target = targetReps[nick] || 0;
      var diff = target - current; // positive = need to raise, negative = need to lower
      if (Math.abs(diff) < 0.01) return; // already close enough

      var canReach = false;

      if (diff > 0) {
        // Need to RAISE this faction
        // 1. Kill enemies (factions whose empathy to this one is negative → killing gives positive delta)
        if (useKills) {
          for (var i = 0; i < shootable.length; i++) {
            var emp = shootable[i].empathy || {};
            if (nick in emp && emp[nick] < 0) {
              // objectDestruction is negative, * negative empathy = positive
              canReach = true; break;
            }
          }
        }
        // 2. Missions for this faction or allies that have positive empathy to it
        if (!canReach && useMissions) {
          if (f.missionSuccess) { canReach = true; }
          if (!canReach) {
            for (var mi = 0; mi < missionable.length; mi++) {
              var memp = missionable[mi].empathy || {};
              if (nick in memp && memp[nick] > 0) { canReach = true; break; }
            }
          }
        }
        // 3. Bribes
        if (!canReach && useBribes && f.bribes && f.bribes.length > 0) {
          canReach = true;
        }
      } else {
        // Need to LOWER this faction
        // 1. Kill this faction directly
        if (useKills && f.objectDestruction) {
          canReach = true;
        }
        // 2. Kill allies (factions with positive empathy to this one → killing lowers this)
        if (!canReach && useKills) {
          for (var ki = 0; ki < shootable.length; ki++) {
            var kemp = shootable[ki].empathy || {};
            if (nick in kemp && kemp[nick] > 0) {
              canReach = true; break;
            }
          }
        }
        // Missions and bribes can only RAISE, not lower
      }

      if (!canReach) {
        unreachable[nick] = true;
      }
    });

    return unreachable;
  }

  /**
   * Run the greedy reputation planner.
   *
   * @param {Object<string,number>} startReps – starting reputation per faction
   * @param {Object<string,number>} targetReps – desired reputation per faction
   * @param {Object} options
   * @param {number}   [options.maxSteps=5000] – maximum number of actions
   * @param {number}   [options.tolerance=0.02] – acceptable error per faction
   * @param {boolean}  [options.useKills=true] – allow kills/destruction
   * @param {boolean}  [options.useMissions=true] – allow missions
   * @param {boolean}  [options.useBribes=false] – allow bribes
   * @param {function} [options.onProgress] – callback(stepNum, currentReps)
   * @returns {{ steps: Array, finalReps: Object, error: number, converged: boolean, totalKills: number }}
   */
  function plan(startReps, targetReps, options) {
    options = options || {};
    var maxSteps = options.maxSteps || 5000;
    var tolerance = options.tolerance || 0.02;
    var onProgress = options.onProgress || null;
    var useKills = options.useKills !== false;
    var useMissions = options.useMissions !== false;
    var useBribes = options.useBribes === true;

    // Clone starting reps
    var reps = {};
    for (var k in startReps) {
      if (startReps.hasOwnProperty(k)) reps[k] = startReps[k];
    }

    var shootable = useKills ? getShootable() : [];
    var missionable = useMissions ? getMissionable() : [];
    var bribeable = useBribes ? getBribeable() : [];

    // Track remaining bribes per faction (max 1 per faction – the bases list
    // only shows *where* the bribe can be bought, not how many times)
    var bribeRemaining = {};
    if (useBribes) {
      for (var bi = 0; bi < bribeable.length; bi++) {
        bribeRemaining[bribeable[bi].nick] = 1;
      }
    }

    if (shootable.length === 0 && missionable.length === 0 && bribeable.length === 0) {
      return { steps: [], finalReps: reps, error: calcError(reps, targetReps), converged: false, unreachable: {} };
    }

    // Analyse which factions can actually be reached with the selected action types
    var unreachable = analyseReachability(startReps, targetReps, useKills, useMissions, useBribes);

    var steps = [];
    var currentError = calcError(reps, targetReps, unreachable);

    if (isWithinTolerance(reps, targetReps, tolerance, unreachable)) {
      return { steps: [], finalReps: reps, error: currentError, converged: true, unreachable: unreachable };
    }

    // Helper: clone reps object
    function cloneReps(src) {
      var c = {};
      for (var rk in src) { if (src.hasOwnProperty(rk)) c[rk] = src[rk]; }
      return c;
    }

    // Helper: apply a single action to reps (mutating)
    function applyAction(r, type, nick) {
      if (type === "kill") simulateKill(r, nick);
      else if (type === "mission") simulateMission(r, nick);
      else if (type === "bribe") simulateBribe(r, nick);
    }

    // Helper: check if an action's preconditions are still met
    function canStillDo(r, type, nick) {
      if (type === "mission") return canDoMission(r, nick);
      if (type === "bribe") return canDoBribe(r, nick) && (bribeRemaining[nick] || 0) > 0;
      return true; // kills always possible
    }

    // Helper: test an action and track best
    var bestAction, bestError;
    function tryAction(type, nick) {
      var testReps = cloneReps(reps);
      applyAction(testReps, type, nick);
      var testError = calcError(testReps, targetReps, unreachable);
      if (testError < bestError - 1e-10) {
        bestError = testError;
        bestAction = { type: type, nick: nick };
      }
    }

    var totalActions = 0;

    while (totalActions < maxSteps) {
      // ── Find the single best action across all candidates ──
      bestAction = null;
      bestError = currentError;

      // Try kills
      for (var ki = 0; ki < shootable.length; ki++) {
        tryAction("kill", shootable[ki].nick);
      }

      // Try missions (only when rep is high enough)
      for (var mi = 0; mi < missionable.length; mi++) {
        var mn = missionable[mi].nick;
        if (canDoMission(reps, mn)) {
          tryAction("mission", mn);
        }
      }

      // Try bribes (only when rep is low enough AND bribes remaining)
      for (var bri = 0; bri < bribeable.length; bri++) {
        var bn = bribeable[bri].nick;
        if (canDoBribe(reps, bn) && (bribeRemaining[bn] || 0) > 0) {
          tryAction("bribe", bn);
        }
      }

      if (!bestAction) break;

      // ── Batch: repeat the best action until it stops helping ──
      var batchType = bestAction.type;
      var batchNick = bestAction.nick;
      var batchCount = 0;

      while (totalActions < maxSteps) {
        // Check pre-conditions
        if (!canStillDo(reps, batchType, batchNick)) break;

        // Test whether this action still reduces error
        var testReps = cloneReps(reps);
        applyAction(testReps, batchType, batchNick);
        var testError = calcError(testReps, targetReps, unreachable);
        if (testError >= currentError - 1e-10) break;

        // Apply it for real
        applyAction(reps, batchType, batchNick);
        if (batchType === "bribe") bribeRemaining[batchNick]--;
        currentError = testError;
        batchCount++;
        totalActions++;

        if (isWithinTolerance(reps, targetReps, tolerance, unreachable)) break;
      }

      if (batchCount === 0) break; // action didn't help at all

      // Record the batch as one step
      steps.push({
        type: batchType,
        nick: batchNick,
        name: getFaction(batchNick).name,
        count: batchCount,
      });

      if (onProgress) {
        onProgress(totalActions, reps);
      }

      if (isWithinTolerance(reps, targetReps, tolerance, unreachable)) {
        break;
      }
    }

    // Post-process: consolidate steps by faction+type (ordered by first occurrence)
    var consolidated = [];
    var seenIdx = {}; // "type:nick" → index in consolidated
    for (var ci = 0; ci < steps.length; ci++) {
      var key = steps[ci].type + ":" + steps[ci].nick;
      if (key in seenIdx) {
        consolidated[seenIdx[key]].count += steps[ci].count;
      } else {
        seenIdx[key] = consolidated.length;
        consolidated.push({
          type: steps[ci].type,
          nick: steps[ci].nick,
          name: steps[ci].name,
          count: steps[ci].count,
        });
      }
    }

    return {
      steps: consolidated,
      finalReps: reps,
      error: currentError,
      converged: isWithinTolerance(reps, targetReps, tolerance, unreachable),
      unreachable: unreachable,
      totalKills: consolidated.reduce(function (s, st) { return s + st.count; }, 0),
    };
  }

  /**
   * Check if all changeable factions are within tolerance of their target.
   * @param {Object<string,boolean>} [skip] – factions to ignore (unreachable)
   */
  function isWithinTolerance(reps, targets, tolerance, skip) {
    for (var nick in targets) {
      if (!targets.hasOwnProperty(nick)) continue;
      if (skip && skip[nick]) continue;
      var f = getFaction(nick);
      if (!f || !f.changeable) continue;
      if (Math.abs((reps[nick] || 0) - targets[nick]) > tolerance) {
        return false;
      }
    }
    return true;
  }

  /** Clamp reputation to [-0.91, 0.91] (game engine limit) */
  function clampRep(v) {
    return Math.max(-0.91, Math.min(0.91, v));
  }

  /**
   * Get reputation label for a value.
   */
  function repLabel(value) {
    if (value >= 0.6) return "Verbündet";
    if (value >= 0.3) return "Freundlich";
    if (value >= -0.1) return "Neutral";
    if (value >= -0.5) return "Unfreundlich";
    return "Feindlich";
  }

  /**
   * Rep value → CSS class
   */
  function repClass(value) {
    if (value >= 0.6) return "rep-allied";
    if (value >= 0.3) return "rep-friendly";
    if (value >= -0.1) return "rep-neutral";
    if (value >= -0.5) return "rep-unfriendly";
    return "rep-hostile";
  }

  /* ── Public API ──────────────────────────────────────────────── */

  return {
    loadData: loadData,
    getFactions: getFactions,
    getModName: getModName,
    getFaction: getFaction,
    getShootable: getShootable,
    getChangeable: getChangeable,
    getLocked: getLocked,
    getMissionable: getMissionable,
    getBribeable: getBribeable,
    getDefaultReps: getDefaultReps,
    simulateKill: simulateKill,
    simulateMission: simulateMission,
    simulateBribe: simulateBribe,
    canDoMission: canDoMission,
    canDoBribe: canDoBribe,
    calcError: calcError,
    plan: plan,
    clampRep: clampRep,
    repLabel: repLabel,
    repClass: repClass,
    MISSION_THRESHOLD: MISSION_THRESHOLD,
    BRIBE_THRESHOLD: BRIBE_THRESHOLD,
    BRIBE_TARGET_REP: BRIBE_TARGET_REP,
  };
})();
