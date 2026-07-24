"use strict";

// icons.js - item/mutation icon painting + pixel sprites

// Live registry of icon canvases that carry a redesigned PNG. The main loop calls
// renderAnimatedIcons() each frame so these canvases can bob, shine, pop, and react
// to hover. Icons without PNG art are drawn once and never registered (no cost).
const animatedIcons = new Set();

function drawItemIcon(iconCanvas, data = {}, kind = "item") {
  if (!iconCanvas) return;
  // If a redesigned PNG exists (or is still loading) for this thing, route it through
  // the animated renderer. Otherwise draw the original code art once.
  if (hasArtSource(data)) {
    iconCanvas._art = { data: { ...data }, kind, born: performance.now(), hover: 0 };
    animatedIcons.add(iconCanvas);
    paintIconCanvas(iconCanvas, performance.now());
    return;
  }
  iconCanvas._art = null;
  animatedIcons.delete(iconCanvas);
  paintCodeIcon(iconCanvas, data, kind);
}

function hasArtSource(data) {
  if (!data) return false;
  if (data.weaponName) return artSourceUsable(`weapon:${data.weaponName}`) || artSourceUsable(`item:${data.id}`);
  if (data.part) return artSourceUsable(`mutation:${String(data.part).toLowerCase()}`);
  if (data.id) return artSourceUsable(`item:${data.id}`) || (data.name && artSourceUsable(`weapon:${data.name}`));
  if (data.name) return artSourceUsable(`weapon:${data.name}`);
  return false;
}

function paintCodeIcon(iconCanvas, data = {}, kind = "item") {
  const iconCtx = iconCanvas.getContext("2d");
  iconCtx.imageSmoothingEnabled = true;
  iconCtx.setTransform(1, 0, 0, 1, 0, 0);
  iconCtx.clearRect(0, 0, iconCanvas.width, iconCanvas.height);
  iconCtx.save();
  iconCtx.scale(iconCanvas.width / 96, iconCanvas.height / 96);
  iconCtx.scale(2, 2);
  drawIconTile(iconCtx, data.tier ?? 1);
  if (kind === "mutation" || data.part) {
    drawMutationIcon(iconCtx, data.part ?? data.name ?? "Heart");
  } else {
    drawUpgradeIcon(iconCtx, data);
    drawUniqueIconAccent(iconCtx, data.id ?? data.weaponName ?? data.name ?? "item");
  }
  iconCtx.restore();
}

// Draw one PNG icon canvas at time `now`, applying idle bob, reveal pop-in, hover pop,
// and a periodic light sweep. Falls back to code art if the image isn't ready yet.
function paintIconCanvas(iconCanvas, now) {
  const entry = iconCanvas._art;
  if (!entry) return;
  const data = entry.data;
  const art = itemArt(data);
  const w = iconCanvas.width;
  const h = iconCanvas.height;
  const g = iconCanvas.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);

  if (!art) {
    // Image still loading (or failed) - show code art meanwhile.
    paintCodeIcon(iconCanvas, data, entry.kind);
    return;
  }

  // Draw the rank-colored tile/outline behind the PNG (unless the art bakes its own full
  // card), so improved-art icons keep the tier border that code-drawn icons have.
  if (!itemArtIsFullCard(data)) {
    g.save();
    g.scale(w / 96, h / 96);
    g.scale(2, 2);
    drawIconTile(g, data.tier ?? 1);
    g.restore();
  }

  const t = now / 1000;
  const age = Math.max(0, (now - entry.born) / 1000);
  const seed = (data.id ?? data.weaponName ?? data.part ?? data.name ?? "x").length;

  // Reveal pop-in: springy scale + flash over ~0.42s.
  const revealP = clamp(age / 0.42, 0, 1);
  const reveal = revealP < 1 ? easeOutBack(revealP) : 1;

  // Idle bob (gentle vertical float) + tiny breathing scale.
  const bob = Math.sin(t * 1.8 + seed) * (h * 0.018);
  const breathe = 1 + Math.sin(t * 2.1 + seed * 0.7) * 0.012;

  // Hover: pop scale + slight tilt, eased toward target.
  const hover = entry.hover;
  const hoverScale = 1 + hover * 0.09;
  const tilt = Math.sin(t * 3 + seed) * 0.05 * hover;

  const scale = reveal * breathe * hoverScale;

  // When the rank tile is drawn behind, fit the art inside its cream panel (~71% of the
  // canvas, matching drawIconTile's 34/48 inner rect) so the tier border stays visible
  // around it. Full-card art fills the whole canvas as before.
  const inset = itemArtIsFullCard(data) ? 1 : 0.72;
  const aw = w * inset;
  const ah = h * inset;

  g.save();
  g.translate(w / 2, h / 2 + bob);
  g.rotate(tilt);
  g.scale(scale, scale);
  g.imageSmoothingEnabled = true;
  g.drawImage(art, -aw / 2, -ah / 2, aw, ah);
  g.restore();

  // Reveal flash.
  if (revealP < 1) {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = (1 - revealP) * 0.5;
    g.fillStyle = "#fff7e7";
    g.fillRect(0, 0, w, h);
    g.restore();
  }

  // Periodic light sweep (shine) - a diagonal band that crosses every few seconds.
  const sweepCycle = 3.4;
  const sweepPhase = ((t + seed * 0.5) % sweepCycle) / sweepCycle;
  if (sweepPhase < 0.28) {
    const p = sweepPhase / 0.28;
    const x = -w * 0.4 + p * (w * 1.8);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.translate(x, 0);
    g.rotate(-0.35);
    const grad = g.createLinearGradient(-w * 0.16, 0, w * 0.16, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.28)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(-w * 0.16, -h, w * 0.32, h * 2);
    g.restore();
  }
}

