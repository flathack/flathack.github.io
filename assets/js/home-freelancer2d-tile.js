(() => {
  const canvas = document.getElementById("freelancer2d-tile");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const assetPaths = {
    traderLiberty: "freelancer2d/data/ship_icons/li_freighter.png",
    traderBretonia: "freelancer2d/data/ship_icons/br_freighter.png",
    traderRheinland: "freelancer2d/data/ship_icons/rh_freighter.png",
    civilianLiberty: "freelancer2d/data/ship_icons/li_fighter.png",
    civilianBorder: "freelancer2d/data/ship_icons/bw_fighter.png",
    pirateRogue: "freelancer2d/data/ship_icons/pi_fighter.png",
    pirateCorsair: "freelancer2d/data/ship_icons/co_fighter.png",
    policeLiberty: "freelancer2d/data/ship_icons/li_elite.png",
    policeBountyHunter: "freelancer2d/data/ship_icons/bh_elite.png",
    station: "freelancer2d/data/vanilla-en/object_icons/smallstation1.png",
    dockRing: "freelancer2d/data/vanilla-en/object_icons/dock_ring.png",
    newark: "freelancer2d/data/vanilla-en/object_icons/space_shipping01.png",
    manhattanTexture: "freelancer2d/data/planet_textures/planet_earthgrncld_4000.png",
    tradeLane: "freelancer2d/data/vanilla-en/object_icons/trade_lane_ring.png",
  };
  const roleSprites = {
    trader: ["traderLiberty", "traderBretonia", "traderRheinland"],
    civilian: ["civilianLiberty", "civilianBorder"],
    pirate: ["pirateRogue", "pirateCorsair"],
    police: ["policeLiberty", "policeBountyHunter"],
  };
  const spriteNames = {
    traderLiberty: "Rhino",
    traderBretonia: "Clydesdale",
    traderRheinland: "Humpback",
    civilianLiberty: "Patriot",
    civilianBorder: "Dagger",
    pirateRogue: "Bloodhound",
    pirateCorsair: "Legionnaire",
    policeLiberty: "Defender",
    policeBountyHunter: "Barracuda",
  };
  const roles = ["trader", "trader", "civilian", "civilian", "pirate", "police"];
  const colors = {
    trader: "#44aa44",
    pirate: "#aa4444",
    police: "#4444aa",
    civilian: "#888888",
    miner: "#aa8844",
  };
  let width = 640;
  let height = 300;
  let last = performance.now();
  let ships = [];
  let stars = [];
  let images = {};
  let raf = 0;

  function loadImages() {
    Object.entries(assetPaths).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        images[key] = img;
      };
    });
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function shipNameForSprite(sprite) {
    return spriteNames[sprite] || "Starflier";
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, Math.floor(rect.width));
    height = Math.max(220, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stars = Array.from({ length: 115 }, (_, i) => ({
      x: ((i * 9301 + 49297) % 233280) / 233280 * width,
      y: ((i * 7919 + 13257) % 259459) / 259459 * height,
      r: 0.45 + ((i * 17) % 22) / 16,
      a: 0.22 + ((i * 13) % 70) / 100,
    }));
  }

  let lasers = [];
  let sparks = [];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function getTraderPathNodes() {
    const manhattan = { x: width * 0.5, y: height * 0.34 };
    const newark = { x: width * 0.83, y: height * 0.24 };
    
    const laneStartX = width * 0.79;
    const laneStartY = height * 0.15;
    const laneEndX = width * 0.94;
    const laneEndY = height * 0.04;
    
    const ring0 = { x: laneStartX, y: laneStartY };
    const ring1 = { x: laneStartX + (laneEndX - laneStartX) / 3, y: laneStartY + (laneEndY - laneStartY) / 3 };
    const ring2 = { x: laneStartX + (laneEndX - laneStartX) * 2 / 3, y: laneStartY + (laneEndY - laneStartY) * 2 / 3 };
    const ring3 = { x: laneEndX, y: laneEndY };
    
    return [
      manhattan,
      ring0,
      ring1,
      ring2,
      ring3,
      newark,
      ring3,
      ring2,
      ring1,
      ring0,
      manhattan
    ];
  }

  function getTradeLaneRingPos(ringIndex) {
    const laneStartX = width * 0.79;
    const laneStartY = height * 0.15;
    const laneEndX = width * 0.94;
    const laneEndY = height * 0.04;
    const t = ringIndex / 3;
    return {
      x: laneStartX + (laneEndX - laneStartX) * t,
      y: laneStartY + (laneEndY - laneStartY) * t
    };
  }

  function spawnNPC(fromEdge = false) {
    const role = pick(roles);
    const side = fromEdge ? Math.floor(Math.random() * 4) : -1;
    let x = Math.random() * width;
    let y = height * 0.36 + Math.random() * height * 0.62;
    let targetX = Math.random() * width;
    let targetY = Math.random() * height;

    if (side === 0) { x = -40; y = Math.random() * height; targetX = width + 80; }
    if (side === 1) { x = width + 40; y = Math.random() * height; targetX = -80; }
    if (side === 2) { y = -40; x = Math.random() * width; targetY = height + 80; }
    if (side === 3) { y = height + 40; x = Math.random() * width; targetY = -80; }

    const angle = Math.atan2(targetY - y, targetX - x);
    const maxSpeed = {
      trader: 42,
      pirate: 65,
      police: 58,
      civilian: 44,
    }[role] || 46;

    const sprite = pick(roleSprites[role] || ["civilianLiberty"]);
    const radius = role === "trader" ? 18 : 14;
    const maxHull = role === "trader" ? 160 : role === "pirate" ? 110 : role === "police" ? 130 : 90;

    return {
      role,
      name: shipNameForSprite(sprite),
      sprite,
      x,
      y,
      rotation: angle,
      targetAngle: angle,
      speed: maxSpeed * (0.75 + Math.random() * 0.4),
      turnRate: role === "trader" ? 1.4 : 2.4 + Math.random() * 0.8,
      throttle: 0.5 + Math.random() * 0.4,
      drift: Math.random() * Math.PI * 2,
      radius: radius,
      minimapColor: colors[role] || "#888888",
      vx: Math.cos(angle) * maxSpeed,
      vy: Math.sin(angle) * maxSpeed,
      hull: maxHull,
      maxHull: maxHull,
      shieldHit: 0,
      shieldRegenDelay: 0,
      fireCooldown: Math.random() * 1.5,
      panicTimer: 0,
      disengageTimer: 0,
      disengageDir: Math.random() > 0.5 ? 1 : -1,
      targetShip: null,
      pathNodeIndex: Math.floor(Math.random() * 11),
      patrolTimer: Math.random() * 4.0,
      thrusterActive: false,
      respawnTimer: 0
    };
  }

  function resetShips() {
    ships = Array.from({ length: 6 }, () => spawnNPC(false));
    lasers = [];
    sparks = [];
  }

  function updateNPC(npc, dt) {
    if (npc.hull <= 0) {
      npc.respawnTimer -= dt;
      if (npc.respawnTimer <= 0) {
        Object.assign(npc, spawnNPC(true));
      }
      return;
    }

    npc.shieldHit = Math.max(0, npc.shieldHit - dt * 2.0);
    npc.shieldRegenDelay = Math.max(0, npc.shieldRegenDelay - dt);
    
    let tx = width * 0.5;
    let ty = height * 0.5;
    let desiredAngle = npc.rotation;
    let speedMult = 1.0;
    npc.thrusterActive = false;

    let bestTarget = null;
    let bestDist = Infinity;

    if (npc.role === "pirate") {
      for (let other of ships) {
        if (other.hull <= 0 || other === npc) continue;
        if (other.role === "trader" || other.role === "civilian" || other.role === "police") {
          let dist = Math.hypot(other.x - npc.x, other.y - npc.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestTarget = other;
          }
        }
      }
      if (bestDist < 160 || (npc.targetShip && npc.targetShip.hull > 0 && bestDist < 240)) {
        npc.targetShip = bestTarget;
      } else {
        npc.targetShip = null;
      }
    } else if (npc.role === "police") {
      for (let other of ships) {
        if (other.hull <= 0 || other === npc) continue;
        if (other.role === "pirate") {
          let dist = Math.hypot(other.x - npc.x, other.y - npc.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestTarget = other;
          }
        }
      }
      if (bestDist < 200 || (npc.targetShip && npc.targetShip.hull > 0 && bestDist < 280)) {
        npc.targetShip = bestTarget;
      } else {
        npc.targetShip = null;
      }
    }

    if (npc.role === "trader") {
      let attacker = null;
      let attackerDist = Infinity;
      for (let other of ships) {
        if (other.hull > 0 && other.role === "pirate") {
          let dist = Math.hypot(other.x - npc.x, other.y - npc.y);
          if (dist < attackerDist) {
            attackerDist = dist;
            attacker = other;
          }
        }
      }
      
      if (attackerDist < 130) {
        npc.panicTimer = 3.5;
      }

      if (npc.panicTimer > 0) {
        npc.panicTimer -= dt;
        npc.thrusterActive = true;
        speedMult = 2.0;
        let manhattan = { x: width * 0.5, y: height * 0.34 };
        let newark = { x: width * 0.83, y: height * 0.24 };
        let dMan = Math.hypot(manhattan.x - npc.x, manhattan.y - npc.y);
        let dNew = Math.hypot(newark.x - npc.x, newark.y - npc.y);
        let escapeTarget = dMan < dNew ? manhattan : newark;
        
        tx = escapeTarget.x;
        ty = escapeTarget.y;
        desiredAngle = Math.atan2(ty - npc.y, tx - npc.x);
      } else {
        const nodes = getTraderPathNodes();
        let currNode = nodes[npc.pathNodeIndex % nodes.length];
        tx = currNode.x;
        ty = currNode.y;
        
        let dist = Math.hypot(tx - npc.x, ty - npc.y);
        if (dist < 25) {
          npc.pathNodeIndex = (npc.pathNodeIndex + 1) % nodes.length;
        }
        desiredAngle = Math.atan2(ty - npc.y, tx - npc.x);
      }

    } else if (npc.role === "pirate") {
      if (npc.targetShip && npc.targetShip.hull > 0) {
        let target = npc.targetShip;
        let dx = target.x - npc.x;
        let dy = target.y - npc.y;
        let dist = Math.hypot(dx, dy);

        if (npc.disengageTimer > 0) {
          npc.disengageTimer -= dt;
          desiredAngle = Math.atan2(dy, dx) + npc.disengageDir * 1.4;
          npc.thrusterActive = true;
        } else if (dist < 80) {
          npc.disengageTimer = rand(1.0, 1.8);
          npc.disengageDir = Math.random() > 0.5 ? 1 : -1;
          desiredAngle = Math.atan2(dy, dx) + npc.disengageDir * 1.4;
          npc.thrusterActive = true;
        } else {
          let pSpeed = 380;
          let travelTime = dist / pSpeed;
          let tx = target.x + target.vx * travelTime;
          let ty = target.y + target.vy * travelTime;
          desiredAngle = Math.atan2(ty - npc.y, tx - npc.x);
          if (dist > 180) npc.thrusterActive = true;
        }

        npc.fireCooldown -= dt;
        if (npc.fireCooldown <= 0) {
          let aimDiff = Math.abs(normalizeAngle(Math.atan2(dy, dx) - npc.rotation));
          if (dist < 320 && aimDiff < 0.5) {
            lasers.push({
              ownerRole: "pirate",
              x: npc.x + Math.cos(npc.rotation) * 12,
              y: npc.y + Math.sin(npc.rotation) * 12,
              vx: Math.cos(npc.rotation) * 380 + npc.vx * 0.15,
              vy: Math.sin(npc.rotation) * 380 + npc.vy * 0.15,
              life: 0.95,
              damage: 15,
              color: "#ff3333"
            });
            npc.fireCooldown = 0.6 + Math.random() * 0.6;
          }
        }
      } else {
        let neb1 = { x: width * 0.28, y: height * 0.5 };
        let neb2 = { x: width * 0.72, y: height * 0.42 };
        let lurkTarget = (npc.wobbleTime % 2 === 0) ? neb1 : neb2;
        
        tx = lurkTarget.x + Math.sin(npc.drift) * 60;
        ty = lurkTarget.y + Math.cos(npc.drift) * 45;
        
        npc.drift += dt * 0.4;
        desiredAngle = Math.atan2(ty - npc.y, tx - npc.x);
        speedMult = 0.55;
      }

    } else if (npc.role === "police") {
      if (npc.targetShip && npc.targetShip.hull > 0) {
        let target = npc.targetShip;
        let dx = target.x - npc.x;
        let dy = target.y - npc.y;
        let dist = Math.hypot(dx, dy);

        if (npc.disengageTimer > 0) {
          npc.disengageTimer -= dt;
          desiredAngle = Math.atan2(dy, dx) + npc.disengageDir * 1.4;
          npc.thrusterActive = true;
        } else if (dist < 80) {
          npc.disengageTimer = rand(1.0, 1.8);
          npc.disengageDir = Math.random() > 0.5 ? 1 : -1;
          desiredAngle = Math.atan2(dy, dx) + npc.disengageDir * 1.4;
          npc.thrusterActive = true;
        } else {
          let pSpeed = 410;
          let travelTime = dist / pSpeed;
          let tx = target.x + target.vx * travelTime;
          let ty = target.y + target.vy * travelTime;
          desiredAngle = Math.atan2(ty - npc.y, tx - npc.x);
          if (dist > 180) npc.thrusterActive = true;
        }

        npc.fireCooldown -= dt;
        if (npc.fireCooldown <= 0) {
          let aimDiff = Math.abs(normalizeAngle(Math.atan2(dy, dx) - npc.rotation));
          if (dist < 320 && aimDiff < 0.5) {
            lasers.push({
              ownerRole: "police",
              x: npc.x + Math.cos(npc.rotation) * 12,
              y: npc.y + Math.sin(npc.rotation) * 12,
              vx: Math.cos(npc.rotation) * 410 + npc.vx * 0.15,
              vy: Math.sin(npc.rotation) * 410 + npc.vy * 0.15,
              life: 0.95,
              damage: 16,
              color: "#33cc88"
            });
            npc.fireCooldown = 0.5 + Math.random() * 0.5;
          }
        }
      } else {
        npc.patrolTimer -= dt;
        if (npc.patrolTimer <= 0) {
          npc.patrolTimer = 6.0 + Math.random() * 8.0;
          npc.pathNodeIndex = Math.floor(Math.random() * 3);
        }
        
        let nodePos = { x: width * 0.5, y: height * 0.34 };
        if (npc.pathNodeIndex === 1) nodePos = { x: width * 0.83, y: height * 0.24 };
        if (npc.pathNodeIndex === 2) nodePos = getTradeLaneRingPos(1);
        
        tx = nodePos.x + Math.sin(npc.drift) * 40;
        ty = nodePos.y + Math.cos(npc.drift) * 40;
        
        npc.drift += dt * 0.5;
        desiredAngle = Math.atan2(ty - npc.y, tx - npc.x);
        speedMult = 0.8;
      }

    } else if (npc.role === "civilian") {
      tx = width * 0.5 + Math.sin(npc.drift) * 130;
      ty = height * 0.42 + Math.cos(npc.drift) * 100;
      
      npc.drift += dt * 0.25;
      desiredAngle = Math.atan2(ty - npc.y, tx - npc.x);
      speedMult = 0.7;
    }

    let border = 40;
    let steerX = 0;
    let steerY = 0;
    if (npc.x < border) steerX = 1;
    else if (npc.x > width - border) steerX = -1;
    if (npc.y < border) steerY = 1;
    else if (npc.y > height - border) steerY = -1;
    
    if (steerX !== 0 || steerY !== 0) {
      desiredAngle = Math.atan2(steerY, steerX);
      npc.thrusterActive = true;
    }

    const diff = normalizeAngle(desiredAngle - npc.rotation);
    const turn = Math.min(Math.abs(diff), npc.turnRate * dt);
    npc.rotation += Math.sign(diff) * turn;

    const actualSpeed = npc.speed * speedMult * (npc.thrusterActive ? 1.6 : 1.0);
    const targetSpeed = actualSpeed * npc.throttle;
    npc.vx += Math.cos(npc.rotation) * targetSpeed * dt * 0.65;
    npc.vy += Math.sin(npc.rotation) * targetSpeed * dt * 0.65;
    npc.vx *= 0.985;
    npc.vy *= 0.985;
    npc.x += npc.vx * dt;
    npc.y += npc.vy * dt;

    if (npc.thrusterActive && Math.random() > 0.45) {
      let backAngle = npc.rotation + Math.PI + rand(-0.2, 0.2);
      let px = npc.x - Math.cos(npc.rotation) * npc.radius * 0.92;
      let py = npc.y - Math.sin(npc.rotation) * npc.radius * 0.92;
      sparks.push({
        x: px,
        y: py,
        vx: Math.cos(backAngle) * 35 + npc.vx * 0.2,
        vy: Math.sin(backAngle) * 35 + npc.vy * 0.2,
        life: 0.2,
        maxLife: 0.2,
        size: 1.2,
        color: npc.role === "pirate" ? "rgba(255, 80, 50, 0.55)" : "rgba(100, 200, 255, 0.55)",
        type: "spark"
      });
    }

    if (npc.x < -130 || npc.x > width + 130 || npc.y < -130 || npc.y > height + 130) {
      Object.assign(npc, spawnNPC(true));
    }
  }

  function createTileExplosion(ship) {
    for (let k = 0; k < 15; k++) {
      let angle = Math.random() * Math.PI * 2;
      let speed = 25 + Math.random() * 90;
      sparks.push({
        x: ship.x, y: ship.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.55, maxLife: 0.9,
        size: 1.5 + Math.random() * 2.5,
        color: k % 3 === 0 ? (ship.role === "pirate" ? "#ff5533" : "#33aaff") : "#ffbb33",
        type: "spark"
      });
    }
    sparks.push({
      x: ship.x, y: ship.y,
      vx: 0, vy: 0,
      life: 0.45, maxLife: 0.45,
      size: 25,
      color: "rgba(255, 170, 40, 0.8)",
      type: "blast"
    });
  }

  function updateLasers(dt) {
    for (let i = lasers.length - 1; i >= 0; i--) {
      let l = lasers[i];
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.life -= dt;
      
      let hit = false;
      for (let s of ships) {
        if (s.hull <= 0 || s.role === l.ownerRole) continue;
        if (s.role === "trader" && l.ownerRole === "civilian") continue;
        if (s.role === "civilian" && l.ownerRole === "trader") continue;
        
        let dist = Math.hypot(s.x - l.x, s.y - l.y);
        if (dist < s.radius + 2) {
          s.hull -= l.damage;
          s.shieldHit = 0.45;
          
          for (let k = 0; k < 4; k++) {
            sparks.push({
              x: l.x,
              y: l.y,
              vx: (Math.random() - 0.5) * 50,
              vy: (Math.random() - 0.5) * 50,
              life: 0.25,
              maxLife: 0.25,
              size: 2,
              color: l.color,
              type: "spark"
            });
          }
          
          if (s.hull <= 0) {
            s.respawnTimer = 3.5;
            createTileExplosion(s);
          }
          hit = true;
          break;
        }
      }
      if (hit || l.life <= 0) {
        lasers.splice(i, 1);
      }
    }
  }

  function updateSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      let s = sparks[i];
      s.life -= dt;
      s.x += (s.vx || 0) * dt;
      s.y += (s.vy || 0) * dt;
      if (s.life <= 0) sparks.splice(i, 1);
    }
  }

  function drawLasers() {
    for (let l of lasers) {
      ctx.save();
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x - l.vx * 0.04, l.y - l.vy * 0.04);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSparks() {
    for (let s of sparks) {
      ctx.save();
      if (s.type === "blast") {
        let prog = 1 - s.life / s.maxLife;
        let g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, prog * s.size);
        g.addColorStop(0, "rgba(255,255,230,0.95)");
        g.addColorStop(0.35, s.color);
        g.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = g;
        ctx.globalAlpha = 1 - prog;
        ctx.beginPath();
        ctx.arc(s.x, s.y, prog * s.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.life / s.maxLife;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function drawBackground(time) {
    const gradient = ctx.createRadialGradient(width * 0.48, height * 0.36, 0, width * 0.52, height * 0.5, width);
    gradient.addColorStop(0, "#132b48");
    gradient.addColorStop(0.48, "#0c1833");
    gradient.addColorStop(1, "#030814");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    drawNebula(width * 0.28, height * 0.5, 250, "rgba(0, 140, 220, 0.12)");
    drawNebula(width * 0.72, height * 0.42, 260, "rgba(80, 70, 180, 0.1)");

    for (const star of stars) {
      const twinkle = 0.72 + Math.sin(time * 0.0018 + star.x) * 0.28;
      ctx.globalAlpha = star.a * twinkle;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(137, 240, 255, 0.65)";
    ctx.font = "11px Courier New";
    ctx.textAlign = "left";
    ctx.fillText("NEW YORK SYSTEM / MANHATTAN ORBIT", 14, 20);
  }

  function drawNebula(x, y, radius, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawLandmarks(time) {
    drawManhattanOrbit(time);
    drawNewark(time);
    drawTradeLane(time);
    drawPlayerHud(time);
  }

  function drawTradeLane(time) {
    const ring = images.tradeLane;
    const laneStartX = width * 0.79;
    const laneStartY = height * 0.15;
    const laneEndX = width * 0.94;
    const laneEndY = height * 0.04;

    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = "rgba(88, 196, 255, 0.52)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(laneStartX, laneStartY);
    ctx.lineTo(laneEndX, laneEndY);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const x = laneStartX + (laneEndX - laneStartX) * t;
      const y = laneStartY + (laneEndY - laneStartY) * t;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.78);
      ctx.globalAlpha = 0.88;
      if (ring && ring.complete) {
        ctx.drawImage(ring, -16, -16, 32, 32);
      } else {
        ctx.strokeStyle = "rgba(83, 180, 255, 0.78)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 15, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawManhattanOrbit(time) {
    drawPlanetHorizon(time);

    const ring = images.dockRing;
    const ringX = width * 0.5;
    const ringY = height * 0.34;

    ctx.save();
    ctx.translate(ringX, ringY);
    ctx.rotate(Math.sin(time * 0.0005) * 0.02);
    ctx.globalAlpha = 0.95;
    ctx.shadowColor = "rgba(86, 212, 255, 0.7)";
    ctx.shadowBlur = 10;
    if (ring && ring.complete) {
      ctx.drawImage(ring, -24, -24, 48, 48);
    } else {
      ctx.strokeStyle = "rgba(83, 180, 255, 0.65)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 25, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    drawLabel("PLANET MANHATTAN", width * 0.5, height * 0.29, "rgba(190, 210, 225, 0.78)", "center");
    drawLabel("MANHATTAN DOCKING RING", ringX, ringY + 42, "#27c8ff", "center");
  }

  function drawPlanetHorizon(time) {
    const x = width * 0.5;
    const radius = width * 0.69;
    const y = -radius + height * 0.34;

    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();

    const texture = images.manhattanTexture;
    if (texture && texture.complete) {
      const sourceSize = Math.min(texture.naturalWidth || texture.width, texture.naturalHeight || texture.height);
      const sourceX = sourceSize * 0.04;
      ctx.drawImage(texture, sourceX, 0, sourceSize * 0.92, sourceSize * 0.48, -radius, radius * 0.42, radius * 2, radius * 0.58);
    } else {
      const planet = ctx.createRadialGradient(-radius * 0.18, -radius * 0.2, radius * 0.12, 0, 0, radius);
      planet.addColorStop(0, "#d8f2ff");
      planet.addColorStop(0.3, "#76b7cf");
      planet.addColorStop(0.54, "#2d698a");
      planet.addColorStop(0.76, "#163450");
      planet.addColorStop(1, "#06101f");
      ctx.fillStyle = planet;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    }

    const shade = ctx.createRadialGradient(radius * 0.3, radius * 0.3, radius * 0.1, radius * 0.28, radius * 0.32, radius * 0.92);
    shade.addColorStop(0, "rgba(0, 0, 0, 0)");
    shade.addColorStop(1, "rgba(0, 0, 0, 0.48)");
    ctx.fillStyle = shade;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(210, 160, 110, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(130, 190, 230, 0.18)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawNewark(time) {
    const station = images.newark || images.station;
    const x = width * 0.83;
    const y = height * 0.24;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.68 + Math.sin(time * 0.00035) * 0.02);
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = "rgba(120, 210, 255, 0.5)";
    ctx.shadowBlur = 8;
    if (station && station.complete) {
      ctx.drawImage(station, -18, -18, 36, 36);
    } else {
      ctx.fillStyle = "rgba(5, 22, 44, 0.76)";
      ctx.strokeStyle = "rgba(83, 180, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.fillRect(-16, -10, 32, 20);
      ctx.strokeRect(-16, -10, 32, 20);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    drawLabel("STATION NEWARK", x - 10, y + 44, "#27c8ff", "center");
  }

  function drawPlayerHud(time) {
    const ship = images.civilianLiberty;
    const x = width * 0.49;
    const y = height * 0.87;

    ctx.save();
    ctx.strokeStyle = "rgba(25, 210, 130, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, height + 80);
    ctx.stroke();

    const glow = ctx.createRadialGradient(x, y, 0, x, y, 28);
    glow.addColorStop(0, "rgba(30, 230, 120, 0.55)");
    glow.addColorStop(1, "rgba(30, 230, 120, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 30, y - 30, 60, 60);

    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2 + Math.sin(time * 0.001) * 0.02);
    if (ship && ship.complete) {
      ctx.drawImage(ship, -12, -12, 24, 24);
    } else {
      ctx.fillStyle = "rgba(120, 210, 255, 0.9)";
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-8, -6);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-8, 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(110, 200, 255, 0.5)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.54, 4, 0, Math.PI * 2);
    ctx.moveTo(width * 0.5 - 12, height * 0.54);
    ctx.lineTo(width * 0.5 - 5, height * 0.54);
    ctx.moveTo(width * 0.5 + 5, height * 0.54);
    ctx.lineTo(width * 0.5 + 12, height * 0.54);
    ctx.stroke();
    ctx.restore();
  }

  function drawLabel(text, x, y, color, align) {
    ctx.fillStyle = color;
    ctx.font = "11px Courier New";
    ctx.textAlign = align || "left";
    ctx.fillText(text, x, y);
  }

  function drawCallout(fromX, fromY, toX, toY, text) {
    ctx.save();
    ctx.strokeStyle = "rgba(137, 240, 255, 0.45)";
    ctx.fillStyle = "rgba(137, 240, 255, 0.82)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX - 8, toY + 4);
    ctx.stroke();
    ctx.font = "10px Courier New";
    ctx.textAlign = "left";
    ctx.fillText(text, toX, toY);
    ctx.restore();
  }

  function drawNPC(npc) {
    if (npc.hull <= 0) return;
    const sprite = images[npc.sprite] || images.civilianLiberty;
    
    ctx.save();
    ctx.translate(npc.x, npc.y);
    ctx.rotate(npc.rotation + Math.PI / 2);

    let size = npc.role === "trader" ? 24 : 18;

    // Draw engine thruster flame
    let isThruster = npc.thrusterActive;
    let ry = size * 0.45;
    let flameLength = (isThruster ? rand(14, 25) : rand(5, 10));
    let flameWidth = (isThruster ? rand(5, 8) : rand(3, 5));
    
    let flameGrad = ctx.createLinearGradient(0, ry, 0, ry + flameLength);
    if (isThruster) {
      flameGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      flameGrad.addColorStop(0.2, npc.role === "pirate" ? "rgba(255, 100, 50, 0.9)" : "rgba(100, 200, 255, 0.9)");
      flameGrad.addColorStop(0.6, npc.role === "pirate" ? "rgba(255, 50, 0, 0.6)" : "rgba(30, 100, 255, 0.6)");
      flameGrad.addColorStop(1, "rgba(0, 0, 255, 0)");
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
    ctx.restore();

    // Shield impact flash bubble
    if (npc.shieldHit > 0) {
      ctx.save();
      ctx.strokeStyle = npc.role === "pirate" ? "rgba(255, 100, 100, 0.75)" : "rgba(100, 200, 255, 0.75)";
      ctx.fillStyle = npc.role === "pirate" ? "rgba(255, 100, 100, 0.12)" : "rgba(100, 200, 255, 0.12)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, npc.radius * 1.25, npc.radius * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (sprite && sprite.complete) {
      ctx.shadowColor = npc.role === "pirate" ? "rgba(255, 90, 90, 0.55)" : "rgba(120, 210, 255, 0.46)";
      ctx.shadowBlur = 6;
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = npc.minimapColor;
      ctx.strokeStyle = npc.role === "pirate" ? "#ff7777" : "rgba(210, 235, 255, 0.38)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-13, -10);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-13, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    const glow = Math.min(1, Math.hypot(npc.vx, npc.vy) / 80);
    ctx.fillStyle = `rgba(255, ${120 + Math.floor(glow * 80)}, 30, ${0.25 + glow * 0.25})`;
    ctx.beginPath();
    ctx.arc(0, 9, 1.5 + glow * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (npc.x > 20 && npc.x < width - 20 && npc.y > 20 && npc.y < height - 24) {
      ctx.font = "10px Courier New";
      ctx.textAlign = "center";
      ctx.fillStyle = npc.role === "pirate" ? "#ff7777" : "#66ff99";
      ctx.fillText(npc.name, npc.x, npc.y + npc.radius + 8);
    }
  }

  function frame(now) {
    if (document.hidden) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    drawBackground(now);
    drawLandmarks(now);

    // Update simulation physics
    updateLasers(dt);
    updateSparks(dt);

    for (const npc of ships) {
      updateNPC(npc, dt);
      drawNPC(npc);
    }

    drawLasers();
    drawSparks();

    raf = requestAnimationFrame(frame);
  }

  const media = window.matchMedia("(prefers-reduced-motion: reduce)");

  function start() {
    loadImages();
    resize();
    resetShips();
    drawBackground(performance.now());
    drawLandmarks(performance.now());
    ships.forEach(drawNPC);
    if (!media.matches) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  window.addEventListener("resize", resize);
  start();

  window.addEventListener("beforeunload", () => {
    if (raf) cancelAnimationFrame(raf);
  });
})();
