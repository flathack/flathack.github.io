(() => {
  const canvas = document.getElementById("freelancer2d-tile");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const assetPaths = {
    trader: "freelancer2d/data/ship_icons/li_freighter.png",
    civilian: "freelancer2d/data/ship_icons/patriot.png",
    pirate: "freelancer2d/data/ship_icons/ge_fighter.png",
    police: "freelancer2d/data/ship_icons/li_elite.png",
    transport: "freelancer2d/data/ship_icons/ge_transport.png",
    station: "freelancer2d/data/vanilla-en/object_icons/smallstation1.png",
    tradeLane: "freelancer2d/data/vanilla-en/object_icons/trade_lane_ring.png",
  };
  const roles = ["trader", "trader", "civilian", "civilian", "pirate", "police"];
  const colors = {
    trader: "#44aa44",
    pirate: "#aa4444",
    police: "#4444aa",
    civilian: "#888888",
    miner: "#aa8844",
  };
  const prefixes = {
    trader: ["MV", "TS", "STS"],
    pirate: ["SH", "BC", "REAPER"],
    police: ["CPD", "SFPD"],
    civilian: ["ST", "LS", "RV"],
    miner: ["EX", "MR"],
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

  function generateName(role) {
    const prefix = pick(prefixes[role] || ["DS"]);
    const number = Math.floor(Math.random() * 9000) + 1000;
    return `${prefix}-${number}`;
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
    let y = Math.random() * height;
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

    return {
      role,
      name: generateName(role),
      sprite: role === "trader" && Math.random() > 0.48 ? "transport" : role,
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
    ships = Array.from({ length: 13 }, () => spawnNPC(false));
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
    const gradient = ctx.createRadialGradient(width * 0.45, height * 0.48, 0, width * 0.45, height * 0.48, width);
    gradient.addColorStop(0, "#142d55");
    gradient.addColorStop(0.42, "#081525");
    gradient.addColorStop(1, "#030611");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    drawNebula(width * 0.22, height * 0.52, 190, "rgba(0, 190, 220, 0.16)");
    drawNebula(width * 0.72, height * 0.38, 220, "rgba(188, 75, 255, 0.13)");
    drawNebula(width * 0.82, height * 0.82, 180, "rgba(255, 150, 54, 0.13)");

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
    ctx.fillText("NEW YORK SYSTEM / FORT BUSH SECTOR", 16, 22);
  }

  function drawNebula(x, y, radius, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawLandmarks(time) {
    drawTradeLane(time);
    drawFortBush(time);
  }

  function drawTradeLane(time) {
    const ring = images.tradeLane;
    const laneX = width - 58;
    const laneTop = -42;
    const laneBottom = height + 42;

    ctx.save();
    ctx.globalAlpha = 0.58;
    ctx.strokeStyle = "rgba(100, 210, 255, 0.44)";
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 11]);
    ctx.lineDashOffset = -(time * 0.018) % 20;
    ctx.beginPath();
    ctx.moveTo(laneX, laneTop);
    ctx.lineTo(laneX - 34, laneBottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    for (let i = -1; i < 5; i++) {
      const y = i * 82 + ((time * 0.018) % 82);
      const x = laneX - (y / Math.max(1, height)) * 34;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 2.18);
      ctx.globalAlpha = 0.9;
      if (ring && ring.complete) {
        ctx.drawImage(ring, -31, -31, 62, 62);
      } else {
        ctx.strokeStyle = "rgba(83, 180, 255, 0.78)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 27, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(width - 118, height * 0.72);
    ctx.rotate(-0.42);
    ctx.fillStyle = "rgba(100, 210, 255, 0.18)";
    ctx.strokeStyle = "rgba(100, 210, 255, 0.48)";
    ctx.lineWidth = 1.5;
    ctx.fillRect(-76, -12, 152, 24);
    ctx.strokeRect(-76, -12, 152, 24);
    ctx.fillStyle = "rgba(200, 245, 255, 0.78)";
    ctx.font = "10px Courier New";
    ctx.textAlign = "center";
    ctx.fillText("TRADE LANE", 0, 4);
    ctx.restore();
  }

  function drawFortBush(time) {
    const station = images.station;
    const x = width * 0.23;
    const y = height * 0.66;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 0.00035) * 0.03);
    ctx.globalAlpha = 0.96;
    if (station && station.complete) {
      ctx.drawImage(station, -44, -44, 88, 88);
    } else {
      ctx.strokeStyle = "rgba(83, 180, 255, 0.45)";
      ctx.fillStyle = "rgba(5, 22, 44, 0.76)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 170, 0, 0.5)";
    ctx.beginPath();
    ctx.moveTo(-54, 0);
    ctx.lineTo(54, 0);
    ctx.moveTo(0, -54);
    ctx.lineTo(0, 54);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(102, 255, 153, 0.9)";
    ctx.font = "11px Courier New";
    ctx.textAlign = "center";
    ctx.fillText("FORT BUSH", x, y + 62);

    ctx.save();
    ctx.translate(width * 0.84, height * 0.25);
    ctx.rotate(time * 0.0003);
    ctx.strokeStyle = "rgba(85, 255, 180, 0.52)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 46, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawNPC(npc) {
    const sprite = images[npc.sprite] || images[npc.role];
    ctx.save();
    ctx.translate(npc.x, npc.y);
    ctx.rotate(npc.rotation + Math.PI / 2);

    if (sprite && sprite.complete) {
      const size = npc.role === "trader" ? 44 : 34;
      ctx.shadowColor = npc.role === "pirate" ? "rgba(255, 90, 90, 0.55)" : "rgba(120, 210, 255, 0.46)";
      ctx.shadowBlur = 8;
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
    ctx.fillStyle = `rgba(255, ${120 + Math.floor(glow * 80)}, 30, ${0.35 + glow * 0.35})`;
    ctx.beginPath();
    ctx.arc(0, 17, 2 + glow * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (npc.x > 20 && npc.x < width - 20 && npc.y > 20 && npc.y < height - 24) {
      ctx.font = "10px Courier New";
      ctx.textAlign = "center";
      ctx.fillStyle = npc.role === "pirate" ? "#ff7777" : "#66ff99";
      ctx.fillText(npc.name, npc.x, npc.y + npc.radius + 12);
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