// Per-frame animation pass, called from the game loop. Also updates hover easing.
function renderAnimatedIcons(now) {
  for (const iconCanvas of animatedIcons) {
    if (!iconCanvas.isConnected) {
      animatedIcons.delete(iconCanvas);
      continue;
    }
    const entry = iconCanvas._art;
    if (!entry) {
      animatedIcons.delete(iconCanvas);
      continue;
    }
    const wantHover = iconCanvasHovered(iconCanvas) ? 1 : 0;
    entry.hover += (wantHover - entry.hover) * 0.22;
    paintIconCanvas(iconCanvas, now);
  }
}

function iconCanvasHovered(iconCanvas) {
  const host = iconCanvas.closest(".card, .weapon-slot, .pill, .crate-replace-weapon, .character-card");
  return Boolean(host && host.matches(":hover"));
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function drawIconTile(iconCtx, tier) {
  const color = rarities[Math.min(MAX_WEAPON_RANK, Math.max(1, tier))]?.color ?? "#dce4ed";
  const panel = iconCtx.createLinearGradient(6, 6, 42, 42);
  panel.addColorStop(0, "#fff4e4");
  panel.addColorStop(1, "#efd8bd");

  iconCtx.fillStyle = "#111722";
  iconCtx.beginPath();
  roundedRectPath(iconCtx, 1, 1, 46, 46, 7);
  iconCtx.fill();

  iconCtx.fillStyle = color;
  iconCtx.beginPath();
  roundedRectPath(iconCtx, 4, 4, 40, 40, 6);
  iconCtx.fill();

  iconCtx.fillStyle = panel;
  iconCtx.beginPath();
  roundedRectPath(iconCtx, 7, 7, 34, 34, 5);
  iconCtx.fill();

  iconCtx.fillStyle = "rgba(255,255,255,0.48)";
  iconCtx.beginPath();
  roundedRectPath(iconCtx, 10, 10, 12, 5, 3);
  iconCtx.fill();

  iconCtx.fillStyle = "rgba(17,23,34,0.12)";
  iconCtx.beginPath();
  roundedRectPath(iconCtx, 8, 35, 32, 5, 3);
  iconCtx.fill();
}

function drawUniqueIconAccent(iconCtx, key) {
  const text = String(key);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  const colors = ["#9aa7b8", "#74d3a4", "#58aaff", "#ba7eff", "#ff9c3d", "#f2c45f"];
  const color = colors[hash % colors.length];
  const shape = hash % 5;
  const x = 11 + (hash % 3) * 2;
  const y = 36 - ((hash >> 3) % 3);

  iconCtx.save();
  iconCtx.fillStyle = "#111722";
  iconCtx.strokeStyle = "#111722";
  iconCtx.lineWidth = 1.5;
  iconCtx.beginPath();
  iconCtx.arc(x, y, 5.5, 0, Math.PI * 2);
  iconCtx.fill();

  iconCtx.fillStyle = color;
  iconCtx.beginPath();
  if (shape === 0) {
    iconCtx.arc(x, y, 3.7, 0, Math.PI * 2);
  } else if (shape === 1) {
    iconCtx.moveTo(x, y - 4);
    iconCtx.lineTo(x + 4, y);
    iconCtx.lineTo(x, y + 4);
    iconCtx.lineTo(x - 4, y);
    iconCtx.closePath();
  } else if (shape === 2) {
    iconCtx.moveTo(x, y - 4);
    iconCtx.lineTo(x + 4, y + 4);
    iconCtx.lineTo(x - 4, y + 4);
    iconCtx.closePath();
  } else if (shape === 3) {
    roundedRectPath(iconCtx, x - 4, y - 3, 8, 6, 2);
  } else {
    iconCtx.moveTo(x, y - 5);
    iconCtx.lineTo(x + 2, y - 1);
    iconCtx.lineTo(x + 5, y);
    iconCtx.lineTo(x + 2, y + 2);
    iconCtx.lineTo(x, y + 5);
    iconCtx.lineTo(x - 2, y + 2);
    iconCtx.lineTo(x - 5, y);
    iconCtx.lineTo(x - 2, y - 1);
    iconCtx.closePath();
  }
  iconCtx.fill();
  iconCtx.restore();
}

function block(iconCtx, x, y, w, h, fill, stroke = "#111722") {
  iconCtx.fillStyle = stroke;
  iconCtx.fillRect(x - 1, y - 1, w + 2, h + 2);
  iconCtx.fillStyle = fill;
  iconCtx.fillRect(x, y, w, h);
}

function dot(iconCtx, x, y, size, fill, stroke = "#111722") {
  block(iconCtx, x, y, size, size, fill, stroke);
}

function roundBlock(iconCtx, x, y, w, h, r, fill, stroke = "#111722") {
  iconCtx.fillStyle = stroke;
  iconCtx.beginPath();
  roundedRectPath(iconCtx, x - 1, y - 1, w + 2, h + 2, r + 1);
  iconCtx.fill();
  iconCtx.fillStyle = fill;
  iconCtx.beginPath();
  roundedRectPath(iconCtx, x, y, w, h, r);
  iconCtx.fill();
}

function disc(iconCtx, x, y, rx, ry, fill, stroke = "#111722", rotation = 0) {
  iconCtx.fillStyle = stroke;
  iconCtx.beginPath();
  iconCtx.ellipse(x, y, rx + 1, ry + 1, rotation, 0, Math.PI * 2);
  iconCtx.fill();
  iconCtx.fillStyle = fill;
  iconCtx.beginPath();
  iconCtx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  iconCtx.fill();
}

function leafIcon(iconCtx, x, y, rx, ry, fill, rotation) {
  disc(iconCtx, x, y, rx, ry, fill, "#111722", rotation);
  iconCtx.strokeStyle = "rgba(17, 23, 34, 0.35)";
  iconCtx.lineWidth = 1;
  iconCtx.beginPath();
  iconCtx.moveTo(x - Math.cos(rotation) * rx * 0.7, y - Math.sin(rotation) * rx * 0.7);
  iconCtx.lineTo(x + Math.cos(rotation) * rx * 0.7, y + Math.sin(rotation) * rx * 0.7);
  iconCtx.stroke();
}

function sparkleIcon(iconCtx, x, y, color) {
  iconCtx.fillStyle = "#111722";
  iconCtx.beginPath();
  iconCtx.moveTo(x, y - 7);
  iconCtx.lineTo(x + 3, y - 2);
  iconCtx.lineTo(x + 7, y);
  iconCtx.lineTo(x + 3, y + 2);
  iconCtx.lineTo(x, y + 7);
  iconCtx.lineTo(x - 3, y + 2);
  iconCtx.lineTo(x - 7, y);
  iconCtx.lineTo(x - 3, y - 2);
  iconCtx.closePath();
  iconCtx.fill();
  iconCtx.fillStyle = color;
  iconCtx.beginPath();
  iconCtx.moveTo(x, y - 5);
  iconCtx.lineTo(x + 2, y - 1);
  iconCtx.lineTo(x + 5, y);
  iconCtx.lineTo(x + 2, y + 1);
  iconCtx.lineTo(x, y + 5);
  iconCtx.lineTo(x - 2, y + 1);
  iconCtx.lineTo(x - 5, y);
  iconCtx.lineTo(x - 2, y - 1);
  iconCtx.closePath();
  iconCtx.fill();
}

const spritePalette = {
  k: "#111722",
  o: "#243042",
  w: "#fff7e7",
  s: "#dce4ed",
  m: "#9aa7b8",
  g: "#677187",
  y: "#f2c45f",
  Y: "#fff0a6",
  b: "#73b7ff",
  B: "#d7ecff",
  n: "#375c7e",
  r: "#ff7261",
  R: "#d94a73",
  p: "#ff8fa3",
  v: "#ba7eff",
  V: "#d9b7ff",
  e: "#ff9c5b",
  l: "#74d3a4",
  L: "#92d486",
  q: "#2f8f6b",
  t: "#f6d28f",
  T: "#e3b071",
  c: "#8d5d38",
  C: "#b97843",
  d: "#6d432d",
  D: "#4e3529"
};

const pixelSprites = {
  sparkPeashooter: [
    "........................",
    ".............kk.........",
    ".........kkkkBBkk.......",
    "......kkkbbbbBBBkk......",
    "....kkbbbbbbbbBBssk.....",
    "...kbbbbbbnnnbbbsskk....",
    "..kcddbbbbnnnbbbbssyk...",
    ".kcCDdkbbbbbbbbbbssyk...",
    ".kcCDDDkkbbbbbbbssykk...",
    "..kDDDDk..kkbbbbsskk....",
    "...kkkdk....kkkbbkk.....",
    "......kk.......kk.......",
    "........................"
  ],
  twigWand: [
    "................kYk.....",
    "...............kYeYk....",
    "..............kYeeYk....",
    "...............kYk......",
    "..........kk...kck......",
    "......kkk.cLk.kcck......",
    "...kkkccc.cckkcck.......",
    ".kkccccccddccck.........",
    "kcccddcccccck...........",
    ".kkkcckkcckk............",
    "....kLk..kqk............",
    ".....k....k.............",
    "........................"
  ],
  stubClub: [
    "........kkkkkk..........",
    ".....kkkCCCCCCkk........",
    "...kkCCCCCCCCCCkk.......",
    "..kCCCCCccCCCCCck.......",
    ".kCCCccDddcCCCCck.......",
    ".kCCccDDDDdcCCCck.......",
    "..kCCCcddccCCCCk........",
    "...kkCCCCCCCkkk.........",
    ".....kkkDDkk............",
    "........kDdk............",
    "........kDdk............",
    "........kddk............",
    ".........kk............."
  ],
  muscle: [
    "........................",
    "...........kkkk.........",
    ".........kttTTtk........",
    "......kkkttTTTTtk.......",
    "....kkttttTTTtttk.......",
    "...ktttttkkkttttk.......",
    "..ktTTttkRRRktttk.......",
    "..kTTTttkRRRktttk.......",
    "...ktttttkkkttkk........",
    "....kkttttttkk..........",
    "......kkkttk............",
    ".........kk.............",
    "........................"
  ],
  heart: [
    "........................",
    "......kkk....kkk........",
    ".....krrrk..krrrk.......",
    "....krrrrrkkrrrrrk......",
    "....krrrrrrrrrrrrk......",
    ".....krrrrwrrwrrk.......",
    "......krrwwwwwrk........",
    ".......krrrrrrk.........",
    "........krrrrk..........",
    ".........krrk...........",
    "..........kk............",
    "........................"
  ],
  legs: [
    "........................",
    ".......kk....kk.........",
    "......kllk..kllk........",
    "......kllk..kllk........",
    "......kllk..kllk........",
    "......kqlk..klqk........",
    "......kqk....kqk........",
    ".....kssk...kssk........",
    "....ksssskkkssssk.......",
    "....kkkkk...kkkkk.......",
    "........................"
  ],
  hand: [
    "........................",
    "......kk.k.k............",
    ".....kttktktk...........",
    ".....kttttttk...........",
    "....ktttttttk...........",
    "....ktttttttk...........",
    ".....kttTTtk............",
    "......kTTTk.............",
    ".......kkk..............",
    "........................"
  ],
  eye: [
    "........................",
    ".......kkkkkkk..........",
    ".....kkwwwwwwkk.........",
    "....kwwwwbbwwwk.........",
    "...kwwwwboobwwwk........",
    "....kwwwwbbwwwk.........",
    ".....kkwwwwwwkk.........",
    ".......kkkkkkk..........",
    "........................"
  ],
  brain: [
    "........................",
    ".......kkVkkVkk.........",
    ".....kkvvvvvvvk.........",
    "....kvVvVvVvvVk.........",
    "....kvvvvvvvvvk.........",
    ".....kvVvVvVvk..........",
    "......kkvvvvk...........",
    "........kbbk............",
    "........kbbk............",
    ".........kk.............",
    "........................"
  ],
  skin: [
    "........................",
    "......kkkkkkkk..........",
    ".....kttTTTTtk..........",
    "....ktttTttttk..........",
    "....kttDttDttk..........",
    "....kttttttttk..........",
    ".....kttDtttk...........",
    "......kkkkkk............",
    "........................"
  ],
  groundMoss: [
    "..l..q..",
    ".lLLq...",
    "lLqL..q.",
    "..q..LL.",
    ".q..lL..",
    "...q..l.",
    ".l...q..",
    "........"
  ],
  groundPebbles: [
    "........",
    "..g.....",
    ".gsg....",
    "........",
    ".....D..",
    "....DcD.",
    "........",
    "..m....."
  ],
  groundFlowers: [
    "........",
    "..p.p...",
    "...Y....",
    "..p.p...",
    "....l...",
    "...lq...",
    "........",
    "........"
  ]
};

function drawPixelSprite(targetCtx, rows, x, y, scale = 1, palette = spritePalette) {
  for (let row = 0; row < rows.length; row += 1) {
    for (let col = 0; col < rows[row].length; col += 1) {
      const key = rows[row][col];
      if (key === "." || key === " ") continue;
      targetCtx.fillStyle = palette[key] ?? key;
      targetCtx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}

function drawCenteredPixelSprite(targetCtx, rows, scale = 1, x = 24, y = 24) {
  const width = rows.reduce((best, row) => Math.max(best, row.length), 0) * scale;
  const height = rows.length * scale;
  drawPixelSprite(targetCtx, rows, Math.round(x - width / 2), Math.round(y - height / 2), scale);
}

function mutationSpriteFor(part) {
  const key = String(part).toLowerCase();
  if (key.includes("heart") || key.includes("vein")) return pixelSprites.heart;
  if (key.includes("muscle")) return pixelSprites.muscle;
  if (key.includes("leg") || key.includes("ankle")) return pixelSprites.legs;
  if (key.includes("hand") || key.includes("finger") || key.includes("thumb") || key.includes("arm")) return pixelSprites.hand;
  if (key.includes("eye")) return pixelSprites.eye;
  if (key.includes("brain") || key.includes("nerve") || key.includes("tendon")) return pixelSprites.brain;
  if (key.includes("skin") || key.includes("mole")) return pixelSprites.skin;
  return pixelSprites.muscle;
}

function upgradeSpriteFor(id) {
  const map = {
    damage: pixelSprites.muscle,
    speed: pixelSprites.legs,
    rate: pixelSprites.sparkPeashooter,
    heart: pixelSprites.heart,
    magnet: pixelSprites.sparkPeashooter,
    split: pixelSprites.sparkPeashooter,
    range: pixelSprites.twigWand,
    ranged: pixelSprites.sparkPeashooter,
    regen: pixelSprites.heart,
    lifesteal: pixelSprites.heart,
    crit: pixelSprites.eye,
    armor: pixelSprites.skin,
    dodge: pixelSprites.legs,
    luck: pixelSprites.eye,
    harvesting: pixelSprites.groundMoss,
    coupon_leaf: pixelSprites.groundFlowers,
    recycling_clamp: pixelSprites.stubClub,
    garden_shears: pixelSprites.twigWand,
    engineering: pixelSprites.sparkPeashooter,
    melee: pixelSprites.hand,
    elemental: pixelSprites.twigWand
  };
  return map[id] ?? null;
}

function drawUpgradeIcon(iconCtx, item) {
  const id = item.id ?? "";
  const weaponName = item.weaponName ?? item.name ?? "";
  if (weaponStatProfiles[weaponName]) {
    drawWeaponIcon(iconCtx, weaponName, item.tier ?? 1);
    return;
  }
  if (id === "spark_weapon" || weaponName === "Spark Peashooter") {
    drawWeaponIcon(iconCtx, "Spark Peashooter", item.tier ?? 1);
    return;
  }
  if (id === "twig_wand" || weaponName === "Twig Wand") {
    drawWeaponIcon(iconCtx, "Twig Wand", item.tier ?? 1);
    return;
  }
  if (id === "stub_club" || weaponName === "Stub Club") {
    drawWeaponIcon(iconCtx, "Stub Club", item.tier ?? 1);
    return;
  }
  if (id === "pet_alien") {
    disc(iconCtx, 24, 25, 13, 15, "#74d3a4");
    disc(iconCtx, 17, 18, 5, 7, "#92d486");
    disc(iconCtx, 31, 18, 5, 7, "#92d486");
    disc(iconCtx, 19, 25, 3, 4, "#111722");
    disc(iconCtx, 29, 25, 3, 4, "#111722");
    disc(iconCtx, 20, 24, 1, 1, "#fff7e7", "transparent");
    disc(iconCtx, 30, 24, 1, 1, "#fff7e7", "transparent");
    roundBlock(iconCtx, 19, 33, 10, 3, 2, "#365f58");
    roundBlock(iconCtx, 11, 34, 7, 10, 3, "#66c7d8");
    roundBlock(iconCtx, 30, 34, 7, 10, 3, "#66c7d8");
    sparkleIcon(iconCtx, 35, 13, "#f2d35f");
    return;
  }
  if (id === "glass_charm") {
    iconCtx.fillStyle = "#73b7ff";
    iconCtx.strokeStyle = "#111722";
    iconCtx.lineWidth = 2;
    iconCtx.beginPath();
    iconCtx.moveTo(24, 8);
    iconCtx.lineTo(37, 21);
    iconCtx.lineTo(29, 39);
    iconCtx.lineTo(13, 35);
    iconCtx.lineTo(10, 18);
    iconCtx.closePath();
    iconCtx.fill();
    iconCtx.stroke();
    iconCtx.strokeStyle = "rgba(255, 247, 231, 0.8)";
    iconCtx.lineWidth = 1.4;
    iconCtx.beginPath();
    iconCtx.moveTo(18, 16);
    iconCtx.lineTo(27, 24);
    iconCtx.lineTo(22, 34);
    iconCtx.moveTo(27, 24);
    iconCtx.lineTo(34, 20);
    iconCtx.stroke();
    sparkleIcon(iconCtx, 15, 12, "#fff7e7");
    return;
  }
  if (id === "slot_machine") {
    roundBlock(iconCtx, 12, 10, 25, 31, 5, "#d94a73");
    roundBlock(iconCtx, 15, 14, 19, 9, 3, "#fff7e7");
    roundBlock(iconCtx, 16, 26, 17, 10, 3, "#2f3b52");
    iconCtx.fillStyle = "#f2c45f";
    iconCtx.font = "900 8px Inter, sans-serif";
    iconCtx.textAlign = "center";
    iconCtx.fillText("777", 24, 22);
    disc(iconCtx, 18, 31, 2.2, 2.2, "#f2c45f");
    disc(iconCtx, 24, 31, 2.2, 2.2, "#74d3a4");
    disc(iconCtx, 30, 31, 2.2, 2.2, "#73b7ff");
    iconCtx.strokeStyle = "#111722";
    iconCtx.lineWidth = 2.2;
    iconCtx.beginPath();
    iconCtx.moveTo(37, 18);
    iconCtx.lineTo(42, 12);
    iconCtx.stroke();
    disc(iconCtx, 43, 11, 3, 3, "#f2c45f");
    roundBlock(iconCtx, 16, 39, 16, 4, 2, "#8d5d38");
    return;
  }
  const itemSprite = upgradeSpriteFor(id);
  if (itemSprite) {
    drawCenteredPixelSprite(iconCtx, itemSprite, itemSprite[0]?.length <= 8 ? 2.8 : 1.45);
    return;
  }
  if (id === "spark_weapon" || weaponName === "Spark Peashooter") {
    roundBlock(iconCtx, 10, 20, 25, 9, 4, "#73b7ff");
    roundBlock(iconCtx, 30, 17, 8, 15, 3, "#dce4ed");
    roundBlock(iconCtx, 8, 24, 10, 12, 3, "#8d5d38");
    disc(iconCtx, 37, 24, 3.5, 3.5, "#f2c45f");
    sparkleIcon(iconCtx, 15, 15, "#fff0a6");
    return;
  }
  if (id === "twig_wand" || weaponName === "Twig Wand") {
    roundBlock(iconCtx, 15, 11, 7, 27, 3, "#8d5d38");
    leafIcon(iconCtx, 14, 16, 5, 3, "#74d3a4", -0.7);
    roundBlock(iconCtx, 21, 15, 6, 6, 2, "#f2c45f");
    sparkleIcon(iconCtx, 27, 12, "#ff9c5b");
    disc(iconCtx, 30, 21, 3, 3, "#73b7ff");
    return;
  }
  if (id === "stub_club" || weaponName === "Stub Club") {
    disc(iconCtx, 25, 24, 14, 7, "#8d5d38", "#111722", 0.08);
    roundBlock(iconCtx, 9, 22, 12, 6, 3, "#6d432d");
    disc(iconCtx, 33, 18, 4, 4, "#b97843");
    disc(iconCtx, 19, 27, 2, 2, "#6d432d");
    return;
  }
  if (id === "damage") {
    roundBlock(iconCtx, 13, 27, 20, 8, 3, "#d06f3d");
    sparkleIcon(iconCtx, 20, 17, "#ff7261");
    sparkleIcon(iconCtx, 29, 14, "#f2c45f");
    disc(iconCtx, 32, 24, 3, 3, "#ff9c5b");
    return;
  }
  if (id === "speed" || id === "dodge") {
    roundBlock(iconCtx, 12, 25, 23, 8, 4, "#73b7ff");
    roundBlock(iconCtx, 9, 31, 29, 5, 3, "#fff7e7");
    roundBlock(iconCtx, 27, 20, 10, 8, 3, "#ff7261");
    leafIcon(iconCtx, 12, 21, 5, 3, "#f2c45f", -0.3);
    return;
  }
  if (id === "rate") {
    for (let i = 0; i < 5; i += 1) disc(iconCtx, 15 + i * 4.5, 18 + (i % 2) * 8, 3, 3, "#f2c45f");
    roundBlock(iconCtx, 10, 28, 28, 5, 3, "#9aa7b8");
    return;
  }
  if (id === "heart") {
    disc(iconCtx, 18, 21, 7, 7, "#ff7261");
    disc(iconCtx, 29, 21, 7, 7, "#ff7261");
    roundBlock(iconCtx, 15, 24, 19, 11, 4, "#ff7261");
    roundBlock(iconCtx, 18, 26, 12, 3, 2, "#fff7e7");
    roundBlock(iconCtx, 22, 22, 4, 11, 2, "#fff7e7");
    return;
  }
  if (id === "magnet") {
    roundBlock(iconCtx, 12, 13, 9, 22, 4, "#ff7261");
    roundBlock(iconCtx, 27, 13, 9, 22, 4, "#73b7ff");
    roundBlock(iconCtx, 17, 29, 14, 7, 4, "#dce4ed");
    sparkleIcon(iconCtx, 24, 15, "#fff7e7");
    return;
  }
  if (id === "split") {
    roundBlock(iconCtx, 10, 22, 25, 6, 3, "#73b7ff");
    roundBlock(iconCtx, 25, 14, 14, 7, 3, "#73b7ff");
    roundBlock(iconCtx, 25, 29, 14, 7, 3, "#73b7ff");
    disc(iconCtx, 13, 25, 4, 4, "#8d5d38");
    return;
  }
  if (id === "range") {
    roundBlock(iconCtx, 9, 22, 30, 5, 3, "#fff7e7");
    roundBlock(iconCtx, 33, 17, 6, 14, 3, "#ff7261");
    disc(iconCtx, 13, 24, 3, 3, "#73b7ff");
    return;
  }
  if (id === "ranged") {
    roundBlock(iconCtx, 14, 14, 8, 23, 3, "#9aa7b8");
    roundBlock(iconCtx, 20, 12, 13, 5, 3, "#dce4ed");
    roundBlock(iconCtx, 20, 33, 13, 5, 3, "#dce4ed");
    disc(iconCtx, 25, 24, 3, 3, "#677187");
    return;
  }
  if (id === "regen") {
    disc(iconCtx, 24, 24, 8, 13, "#74d3a4");
    roundBlock(iconCtx, 15, 25, 18, 4, 2, "#fff7e7");
    roundBlock(iconCtx, 22, 18, 4, 16, 2, "#fff7e7");
    leafIcon(iconCtx, 16, 16, 7, 4, "#92d486", -0.55);
    leafIcon(iconCtx, 31, 15, 6, 4, "#92d486", 0.45);
    return;
  }
  if (id === "lifesteal") {
    roundBlock(iconCtx, 14, 13, 8, 25, 4, "#fff7e7");
    roundBlock(iconCtx, 20, 13, 5, 25, 3, "#ff7261");
    disc(iconCtx, 32, 28, 6, 8, "#d94a73");
    disc(iconCtx, 29, 24, 3, 3, "#ff8fa3");
    return;
  }
  if (id === "crit") {
    disc(iconCtx, 25, 21, 8, 12, "#fff7e7");
    roundBlock(iconCtx, 23, 31, 4, 7, 2, "#dce4ed");
    sparkleIcon(iconCtx, 34, 14, "#f2c45f");
    return;
  }
  if (id === "armor") {
    roundBlock(iconCtx, 13, 17, 22, 16, 6, "#9aa7b8");
    roundBlock(iconCtx, 18, 13, 12, 6, 4, "#dce4ed");
    roundBlock(iconCtx, 16, 28, 18, 5, 3, "#677187");
    disc(iconCtx, 24, 22, 3, 3, "#dce4ed");
    return;
  }
  if (id === "luck") {
    disc(iconCtx, 25, 25, 10, 10, "#f2c45f");
    disc(iconCtx, 21, 21, 2, 2, "#fff7e7");
    disc(iconCtx, 29, 21, 2, 2, "#fff7e7");
    disc(iconCtx, 21, 29, 2, 2, "#fff7e7");
    disc(iconCtx, 29, 29, 2, 2, "#fff7e7");
    sparkleIcon(iconCtx, 35, 14, "#fff0a6");
    return;
  }
  if (id === "harvesting") {
    roundBlock(iconCtx, 13, 19, 22, 17, 5, "#8d5d38");
    roundBlock(iconCtx, 15, 16, 18, 5, 3, "#74d3a4");
    leafIcon(iconCtx, 26, 13, 8, 5, "#92d486", -0.25);
    disc(iconCtx, 19, 27, 2, 2, "#6d432d");
    disc(iconCtx, 28, 30, 2, 2, "#6d432d");
    return;
  }
  if (id === "coupon_leaf") {
    leafIcon(iconCtx, 24, 24, 14, 9, "#74d3a4", -0.28);
    roundBlock(iconCtx, 18, 22, 13, 3, 2, "#fff7e7");
    roundBlock(iconCtx, 22, 27, 6, 3, 2, "#fff7e7");
    return;
  }
  if (id === "recycling_clamp") {
    roundBlock(iconCtx, 13, 13, 7, 22, 3, "#9aa7b8");
    roundBlock(iconCtx, 28, 13, 7, 22, 3, "#9aa7b8");
    roundBlock(iconCtx, 18, 28, 13, 6, 3, "#f2c45f");
    disc(iconCtx, 24, 20, 4, 4, "#dce4ed");
    return;
  }
  if (id === "garden_shears") {
    roundBlock(iconCtx, 18, 12, 5, 24, 2, "#dce4ed");
    roundBlock(iconCtx, 27, 12, 5, 24, 2, "#dce4ed");
    disc(iconCtx, 15, 32, 5, 5, "#74d3a4");
    disc(iconCtx, 33, 32, 5, 5, "#74d3a4");
    leafIcon(iconCtx, 24, 18, 6, 3, "#ff7261", 0.2);
    return;
  }
  if (id === "engineering") {
    roundBlock(iconCtx, 12, 18, 24, 17, 5, "#66c7d8");
    roundBlock(iconCtx, 18, 14, 12, 5, 3, "#9aa7b8");
    sparkleIcon(iconCtx, 24, 26, "#f2c45f");
    disc(iconCtx, 34, 17, 3, 3, "#dce4ed");
    return;
  }
  if (id === "melee") {
    roundBlock(iconCtx, 15, 18, 20, 15, 5, "#f6d28f");
    disc(iconCtx, 18, 15, 3, 5, "#f6d28f");
    disc(iconCtx, 25, 14, 3, 6, "#f6d28f");
    disc(iconCtx, 31, 16, 3, 5, "#f6d28f");
    roundBlock(iconCtx, 14, 28, 21, 5, 3, "#d06f3d");
    return;
  }
  if (id === "elemental") {
    disc(iconCtx, 24, 25, 9, 9, "#ff9c5b");
    sparkleIcon(iconCtx, 26, 17, "#f2c45f");
    disc(iconCtx, 15, 16, 3, 3, "#73b7ff");
    return;
  }
  if (id === "extra_arm") {
    roundBlock(iconCtx, 18, 12, 9, 28, 5, "#f6d28f");
    disc(iconCtx, 18, 14, 5, 5, "#f6d28f");
    disc(iconCtx, 28, 14, 5, 5, "#f6d28f");
    roundBlock(iconCtx, 15, 31, 16, 7, 4, "#74d3a4");
    sparkleIcon(iconCtx, 35, 13, "#ff9c3d");
    return;
  }
  if (id === "royal_whetstone") {
    roundBlock(iconCtx, 13, 24, 25, 9, 4, "#ba7eff");
    roundBlock(iconCtx, 16, 20, 18, 5, 3, "#ff9c3d");
    sparkleIcon(iconCtx, 34, 15, "#fff0a6");
    sparkleIcon(iconCtx, 17, 15, "#58aaff");
    return;
  }
  roundBlock(iconCtx, 16, 16, 18, 18, 5, "#dce4ed");
}

function drawWeaponIcon(iconCtxOrCanvas, name, tier = 1) {
  const isCanvas = Boolean(iconCtxOrCanvas.getContext);
  // When called on a canvas for a weapon with redesigned PNG art, route it through the
  // animated icon renderer (registers the canvas so it bobs/shines like item cards).
  if (isCanvas && ART_SOURCES[`weapon:${name}`]) {
    drawItemIcon(iconCtxOrCanvas, { weaponName: name, name, tier }, "weapon");
    return;
  }
  const iconCtx = isCanvas ? iconCtxOrCanvas.getContext("2d") : iconCtxOrCanvas;
  if (!iconCtx) return;
  if (isCanvas) {
    iconCtx.clearRect(0, 0, iconCtxOrCanvas.width, iconCtxOrCanvas.height);
  }
  iconCtx.imageSmoothingEnabled = true;
  iconCtx.save();
  iconCtx.translate(isCanvas ? iconCtxOrCanvas.width / 2 : 24, isCanvas ? iconCtxOrCanvas.height / 2 : 24);
  iconCtx.rotate(name === "Twig Wand" ? -0.18 : name === "Stub Club" ? 0.08 : -0.04);
  iconCtx.scale(isCanvas ? 1.02 : 0.58, isCanvas ? 1.02 : 0.58);
  drawWeaponSpriteShape(iconCtx, { name, tier });
  iconCtx.restore();
}

function drawMutationIcon(iconCtx, part) {
  drawCenteredPixelSprite(iconCtx, mutationSpriteFor(part), 1.45);
  return;
  const key = String(part).toLowerCase();
  if (key.includes("heart") || key.includes("vein")) {
    block(iconCtx, 17, 18, 7, 7, "#ff7261");
    block(iconCtx, 25, 18, 7, 7, "#ff7261");
    block(iconCtx, 15, 24, 19, 7, "#ff7261");
    block(iconCtx, 19, 31, 11, 6, "#d94a73");
    return;
  }
  if (key.includes("muscle")) {
    block(iconCtx, 13, 24, 13, 9, "#f6d28f");
    block(iconCtx, 23, 18, 13, 13, "#f6d28f");
    block(iconCtx, 30, 27, 7, 7, "#f6d28f");
    block(iconCtx, 15, 20, 7, 5, "#d06f3d");
    return;
  }
  if (key.includes("leg") || key.includes("ankle")) {
    block(iconCtx, 17, 14, 8, 22, "#74d3a4");
    block(iconCtx, 26, 16, 7, 18, "#74d3a4");
    block(iconCtx, 14, 34, 13, 5, "#fff7e7");
    block(iconCtx, 25, 32, 12, 5, "#fff7e7");
    return;
  }
  if (key.includes("hand") || key.includes("finger") || key.includes("thumb")) {
    block(iconCtx, 16, 20, 18, 14, "#f6d28f");
    block(iconCtx, 15, 14, 4, 9, "#f6d28f");
    block(iconCtx, 21, 13, 4, 9, "#f6d28f");
    block(iconCtx, 27, 14, 4, 9, "#f6d28f");
    return;
  }
  if (key.includes("eye")) {
    block(iconCtx, 13, 20, 24, 11, "#fff7e7");
    block(iconCtx, 22, 21, 7, 7, "#73b7ff");
    dot(iconCtx, 24, 23, 3, "#111722");
    return;
  }
  if (key.includes("brain") || key.includes("nerve") || key.includes("tendon")) {
    block(iconCtx, 14, 17, 21, 16, "#ba7eff");
    dot(iconCtx, 16, 14, 7, "#d9b7ff");
    dot(iconCtx, 25, 14, 7, "#d9b7ff");
    block(iconCtx, 20, 32, 10, 5, "#73b7ff");
    return;
  }
  if (key.includes("skin") || key.includes("mole")) {
    block(iconCtx, 15, 15, 20, 22, "#f6d28f");
    dot(iconCtx, 21, 21, 4, "#8d5d38");
    dot(iconCtx, 29, 28, 3, "#8d5d38");
    return;
  }
  if (key.includes("arm")) {
    block(iconCtx, 12, 23, 15, 8, "#f6d28f");
    block(iconCtx, 24, 18, 11, 12, "#f6d28f");
    block(iconCtx, 32, 26, 6, 6, "#f6d28f");
    return;
  }
  block(iconCtx, 16, 16, 18, 18, "#f2c45f");
}
