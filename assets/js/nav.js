/**
 * Shared navigation — injected into every page that includes this script.
 * Detects the current page and marks the matching link as active.
 * Pages with children get a sub-navigation bar for mod selection.
 */
(function () {
  const MOD_CHILDREN = [
    { label: "Vanilla", hash: "vanilla" },
    { label: "Hamburg City", hash: "hamburg-city" },
    { label: "Crossfire 2.0", hash: "crossfire" },
    { label: "Discovery 5.3.2", hash: "discovery" },
    { label: "Freelancer-Universe", hash: "freelancer-universe" },
  ];

  const TRADE_SUB_LINKS = [
    { label: "Trade Routes", href: "docs/trade-routes.html" },
    { label: "Trade Compare", href: "docs/trade-compare.html" },
    { label: "Preis-Pattern", href: "docs/price-pattern.html" },
  ];

  const TRADE_TOOL_PAGES = new Set(TRADE_SUB_LINKS.map(function (item) { return item.href; }));

  const NAV_ITEMS = [
    { label: "Home", href: "index.html" },
    { label: "Business", href: "business/index.html" },
    { label: "Freelancer 2D", href: "freelancer2d/index.html" },
    { label: "Trade Routes", href: "docs/trade-routes.html", children: MOD_CHILDREN },
    { label: "Schiff-Explorer", href: "docs/ship-explorer.html", children: MOD_CHILDREN },
    { label: "Equipment Explorer", href: "docs/equipment-explorer.html", children: MOD_CHILDREN },
    { label: "Universum", href: "docs/universe-viewer.html", children: MOD_CHILDREN },
    { label: "Rep Planner", href: "docs/rep-planner.html", children: MOD_CHILDREN },
    { label: "Signaturen", href: "docs/forum-signature-progress.html" },
  ];

  // Determine the base path from root to the current page's directory
  const path = window.location.pathname;
  const depth = (function () {
    if (/\/docs\//.test(path)) return 1;
    if (/\/about\//.test(path)) return 1;
    if (/\/business\//.test(path)) return 1;
    if (/\/help\//.test(path)) return 1;
    return 0;
  })();
  const prefix = depth ? "../" : "";
  const isBusinessPage = document.body && document.body.classList.contains("business-theme");

  function initCombatBackground() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.querySelector(".site-bg-combat-canvas")) return;

    var canvas = document.createElement("canvas");
    canvas.className = "site-bg-combat-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);

    var ctx = canvas.getContext("2d");
    var width = 0;
    var height = 0;
    var dpr = 1;
    var last = performance.now();
    var ships = [];
    var projectiles = [];
    var sparks = [];
    var images = {};
    var shipTarget = (function () {
      var stored = null;
      var version = null;
      try {
        version = localStorage.getItem("flathack-bg-ship-count-version");
        stored = localStorage.getItem("flathack-bg-ship-count");
      } catch(e) {}
      if (version !== "2") {
        stored = "8";
        try {
          localStorage.setItem("flathack-bg-ship-count", stored);
          localStorage.setItem("flathack-bg-ship-count-version", "2");
        } catch(e) {}
      }
      var parsed = parseInt(stored || "8", 10);
      return Number.isFinite(parsed) ? Math.max(0, Math.min(36, parsed)) : 8;
    })();

    var assets = {
      police: prefix + "freelancer2d/data/ship_icons/li_elite.png",
      policeAlt: prefix + "freelancer2d/data/ship_icons/li_fighter.png",
      rogue: prefix + "freelancer2d/data/ship_icons/ge_fighter.png",
      rogueAlt: prefix + "freelancer2d/data/ship_icons/rh_fighter.png",
      humanCapital: prefix + "freelancer2d/data/ship_icons/li_cruiser.png"
    };

    Object.keys(assets).forEach(function (key) {
      var img = new Image();
      img.src = assets[key];
      img.onload = function () { images[key] = img; };
    });

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!ships.length) seedShips();
    }

    function rand(min, max) {
      return min + Math.random() * (max - min);
    }

    function spawnShip(faction, edge) {
      var police = faction === "police";
      var rogue = faction === "rogue";
      var humanFleet = faction === "humanFleet";
      var side = edge == null ? Math.floor(Math.random() * 4) : edge;
      var x = rand(width * 0.1, width * 0.9);
      var y = rand(height * 0.1, height * 0.9);
      if (side === 0) { x = -80; y = rand(40, height - 40); }
      if (side === 1) { x = width + 80; y = rand(40, height - 40); }
      if (side === 2) { x = rand(40, width - 40); y = -80; }
      if (side === 3) { x = rand(40, width - 40); y = height + 80; }
      var angle = rand(0, Math.PI * 2);
      if (side === 0) angle = rand(-0.28, 0.28);
      if (side === 1) angle = Math.PI + rand(-0.28, 0.28);
      if (side === 2) angle = Math.PI / 2 + rand(-0.28, 0.28);
      if (side === 3) angle = -Math.PI / 2 + rand(-0.28, 0.28);
      var capital = faction === "humanCapital";
      return {
        faction: faction,
        side: faction === "rogue" ? "hostile" : "human",
        sprite: capital
          ? "humanCapital"
          : police || humanFleet
              ? (Math.random() > 0.55 ? "police" : "policeAlt")
              : (Math.random() > 0.55 ? "rogue" : "rogueAlt"),
        name: capital
          ? "LIBERTY CRUISER"
          : police || humanFleet
              ? "LPI-" + Math.floor(rand(100, 999))
              : "LR-" + Math.floor(rand(1000, 9999)),
        x: x,
        y: y,
        vx: Math.cos(angle) * (capital ? rand(10, 18) : rand(18, 42)),
        vy: Math.sin(angle) * (capital ? rand(10, 18) : rand(18, 42)),
        rotation: angle,
        target: null,
        hull: capital ? 520 : police || humanFleet ? 130 : 95,
        maxHull: capital ? 520 : police || humanFleet ? 130 : 95,
        fireCooldown: rand(0.2, 1.6),
        turnRate: capital ? 0.8 : police || humanFleet ? 2.4 : 3.0,
        speed: capital ? rand(18, 28) : police || humanFleet ? rand(46, 66) : rand(54, 78),
        radius: capital ? 36 : police || humanFleet ? 18 : 15,
        fleet: faction === "humanFleet" || faction === "humanCapital",
        respawnTimer: 0
      };
    }

    function seedShips() {
      ships = [];
      var count = width < 720 ? Math.min(shipTarget, 14) : shipTarget;
      for (var i = 0; i < count; i++) {
        ships.push(spawnShip(i % 2 === 0 ? "police" : "rogue"));
      }
    }

    function rebalanceShips() {
      var target = width < 720 ? Math.min(shipTarget, 14) : shipTarget;
      var ambientShips = ships.filter(function (ship) { return !ship.fleet; });
      while (ambientShips.length < target) {
        var next = spawnShip(ambientShips.length % 2 === 0 ? "police" : "rogue");
        ships.push(next);
        ambientShips.push(next);
      }
      for (var i = ships.length - 1; i >= 0 && ambientShips.length > target; i--) {
        if (!ships[i].fleet) {
          ships.splice(i, 1);
          ambientShips.pop();
        }
      }
    }

    function normalize(angle) {
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      return angle;
    }

    function nearestEnemy(ship) {
      var best = null;
      var bestDist = Infinity;
      ships.forEach(function (other) {
        if (other === ship || other.hull <= 0 || other.side === ship.side) return;
        var dx = other.x - ship.x;
        var dy = other.y - ship.y;
        var dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = other;
        }
      });
      return best;
    }

    function updateShip(ship, dt) {
      if (ship.hull <= 0) {
        ship.respawnTimer -= dt;
        if (ship.respawnTimer <= 0) {
          if (ship.fleet) {
            ships.splice(ships.indexOf(ship), 1);
          } else {
            Object.assign(ship, spawnShip(ship.faction));
          }
        }
        return;
      }

      ship.target = nearestEnemy(ship);
      var desired = Math.atan2(ship.vy, ship.vx);
      if (ship.target) {
        desired = Math.atan2(ship.target.y - ship.y, ship.target.x - ship.x);
      }
      var diff = normalize(desired - ship.rotation);
      var turn = Math.min(Math.abs(diff), ship.turnRate * dt);
      ship.rotation += Math.sign(diff) * turn;

      ship.vx += Math.cos(ship.rotation) * ship.speed * dt * 0.72;
      ship.vy += Math.sin(ship.rotation) * ship.speed * dt * 0.72;
      ship.vx *= 0.986;
      ship.vy *= 0.986;
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;

      if (ship.x < -140 || ship.x > width + 140 || ship.y < -140 || ship.y > height + 140) {
        Object.assign(ship, spawnShip(ship.faction));
        return;
      }

      ship.fireCooldown -= dt;
      if (ship.target && ship.fireCooldown <= 0) {
        var dx = ship.target.x - ship.x;
        var dy = ship.target.y - ship.y;
        var dist = Math.hypot(dx, dy);
        var aimDiff = Math.abs(normalize(Math.atan2(dy, dx) - ship.rotation));
        var range = ship.faction === "humanCapital" ? 780 : 520;
        var arc = ship.faction === "humanCapital" ? 0.75 : 0.45;
        if (dist < range && aimDiff < arc) {
          fire(ship, ship.target);
          ship.fireCooldown = ship.faction === "humanCapital" ? rand(0.18, 0.42) : rand(0.45, 1.15);
        } else {
          ship.fireCooldown = 0.18;
        }
      }
    }

    function fire(ship, target) {
      var angle = Math.atan2(target.y - ship.y, target.x - ship.x);
      var isCapital = ship.faction === "humanCapital";
      var speed = isCapital ? 460 : ship.side === "human" ? 420 : 370;
      projectiles.push({
        owner: ship,
        side: ship.side,
        x: ship.x + Math.cos(angle) * 18,
        y: ship.y + Math.sin(angle) * 18,
        vx: Math.cos(angle) * speed + ship.vx * 0.2,
        vy: Math.sin(angle) * speed + ship.vy * 0.2,
        life: isCapital ? 1.55 : 1.15,
        damage: isCapital ? 32 : ship.side === "human" ? 16 : 13,
        color: ship.side === "human" ? "rgba(105, 210, 255, 0.95)" : "rgba(255, 88, 88, 0.95)"
      });
    }

    function updateProjectiles(dt) {
      for (var i = projectiles.length - 1; i >= 0; i--) {
        var p = projectiles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        var hit = false;
        for (var j = 0; j < ships.length; j++) {
          var ship = ships[j];
          if (ship.hull <= 0 || ship.side === p.side) continue;
          var dx = ship.x - p.x;
          var dy = ship.y - p.y;
          if (Math.hypot(dx, dy) < ship.radius + 4) {
            ship.hull -= p.damage;
            sparks.push({ x: p.x, y: p.y, life: 0.42, color: p.color });
            if (ship.hull <= 0) {
              ship.respawnTimer = rand(1.1, 2.4);
              for (var k = 0; k < 8; k++) sparks.push({ x: ship.x + rand(-10, 10), y: ship.y + rand(-10, 10), life: rand(0.35, 0.8), color: "rgba(255, 190, 70, 0.9)" });
            }
            hit = true;
            break;
          }
        }
        if (hit || p.life <= 0 || p.x < -80 || p.x > width + 80 || p.y < -80 || p.y > height + 80) {
          projectiles.splice(i, 1);
        }
      }
    }

    function drawShip(ship) {
      if (ship.hull <= 0) return;
      var img = images[ship.sprite];
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.rotation + Math.PI / 2);
      ctx.globalAlpha = 0.72;
      if (img && img.complete) {
        var size = ship.faction === "humanCapital" ? 64 : ship.side === "human" ? 30 : 27;
        ctx.shadowColor = ship.side === "human" ? "rgba(92, 190, 255, 0.55)" : "rgba(255, 75, 75, 0.5)";
        ctx.shadowBlur = 8;
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
      } else {
        ctx.fillStyle = ship.side === "human" ? "#58c4ff" : "#ff5656";
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-9, -7);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-9, 7);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    function drawFrame(now) {
      var dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);

      rebalanceShips();

      ships.forEach(function (ship) { updateShip(ship, dt); });
      updateProjectiles(dt);

      projectiles.forEach(function (p) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      });

      for (var i = sparks.length - 1; i >= 0; i--) {
        var s = sparks[i];
        s.life -= dt;
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2 + (1 - s.life) * 5, 0, Math.PI * 2);
        ctx.fill();
        if (s.life <= 0) sparks.splice(i, 1);
      }
      ctx.globalAlpha = 1;

      ships.forEach(drawShip);
      requestAnimationFrame(drawFrame);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("flathack-bg-ship-count-change", function (event) {
      if (!event.detail) return;
      setShipTarget(event.detail.count);
    });

    function setShipTarget(value) {
      shipTarget = Math.max(0, Math.min(36, parseInt(value, 10) || 0));
      try {
        localStorage.setItem("flathack-bg-ship-count", String(shipTarget));
        localStorage.setItem("flathack-bg-ship-count-version", "2");
      } catch(e) {}
      rebalanceShips();
    }

    window.flathackCombatBackground = {
      setShipTarget: setShipTarget,
      getShipTarget: function () {
        return shipTarget;
      }
    };
    resize();
    requestAnimationFrame(drawFrame);
  }

  function openBattleArena(lang) {
    var existing = document.querySelector(".battle-arena-overlay");
    if (existing) {
      existing.classList.add("open");
      existing.querySelector("canvas").focus();
      return;
    }

    var labels = {
      en: {
        title: "Battle Arena",
        subtitle: "Pick two fleets and let them settle it.",
        fleetA: "Fleet A",
        fleetB: "Fleet B",
        ships: "Ships",
        start: "Start fight",
        reset: "Reset",
        close: "Close",
        victory: "Victory"
      },
      de: {
        title: "Kampf-Arena",
        subtitle: "Wähle zwei Flotten und lass sie gegeneinander antreten.",
        fleetA: "Flotte A",
        fleetB: "Flotte B",
        ships: "Schiffe",
        start: "Kampf starten",
        reset: "Reset",
        close: "Schließen",
        victory: "Sieg"
      }
    };
    var text = labels[lang === "de" ? "de" : "en"];
    var factions = [
      { id: "libertyPolice", name: "Liberty Police", side: "a", sprite: "li_elite", capital: "li_cruiser", color: "rgba(94, 203, 255, 0.96)" },
      { id: "libertyRogues", name: "Liberty Rogues", side: "b", sprite: "ge_fighter", capital: "rh_fighter", color: "rgba(255, 88, 92, 0.96)" },
      { id: "nomads", name: "Nomads", side: "b", sprite: "no_hd_fighter", capital: "no_hd_gunboat", boss: "no_hd_battleship", color: "rgba(100, 245, 255, 0.96)" },
      { id: "rheinland", name: "Rheinland Navy", side: "a", sprite: "rh_elite", capital: "rh_cruiser", color: "rgba(255, 203, 89, 0.96)" },
      { id: "order", name: "The Order", side: "a", sprite: "or_elite", capital: "or_osiris", color: "rgba(164, 119, 255, 0.96)" }
    ];
    var assetMap = {
      ge_fighter: "ge_fighter.png",
      li_cruiser: "li_cruiser.png",
      li_elite: "li_elite.png",
      no_hd_battleship: "no_hd_battleship.png",
      no_hd_fighter: "no_hd_fighter.png",
      no_hd_gunboat: "no_hd_gunboat.png",
      or_elite: "or_elite.png",
      or_osiris: "or_osiris.png",
      rh_cruiser: "rh_cruiser.png",
      rh_elite: "rh_elite.png",
      rh_fighter: "rh_fighter.png"
    };
    var images = {};
    Object.keys(assetMap).forEach(function (key) {
      var img = new Image();
      img.src = prefix + "freelancer2d/data/ship_icons/" + assetMap[key];
      images[key] = img;
    });

    var options = factions.map(function (faction) {
      return '<option value="' + faction.id + '">' + faction.name + '</option>';
    }).join("");
    var overlay = document.createElement("div");
    overlay.className = "battle-arena-overlay open";
    overlay.innerHTML =
      '<div class="battle-arena-panel" role="dialog" aria-modal="true" aria-label="' + text.title + '">' +
        '<div class="battle-arena-head">' +
          '<div><h2>' + text.title + '</h2><p>' + text.subtitle + '</p></div>' +
          '<button type="button" class="battle-arena-close" data-arena-close aria-label="' + text.close + '">x</button>' +
        '</div>' +
        '<div class="battle-arena-controls">' +
          '<label><span>' + text.fleetA + '</span><select data-arena-faction-a>' + options + '</select></label>' +
          '<label><span>' + text.fleetB + '</span><select data-arena-faction-b>' + options + '</select></label>' +
          '<label><span>' + text.ships + ' A</span><input type="range" min="2" max="28" value="12" data-arena-count-a><output data-arena-count-a-out>12</output></label>' +
          '<label><span>' + text.ships + ' B</span><input type="range" min="2" max="28" value="12" data-arena-count-b><output data-arena-count-b-out>12</output></label>' +
          '<button type="button" data-arena-start>' + text.start + '</button>' +
          '<button type="button" data-arena-reset>' + text.reset + '</button>' +
        '</div>' +
        '<div class="battle-arena-stage"><canvas tabindex="0"></canvas><div class="battle-arena-status" data-arena-status></div></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var canvas = overlay.querySelector("canvas");
    var ctx = canvas.getContext("2d");
    var panel = overlay.querySelector(".battle-arena-panel");
    var status = overlay.querySelector("[data-arena-status]");
    var factionA = overlay.querySelector("[data-arena-faction-a]");
    var factionB = overlay.querySelector("[data-arena-faction-b]");
    var countA = overlay.querySelector("[data-arena-count-a]");
    var countB = overlay.querySelector("[data-arena-count-b]");
    var countAOut = overlay.querySelector("[data-arena-count-a-out]");
    var countBOut = overlay.querySelector("[data-arena-count-b-out]");
    factionB.value = "nomads";
    var width = 0;
    var height = 0;
    var dpr = 1;
    var last = performance.now();
    var ships = [];
    var shots = [];
    var sparks = [];
    var running = true;

    function factionById(id) {
      return factions.find(function (faction) { return faction.id === id; }) || factions[0];
    }
    function rand(min, max) { return min + Math.random() * (max - min); }
    function normalize(angle) {
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      return angle;
    }
    function resizeArena() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawnFleet(sideName, faction, count) {
      var sideX = sideName === "left" ? width * 0.2 : width * 0.8;
      for (var i = 0; i < count; i++) {
        var isCapital = i === 0 && count > 7;
        var sprite = isCapital ? (faction.boss || faction.capital) : faction.sprite;
        var hull = isCapital ? 520 : 115;
        ships.push({
          side: sideName,
          faction: faction,
          sprite: sprite,
          x: sideX + rand(-60, 60),
          y: height * (0.2 + 0.6 * ((i + 1) / (count + 1))) + rand(-18, 18),
          vx: sideName === "left" ? rand(15, 42) : rand(-42, -15),
          vy: rand(-18, 18),
          rotation: sideName === "left" ? 0 : Math.PI,
          hull: hull,
          maxHull: hull,
          radius: isCapital ? 34 : 17,
          size: isCapital ? 66 : 34,
          cooldown: rand(0.2, 1.2),
          alive: true
        });
      }
    }
    function startArena() {
      ships = [];
      shots = [];
      sparks = [];
      status.textContent = "";
      spawnFleet("left", factionById(factionA.value), parseInt(countA.value, 10));
      spawnFleet("right", factionById(factionB.value), parseInt(countB.value, 10));
      running = true;
    }
    function nearestEnemy(ship) {
      var best = null;
      var bestDist = Infinity;
      ships.forEach(function (other) {
        if (!other.alive || other.side === ship.side) return;
        var dx = other.x - ship.x;
        var dy = other.y - ship.y;
        var dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = other;
        }
      });
      return best;
    }
    function fire(ship, target) {
      var angle = Math.atan2(target.y - ship.y, target.x - ship.x);
      shots.push({
        side: ship.side,
        x: ship.x + Math.cos(angle) * 18,
        y: ship.y + Math.sin(angle) * 18,
        vx: Math.cos(angle) * 520,
        vy: Math.sin(angle) * 520,
        life: 1.05,
        damage: ship.size > 50 ? 28 : 14,
        color: ship.faction.color
      });
    }
    function updateArena(dt) {
      var aliveLeft = 0;
      var aliveRight = 0;
      ships.forEach(function (ship) {
        if (!ship.alive) return;
        if (ship.side === "left") aliveLeft++; else aliveRight++;
        var target = nearestEnemy(ship);
        if (target) {
          var desired = Math.atan2(target.y - ship.y, target.x - ship.x);
          ship.rotation += normalize(desired - ship.rotation) * Math.min(1, dt * 2.8);
        }
        ship.vx += Math.cos(ship.rotation) * dt * (ship.size > 50 ? 32 : 80);
        ship.vy += Math.sin(ship.rotation) * dt * (ship.size > 50 ? 32 : 80);
        ship.vx *= 0.982;
        ship.vy *= 0.982;
        ship.x = Math.max(28, Math.min(width - 28, ship.x + ship.vx * dt));
        ship.y = Math.max(28, Math.min(height - 28, ship.y + ship.vy * dt));
        ship.cooldown -= dt;
        if (target && ship.cooldown <= 0) {
          var dist = Math.hypot(target.x - ship.x, target.y - ship.y);
          var aim = Math.abs(normalize(Math.atan2(target.y - ship.y, target.x - ship.x) - ship.rotation));
          if (dist < 560 && aim < 0.55) {
            fire(ship, target);
            ship.cooldown = ship.size > 50 ? rand(0.18, 0.42) : rand(0.38, 0.85);
          }
        }
      });
      for (var i = shots.length - 1; i >= 0; i--) {
        var shot = shots[i];
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        shot.life -= dt;
        var remove = shot.life <= 0;
        ships.forEach(function (ship) {
          if (remove || !ship.alive || ship.side === shot.side) return;
          if (Math.hypot(ship.x - shot.x, ship.y - shot.y) < ship.radius + 4) {
            ship.hull -= shot.damage;
            sparks.push({ x: shot.x, y: shot.y, life: 0.45, color: shot.color });
            if (ship.hull <= 0) {
              ship.alive = false;
              for (var k = 0; k < 10; k++) sparks.push({ x: ship.x + rand(-12, 12), y: ship.y + rand(-12, 12), life: rand(0.35, 0.8), color: "rgba(255, 190, 70, 0.92)" });
            }
            remove = true;
          }
        });
        if (remove || shot.x < -40 || shot.x > width + 40 || shot.y < -40 || shot.y > height + 40) shots.splice(i, 1);
      }
      if (running && (aliveLeft === 0 || aliveRight === 0)) {
        running = false;
        var winner = aliveLeft > 0 ? factionById(factionA.value).name : factionById(factionB.value).name;
        status.textContent = text.victory + ": " + winner;
      }
    }
    function drawArena(now) {
      if (!document.body.contains(overlay)) return;
      var dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(2, 7, 14, 0.72)";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(120, 210, 255, 0.12)";
      ctx.lineWidth = 1;
      for (var gx = 0; gx < width; gx += 54) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
      }
      for (var gy = 0; gy < height; gy += 54) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
      }
      if (running) updateArena(dt);
      shots.forEach(function (shot) {
        ctx.strokeStyle = shot.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y);
        ctx.lineTo(shot.x - shot.vx * 0.035, shot.y - shot.vy * 0.035);
        ctx.stroke();
      });
      for (var i = sparks.length - 1; i >= 0; i--) {
        var spark = sparks[i];
        spark.life -= dt;
        ctx.globalAlpha = Math.max(0, spark.life);
        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, 2 + (1 - spark.life) * 6, 0, Math.PI * 2);
        ctx.fill();
        if (spark.life <= 0) sparks.splice(i, 1);
      }
      ctx.globalAlpha = 1;
      ships.forEach(function (ship) {
        if (!ship.alive) return;
        var img = images[ship.sprite];
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.rotation + Math.PI / 2);
        ctx.shadowColor = ship.faction.color;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.95;
        if (img && img.complete) {
          ctx.drawImage(img, -ship.size / 2, -ship.size / 2, ship.size, ship.size);
        } else {
          ctx.fillStyle = ship.faction.color;
          ctx.beginPath();
          ctx.moveTo(14, 0); ctx.lineTo(-10, -8); ctx.lineTo(-6, 0); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      });
      requestAnimationFrame(drawArena);
    }

    function syncOutputs() {
      countAOut.textContent = countA.value;
      countBOut.textContent = countB.value;
    }
    countA.addEventListener("input", syncOutputs);
    countB.addEventListener("input", syncOutputs);
    overlay.querySelector("[data-arena-start]").addEventListener("click", startArena);
    overlay.querySelector("[data-arena-reset]").addEventListener("click", startArena);
    overlay.querySelector("[data-arena-close]").addEventListener("click", function () {
      overlay.classList.remove("open");
    });
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) overlay.classList.remove("open");
    });
    window.addEventListener("resize", resizeArena);
    resizeArena();
    syncOutputs();
    startArena();
    requestAnimationFrame(drawArena);
    canvas.focus();
  }

  if (!isBusinessPage) initCombatBackground();

  // Build current page's canonical path segment for matching
  const segments = path.split("/");
  const fileName = segments.pop() || "index.html";
  const folder = segments.pop() || "";
  const current = folder && folder !== "" && !/flathack\.github\.io/i.test(folder)
    ? folder + "/" + fileName
    : fileName;

  // Find the nav container
  const nav = document.querySelector(".site-nav, .project-top-nav");
  if (!nav) return;

  var activeItem = null;
  var tradeRoutesItem = NAV_ITEMS.find(function (item) { return item.href === "docs/trade-routes.html"; }) || null;

  // ── Build the unified capsule navigation ──
  var navHtml = '';

  NAV_ITEMS.forEach(function (item) {
    const href = prefix + item.href;
    const isHelpSection = item.href === "help/index.html" && current.indexOf("help/") === 0;
    const isTradeGroup = item.href === "docs/trade-routes.html" && TRADE_TOOL_PAGES.has(current);
    const isActive = current === item.href || isHelpSection || isTradeGroup;
    if (isActive) activeItem = item;
    navHtml += '<a href="' + href + '"' + (isActive ? ' class="active"' : "") + ">" + item.label + "</a>";
  });

  if (!activeItem && TRADE_TOOL_PAGES.has(current)) {
    activeItem = tradeRoutesItem;
  }

  // ── Global language toggle ──
  var storedLang = null;
  try { storedLang = sessionStorage.getItem("flathack-lang"); } catch(e) {}
  var currentLang = storedLang || "en";

  var langToggleHtml =
    '<button data-lang="de"' + (currentLang === "de" ? ' class="active"' : '') + '>DE</button>' +
    '<button data-lang="en"' + (currentLang === "en" ? ' class="active"' : '') + '>EN</button>';
  var savedShipCount = window.flathackCombatBackground && window.flathackCombatBackground.getShipTarget
    ? window.flathackCombatBackground.getShipTarget()
    : 8;
  var businessActionsHtml =
    '<a class="nav-capsule-help" href="' + prefix + 'help/index.html" title="Help">?</a>' +
    '<div class="nav-capsule-lang" data-lang="' + currentLang + '">' + langToggleHtml + '</div>';
  var standardActionsHtml =
    '<label class="nav-ship-control" title="Background ship count">' +
      '<span data-nav-ship-label>Ships</span>' +
      '<input type="range" min="0" max="36" step="1" value="' + savedShipCount + '" data-bg-ship-count>' +
      '<output data-bg-ship-output>' + savedShipCount + '</output>' +
    '</label>' +
    '<button class="nav-arena-trigger" type="button" data-arena-open>Bored?</button>' +
    businessActionsHtml;

  // ── Build the complete capsule structure ──
  var capsule = document.createElement("div");
  capsule.className = "nav-capsule";
  capsule.innerHTML =
    '<div class="nav-capsule-header">' +
      '<a class="brand" href="' + prefix + 'index.html">' +
        '<img class="brand-mark" src="' + prefix + 'assets/img/icons/flathack_icon.png" alt="" width="36" height="36">' +
        '<span class="brand-text">Flathack Projects</span>' +
      '</a>' +
      '<div class="nav-capsule-actions">' +
        (isBusinessPage ? businessActionsHtml : standardActionsHtml) +
      '</div>' +
    '</div>' +
    '<div class="nav-capsule-divider"></div>' +
    '<div class="nav-capsule-items">' + navHtml + '</div>';

  // Replace the old header with the capsule
  var siteHeader = document.querySelector(".site-header");
  if (siteHeader) {
    siteHeader.parentNode.replaceChild(capsule, siteHeader);
  } else {
    nav.parentNode.replaceChild(capsule, nav);
  }

  // ── Language toggle event listener ──
  var langToggle = capsule.querySelector(".nav-capsule-lang");
  var shipCountInput = capsule.querySelector("[data-bg-ship-count]");
  var shipCountOutput = capsule.querySelector("[data-bg-ship-output]");
  var shipCountLabel = capsule.querySelector("[data-nav-ship-label]");
  var arenaTrigger = capsule.querySelector("[data-arena-open]");

  function applyNavLanguage(lang) {
    if (shipCountLabel) shipCountLabel.textContent = lang === "de" ? "Schiffe" : "Ships";
    if (arenaTrigger) arenaTrigger.textContent = lang === "de" ? "Gelangweilt?" : "Bored?";
    if (shipCountInput && shipCountInput.parentElement) {
      shipCountInput.parentElement.title = lang === "de" ? "Anzahl der Hintergrund-Schiffe" : "Background ship count";
    }
  }

  if (shipCountInput) {
    shipCountInput.addEventListener("input", function () {
      if (shipCountOutput) shipCountOutput.textContent = shipCountInput.value;
      if (window.flathackCombatBackground && window.flathackCombatBackground.setShipTarget) {
        window.flathackCombatBackground.setShipTarget(shipCountInput.value);
      }
      window.dispatchEvent(new CustomEvent("flathack-bg-ship-count-change", { detail: { count: shipCountInput.value } }));
    });
  }

  if (arenaTrigger) {
    arenaTrigger.addEventListener("click", function () {
      openBattleArena(currentLang);
    });
  }
  langToggle.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-lang]");
    if (!btn || btn.dataset.lang === currentLang) return;
    currentLang = btn.dataset.lang;
    try { sessionStorage.setItem("flathack-lang", currentLang); } catch(e) {}
    langToggle.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.lang === currentLang);
    });
    applyNavLanguage(currentLang);
    window.dispatchEvent(new CustomEvent("lang-change", { detail: { lang: currentLang } }));
  });
  applyNavLanguage(currentLang);

  // Fire initial lang-change so pages can pick up the stored language
  window.dispatchEvent(new CustomEvent("lang-change", { detail: { lang: currentLang } }));

  // Sub-navigation for items with children (mod selector)
  if (activeItem && activeItem.children) {
    // Persist mod selection across pages via localStorage
    var storedMod = null;
    try { storedMod = localStorage.getItem("flathack-mod"); } catch(e) {}
    var hashMod = window.location.hash.replace("#", "");
    var validHashes = activeItem.children.map(function(c) { return c.hash; });
    var currentHash = (hashMod && validHashes.indexOf(hashMod) !== -1) ? hashMod
                    : (storedMod && validHashes.indexOf(storedMod) !== -1) ? storedMod
                    : activeItem.children[0].hash;

    var subNav = document.createElement("nav");
    subNav.className = "project-sub-nav";
    subNav.setAttribute("aria-label", "Mod-Auswahl");

    var modLinksHtml = activeItem.children.map(function (child) {
      var isActive = currentHash === child.hash;
      return '<a href="#' + child.hash + '"' +
        (isActive ? ' class="active"' : '') +
        ' data-mod="' + child.hash + '">' + child.label + '</a>';
    }).join("\n");

    var tradeLinksHtml = "";
    if (activeItem.href === "docs/trade-routes.html") {
      tradeLinksHtml = TRADE_SUB_LINKS.map(function (item) {
        var href = prefix + item.href + (currentHash ? ('#' + currentHash) : '');
        var isActive = current === item.href;
        return '<a href="' + href + '"' + (isActive ? ' class="active"' : '') + '>' + item.label + '</a>';
      }).join("\n");
    }

    subNav.innerHTML =
      '<div class="project-sub-nav-main">' + modLinksHtml + '</div>' +
      (tradeLinksHtml ? '<div class="project-sub-nav-side">' + tradeLinksHtml + '</div>' : '');

    // Insert sub-nav after the capsule
    capsule.parentNode.insertBefore(subNav, capsule.nextSibling);

    // Handle sub-nav clicks
    subNav.addEventListener("click", function (e) {
      var link = e.target.closest("a[data-mod]");
      if (!link) return;
      e.preventDefault();
      var mod = link.dataset.mod;
      window.location.hash = mod;
      try { localStorage.setItem("flathack-mod", mod); } catch(e) {}
      subNav.querySelectorAll("a").forEach(function (a) {
        a.classList.toggle("active", a.dataset.mod === mod);
      });
      window.dispatchEvent(new CustomEvent("mod-change", { detail: { mod: mod } }));
    });

    // Fire initial mod-change so the page loads the right data
    window.dispatchEvent(new CustomEvent("mod-change", { detail: { mod: currentHash } }));
  }
})();
