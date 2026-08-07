"use strict";

// render.js - canvas drawing: arena, entities, projectiles

function draw() {
  const shakeAmp = gameSettings.screenShake ? fx.shake : 0;
  ctx.save();
  if (shakeAmp > 0.2) {
    ctx.fillStyle = "#101720";
    ctx.fillRect(0, 0, W, H);
    ctx.translate(rand(-1, 1) * shakeAmp, rand(-1, 1) * shakeAmp);
  }
  drawArena();
  for (const ash of state.ashes) drawZapAsh(ash);
  for (const tree of state.trees) drawTree(tree);
  for (const crate of state.crates) drawCrate(crate);
  for (const drop of state.crateDrops) drawCrateDrop(drop);
  for (const cookie of state.fortuneCookies) drawFortuneCookie(cookie);
  for (const bulb of state.bulbs) drawBulb(bulb);
  for (const coin of state.coins) drawCoin(coin);
  for (const coin of state.bagAnimations) drawBagCoin(coin);
  for (const bullet of state.bullets) drawBullet(bullet);
  for (const bullet of state.enemyBullets) drawEnemyBullet(bullet);
  drawDrummerBuffLinks();
  for (const corpse of state.enemyDeaths ?? []) drawEnemyDeath(corpse);
  for (const enemy of state.enemies) drawEnemy(enemy);
  drawPlayer(state.player);
  drawArenaWeapon(state.player);
  for (const swing of state.swings) drawWeaponSwing(swing);
  for (const zap of state.zaps) drawEngineeringZap(zap);
  for (const p of state.particles) drawParticle(p);
  for (const floater of state.floaters) drawFloater(floater);
  if (state.mode !== "menu" && state.mode !== "playing") drawUnusedBag();
  ctx.restore();

  drawScreenFeedback();

  if (state.mode === "shop" || state.mode === "reward") {
    ctx.save();
    ctx.fillStyle = "rgba(8, 11, 16, 0.42)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

function drawScreenFeedback() {
  if (fx.playerFlash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 72, 84, ${Math.min(0.32, fx.playerFlash * 0.3)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  if (state.mode === "playing" || state.mode === "gameover") {
    const ratio = clamp(state.player.hp / Math.max(1, state.player.maxHp), 0, 1);
    if (ratio < 0.35) {
      const pulse = 0.6 + Math.sin(performance.now() / 240) * 0.4;
      const strength = (0.35 - ratio) / 0.35;
      const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.78);
      vignette.addColorStop(0, "rgba(214, 40, 57, 0)");
      vignette.addColorStop(1, `rgba(214, 40, 57, ${0.16 + strength * 0.3 * pulse})`);
      ctx.save();
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }
}

function drawArena() {
  const time = performance.now();
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, "#47626a");
  gradient.addColorStop(0.48, "#334f48");
  gradient.addColorStop(1, "#263b42");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 2;
  for (let x = 40; x < W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 50, H);
    ctx.stroke();
  }
  for (let y = 54; y < H; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y + 38);
    ctx.stroke();
  }

  const patchColors = [
    "rgba(47, 87, 72, 0.24)",
    "rgba(85, 116, 87, 0.2)",
    "rgba(41, 56, 61, 0.22)",
    "rgba(126, 100, 66, 0.13)"
  ];
  for (let i = 0; i < 22; i += 1) {
    const x = (i * 241 + 63) % W;
    const y = (i * 157 + 41) % H;
    ctx.fillStyle = patchColors[i % patchColors.length];
    ctx.beginPath();
    ctx.ellipse(x, y, 48 + (i % 5) * 16, 18 + (i % 4) * 8, (i % 7) * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(124, 204, 142, 0.16)";
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 173) % W;
    const y = (i * 97) % H;
    ctx.beginPath();
    ctx.ellipse(x, y, 14 + (i % 4) * 5, 5 + (i % 3) * 2, i, 0, Math.PI * 2);
    ctx.fill();
  }

  const pixelColors = [
    "rgba(173, 209, 151, 0.18)",
    "rgba(30, 43, 46, 0.18)",
    "rgba(229, 203, 132, 0.12)",
    "rgba(116, 211, 164, 0.13)"
  ];
  for (let i = 0; i < 190; i += 1) {
    const x = Math.floor(((i * 67 + 19) % W) / 4) * 4;
    const y = Math.floor(((i * 131 + 53) % H) / 4) * 4;
    const size = 2 + (i % 3) * 2;
    ctx.fillStyle = pixelColors[i % pixelColors.length];
    ctx.fillRect(x, y, size, size);
  }

  for (let i = 0; i < 18; i += 1) {
    const x = (i * 311 + 94) % W;
    const y = (i * 167 + 128) % H;
    drawGroundDetail(x, y, i);
  }

  ctx.save();
  ctx.globalAlpha = 0.42;
  for (let i = 0; i < 34; i += 1) {
    const stamp = i % 3 === 0 ? pixelSprites.groundMoss : i % 3 === 1 ? pixelSprites.groundPebbles : pixelSprites.groundFlowers;
    const x = ((i * 227 + 71) % W) - 8;
    const y = ((i * 173 + 39) % H) - 8;
    drawPixelSprite(ctx, stamp, x, y, 2);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(194, 223, 151, 0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 46; i += 1) {
    const x = (i * 113 + 37) % W;
    const y = (i * 191 + 29) % H;
    const sway = Math.sin(time / 900 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8 + sway, y - 5 - (i % 4));
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 247, 231, 0.08)";
  for (let i = 0; i < 12; i += 1) {
    const pulse = 0.45 + Math.sin(time / 700 + i * 1.9) * 0.25;
    const x = (i * 281 + 120) % W;
    const y = (i * 149 + 96) % H;
    ctx.globalAlpha = pulse;
    ctx.fillRect(x, y, 4, 4);
  }
  ctx.globalAlpha = 1;

  const vignette = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.62);
  vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
  vignette.addColorStop(1, "rgba(6, 10, 16, 0.18)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawGroundDetail(x, y, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((seed % 9) * 0.26);

  if (seed % 3 === 0) {
    ctx.strokeStyle = "rgba(20, 31, 35, 0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-6, -3);
    ctx.lineTo(2, 2);
    ctx.lineTo(14, -2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 247, 231, 0.05)";
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(6, 6);
    ctx.stroke();
  } else if (seed % 3 === 1) {
    const colors = ["#5a7f66", "#7ca46d", "#365f58"];
    for (let i = 0; i < 7; i += 1) {
      const px = -13 + i * 4 + (seed % 2) * 2;
      const py = (i % 2) * 4;
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(px, py, 3, 10 - (i % 3) * 2);
    }
  } else {
    ctx.fillStyle = "rgba(32, 42, 45, 0.22)";
    ctx.fillRect(-12, -3, 6, 4);
    ctx.fillRect(-3, 2, 4, 3);
    ctx.fillRect(7, -1, 7, 5);
    ctx.fillStyle = "rgba(231, 203, 137, 0.14)";
    ctx.fillRect(-8, -7, 4, 3);
    ctx.fillRect(5, -6, 3, 3);
  }

  ctx.restore();
}

function drawPlayer(player) {
  // Once the run is over the spud is replaced in-place by a little headstone, so the arena
  // still shows where you fell. The big centre-screen gravestone card is separate (see
  // js/00-gravestone.js) and plays over the top of this.
  if (state.mode === "gameover") {
    drawPlayerGrave(player);
    return;
  }
  ctx.save();
  const moving = keys.has("KeyW") || keys.has("ArrowUp") || keys.has("KeyS") || keys.has("ArrowDown") || keys.has("KeyA") || keys.has("ArrowLeft") || keys.has("KeyD") || keys.has("ArrowRight");
  const time = performance.now();
  const bob = moving ? Math.sin(time / 92) * 2.6 : Math.sin(time / 420) * 0.8;
  const lean = moving ? Math.sin(time / 150) * 0.035 : 0;
  ctx.translate(player.x, player.y + bob);
  ctx.rotate(lean);
  const charScale = state.character?.scale ?? 1;
  const stepSquash = moving ? Math.sin(time / 92) * 0.025 : 0;
  ctx.scale((player.hurtTimer > 0 ? 1.07 : 1 + stepSquash) * charScale, (player.hurtTimer > 0 ? 0.94 : 1 - stepSquash) * charScale);
  drawShadow(0, 18, 25, 9);
  drawSpudBody(ctx, state.character ?? characters[0], player.hurtTimer > 0);
  ctx.restore();
}

// The headstone that marks where the player died. Rises and settles once rather than
// looping, so it reads as a one-off beat rather than an idle animation.
function drawPlayerGrave(player) {
  const art = artFor("ui:gravestone");
  const rise = clamp((state.graveTimer ?? 0) / 0.45, 0, 1);
  const eased = 1 - Math.pow(1 - rise, 3);
  ctx.save();
  ctx.translate(player.x, player.y);
  drawShadow(0, 18, 24 * eased, 9 * eased);
  ctx.globalAlpha = eased;
  if (art) {
    const size = 74 * (0.6 + eased * 0.4);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(art, -size / 2, -size + 22, size, size);
  } else {
    // Fallback slab if the PNG hasn't loaded, so the death spot is never blank.
    ctx.fillStyle = "#9aa7b8";
    ctx.strokeStyle = "#111722";
    ctx.lineWidth = 3;
    ctx.beginPath();
    roundedRectPath(ctx, -16, -40, 32, 46, 14);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function getPrimaryWeapon() {
  if (!state?.weapons?.length) return null;
  return state.weapons.reduce((best, weapon) => {
    if (!best) return weapon;
    if (weapon.tier > best.tier) return weapon;
    return best;
  }, null);
}

function drawArenaWeapon(player) {
  if (!state.weapons.length) return;

  const time = performance.now();
  const count = Math.min(maxWeaponSlots(), state.weapons.length);
  const scale = weaponArenaScale(count);
  // Mirror fireEquippedWeapons' targeting gate so the aim visual never points at a crate
  // while the weapon itself is actually holding fire on enemies (see destructiblesTargetable
  // in 07-combat.js for why a per-slot range check alone lets that happen).

  for (let index = 0; index < count; index += 1) {
    const weapon = state.weapons[index];
    // Per-weapon, matching fireEquippedWeapons exactly: a short-reach melee weapon may
    // swing at a crate while the long-range guns stay locked on a distant fight.
    const allowDestructibles = destructiblesTargetable(player, state.weapons, count, weapon);
    const slot = getWeaponSlotPosition(player, index, count, time);
    if (isWeaponSlotSwinging(weapon, index)) {
      continue;
    }
    const target = allowDestructibles
      ? findNearestEnemyFrom(slot.x, slot.y, weaponRange(weapon)) ?? findNearestDestructibleFrom(slot.x, slot.y, weaponRange(weapon))
      : findNearestEnemyFrom(slot.x, slot.y, weaponRange(weapon));
    let angle = target ? Math.atan2(target.y - slot.y, target.x - slot.x) : slot.slotAngle + Math.PI / 2;
    // Melee weapons (the Stub Club) gently sway around their ready pose instead of locking
    // rigidly to the aim, so the idle-to-swing motion reads as one fluid, weighty arc.
    if (getWeaponStatProfile(weapon).attackType === "swing") {
      angle += Math.sin(time / 340 + index * 1.7) * 0.16;
    }
    const overlapEnemy = state.enemies.some((enemy) => {
      const dx = enemy.x - slot.x;
      const dy = enemy.y - slot.y;
      const radius = enemy.radius + 22;
      return dx * dx + dy * dy < radius * radius;
    });

    // Idle "breathing" pulse: a subtle scale wobble unique per slot so the whole
    // loadout feels alive even when nothing is firing.
    const breathe = 1 + Math.sin(time / 360 + index * 1.3) * 0.045;
    const arenaArt = weaponArenaArt(weapon.name);

    ctx.save();
    ctx.globalAlpha = overlapEnemy ? 0.54 : 0.94;
    ctx.translate(slot.x, slot.y);
    ctx.rotate(angle);
    // Recoil kick: shove the weapon back along its aim (local -x) right after firing.
    if (weapon.recoil > 0) ctx.translate(-weapon.recoil, 0);
    ctx.scale(scale * breathe, scale * breathe);
    if (arenaArt) {
      // Tile-less weapon PNG: draw it centered, cropped to its content bbox and scaled
      // to preserve its true aspect ratio (see drawWeaponArtFitted) instead of stretching
      // into a square. boxSize is the longest edge of the cropped content, not the old
      // canvas-edge "size" - now that padding is cropped away the weapon reads bigger at
      // the same box, so this is tuned down from the old 52 to land on a similar on-screen
      // mass while staying a touch larger, matching detailed art cleanly without crowding
      // the player when several weapons orbit at once. The per-weapon angle correction
      // levels its display-pose barrel to the aim direction.
      const boxSize = 44;
      ctx.save();
      ctx.rotate(arenaWeaponAngle(weapon.name));
      drawWeaponArtFitted(ctx, weapon.name, arenaArt, boxSize);
      ctx.restore();
    } else {
      drawWeaponSpriteShape(ctx, weapon);
    }
    ctx.restore();
  }
}

// Matched on slot index rather than a proximity check: since the swing's origin now
// tracks the same orbiting slot every frame (see weaponSwingOrigin in 07-combat.js), the
// old "within 12px" distance test could fail on a fast orbit and let the idle PNG and the
// swinging weapon render on the same frame. An index match can never miss.
function isWeaponSlotSwinging(weapon, index) {
  return state.swings.some((swing) => swing.weaponIndex === index && swing.weaponName === weapon.name);
}

function drawWeaponSwing(swing) {
  const geom = weaponSwingGeometry(swing);
  const alpha = clamp(Math.sin(geom.progress * Math.PI) * 1.15, 0, 1);
  const extensionPush = geom.gripPush + Math.sin(geom.progress * Math.PI) * 3;
  const weapon = { name: swing.weaponName, tier: swing.tier ?? 1 };
  const scale = 1.02 + (swing.crit ? 0.08 : 0);
  const reveal = clamp(geom.activeLength / Math.max(1, geom.weaponLength), 0.38, 1);
  const x = geom.x + Math.cos(geom.current) * extensionPush;
  const y = geom.y + Math.sin(geom.current) * extensionPush;

  ctx.save();
  ctx.globalAlpha = 0.16 * alpha;
  ctx.strokeStyle = swing.crit ? "rgba(255, 207, 93, 0.7)" : "rgba(255, 247, 231, 0.42)";
  ctx.lineCap = "round";
  ctx.lineWidth = swing.crit ? 13 : 9;
  ctx.beginPath();
  ctx.moveTo(geom.innerX, geom.innerY);
  ctx.lineTo(geom.headX, geom.headY);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.96;
  ctx.translate(x, y);
  ctx.rotate(geom.current);
  ctx.scale(scale * reveal, scale);

  // Use the SAME PNG as the idle orbiting sprite so the weapon never visibly swaps art the
  // instant it attacks. drawWeaponSpriteShape (the old hand-drawn vector) is now only a
  // fallback for weapons with no arena art.
  const arenaArt = weaponArenaArt(swing.weaponName);
  if (arenaArt) {
    // Same aspect-correct fit and boxSize as the idle orbiting sprite (see drawArenaWeapon)
    // so the club neither changes proportions nor jumps size the instant it swings. The
    // grip sits toward the sprite's handle end rather than its centre, so the swing pivots
    // around the handle with the head leading, the way a held weapon actually moves.
    const boxSize = 44;
    ctx.rotate(arenaWeaponAngle(swing.weaponName));
    drawWeaponArtFitted(ctx, swing.weaponName, arenaArt, boxSize, 0.18);
  } else {
    const grip = weaponGripOffset(swing.weaponName);
    ctx.translate(-grip.x, -grip.y);
    drawWeaponSpriteShape(ctx, weapon);
  }

  if (swing.crit) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ffcf5d";
    ctx.beginPath();
    ctx.ellipse(18, -2, 28, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function weaponGripOffset(name) {
  if (name === "Stub Club") return { x: -34, y: 0 };
  return { x: -28, y: 0 };
}

function drawWeaponSpriteShape(targetCtx, weapon) {
  const tierColor = rarities[Math.min(MAX_WEAPON_RANK, weapon.tier)]?.color ?? "#dce4ed";
  targetCtx.save();
  targetCtx.lineWidth = 2.4;
  targetCtx.strokeStyle = "#111722";

  if (weapon.name === "Twig Wand") {
    const wood = targetCtx.createLinearGradient(-30, -4, 22, 5);
    wood.addColorStop(0, "#5e3827");
    wood.addColorStop(0.5, "#a86b3f");
    wood.addColorStop(1, "#6d432d");
    targetCtx.fillStyle = wood;
    targetCtx.beginPath();
    targetCtx.moveTo(-32, 3);
    targetCtx.bezierCurveTo(-18, -8, 3, -6, 21, -1);
    targetCtx.quadraticCurveTo(24, 0, 22, 4);
    targetCtx.bezierCurveTo(1, 9, -19, 7, -33, 6);
    targetCtx.quadraticCurveTo(-36, 5, -32, 3);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.strokeStyle = "rgba(17,23,34,0.26)";
    targetCtx.lineWidth = 1.2;
    targetCtx.beginPath();
    targetCtx.moveTo(-23, 1);
    targetCtx.quadraticCurveTo(-7, -3, 11, 0);
    targetCtx.moveTo(-20, 5);
    targetCtx.quadraticCurveTo(-5, 5, 12, 3);
    targetCtx.stroke();

    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 1.8;
    for (const wrap of [-12, -3, 7]) {
      targetCtx.beginPath();
      targetCtx.moveTo(wrap, -5);
      targetCtx.lineTo(wrap + 4, 7);
      targetCtx.stroke();
    }

    targetCtx.strokeStyle = "#d8dde8";
    targetCtx.lineWidth = 1.2;
    targetCtx.beginPath();
    targetCtx.moveTo(-28, -2);
    targetCtx.bezierCurveTo(-10, -10, 4, -8, 18, -2);
    targetCtx.stroke();

    targetCtx.fillStyle = "#74d3a4";
    targetCtx.beginPath();
    targetCtx.ellipse(-18, -5, 8, 4, -0.55, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = tierColor;
    targetCtx.beginPath();
    targetCtx.moveTo(20, -13);
    targetCtx.lineTo(32, -3);
    targetCtx.lineTo(25, 11);
    targetCtx.lineTo(12, 3);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "rgba(255,247,231,0.7)";
    targetCtx.beginPath();
    targetCtx.ellipse(23, -4, 4, 2, -0.4, 0, Math.PI * 2);
    targetCtx.fill();
  } else if (weapon.name === "Stub Club") {
    const handle = targetCtx.createLinearGradient(-34, 0, -8, 4);
    handle.addColorStop(0, "#5d3928");
    handle.addColorStop(1, "#9a643d");
    targetCtx.fillStyle = handle;
    targetCtx.beginPath();
    roundedRectPath(targetCtx, -36, -5, 28, 10, 5);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.strokeStyle = "#f2c45f";
    targetCtx.lineWidth = 1.8;
    targetCtx.beginPath();
    targetCtx.moveTo(-31, -5);
    targetCtx.lineTo(-23, 6);
    targetCtx.moveTo(-25, -6);
    targetCtx.lineTo(-17, 5);
    targetCtx.stroke();

    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 2.4;
    const club = targetCtx.createRadialGradient(4, -8, 4, 4, 0, 29);
    club.addColorStop(0, "#d7a363");
    club.addColorStop(0.56, "#8d5d38");
    club.addColorStop(1, "#573522");
    targetCtx.fillStyle = club;
    targetCtx.beginPath();
    targetCtx.moveTo(-11, -12);
    targetCtx.bezierCurveTo(1, -20, 24, -15, 30, -4);
    targetCtx.bezierCurveTo(35, 8, 21, 17, 1, 14);
    targetCtx.bezierCurveTo(-13, 12, -19, 4, -16, -5);
    targetCtx.quadraticCurveTo(-15, -9, -11, -12);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "rgba(255,247,231,0.34)";
    targetCtx.beginPath();
    targetCtx.ellipse(6, -8, 12, 4, -0.1, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.fillStyle = "rgba(60,35,24,0.4)";
    targetCtx.beginPath();
    targetCtx.arc(15, 5, 2.5, 0, Math.PI * 2);
    targetCtx.arc(2, 8, 2, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.strokeStyle = "#2f241d";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(12, -14);
    targetCtx.lineTo(16, -21);
    targetCtx.moveTo(24, -8);
    targetCtx.lineTo(32, -13);
    targetCtx.stroke();

    targetCtx.fillStyle = tierColor;
    targetCtx.beginPath();
    targetCtx.arc(19, -13, 3.5 + weapon.tier, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
  } else if (weapon.name === "Rusty Pistol") {
    const metal = targetCtx.createLinearGradient(-28, -10, 31, 7);
    metal.addColorStop(0, "#6c7686");
    metal.addColorStop(0.52, "#d8dde8");
    metal.addColorStop(1, "#6a7482");
    targetCtx.fillStyle = metal;
    targetCtx.beginPath();
    targetCtx.moveTo(-30, -8);
    targetCtx.quadraticCurveTo(-6, -15, 28, -9);
    targetCtx.lineTo(33, -2);
    targetCtx.quadraticCurveTo(17, 4, -19, 4);
    targetCtx.quadraticCurveTo(-30, 1, -30, -8);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#3e4755";
    targetCtx.beginPath();
    roundedRectPath(targetCtx, 8, -5, 25, 8, 3);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#111722";
    targetCtx.beginPath();
    targetCtx.ellipse(32, -2, 3.8, 4.8, 0, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(-11, 2);
    targetCtx.quadraticCurveTo(-4, 11, 5, 2);
    targetCtx.stroke();

    const grip = targetCtx.createLinearGradient(-21, 3, -8, 25);
    grip.addColorStop(0, "#935c36");
    grip.addColorStop(1, "#4f3124");
    targetCtx.fillStyle = grip;
    targetCtx.beginPath();
    targetCtx.moveTo(-20, 1);
    targetCtx.lineTo(-6, 4);
    targetCtx.lineTo(-12, 25);
    targetCtx.quadraticCurveTo(-24, 22, -27, 10);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.strokeStyle = "rgba(17,23,34,0.32)";
    targetCtx.lineWidth = 1.4;
    targetCtx.beginPath();
    targetCtx.moveTo(-20, 7);
    targetCtx.lineTo(-10, 10);
    targetCtx.moveTo(-22, 13);
    targetCtx.lineTo(-13, 16);
    targetCtx.stroke();

    targetCtx.fillStyle = tierColor;
    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 1.8;
    targetCtx.beginPath();
    targetCtx.arc(-1, -3, 4 + weapon.tier * 0.7, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
  } else if (weapon.name === "Slingshot") {
    const wood = targetCtx.createLinearGradient(-20, 21, 15, -20);
    wood.addColorStop(0, "#5d3928");
    wood.addColorStop(0.5, "#b97843");
    wood.addColorStop(1, "#6d432d");
    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 8;
    targetCtx.lineCap = "round";
    targetCtx.beginPath();
    targetCtx.moveTo(-12, 23);
    targetCtx.quadraticCurveTo(-6, 1, -18, -17);
    targetCtx.moveTo(-12, 23);
    targetCtx.quadraticCurveTo(-5, 0, 15, -18);
    targetCtx.stroke();
    targetCtx.strokeStyle = wood;
    targetCtx.lineWidth = 5;
    targetCtx.beginPath();
    targetCtx.moveTo(-12, 23);
    targetCtx.quadraticCurveTo(-6, 1, -18, -17);
    targetCtx.moveTo(-12, 23);
    targetCtx.quadraticCurveTo(-5, 0, 15, -18);
    targetCtx.stroke();

    targetCtx.strokeStyle = "#2a2530";
    targetCtx.lineWidth = 3;
    targetCtx.beginPath();
    targetCtx.moveTo(-18, -17);
    targetCtx.quadraticCurveTo(-2, -6, 15, -18);
    targetCtx.stroke();

    targetCtx.fillStyle = "#7b5137";
    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.ellipse(-1, -7, 9, 5, 0.05, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#8c6a4a";
    targetCtx.beginPath();
    targetCtx.arc(2, -8, 4.2, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.strokeStyle = "#f2c45f";
    targetCtx.lineWidth = 1.6;
    targetCtx.beginPath();
    targetCtx.moveTo(-15, 10);
    targetCtx.lineTo(-5, 13);
    targetCtx.moveTo(-17, 16);
    targetCtx.lineTo(-7, 19);
    targetCtx.stroke();

    targetCtx.fillStyle = tierColor;
    targetCtx.beginPath();
    targetCtx.arc(-17, -18, 3.2 + weapon.tier, 0, Math.PI * 2);
    targetCtx.arc(15, -18, 3.2 + weapon.tier, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
  } else if (weapon.name === "Scrap Revolver") {
    const steel = targetCtx.createLinearGradient(-30, -12, 34, 8);
    steel.addColorStop(0, "#4e5867");
    steel.addColorStop(0.48, "#bcc7d4");
    steel.addColorStop(1, "#333b49");
    targetCtx.fillStyle = steel;
    targetCtx.beginPath();
    targetCtx.moveTo(-28, -10);
    targetCtx.quadraticCurveTo(-6, -18, 31, -10);
    targetCtx.lineTo(37, -2);
    targetCtx.quadraticCurveTo(14, 4, -25, 3);
    targetCtx.quadraticCurveTo(-33, -2, -28, -10);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#2d3440";
    targetCtx.beginPath();
    roundedRectPath(targetCtx, 8, -6, 29, 9, 4);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#111722";
    targetCtx.beginPath();
    targetCtx.ellipse(36, -2, 4.5, 5.5, 0, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(-2, 4);
    targetCtx.quadraticCurveTo(6, 13, 14, 2);
    targetCtx.moveTo(-18, -10);
    targetCtx.quadraticCurveTo(-14, -18, -5, -15);
    targetCtx.stroke();

    targetCtx.fillStyle = "#f2c45f";
    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.ellipse(-6, -2, 9, 10, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.fillStyle = "#6c4a2c";
    for (let i = 0; i < 6; i += 1) {
      const angle = i * Math.PI / 3;
      targetCtx.beginPath();
      targetCtx.arc(-6 + Math.cos(angle) * 4, -2 + Math.sin(angle) * 4, 1.4, 0, Math.PI * 2);
      targetCtx.fill();
    }

    targetCtx.fillStyle = "#7d4f34";
    targetCtx.strokeStyle = "#111722";
    targetCtx.beginPath();
    targetCtx.moveTo(-23, 2);
    targetCtx.lineTo(-8, 5);
    targetCtx.lineTo(-13, 26);
    targetCtx.quadraticCurveTo(-27, 22, -30, 9);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = tierColor;
    targetCtx.beginPath();
    targetCtx.arc(9, -12, 3.5 + weapon.tier, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
  } else if (weapon.name === "Tin Dragon Flamethrower") {
    const tank = targetCtx.createLinearGradient(-35, -14, -12, 18);
    tank.addColorStop(0, "#ffcf6d");
    tank.addColorStop(0.55, "#d06f3d");
    tank.addColorStop(1, "#7a3e2e");
    targetCtx.fillStyle = tank;
    targetCtx.beginPath();
    roundedRectPath(targetCtx, -36, -15, 22, 30, 9);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 6;
    targetCtx.lineCap = "round";
    targetCtx.beginPath();
    targetCtx.moveTo(-15, 4);
    targetCtx.bezierCurveTo(-3, 14, 9, 11, 19, 3);
    targetCtx.stroke();
    targetCtx.strokeStyle = "#5a3030";
    targetCtx.lineWidth = 3;
    targetCtx.stroke();

    const nozzle = targetCtx.createLinearGradient(-5, -9, 38, 8);
    nozzle.addColorStop(0, "#626d7c");
    nozzle.addColorStop(0.56, "#d8dde8");
    nozzle.addColorStop(1, "#394251");
    targetCtx.fillStyle = nozzle;
    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 2.4;
    targetCtx.beginPath();
    targetCtx.moveTo(-4, -9);
    targetCtx.lineTo(28, -12);
    targetCtx.quadraticCurveTo(39, -8, 39, -2);
    targetCtx.quadraticCurveTo(27, 5, -6, 6);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#ff9c5b";
    targetCtx.beginPath();
    targetCtx.moveTo(37, -5);
    targetCtx.bezierCurveTo(46, -13, 50, -2, 41, 5);
    targetCtx.bezierCurveTo(39, 2, 39, -1, 37, -5);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#fff7e7";
    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 1.8;
    targetCtx.beginPath();
    targetCtx.arc(-26, -5, 5, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.strokeStyle = "#d06f3d";
    targetCtx.beginPath();
    targetCtx.moveTo(-26, -5);
    targetCtx.lineTo(-22, -8);
    targetCtx.stroke();

    targetCtx.fillStyle = tierColor;
    targetCtx.beginPath();
    targetCtx.arc(-26, -4, 3.5 + weapon.tier, 0, Math.PI * 2);
    targetCtx.arc(-26, 7, 2.6 + weapon.tier * 0.6, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
  } else if (weapon.name === "Grenade Launcher") {
    const tube = targetCtx.createLinearGradient(-34, -13, 39, 12);
    tube.addColorStop(0, "#3f4654");
    tube.addColorStop(0.45, "#8f9aaa");
    tube.addColorStop(1, "#2a303b");
    targetCtx.fillStyle = tube;
    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 2.8;
    targetCtx.beginPath();
    targetCtx.moveTo(-35, -13);
    targetCtx.lineTo(29, -13);
    targetCtx.quadraticCurveTo(42, -7, 40, 4);
    targetCtx.lineTo(35, 10);
    targetCtx.lineTo(-31, 9);
    targetCtx.quadraticCurveTo(-40, 0, -35, -13);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#111722";
    targetCtx.beginPath();
    targetCtx.ellipse(35, -2, 7, 9, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.strokeStyle = "#dce4ed";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.ellipse(35, -2, 4, 5, 0, 0, Math.PI * 2);
    targetCtx.stroke();

    targetCtx.fillStyle = "#7d4f34";
    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 2.2;
    targetCtx.beginPath();
    targetCtx.moveTo(-24, 7);
    targetCtx.lineTo(-7, 9);
    targetCtx.lineTo(-11, 26);
    targetCtx.quadraticCurveTo(-25, 23, -30, 11);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#f2c45f";
    targetCtx.beginPath();
    roundedRectPath(targetCtx, -8, 2, 16, 10, 4);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#4f5b68";
    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    roundedRectPath(targetCtx, -39, -5, 12, 11, 4);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#73b7ff";
    targetCtx.beginPath();
    targetCtx.arc(13, -15, 3.5, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.strokeStyle = "rgba(17,23,34,0.32)";
    targetCtx.lineWidth = 1.4;
    for (const x of [-22, -10, 3, 16]) {
      targetCtx.beginPath();
      targetCtx.moveTo(x, -11);
      targetCtx.lineTo(x + 4, 8);
      targetCtx.stroke();
    }

    targetCtx.fillStyle = tierColor;
    targetCtx.strokeStyle = "#111722";
    targetCtx.beginPath();
    targetCtx.arc(-24, -15, 3 + weapon.tier, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
  } else {
    const body = targetCtx.createLinearGradient(-31, -9, 27, 8);
    body.addColorStop(0, "#315171");
    body.addColorStop(0.45, "#73b7ff");
    body.addColorStop(1, "#e0f3ff");
    targetCtx.fillStyle = body;
    targetCtx.beginPath();
    if ((state?.player?.projectiles ?? 1) > 1) {
      targetCtx.moveTo(-26, -13);
      targetCtx.lineTo(13, -13);
      targetCtx.quadraticCurveTo(26, -9, 26, -2);
      targetCtx.lineTo(26, 2);
      targetCtx.quadraticCurveTo(10, 4, -26, 2);
      targetCtx.closePath();
      targetCtx.moveTo(-26, 1);
      targetCtx.lineTo(13, 1);
      targetCtx.quadraticCurveTo(26, 5, 26, 12);
      targetCtx.quadraticCurveTo(8, 14, -26, 12);
      targetCtx.closePath();
    } else {
      targetCtx.moveTo(-31, -9);
      targetCtx.bezierCurveTo(-12, -15, 12, -13, 28, -7);
      targetCtx.quadraticCurveTo(33, -1, 27, 7);
      targetCtx.bezierCurveTo(8, 12, -14, 12, -31, 7);
      targetCtx.quadraticCurveTo(-36, 0, -31, -9);
      targetCtx.closePath();
    }
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "#7d4f34";
    targetCtx.beginPath();
    targetCtx.moveTo(-36, -8);
    targetCtx.lineTo(-23, -6);
    targetCtx.lineTo(-20, 10);
    targetCtx.lineTo(-34, 13);
    targetCtx.quadraticCurveTo(-40, 2, -36, -8);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.strokeStyle = "#3f2c21";
    targetCtx.lineWidth = 1.4;
    targetCtx.beginPath();
    targetCtx.moveTo(-33, -1);
    targetCtx.lineTo(-23, 1);
    targetCtx.moveTo(-31, 6);
    targetCtx.lineTo(-22, 5);
    targetCtx.stroke();

    targetCtx.fillStyle = "#f2c45f";
    targetCtx.strokeStyle = "#111722";
    targetCtx.lineWidth = 1.8;
    targetCtx.beginPath();
    targetCtx.ellipse(-18, 2, 5, 8, -0.18, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = "rgba(255,255,255,0.45)";
    targetCtx.beginPath();
    targetCtx.ellipse(-7, -7, 12, 3.5, -0.12, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.fillStyle = "#102033";
    targetCtx.beginPath();
    targetCtx.arc(27, -1, 3.2, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.strokeStyle = "#102033";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(13, -11);
    targetCtx.lineTo(22, -16);
    targetCtx.lineTo(29, -10);
    targetCtx.moveTo(-6, 10);
    targetCtx.quadraticCurveTo(1, 18, 10, 9);
    targetCtx.stroke();

    targetCtx.fillStyle = tierColor;
    targetCtx.beginPath();
    targetCtx.arc(6, 9, 4 + weapon.tier, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();
  }
  targetCtx.restore();
}

// Animated open cartoon eyes (white eyeball + upper eyelid + dark pupil + highlight + blink +
// gaze drift) painted over the PNG character's baked-in sleepy slit-eyes. The eye position is
// tuned per character (their sprites frame the face slightly differently). Before drawing each
// open eye, a soft skin-tone radial-gradient patch masks out the baked slit underneath so only
// our drawn eye shows — the gradient fades to transparent at the rim so there's no visible patch
// seam against the shaded potato face. The eyeball itself is drawn as a wide, low almond with a
// partial upper lid (rather than a tall exposed oval) to avoid a "googly eyes" look.
//
// All anchor + mask numbers below are MEASURED, not guessed: a Node/sharp script scanned each
// 512x512 source PNG for the two dark (luminance<90), opaque (alpha>180), horizontal-slit-shaped
// pixel clusters in the upper-middle face region (baked eye slits), took their centroids and
// bounding boxes in source px, then converted to this function's local sprite space via
// localX = (sx/512)*88 - 44, localY = (sy/512)*88 - 50 (matching drawSpudBody's
// drawImage(art, -44, -50, 88, 88) placement). maskHalfW/maskHalfH are the measured slit
// half-width/half-height (converted to local scale) plus a +1.5 local px safety margin.
//
// Measured source-px slit centroids/bboxes (from BrotatoStandalonePrototype/assets/characters):
//   sprout: L centroid=(212.5,263.1) bbox 35x12 | R centroid=(296.9,263.0) bbox 37x12
//   chunk:  L centroid=(205.8,249.8) bbox 46x15 | R centroid=(298.7,249.6) bbox 44x15
//   zip:    L centroid=(209.6,246.3) bbox 42x13 | R centroid=(299.9,246.3) bbox 44x13
const CHARACTER_EYES = {
  sprout: { x: -0.22, y: -4.79, spread: 7.26, r: 2.8, maskHalfW: 4.68, maskHalfH: 2.53 },
  chunk:  { x: -0.64, y: -7.08, spread: 7.98, r: 3.0, maskHalfW: 5.45, maskHalfH: 2.79 },
  zip:    { x: -0.21, y: -7.67, spread: 7.76, r: 2.75, maskHalfW: 5.28, maskHalfH: 2.62 }
};

function drawSpudEyes(g, character) {
  const cfg = CHARACTER_EYES[character?.id] ?? CHARACTER_EYES.sprout;
  // De-sync blinking per character so the cast doesn't all blink in perfect unison: derive a
  // stable per-character phase offset from their id (sum of char codes mod the blink period).
  let idOffset = 0;
  const id = character?.id;
  if (id) {
    for (let i = 0; i < id.length; i++) idOffset += id.charCodeAt(i);
    idOffset = idOffset % 3200;
  }
  const time = performance.now() + idOffset;
  // Blink ~ every 3.2s for a brief, quick moment; a slow gaze drift keeps them lively.
  const blinkPhase = (time % 3200) / 3200;
  const blinking = blinkPhase > 0.965;
  const gaze = Math.sin(time / 1400) * 0.45;     // pupils drift left/right a touch

  const lx = cfg.x - cfg.spread;
  const rx = cfg.x + cfg.spread;

  g.save();
  for (const ex of [lx, rx]) {
    // Cover the PNG's baked slit-eye underneath so only our drawn eye shows. Sized directly
    // from the MEASURED slit bounding box (+ safety margin) so it reliably covers the slit
    // regardless of the drawn eyeball's own radius. Soft radial gradient fades to transparent
    // at the rim -> no visible patch seam on the shaded face.
    const maskRx = cfg.maskHalfW;
    const maskRy = cfg.maskHalfH;
    const mask = g.createRadialGradient(ex, cfg.y, 0, ex, cfg.y, Math.max(maskRx, maskRy));
    mask.addColorStop(0, "rgba(224,196,150,0.98)");
    mask.addColorStop(0.7, "rgba(224,196,150,0.92)");
    mask.addColorStop(1, "rgba(224,196,150,0)");
    g.fillStyle = mask;
    g.beginPath();
    g.ellipse(ex, cfg.y, maskRx, maskRy, 0, 0, Math.PI * 2);
    g.fill();

    if (blinking) {
      // closed lid: a short, soft line (thinner + lighter than a hard bar)
      g.strokeStyle = "#3a2618";
      g.lineWidth = 1.8;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(ex - cfg.r, cfg.y);
      g.lineTo(ex + cfg.r, cfg.y);
      g.stroke();
      continue;
    }
    // eye white: wide, low almond/lens shape (wider than tall) instead of a tall googly oval
    const eyeRx = cfg.r * 1.05;
    const eyeRy = cfg.r * 0.72;
    g.fillStyle = "#fdfdf7";
    g.strokeStyle = "#20160f";
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(ex, cfg.y, eyeRx, eyeRy, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Pupil, highlight and lid all live inside the eye shape. The pupil is deliberately large
    // enough to run past the almond's lower edge, so everything from here is clipped to the
    // white — that both keeps the iris from spilling onto the cheek and lets the lid genuinely
    // sit over the top of the eye rather than beside it.
    g.save();
    g.beginPath();
    g.ellipse(ex, cfg.y, eyeRx, eyeRy, 0, 0, Math.PI * 2);
    g.clip();
    // pupil
    g.fillStyle = "#20160f";
    g.beginPath();
    g.arc(ex + gaze, cfg.y + cfg.r * 0.35, cfg.r * 0.55, 0, Math.PI * 2);
    g.fill();
    // highlight
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.beginPath();
    g.arc(ex + gaze - cfg.r * 0.32, cfg.y + cfg.r * 0.35 - cfg.r * 0.22, cfg.r * 0.22, 0, Math.PI * 2);
    g.fill();
    // upper eyelid: shade the top of the eye so the eyeball isn't a fully exposed circle —
    // this is the single biggest fix for the "creepy staring" look.
    g.fillStyle = "rgba(150,112,72,0.85)";
    g.beginPath();
    g.ellipse(ex, cfg.y - eyeRy * 0.62, eyeRx * 1.02, eyeRy * 0.62, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.restore();
}

function drawSpudBody(targetCtx, character, hurt = false) {
  // Redesigned PNG character art, when available: draw it centered in the same local space
  // the code body uses (roughly a 64-wide sprite around origin, feet near y=+30). The
  // caller already applied bob/lean/squash, so this stays a plain centered draw plus a
  // red hurt flash re-stamp using the sprite's own alpha.
  const art = characterArt(character);
  if (art) {
    const size = 88;
    const dx = -size / 2, dy = -size / 2 - 6;
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.drawImage(art, dx, dy, size, size);
    // The character PNGs are drawn with sleepy, half-closed eyes. Paint OPEN eyes on top so
    // the potato looks awake and alive, blinking occasionally. Positioned over the sprite's
    // baked eye slits (found by eye at roughly y=-7, x=+/-7 in this local space).
    if (!hurt) drawSpudEyes(targetCtx, character);
    if (hurt) {
      // Re-stamp the sprite as a red silhouette (using its own alpha) for the hit flash,
      // like the enemy flash — no clipping side effects on the rest of the scene.
      targetCtx.save();
      targetCtx.globalCompositeOperation = "lighter";
      targetCtx.globalAlpha = 0.5;
      targetCtx.drawImage(art, dx, dy, size, size);
      targetCtx.restore();
    }
    return;
  }

  const time = performance.now();
  const leafWiggle = Math.sin(time / 520) * 0.16;
  const blink = Math.sin(time / 1150) > 0.965;
  const armSwing = Math.sin(time / 430) * 1.2;
  const bodyGradient = targetCtx.createRadialGradient(-10, -15, 4, 1, 3, 31);
  bodyGradient.addColorStop(0, hurt ? "#ffd4ca" : "#fff0c7");
  bodyGradient.addColorStop(0.36, hurt ? "#ffb0a4" : character.body);
  bodyGradient.addColorStop(1, hurt ? "#d96364" : "#b9793c");

  targetCtx.fillStyle = "#4e3529";
  targetCtx.beginPath();
  targetCtx.ellipse(-10, 28, 10, 5, -0.2, 0, Math.PI * 2);
  targetCtx.ellipse(12, 28, 10, 5, 0.18, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = character.accent;
  targetCtx.strokeStyle = "#171d27";
  targetCtx.lineWidth = 3;
  targetCtx.beginPath();
  targetCtx.moveTo(-18, -5);
  targetCtx.quadraticCurveTo(-31, 2 + armSwing, -22, 15);
  targetCtx.quadraticCurveTo(-14, 18, -13, 8);
  targetCtx.quadraticCurveTo(-14, 0, -18, -5);
  targetCtx.moveTo(18, -4);
  targetCtx.quadraticCurveTo(31, 3 - armSwing, 22, 16);
  targetCtx.quadraticCurveTo(14, 18, 13, 8);
  targetCtx.quadraticCurveTo(14, 0, 18, -4);
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.fillStyle = bodyGradient;
  targetCtx.strokeStyle = "#171d27";
  targetCtx.lineWidth = 4;
  targetCtx.beginPath();
  targetCtx.moveTo(-5, -28);
  targetCtx.bezierCurveTo(-23, -27, -28, -10, -24, 7);
  targetCtx.bezierCurveTo(-20, 28, -5, 33, 11, 28);
  targetCtx.bezierCurveTo(28, 22, 28, 2, 22, -12);
  targetCtx.bezierCurveTo(17, -25, 6, -30, -5, -28);
  targetCtx.closePath();
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.fillStyle = "rgba(255, 247, 231, 0.28)";
  targetCtx.beginPath();
  targetCtx.ellipse(-9, -13, 8, 12, -0.55, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = "rgba(116, 73, 42, 0.22)";
  targetCtx.beginPath();
  targetCtx.ellipse(11, 10, 2.4, 1.8, -0.2, 0, Math.PI * 2);
  targetCtx.ellipse(-13, 8, 2, 1.5, 0.4, 0, Math.PI * 2);
  targetCtx.ellipse(4, 19, 2.2, 1.7, -0.3, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = character.leaf;
  targetCtx.strokeStyle = "#171d27";
  targetCtx.lineWidth = 3;
  targetCtx.beginPath();
  targetCtx.moveTo(-2, -27);
  targetCtx.bezierCurveTo(-17, -37, -28, -31, -27, -20);
  targetCtx.bezierCurveTo(-16, -18, -8, -22, -2, -27);
  targetCtx.moveTo(2, -28);
  targetCtx.bezierCurveTo(14, -41, 28, -36, 29, -24);
  targetCtx.bezierCurveTo(17, -19, 8, -22, 2, -28);
  targetCtx.moveTo(0, -30);
  targetCtx.bezierCurveTo(-5, -43, 6, -50, 15, -43);
  targetCtx.bezierCurveTo(13, -34, 7, -31, 0, -30);
  targetCtx.fill();
  targetCtx.stroke();

  targetCtx.strokeStyle = "#235a45";
  targetCtx.lineWidth = 2.5;
  targetCtx.beginPath();
  targetCtx.moveTo(0, -23);
  targetCtx.quadraticCurveTo(-3, -31, -1 + leafWiggle * 2, -39);
  targetCtx.stroke();

  targetCtx.strokeStyle = "rgba(17, 23, 34, 0.38)";
  targetCtx.lineWidth = 1.5;
  targetCtx.beginPath();
  targetCtx.moveTo(-21, -23);
  targetCtx.quadraticCurveTo(-13, -24, -4, -27);
  targetCtx.moveTo(23, -27);
  targetCtx.quadraticCurveTo(15, -25, 5, -28);
  targetCtx.moveTo(10, -41);
  targetCtx.quadraticCurveTo(7, -36, 1, -31);
  targetCtx.stroke();

  targetCtx.fillStyle = "rgba(116, 73, 42, 0.18)";
  targetCtx.beginPath();
  targetCtx.ellipse(-3, 19, 2.5, 1.6, -0.3, 0, Math.PI * 2);
  targetCtx.ellipse(7, 17, 1.8, 1.2, 0.2, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = "rgba(255, 247, 231, 0.35)";
  targetCtx.beginPath();
  targetCtx.ellipse(0, -3, 16, 11, 0.04, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.fillStyle = "#151922";
  if (blink) {
    targetCtx.strokeStyle = "#151922";
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(-10, -6);
    targetCtx.lineTo(-4, -6);
    targetCtx.moveTo(5, -6);
    targetCtx.lineTo(11, -6);
    targetCtx.stroke();
  } else {
    targetCtx.beginPath();
    targetCtx.arc(-7, -6, 3, 0, Math.PI * 2);
    targetCtx.arc(8, -6, 3, 0, Math.PI * 2);
    targetCtx.fill();
  }

  targetCtx.fillStyle = "rgba(244, 111, 111, 0.2)";
  targetCtx.beginPath();
  targetCtx.ellipse(-13, 1, 4, 3, 0, 0, Math.PI * 2);
  targetCtx.ellipse(14, 1, 4, 3, 0, 0, Math.PI * 2);
  targetCtx.fill();

  targetCtx.strokeStyle = "#151922";
  targetCtx.lineWidth = 2.5;
  targetCtx.beginPath();
  targetCtx.arc(1, 4, 8, 0.12, Math.PI - 0.12);
  targetCtx.stroke();

  targetCtx.fillStyle = "rgba(255,255,255,0.62)";
  targetCtx.beginPath();
  targetCtx.arc(-8, -7, 1.1, 0, Math.PI * 2);
  targetCtx.arc(7, -7, 1.1, 0, Math.PI * 2);
  targetCtx.fill();
}

function drawDrummerBuffLinks() {
  const time = performance.now();
  for (const drummer of state.enemies) {
    if (drummer.behavior !== "buffer") continue;
    for (const target of state.enemies) {
      if (!isDrummerBuffingEnemy(drummer, target)) continue;
      drawDrummerBuffLink(drummer, target, time);
    }
  }
}

function drawDrummerBuffLink(drummer, target, time) {
  const dx = target.x - drummer.x;
  const dy = target.y - drummer.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 1) return;

  const ux = dx / distance;
  const uy = dy / distance;
  const px = -uy;
  const py = ux;
  const startX = drummer.x + ux * drummer.radius * 0.85;
  const startY = drummer.y + uy * drummer.radius * 0.85;
  const endX = target.x - ux * target.radius * 0.65;
  const endY = target.y - uy * target.radius * 0.65;
  const pulse = 0.72 + Math.sin(time / 95 + drummer.bob + target.bob) * 0.22;
  const points = [];

  for (let i = 0; i <= 4; i += 1) {
    const t = i / 4;
    const shake = i === 0 || i === 4
      ? 0
      : Math.sin(time / 42 + i * 2.7 + drummer.x * 0.04 + target.y * 0.03) * (5 - i * 0.55);
    const kink = i % 2 === 0 ? -1 : 1;
    points.push({
      x: startX + (endX - startX) * t + px * shake * kink,
      y: startY + (endY - startY) * t + py * shake * kink
    });
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = `rgba(255, 126, 182, ${0.1 + pulse * 0.08})`;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  for (let i = 0; i < points.length - 1; i += 1) {
    const taper = 1 - i / (points.length - 1);
    ctx.strokeStyle = `rgba(255, 126, 182, ${0.3 + pulse * 0.18})`;
    ctx.lineWidth = 1.4 + taper * 4.2;
    ctx.beginPath();
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[i + 1].x, points[i + 1].y);
    ctx.stroke();
  }

  ctx.fillStyle = `rgba(255, 221, 239, ${0.3 + pulse * 0.18})`;
  ctx.beginPath();
  ctx.arc(startX, startY, 3.4 + pulse * 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEngineeringZap(zap) {
  const alpha = clamp(zap.life / zap.maxLife, 0, 1);
  const dx = zap.x2 - zap.x1;
  const dy = zap.y2 - zap.y1;
  const distance = Math.hypot(dx, dy);
  if (distance <= 1) return;

  const ux = dx / distance;
  const uy = dy / distance;
  const px = -uy;
  const py = ux;
  const time = performance.now();
  const points = [];
  const segments = 7;

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const jitter = i === 0 || i === segments
      ? 0
      : Math.sin(time / 25 + zap.seed + i * 2.4) * rand(5, 13);
    points.push({
      x: zap.x1 + dx * t + px * jitter,
      y: zap.y1 + dy * t + py * jitter
    });
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = `rgba(115, 183, 255, ${0.22 * alpha})`;
  ctx.lineWidth = zap.width * 3.2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255, 247, 231, ${0.84 * alpha})`;
  ctx.lineWidth = zap.width;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  ctx.strokeStyle = `rgba(242, 196, 95, ${0.68 * alpha})`;
  ctx.lineWidth = Math.max(1.5, zap.width * 0.45);
  ctx.beginPath();
  for (let i = 1; i < points.length - 1; i += 2) {
    const branch = i % 4 === 1 ? 1 : -1;
    ctx.moveTo(points[i].x, points[i].y);
    ctx.lineTo(points[i].x + px * branch * 15 - ux * 6, points[i].y + py * branch * 15 - uy * 6);
  }
  ctx.stroke();
  ctx.restore();
}

function drawZapAsh(ash) {
  const alpha = clamp(ash.life / ash.maxLife, 0, 1);
  ctx.save();
  ctx.translate(ash.x, ash.y);

  ctx.fillStyle = `rgba(17, 23, 34, ${0.34 * alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, 8, 28, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const ashGradient = ctx.createRadialGradient(-5, 1, 3, 0, 2, 24);
  ashGradient.addColorStop(0, `rgba(160, 172, 180, ${0.9 * alpha})`);
  ashGradient.addColorStop(0.58, `rgba(76, 82, 88, ${0.78 * alpha})`);
  ashGradient.addColorStop(1, `rgba(25, 29, 34, ${0.7 * alpha})`);
  ctx.fillStyle = ashGradient;
  ctx.beginPath();
  ctx.ellipse(0, 3, 22, 8, -0.08, 0, Math.PI * 2);
  ctx.ellipse(-8, 0, 11, 6, 0.25, 0, Math.PI * 2);
  ctx.ellipse(10, 1, 12, 6, -0.2, 0, Math.PI * 2);
  ctx.fill();

  for (const coin of ash.coins) {
    ctx.fillStyle = `rgba(242, 196, 95, ${0.84 * alpha})`;
    ctx.strokeStyle = `rgba(17, 23, 34, ${0.5 * alpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (let i = 0; i < 3; i += 1) {
    const rise = (1 - alpha) * 22 + i * 7;
    const wobble = Math.sin(performance.now() / 300 + ash.smoke + i) * 4;
    ctx.fillStyle = `rgba(210, 216, 220, ${0.16 * alpha})`;
    ctx.beginPath();
    ctx.ellipse(-8 + i * 8 + wobble, -8 - rise, 7, 12, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Warning strobe for a Darter's wind-up. Previously this keyed off the enemy's per-enemy
// random `bob` phase (Math.sin(enemy.bob * 7) > 0), which meant the flash timing was
// uncorrelated with the actual windup countdown: at a ~0.9s bob period some Darters would
// sit through their whole windup on the "off" half of the cycle and never visibly flash.
// Keying off windupTimer instead guarantees every Darter strobes during every windup, and
// speeding the pulse up as windupTimer runs out makes the warning read as more urgent right
// before the lunge fires.
function darterStrobeOn(enemy) {
  const elapsed = DARTER_WINDUP - enemy.windupTimer; // 0 at windup start, DARTER_WINDUP at end
  const urgency = clamp(elapsed / DARTER_WINDUP, 0, 1); // 0 -> 1 as the lunge approaches
  const pulseHz = 4 + urgency * 10; // starts slow, ramps up to a fast, urgent strobe
  return Math.sin(elapsed * pulseHz * Math.PI * 2) > 0;
}

function drawEnemy(enemy) {
  const art = enemyArt(enemy.name);
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const squash = 1 + Math.sin(enemy.bob) * 0.045;
  ctx.scale(1 / squash, squash);
  // Floating enemies (Orbiter) hover above a small fixed shadow that stays on the ground,
  // so the gap between body and shadow reads as height. Grounded enemies get the full shadow.
  if (enemy.behavior === "orbit" || enemy.name === "Orbiter") {
    drawShadow(0, enemy.radius * 0.9, enemy.radius * 0.72, enemy.radius * 0.24);
  } else {
    drawShadow(0, enemy.radius * 0.78, enemy.radius * 1.05, enemy.radius * 0.34);
  }

  if (enemy.behavior !== "buffer" && isEnemyDrummerBuffed(enemy)) {
    const pulse = 0.72 + Math.sin(performance.now() / 130 + enemy.bob) * 0.18;
    ctx.strokeStyle = `rgba(255, 126, 182, ${0.28 + pulse * 0.18})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * (1.18 + pulse * 0.08), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 126, 182, ${0.08 + pulse * 0.045})`;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  if (enemy.windupTimer > 0) {
    ctx.save();
    ctx.rotate(enemy.lungeAngle - Math.atan2(0, 1));
    ctx.fillStyle = `rgba(255, 209, 95, ${0.22 + Math.sin(enemy.bob * 4) * 0.08})`;
    ctx.beginPath();
    // Telegraph cone honestly represents the lunge distance (speed * chargeTimer multiplier
    // * chargeTimer duration ~= 68 * 8.45 * 0.42 =~ 241px), rather than stopping short at
    // ~92px (radius * 5.1) and understating how far the Darter will actually travel.
    // Kept semi-transparent above so it still reads as a warning, not a solid wall.
    ctx.moveTo(enemy.radius * 0.8, 0);
    ctx.lineTo(enemy.radius * 12, -enemy.radius * 0.85);
    ctx.lineTo(enemy.radius * 12, enemy.radius * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---- Body: redesigned PNG when available, otherwise the original code art ----
  if (art) {
    drawEnemyArtBody(enemy, art);
    drawEnemyStateOverlays(enemy);
    ctx.restore();
    return;
  }

  const edgeShade = shadeHexColor(enemy.color, 0.34);
  const softEdgeShade = shadeHexColor(enemy.color, 0.16);
  const enemyBody = ctx.createRadialGradient(-enemy.radius * 0.35, -enemy.radius * 0.35, enemy.radius * 0.12, 0, 0, enemy.radius * 1.15);
  enemyBody.addColorStop(0, "rgba(255, 255, 255, 0.82)");
  enemyBody.addColorStop(0.28, enemy.color);
  enemyBody.addColorStop(0.7, enemy.color);
  enemyBody.addColorStop(0.86, softEdgeShade);
  enemyBody.addColorStop(1, edgeShade);
  ctx.fillStyle = enemyBody;
  if (enemy.windupTimer > 0 && darterStrobeOn(enemy)) {
    ctx.fillStyle = "#ffd15f";
  }
  ctx.strokeStyle = "#111722";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 0, enemy.radius * 1.04, enemy.radius * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (enemy.flashTimer > 0) {
    ctx.fillStyle = `rgba(255, 247, 231, ${clamp(enemy.flashTimer / 0.09, 0, 1) * 0.72})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, enemy.radius * 1.04, enemy.radius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(17, 23, 34, 0.09)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, enemy.radius * 0.94, enemy.radius * 0.8, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(17, 23, 34, 0.12)";
  ctx.beginPath();
  ctx.ellipse(-enemy.radius * 0.72, enemy.radius * 0.18, enemy.radius * 0.17, enemy.radius * 0.11, -0.5, 0, Math.PI * 2);
  ctx.ellipse(enemy.radius * 0.68, enemy.radius * 0.26, enemy.radius * 0.2, enemy.radius * 0.1, 0.45, 0, Math.PI * 2);
  ctx.ellipse(-enemy.radius * 0.18, enemy.radius * 0.7, enemy.radius * 0.22, enemy.radius * 0.09, 0.08, 0, Math.PI * 2);
  if (enemy.radius > 18) {
    ctx.ellipse(enemy.radius * 0.22, -enemy.radius * 0.72, enemy.radius * 0.16, enemy.radius * 0.08, -0.25, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.strokeStyle = "rgba(17, 23, 34, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-enemy.radius * 0.58, enemy.radius * 0.18, enemy.radius * 0.18, -0.7, 1.45);
  ctx.arc(enemy.radius * 0.54, enemy.radius * 0.24, enemy.radius * 0.2, 1.1, 2.7);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 247, 231, 0.13)";
  ctx.beginPath();
  ctx.arc(enemy.radius * 0.12, -enemy.radius * 0.52, Math.max(2, enemy.radius * 0.08), 0, Math.PI * 2);
  ctx.arc(-enemy.radius * 0.05, enemy.radius * 0.43, Math.max(1.8, enemy.radius * 0.06), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
  ctx.beginPath();
  ctx.ellipse(-enemy.radius * 0.35, -enemy.radius * 0.34, enemy.radius * 0.26, enemy.radius * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(17, 23, 34, 0.07)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(enemy.radius * 0.14, enemy.radius * 0.08, enemy.radius * 0.58, 0.25, 1.45);
  ctx.stroke();

  ctx.fillStyle = "#151922";
  ctx.beginPath();
  ctx.arc(-enemy.radius * 0.32, -enemy.radius * 0.1, 2.8, 0, Math.PI * 2);
  ctx.arc(enemy.radius * 0.32, -enemy.radius * 0.1, 2.8, 0, Math.PI * 2);
  ctx.fill();

  if (enemy.behavior === "fireball") {
    const flicker = 0.55 + Math.sin(enemy.bob * 3.2) * 0.18;
    ctx.fillStyle = `rgba(255, 156, 91, ${0.28 + flicker * 0.18})`;
    ctx.beginPath();
    ctx.arc(enemy.radius * 0.42, -enemy.radius * 0.48, enemy.radius * 0.36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffcf6d";
    ctx.strokeStyle = "#111722";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(enemy.radius * 0.22, -enemy.radius * 0.52);
    ctx.bezierCurveTo(enemy.radius * 0.36, -enemy.radius * 1.05, enemy.radius * 0.72, -enemy.radius * 0.72, enemy.radius * 0.58, -enemy.radius * 0.36);
    ctx.bezierCurveTo(enemy.radius * 0.44, -enemy.radius * 0.18, enemy.radius * 0.22, -enemy.radius * 0.26, enemy.radius * 0.22, -enemy.radius * 0.52);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(69, 34, 25, 0.62)";
    ctx.beginPath();
    ctx.ellipse(-enemy.radius * 0.42, enemy.radius * 0.28, enemy.radius * 0.18, enemy.radius * 0.1, -0.2, 0, Math.PI * 2);
    ctx.ellipse(enemy.radius * 0.3, enemy.radius * 0.54, enemy.radius * 0.16, enemy.radius * 0.08, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.behavior === "shoot") {
    ctx.fillStyle = "#e9f7ff";
    ctx.strokeStyle = "#102033";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    roundedRectPath(ctx, enemy.radius * 0.12, -5, enemy.radius * 0.74, 10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#102033";
    ctx.beginPath();
    ctx.arc(enemy.radius * 0.62, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.behavior === "charge") {
    ctx.fillStyle = "#fff7e7";
    ctx.strokeStyle = "#151922";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-enemy.radius * 0.58, -enemy.radius * 0.5);
    ctx.lineTo(-enemy.radius * 0.18, -enemy.radius * 0.9);
    ctx.lineTo(-enemy.radius * 0.08, -enemy.radius * 0.35);
    ctx.moveTo(enemy.radius * 0.58, -enemy.radius * 0.5);
    ctx.lineTo(enemy.radius * 0.18, -enemy.radius * 0.9);
    ctx.lineTo(enemy.radius * 0.08, -enemy.radius * 0.35);
    ctx.fill();
    ctx.stroke();
  } else if (enemy.behavior === "orbit") {
    ctx.strokeStyle = "rgba(255, 247, 231, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, enemy.radius * 1.35, enemy.radius * 0.42, 0.35, 0, Math.PI * 2);
    ctx.stroke();
  } else if (enemy.behavior === "buffer") {
    ctx.strokeStyle = "rgba(255, 126, 182, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 1.65 + Math.sin(enemy.bob) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.burnTime > 0) {
    const flicker = 0.72 + Math.sin(performance.now() / 85 + enemy.bob) * 0.18;
    ctx.fillStyle = `rgba(255, 156, 91, ${0.28 * flicker})`;
    ctx.beginPath();
    ctx.arc(0, -enemy.radius * 0.12, enemy.radius * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 210, 95, ${0.38 * flicker})`;
    ctx.beginPath();
    ctx.ellipse(-enemy.radius * 0.18, -enemy.radius * 0.48, enemy.radius * 0.22, enemy.radius * 0.34, -0.35, 0, Math.PI * 2);
    ctx.ellipse(enemy.radius * 0.22, -enemy.radius * 0.32, enemy.radius * 0.18, enemy.radius * 0.28, 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  if (enemy.hp < enemy.maxHp) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(-enemy.radius, -enemy.radius - 13, enemy.radius * 2, 5);
    ctx.fillStyle = "#f2c45f";
    ctx.fillRect(-enemy.radius, -enemy.radius - 13, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 5);
  }
  ctx.restore();
}

// Draw a redesigned enemy PNG as the creature body. Kept upright (these designs are
// front-facing blobs) but flipped horizontally toward the player, with a lively
// wobble, a lunge-stretch for charging enemies, and the white hit flash.
// Per-enemy movement animation. Returns {hopY, jellyX, jellyY} in sprite-local units.
// hopY is negative = lifted off the ground. Each enemy type reads distinctly:
//   Orbiter  - floats/hovers with a slow bob, never a hard hop (shadow stays put).
//   Skitter  - crawls: no vertical hop, just a fast horizontal leg-shuffle wobble.
//   Bruiser  - heavy slow stomp: a small weighty squash on a long, low cadence.
//   Spitter  - mostly grounded idle bob; a recoil puff is layered in drawEnemy on fire.
//   others   - the classic springy jelly hop (small bouncy blobs like Nibbler/Ember).
function enemyLocomotion(enemy, time) {
  const r = enemy.radius;
  const phase = enemy.hopPhase ?? 0;
  const rate = enemy.hopRate ?? 1;
  const behavior = enemy.behavior;
  const name = enemy.name;

  // Charging enemies (Darter wind-up/lunge) own their deformation; the idle anim yields.
  const charging = enemy.windupTimer > 0 || enemy.chargeTimer > 0;
  if (charging) {
    return { hopY: 0, jellyX: 1, jellyY: 1 };
  }

  // Orbiter: hover above a fixed shadow. Gentle floaty bob, slight breathing squash,
  // NO ground contact, so it always reads as airborne.
  if (behavior === "orbit" || name === "Orbiter") {
    const floatClock = time / 1000 * 1.8 + phase;
    const hover = r * 0.28;                                  // baseline height off ground
    const bob = Math.sin(floatClock) * r * 0.12;            // slow drift up/down
    const jellyX = 1 + Math.sin(floatClock * 2) * 0.02;
    return { hopY: -(hover + bob + r * 0.12), jellyX, jellyY: 2 - jellyX };
  }

  // Skitter: crawl. Legs do the work, body stays low. A fast horizontal shimmy and a
  // tiny vertical scuttle (much smaller than a hop) sell the many-legged scramble.
  if (name === "Skitter") {
    const crawlClock = time / 1000 * 9 * rate + phase;      // fast leg cadence
    const scuttle = Math.abs(Math.sin(crawlClock)) * r * 0.06;
    const shimmy = Math.sin(crawlClock * 2) * 0.05;         // side-to-side body sway
    return { hopY: -scuttle, jellyX: 1 + shimmy, jellyY: 1 - shimmy * 0.6 };
  }

  // Bruiser (and any large 'strong' body): subtle heavy stomp. Long slow cadence, weighty
  // squash near the ground, barely leaves it — reads as mass, not bounce.
  if (name === "Bruiser" || enemy.size === "large") {
    const stompClock = time / 1000 * 2.4 * rate + phase;
    const step = Math.pow(Math.abs(Math.sin(stompClock)), 1.4);   // sharp plant, slow rise
    const grounded = 1 - step;
    return {
      hopY: -step * r * 0.16,
      jellyX: 1 + grounded * 0.1,
      jellyY: 1 - grounded * 0.1
    };
  }

  // Spitter / Ember Glob: planted with a light idle bob. When it fires, a recoil pulse
  // (enemy.fireAnim, set in combat) makes the body rear back and puff: a quick anticipatory
  // squash that springs into a forward stretch, so the shot has visible weight.
  if (behavior === "shoot" || behavior === "fireball" || name === "Spitter") {
    const idleClock = time / 1000 * 2.6 + phase;
    const bob = Math.sin(idleClock) * r * 0.05;
    let jellyX = 1 + Math.sin(idleClock * 2) * 0.03;
    let jellyY = 2 - jellyX;
    const fire = enemy.fireAnim ?? 0;
    if (fire > 0) {
      // fire counts down from ~0.32: early = wind-up squash, late = release stretch.
      const t = 1 - fire / 0.32;                 // 0 at shot, 1 at end
      const kick = Math.sin(t * Math.PI);        // rise then fall
      const windup = clamp(1 - t * 3, 0, 1);     // brief pre-spit crouch
      jellyX += kick * 0.16 - windup * 0.1;      // puff wide on release, narrow on windup
      jellyY += -kick * 0.12 + windup * 0.08;
    }
    return { hopY: bob - r * 0.02, jellyX, jellyY };
  }

  // Darter: between lunges it stays low and coiled (a tense crouch), never hopping. The
  // actual lunge stretch is layered on in drawEnemyArtBody from the charge/windup timers.
  if (behavior === "charge" || name === "Darter") {
    const coilClock = time / 1000 * 3.2 + phase;
    const twitch = Math.sin(coilClock) * 0.03;
    return { hopY: 0, jellyX: 1.04 + twitch, jellyY: 0.96 - twitch };
  }

  // Default: springy jelly hop (Nibbler, Ember Glob, and other small bouncy blobs).
  const hopClock = time / 1000 * 3.4 * rate + phase;
  const lift = Math.pow(Math.abs(Math.sin(hopClock)), 0.7);   // 0 = grounded, 1 = apex
  const grounded = 1 - lift;
  const jiggle = Math.sin(hopClock * 3.1) * 0.03 * grounded;
  return {
    hopY: -lift * r * 0.5,
    jellyX: 1 + grounded * 0.14 - lift * 0.06 + jiggle,
    jellyY: 1 - grounded * 0.14 + lift * 0.08 - jiggle
  };
}

function drawEnemyArtBody(enemy, art) {
  const cfg = enemyArtConfig(enemy.name);
  const time = performance.now();
  const size = enemy.radius * 2 * cfg.scale;
  const half = size / 2;
  const y = enemy.radius * cfg.yOffset;

  // Face the player: flip only, never rotate, so faces stay upright. Front-facing symmetric
  // sprites (the Bruiser looks straight at the camera) must NOT flip — mirroring them just
  // makes them snap sides for no visual gain and reads as "facing the wrong way".
  const facing = ENEMY_NO_FLIP.has(enemy.name)
    ? 1
    : (state.player && state.player.x < enemy.x ? -1 : 1) * enemyArtFacingSign(enemy.name);

  // Idle wobble: gentle breathing plus a slight lean, unique per enemy.
  const breathe = 1 + Math.sin(time / 300 + enemy.bob) * 0.035;
  const lean = Math.sin(time / 420 + enemy.bob * 1.4) * 0.05;

  // --- Per-enemy locomotion animation. Each enemy TYPE moves differently instead of the
  // old shared jelly-hop. anim returns the vertical offset (hopY), squash/stretch
  // (jellyX/jellyY), and a small ripple, computed from the enemy's behavior/name. The
  // resulting hopY is stashed on the enemy so the health-bar overlay can rise with it.
  const anim = enemyLocomotion(enemy, time);
  let hopY = anim.hopY;
  let jellyX = anim.jellyX;
  let jellyY = anim.jellyY;
  enemy._renderHopY = hopY;

  // Darter lunge: squash on wind-up, then stretch along the lunge. enemyLocomotion already
  // returns a neutral body while charging, so this deformation stacks cleanly on top.
  let stretchX = 1;
  let stretchY = 1;
  if (enemy.windupTimer > 0) {
    const w = clamp(enemy.windupTimer / DARTER_WINDUP, 0, 1);
    stretchX = 1 + (1 - w) * 0.18;
    stretchY = 1 - (1 - w) * 0.14;
  } else if (enemy.chargeTimer > 0) {
    stretchX = 1.16;
    stretchY = 0.88;
  }

  // Anchor squash-and-stretch to the blob's BASE so it plants on its shadow instead of
  // floating: pivot at the bottom edge, scale, then draw the sprite up from there. The
  // hop lift raises the whole pivot off the ground.
  const base = half * 0.82;   // approximate ground contact within the sprite box

  ctx.save();
  ctx.translate(0, y + hopY + base);
  ctx.rotate(lean);
  ctx.scale(facing * breathe * stretchX * jellyX, breathe * stretchY * jellyY);
  ctx.imageSmoothingEnabled = true;

  ctx.drawImage(art, -half, -half - base, size, size);

  // White hit flash: re-stamp the sprite as a silhouette using its own alpha.
  if (enemy.flashTimer > 0) {
    const strength = clamp(enemy.flashTimer / 0.09, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = strength * 0.85;
    ctx.drawImage(art, -half, -half - base, size, size);
    ctx.restore();
  }

  // Wind-up telegraph: flash the sprite gold just before a Darter lunges.
  if (enemy.windupTimer > 0 && darterStrobeOn(enemy)) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    ctx.drawImage(art, -half, -half - base, size, size);
    ctx.restore();
  }

  ctx.restore();
}

// Death pop: the sprite flattens outward and fades over a fraction of a second so
// kills land with weight instead of the enemy blinking out.
function drawEnemyDeath(corpse) {
  const p = 1 - clamp(corpse.life / corpse.maxLife, 0, 1);
  const art = enemyArt(corpse.name);
  const ease = easeOutCubic(p);
  const alpha = (1 - p) * 0.9;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(corpse.x, corpse.y + ease * corpse.radius * 0.25);
  // Splat outward: widen while flattening.
  ctx.scale(1 + ease * 0.5, Math.max(0.08, 1 - ease * 0.85));

  if (art) {
    const cfg = enemyArtConfig(corpse.name);
    const size = corpse.radius * 2 * cfg.scale;
    ctx.scale(corpse.facing, 1);
    ctx.drawImage(art, -size / 2, -size / 2 + corpse.radius * cfg.yOffset, size, size);
  } else {
    ctx.fillStyle = corpse.color;
    ctx.strokeStyle = "#111722";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, corpse.radius * 1.04, corpse.radius * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Behavior + status overlays that must stay visible regardless of which art is used.
// Cosmetic per-behavior decorations are skipped for PNG enemies (the sprite already
// conveys identity), but gameplay signals are always drawn.
function drawEnemyStateOverlays(enemy) {
  // Orbiter's PNG art already includes its orbital ring, so we don't draw one here.
  if (enemy.behavior === "buffer") {
    ctx.strokeStyle = "rgba(255, 126, 182, 0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 1.65 + Math.sin(enemy.bob) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (enemy.burnTime > 0) {
    const flicker = 0.72 + Math.sin(performance.now() / 85 + enemy.bob) * 0.18;
    ctx.fillStyle = `rgba(255, 156, 91, ${0.28 * flicker})`;
    ctx.beginPath();
    ctx.arc(0, -enemy.radius * 0.12, enemy.radius * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 210, 95, ${0.38 * flicker})`;
    ctx.beginPath();
    ctx.ellipse(-enemy.radius * 0.18, -enemy.radius * 0.48, enemy.radius * 0.22, enemy.radius * 0.34, -0.35, 0, Math.PI * 2);
    ctx.ellipse(enemy.radius * 0.22, -enemy.radius * 0.32, enemy.radius * 0.18, enemy.radius * 0.28, 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  if (enemy.hp < enemy.maxHp) {
    // Health bar rides the body's vertical lift so it stays above a hopping/floating enemy.
    const barY = -enemy.radius - 13 + (enemy._renderHopY ?? 0);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(-enemy.radius, barY, enemy.radius * 2, 5);
    ctx.fillStyle = "#f2c45f";
    ctx.fillRect(-enemy.radius, barY, enemy.radius * 2 * (enemy.hp / enemy.maxHp), 5);
  }
}

function drawCrate(crate) {
  const art = crateArt(crate.broken);
  ctx.save();
  ctx.translate(crate.x, crate.y);
  drawShadow(0, crate.radius * 0.7, crate.radius * 1.0, crate.radius * 0.32);

  // gentle idle bob + a springy pop when it first appears
  const bobY = Math.sin(crate.bob) * 1.5;
  // spawnPop counts down 0.3 -> 0; map to a springy scale that settles to 1.
  const popP = crate.spawnPop > 0 ? clamp(1 - crate.spawnPop / 0.3, 0, 1) : 1;
  const scale = crate.broken ? 1 : easeOutBack(popP);
  ctx.translate(0, bobY);

  if (art) {
    const size = crate.radius * 2.5 * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(art, -size / 2, -size / 2, size, size);
    // hit flash
    if (crate.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp(crate.flash / 0.08, 0, 1) * 0.7;
      ctx.drawImage(art, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  } else {
    // fallback: a simple wooden box if art missing
    ctx.fillStyle = crate.broken ? "#6d4a2a" : "#9a6a3a";
    ctx.strokeStyle = "#111722";
    ctx.lineWidth = 3;
    ctx.beginPath();
    roundedRectPath(ctx, -crate.radius, -crate.radius, crate.radius * 2, crate.radius * 2, 6);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// Rare 1%-drop pickup. Bobs and glows so it reads as special against the scrap coins.
function drawFortuneCookie(cookie) {
  const art = artFor("item:fortune_cookie");
  const bobY = Math.sin(cookie.bob) * 4;
  const pulse = 1 + Math.sin(cookie.bob * 1.3) * 0.06;
  ctx.save();
  ctx.translate(cookie.x, cookie.y + bobY);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 34 * pulse);
  glow.addColorStop(0, "rgba(255, 216, 115, 0.45)");
  glow.addColorStop(1, "rgba(255, 216, 115, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  if (art) {
    const size = 40 * pulse;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(art, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#ffd873";
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCrateDrop(drop) {
  if (!drop.ready) return;                 // hidden until the broken crate fades
  ctx.save();
  ctx.translate(drop.x, drop.y + Math.sin(drop.bob) * 2.5);
  drawShadow(0, drop.radius * 0.7, drop.radius * 0.8, drop.radius * 0.28);

  // soft glow so the reward reads as pickup-able
  const pulse = 0.55 + Math.sin(performance.now() / 220 + drop.bob) * 0.2;
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, drop.radius * 1.9);
  glow.addColorStop(0, `rgba(255, 214, 120, ${0.35 * pulse})`);
  glow.addColorStop(1, "rgba(255, 214, 120, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, drop.radius * 1.9, 0, Math.PI * 2);
  ctx.fill();

  // the actual reward: draw its item art if available, else a small crate-loot puck
  const art = itemArt(drop.item);
  if (art) {
    const size = drop.radius * 2.4;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(art, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = "#ffd15f";
    ctx.strokeStyle = "#111722";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, drop.radius * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawTree(tree) {
  ctx.save();
  ctx.translate(tree.x, tree.y);
  const sway = Math.sin(performance.now() / 520 + tree.bob) * 0.045;
  ctx.rotate(sway);
  drawShadow(0, 20, 24, 8);

  // Berry bush PNG when it has loaded; the code-drawn tree below is the fallback so the
  // arena still populates if the art is missing.
  const bushArt = artFor("env:bush");
  if (bushArt) {
    const size = 86;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bushArt, -size / 2, -size / 2 - 6, size, size);
    if (tree.hp < tree.maxHp) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(-24, -46, 48, 5);
      ctx.fillStyle = "#f2c45f";
      ctx.fillRect(-24, -46, 48 * (tree.hp / tree.maxHp), 5);
    }
    ctx.restore();
    return;
  }

  const trunkGradient = ctx.createLinearGradient(-8, 0, 8, 30);
  trunkGradient.addColorStop(0, "#b97843");
  trunkGradient.addColorStop(1, "#6d432d");
  ctx.fillStyle = trunkGradient;
  ctx.strokeStyle = "#111722";
  ctx.lineWidth = 3;
  ctx.beginPath();
  roundedRectPath(ctx, -8, 0, 16, 30, 5);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(17, 23, 34, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3, 4);
  ctx.quadraticCurveTo(-8, 12, -2, 20);
  ctx.moveTo(5, 6);
  ctx.quadraticCurveTo(10, 14, 3, 25);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 224, 150, 0.22)";
  ctx.beginPath();
  ctx.ellipse(-4, 5, 3, 9, -0.2, 0, Math.PI * 2);
  ctx.fill();

  const crown = ctx.createRadialGradient(-8, -15, 6, 0, -2, 38);
  crown.addColorStop(0, "#a3ef79");
  crown.addColorStop(0.45, "#62c56d");
  crown.addColorStop(1, "#2f7f55");
  ctx.fillStyle = crown;
  ctx.strokeStyle = "#111722";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-11, -7, 18, 0, Math.PI * 2);
  ctx.arc(8, -12, 20, 0, Math.PI * 2);
  ctx.arc(17, 4, 17, 0, Math.PI * 2);
  ctx.arc(-1, 7, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.beginPath();
  ctx.ellipse(-14, -15, 9, 5, -0.45, 0, Math.PI * 2);
  ctx.ellipse(6, -22, 8, 5, 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(15, 74, 52, 0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-22, -3);
  ctx.quadraticCurveTo(-12, -8, -3, -3);
  ctx.moveTo(5, -18);
  ctx.quadraticCurveTo(12, -10, 21, -9);
  ctx.moveTo(-8, 10);
  ctx.quadraticCurveTo(1, 3, 15, 7);
  ctx.stroke();

  ctx.fillStyle = "#f2c45f";
  ctx.strokeStyle = "#111722";
  ctx.lineWidth = 1.5;
  for (const fruit of [[-18, 1], [15, -8], [5, 8]]) {
    ctx.beginPath();
    ctx.arc(fruit[0], fruit[1], 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(fruit[0] - 1, fruit[1] - 1, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2c45f";
  }

  if (tree.hp < tree.maxHp) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(-24, -36, 48, 5);
    ctx.fillStyle = "#f2c45f";
    ctx.fillRect(-24, -36, 48 * (tree.hp / tree.maxHp), 5);
  }
  ctx.restore();
}

function drawBulb(bulb) {
  ctx.save();
  ctx.translate(bulb.x, bulb.y);
  const time = performance.now();
  const glow = 0.16 + Math.sin(time / 210 + bulb.bob) * 0.045;
  const bob = Math.sin(time / 330 + bulb.bob) * 2;
  const sway = Math.sin(time / 520 + bulb.bob) * 0.075;
  drawShadow(0, 15, 17, 6);
  ctx.translate(0, bob);
  ctx.rotate(sway);

  // Health apple PNG when loaded, else fall through to the original code-drawn bulb.
  const appleArt = artFor("env:apple");
  if (appleArt) {
    const size = 40;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(appleArt, -size / 2, -size / 2 - 4, size, size);
    ctx.restore();
    return;
  }

  ctx.fillStyle = `rgba(255, 120, 140, ${glow})`;
  ctx.beginPath();
  ctx.arc(0, -9, 25, 0, Math.PI * 2);
  ctx.fill();

  const fruitGradient = ctx.createRadialGradient(-7, -18, 4, 1, -9, 20);
  fruitGradient.addColorStop(0, "#ffe6a8");
  fruitGradient.addColorStop(0.22, "#ff8d6c");
  fruitGradient.addColorStop(0.68, "#e94d63");
  fruitGradient.addColorStop(1, "#a83350");
  ctx.fillStyle = fruitGradient;
  ctx.strokeStyle = "#111722";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.bezierCurveTo(13, -31, 24, -20, 21, -4);
  ctx.bezierCurveTo(19, 13, 8, 22, 0, 18);
  ctx.bezierCurveTo(-8, 22, -20, 13, -22, -4);
  ctx.bezierCurveTo(-24, -20, -13, -31, 0, -28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(111, 25, 46, 0.32)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.bezierCurveTo(5, -15, 5, 3, 0, 15);
  ctx.moveTo(-10, -22);
  ctx.bezierCurveTo(-6, -12, -5, 1, -2, 13);
  ctx.moveTo(10, -22);
  ctx.bezierCurveTo(6, -12, 5, 1, 2, 13);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 247, 231, 0.62)";
  ctx.beginPath();
  ctx.ellipse(-7, -19, 5, 8, -0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#5b3a22";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -27);
  ctx.bezierCurveTo(2, -35, 7, -38, 12, -40);
  ctx.stroke();

  const leafGradient = ctx.createLinearGradient(1, -39, 20, -28);
  leafGradient.addColorStop(0, "#c5f37a");
  leafGradient.addColorStop(1, "#3da864");
  ctx.fillStyle = leafGradient;
  ctx.strokeStyle = "#111722";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(8, -38);
  ctx.bezierCurveTo(20, -42, 28, -35, 26, -25);
  ctx.bezierCurveTo(16, -24, 9, -29, 8, -38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(22, 86, 50, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(11, -36);
  ctx.quadraticCurveTo(17, -33, 24, -27);
  ctx.stroke();

  ctx.fillStyle = "#fff7e7";
  ctx.beginPath();
  roundedRectPath(ctx, -3, -13, 6, 15, 2);
  roundedRectPath(ctx, -9, -8, 18, 6, 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 247, 231, 0.68)";
  for (const sparkle of [[-19, -25, 3], [20, -18, 2], [16, 4, 2]]) {
    const flicker = 0.6 + Math.sin(time / 260 + sparkle[0]) * 0.25;
    ctx.globalAlpha = flicker;
    ctx.fillRect(sparkle[0], sparkle[1], sparkle[2], sparkle[2]);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawCoin(coin) {
  ctx.save();
  const time = performance.now();
  const bob = Math.sin(time / 190 + coin.x * 0.04) * 2;
  ctx.translate(coin.x, coin.y + bob);
  drawShadow(0, 7, 9, 4);
  const coinGradient = ctx.createRadialGradient(-3, -4, 2, 0, 0, coin.radius + 3);
  coinGradient.addColorStop(0, "#fff0a6");
  coinGradient.addColorStop(0.45, "#f2c45f");
  coinGradient.addColorStop(1, "#b87620");
  ctx.fillStyle = coinGradient;
  ctx.strokeStyle = "#8d5d18";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(141, 93, 24, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, coin.radius * 0.55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.arc(-3, -3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBagCoin(coin) {
  ctx.save();
  ctx.translate(coin.x, coin.y);
  const spin = Math.sin(coin.t * 18) * 0.22;
  ctx.rotate(spin);
  const scale = 0.92 + Math.sin(coin.t * 15) * 0.05;
  ctx.scale(scale, scale);
  const coinGradient = ctx.createRadialGradient(-3, -4, 2, 0, 0, coin.radius + 3);
  coinGradient.addColorStop(0, "#fff0a6");
  coinGradient.addColorStop(0.45, "#f2c45f");
  coinGradient.addColorStop(1, "#b87620");
  ctx.fillStyle = coinGradient;
  ctx.strokeStyle = "#8d5d18";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.arc(-3, -3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function bagTarget() {
  return { x: W - 82, y: H - 72 };
}

function drawUnusedBag() {
  const target = bagTarget();
  const open = state.mode === "bagging" || state.pendingBagScrap > 0;
  const pulse = state.bagPulse > 0 ? 1 + state.bagPulse * 0.55 : 1;
  const wobble = open ? Math.sin(performance.now() / 120) * 0.035 : 0;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.rotate(wobble);
  ctx.scale(pulse, pulse);
  drawShadow(0, 24, 31, 8);

  ctx.fillStyle = "#111722";
  ctx.beginPath();
  roundedRectPath(ctx, -24, -28, 48, 58, 10);
  ctx.fill();

  const bagGradient = ctx.createLinearGradient(-20, -25, 22, 26);
  bagGradient.addColorStop(0, "#c89155");
  bagGradient.addColorStop(0.5, "#9f6840");
  bagGradient.addColorStop(1, "#67422d");
  ctx.fillStyle = bagGradient;
  ctx.strokeStyle = "#111722";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-17, -14);
  ctx.quadraticCurveTo(-24, 2, -20, 24);
  ctx.quadraticCurveTo(0, 34, 22, 24);
  ctx.quadraticCurveTo(26, 2, 17, -14);
  ctx.quadraticCurveTo(8, -20, -17, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f0c176";
  ctx.strokeStyle = "#111722";
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundedRectPath(ctx, -20, open ? -30 : -24, 40, open ? 18 : 14, 6);
  ctx.fill();
  ctx.stroke();

  if (open) {
    ctx.fillStyle = "#2d1f1a";
    ctx.strokeStyle = "#111722";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -14, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(242, 196, 95, 0.35)";
    ctx.beginPath();
    ctx.ellipse(0, -14, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#4c2d23";
  ctx.lineWidth = 2;
  for (let x = -13; x <= 13; x += 13) {
    ctx.beginPath();
    ctx.moveTo(x, open ? -29 : -24);
    ctx.lineTo(x + 5, -11);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255, 247, 231, 0.16)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.quadraticCurveTo(-6, 3, -14, 10);
  ctx.moveTo(15, 0);
  ctx.quadraticCurveTo(7, 7, 16, 14);
  ctx.stroke();

  ctx.fillStyle = "#f2c45f";
  ctx.strokeStyle = "#111722";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 3, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#111722";
  ctx.font = "1000 12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${state.unusedScrap + state.pendingBagScrap}`, 0, 3);
  ctx.restore();
}

function drawBullet(bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
  const speed = Math.hypot(bullet.vx, bullet.vy);
  const scale = bullet.scale ?? 1;
  ctx.scale(scale, scale);
  if (bullet.weaponName === "Twig Wand") {
    drawTwigProjectile(bullet, speed);
  } else if (bullet.weaponName === "Stub Club") {
    drawStubProjectile(bullet, speed);
  } else if (bullet.weaponName === "Rusty Pistol") {
    drawPistolProjectile(bullet, speed);
  } else if (bullet.weaponName === "Slingshot") {
    drawSlingshotProjectile(bullet, speed);
  } else if (bullet.weaponName === "Scrap Revolver") {
    drawRevolverProjectile(bullet, speed);
  } else if (bullet.weaponName === "Tin Dragon Flamethrower") {
    drawFlamePuffProjectile(bullet, speed);
  } else if (bullet.weaponName === "Grenade Launcher") {
    drawGrenadeProjectile(bullet, speed);
  } else {
    drawSparkProjectile(bullet, speed);
  }
  ctx.restore();
}

function drawSparkProjectile(bullet, speed) {
  ctx.fillStyle = "rgba(115, 183, 255, 0.24)";
  ctx.beginPath();
  ctx.ellipse(-Math.min(24, speed * 0.03), 0, bullet.radius * 2.7, bullet.radius * 0.68, 0, 0, Math.PI * 2);
  ctx.fill();

  const shell = ctx.createRadialGradient(-3, -3, 2, 0, 0, 10);
  shell.addColorStop(0, "#dff6ff");
  shell.addColorStop(0.55, bullet.color ?? "#73b7ff");
  shell.addColorStop(1, "#315f95");
  ctx.fillStyle = shell;
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(16, 32, 51, 0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-5, -1);
  ctx.quadraticCurveTo(-1, 3, 5, 2);
  ctx.stroke();

  ctx.fillStyle = "#9ddc75";
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(-8, -1, 3.6, 1.8, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.ellipse(-3, -2, 3, 1.8, -0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawTwigProjectile(bullet, speed) {
  const flicker = 0.75 + Math.sin(performance.now() / 70 + bullet.x * 0.03) * 0.16;
  ctx.fillStyle = `rgba(255, 156, 91, ${0.3 * flicker})`;
  ctx.beginPath();
  ctx.ellipse(-Math.min(28, speed * 0.034), 0, bullet.radius * 3.4, bullet.radius * 1.15, 0, 0, Math.PI * 2);
  ctx.fill();

  const flame = ctx.createRadialGradient(-2, -2, 2, 0, 0, 13);
  flame.addColorStop(0, "#fff0a6");
  flame.addColorStop(0.42, bullet.color ?? "#ff9c5b");
  flame.addColorStop(1, "#ad3f32");
  ctx.fillStyle = flame;
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.bezierCurveTo(4, -11, -7, -8, -15, -2);
  ctx.bezierCurveTo(-10, 1, -10, 7, -3, 8);
  ctx.bezierCurveTo(2, 6, 7, 5, 11, 0);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffe38f";
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.bezierCurveTo(0, -4, -6, -3, -9, 0);
  ctx.bezierCurveTo(-5, 4, 1, 4, 5, 0);
  ctx.fill();

  ctx.strokeStyle = "rgba(88, 45, 28, 0.7)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-13, 3);
  ctx.lineTo(-19, 6);
  ctx.moveTo(-12, -3);
  ctx.lineTo(-18, -6);
  ctx.stroke();
}

function drawStubProjectile(bullet, speed) {
  ctx.fillStyle = "rgba(246, 210, 143, 0.28)";
  ctx.beginPath();
  ctx.ellipse(-Math.min(18, speed * 0.026), 0, 17, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#c08b56";
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.bezierCurveTo(5, -12, -10, -12, -18, -5);
  ctx.quadraticCurveTo(-22, 0, -18, 6);
  ctx.bezierCurveTo(-8, 13, 5, 10, 12, 0);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#8a5a37";
  ctx.beginPath();
  ctx.ellipse(-5, 4, 5, 2.3, -0.2, 0, Math.PI * 2);
  ctx.ellipse(2, -4, 4, 2, 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(61, 37, 24, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-12, -2);
  ctx.quadraticCurveTo(-4, 1, 6, -1);
  ctx.moveTo(-8, 6);
  ctx.quadraticCurveTo(0, 8, 7, 3);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 247, 231, 0.55)";
  ctx.beginPath();
  ctx.ellipse(-4, -5, 5, 2.4, -0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawPistolProjectile(bullet, speed) {
  ctx.fillStyle = "rgba(255, 209, 95, 0.22)";
  ctx.beginPath();
  ctx.ellipse(-Math.min(30, speed * 0.035), 0, 22, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  const shell = ctx.createLinearGradient(-8, -3, 10, 3);
  shell.addColorStop(0, "#7f8896");
  shell.addColorStop(0.48, "#f2c45f");
  shell.addColorStop(1, "#fff0a6");
  ctx.fillStyle = shell;
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.quadraticCurveTo(3, -5, -9, -3);
  ctx.quadraticCurveTo(-12, 0, -9, 3);
  ctx.quadraticCurveTo(3, 5, 11, 0);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.beginPath();
  ctx.ellipse(-1, -2, 5, 1.4, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSlingshotProjectile(bullet, speed) {
  ctx.fillStyle = "rgba(140, 106, 74, 0.22)";
  ctx.beginPath();
  ctx.ellipse(-Math.min(18, speed * 0.025), 0, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const stone = ctx.createRadialGradient(-4, -4, 2, 0, 0, 10);
  stone.addColorStop(0, "#d6c0a5");
  stone.addColorStop(0.55, "#8c6a4a");
  stone.addColorStop(1, "#4c3527");
  ctx.fillStyle = stone;
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(9, -2);
  ctx.bezierCurveTo(7, -9, -7, -9, -10, -1);
  ctx.bezierCurveTo(-9, 7, 5, 9, 10, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,247,231,0.46)";
  ctx.beginPath();
  ctx.ellipse(-4, -4, 4, 2, -0.45, 0, Math.PI * 2);
  ctx.fill();
}

function drawRevolverProjectile(bullet, speed) {
  ctx.fillStyle = "rgba(255, 240, 166, 0.28)";
  ctx.beginPath();
  ctx.ellipse(-Math.min(42, speed * 0.045), 0, 34, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(242, 196, 95, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-23, 0);
  ctx.lineTo(2, 0);
  ctx.stroke();

  const slug = ctx.createLinearGradient(-7, -4, 13, 4);
  slug.addColorStop(0, "#ad7b32");
  slug.addColorStop(0.5, "#fff0a6");
  slug.addColorStop(1, "#f2c45f");
  ctx.fillStyle = slug;
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.quadraticCurveTo(5, -6, -9, -4);
  ctx.quadraticCurveTo(-13, 0, -9, 4);
  ctx.quadraticCurveTo(5, 6, 13, 0);
  ctx.fill();
  ctx.stroke();
}

function drawFlamePuffProjectile(bullet, speed) {
  const flicker = 0.78 + Math.sin(performance.now() / 48 + bullet.x * 0.05) * 0.18;
  ctx.fillStyle = `rgba(255, 111, 69, ${0.24 * flicker})`;
  ctx.beginPath();
  ctx.ellipse(-Math.min(24, speed * 0.04), 0, 28, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  const flame = ctx.createRadialGradient(-5, -4, 2, 2, 0, 17);
  flame.addColorStop(0, "#fff0a6");
  flame.addColorStop(0.35, "#ffcf5d");
  flame.addColorStop(0.72, "#ff7d3d");
  flame.addColorStop(1, "#9d352d");
  ctx.fillStyle = flame;
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.bezierCurveTo(4, -16, -13, -10, -19, -1);
  ctx.bezierCurveTo(-12, 8, 2, 12, 15, 0);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(45, 34, 31, 0.24)";
  ctx.beginPath();
  ctx.ellipse(-22, 2, 6, 4, 0.1, 0, Math.PI * 2);
  ctx.ellipse(-30, -2, 4, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff0a6";
  ctx.beginPath();
  ctx.ellipse(2, -2, 5, 3, -0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrenadeProjectile(bullet, speed) {
  const spin = performance.now() / 90 + bullet.x * 0.025;
  ctx.rotate(Math.sin(spin) * 0.55);

  ctx.fillStyle = "rgba(255, 156, 61, 0.18)";
  ctx.beginPath();
  ctx.ellipse(-Math.min(18, speed * 0.026), 0, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(-4, -5, 2, 0, 0, 12);
  body.addColorStop(0, "#9aa77a");
  body.addColorStop(0.52, "#5f6f43");
  body.addColorStop(1, "#293324");
  ctx.fillStyle = body;
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(10, -2);
  ctx.bezierCurveTo(7, -12, -8, -12, -12, -2);
  ctx.bezierCurveTo(-12, 9, 6, 12, 12, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#d8dde8";
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundedRectPath(ctx, -5, -14, 10, 5, 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(16, 32, 51, 0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-9, -3);
  ctx.quadraticCurveTo(-1, 1, 8, -1);
  ctx.moveTo(-8, 4);
  ctx.quadraticCurveTo(0, 7, 8, 4);
  ctx.stroke();

  ctx.fillStyle = "#ffcf5d";
  ctx.beginPath();
  ctx.arc(8, -9, 2.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemyBullet(bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);
  ctx.rotate(Math.atan2(bullet.vy, bullet.vx));

  if (bullet.kind === "fireball") {
    const spin = bullet.spin ?? 0;
    const flicker = Math.sin(spin * 7.3) * 0.05 + Math.sin(spin * 3.1 + 1.4) * 0.03;
    const pulse = 1 + Math.sin(spin * 2) * 0.08 + flicker;
    ctx.scale(pulse, 1 / pulse);

    // Outer pulsing glow — makes the projectile read as hot/dangerous from a distance.
    const glowPulse = 1 + Math.sin(spin * 3) * 0.18;
    const glow = ctx.createRadialGradient(-6, 0, 2, -6, 0, 30 * glowPulse);
    glow.addColorStop(0, "rgba(255, 210, 130, 0.32)");
    glow.addColorStop(0.55, "rgba(255, 111, 69, 0.22)");
    glow.addColorStop(1, "rgba(255, 111, 69, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(-6, 0, 30 * glowPulse, 15 * glowPulse, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 111, 69, 0.32)";
    ctx.beginPath();
    ctx.ellipse(-22, 0, 26, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trailing ember flecks along -x, in addition to the particle trail spawned elsewhere.
    ctx.fillStyle = "rgba(255, 224, 150, 0.85)";
    for (let i = 0; i < 2; i += 1) {
      const t = (i + 1) * 9 + Math.sin(spin * 6 + i) * 2;
      const off = Math.sin(spin * 9 + i * 2.1) * 3;
      ctx.beginPath();
      ctx.arc(-16 - t, off, 1.6 - i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    const flame = ctx.createRadialGradient(-4, -3, 1, 0, 0, 18);
    flame.addColorStop(0, "#ffffff");
    flame.addColorStop(0.32, "#fff3a6");
    flame.addColorStop(0.6, "#ff9c5b");
    flame.addColorStop(1, "#b94834");
    ctx.fillStyle = flame;
    ctx.strokeStyle = "#111722";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.bezierCurveTo(1, -17, -18, -14, -22, 0);
    ctx.bezierCurveTo(-10, 12, 5, 15, 13, 0);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fffbe0";
    ctx.beginPath();
    ctx.ellipse(-2, -2, 6.5, 4, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.fillStyle = "rgba(102, 199, 216, 0.24)";
  ctx.beginPath();
  ctx.ellipse(-18, 0, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#66c7d8";
  ctx.strokeStyle = "#102033";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.arc(-3, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticle(particle) {
  ctx.save();
  if (particle.type === "ring") {
    const progress = 1 - clamp(particle.life / (particle.maxLife ?? 0.3), 0, 1);
    const radius = particle.radius + (particle.maxRadius - particle.radius) * easeOutCubic(progress);
    ctx.globalAlpha = (1 - progress) * 0.75;
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = 3 * (1 - progress) + 1;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (particle.type === "muzzle") {
    // Oriented flash: a bright four-point star + glow cone at the barrel, fading fast.
    const t = clamp(particle.life / (particle.maxLife ?? 0.09), 0, 1);   // 1 -> 0
    const s = (particle.size ?? 1) * (0.7 + t * 0.5);
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.angle ?? 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = t;
    // soft glow
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 22 * s);
    glow.addColorStop(0, particle.color);
    glow.addColorStop(0.4, "rgba(255,190,90,0.5)");
    glow.addColorStop(1, "rgba(255,150,60,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 22 * s, 0, Math.PI * 2);
    ctx.fill();
    // forward star flare
    ctx.fillStyle = "#fff7e0";
    ctx.beginPath();
    const long = 26 * s, shortR = 6 * s;
    ctx.moveTo(long, 0);
    ctx.lineTo(shortR * 0.6, shortR);
    ctx.lineTo(-shortR, 0);
    ctx.lineTo(shortR * 0.6, -shortR);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }
  if (particle.type === "spark") {
    const t = clamp(particle.life / (particle.maxLife ?? 0.14), 0, 1);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = t;
    ctx.strokeStyle = particle.color;
    ctx.lineWidth = (particle.radius ?? 2) * t;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y);
    ctx.lineTo(particle.x - particle.vx * 0.02, particle.y - particle.vy * 0.02);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.globalAlpha = clamp(particle.life / 0.45, 0, 1);
  ctx.fillStyle = particle.color;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFloater(floater) {
  ctx.save();
  const alpha = clamp(floater.life / (floater.maxLife ?? 0.42), 0, 1);
  const progress = 1 - alpha;
  ctx.globalAlpha = Math.pow(alpha, floater.fadePower ?? 1);
  ctx.font = `900 ${floater.size ?? 15}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.translate(floater.x, floater.y);
  const scale = 1 + progress * (floater.scaleOut ?? 0);
  ctx.scale(scale, scale);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(17, 23, 34, 0.72)";
  ctx.strokeText(floater.text, 0, 0);
  ctx.fillStyle = floater.color ?? "#fff7e7";
  ctx.fillText(floater.text, 0, 0);
  ctx.restore();
}

function roundedRectPath(targetCtx, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  targetCtx.moveTo(x + r, y);
  targetCtx.lineTo(x + width - r, y);
  targetCtx.quadraticCurveTo(x + width, y, x + width, y + r);
  targetCtx.lineTo(x + width, y + height - r);
  targetCtx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  targetCtx.lineTo(x + r, y + height);
  targetCtx.quadraticCurveTo(x, y + height, x, y + height - r);
  targetCtx.lineTo(x, y + r);
  targetCtx.quadraticCurveTo(x, y, x + r, y);
}

function drawShadow(x, y, rx, ry) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
