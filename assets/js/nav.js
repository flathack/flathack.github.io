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
    if (/\/help\//.test(path)) return 1;
    if (/\/guides\/[^/]+\//.test(path)) return 2;
    if (/\/guides\//.test(path)) return 1;
    return 0;
  })();
  const prefix = "../".repeat(depth);
  const isToolThemePage = document.body && document.body.classList.contains("tool-theme");

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

    var formationOffsets = [
      { dx: -45, dy: -45 },
      { dx: 45, dy: -45 },
      { dx: -80, dy: -80 },
      { dx: 80, dy: -80 },
      { dx: 0, dy: -70 },
      { dx: -35, dy: 35 },
      { dx: 35, dy: 35 },
      { dx: -115, dy: -115 },
      { dx: 115, dy: -115 }
    ];

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
        vx: Math.cos(angle) * (capital ? rand(8, 14) : rand(18, 42)),
        vy: Math.sin(angle) * (capital ? rand(8, 14) : rand(18, 42)),
        rotation: angle,
        target: null,
        hull: capital ? 1500 : police || humanFleet ? 130 : 95,
        maxHull: capital ? 1500 : police || humanFleet ? 130 : 95,
        shield: capital ? 600 : police || humanFleet ? 52 : 44,
        maxShield: capital ? 600 : police || humanFleet ? 52 : 44,
        shieldHit: 0,
        shieldHitAngle: 0,
        shieldRegenDelay: 0,
        fireCooldown: rand(0.2, 1.6),
        turnRate: capital ? 0.38 : police || humanFleet ? 2.4 : 3.0,
        speed: capital ? rand(10, 15) : police || humanFleet ? rand(46, 66) : rand(54, 78),
        radius: capital ? 36 : police || humanFleet ? 18 : 15,
        fleet: faction === "humanFleet" || faction === "humanCapital",
        respawnTimer: 0,
        thrusterActive: false,
        dogfightState: "approach",
        disengageTimer: 0,
        disengageDir: Math.random() > 0.5 ? 1 : -1,
        wobbleTime: rand(0, 100),
        escorting: null,
        formationSlot: -1
      };
    }

    function spawnReinforcement(faction, x, y) {
      var capital = faction === "humanCapital";
      var ship = spawnShip(faction);
      ship.x = x;
      ship.y = y;
      ship.vx = (Math.random() - 0.5) * 15;
      ship.vy = (Math.random() - 0.5) * 15;
      
      for (var k = 0; k < 25; k++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = rand(30, 120);
        sparks.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: rand(0.25, 0.75),
          maxLife: 0.75,
          size: rand(2.2, 4.5),
          color: "rgba(80, 200, 255, 0.95)",
          type: "spark"
        });
      }
      sparks.push({
        x: x, y: y, vx: 0, vy: 0,
        life: 0.45, maxLife: 0.45,
        size: capital ? 62 : 36,
        color: "rgba(100, 210, 255, 0.8)",
        type: "blast"
      });
      ships.push(ship);

      if (capital) {
        var escortsFound = 0;
        ships.forEach(function (other) {
          if (other.hull > 0 && other.side === "human" && other.faction !== "humanCapital" && !other.fleet && escortsFound < 6) {
            other.escorting = ship;
            other.formationSlot = escortsFound;
            escortsFound++;
          }
        });
      }
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
      var isCapital = ship.faction === "humanCapital";
      if (isCapital) {
        ships.forEach(function (other) {
          if (other === ship || other.hull <= 0 || other.side === ship.side || other.faction !== "rogue") return;
          var dx = other.x - ship.x;
          var dy = other.y - ship.y;
          var dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = other;
          }
        });
        if (best) return best;
      }
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

      ship.shieldHit = Math.max(0, ship.shieldHit - dt * 2.2);
      ship.shieldRegenDelay = Math.max(0, ship.shieldRegenDelay - dt);
      if (ship.shieldRegenDelay <= 0 && ship.shield < ship.maxShield) {
        ship.shield = Math.min(ship.maxShield, ship.shield + ship.maxShield * 0.1 * dt);
      }

      ship.target = nearestEnemy(ship);
      var desired = Math.atan2(ship.vy, ship.vx);
      var isCapital = ship.faction === "humanCapital";
      var targetSpeed = ship.speed;
      ship.thrusterActive = false;

      var border = 75;
      var steerX = 0;
      var steerY = 0;
      if (ship.x < border) steerX = 1;
      else if (ship.x > width - border) steerX = -1;
      if (ship.y < border) steerY = 1;
      else if (ship.y > height - border) steerY = -1;

      if (steerX !== 0 || steerY !== 0) {
        desired = Math.atan2(steerY, steerX);
        ship.thrusterActive = true;
      } else if (ship.shield <= 0 && ship.target) {
        var dx = ship.target.x - ship.x;
        var dy = ship.target.y - ship.y;
        desired = Math.atan2(-dy, -dx);
        desired += Math.sin(performance.now() * 0.012 + (ship.wobbleTime || 0)) * 0.7;
        ship.thrusterActive = true;
      } else if (ship.target) {
        var dx = ship.target.x - ship.x;
        var dy = ship.target.y - ship.y;
        var dist = Math.hypot(dx, dy);

        if (isCapital) {
          var orbitAngle = Math.atan2(dy, dx) + Math.PI / 2;
          desired = orbitAngle;
          targetSpeed = ship.speed * 0.65;
        } else {
          if (ship.disengageTimer > 0) {
            ship.disengageTimer -= dt;
            desired = Math.atan2(dy, dx) + (ship.disengageDir || 1) * 1.4;
            ship.thrusterActive = true;
          } else if (dist < 120) {
            ship.disengageTimer = rand(1.2, 2.2);
            ship.disengageDir = Math.random() > 0.5 ? 1 : -1;
            desired = Math.atan2(dy, dx) + ship.disengageDir * 1.4;
            ship.thrusterActive = true;
          } else {
            var pSpeed = ship.side === "human" ? 420 : 370;
            var travelTime = dist / pSpeed;
            var tx = ship.target.x + ship.target.vx * travelTime;
            var ty = ship.target.y + ship.target.vy * travelTime;
            desired = Math.atan2(ty - ship.y, tx - ship.x);
            if (dist > 300) ship.thrusterActive = true;
          }
        }
      } else if (ship.escorting && ship.escorting.hull > 0) {
        var cap = ship.escorting;
        var offset = formationOffsets[ship.formationSlot % formationOffsets.length];
        var cos = Math.cos(cap.rotation);
        var sin = Math.sin(cap.rotation);
        var tx = cap.x + (offset.dx * cos - offset.dy * sin);
        var ty = cap.y + (offset.dx * sin + offset.dy * cos);

        var fdx = tx - ship.x;
        var fdy = ty - ship.y;
        var fdist = Math.hypot(fdx, fdy);

        desired = Math.atan2(fdy, fdx);
        if (fdist > 180) {
          ship.thrusterActive = true;
        }
        if (fdist < 40) {
          targetSpeed = Math.hypot(cap.vx, cap.vy);
          desired = cap.rotation;
        }
      }

      var diff = normalize(desired - ship.rotation);
      var turn = Math.min(Math.abs(diff), ship.turnRate * dt);
      ship.rotation += Math.sign(diff) * turn;

      var currentAcc = ship.thrusterActive ? targetSpeed * 1.6 : targetSpeed;
      ship.vx += Math.cos(ship.rotation) * currentAcc * dt * 0.72;
      ship.vy += Math.sin(ship.rotation) * currentAcc * dt * 0.72;
      
      var damp = isCapital ? 0.99 : 0.985;
      ship.vx *= damp;
      ship.vy *= damp;
      
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;

      if (ship.x < -140 || ship.x > width + 140 || ship.y < -140 || ship.y > height + 140) {
        if (ship.fleet) {
          ships.splice(ships.indexOf(ship), 1);
        } else {
          Object.assign(ship, spawnShip(ship.faction));
        }
        return;
      }

      if (ship.thrusterActive && Math.random() > 0.4) {
        var backAngle = ship.rotation + Math.PI + rand(-0.2, 0.2);
        var flameOffset = isCapital ? 36 : ship.radius * 0.95;
        var px = ship.x - Math.cos(ship.rotation) * flameOffset;
        var py = ship.y - Math.sin(ship.rotation) * flameOffset;
        var pSpeed = rand(30, 80);
        sparks.push({
          x: px,
          y: py,
          vx: Math.cos(backAngle) * pSpeed + ship.vx * 0.3,
          vy: Math.sin(backAngle) * pSpeed + ship.vy * 0.3,
          life: rand(0.15, 0.35),
          maxLife: 0.35,
          size: rand(1.5, 3.2),
          color: "rgba(100, 200, 255, 0.65)",
          type: "spark"
        });
      }

      ship.fireCooldown -= dt;
      if (ship.target && ship.fireCooldown <= 0) {
        var dx = ship.target.x - ship.x;
        var dy = ship.target.y - ship.y;
        var dist = Math.hypot(dx, dy);
        var aimDiff = Math.abs(normalize(Math.atan2(dy, dx) - ship.rotation));
        var range = isCapital ? 780 : 520;
        var arc = isCapital ? Math.PI * 2 : 0.45;
        if (dist < range && aimDiff < arc) {
          fire(ship, ship.target);
          ship.fireCooldown = isCapital ? rand(0.18, 0.42) : rand(0.45, 1.15);
        } else {
          ship.fireCooldown = 0.15;
        }
      }
    }

    function fire(ship, target) {
      var angle = Math.atan2(target.y - ship.y, target.x - ship.x);
      var isCapital = ship.faction === "humanCapital";
      var speed = isCapital ? 460 : ship.side === "human" ? 420 : 370;
      
      if (isCapital) {
        var offsets = [
          { dl: -15, df: 15 },
          { dl: 15, df: 15 },
          { dl: -15, df: -10 },
          { dl: 15, df: -10 }
        ];
        var turretIndex = (ship.fireVolleyCount || 0) % 2;
        ship.fireVolleyCount = (ship.fireVolleyCount || 0) + 1;
        
        var t1 = offsets[turretIndex * 2];
        var t2 = offsets[turretIndex * 2 + 1];
        
        [t1, t2].forEach(function(t) {
          var cos = Math.cos(ship.rotation);
          var sin = Math.sin(ship.rotation);
          var tx = ship.x + (t.df * cos - t.dl * sin);
          var ty = ship.y + (t.df * sin + t.dl * cos);
          var fireAngle = Math.atan2(target.y - ty, target.x - tx);
          
          projectiles.push({
            owner: ship,
            side: ship.side,
            x: tx,
            y: ty,
            vx: Math.cos(fireAngle) * speed + ship.vx * 0.25,
            vy: Math.sin(fireAngle) * speed + ship.vy * 0.25,
            life: 1.55,
            damage: 22,
            color: ship.side === "human" ? "rgba(105, 210, 255, 0.95)" : "rgba(255, 88, 88, 0.95)"
          });
        });
      } else {
        projectiles.push({
          owner: ship,
          side: ship.side,
          x: ship.x + Math.cos(angle) * 18,
          y: ship.y + Math.sin(angle) * 18,
          vx: Math.cos(angle) * speed + ship.vx * 0.2,
          vy: Math.sin(angle) * speed + ship.vy * 0.2,
          life: 1.15,
          damage: 16,
          color: ship.side === "human" ? "rgba(105, 210, 255, 0.95)" : "rgba(255, 88, 88, 0.95)"
        });
      }
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
            var damage = p.damage;
            ship.shieldHit = 1;
            ship.shieldHitAngle = Math.atan2(p.y - ship.y, p.x - ship.x);
            ship.shieldRegenDelay = 1.8;
            sparks.push({
              x: p.x,
              y: p.y,
              vx: rand(-18, 18),
              vy: rand(-18, 18),
              life: 0.38,
              maxLife: 0.38,
              size: 3,
              color: ship.side === "human" ? "rgba(120, 220, 255, 0.95)" : "rgba(255, 120, 165, 0.95)",
              type: "shield"
            });
            if (ship.shield > 0) {
              var absorbed = Math.min(ship.shield, damage);
              ship.shield -= absorbed;
              damage -= absorbed;
              if (ship.shield <= 0) {
                for (var b = 0; b < 7; b++) {
                  sparks.push({
                    x: ship.x + Math.cos(ship.shieldHitAngle + rand(-0.9, 0.9)) * rand(ship.radius, ship.radius + 12),
                    y: ship.y + Math.sin(ship.shieldHitAngle + rand(-0.9, 0.9)) * rand(ship.radius, ship.radius + 12),
                    vx: rand(-34, 34),
                    vy: rand(-34, 34),
                    life: rand(0.25, 0.55),
                    maxLife: 0.55,
                    size: rand(1.8, 4.2),
                    color: "rgba(130, 225, 255, 0.9)",
                    type: "spark"
                  });
                }
              }
            }
            if (damage > 0) ship.hull -= damage;
            if (ship.hull <= 0) {
              ship.respawnTimer = rand(1.1, 2.4);
              createExplosion(ship);
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

    function createExplosion(ship) {
      var boomSize = ship.faction === "humanCapital" ? 2.1 : 1;
      sparks.push({
        x: ship.x,
        y: ship.y,
        vx: 0,
        vy: 0,
        life: 0.72,
        maxLife: 0.72,
        size: 28 * boomSize,
        color: "rgba(255, 220, 135, 0.95)",
        type: "blast"
      });
      sparks.push({
        x: ship.x,
        y: ship.y,
        vx: 0,
        vy: 0,
        life: 0.95,
        maxLife: 0.95,
        size: 48 * boomSize,
        color: "rgba(255, 120, 45, 0.7)",
        type: "ring"
      });
      for (var k = 0; k < 22 * boomSize; k++) {
        var angle = rand(0, Math.PI * 2);
        var speed = rand(38, 175) * boomSize;
        sparks.push({
          x: ship.x + rand(-10, 10),
          y: ship.y + rand(-10, 10),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: rand(0.35, 1.1),
          maxLife: 1.1,
          size: rand(1.6, 4.8) * boomSize,
          color: k % 4 === 0 ? "rgba(120, 210, 255, 0.85)" : "rgba(255, 185, 70, 0.95)",
          type: "spark"
        });
      }
    }

    function drawShield(ship) {
      if (ship.maxShield <= 0) return;
      var shieldRatio = Math.max(0, ship.shield / ship.maxShield);
      var baseAlpha = shieldRatio > 0 ? 0.045 + shieldRatio * 0.04 : 0;
      var flashAlpha = ship.shieldHit * 0.55;
      if (baseAlpha <= 0 && flashAlpha <= 0) return;
      var radius = ship.radius + (ship.faction === "humanCapital" ? 15 : 8);
      var color = ship.side === "human" ? "98, 210, 255" : "255, 96, 155";

      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.strokeStyle = "rgba(" + color + ", " + (baseAlpha + flashAlpha * 0.35) + ")";
      ctx.fillStyle = "rgba(" + color + ", " + (baseAlpha * 0.45 + flashAlpha * 0.12) + ")";
      ctx.lineWidth = ship.faction === "humanCapital" ? 2 : 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.12, radius * 0.92, ship.rotation, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (ship.shieldHit > 0) {
        ctx.strokeStyle = "rgba(" + color + ", " + Math.min(0.95, flashAlpha + 0.25) + ")";
        ctx.lineWidth = ship.faction === "humanCapital" ? 4 : 2.8;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.08, ship.shieldHitAngle - 0.75, ship.shieldHitAngle + 0.75);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawShip(ship) {
      if (ship.hull <= 0) return;
      var img = images[ship.sprite];
      drawShield(ship);
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.rotation + Math.PI / 2);
      ctx.globalAlpha = 0.72;
      
      var isCapital = ship.faction === "humanCapital";
      var size = isCapital ? 64 : ship.side === "human" ? 30 : 27;

      // Draw thruster plume
      var isThruster = ship.thrusterActive;
      var rx = 0;
      var ry = isCapital ? size * 0.44 : size * 0.42;
      var flameLength = (isThruster ? rand(22, 38) : rand(8, 15)) * (isCapital ? 1.6 : 1);
      var flameWidth = (isThruster ? rand(7, 12) : rand(4, 7)) * (isCapital ? 1.6 : 1);
      
      var flameGrad = ctx.createLinearGradient(0, ry, 0, ry + flameLength);
      if (isThruster) {
        flameGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        flameGrad.addColorStop(0.2, "rgba(100, 200, 255, 0.95)");
        flameGrad.addColorStop(0.6, "rgba(30, 100, 255, 0.6)");
        flameGrad.addColorStop(1, "rgba(0, 50, 255, 0)");
      } else {
        flameGrad.addColorStop(0, "rgba(255, 230, 140, 0.95)");
        flameGrad.addColorStop(0.3, "rgba(255, 120, 30, 0.85)");
        flameGrad.addColorStop(1, "rgba(255, 50, 0, 0)");
      }
      
      ctx.save();
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-flameWidth / 2, ry);
      ctx.quadraticCurveTo(0, ry + flameLength * 1.1, 0, ry + flameLength);
      ctx.quadraticCurveTo(0, ry + flameLength * 1.1, flameWidth / 2, ry);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = isThruster ? "rgba(230, 245, 255, 0.95)" : "rgba(255, 255, 200, 0.95)";
      ctx.beginPath();
      ctx.ellipse(0, ry + 2, flameWidth * 0.35, flameLength * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (img && img.complete) {
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
        s.x += (s.vx || 0) * dt;
        s.y += (s.vy || 0) * dt;
        if (s.type === "ring") {
          var ringProgress = 1 - s.life / s.maxLife;
          ctx.globalAlpha = Math.max(0, s.life / s.maxLife) * 0.8;
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 8 + ringProgress * s.size, 0, Math.PI * 2);
          ctx.stroke();
        } else if (s.type === "blast") {
          var blastProgress = 1 - s.life / s.maxLife;
          var gradient = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 8 + blastProgress * s.size);
          gradient.addColorStop(0, "rgba(255, 255, 230, 0.95)");
          gradient.addColorStop(0.35, s.color);
          gradient.addColorStop(1, "rgba(255, 80, 20, 0)");
          ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 8 + blastProgress * s.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = Math.max(0, s.life / (s.maxLife || 1));
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size || (2 + (1 - s.life) * 5), 0, Math.PI * 2);
          ctx.fill();
        }
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
    window.addEventListener("click", function (e) {
      if (!canvas || !canvas.parentNode) return;
      if (e.target.closest("a, button, input, select, label, canvas, [role='button'], .battle-arena-panel")) return;
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      spawnReinforcement("police", x, y);
    });
    window.addEventListener("dblclick", function (e) {
      if (!canvas || !canvas.parentNode) return;
      if (e.target.closest("a, button, input, select, label, canvas, [role='button'], .battle-arena-panel")) return;
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      spawnReinforcement("humanCapital", x, y);
    });

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
        subtitle: "Four factions, capital ships, everyone against everyone.",
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
    if (lang === "de") text.subtitle = "Vier Fraktionen, Grosskampfschiffe, alle gegeneinander.";
    var factions = [
      { id: "libertyNavy", name: "Liberty Navy", sprite: "li_elite", capital: "cf_li_cruiser", color: "rgba(94, 203, 255, 0.96)", corner: [0.18, 0.22] },
      { id: "rheinlandNavy", name: "Rheinland Navy", sprite: "rh_elite", capital: "cf_rh_cruiser", color: "rgba(255, 203, 89, 0.96)", corner: [0.82, 0.22] },
      { id: "bretoniaNavy", name: "Bretonia Armed Forces", sprite: "br_elite", capital: "cf_br_destroyer", color: "rgba(88, 255, 160, 0.96)", corner: [0.18, 0.78] },
      { id: "kusariNavy", name: "Kusari Naval Forces", sprite: "ku_elite", capital: "cf_ku_destroyer", color: "rgba(210, 130, 255, 0.96)", corner: [0.82, 0.78] }
    ];
    var assetMap = {
      br_elite: "br_elite.png",
      cf_br_destroyer: "cf_br_destroyer.png",
      cf_ku_destroyer: "cf_ku_destroyer.png",
      cf_li_cruiser: "cf_li_cruiser.png",
      cf_rh_cruiser: "cf_rh_cruiser.png",
      ku_elite: "ku_elite.png",
      li_elite: "li_elite.png",
      rh_elite: "rh_elite.png"
    };
    var images = {};
    Object.keys(assetMap).forEach(function (key) {
      var img = new Image();
      img.src = prefix + "freelancer2d/data/ship_icons/" + assetMap[key];
      images[key] = img;
    });

    var bgImage = new Image();
    bgImage.src = prefix + "assets/img/home/space-nebula-wallpaper.webp";
    var factionCards = factions.map(function (faction) {
      return '<div class="battle-arena-faction" style="border-color:' + faction.color + ';"><strong>' + faction.name + '</strong><span>1 Battleship + Escorts</span></div>';
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
          factionCards +
          '<button type="button" data-arena-start>' + text.start + '</button>' +
          '<button type="button" data-arena-reset>' + text.reset + '</button>' +
        '</div>' +
        '<div class="battle-arena-stage"><canvas tabindex="0"></canvas><div class="battle-arena-status" data-arena-status></div></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var canvas = overlay.querySelector("canvas");
    var ctx = canvas.getContext("2d");
    var status = overlay.querySelector("[data-arena-status]");
    var width = 0;
    var height = 0;
    var dpr = 1;
    var last = performance.now();
    var ships = [];
    var shots = [];
    var sparks = [];
    var running = true;
    var shipsPerFaction = 10;
    var stars = [];

    function factionById(id) {
      return factions.find(function (faction) { return faction.id === id; }) || factions[0];
    }
    function rand(min, max) { return min + Math.random() * (max - min); }
    function normalize(angle) {
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      return angle;
    }
    var arenaFormationOffsets = [
      { dx: -45, dy: -45 },
      { dx: 45, dy: -45 },
      { dx: -80, dy: -80 },
      { dx: 80, dy: -80 },
      { dx: 0, dy: -70 },
      { dx: -35, dy: 35 },
      { dx: 35, dy: 35 },
      { dx: -115, dy: -115 },
      { dx: 115, dy: -115 }
    ];
    function resizeArena() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: 260 }, function (_, i) {
        return {
          x: ((i * 9301 + 49297) % 233280) / 233280 * width,
          y: ((i * 7919 + 13257) % 259459) / 259459 * height,
          r: 0.5 + ((i * 17) % 28) / 18,
          a: 0.22 + ((i * 13) % 70) / 100
        };
      });
    }

    function spawnFleet(faction, count) {
      var sideX = width * faction.corner[0];
      var sideY = height * faction.corner[1];
      var capitalShip = null;
      for (var i = 0; i < count; i++) {
        var isCapital = i === 0;
        var sprite = isCapital ? faction.capital : faction.sprite;
        var hull = isCapital ? 2000 : 130;
        var shield = isCapital ? 800 : 82;
        var spawnAngle = Math.atan2(height * 0.5 - sideY, width * 0.5 - sideX);
        var ship = {
          faction: faction,
          sprite: sprite,
          x: sideX + rand(-90, 90),
          y: sideY + rand(-70, 70),
          vx: Math.cos(spawnAngle) * (isCapital ? rand(6, 12) : rand(15, 34)),
          vy: rand(-18, 18),
          rotation: spawnAngle,
          hull: hull,
          maxHull: hull,
          shield: shield,
          maxShield: shield,
          shieldHit: 0,
          shieldHitAngle: 0,
          shieldRegenDelay: 0,
          radius: isCapital ? 42 : 17,
          size: isCapital ? 86 : 34,
          cooldown: rand(0.2, 1.2),
          isCapital: isCapital,
          alive: true,
          thrusterActive: false,
          dogfightState: "approach",
          disengageTimer: 0,
          disengageDir: Math.random() > 0.5 ? 1 : -1,
          wobbleTime: rand(0, 100),
          escorting: null,
          formationSlot: -1,
          turnRate: isCapital ? 0.38 : 2.5,
          speed: isCapital ? rand(10, 14) : rand(50, 72)
        };
        if (isCapital) {
          capitalShip = ship;
        } else {
          ship.escorting = capitalShip;
          ship.formationSlot = i - 1;
        }
        ships.push(ship);
      }
    }
    function startArena() {
      ships = [];
      shots = [];
      sparks = [];
      status.textContent = "";
      factions.forEach(function (faction) {
        spawnFleet(faction, shipsPerFaction);
      });
      running = true;
    }
    function nearestEnemy(ship) {
      var best = null;
      var bestDist = Infinity;
      if (ship.isCapital) {
        ships.forEach(function (other) {
          if (!other.alive || other.faction.id === ship.faction.id || !other.isCapital) return;
          var dx = other.x - ship.x;
          var dy = other.y - ship.y;
          var dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = other;
          }
        });
        if (best) return best;
      }
      ships.forEach(function (other) {
        if (!other.alive || other.faction.id === ship.faction.id) return;
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
      
      if (ship.isCapital) {
        var offsets = [
          { dl: -18, df: 20 },
          { dl: 18, df: 20 },
          { dl: -18, df: -12 },
          { dl: 18, df: -12 }
        ];
        var turretIndex = (ship.fireVolleyCount || 0) % 2;
        ship.fireVolleyCount = (ship.fireVolleyCount || 0) + 1;
        
        var t1 = offsets[turretIndex * 2];
        var t2 = offsets[turretIndex * 2 + 1];
        
        [t1, t2].forEach(function(t) {
          var cos = Math.cos(ship.rotation);
          var sin = Math.sin(ship.rotation);
          var tx = ship.x + (t.df * cos - t.dl * sin);
          var ty = ship.y + (t.df * sin + t.dl * cos);
          var fireAngle = Math.atan2(target.y - ty, target.x - tx);
          
          shots.push({
            factionId: ship.faction.id,
            x: tx,
            y: ty,
            vx: Math.cos(fireAngle) * 520 + ship.vx * 0.25,
            vy: Math.sin(fireAngle) * 520 + ship.vy * 0.25,
            life: 1.05,
            damage: 22,
            color: ship.faction.color
          });
        });
      } else {
        shots.push({
          factionId: ship.faction.id,
          x: ship.x + Math.cos(angle) * 18,
          y: ship.y + Math.sin(angle) * 18,
          vx: Math.cos(angle) * 520 + ship.vx * 0.2,
          vy: Math.sin(angle) * 520 + ship.vy * 0.2,
          life: 1.05,
          damage: 14,
          color: ship.faction.color
        });
      }
    }
    function updateArena(dt) {
      var aliveByFaction = {};
      ships.forEach(function (ship) {
        if (!ship.alive) return;
        aliveByFaction[ship.faction.id] = (aliveByFaction[ship.faction.id] || 0) + 1;
        ship.shieldHit = Math.max(0, ship.shieldHit - dt * 2.3);
        ship.shieldRegenDelay = Math.max(0, ship.shieldRegenDelay - dt);
        if (ship.shieldRegenDelay <= 0 && ship.shield < ship.maxShield) {
          ship.shield = Math.min(ship.maxShield, ship.shield + ship.maxShield * 0.11 * dt);
        }

        var target = nearestEnemy(ship);
        
        var desired = Math.atan2(ship.vy, ship.vx);
        var targetSpeed = ship.speed;
        ship.thrusterActive = false;

        var border = 65;
        var steerX = 0;
        var steerY = 0;
        if (ship.x < border) steerX = 1;
        else if (ship.x > width - border) steerX = -1;
        if (ship.y < border) steerY = 1;
        else if (ship.y > height - border) steerY = -1;

        if (steerX !== 0 || steerY !== 0) {
          desired = Math.atan2(steerY, steerX);
          ship.thrusterActive = true;
        } else if (ship.shield <= 0 && target) {
          var dx = target.x - ship.x;
          var dy = target.y - ship.y;
          desired = Math.atan2(-dy, -dx);
          desired += Math.sin(performance.now() * 0.015 + (ship.wobbleTime || 0)) * 0.7;
          ship.thrusterActive = true;
        } else if (target) {
          var dx = target.x - ship.x;
          var dy = target.y - ship.y;
          var dist = Math.hypot(dx, dy);

          if (ship.isCapital) {
            var orbitAngle = Math.atan2(dy, dx) + Math.PI / 2;
            desired = orbitAngle;
            targetSpeed = ship.speed * 0.65;
          } else {
            if (ship.disengageTimer > 0) {
              ship.disengageTimer -= dt;
              desired = Math.atan2(dy, dx) + (ship.disengageDir || 1) * 1.4;
              ship.thrusterActive = true;
            } else if (dist < 120) {
              ship.disengageTimer = rand(1.2, 2.2);
              ship.disengageDir = Math.random() > 0.5 ? 1 : -1;
              desired = Math.atan2(dy, dx) + ship.disengageDir * 1.4;
              ship.thrusterActive = true;
            } else {
              var travelTime = dist / 520;
              var tx = target.x + target.vx * travelTime;
              var ty = target.y + target.vy * travelTime;
              desired = Math.atan2(ty - ship.y, tx - ship.x);
              if (dist > 300) ship.thrusterActive = true;
            }
          }
        } else if (ship.escorting && ship.escorting.alive) {
          var cap = ship.escorting;
          var offset = arenaFormationOffsets[ship.formationSlot % arenaFormationOffsets.length];
          var cos = Math.cos(cap.rotation);
          var sin = Math.sin(cap.rotation);
          var tx = cap.x + (offset.dx * cos - offset.dy * sin);
          var ty = cap.y + (offset.dx * sin + offset.dy * cos);

          var fdx = tx - ship.x;
          var fdy = ty - ship.y;
          var fdist = Math.hypot(fdx, fdy);

          desired = Math.atan2(fdy, fdx);

          if (fdist > 180) {
            ship.thrusterActive = true;
          }

          if (fdist < 40) {
            targetSpeed = Math.hypot(cap.vx, cap.vy);
            desired = cap.rotation;
          }
        }

        var diff = normalize(desired - ship.rotation);
        var turn = Math.min(Math.abs(diff), ship.turnRate * dt);
        ship.rotation += Math.sign(diff) * turn;

        var currentAcc = ship.thrusterActive ? targetSpeed * 1.6 : targetSpeed;
        ship.vx += Math.cos(ship.rotation) * currentAcc * dt * 0.72;
        ship.vy += Math.sin(ship.rotation) * currentAcc * dt * 0.72;

        var damp = ship.isCapital ? 0.99 : 0.985;
        ship.vx *= damp;
        ship.vy *= damp;
        
        ship.x = Math.max(20, Math.min(width - 20, ship.x + ship.vx * dt));
        ship.y = Math.max(20, Math.min(height - 20, ship.y + ship.vy * dt));

        if (ship.thrusterActive && Math.random() > 0.4) {
          var backAngle = ship.rotation + Math.PI + rand(-0.2, 0.2);
          var flameOffset = ship.isCapital ? 40 : ship.radius * 0.95;
          var px = ship.x - Math.cos(ship.rotation) * flameOffset;
          var py = ship.y - Math.sin(ship.rotation) * flameOffset;
          var pSpeed = rand(30, 80);
          sparks.push({
            x: px,
            y: py,
            vx: Math.cos(backAngle) * pSpeed + ship.vx * 0.3,
            vy: Math.sin(backAngle) * pSpeed + ship.vy * 0.3,
            life: rand(0.15, 0.35),
            maxLife: 0.35,
            size: rand(1.5, 3.2),
            color: ship.faction.color,
            type: "spark"
          });
        }

        ship.cooldown -= dt;
        if (target && ship.cooldown <= 0) {
          var dist = Math.hypot(target.x - ship.x, target.y - ship.y);
          var aim = Math.abs(normalize(Math.atan2(target.y - ship.y, target.x - ship.x) - ship.rotation));
          var range = ship.isCapital ? 700 : 560;
          var arc = ship.isCapital ? Math.PI * 2 : 0.55;
          if (dist < range && aim < arc) {
            fire(ship, target);
            ship.cooldown = ship.isCapital ? rand(0.16, 0.34) : rand(0.38, 0.85);
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
          if (remove || !ship.alive || ship.faction.id === shot.factionId) return;
          if (Math.hypot(ship.x - shot.x, ship.y - shot.y) < ship.radius + 4) {
            var damage = shot.damage;
            ship.shieldHit = 1;
            ship.shieldHitAngle = Math.atan2(shot.y - ship.y, shot.x - shot.x);
            ship.shieldRegenDelay = 1.7;
            sparks.push({ x: shot.x, y: shot.y, vx: rand(-22, 22), vy: rand(-22, 22), life: 0.38, maxLife: 0.38, size: 3, color: ship.faction.color, type: "shield" });
            if (ship.shield > 0) {
              var absorbed = Math.min(ship.shield, damage);
              ship.shield -= absorbed;
              damage -= absorbed;
            }
            if (damage > 0) ship.hull -= damage;
            if (ship.hull <= 0) {
              ship.alive = false;
              createArenaExplosion(ship);
            }
            remove = true;
          }
        });
        if (remove || shot.x < -40 || shot.x > width + 40 || shot.y < -40 || shot.y > height + 40) shots.splice(i, 1);
      }
      var activeFactions = Object.keys(aliveByFaction);
      if (running && activeFactions.length <= 1) {
        running = false;
        var winner = activeFactions.length ? factionById(activeFactions[0]).name : "No survivors";
        status.textContent = text.victory + ": " + winner;
      }
    }

    function createArenaExplosion(ship) {
      var scale = ship.isCapital ? 2.2 : 1;
      sparks.push({ x: ship.x, y: ship.y, vx: 0, vy: 0, life: 0.72, maxLife: 0.72, size: 30 * scale, color: "rgba(255, 220, 135, 0.96)", type: "blast" });
      sparks.push({ x: ship.x, y: ship.y, vx: 0, vy: 0, life: 0.95, maxLife: 0.95, size: 52 * scale, color: "rgba(255, 120, 45, 0.72)", type: "ring" });
      for (var k = 0; k < 20 * scale; k++) {
        var angle = rand(0, Math.PI * 2);
        var speed = rand(42, 180) * scale;
        sparks.push({
          x: ship.x + rand(-12, 12),
          y: ship.y + rand(-12, 12),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: rand(0.35, 1.15),
          maxLife: 1.15,
          size: rand(1.5, 4.8) * scale,
          color: k % 5 === 0 ? ship.faction.color : "rgba(255, 185, 70, 0.94)",
          type: "spark"
        });
      }
    }

    function drawArenaBackground(now) {
      if (bgImage.complete && bgImage.naturalWidth) {
        ctx.globalAlpha = 0.72;
        ctx.drawImage(bgImage, 0, 0, width, height);
        ctx.globalAlpha = 1;
      } else {
        var gradient = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.5, width);
        gradient.addColorStop(0, "#173052");
        gradient.addColorStop(0.55, "#0b1730");
        gradient.addColorStop(1, "#030814");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.fillStyle = "rgba(1, 5, 12, 0.52)";
      ctx.fillRect(0, 0, width, height);
      stars.forEach(function (star) {
        var twinkle = 0.75 + Math.sin(now * 0.0015 + star.x) * 0.25;
        ctx.globalAlpha = star.a * twinkle;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    function drawArenaShield(ship) {
      if (ship.maxShield <= 0) return;
      var ratio = Math.max(0, ship.shield / ship.maxShield);
      var flash = ship.shieldHit * 0.55;
      var alpha = ratio > 0 ? 0.05 + ratio * 0.05 : 0;
      if (alpha <= 0 && flash <= 0) return;
      var radius = ship.radius + (ship.isCapital ? 18 : 8);
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.strokeStyle = ship.faction.color.replace("0.96", String(alpha + flash * 0.35));
      ctx.fillStyle = ship.faction.color.replace("0.96", String(alpha * 0.45 + flash * 0.12));
      ctx.lineWidth = ship.isCapital ? 2.4 : 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.15, radius * 0.92, ship.rotation, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (ship.shieldHit > 0) {
        ctx.strokeStyle = ship.faction.color;
        ctx.lineWidth = ship.isCapital ? 4 : 2.6;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.08, ship.shieldHitAngle - 0.75, ship.shieldHitAngle + 0.75);
        ctx.stroke();
      }
      ctx.restore();
    }
    function drawArena(now) {
      if (!document.body.contains(overlay)) return;
      var dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);
      drawArenaBackground(now);
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
        spark.x += (spark.vx || 0) * dt;
        spark.y += (spark.vy || 0) * dt;
        if (spark.type === "ring") {
          var ringProgress = 1 - spark.life / spark.maxLife;
          ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife) * 0.78;
          ctx.strokeStyle = spark.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, 10 + ringProgress * spark.size, 0, Math.PI * 2);
          ctx.stroke();
        } else if (spark.type === "blast") {
          var blastProgress = 1 - spark.life / spark.maxLife;
          var boom = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, 8 + blastProgress * spark.size);
          boom.addColorStop(0, "rgba(255, 255, 230, 0.95)");
          boom.addColorStop(0.35, spark.color);
          boom.addColorStop(1, "rgba(255, 80, 20, 0)");
          ctx.globalAlpha = Math.max(0, spark.life / spark.maxLife);
          ctx.fillStyle = boom;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, 8 + blastProgress * spark.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = Math.max(0, spark.life / (spark.maxLife || 1));
          ctx.fillStyle = spark.color;
          ctx.beginPath();
          ctx.arc(spark.x, spark.y, spark.size || (2 + (1 - spark.life) * 6), 0, Math.PI * 2);
          ctx.fill();
        }
        if (spark.life <= 0) sparks.splice(i, 1);
      }
      ctx.globalAlpha = 1;
      ships.forEach(function (ship) {
        if (!ship.alive) return;
        var img = images[ship.sprite];
        drawArenaShield(ship);
        ctx.save();
        ctx.translate(ship.x, ship.y);
        ctx.rotate(ship.rotation + Math.PI / 2);
        ctx.shadowColor = ship.faction.color;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = 0.95;

        // Draw thruster plume in Arena
        var isThruster = ship.thrusterActive;
        var ry = ship.isCapital ? ship.size * 0.44 : ship.size * 0.42;
        var flameLength = (isThruster ? rand(22, 38) : rand(8, 15)) * (ship.isCapital ? 1.6 : 1);
        var flameWidth = (isThruster ? rand(7, 12) : rand(4, 7)) * (ship.isCapital ? 1.6 : 1);
        
        var flameGrad = ctx.createLinearGradient(0, ry, 0, ry + flameLength);
        if (isThruster) {
          flameGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
          flameGrad.addColorStop(0.2, ship.faction.color);
          flameGrad.addColorStop(0.6, ship.faction.color.replace("0.96", "0.6"));
          flameGrad.addColorStop(1, ship.faction.color.replace("0.96", "0"));
        } else {
          flameGrad.addColorStop(0, "rgba(255, 230, 140, 0.95)");
          flameGrad.addColorStop(0.3, "rgba(255, 120, 30, 0.85)");
          flameGrad.addColorStop(1, "rgba(255, 50, 0, 0)");
        }
        
        ctx.save();
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-flameWidth / 2, ry);
        ctx.quadraticCurveTo(0, ry + flameLength * 1.1, 0, ry + flameLength);
        ctx.quadraticCurveTo(0, ry + flameLength * 1.1, flameWidth / 2, ry);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = isThruster ? "rgba(230, 245, 255, 0.95)" : "rgba(255, 255, 200, 0.95)";
        ctx.beginPath();
        ctx.ellipse(0, ry + 2, flameWidth * 0.35, flameLength * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

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
    startArena();
    requestAnimationFrame(drawArena);
    canvas.focus();
  }

  if (!isToolThemePage) initCombatBackground();

  // Build current page's canonical path segment for matching
  const segments = path.split("/");
  const fileName = segments.pop() || "index.html";
  const folder = segments.pop() || "";
  const current = (function () {
    if (/\/guides\/[^/]+\//.test(path)) return "guides/" + folder + "/" + fileName;
    return folder && folder !== "" && !/flathack\.github\.io/i.test(folder)
      ? folder + "/" + fileName
      : fileName;
  })();

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
  var compactActionsHtml =
    '<a class="nav-capsule-help" href="' + prefix + 'help/index.html" title="Help">?</a>' +
    '<div class="nav-capsule-lang" data-lang="' + currentLang + '">' + langToggleHtml + '</div>';
  var standardActionsHtml =
    '<label class="nav-ship-control" title="Background ship count">' +
      '<span data-nav-ship-label>Ships</span>' +
      '<input type="range" min="0" max="36" step="1" value="' + savedShipCount + '" data-bg-ship-count>' +
      '<output data-bg-ship-output>' + savedShipCount + '</output>' +
    '</label>' +
    '<button class="nav-arena-trigger" type="button" data-arena-open>Bored?</button>' +
    compactActionsHtml;

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
        (isToolThemePage ? compactActionsHtml : standardActionsHtml) +
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
