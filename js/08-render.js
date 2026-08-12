"use strict";

// render.js - canvas drawing: arena, entities, projectiles

// Cached CanvasPattern for the tiled arena floor. Built once on the first frame after the
// ground PNG finishes loading (see drawArena) -- rebuilding it every frame would throw away
// the tiling work the browser does internally.
let groundPattern = null;

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
  for (const pool of state.poisonPools ?? []) drawPoisonPool(pool);
  for (const bulb of state.bulbs) drawBulb(bulb);
  for (const coin of state.coins) drawCoin(coin);
  for (const coin of state.bagAnimations) drawBagCoin(coin);
  for (const bullet of state.bullets) drawBullet(bullet);
  for (const bullet of state.enemyBullets) drawEnemyBullet(bullet);
  drawDrummerBuffLinks();
  for (const corpse of state.enemyDeaths ?? []) drawEnemyDeath(corpse);
  // BOSS SYSTEM: telegraphs/ground effects drawn UNDER the boss sprite (ground circles, the
  // charge path, the slam shockwave ring) so the boss body and its state overlays (drawn by
  // drawEnemy below) stay on top and readable.
  if (state.bossFight) {
    for (const enemy of state.enemies) {
      if (enemy.behavior === "boss") drawNibblerKingTelegraphs(enemy);
    }
  }
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
  // Tiled ground PNG when it's loaded, falling back to the original gradient otherwise so
  // the arena is never blank. The gradient is drawn underneath either way: the tile is
  // opaque, but this keeps the arena coloured during the frames before the art arrives.
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, "#47626a");
  gradient.addColorStop(0.48, "#334f48");
  gradient.addColorStop(1, "#263b42");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  const ground = artFor("env:ground");
  if (ground) {
    // createPattern repeats the tile across the whole arena in one fill, so this costs a
    // single draw call regardless of how many times it repeats.
    groundPattern = groundPattern ?? ctx.createPattern(ground, "repeat");
    if (groundPattern) {
      ctx.fillStyle = groundPattern;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // NOTE: the arena used to draw its whole ground texture procedurally on top of the fill --
  // diagonal grid lines, 22 colour patches, 42 moss blobs, 190 pixel specks, 18 ground
  // details, 34 stamped pixel sprites, 46 swaying grass blades and 12 twinkles, EVERY frame.
  // That was ~1,340 canvas calls per frame before a single enemy was drawn. All of it is
  // now baked into arena_ground.png, so redrawing it would be invisible (the tile is opaque)
  // as well as expensive. Only the vignette survives, because it frames the screen rather
  // than the ground and can't be part of a repeating tile.
  ctx.save();
  const vignette = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.62);
  vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
  vignette.addColorStop(1, "rgba(6, 10, 16, 0.18)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
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
    // A thrown weapon is literally not in your hand while it's in the air -- the star you
    // can see flying IS this weapon, so drawing it orbiting the player too would show the
    // same object twice. The slot stays empty until it's caught (see updateReturningBullet).
    if (weapon.airborne) {
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

    // Per-weapon fire animation, layered on top of the shared recoil. `fire` runs 0 -> 1
    // across the shot (0 at the instant of firing), so each weapon can shape its own motion
    // curve rather than every gun sharing one generic kick.
    const anim = weaponFireAnimation(weapon, time, index);

    ctx.save();
    ctx.globalAlpha = overlapEnemy ? 0.54 : 0.94;
    ctx.translate(slot.x, slot.y);
    ctx.rotate(angle + anim.rotate);
    // Recoil kick: shove the weapon back along its aim (local -x) right after firing.
    if (weapon.recoil > 0) ctx.translate(-weapon.recoil, 0);
    if (anim.pushX || anim.pushY) ctx.translate(anim.pushX, anim.pushY);
    ctx.scale(scale * breathe * anim.scaleX, scale * breathe * anim.scaleY);
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

// Per-weapon fire animation. Returns a transform layered on top of the shared recoil kick
// in drawArenaWeapon: a rotation, a local push (x = along the aim, y = perpendicular), and
// a squash/stretch. `t` runs 0 -> 1 over the weapon's fireAnim window (0 = just fired).
//
// The point is that each weapon should read as its own physical object. A slingshot's band
// snaps forward; a crossbow dips to re-cock; a shotgun lurches. Weapons with no entry fall
// through to a small shared settle, plus a permanent idle drift so nothing is ever static.
function weaponFireAnimation(weapon, time, index) {
  const none = { rotate: 0, pushX: 0, pushY: 0, scaleX: 1, scaleY: 1 };
  const name = weapon.name;
  const max = weapon.fireAnimMax ?? 0;
  const remaining = weapon.fireAnim ?? 0;

  // Idle life: a slow drift so an unfired weapon still breathes. Deliberately tiny -- it
  // should be felt, not noticed, and must not fight the aim direction.
  const idleSway = Math.sin(time / 620 + index * 2.1) * 0.035;

  if (max <= 0 || remaining <= 0) {
    return { ...none, rotate: idleSway };
  }

  const t = clamp(1 - remaining / max, 0, 1);   // 0 at the shot, 1 when the animation ends
  const settle = Math.sin(t * Math.PI);          // rises then falls: a single pulse
  const snap = Math.pow(1 - t, 2.2);             // sharp at the shot, decays fast

  // Slingshot: the band is drawn back, then snaps forward. Stretch along the aim on
  // release and rock the fork back, so the elastic release is legible.
  if (name === "Slingshot") {
    return {
      rotate: idleSway - snap * 0.5,
      pushX: -snap * 5 + settle * 2,
      pushY: 0,
      scaleX: 1 + snap * 0.24,                   // stretches along the shot
      scaleY: 1 - snap * 0.14
    };
  }

  // Frost Bow: a crossbow re-cocking. Dips the nose down and pulls back while it reloads,
  // then levels off -- the slowest, most mechanical animation in the set.
  if (name === "Frost Bow") {
    const reload = Math.sin(clamp(t * 1.25, 0, 1) * Math.PI);
    return {
      rotate: idleSway + reload * 0.34,          // nose dips as it re-cocks
      pushX: -reload * 4.5,
      pushY: reload * 2.2,
      scaleX: 1 - reload * 0.1,
      scaleY: 1 + reload * 0.07
    };
  }

  // Seed Shotgun: a heavy double-barrel lurch -- big kick up and back, slow settle.
  if (name === "Seed Shotgun") {
    return {
      rotate: idleSway - snap * 0.42,
      pushX: -snap * 8,
      pushY: -snap * 2.5,
      scaleX: 1 + snap * 0.1,
      scaleY: 1 + snap * 0.16                    // barrels flare
    };
  }

  // Shuriken: spun and flicked away. A fast full-ish spin sells it as thrown, not fired.
  if (name === "Shuriken") {
    return {
      rotate: idleSway + (1 - t) * Math.PI * 1.5,
      pushX: -snap * 3,
      pushY: 0,
      scaleX: 1 - snap * 0.12,
      scaleY: 1 - snap * 0.12
    };
  }

  // Twig Wand: a magical flourish rather than a recoil -- it swirls and pulses.
  if (name === "Twig Wand") {
    return {
      rotate: idleSway + Math.sin(t * Math.PI * 2) * 0.3,
      pushX: settle * 2.5,
      pushY: Math.sin(t * Math.PI * 2) * 2,
      scaleX: 1 + settle * 0.12,
      scaleY: 1 + settle * 0.12
    };
  }

  // Grenade Launcher / Scrap Revolver: heavy weapons buck upward hard.
  if (name === "Grenade Launcher" || name === "Scrap Revolver") {
    return {
      rotate: idleSway - snap * 0.46,
      pushX: -snap * 6,
      pushY: -snap * 3,
      scaleX: 1 + snap * 0.08,
      scaleY: 1 + snap * 0.1
    };
  }

  // Flamethrower: no discrete shot to animate, so it just shudders continuously.
  if (name === "Tin Dragon Flamethrower") {
    const shudder = Math.sin(time / 45) * 0.03;
    return { rotate: idleSway + shudder, pushX: -snap * 2, pushY: 0, scaleX: 1, scaleY: 1 + shudder };
  }

  // Default (pistols, peashooter, anything new): a small snappy kick so every weapon has
  // at least some life without needing its own entry here.
  return {
    rotate: idleSway - snap * 0.26,
    pushX: -snap * 3.5,
    pushY: -snap * 1,
    scaleX: 1 + snap * 0.06,
    scaleY: 1 - snap * 0.04
  };
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
  const tierColor = weapon.unique ? "#f2c45f" : rarities[Math.min(MAX_WEAPON_RANK, weapon.tier)]?.color ?? "#dce4ed";
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

// Each link is a 4-segment squiggle costing ~28 canvas calls, and every enemy inside a
// Drummer's aura gets one. In a late-wave crowd that ran away completely: at the 480-enemy
// cap it was 4,701 links = ~131k canvas calls = 15ms/frame, i.e. the whole frame budget for
// one decorative effect, and 13x the cost of drawing every enemy sprite. It also stopped
// communicating anything -- thousands of overlapping squiggles read as noise, not "these
// are buffed".
//
// So it is capped. The nearest links to each Drummer are kept (those are the ones the eye
// actually follows) and the rest are dropped; the pink buff aura on each enemy already
// carries the "I am buffed" information on its own.
const MAX_DRUMMER_LINKS_PER_DRUMMER = 6;
// A per-drummer cap alone does NOT bound the total: late waves put ~60 Drummers on screen,
// so 60 x 6 links x ~28 canvas calls was still 10,080 calls -- 43% of the entire frame, more
// than every enemy sprite combined. This is the hard ceiling for the whole screen. Past a
// handful of drummers the links are unreadable spaghetti anyway, and each enemy already
// carries its own pink buff aura, so nothing is actually lost by stopping here.
const MAX_DRUMMER_LINKS_TOTAL = 18;

function drawDrummerBuffLinks() {
  const time = performance.now();
  const enemies = state.enemies;
  let drawn = 0;
  for (let d = 0; d < enemies.length; d += 1) {
    const drummer = enemies[d];
    if (drummer.behavior !== "buffer") continue;
    if (drawn >= MAX_DRUMMER_LINKS_TOTAL) break;

    // Keep a small "closest N" list by insertion rather than collecting every enemy in the
    // aura and sorting: in a dense crowd that array was thousands of entries per Drummer,
    // and all but a handful were thrown away immediately.
    const best = [];
    for (let t = 0; t < enemies.length; t += 1) {
      const target = enemies[t];
      if (target === drummer) continue;
      // The aura test below is the authoritative check for THIS drummer, so the cached flag
      // is only a cheap early-out. It must not be read directly: draw() runs while paused
      // even though update() (which refreshes the flag) does not, so a freshly spawned enemy
      // can have no flag yet -- isEnemyDrummerBuffed falls back to a live scan in that case.
      if (target._drummerBuffed === false) continue;
      const dx = target.x - drummer.x;
      const dy = target.y - drummer.y;
      const distSq = dx * dx + dy * dy;
      if (distSq >= DRUMMER_BUFF_RADIUS * DRUMMER_BUFF_RADIUS) continue;
      if (best.length === MAX_DRUMMER_LINKS_PER_DRUMMER && distSq >= best[best.length - 1].distSq) {
        continue;
      }
      let slot = best.length;
      while (slot > 0 && best[slot - 1].distSq > distSq) slot -= 1;
      best.splice(slot, 0, { target, distSq });
      if (best.length > MAX_DRUMMER_LINKS_PER_DRUMMER) best.length = MAX_DRUMMER_LINKS_PER_DRUMMER;
    }
    for (let i = 0; i < best.length && drawn < MAX_DRUMMER_LINKS_TOTAL; i += 1) {
      drawDrummerBuffLink(drummer, best[i].target, time);
      drawn += 1;
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
  // Off-screen cull. Enemies spawn outside the arena edges and walk in, so at the late-wave
  // cap a real fraction of the array is never visible -- drawing them meant a full save/
  // transform/shadow/art/health-bar pass per enemy for nothing. The margin is generous
  // enough to cover the largest sprite's scaled overhang so nothing can pop in at the edge.
  const cullMargin = enemy.radius * 3 + 40;
  if (
    enemy.x < -cullMargin || enemy.x > W + cullMargin ||
    enemy.y < -cullMargin || enemy.y > H + cullMargin
  ) {
    return;
  }

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

  // Buff aura: ONE stroked ring, not a ring plus a filled disc. In a late wave almost every
  // enemy on screen is buffed, so this runs hundreds of times a frame -- halving its work
  // (and dropping the per-enemy template-string alpha) is worth more than the faint inner
  // glow, which was barely visible under the sprite anyway.
  if (enemy.behavior !== "buffer" && isEnemyDrummerBuffed(enemy)) {
    const pulse = 0.72 + Math.sin(performance.now() / 130 + enemy.bob) * 0.18;
    ctx.strokeStyle = pulse > 0.8 ? "rgba(255, 126, 182, 0.44)" : "rgba(255, 126, 182, 0.32)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 1.2, 0, Math.PI * 2);
    ctx.stroke();
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

  // Thistle arming: a red ring/pulse warning during its 5s TURRET_ARM_TIME so the player
  // sees it appear and has time to react before it can shoot.
  if (enemy.behavior === "turret" && enemy.armTimer > 0) {
    const armProgress = 1 - clamp(enemy.armTimer / TURRET_ARM_TIME, 0, 1);
    const strobeHz = 2 + armProgress * 6;                     // strobes faster as arming finishes
    const strobe = 0.35 + Math.max(0, Math.sin(performance.now() / 1000 * strobeHz * Math.PI * 2)) * 0.4;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 70, 70, ${strobe})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * (1.3 + armProgress * 0.25), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 70, 70, ${strobe * 0.18})`;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * (1.3 + armProgress * 0.25), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Gravebloom summon cast: a growing purple charge ring so the interrupt window (see
  // checkGravebloomInterrupt) is obviously readable, not a hidden timer.
  if (enemy.behavior === "summoner" && enemy.castTimer > 0) {
    const castProgress = 1 - clamp(enemy.castTimer / GRAVEBLOOM_CAST_TIME, 0, 1);
    const pulse = 0.5 + Math.sin(performance.now() / 110) * 0.22;
    ctx.save();
    ctx.strokeStyle = `rgba(169, 143, 214, ${0.35 + pulse * 0.35})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * (1.15 + castProgress * 0.9), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(169, 143, 214, ${0.1 + castProgress * 0.14})`;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * (1.15 + castProgress * 0.9), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // BOSS SYSTEM: regal aura ring (drawn UNDER the body, like the Drummer buff ring above) plus
  // a soft radial glow. Drawn here, still inside the enemy's squash transform, so it breathes
  // with the body the same subtle way the Drummer buff ring does.
  if (enemy.behavior === "boss") {
    drawNibblerKingAura(enemy);
  }

  // ---- Body: redesigned PNG when available, otherwise the original code art ----
  if (art) {
    drawEnemyArtBody(enemy, art);
    drawEnemyStateOverlays(enemy);
    // BOSS SYSTEM: crown (ART HOOK below) and the phase-2 red pulse overlay draw ABOVE the
    // body/health-bar, and UNDO the enemy's squash/stretch scale first so the crown stays
    // upright instead of being warped by the body's idle jelly wobble. The red attack
    // TELEGRAPH itself is drawn separately, in world/ground space, by drawNibblerKingTelegraphs
    // (called once per boss from the top-level draw() loop, BEFORE any enemy is drawn) -- a
    // ground-anchored warning circle or a charge path has to stay fixed in the arena, not
    // ride along with the boss's own local transform the way a crown does.
    if (enemy.behavior === "boss") {
      ctx.save();
      ctx.scale(squash, 1 / squash);
      drawNibblerKingCrown(enemy);
      drawNibblerKingClub(enemy);
      drawNibblerKingPhaseOverlay(enemy);
      ctx.restore();
    }
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

  // Husk: stiff, brittle, dry. Reads as rigid rather than jelly — minimal squash, and a
  // sharp little jitter/rattle in place of a soft bounce.
  if (name === "Husk") {
    const rattleClock = time / 1000 * 11 * rate + phase;
    const rattle = Math.sin(rattleClock) * r * 0.025 + Math.sin(rattleClock * 2.7) * r * 0.012;
    const creak = Math.sin(rattleClock * 0.9) * 0.015;
    return { hopY: rattle, jellyX: 1 + creak, jellyY: 1 - creak };
  }

  // Thistle: rooted turret. NO hop, ever — it's planted in the ground. A slow breathing
  // sway/bristle normally; a visible tension pulse while arming; the fireAnim recoil
  // pattern (same one Spitter uses) on each shot once armed.
  if (name === "Thistle") {
    const swayClock = time / 1000 * 1.1 + phase;
    let jellyX = 1 + Math.sin(swayClock) * 0.025;
    let jellyY = 2 - jellyX;
    if ((enemy.armTimer ?? 0) > 0) {
      // Tension builds as arming nears completion (fast small pulse), telegraphing "about
      // to wake up" separately from the red warning overlay drawn in drawEnemy.
      const armProgress = 1 - clamp(enemy.armTimer / TURRET_ARM_TIME, 0, 1);
      const tensionClock = time / 1000 * (3 + armProgress * 9) + phase;
      const tension = Math.sin(tensionClock) * 0.03 * (0.3 + armProgress * 0.7);
      jellyX += tension;
      jellyY -= tension;
    }
    const fire = enemy.fireAnim ?? 0;
    if (fire > 0) {
      const t = 1 - fire / 0.32;
      const kick = Math.sin(t * Math.PI);
      const windup = clamp(1 - t * 3, 0, 1);
      jellyX += kick * 0.14 - windup * 0.09;
      jellyY += -kick * 0.1 + windup * 0.07;
    }
    return { hopY: 0, jellyX, jellyY };
  }

  // Blight Sac: heavy fluid wobble — a slow, over-damped, sloshing jiggle with noticeably
  // more squash than other enemies, like an unstable water balloon about to burst.
  if (name === "Blight Sac") {
    const sloshClock = time / 1000 * 1.6 * rate + phase;
    const slosh = Math.sin(sloshClock);
    const slosh2 = Math.sin(sloshClock * 1.7 + 1.1) * 0.5;
    const wobble = (slosh + slosh2) * 0.22;               // big amplitude, over-damped
    const bob = Math.abs(Math.sin(sloshClock * 0.5)) * r * 0.06;
    return { hopY: -bob, jellyX: 1 + wobble, jellyY: 1 - wobble * 0.85 };
  }

  // Gravebloom: tall, slow drooping sway from the flower head, almost no vertical hop.
  // During the summon cast it visibly rears up / pulses so the telegraph reads clearly.
  if (name === "Gravebloom") {
    const droopClock = time / 1000 * 0.8 + phase;
    let jellyX = 1 + Math.sin(droopClock) * 0.03;
    let jellyY = 2 - jellyX;
    let hopY = Math.sin(droopClock * 0.5) * r * 0.03;
    if ((enemy.castTimer ?? 0) > 0) {
      const castProgress = 1 - clamp(enemy.castTimer / GRAVEBLOOM_CAST_TIME, 0, 1);
      const rearClock = time / 1000 * 5 + phase;
      const rear = Math.sin(rearClock) * 0.06 * (0.4 + castProgress * 0.6);
      hopY -= r * 0.14 * castProgress;                     // rears up as the cast nears completion
      jellyX -= rear;
      jellyY += rear;
    }
    return { hopY, jellyX, jellyY };
  }

  // Clown family: bouncy and manic — the smaller the clown, the faster and springier the
  // bounce, so the trio reads as increasingly over-energetic vs. everything else on screen.
  if (name === "Clown" || name === "Clown Mid" || name === "Clown Small") {
    const sizeRate = name === "Clown" ? 1 : name === "Clown Mid" ? 1.5 : 2.2;
    const bounceClock = time / 1000 * 4.6 * sizeRate * rate + phase;
    const lift = Math.pow(Math.abs(Math.sin(bounceClock)), 0.55);
    const grounded = 1 - lift;
    const wobble = Math.sin(bounceClock * 2.3) * 0.05 * sizeRate * 0.6;
    return {
      hopY: -lift * r * 0.6 * (0.7 + sizeRate * 0.2),
      jellyX: 1 + grounded * 0.18 - lift * 0.08 + wobble,
      jellyY: 1 - grounded * 0.18 + lift * 0.1 - wobble
    };
  }

  // BOSS SYSTEM: Nibbler King -- a heavier, slower, more deliberate stomp than the Bruiser's,
  // reflecting a much bigger body. Bigger squash on the plant (this is the whole screen's boss,
  // it should feel like it has real weight) and a slight forward lean while moving so it reads
  // as advancing with intent rather than just bobbing in place. Checked BEFORE the Bruiser/
  // "large" fallback below (the King is also size:"large") so it doesn't fall through to the
  // generic stomp -- see FIX 4 in the original brief ("no bespoke locomotion... falls through
  // to the generic large/Bruiser stomp").
  if (name === "Nibbler King" || behavior === "boss") {
    const phase2 = (enemy.bossPhase ?? 1) >= 2;
    // Phase 2: faster, more agitated cadence -- the King is hurt and angrier.
    const stompRate = (phase2 ? 1.55 : 1.0) * rate;
    const stompClock = time / 1000 * 1.7 * stompRate + phase;
    const step = Math.pow(Math.abs(Math.sin(stompClock)), 1.6);  // sharp plant, slow heavy rise
    const grounded = 1 - step;
    const squashAmount = (phase2 ? 0.2 : 0.16);
    // Forward lean while walking under its own steering (bossState "idle"/"arriving") -- a
    // small persistent tilt in the direction of travel, on top of the stomp squash, so
    // advancing reads as purposeful rather than just standing and bobbing. Suppressed during
    // telegraph/strike/recover, where the attack-reaction lean in drawEnemyArtBody takes over
    // so the two lean sources never fight each other.
    // Lean only while the King is actually free to move under its own steering ("idle" is the
    // between-attacks state where it walks toward the player, "arriving" is its entrance walk-
    // in) -- not mid-telegraph/strike/recover, where the attack-reaction lean below takes over.
    let lean = 0;
    if (enemy.bossState === "idle" || enemy.bossState === "arriving" || !enemy.bossState) {
      lean = clamp((enemy.vx ?? 0) * 0.012, -0.06, 0.06);
    }
    return {
      hopY: -step * r * 0.22,
      jellyX: 1 + grounded * squashAmount,
      jellyY: 1 - grounded * squashAmount,
      lean
    };
  }

  // Bruiser (and any other large 'strong' body not already handled above by name): subtle
  // heavy stomp. Long slow cadence, weighty squash near the ground, barely leaves it — reads
  // as mass, not bounce. Kept AFTER the name-specific branches above (Husk/Thistle/Blight
  // Sac/Gravebloom/Clown family) so this generic size check never swallows Gravebloom or
  // Clown — both are size:"large" but need their own distinct locomotion.
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
  let lean = Math.sin(time / 420 + enemy.bob * 1.4) * 0.05;

  // --- Per-enemy locomotion animation. Each enemy TYPE moves differently instead of the
  // old shared jelly-hop. anim returns the vertical offset (hopY), squash/stretch
  // (jellyX/jellyY), and a small ripple, computed from the enemy's behavior/name. The
  // resulting hopY is stashed on the enemy so the health-bar overlay can rise with it.
  const anim = enemyLocomotion(enemy, time);
  let hopY = anim.hopY;
  let jellyX = anim.jellyX;
  let jellyY = anim.jellyY;
  enemy._renderHopY = hopY;
  // Nibbler King locomotion (see enemyLocomotion) adds its own forward-lean-while-moving on top
  // of the idle sway, instead of replacing it, so the boss still breathes while walking.
  if (anim.lean) lean += anim.lean;

  // BOSS SYSTEM: body reaction to its own melee attacks -- wind-up lean-back during
  // "telegraph", forward lunge+squash on "strike", settle back during "recover". Derives a
  // 0..1 progress within the current bossState the SAME way drawNibblerKingClub computes
  // stateP (bossTimer counts down from the state's full duration, from bossAttackTiming), so
  // the body's reaction always stays in lockstep with the club's swing and the telegraph
  // warning, rather than using separately-tuned timing that can drift out of sync.
  let bossLean = 0;
  let bossLunge = 0;   // forward translate along the attack angle, in local (pre-scale) px
  let bossSquashKick = 0; // extra squash/stretch on top of the locomotion squash
  if (enemy.behavior === "boss" && enemy.bossState && enemy.bossAttack) {
    const meleeAttack = enemy.bossAttack === "weaponSwing" || enemy.bossAttack === "slamCombo" ||
      enemy.bossAttack === "spinSweep" || enemy.bossAttack === "overheadSmash" ||
      enemy.bossAttack === "groundSlam" || enemy.bossAttack === "stompQuake" ||
      enemy.bossAttack === "charge" || enemy.bossAttack === "groundPoundShockwave";
    if (meleeAttack && (enemy.bossState === "telegraph" || enemy.bossState === "strike" || enemy.bossState === "recover")) {
      const timing = bossAttackTiming(enemy.bossAttack, enemy.bossPhase ?? 1);
      let stateP = 0;
      if (enemy.bossState === "telegraph") {
        stateP = timing.telegraph > 0 ? clamp(1 - enemy.bossTimer / timing.telegraph, 0, 1) : 1;
      } else if (enemy.bossState === "strike") {
        stateP = timing.strike > 0 ? clamp(1 - enemy.bossTimer / timing.strike, 0, 1) : 1;
      } else {
        stateP = timing.recover > 0 ? clamp(1 - enemy.bossTimer / timing.recover, 0, 1) : 1;
      }
      const swingAngle = enemy.bossTelegraph?.angle ?? 0;
      const towardX = Math.cos(swingAngle);
      if (enemy.bossState === "telegraph") {
        // Wind up: lean back away from the swing direction, slight stretch, building over the
        // telegraph so the attack is honestly readable before it lands.
        const eased = easeOutCubic(stateP);
        bossLean = -towardX * 0.12 * eased;
        bossLunge = -towardX * enemy.radius * 0.06 * eased;
        bossSquashKick = -0.05 * eased; // slight stretch (negative squash) while winding up
      } else if (enemy.bossState === "strike") {
        // Lunge forward into the swing direction, squashing hardest right at impact (early in
        // the strike window) then relaxing slightly as the strike plays out.
        const eased = easeOutCubic(Math.min(stateP * 1.6, 1));
        const impact = 1 - Math.abs(stateP - 0.18) / 0.5; // peaks near the start of the strike
        const impactKick = clamp(impact, 0, 1);
        bossLean = towardX * 0.16 * eased;
        bossLunge = towardX * enemy.radius * 0.1 * eased;
        bossSquashKick = 0.14 * impactKick;
      } else {
        // Recover: ease back from the strike's lunge/squash to neutral.
        const eased = 1 - easeOutCubic(stateP);
        bossLean = towardX * 0.16 * eased * 0.4;
        bossLunge = towardX * enemy.radius * 0.1 * eased * 0.4;
        bossSquashKick = 0;
      }
    }
  }
  lean += bossLean;
  jellyX += bossSquashKick;
  jellyY -= bossSquashKick;

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
  ctx.translate(bossLunge, y + hopY + base);
  ctx.rotate(lean);
  ctx.scale(facing * breathe * stretchX * jellyX, breathe * stretchY * jellyY);
  ctx.imageSmoothingEnabled = true;

  // Aspect-correct draw. Historically this was drawImage(art, -half, -half - base, size, size),
  // i.e. the art forced into a SQUARE. Every original enemy PNG is square (512x512), so that was
  // invisible -- but the Nibbler King's art is 1485x1024 (1.45:1), and a square draw squashed it
  // ~31% horizontally, turning a wide blob into a tall narrow one. Fit the art inside the same
  // `size` box instead, preserving its own ratio: the wider dimension takes the full box and the
  // other scales down. For square source art drawW/drawH both collapse back to `size`, so this
  // is a no-op for every pre-existing enemy sprite and only changes non-square art.
  const artRatio = art.naturalWidth && art.naturalHeight ? art.naturalWidth / art.naturalHeight : 1;
  const drawW = artRatio >= 1 ? size : size * artRatio;
  const drawH = artRatio >= 1 ? size / artRatio : size;
  // Bottom-anchored at exactly where the square draw put the sprite's base (-half - base + size)
  // so ground contact does not shift for any existing enemy.
  const drawX = -drawW / 2;
  const drawY = -half - base + size - drawH;

  ctx.drawImage(art, drawX, drawY, drawW, drawH);

  // White hit flash: re-stamp the sprite as a silhouette using its own alpha. MUST use the same
  // drawX/drawY/drawW/drawH as the body above, or the flash silhouette drifts out of register.
  if (enemy.flashTimer > 0) {
    const strength = clamp(enemy.flashTimer / 0.09, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = strength * 0.85;
    ctx.drawImage(art, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  // Wind-up telegraph: flash the sprite gold just before a Darter lunges.
  if (enemy.windupTimer > 0 && darterStrobeOn(enemy)) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5;
    ctx.drawImage(art, drawX, drawY, drawW, drawH);
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

// =====================================================================================
// BOSS SYSTEM -- Nibbler King rendering. Everything below is called from drawEnemy() (the
// crown/aura/phase overlay, drawn in the boss's own local space) or from the top-level
// draw() loop (the ground telegraphs, drawn in world space before any enemy is drawn -- see
// the "BOSS SYSTEM" block near the top of draw()). Kept together here, after the generic
// drawEnemyStateOverlays, so the whole boss visual layer lives in one place.
// =====================================================================================

// Regal aura: a pulsing purple-gold ring plus a soft radial glow, drawn UNDER the body
// (called from drawEnemy before drawEnemyArtBody). Copies the Drummer buff-ring pattern
// (one stroked ring, cheap to draw) but adds the soft glow underneath since there is only
// ever one boss on screen at a time, unlike the Drummer aura which can appear dozens of
// times in a crowded late wave.
function drawNibblerKingAura(enemy) {
  const pulse = 0.65 + Math.sin(performance.now() / 260 + enemy.bob) * 0.28;
  const auraRadius = enemy.radius * (1.55 + pulse * 0.12);
  const glow = ctx.createRadialGradient(0, 0, enemy.radius * 0.6, 0, 0, auraRadius * 1.5);
  glow.addColorStop(0, "rgba(242, 196, 95, 0.22)");
  glow.addColorStop(1, "rgba(242, 196, 95, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, auraRadius * 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(242, 196, 95, ${0.5 + pulse * 0.3})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
  ctx.stroke();
}

// ART HOOK: was the entire procedural crown placeholder; now draws the real crown art
// (assets/enemies/nibbler-king-crown.png, registered as "boss:nibblerKingCrown" in
// js/00-assets.js). Nothing else in the boss render pipeline needs to change, since every
// caller only ever invokes drawNibblerKingCrown(enemy) and never draws a crown any other
// way. Falls back to drawing nothing (not the old procedural shape) if the art has not
// finished loading yet, matching how every other PNG-art draw call in this file is guarded
// (see drawEnemyArtBody/drawCrate/drawFortuneCookie: `if (art) { ctx.drawImage(...) }`,
// where `art` comes from a `.ready`-gated lookup — see artFor() in js/00-assets.js).
function drawNibblerKingCrown(enemy) {
  // Crown toss: while the crown is in flight (bossAttack === "crownToss" && bossState ===
  // "strike"), it must not ALSO still be sitting on the King's head -- draw nothing here so
  // there is never a frame with two crowns (this one + the in-flight one drawn from
  // drawNibblerKingTelegraphs) or, if this condition and the in-flight condition ever drift
  // apart, a frame with zero crowns. This MUST stay textually identical to the guard on the
  // in-flight draw below (search "CROWN TOSS in-flight").
  if (enemy.bossAttack === "crownToss" && enemy.bossState === "strike") return;

  const art = artFor("boss:nibblerKingCrown");
  if (!art) return;

  const r = enemy.radius;
  // Match drawEnemyArtBody's own geometry (js/08-render.js) so the crown sits just above the
  // ACTUAL drawn sprite's top, not an arbitrary radius multiple -- the King's art is scaled
  // way up (ENEMY_ART_CONFIG "Nibbler King", see js/00-assets.js), so a naive -r*1.02 offset
  // would land the crown around the sprite's belly instead of its head.
  const cfg = enemyArtConfig(enemy.name);
  const size = r * 2 * cfg.scale;          // drawEnemyArtBody's own `size`
  const half = size / 2;                   // half of drawEnemyArtBody's `size`
  const base = half * 0.82;                // same ground-contact anchor drawEnemyArtBody uses
  // drawEnemyArtBody aspect-fits the BODY art into the `size` box rather than stretching it to
  // fill a square, so the real rendered top of the body sprite (drawY) sits lower than a naive
  // "top of the square box" assumption whenever the art isn't square (the King's body art is
  // 1269x1004, ratio ~1.264). Recompute that same aspect-fit math here using the body art's own
  // ratio so the crown anchors to where the head ACTUALLY is instead of floating above it.
  const bodyArt = enemyArt(enemy.name);
  const artRatio = (bodyArt && bodyArt.naturalWidth && bodyArt.naturalHeight)
    ? bodyArt.naturalWidth / bodyArt.naturalHeight
    : 1;
  const bodyDrawH = artRatio >= 1 ? size / artRatio : size;
  // NOTE ON `base` (do not reintroduce a lone `- base` here -- this has regressed 3 times):
  // drawEnemyArtBody translates the whole body draw by (y + hopY + base) -- i.e. `base` shifts
  // the ORIGIN down by the ground-contact anchor -- and THEN draws at local drawY =
  // (-half - base + size - drawH) -- i.e. `base` shifts the SPRITE back up by the same amount
  // within that shifted origin. The two `base` terms are algebraically opposite and CANCEL:
  // translate(+base) followed by drawY(-base) nets to zero `base` contribution in absolute
  // (world/parent) space. Any reimplementation of that positioning (like this crown anchor,
  // which computes the body's absolute top edge directly instead of via a translate+drawY pair)
  // must therefore include BOTH `base` terms or NEITHER -- never just one. The previous two
  // "fixes" here kept only the `- base` term (from the local drawY half) while dropping the
  // offsetting `+ base` (from the translate), which is exactly what pushed the crown 83.7px too
  // high above the head. The correct absolute top edge, with both terms removed (net zero), is:
  const bodyTopY = r * cfg.yOffset - half + size - bodyDrawH; // == real absolute top edge of the body sprite
  const spriteTopY = bodyTopY;
  const headY = spriteTopY + r * 0.10;     // small deliberate nudge DOWN onto the head so the
                                            // crown sits ON it rather than floating exactly at
                                            // the sprite's bounding-box top edge.
  // Ride the body's hop offset exactly like the health bar does (drawEnemyStateOverlays),
  // so the crown stays welded to the head instead of detaching while the boss bobs. This
  // outer draw call is OUTSIDE drawEnemyArtBody's own save/restore (see drawEnemy), so it
  // does not automatically inherit the body's internal hopY translate -- it must reapply it.
  const hopY = enemy._renderHopY ?? 0;

  const crownWidth = r * 1.15;
  const crownHeight = r * 0.62;
  // Fit the crown art (aspect-correct) into a box sized off the same crownWidth/crownHeight
  // the old procedural silhouette used, so the swap lands at the same on-screen scale.
  const aspect = art.width / art.height;
  let drawW = crownWidth;
  let drawH = drawW / aspect;
  if (drawH > crownHeight) {
    drawH = crownHeight;
    drawW = drawH * aspect;
  }

  ctx.save();
  ctx.translate(0, headY + hopY);
  ctx.imageSmoothingEnabled = true;
  // Anchor at the bottom-centre of the crown box (its band), matching the old silhouette's
  // pivot at y=0 with spikes rising into negative Y.
  ctx.drawImage(art, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
}

// CLUB: drawn only during the 4 melee attacks (weaponSwing, slamCombo, spinSweep,
// overheadSmash), through their "telegraph" and "strike" bossStates, plus roughly the first
// 35% of "recover" (see the early return below) so the swing eases back to rest instead of
// popping out of existence mid-arc the instant the attack ends. Reads the SAME angle data the
// telegraph and executeBossStrike use (boss.bossTelegraph.angle / .angles[.hit]) so the drawn
// club always points exactly where the hit is honestly telegraphed/landing, never a
// re-derived or approximate angle. Drawn in the boss's local space (translated to
// enemy.x/y, un-squashed), like the crown, so it rides the body's position but stays
// upright/undistorted by the idle jelly wobble.
//
// Progress within the current bossState: boss.bossTimer counts DOWN from the state's full
// duration (set in updateNibblerKingBehavior in js/07-combat.js, e.g.
// `boss.bossTimer = timing.telegraph` on entering "telegraph"), so `1 - bossTimer/duration`
// is elapsed 0..1 through that state -- the same convention already used by
// runSlamComboTick/runGroundPoundTick/etc via `timing.strike - boss.bossTimer`.
// easeOutCubic (the only easing helper defined in the codebase -- js/07-combat.js:1587, a
// shared global like every other helper in these plain scripts, already used elsewhere in this
// file e.g. drawNibblerKingTelegraphs) is reused for every tween below instead of new easing
// math; there is no easeInCubic/easeInOutCubic anywhere in the codebase to call instead.
// SHARED CLUB GEOMETRY -- the single source of truth for where the club actually is, in WORLD
// space, for a given swing angle. Both this renderer (drawNibblerKingClub, converting these
// world coordinates back to the boss's local space since it draws inside a translate/rotate)
// AND the combat code (js/07-combat.js, testing the boss's melee damage against the club's
// actual swept segment) call this SAME function, so the visual club and the damage-dealing club
// can never disagree about length or pivot. Defined at module level as a plain global function
// (these are plain scripts sharing global scope, not ES modules -- same convention as
// bossAttackTiming/easeOutCubic/etc), so js/07-combat.js can call it directly.
//
// PIVOT CHOICE: the grip sits at r*0.6 from the boss's centre (previously r*0.75/0.85/0.5
// depending on attack, floating detached in mid-air per the user's report -- "the club should
// rotate with the end still connected to the king"). The body's rendered half-width is
// bodyDrawW/2 = ~158px and half-height ~125px at the reference r=132/scale=1.2 numbers from the
// crown fix above, so r*0.6 (~79px) lands the grip well inside the visible silhouette -- read as
// held at the body -- rather than at the collision-radius edge or beyond it. spinSweep uses a
// slightly longer reach (r*0.7, arms extended for the whirl) and overheadSmash a slightly
// shorter one (r*0.55, raised in close overhead) but both stay within the "attached" r*0.55-0.7
// band the fix calls for, instead of the old 0.75-0.85 range that floated past the body edge.
function nibblerKingClubGeometry(enemy, angle) {
  const r = enemy.radius;

  let pivotReach = r * 0.6;
  if (enemy.bossAttack === "spinSweep") pivotReach = r * 0.7;
  else if (enemy.bossAttack === "overheadSmash") pivotReach = r * 0.55;

  // Club length off the body's ACTUAL rendered half-width (aspect-fit, not the raw radius), the
  // same aspect-fit math drawEnemyArtBody/drawNibblerKingCrown use, so it stays proportioned if
  // the art changes. This is the SAME clubLength used for both the drawn sprite length and the
  // damage-check reach, so they cannot drift apart the way the old renderedHalfWidth*1.9 (301px
  // visual vs a separate ~264px damage range) did.
  const cfg = enemyArtConfig(enemy.name);
  const bodySize = r * 2 * cfg.scale;
  const bodyArt = enemyArt(enemy.name);
  const bodyArtRatio = (bodyArt && bodyArt.naturalWidth && bodyArt.naturalHeight)
    ? bodyArt.naturalWidth / bodyArt.naturalHeight
    : 1;
  const bodyDrawW = bodyArtRatio >= 1 ? bodySize : bodySize * bodyArtRatio;
  const renderedHalfWidth = bodyDrawW / 2;
  const clubLength = renderedHalfWidth * 1.9;

  const art = artFor("boss:nibblerKingClub");
  const aspect = art ? art.width / art.height : 3;
  const thickness = clubLength / aspect;

  // World-space pivot: boss centre + pivotReach along the swing angle (plus the body's current
  // hop lift, so the damage segment rides the same vertical bob the sprite does).
  const hopY = enemy._renderHopY ?? 0;
  const pivotX = enemy.x + Math.cos(angle) * pivotReach;
  const pivotY = enemy.y + Math.sin(angle) * pivotReach + hopY;
  // World-space tip: pivot + the full club length further along the same angle (the club is
  // drawn/anchored at its handle/left edge and extends outward along `angle`).
  const tipX = pivotX + Math.cos(angle) * clubLength;
  const tipY = pivotY + Math.sin(angle) * clubLength;

  return { pivotX, pivotY, tipX, tipY, thickness, pivotReach, clubLength };
}

function drawNibblerKingClub(enemy) {
  const art = artFor("boss:nibblerKingClub");
  if (!art) return;

  const melee = enemy.bossAttack === "weaponSwing" || enemy.bossAttack === "slamCombo" ||
    enemy.bossAttack === "spinSweep" || enemy.bossAttack === "overheadSmash";
  if (!melee) return;

  const RECOVER_TAIL = 0.35; // fraction of "recover" the club still draws through, easing to rest
  if (enemy.bossState !== "telegraph" && enemy.bossState !== "strike" && enemy.bossState !== "recover") return;

  const r = enemy.radius;
  const telegraph = enemy.bossTelegraph;
  const time = performance.now();
  const timing = bossAttackTiming(enemy.bossAttack, enemy.bossPhase ?? 1);

  // Progress (0..1) through the CURRENT bossState, derived from bossTimer counting down from
  // the state's full duration.
  let stateP = 0;
  if (enemy.bossState === "telegraph") {
    stateP = timing.telegraph > 0 ? clamp(1 - enemy.bossTimer / timing.telegraph, 0, 1) : 1;
  } else if (enemy.bossState === "strike") {
    stateP = timing.strike > 0 ? clamp(1 - enemy.bossTimer / timing.strike, 0, 1) : 1;
  } else if (enemy.bossState === "recover") {
    const recoverP = timing.recover > 0 ? clamp(1 - enemy.bossTimer / timing.recover, 0, 1) : 1;
    if (recoverP > RECOVER_TAIL) return; // past the tail window -- fully at rest, stop drawing
    stateP = recoverP / RECOVER_TAIL; // 0..1 across just the tail window
  }

  // Resolve the swing angle per attack kind. weaponSwing/slamCombo have an honest fixed
  // target angle from the telegraph payload but now WIND UP/interpolate/follow-through around
  // it instead of snapping; spinSweep has no single angle (it hits everywhere at once) so the
  // club spins continuously to sell the whirl (unchanged, already smooth); overheadSmash tweens
  // the 180 degrees across the strike instead of snapping in one frame.
  let angle;
  if (enemy.bossAttack === "weaponSwing") {
    const target = telegraph?.angle ?? 0;
    const windBack = target - 0.9; // wound back opposite the swing direction during telegraph
    const followThrough = target + 0.5; // past the impact angle, sold as follow-through
    if (enemy.bossState === "telegraph") {
      // Wind the club back over the course of the telegraph, arriving at windBack by the end.
      angle = target + (windBack - target) * easeOutCubic(stateP);
    } else if (enemy.bossState === "strike") {
      // Fast sweep from windBack, through the impact angle, out to followThrough.
      angle = windBack + (followThrough - windBack) * easeOutCubic(stateP);
    } else {
      // Recover tail: ease from followThrough back toward resting at the boss's front (target).
      angle = followThrough + (target - followThrough) * easeOutCubic(stateP);
    }
  } else if (enemy.bossAttack === "slamCombo") {
    const hit = telegraph?.hit ?? 0;
    const angles = telegraph?.angles ?? [0, 0, 0];
    const current = angles[hit] ?? 0;
    if (enemy.bossState === "telegraph") {
      // Before the first hit there is no "previous" swing to interpolate from -- just wind back
      // from the current target the same way weaponSwing does.
      const windBack = current - 0.9;
      angle = current + (windBack - current) * easeOutCubic(stateP);
    } else if (enemy.bossState === "strike") {
      // Interpolate from the PREVIOUS hit's angle (or the pre-swing wind-back, for hit 0) to
      // the current hit's angle, instead of teleporting between the 3 fixed telegraph angles.
      const prev = hit > 0 ? (angles[hit - 1] ?? current) : current - 0.9;
      angle = prev + (current - prev) * easeOutCubic(stateP);
    } else {
      angle = current;
    }
  } else if (enemy.bossAttack === "spinSweep") {
    // Fast continuous spin, sped up further during the "strike" (the actual whirl) vs the
    // slower telegraph wind-up rotation. Already smooth/time-based -- left as-is, including
    // through the recover tail so the spin winds down rather than freezing.
    const spinRate = enemy.bossState === "strike" ? 14 : 4;
    angle = (time / 1000) * spinRate;
  } else if (enemy.bossAttack === "overheadSmash") {
    // Raised overhead: pointing straight up (-90deg) during telegraph (wind-up), tweened down
    // to straight ahead/down (+90deg) over the course of the strike (not a single-frame snap),
    // then eased slightly further down through the recover tail before vanishing.
    if (enemy.bossState === "telegraph") {
      angle = -Math.PI / 2;
    } else if (enemy.bossState === "strike") {
      // easeOutCubic front-loads the motion (fast start, slow finish) which reads well for an
      // overhead smash: the club whips down quickly then settles into the final pose.
      angle = -Math.PI / 2 + Math.PI * easeOutCubic(stateP);
    } else {
      // Recover tail: settle slightly further down from the straight-down strike end angle.
      angle = Math.PI / 2 + 0.35 * easeOutCubic(stateP);
    }
  }

  // Geometry (pivot reach + club length) comes from the SAME shared helper the combat code
  // uses for its damage check (nibblerKingClubGeometry, defined above), so the drawn club and
  // the hitbox can never disagree. That helper returns WORLD-space coordinates; this draw call
  // happens inside the boss's own local translate (see drawEnemy: ctx.translate(enemy.x,
  // enemy.y) before drawNibblerKingClub is called), so convert back to local space by
  // subtracting the boss's own position.
  const geo = nibblerKingClubGeometry(enemy, angle);
  const localPivotX = geo.pivotX - enemy.x;
  const localPivotY = geo.pivotY - enemy.y;
  const clubHeight = geo.thickness;

  ctx.save();
  ctx.translate(localPivotX, localPivotY);
  ctx.rotate(angle);
  ctx.imageSmoothingEnabled = true;
  // Anchor at the LEFT edge of the image (the handle, per the source art's convention: drawn
  // pointing right with the handle at the left end) so the club pivots around the grip with
  // the head sweeping through the arc, the way a held weapon actually swings.
  ctx.drawImage(art, 0, -clubHeight / 2, geo.clubLength, clubHeight);
  ctx.restore();
}

// Phase 2: a continuous red pulse over the body once the boss crosses BOSS_PHASE2_HP_FRACTION
// (see updateNibblerKingBehavior in js/07-combat.js, which sets boss.bossPhase and the
// one-shot boss.bossFlash transition burst). Two layers: a soft steady tint so phase 2 reads
// at a glance even from a still screenshot, plus the faster one-shot bossFlash burst that
// fades out over the first second after the transition.
function drawNibblerKingPhaseOverlay(enemy) {
  if ((enemy.bossPhase ?? 1) >= 2) {
    // FIX 4c: a more pronounced phase-2 pulse (bigger amplitude, slightly faster) than the
    // original quiet tint, so "the King got angrier" reads clearly at a glance, paired with
    // the faster/heavier stomp cadence added in enemyLocomotion's boss branch.
    const pulse = 0.4 + Math.sin(performance.now() / 150) * 0.22;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255, 40, 40, ${pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * (1.05 + pulse * 0.08), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if ((enemy.bossFlash ?? 0) > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = clamp(enemy.bossFlash, 0, 1);
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius * 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Shared ring-art draw for the circular ground telegraphs/shockwaves below. Draws
// boss-warning-ring.png (registered as "fx:bossWarningRing" in js/00-assets.js) centred at
// (x, y), scaled to the given radius, at the given alpha -- replacing what used to be a
// plain stroked/filled circle with the cracked molten-stone ring texture, WITHOUT touching
// any of the existing expand/pulse timing math (callers still compute radius/alpha exactly
// as before and just hand them to this instead of calling ctx.arc/stroke directly).
// Guarded like every other PNG draw in this file: falls back to the caller's own procedural
// stroke if the art has not finished loading, so a mid-session load never means a missing
// telegraph. Returns true if it drew the art (so the caller can skip its stroke fallback).
function drawWarningRingArt(x, y, radius, alpha) {
  const art = artFor("fx:bossWarningRing");
  if (!art || radius <= 0 || alpha <= 0) return false;
  const size = radius * 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(art, x - size / 2, y - size / 2, size, size);
  ctx.restore();
  return true;
}

// Ground-space red attack telegraphs, one per attack kind (see startBossTelegraph in
// js/07-combat.js for what populates enemy.bossTelegraph). Called once per boss from the
// top-level draw() loop, in WORLD coordinates (not the boss's local translate/squash space),
// since a ground warning circle or a charge path must stay fixed in the arena regardless of
// how the boss's own sprite is currently wobbling.
function drawNibblerKingTelegraphs(enemy) {
  // GROUND SLAM shockwave: the actual expanding ring at the moment of impact (as opposed to
  // the red warning ring during telegraph, drawn by the "slam" branch below). Independent of
  // bossState -- it plays out during "strike"/"recover" after the telegraph has already ended,
  // decaying on its own via boss.bossSlamRing.life (ticked in updateNibblerKingBehavior).
  if (enemy.bossSlamRing) {
    const ring = enemy.bossSlamRing;
    const p = 1 - clamp(ring.life / ring.maxLife, 0, 1);
    const eased = easeOutCubic(p);
    const radius = ring.radius * (0.3 + eased * 0.7);
    const alpha = 1 - eased;
    if (!drawWarningRingArt(ring.x, ring.y, radius, alpha)) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ff6a5f";
      ctx.lineWidth = 6 * (1 - eased * 0.6);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // SPIN SWEEP shockwave: same idea as the ground-slam ring above, but centred on the boss
  // itself (it hits everywhere at once, not a chosen ground spot) -- see boss.bossSpinRing,
  // set in executeBossStrike's "spinSweep" branch and ticked down alongside bossSlamRing.
  if (enemy.bossSpinRing) {
    const ring = enemy.bossSpinRing;
    const p = 1 - clamp(ring.life / ring.maxLife, 0, 1);
    const eased = easeOutCubic(p);
    const radius = ring.radius * (0.5 + eased * 0.5);
    const alpha = 1 - eased;
    if (!drawWarningRingArt(ring.x, ring.y, radius, alpha)) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ff9c5b";
      ctx.lineWidth = 5 * (1 - eased * 0.6);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // GROUND POUND SHOCKWAVE rings: same expanding-ring visual as groundSlam, but multiple
  // concurrent rings (see boss.bossPoundRings, an array set/decayed in js/07-combat.js).
  if (enemy.bossPoundRings) {
    for (const ring of enemy.bossPoundRings) {
      const p = 1 - clamp(ring.life / ring.maxLife, 0, 1);
      const eased = easeOutCubic(p);
      const radius = ring.radius * (0.3 + eased * 0.7);
      const alpha = 1 - eased;
      if (!drawWarningRingArt(ring.x, ring.y, radius, alpha)) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#ff6a5f";
        ctx.lineWidth = 5 * (1 - eased * 0.6);
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // STOMP QUAKE ring: same idea, single small ring right around the boss for each tremor pulse.
  if (enemy.bossQuakeRing) {
    const ring = enemy.bossQuakeRing;
    const p = 1 - clamp(ring.life / ring.maxLife, 0, 1);
    const eased = easeOutCubic(p);
    const radius = ring.radius * (0.4 + eased * 0.6);
    const alpha = 1 - eased;
    if (!drawWarningRingArt(ring.x, ring.y, radius, alpha)) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ff9c5b";
      ctx.lineWidth = 4 * (1 - eased * 0.6);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // CROWN TOSS in-flight: draws the REAL crown sprite tracing the crown's out-and-back arc
  // while the strike plays, spinning as it flies so it reads as a thrown object rather than a
  // floating dot. This guard (bossAttack === "crownToss" && bossState === "strike") MUST stay
  // textually identical to the early-return guard at the top of drawNibblerKingCrown, so the
  // King is never drawing its head-mounted crown in the same frame as this in-flight one (and
  // never zero crowns either). This is drawn in WORLD space (like the telegraph rings above,
  // NOT inside the boss's local translate/squash), matching where bossCrownPos itself is
  // computed (runCrownTossTick, js/07-combat.js -- boss.x/y + world offsets).
  if (enemy.bossCrownPos && enemy.bossAttack === "crownToss" && enemy.bossState === "strike") {
    const crownArt = artFor("boss:nibblerKingCrown");
    if (crownArt) {
      // Same on-screen size the head-mounted crown uses (drawNibblerKingCrown's crownWidth),
      // slightly smaller so the flying crown doesn't read as bigger than the worn one.
      const flyWidth = enemy.radius * 1.0;
      const aspect = crownArt.width / crownArt.height;
      const flyHeight = flyWidth / aspect;
      // Spin based on elapsed flight time so it visibly tumbles as it travels, rather than
      // just translating in a straight line.
      const spin = (performance.now() / 1000) * 9;
      ctx.save();
      ctx.translate(enemy.bossCrownPos.x, enemy.bossCrownPos.y);
      ctx.rotate(spin);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(crownArt, -flyWidth / 2, -flyHeight / 2, flyWidth, flyHeight);
      ctx.restore();
    } else {
      // Fallback: the old plain gold dot, only while the art hasn't loaded yet.
      ctx.save();
      ctx.fillStyle = "#f2c45f";
      ctx.beginPath();
      ctx.arc(enemy.bossCrownPos.x, enemy.bossCrownPos.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  if (enemy.bossState !== "telegraph" || !enemy.bossTelegraph) return;
  const telegraph = enemy.bossTelegraph;
  const timing = bossAttackTiming(enemy.bossAttack, enemy.bossPhase ?? 1);
  const progress = clamp((telegraph.elapsed ?? 0) / Math.max(0.001, timing.telegraph), 0, 1);
  // Warnings intensify (faster strobe, higher peak alpha) as the strike approaches, so the
  // last instant before it lands is the most visually urgent moment.
  const strobeHz = 3 + progress * 7;
  const strobe = 0.35 + Math.max(0, Math.sin(performance.now() / 1000 * strobeHz * Math.PI * 2)) * 0.4;

  if (telegraph.kind === "swing") {
    // ATTACK 1 telegraph: a widening red cone/arc in the swing direction, anchored at the
    // boss. Matches executeBossStrike's own range/arc math (js/07-combat.js) so the warning
    // honestly represents where the hit will land.
    // v0.18.0: reads the range/halfArc the telegraph payload itself carries (written in
    // startBossTelegraph, js/07-combat.js) so this warning can never drift from the real
    // damage-check geometry in executeBossStrike. Literal fallback only for safety.
    const range = telegraph.range ?? enemy.radius * BOSS_CLUB_REACH_MULT;
    const halfArc = telegraph.halfArc ?? ((enemy.bossPhase ?? 1) >= 2 ? 0.95 : 0.8);
    const grow = 0.4 + progress * 0.6;
    ctx.save();
    ctx.fillStyle = `rgba(255, 60, 60, ${strobe * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.arc(enemy.x, enemy.y, range * grow, telegraph.angle - halfArc, telegraph.angle + halfArc);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 90, 90, ${strobe})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "summonSpots") {
    // ATTACK 2 telegraph: a red warning ring at each spot a Nibbler is about to materialize.
    // ART: the cracked-stone ring texture replaces the plain filled disc underneath; the
    // stroked rim on top (same strobe colour/timing as before) stays procedural so the warning
    // still reads as "red = danger" at a glance.
    for (const spot of telegraph.spots) {
      const spotRadius = 22 + progress * 10;
      ctx.save();
      drawWarningRingArt(spot.x, spot.y, spotRadius, strobe * 0.55);
      ctx.strokeStyle = `rgba(255, 70, 70, ${strobe})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spotRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  } else if (telegraph.kind === "flash") {
    // ATTACK 3 (phase 2 only) telegraph: the boss itself flashes gold/white with a growing
    // ring, rather than a ground marker -- the launch is omnidirectional, so there is no
    // single spot on the ground to warn about.
    ctx.save();
    ctx.strokeStyle = `rgba(255, 226, 138, ${strobe})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius * (1.2 + progress * 1.4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "slam") {
    // ATTACK 4 telegraph: an expanding red circle on the ground at the slam's centre, matching
    // executeBossStrike's slamRadius math so the warning is an honest preview of the shockwave.
    // ART: the cracked-stone ring texture replaces the plain filled disc underneath; the
    // stroked rim on top (same strobe colour/timing as before) is unchanged.
    // v0.18.0: reads telegraph.radius (written in startBossTelegraph) so this ring always
    // matches the real shockwave radius from executeBossStrike's slamRadius.
    const slamRadius = telegraph.radius ?? enemy.radius * ((enemy.bossPhase ?? 1) >= 2 ? BOSS_SLAM_REACH_MULT.p2 : BOSS_SLAM_REACH_MULT.p1);
    const grow = 0.25 + progress * 0.85;
    ctx.save();
    drawWarningRingArt(telegraph.x, telegraph.y, slamRadius * grow, strobe * 0.5);
    ctx.strokeStyle = `rgba(255, 60, 60, ${strobe})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(telegraph.x, telegraph.y, slamRadius * grow, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "chargePath") {
    // ATTACK 5 telegraph: a straight red line/path from the boss toward where the player was
    // when the telegraph started, matching executeBossStrike's charge direction so the line is
    // an honest preview of the dash line -- the player can see exactly where to step off it.
    const pathLength = Math.max(W, H) * 1.2;
    const endX = telegraph.fromX + Math.cos(telegraph.toAngle) * pathLength;
    const endY = telegraph.fromY + Math.sin(telegraph.toAngle) * pathLength;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 60, 60, ${strobe * 0.85})`;
    ctx.lineWidth = enemy.radius * 0.55;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(telegraph.fromX, telegraph.fromY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "comboSwing") {
    // ATTACK 6 (SLAM COMBO) telegraph: draws the CURRENT hit's cone (telegraph.hit advances as
    // runSlamComboTick lands each of the 3 swings), plus faint ghost cones for the remaining
    // hits so the player can see the whole sequence coming, not just the next one.
    // v0.18.0: reads telegraph.range/halfArc (written in startBossTelegraph) so these cones
    // always match landSlamComboHit's real per-hit geometry.
    const range = telegraph.range ?? enemy.radius * BOSS_COMBO_REACH_MULT;
    const halfArc = telegraph.halfArc ?? ((enemy.bossPhase ?? 1) >= 2 ? 0.72 : 0.6);
    const activeIndex = telegraph.hit ?? 0;
    for (let i = 0; i < telegraph.angles.length; i += 1) {
      const isActive = i === activeIndex;
      const grow = isActive ? 0.4 + progress * 0.6 : 1;
      const alpha = isActive ? strobe : 0.12;
      ctx.save();
      ctx.fillStyle = `rgba(255, 60, 60, ${alpha * (isActive ? 0.4 : 1)})`;
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y);
      ctx.arc(enemy.x, enemy.y, range * grow, telegraph.angles[i] - halfArc, telegraph.angles[i] + halfArc);
      ctx.closePath();
      ctx.fill();
      if (isActive) {
        ctx.strokeStyle = `rgba(255, 90, 90, ${strobe})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
  } else if (telegraph.kind === "spinRing") {
    // ATTACK 7 (SPIN SWEEP) telegraph: an expanding ring at club reach around the boss, since
    // this attack hits every direction at once -- no arc to aim, just a growing danger radius.
    // ART: the cracked-stone ring texture replaces the plain filled disc underneath; the
    // stroked rim on top (same strobe colour/timing as before) is unchanged.
    // v0.18.0: reads telegraph.range (written in startBossTelegraph via BOSS_SPIN_REACH_MULT)
    // so this ring always matches the real spinSweep strike radius.
    const range = telegraph.range ?? enemy.radius * ((enemy.bossPhase ?? 1) >= 2 ? BOSS_SPIN_REACH_MULT.p2 : BOSS_SPIN_REACH_MULT.p1);
    const grow = 0.3 + progress * 0.7;
    ctx.save();
    drawWarningRingArt(enemy.x, enemy.y, range * grow, strobe * 0.45);
    ctx.strokeStyle = `rgba(255, 156, 91, ${strobe})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, range * grow, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "overheadMark") {
    // ATTACK 8 (OVERHEAD SMASH) telegraph: a small precise circle pinned to the player's
    // position when the telegraph started -- deliberately small and exact, unlike the other
    // ground-warning attacks, since the whole point is a readable tell you can just step off.
    // ART: the cracked-stone ring texture replaces the plain filled disc underneath; the
    // stroked rim on top (same strobe colour/timing as before) is unchanged.
    // v0.18.0 FIX: this was hardcoded to 46, but the real damage radius is BOSS_SMASH_RADIUS
    // (130, js/07-combat.js) -- the warning was drawing a circle less than half the size of the
    // actual hit, exactly the "warning hitbox too small" complaint this whole pass exists to fix.
    const smashRadius = BOSS_SMASH_RADIUS;
    const pulse = 0.85 + Math.sin(performance.now() / 1000 * (4 + progress * 6) * Math.PI * 2) * 0.15;
    ctx.save();
    drawWarningRingArt(telegraph.x, telegraph.y, smashRadius * pulse, strobe * 0.6);
    ctx.strokeStyle = `rgba(255, 60, 60, ${strobe})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(telegraph.x, telegraph.y, smashRadius * pulse, 0, Math.PI * 2);
    ctx.stroke();
    // A thin line from the boss to the mark so it's clear WHO is about to slam it, even
    // though the hit lands wherever the mark is regardless of where the boss ends up.
    ctx.strokeStyle = `rgba(255, 60, 60, ${strobe * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.lineTo(telegraph.x, telegraph.y);
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "cone") {
    // ATTACK 9 (SEED SPRAY) telegraph: a red cone matching the pellet fan's spread, anchored at
    // the boss, honestly previewing the safe lanes just outside the cone's edges.
    const range = Math.max(W, H);
    ctx.save();
    ctx.fillStyle = `rgba(255, 60, 60, ${strobe * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.arc(enemy.x, enemy.y, range, telegraph.angle - telegraph.halfArc, telegraph.angle + telegraph.halfArc);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 90, 90, ${strobe})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "lobSpots") {
    // ATTACK 10 (SPIT VOLLEY) telegraph: a small red ground marker at each spot a lob will
    // land, same visual language as summonSpots but sized down to read as "incoming shot"
    // rather than "something is about to spawn here".
    for (const spot of telegraph.spots) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 70, 70, ${strobe})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 14 + progress * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 70, 70, ${strobe * 0.22})`;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 14 + progress * 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (telegraph.kind === "radialFlash") {
    // ATTACK 11 (RADIAL BURST) telegraph: the boss flashes plus an expanding ring, distinct in
    // colour from nibblerLaunch's gold "flash" (that one throws real Nibblers, this throws
    // projectiles) so the two omnidirectional warnings never read as the same threat.
    ctx.save();
    ctx.strokeStyle = `rgba(255, 156, 91, ${strobe})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius * (1.1 + progress * 1.8), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "poundWarn") {
    // ATTACK 12 (GROUND POUND SHOCKWAVE) telegraph: a growing warning ring centred on the boss,
    // previewing the first (and largest-window) of the 3 staggered rings to come.
    // v0.18.0: reads telegraph.range (written in startBossTelegraph via BOSS_POUND_REACH_MULT)
    // so this preview ring matches the real first-ring radius from fireGroundPoundRing.
    const range = telegraph.range ?? enemy.radius * ((enemy.bossPhase ?? 1) >= 2 ? BOSS_POUND_REACH_MULT.p2 : BOSS_POUND_REACH_MULT.p1);
    const grow = 0.3 + progress * 0.7;
    ctx.save();
    drawWarningRingArt(enemy.x, enemy.y, range * grow, strobe * 0.5);
    ctx.strokeStyle = `rgba(255, 60, 60, ${strobe})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, range * grow, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "crownArc") {
    // ATTACK 13 (CROWN TOSS) telegraph: a straight line toward the throw angle, previewing the
    // boomerang's out-leg (same visual language as chargePath) plus a small mark at the peak.
    // v0.18.0: reads telegraph.throwRange (written in startBossTelegraph via
    // BOSS_CROWN_THROW_MULT) so this line matches runCrownTossTick's real throw distance.
    const throwRange = telegraph.throwRange ?? enemy.radius * BOSS_CROWN_THROW_MULT;
    const endX = telegraph.fromX + Math.cos(telegraph.angle) * throwRange;
    const endY = telegraph.fromY + Math.sin(telegraph.angle) * throwRange;
    ctx.save();
    ctx.strokeStyle = `rgba(242, 196, 95, ${strobe * 0.85})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(telegraph.fromX, telegraph.fromY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(255, 90, 90, ${strobe})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(endX, endY, 24 + progress * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "quakeWarn") {
    // ATTACK 14 (STOMP QUAKE) telegraph: a tight pulsing ring right around the boss, short and
    // urgent since this attack is meant to punish players who don't react to being in melee.
    // v0.18.0: reads telegraph.range (written in startBossTelegraph via BOSS_QUAKE_REACH_MULT)
    // so this ring matches fireStompQuakePulse's real pulse radius.
    const range = telegraph.range ?? enemy.radius * BOSS_QUAKE_REACH_MULT;
    const pulse = 0.85 + Math.sin(performance.now() / 1000 * (5 + progress * 6) * Math.PI * 2) * 0.15;
    ctx.save();
    drawWarningRingArt(enemy.x, enemy.y, range * pulse, strobe * 0.55);
    ctx.strokeStyle = `rgba(255, 156, 91, ${strobe})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, range * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "laserSweep") {
    // ATTACK 15 (LASER SWEEP) telegraph: the line rotates from telegraph.startAngle to
    // telegraph.endAngle over the strike window (see runLaserSweepTick, js/07-combat.js), so
    // the honest preview here is the whole swept arc (a wedge from startAngle to endAngle at
    // telegraph.range) plus a brighter line at the CURRENT angle (interpolated the same way
    // runLaserSweepTick does) so the player can read which way the beam is about to travel.
    const range = telegraph.range ?? enemy.radius * BOSS_LASER_REACH_MULT;
    const startAngle = telegraph.startAngle;
    const endAngle = telegraph.endAngle;
    const curAngle = startAngle + (endAngle - startAngle) * progress;
    ctx.save();
    // faint wedge covering the whole arc the beam will sweep through
    ctx.fillStyle = `rgba(126, 242, 255, ${strobe * 0.18})`;
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.arc(enemy.x, enemy.y, range, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
    ctx.closePath();
    ctx.fill();
    // starting position of the line, dim
    ctx.strokeStyle = `rgba(126, 242, 255, ${strobe * 0.35})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.lineTo(enemy.x + Math.cos(startAngle) * range, enemy.y + Math.sin(startAngle) * range);
    ctx.stroke();
    // current sweep position, bright -- this is where the beam is about to be at strike start
    ctx.strokeStyle = `rgba(255, 90, 90, ${strobe})`;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.lineTo(enemy.x + Math.cos(curAngle) * range, enemy.y + Math.sin(curAngle) * range);
    ctx.stroke();
    ctx.restore();
  } else if (telegraph.kind === "gapWallWarn") {
    // ATTACK 16 (GAP WALL) telegraph: a row of red warning markers along the wall line
    // (perpendicular to telegraph.angle), one per bullet slot in executeBossStrike's gapWall
    // branch (js/07-combat.js), using the EXACT same spacing/offset/wallDist math so each
    // marker sits right where its bullet will spawn. The gapIndex slot is drawn as a bright
    // green safe-gap marker instead of a red warning so it's unmistakable.
    const angle = telegraph.angle;
    const perp = angle + Math.PI / 2;
    const count = telegraph.count;
    const gapIndex = telegraph.gapIndex;
    const spacing = 60;
    const wallDist = 40;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * spacing;
      const originX = enemy.x + Math.cos(angle) * wallDist + Math.cos(perp) * offset;
      const originY = enemy.y + Math.sin(angle) * wallDist + Math.sin(perp) * offset;
      ctx.save();
      if (i === gapIndex) {
        // THE SAFE GAP: bright green, pulsing, clearly different from every red slot.
        const gapPulse = 0.75 + Math.sin(performance.now() / 1000 * 6 * Math.PI * 2) * 0.25;
        ctx.strokeStyle = `rgba(120, 255, 140, ${gapPulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(originX, originY, 22 + progress * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(120, 255, 140, ${gapPulse * 0.25})`;
        ctx.beginPath();
        ctx.arc(originX, originY, 22 + progress * 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = `rgba(196, 139, 255, ${strobe})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(originX, originY, 12 + progress * 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(196, 139, 255, ${strobe * 0.25})`;
        ctx.beginPath();
        ctx.arc(originX, originY, 12 + progress * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // A faint line tracing the whole wall so the gap's position relative to the line reads
    // clearly even before the individual markers are studied.
    const halfSpan = ((count - 1) / 2) * spacing;
    const lineStartX = enemy.x + Math.cos(angle) * wallDist + Math.cos(perp) * -halfSpan;
    const lineStartY = enemy.y + Math.sin(angle) * wallDist + Math.sin(perp) * -halfSpan;
    const lineEndX = enemy.x + Math.cos(angle) * wallDist + Math.cos(perp) * halfSpan;
    const lineEndY = enemy.y + Math.sin(angle) * wallDist + Math.sin(perp) * halfSpan;
    ctx.save();
    ctx.strokeStyle = `rgba(196, 139, 255, ${strobe * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(lineStartX, lineStartY);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  } else if (telegraph.kind === "tripleCone") {
    // ATTACK 17 (TRIPLE VOLLEY) telegraph: a narrow aimed cone (tighter than the "cone" seedSpray
    // warning) along telegraph.angle/halfArc, matching fireTripleVolleyRound's straight-at-player
    // aim (js/07-combat.js). Drawn with 3 overlaid guide lines fanned slightly within the cone to
    // read as "3 aimed shots incoming", distinct from the single-line laserSweep and the wide
    // filled "cone" spray warning.
    const range = Math.max(W, H);
    const halfArc = telegraph.halfArc;
    ctx.save();
    ctx.fillStyle = `rgba(255, 60, 60, ${strobe * 0.22})`;
    ctx.beginPath();
    ctx.moveTo(enemy.x, enemy.y);
    ctx.arc(enemy.x, enemy.y, range, telegraph.angle - halfArc, telegraph.angle + halfArc);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 90, 90, ${strobe})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // 3 bright guide lines (left/centre/right of the cone) telegraphing the 3 rounds to come.
    const lineAngles = [telegraph.angle - halfArc * 0.6, telegraph.angle, telegraph.angle + halfArc * 0.6];
    ctx.strokeStyle = `rgba(255, 130, 120, ${strobe * 0.9})`;
    ctx.lineWidth = 2;
    for (const a of lineAngles) {
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y);
      ctx.lineTo(enemy.x + Math.cos(a) * range, enemy.y + Math.sin(a) * range);
      ctx.stroke();
    }
    ctx.restore();
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

// Blight Sac's death pool: a sickly-green puddle that fades over its lifetime. Bubbles
// gently to read as active/dangerous rather than a static decal.
function drawPoisonPool(pool) {
  const fade = clamp(pool.life / pool.maxLife, 0, 1);
  const pulse = 1 + Math.sin(pool.bob) * 0.05;
  ctx.save();
  ctx.translate(pool.x, pool.y);
  ctx.globalAlpha = 0.28 + fade * 0.32;
  const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, pool.radius * pulse);
  gradient.addColorStop(0, "rgba(143, 191, 90, 0.85)");
  gradient.addColorStop(0.7, "rgba(96, 145, 58, 0.55)");
  gradient.addColorStop(1, "rgba(96, 145, 58, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, pool.radius * pulse, pool.radius * pulse * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = (0.35 + fade * 0.35) * (0.6 + Math.sin(pool.bob * 2.2) * 0.4);
  ctx.fillStyle = "#c8e6a0";
  ctx.beginPath();
  ctx.arc(-pool.radius * 0.3, pool.radius * 0.05, pool.radius * 0.08, 0, Math.PI * 2);
  ctx.arc(pool.radius * 0.28, -pool.radius * 0.1, pool.radius * 0.06, 0, Math.PI * 2);
  ctx.arc(pool.radius * 0.05, pool.radius * 0.22, pool.radius * 0.05, 0, Math.PI * 2);
  ctx.fill();
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

  // Redesigned PNG bin: two frames of the same object, swapped on `open`. Both were cropped
  // so the body is the same size and sits on the same baseline, so this swap animates only
  // the lid. Drawn bottom-anchored to match where the old code-drawn sack sat.
  const binArt = artFor(open ? "env:scrap_bin_open" : "env:scrap_bin");
  if (binArt) {
    const size = 88;
    // Baseline: the old sack's base was ~y+30, so anchor the art's bottom there.
    ctx.drawImage(binArt, -size / 2, 30 - size, size, size);
    drawUnusedBagCount();
    ctx.restore();
    return;
  }

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

  drawUnusedBagCount();
  ctx.restore();
}

// The scrap counter badge that sits on the bin. Shared by both the PNG and the fallback
// code-drawn bin so the number can never end up drawn twice or not at all.
// The scrap count, drawn as a brass plate riveted onto the front of the bin rather than a
// flat badge floating over it. Sold by three things: it sits low on the body where a real
// label would, it uses the bin's own brass palette with a lit top edge and a shadowed
// bottom edge (so it reads as raised metal catching the same light), and the digits are
// engraved -- a dark cut with a one-pixel highlight under it, not solid ink on a disc.
function drawUnusedBagCount() {
  const text = `${state.unusedScrap + state.pendingBagScrap}`;
  ctx.font = "1000 12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Plate widens with the digit count so a 4-figure total doesn't overflow it.
  const w = Math.max(26, ctx.measureText(text).width + 14);
  const h = 15;
  const y = 8;

  // Body of the plate: vertical brass gradient, bright at the top like the bin's bands.
  const plate = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  plate.addColorStop(0, "#f6d489");
  plate.addColorStop(0.45, "#e0ac52");
  plate.addColorStop(1, "#a9762f");
  ctx.fillStyle = plate;
  ctx.strokeStyle = "#3a2412";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundedRectPath(ctx, -w / 2, y - h / 2, w, h, 3);
  ctx.fill();
  ctx.stroke();

  // Lit top bevel, so the plate looks like it stands proud of the bin surface.
  ctx.strokeStyle = "rgba(255, 245, 214, 0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 3, y - h / 2 + 1);
  ctx.lineTo(w / 2 - 3, y - h / 2 + 1);
  ctx.stroke();

  // Two rivets, matching the studs on the bin's metal bands.
  ctx.fillStyle = "#f7e3ae";
  ctx.strokeStyle = "rgba(58, 36, 18, 0.75)";
  ctx.lineWidth = 0.75;
  for (const rx of [-w / 2 + 4, w / 2 - 4]) {
    ctx.beginPath();
    ctx.arc(rx, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Engraved digits: dark cut plus a lighter line just below it, which is what sells
  // "stamped into metal" rather than "printed on top".
  ctx.fillStyle = "rgba(255, 240, 200, 0.4)";
  ctx.fillText(text, 0, y + 1);
  ctx.fillStyle = "#2a1a0c";
  ctx.fillText(text, 0, y);
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
  } else if (bullet.weaponName === "Shuriken") {
    drawShurikenProjectile(bullet, speed);
  } else {
    drawSparkProjectile(bullet, speed);
  }
  ctx.restore();
}

// A four-pointed star that spins fast in flight. drawBullet has already rotated to the
// travel direction, so the spin is added on top of that -- and because it is driven by wall
// clock rather than the aim angle, it keeps whirling identically on the way out and on the
// way back (when the travel direction reverses).
// Held and thrown must be the SAME object at the SAME size: the star you see flying is
// literally the weapon that left your hand, so the thrown one draws from the weapon art at
// the held sprite's boxSize (44, see drawArenaWeapon) rather than from a separate vector
// shape scaled off the projectile's collision radius, which rendered it about half size.
// Minis keep the old vector star, deliberately smaller, since they ARE separate objects.
const SHURIKEN_HELD_BOX = 44;

function drawShurikenProjectile(bullet, speed) {
  const r = bullet.radius;
  // Minis spin faster than the parent star, which keeps them reading as separate lighter
  // objects rather than shrunken copies of the weapon.
  ctx.rotate(performance.now() / 1000 * (bullet.isMiniShuriken ? 34 : 22));

  const heldArt = bullet.isMiniShuriken ? null : weaponArenaArt("Shuriken");
  if (heldArt) {
    // Motion blur disc sized to the real sprite so it still reads as spinning.
    ctx.fillStyle = "rgba(240, 240, 255, 0.16)";
    ctx.beginPath();
    ctx.arc(0, 0, SHURIKEN_HELD_BOX * 0.42, 0, Math.PI * 2);
    ctx.fill();
    drawWeaponArtFitted(ctx, "Shuriken", heldArt, SHURIKEN_HELD_BOX);
    return;
  }

  // Motion blur disc: reads as "spinning too fast to see" and thickens the tiny sprite.
  ctx.fillStyle = bullet.isMiniShuriken ? "rgba(240, 240, 255, 0.1)" : "rgba(240, 240, 255, 0.16)";
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#dfe3ef";
  ctx.strokeStyle = "rgba(24, 28, 38, 0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    const b = a + Math.PI / 4;
    ctx.lineTo(Math.cos(a) * r * 2.6, Math.sin(a) * r * 2.6);   // point
    ctx.lineTo(Math.cos(b) * r * 0.9, Math.sin(b) * r * 0.9);   // inner notch
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Hub.
  ctx.fillStyle = "rgba(40, 46, 60, 0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
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

  // Thistle: a barbed thorn. Deliberately nothing like the Spitter's glob -- hard angular
  // silhouette instead of a soft blob, green instead of cyan, and it spins as it flies, so
  // the two are separable at a glance even in a crowded arena.
  if (bullet.kind === "thorn") {
    const spin = (bullet.spin ?? 0) + performance.now() / 90;

    // Faint motion streak behind it.
    ctx.strokeStyle = "rgba(127, 174, 92, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(-24, 0);
    ctx.stroke();

    ctx.rotate(spin * 0.6);
    // Four-point barb: long fore/aft spikes, short side barbs. Sharp, not round.
    ctx.fillStyle = "#8fce62";
    ctx.strokeStyle = "#1e3318";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(2, 3.2);
    ctx.lineTo(0, 8);
    ctx.lineTo(-2.4, 3.2);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-2.4, -3.2);
    ctx.lineTo(0, -8);
    ctx.lineTo(2, -3.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pale woody core so it reads as plant matter rather than metal.
    ctx.fillStyle = "rgba(226, 245, 190, 0.75)";
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-1, 1.6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-1, -1.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

  // Nibbler King ranged attacks (seedSpray/radialBurst pellets, spitVolley lobs -- see
  // shootBossPellet/shootBossLob in js/07-combat.js). Bigger and redder than a Spitter's glob
  // so a boss projectile is instantly distinguishable from a regular enemy's shot.
  if (bullet.kind === "kingSeed" || bullet.kind === "kingLob") {
    ctx.fillStyle = "rgba(255, 106, 95, 0.22)";
    ctx.beginPath();
    ctx.ellipse(-16, 0, 15, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff6a5f";
    ctx.strokeStyle = "#5a1712";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(-2, -2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Spitter: a wet cyan glob. Keeps the soft rounded silhouette, now with a proper tapered
  // tail so it reads as thrown fluid rather than a plain dot.
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

// Keeps its own save/restore: several callers (coins, crates, drops) rely on their fillStyle
// being untouched afterwards, and leaking the shadow colour into them would tint real art.
// The cost is one state push per shadow, which is not where the late-wave time actually goes.
function drawShadow(x, y, rx, ry) {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
