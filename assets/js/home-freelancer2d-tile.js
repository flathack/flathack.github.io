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
      trader: 44,
      pirate: 72,
      police: 64,
      civilian: 48,
    }[role] || 46;

    const sprite = pick(roleSprites[role] || ["civilianLiberty"]);

    return {
      role,
      name: shipNameForSprite(sprite),
      sprite,
      x,
      y,
      rotation: angle,
      targetAngle: angle,
      speed: maxSpeed * (0.72 + Math.random() * 0.45),
      turnRate: 1.6 + Math.random() * 1.6,
      throttle: 0.35 + Math.random() * 0.48,
      drift: Math.random() * Math.PI * 2,
      radius: role === "trader" ? 20 : 16,
      minimapColor: colors[role] || "#888888",
      vx: Math.cos(angle) * maxSpeed,
      vy: Math.sin(angle) * maxSpeed,
    };
  }

  function resetShips() {
    ships = Array.from({ length: 6 }, () => spawnNPC(false));
  }

  function updateNPC(npc, dt) {
    npc.drift += dt * 0.7;
    npc.targetAngle += Math.sin(npc.drift) * dt * 0.34;

    const diff = normalizeAngle(npc.targetAngle - npc.rotation);
    const turn = Math.min(Math.abs(diff), npc.turnRate * dt);
    npc.rotation += Math.sign(diff) * turn;

    const targetSpeed = npc.speed * npc.throttle;
    npc.vx += Math.cos(npc.rotation) * targetSpeed * dt * 0.45;
    npc.vy += Math.sin(npc.rotation) * targetSpeed * dt * 0.45;
    npc.vx *= 0.992;
    npc.vy *= 0.992;
    npc.x += npc.vx * dt;
    npc.y += npc.vy * dt;

    if (npc.x < -110 || npc.x > width + 110 || npc.y < -110 || npc.y > height + 110) {
      Object.assign(npc, spawnNPC(true));
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
    const sprite = images[npc.sprite] || images.civilianLiberty;
    ctx.save();
    ctx.translate(npc.x, npc.y);
    ctx.rotate(npc.rotation + Math.PI / 2);

    if (sprite && sprite.complete) {
      const size = npc.role === "trader" ? 24 : 18;
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
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    drawBackground(now);
    drawLandmarks(now);

    for (const npc of ships) {
      updateNPC(npc, dt);
      drawNPC(npc);
    }

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
