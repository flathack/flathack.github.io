/**
 * rep-engine.js — Freelancer Reputation Planner Engine
 *
 * Simulates faction reputation changes from ship kills.
 * Uses a greedy algorithm to find the optimal kill sequence
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

  /**
   * Simulate killing one ship of a given faction.
   * Applies object_destruction penalty to the killed faction,
   * then cascades empathy_rate effects to all related factions.
   *
   * @param {Object<string,number>} reps – current reputation map (mutated in place)
   * @param {string} killedNick – faction nick of the killed ship
   * @returns {Object<string,number>} – the changes applied (nick → delta)
   */
  function simulateKill(reps, killedNick) {
    var faction = getFaction(killedNick);
    if (!faction || !faction.shootable) return {};

    var changes = {};
    // Direct penalty to the killed faction
    var directDelta = faction.objectDestruction;
    var newVal = clampRep(reps[killedNick] + directDelta);
    changes[killedNick] = newVal - reps[killedNick];
    reps[killedNick] = newVal;

    // Empathy cascades
    var empathy = faction.empathy || {};
    for (var targetNick in empathy) {
      if (!empathy.hasOwnProperty(targetNick)) continue;
      if (reps[targetNick] === undefined) continue;

      // Empathy effect = objectDestruction * empathy_rate
      var empDelta = directDelta * empathy[targetNick];
      var tNew = clampRep(reps[targetNick] + empDelta);
      changes[targetNick] = (changes[targetNick] || 0) + (tNew - reps[targetNick]);
      reps[targetNick] = tNew;
    }

    return changes;
  }

  /**
   * Calculate the total squared error between current reps and target reps.
   * Only considers changeable factions.
   */
  function calcError(reps, targets) {
    var error = 0;
    for (var nick in targets) {
      if (!targets.hasOwnProperty(nick)) continue;
      var f = getFaction(nick);
      if (!f || !f.changeable) continue;
      var diff = (reps[nick] || 0) - targets[nick];
      error += diff * diff;
    }
    return error;
  }

  /**
   * Calculate weighted error - higher weight for factions further from target.
   */
  function calcWeightedError(reps, targets) {
    var error = 0;
    for (var nick in targets) {
      if (!targets.hasOwnProperty(nick)) continue;
      var f = getFaction(nick);
      if (!f || !f.changeable) continue;
      var diff = (reps[nick] || 0) - targets[nick];
      error += diff * diff;
    }
    return error;
  }

  /**
   * Run the greedy reputation planner.
   *
   * @param {Object<string,number>} startReps – starting reputation per faction
   * @param {Object<string,number>} targetReps – desired reputation per faction
   * @param {Object} options
   * @param {number} [options.maxSteps=5000] – maximum number of kills
   * @param {number} [options.tolerance=0.02] – acceptable error per faction
   * @param {function} [options.onProgress] – callback(stepNum, currentReps)
   * @returns {{ steps: Array, finalReps: Object, error: number, converged: boolean }}
   */
  function plan(startReps, targetReps, options) {
    options = options || {};
    var maxSteps = options.maxSteps || 5000;
    var tolerance = options.tolerance || 0.02;
    var onProgress = options.onProgress || null;

    // Clone starting reps
    var reps = {};
    for (var k in startReps) {
      if (startReps.hasOwnProperty(k)) reps[k] = startReps[k];
    }

    var shootable = getShootable();
    if (shootable.length === 0) {
      return { steps: [], finalReps: reps, error: calcError(reps, targetReps), converged: false };
    }

    var steps = [];
    var currentError = calcError(reps, targetReps);

    // Check if already within tolerance
    if (isWithinTolerance(reps, targetReps, tolerance)) {
      return { steps: [], finalReps: reps, error: currentError, converged: true };
    }

    var noImprovementCount = 0;
    var MAX_NO_IMPROVEMENT = 50;

    for (var step = 0; step < maxSteps; step++) {
      // Find the best faction to kill
      var bestNick = null;
      var bestError = currentError;
      var bestReps = null;

      for (var i = 0; i < shootable.length; i++) {
        var testReps = {};
        for (var rk in reps) {
          if (reps.hasOwnProperty(rk)) testReps[rk] = reps[rk];
        }
        simulateKill(testReps, shootable[i].nick);
        var testError = calcError(testReps, targetReps);
        if (testError < bestError - 1e-10) {
          bestError = testError;
          bestNick = shootable[i].nick;
          bestReps = testReps;
        }
      }

      if (!bestNick) {
        // No improvement possible
        break;
      }

      // Apply the best kill
      var changes = simulateKill(reps, bestNick);

      // Merge consecutive kills of the same faction
      var lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
      if (lastStep && lastStep.nick === bestNick) {
        lastStep.count++;
      } else {
        steps.push({
          nick: bestNick,
          name: getFaction(bestNick).name,
          count: 1,
        });
      }

      currentError = bestError;

      if (onProgress && step % 100 === 0) {
        onProgress(step, reps);
      }

      // Check convergence
      if (isWithinTolerance(reps, targetReps, tolerance)) {
        break;
      }

      // Track improvement stalls
      if (bestError >= currentError - 1e-12) {
        noImprovementCount++;
        if (noImprovementCount >= MAX_NO_IMPROVEMENT) break;
      } else {
        noImprovementCount = 0;
      }
    }

    return {
      steps: steps,
      finalReps: reps,
      error: currentError,
      converged: isWithinTolerance(reps, targetReps, tolerance),
      totalKills: steps.reduce(function (s, st) { return s + st.count; }, 0),
    };
  }

  /**
   * Check if all changeable factions are within tolerance of their target.
   */
  function isWithinTolerance(reps, targets, tolerance) {
    for (var nick in targets) {
      if (!targets.hasOwnProperty(nick)) continue;
      var f = getFaction(nick);
      if (!f || !f.changeable) continue;
      if (Math.abs((reps[nick] || 0) - targets[nick]) > tolerance) {
        return false;
      }
    }
    return true;
  }

  /** Clamp reputation to [-1, 1] */
  function clampRep(v) {
    return Math.max(-1, Math.min(1, v));
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
    getDefaultReps: getDefaultReps,
    simulateKill: simulateKill,
    calcError: calcError,
    plan: plan,
    clampRep: clampRep,
    repLabel: repLabel,
    repClass: repClass,
  };
})();
