"use strict";

// combat.js - simulation update loop: enemies, weapons, pickups

function update(dt) {
  decayFx(dt);
  if (state.mode === "bagging") {
    updateBagCollection(dt);
    updateParticles(dt);
    updateHud();
    return;
  }

  if (state.mode !== "playing") {
    return;
  }

  state.runStats.timePlayed += dt;
  state.waveTime -= dt;
  state.spawnTimer -= dt;
  state.player.engineeringCooldown -= dt;
  state.player.meleeCooldown -= dt;
  state.player.damageCooldown -= dt;
  state.player.lifeStealCooldown -= dt;
  state.player.hurtTimer = Math.max(0, state.player.hurtTimer - dt);
  regeneratePlayer(dt);

  movePlayer(dt);
  spawnWaveEnemies(dt);
  fireEquippedWeapons(dt);
  updateEngineering(dt);
  updateMeleePulse();
  updateBullets(dt);
  updateWeaponSwings(dt);
  updateEnemyBullets(dt);
  updateEnemies(dt);
  updateEnemyDeaths(dt);
  updateBulbs(dt);
  updateCoins(dt);
  updateCrateSpawns(dt);
  updateCrates(dt);
  updateParticles(dt);

  if (state.player.hp <= 0) {
    state.mode = "gameover";
    playSfx("gameover");
    addShake(12);
    burst(state.player.x, state.player.y, "#ff8fa3", 26);
    spawnRing(state.player.x, state.player.y, "#ff8fa3", 90, 0.5);
    showSummary();
  } else if (state.waveTime <= 0) {
    endWave();
  }

  updateHud();
}

function updateBagCollection(dt) {
  const target = bagTarget();
  for (let i = state.bagAnimations.length - 1; i >= 0; i -= 1) {
    const coin = state.bagAnimations[i];
    if (coin.delay > 0) {
      coin.delay -= dt;
      continue;
    }

    coin.t += dt;
    const progress = clamp(coin.t / coin.duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const arc = Math.sin(progress * Math.PI) * 42;
    coin.x = coin.startX + (coin.targetX - coin.startX) * eased;
    coin.y = coin.startY + (coin.targetY - coin.startY) * eased - arc;

    if (progress >= 1) {
      state.unusedScrap += coin.value;
      trackScrap(coin.value);
      playSfx("coin");
      state.pendingBagScrap -= coin.value;
      state.bagPulse = 0.24;
      burst(target.x, target.y, "#f2c45f", 4);
      state.bagAnimations.splice(i, 1);
    }
  }

  state.bagPulse = Math.max(0, state.bagPulse - dt);
  if (state.bagAnimations.length === 0) {
    state.bagSettleTimer -= dt;
    if (state.bagSettleTimer <= 0) {
      state.pendingBagScrap = 0;
      finishWaveTransition();
    }
  }
}

function regeneratePlayer(dt) {
  const regen = effectiveStat("hpRegen");
  if (regen <= 0 || state.player.hp >= state.player.maxHp) {
    state.player.regenTimer = 0;
    return;
  }

  state.player.regenTimer -= dt;
  if (state.player.regenTimer <= 0) {
    heal(1);
    state.player.regenTimer = hpRegenHealDelay(regen);
  }
}

function updateEngineering() {
  const player = state.player;
  const engineering = effectiveStat("engineering");
  if (engineering <= 0 || player.engineeringCooldown > 0) {
    return;
  }

  const target = findNearestEnemy(210);
  if (!target) {
    return;
  }

  const damage = 5 + engineering * 3;
  addEngineeringZap(player.x, player.y - 8, target.x, target.y, engineering);
  addZapAsh(target.x, target.y, engineering);
  target.hp -= damage;
  target.flashTimer = 0.09;
  trackDamage("Engineering Zap", damage);
  playSfx("zap");
  player.engineeringCooldown = engineeringZapCooldown(engineering);
  burst(target.x, target.y, "#73b7ff", 9);
  addFloater(target.x, target.y - target.radius - 8, "ZAP", { color: "#9bdcff", size: 18, life: 0.62, riseSpeed: 58 });
  if (target.hp <= 0) {
    const index = state.enemies.indexOf(target);
    if (index >= 0) {
      killEnemy(index);
    }
  }
}

function engineeringZapCooldown(engineering) {
  return Math.max(1.25, 4.25 - engineering * 0.07);
}

function addEngineeringZap(x1, y1, x2, y2, engineering) {
  state.zaps.push({
    x1,
    y1,
    x2,
    y2,
    life: 0.22,
    maxLife: 0.22,
    width: clamp(3 + engineering * 0.18, 3, 7),
    seed: Math.random() * 1000
  });
}

function addZapAsh(x, y, engineering) {
  const coins = [];
  const count = clamp(3 + Math.floor(engineering / 4), 3, 7);
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.35, 0.35);
    const distance = rand(10, 24);
    coins.push({
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance * 0.55 + rand(0, 5),
      r: rand(2.5, 4.2)
    });
  }
  state.ashes.push({
    x,
    y,
    coins,
    smoke: Math.random() * Math.PI * 2,
    life: 3.2,
    maxLife: 3.2
  });
}

function updateMeleePulse() {
  const player = state.player;
  const meleeDamage = effectiveStat("meleeDamage");
  if (meleeDamage <= 0 || player.meleeCooldown > 0) {
    return;
  }

  let hitAny = false;
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    const radius = player.radius + enemy.radius + 26;
    if (distSq(player, enemy) <= radius * radius) {
      enemy.hp -= meleeDamage;
      enemy.flashTimer = 0.09;
      trackDamage("Point-Blank Melee", meleeDamage);
      hitAny = true;
      addFloater(enemy.x, enemy.y - enemy.radius, Math.round(meleeDamage));
      if (enemy.hp <= 0) {
        killEnemy(i);
      }
    }
  }

  if (hitAny) {
    player.meleeCooldown = 0.72;
    burst(player.x, player.y, "#f6d28f", 12);
  }
}

function findNearestEnemy(range) {
  const player = state.player;
  return findNearestEnemyFrom(player.x, player.y, range);
}

function findNearestEnemyFrom(x, y, range) {
  let target = null;
  let best = range * range;
  for (const enemy of state.enemies) {
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < best) {
      best = distance;
      target = enemy;
    }
  }
  return target;
}

function findNearestDestructible(range) {
  const player = state.player;
  return findNearestDestructibleFrom(player.x, player.y, range);
}

function findNearestDestructibleFrom(x, y, range) {
  // Secondary targets, only chosen when no enemy is in range (callers use
  // findNearestEnemyFrom(...) ?? findNearestDestructibleFrom(...)). Trees and unbroken
  // crates both count; fruit bulbs are left out so weapons never waste shots on them.
  let target = null;
  let best = range * range;
  for (const object of state.trees) {
    const dx = object.x - x;
    const dy = object.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < best) {
      best = distance;
      target = object;
    }
  }
  for (const crate of state.crates) {
    if (crate.broken) continue;
    const dx = crate.x - x;
    const dy = crate.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < best) {
      best = distance;
      target = crate;
    }
  }
  return target;
}

function getWeaponSlotPosition(player, index, count, now = performance.now()) {
  const visibleCount = Math.max(1, Math.min(maxWeaponSlots(), count));
  // The whole weapon formation drifts slowly around the player (a gentle continuous orbit)
  // instead of sitting at fixed angles, so the loadout feels alive. A soft radius breathe
  // and a smooth vertical bob add life without making aim jittery.
  const orbitSpin = now / 1000 * 0.5;                         // slow shared rotation
  const slotAngle = -Math.PI / 2 + index * (Math.PI * 2 / visibleCount) + orbitSpin;
  const baseRadius = visibleCount === 1 ? 36 : 39 + Math.min(2, visibleCount) * 2;
  const radius = baseRadius + Math.sin(now / 620 + index * 1.3) * 1.6;   // subtle breathe
  const bob = Math.sin(now / 300 + index * 0.9) * 2.2;
  return {
    x: player.x + Math.cos(slotAngle) * radius,
    y: player.y + Math.sin(slotAngle) * radius + bob,
    slotAngle
  };
}

function movePlayer(dt) {
  const player = state.player;
  let dx = 0;
  let dy = 0;

  if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;

  const length = Math.hypot(dx, dy) || 1;
  player.x = clamp(player.x + (dx / length) * player.speed * dt, player.radius + 8, W - player.radius - 8);
  player.y = clamp(player.y + (dy / length) * player.speed * dt, player.radius + 8, H - player.radius - 8);
}

function spawnWaveEnemies() {
  const pressure = enemySpawnInterval();
  if (state.spawnTimer > 0) {
    return;
  }

  state.spawnTimer = pressure;
  const count = enemySpawnBatchSize();
  const activeCap = enemyActiveCap();
  for (let i = 0; i < count; i += 1) {
    if (state.enemies.length >= activeCap) {
      break;
    }
    spawnEnemy();
  }
}

function enemySpawnInterval() {
  const wave = Math.max(1, state.wave);
  const elapsedRatio = state.waveDuration
    ? clamp((state.waveDuration - state.waveTime) / state.waveDuration, 0, 1)
    : 0;
  // Steeper spawn-rate ramp (1.13 -> 1.19 base) so the arena fills up sooner each wave.
  const wavePressure = Math.pow(1.19, wave - 1) * (1 + Math.max(0, wave - 6) * 0.04 + Math.max(0, wave - 13) * 0.045);
  const lateWavePush = 1 + elapsedRatio * Math.min(0.4, wave * 0.02);
  return Math.max(0.16, 1.48 / Math.min(10.5, wavePressure * lateWavePush));
}

function enemySpawnBatchSize() {
  const wave = Math.max(1, state.wave);
  // Bigger early batches (kicks in from wave 2 instead of 3, steeper exponent).
  const growth = Math.floor(Math.pow(Math.max(0, wave - 1), 1.22) / 3.4);
  const midBonus = Math.floor(Math.max(0, wave - 8) / 4);
  const lateBonus = Math.floor(Math.max(0, wave - 13) / 3);
  return Math.min(14, 1 + growth + midBonus + lateBonus);
}

function enemyActiveCap() {
  const wave = Math.max(1, state.wave);
  // Higher concurrent-enemy cap earlier, so the screen gets crowded sooner.
  const curve = 28 + wave * 12 + Math.pow(Math.max(0, wave - 3), 1.45) * 2.8 + Math.max(0, wave - 10) * 5.1;
  return Math.min(MAX_ENEMIES, Math.round(curve));
}

function spawnEnemy() {
  const template = chooseEnemyType();

  const side = Math.floor(Math.random() * 4);
  const margin = 42;
  const x = side === 0 ? -margin : side === 1 ? W + margin : rand(0, W);
  const y = side === 2 ? -margin : side === 3 ? H + margin : rand(0, H);
  const scaling = enemyScaling();

  state.enemies.push({
    name: template.name,
    behavior: template.behavior,
    size: template.size,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: Math.round(template.hp * scaling.hp),
    maxHp: Math.round(template.hp * scaling.hp),
    speed: template.speed * scaling.speed,
    radius: template.radius,
    damage: Math.round(template.damage * scaling.damage),
    scrap: template.scrap,
    color: template.color,
    burn: 0,
    burnDps: 0,
    burnTime: 0,
    knockX: 0,
    knockY: 0,
    contactCooldown: rand(0.05, 0.25),
    actionCooldown: rand(0.4, 1.4),
    chargeTimer: 0,
    windupTimer: 0,
    lungeAngle: 0,
    bob: Math.random() * Math.PI * 2,
    swayPhase: Math.random() * Math.PI * 2,
    hopPhase: Math.random() * Math.PI * 2,
    hopRate: rand(0.85, 1.15),
    mvx: 0,
    mvy: 0
  });
}

function spawnTrees() {
  state.trees.length = 0;
  const count = rollTreeCount();
  for (let i = 0; i < count; i += 1) {
    state.trees.push({
      x: rand(90, W - 90),
      y: rand(100, H - 90),
      radius: 22,
      hp: 30 + state.wave * 4,
      maxHp: 30 + state.wave * 4,
      bob: Math.random() * Math.PI * 2
    });
  }
}

function rollTreeCount() {
  const wave = Math.max(1, state.wave);
  const luck = Math.max(0, effectiveStat("luck"));
  const base = 3 + Math.floor(wave / 4);
  const randomExtra = Math.floor(rand(0, 3));
  const luckExtra = Math.random() * 100 < Math.min(45, luck * 0.35) ? 1 : 0;
  return Math.min(10, base + randomExtra + luckExtra);
}

function chooseEnemyType() {
  const available = enemyTypes.filter((type) => state.wave >= type.minWave);
  const totalWeight = available.reduce((sum, type) => sum + enemyWeight(type), 0);
  let roll = Math.random() * totalWeight;
  for (const type of available) {
    roll -= enemyWeight(type);
    if (roll <= 0) {
      return type;
    }
  }
  return available[0];
}

function enemyWeight(type) {
  const waveBonus = Math.floor(state.wave / 8);
  if (type.behavior === "fireball") {
    return Math.min(5, type.weight + Math.floor(Math.max(0, state.wave - type.minWave) / 3));
  }
  // Shooter enemies (Spitter) don't multiply as the run scales — their ranged pressure
  // gets oppressive in a crowd, so keep their share flat and slightly reduced instead of
  // letting it grow with the wave bonus.
  if (type.behavior === "shoot") {
    return Math.max(1, type.weight - 1);
  }
  if (type.size === "large") {
    return Math.max(1, type.weight + Math.floor(waveBonus * 0.35));
  }
  if (type.size === "small") {
    return type.weight + waveBonus;
  }
  return type.weight + Math.floor(waveBonus * 0.65);
}

function enemyScaling() {
  const wave = Math.max(1, state.wave);
  const growth = wave - 1;
  const midGame = Math.max(0, wave - 6);
  const lateGame = Math.max(0, wave - 12);
  // Faster ramp: enemies gain HP/damage/speed noticeably sooner so early waves stop
  // feeling like a warm-up. Per-wave growth roughly doubled in the early band.
  return {
    hp: 1 + growth * 0.085 + midGame * 0.06 + lateGame * 0.085,
    damage: 1 + growth * 0.032 + midGame * 0.022 + lateGame * 0.03,
    speed: 1 + Math.min(0.18, growth * 0.006)
  };
}

function fireEquippedWeapons(dt) {
  const player = state.player;
  const now = performance.now();
  const count = Math.min(maxWeaponSlots(), state.weapons.length);
  for (let index = 0; index < count; index += 1) {
    const weapon = state.weapons[index];
    weapon.fireCooldown = Math.max(0, (weapon.fireCooldown ?? 0) - dt);
    // Recoil springs back to 0 quickly (a snappy kick, not a slow drift).
    if (weapon.recoil > 0) weapon.recoil = Math.max(0, weapon.recoil - dt * 55);
    if (weapon.fireCooldown > 0) {
      continue;
    }

    const slot = getWeaponSlotPosition(player, index, count, now);
    const range = weaponRange(weapon);
    const target = findNearestEnemyFrom(slot.x, slot.y, range) ?? findNearestDestructibleFrom(slot.x, slot.y, range);
    if (!target) {
      continue;
    }

    fireWeaponAttack(weapon, slot, target);
    weapon.fireCooldown = weaponCooldown(weapon);
  }
}

function fireWeaponAttack(weapon, slot, target) {
  const profile = getWeaponStatProfile(weapon);
  if (profile.attackType === "swing") {
    fireSwingWeapon(weapon, slot, target);
    return;
  }
  fireWeaponFromSlot(weapon, slot, target);
}

function fireWeaponFromSlot(weapon, slot, target) {
  const player = state.player;
  const profile = getWeaponStatProfile(weapon);
  const count = Math.min(maxWeaponSlots(), state.weapons.length);
  const scale = weaponArenaScale(count);
  const baseAngle = Math.atan2(target.y - slot.y, target.x - slot.x);
  const muzzle = getWeaponMuzzleWorld(weapon, slot, baseAngle, scale);
  const angle = Math.atan2(target.y - muzzle.y, target.x - muzzle.x);
  // Snappy muzzle flash + recoil kick so shooting reads with punch. Flamethrower/heavy
  // guns get a bigger flash; the recoil shoves the weapon sprite back along its aim.
  const heavy = weapon.name === "Grenade Launcher" || weapon.name === "Scrap Revolver";
  const flashColor = weapon.name === "Twig Wand" ? "#bfe6ff"
    : weapon.name === "Tin Dragon Flamethrower" ? "#ffb04a"
    : profile.impactColor ?? "#ffe6a0";
  spawnMuzzleFlash(muzzle.x, muzzle.y, angle, flashColor, heavy ? 1.5 : 1);
  weapon.recoil = heavy ? 7 : 4.5;          // px kickback, decays in updateWeapons
  weapon.recoilAngle = angle;
  playSfx(
    weapon.name === "Tin Dragon Flamethrower"
      ? "flame"
      : weapon.name === "Grenade Launcher" || weapon.name === "Scrap Revolver"
        ? "shootHeavy"
        : "shoot"
  );
  const shots = weaponProjectileCount(weapon);
  const spread = shots === 1 ? 0 : profile.spread;
  for (let i = 0; i < shots; i += 1) {
    const offset = (i - (shots - 1) / 2) * spread;
    const shotAngle = angle + offset;
    const crit = Math.random() * 100 < weaponCritChance(weapon);
    const baseDamage = weaponShotDamage(weapon);
    const damage = baseDamage * (crit ? weaponCritMultiplier(weapon) : 1);
    const speed = weaponProjectileSpeed(weapon);
    state.bullets.push({
      x: muzzle.x,
      y: muzzle.y,
      vx: Math.cos(shotAngle) * speed,
      vy: Math.sin(shotAngle) * speed,
      radius: profile.projectileRadius,
      damage,
      crit,
      burnDps: weaponBurnDps(weapon),
      burnDuration: profile.burnDuration ?? 0,
      knockback: weaponKnockback(weapon),
      pierce: weaponPierce(weapon),
      damageFalloff: profile.damageFalloff,
      explosionRadius: weaponTierValue(weapon, "explosionRadius"),
      explosionDamageMultiplier: weaponTierValue(weapon, "explosionDamageMultiplier") || 1,
      life: weaponRange(weapon) / speed,
      weaponName: weapon.name,
      color: profile.color,
      impactColor: profile.impactColor,
      scale: profile.projectileScale,
      hitEnemies: new Set()
    });
  }
}

function fireSwingWeapon(weapon, slot, target) {
  const profile = getWeaponStatProfile(weapon);
  const angle = Math.atan2(target.y - slot.y, target.x - slot.x);
  const range = weaponRange(weapon);
  const arc = weaponSwingArc(weapon);
  const crit = Math.random() * 100 < weaponCritChance(weapon);
  const damage = weaponShotDamage(weapon) * (crit ? weaponCritMultiplier(weapon) : 1);
  const maxHits = 1 + weaponPierce(weapon);

  state.swings.push({
    x: slot.x,
    y: slot.y,
    angle,
    arc,
    range,
    startAngle: angle - arc * 0.58,
    endAngle: angle + arc * 0.58,
    life: weaponSwingDuration(weapon),
    maxLife: weaponSwingDuration(weapon),
    color: profile.color,
    crit,
    weaponName: weapon.name,
    tier: weapon.tier,
    damage,
    burnDps: weaponBurnDps(weapon),
    burnDuration: profile.burnDuration ?? 0,
    knockback: weaponKnockback(weapon),
    impactColor: profile.impactColor,
    maxHits,
    hits: 0,
    hitEnemies: new Set(),
    hitTrees: new Set(),
    hitCrates: new Set()
  });
  playSfx("swing");
}

function getWeaponMuzzleWorld(weapon, slot, angle, scale = 1) {
  const local = getWeaponMuzzleOffset(weapon.name);
  const x = local.x * scale;
  const y = local.y * scale;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: slot.x + x * cos - y * sin,
    y: slot.y + x * sin + y * cos
  };
}

function getWeaponMuzzleOffset(name) {
  if (name === "Twig Wand") return { x: 32, y: -3 };
  if (name === "Stub Club") return { x: 30, y: -4 };
  if (name === "Rusty Pistol") return { x: 33, y: -2 };
  if (name === "Slingshot") return { x: 26, y: 0 };
  if (name === "Scrap Revolver") return { x: 35, y: -2 };
  if (name === "Tin Dragon Flamethrower") return { x: 38, y: -4 };
  if (name === "Grenade Launcher") return { x: 38, y: -3 };
  return { x: 31, y: -1 };
}

function weaponArenaScale(count) {
  return count > 4 ? 0.92 : count > 2 ? 1 : 1.08;
}

function weaponFireRate(weapon) {
  return 1 / weaponCooldown(weapon);
}

function getWeaponStatProfile(weapon) {
  return weaponStatProfiles[weapon.name] ?? weaponStatProfiles["Spark Peashooter"];
}

function tierIndex(weapon) {
  return Math.min(MAX_WEAPON_RANK - 1, Math.max(0, (weapon.tier ?? 1) - 1));
}

function weaponTierValue(weapon, key) {
  const value = getWeaponStatProfile(weapon)[key];
  if (Array.isArray(value)) return value[tierIndex(weapon)] ?? value[value.length - 1];
  return value ?? 0;
}

function weaponCooldown(weapon) {
  const cooldown = weaponTierValue(weapon, "cooldown") / brotatoPercentMultiplier(effectiveStat("attackSpeed"));
  return Math.max(0.12, cooldown);
}

function weaponRange(weapon) {
  const profile = getWeaponStatProfile(weapon);
  const statRange = weaponTierValue(weapon, "range");
  if (profile.attackType === "swing") {
    return Math.max(42, statRange + effectiveStat("range") * 0.12);
  }
  return Math.max(100, statRange + effectiveStat("range") * 0.35);
}

function weaponProjectileSpeed(weapon) {
  return weaponTierValue(weapon, "projectileSpeed") + effectiveStat("range") * 0.04 + effectiveStat("engineering") * 4;
}

function weaponProjectileCount(weapon) {
  const profile = getWeaponStatProfile(weapon);
  if (profile.attackType === "swing") return 1;
  return Math.max(1, (profile.projectiles ?? 1) + state.player.projectiles - 1);
}

function weaponCritChance(weapon) {
  return Math.min(95, Math.max(0, effectiveStat("critChance") + weaponTierValue(weapon, "critChance")));
}

function weaponCritMultiplier(weapon) {
  return getWeaponStatProfile(weapon).critMultiplier ?? 2;
}

function weaponKnockback(weapon) {
  return weaponTierValue(weapon, "knockback");
}

function weaponPierce(weapon) {
  return Math.max(0, Math.floor(weaponTierValue(weapon, "pierce")));
}

function weaponSwingArc(weapon) {
  return weaponTierValue(weapon, "swingArc") || 1;
}

function weaponSwingDuration(weapon) {
  return weaponTierValue(weapon, "swingDuration") || 0.18;
}

function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function weaponShotDamage(weapon) {
  const profile = getWeaponStatProfile(weapon);
  let base = weaponTierValue(weapon, "baseDamage");
  const tierScaling = weaponTierStatScalingMultiplier(weapon);
  for (const [stat, scale] of Object.entries(profile.scaling ?? {})) {
    base += effectiveStat(stat) * scale * tierScaling;
  }
  return Math.max(1, base * brotatoPercentMultiplier(effectiveStat("damagePercent")));
}

function weaponBurnDps(weapon) {
  const profile = getWeaponStatProfile(weapon);
  if (!profile.burnBase) return 0;
  let burn = weaponTierValue(weapon, "burnBase");
  const tierScaling = weaponTierStatScalingMultiplier(weapon);
  for (const [stat, scale] of Object.entries(profile.burnScaling ?? {})) {
    burn += effectiveStat(stat) * scale * tierScaling;
  }
  return Math.max(0, burn * brotatoPercentMultiplier(effectiveStat("damagePercent")));
}

function weaponTierStatScalingMultiplier(weapon) {
  return [1, 1.45, 2.15, 3.2, 4.85][tierIndex(weapon)] ?? 1;
}

function effectiveStat(key) {
  return (state.player.stats[key] ?? 0) + ownedStatBonus(key) + (weaponClassBonusStats()[key] ?? 0);
}

function weaponClassBonusStats() {
  const bonuses = {};
  const counts = weaponTagCounts();
  for (const [tag, count] of Object.entries(counts)) {
    const bonus = weaponClassBonuses[tag];
    if (!bonus) continue;
    const tier = count >= 6 ? 3 : count >= 4 ? 2 : count >= 2 ? 1 : 0;
    if (tier > 0) {
      bonuses[bonus.stat] = (bonuses[bonus.stat] ?? 0) + bonus.amounts[tier];
    }
  }
  return bonuses;
}

function weaponTagCounts() {
  const counts = {};
  for (const weapon of state.weapons.slice(0, maxWeaponSlots())) {
    const points = weaponClassPointValue(weapon);
    for (const tag of getWeaponStatProfile(weapon).tags ?? []) {
      counts[tag] = (counts[tag] ?? 0) + points;
    }
  }
  return counts;
}

function weaponClassPointValue(weapon) {
  const tier = Math.min(MAX_WEAPON_RANK, Math.max(1, weapon.tier ?? 1));
  return 2 ** (tier - 1);
}

function applyBulletHit(bullet, enemy, enemyIndex) {
  enemy.hp -= bullet.damage;
  enemy.flashTimer = 0.09;
  trackDamage(bullet.weaponName, bullet.damage);
  playSfx(bullet.crit ? "crit" : "hit");
  if (bullet.crit) {
    addShake(1.6);
  }

  if (bullet.burnDps > 0) {
    enemy.burnDps = Math.max(enemy.burnDps ?? 0, bullet.burnDps);
    enemy.burnTime = Math.max(enemy.burnTime ?? 0, bullet.burnDuration);
  }

  const angle = Math.atan2(bullet.vy, bullet.vx);
  const push = (bullet.knockback ?? 0) * 12;
  enemy.knockX = (enemy.knockX ?? 0) + Math.cos(angle) * push;
  enemy.knockY = (enemy.knockY ?? 0) + Math.sin(angle) * push;

  const color = bullet.crit ? "#ffcf5d" : bullet.impactColor ?? "#fff0a8";
  burst(bullet.x, bullet.y, color, bullet.crit ? 9 : 5);
  addFloater(enemy.x, enemy.y - enemy.radius, bullet.crit ? `CRIT ${Math.round(bullet.damage)}` : Math.round(bullet.damage), {
    color: bullet.crit ? "#ffcf5d" : "#fff7e7",
    size: bullet.crit ? 17 : 14
  });

  if (state.player.lifeStealCooldown <= 0 && Math.random() * 100 < Math.min(60, effectiveStat("lifeSteal"))) {
    heal(1);
    state.player.lifeStealCooldown = 0.1;
  }

  if (enemy.hp <= 0) {
    killEnemy(enemyIndex);
    return true;
  }
  return false;
}

function explodeBullet(bullet) {
  const radius = bullet.explosionRadius ?? 0;
  if (radius <= 0) return;
  const multiplier = bullet.explosionDamageMultiplier ?? 1;
  addShake(Math.min(9, 3 + radius * 0.04));
  playSfx("explosion");
  spawnRing(bullet.x, bullet.y, bullet.impactColor ?? "#ff9c3d", radius * 1.4, 0.34);
  burst(bullet.x, bullet.y, bullet.impactColor ?? "#ff9c3d", Math.max(18, Math.round(radius * 0.35)));
  addFloater(bullet.x, bullet.y - radius * 0.25, "BOOM", { color: "#ffcf5d", size: 20, life: 0.58, riseSpeed: 55, fadePower: 1.25 });

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    const distance = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
    if (distance > radius + enemy.radius) continue;
    const falloff = clamp(1 - distance / (radius + enemy.radius), 0.35, 1);
    const damage = bullet.damage * multiplier * falloff;
    applyBulletHit({
      ...bullet,
      damage,
      knockback: (bullet.knockback ?? 0) * (0.65 + falloff * 0.6),
      x: enemy.x,
      y: enemy.y
    }, enemy, i);
  }

  for (let i = state.trees.length - 1; i >= 0; i -= 1) {
    const tree = state.trees[i];
    const distance = Math.hypot(tree.x - bullet.x, tree.y - bullet.y);
    if (distance > radius + tree.radius) continue;
    const falloff = clamp(1 - distance / (radius + tree.radius), 0.35, 1);
    damageTree(tree, bullet.damage * multiplier * falloff);
    burst(tree.x, tree.y, "#92d486", 6);
    if (tree.hp <= 0) {
      breakTree(i);
    }
  }
}

function shouldRemoveBulletAfterHit(bullet) {
  if ((bullet.pierce ?? 0) <= 0) {
    return true;
  }
  bullet.pierce -= 1;
  bullet.damage *= bullet.damageFalloff ?? 0.7;
  bullet.radius = Math.max(3.5, bullet.radius * 0.95);
  return false;
}

function damageTree(tree, damage) {
  if (state.treeOneShot) {
    tree.hp = 0;
    return;
  }
  tree.hp -= damage;
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    let hit = false;
    for (let t = state.trees.length - 1; t >= 0; t -= 1) {
      const tree = state.trees[t];
      const radius = bullet.radius + tree.radius;
      if (distSq(bullet, tree) <= radius * radius) {
        if (bullet.explosionRadius > 0) {
          explodeBullet(bullet);
        } else {
          damageTree(tree, bullet.damage);
        }
        hit = true;
        if (!bullet.explosionRadius) burst(bullet.x, bullet.y, "#92d486", 5);
        if (!bullet.explosionRadius && tree.hp <= 0) {
          breakTree(t);
        }
        break;
      }
    }

    if (hit) {
      state.bullets.splice(i, 1);
      continue;
    }

    for (let cr = state.crates.length - 1; cr >= 0; cr -= 1) {
      const crate = state.crates[cr];
      if (crate.broken) continue;
      const radius = bullet.radius + crate.radius;
      if (distSq(bullet, crate) <= radius * radius) {
        if (bullet.explosionRadius > 0) {
          explodeBullet(bullet);
        } else {
          damageCrate(crate, bullet.damage);
          burst(bullet.x, bullet.y, "#c79a5a", 5);
        }
        hit = true;
        if (!bullet.explosionRadius && crate.hp <= 0) {
          breakCrate(cr);
        }
        break;
      }
    }

    if (hit) {
      state.bullets.splice(i, 1);
      continue;
    }

    for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
      const enemy = state.enemies[j];
      if (bullet.hitEnemies?.has(enemy)) {
        continue;
      }
      const radius = bullet.radius + enemy.radius;
      if (distSq(bullet, enemy) <= radius * radius) {
        bullet.hitEnemies?.add(enemy);
        hit = true;
        if (bullet.explosionRadius > 0) {
          explodeBullet(bullet);
          break;
        }
        applyBulletHit(bullet, enemy, j);
        if (shouldRemoveBulletAfterHit(bullet)) {
          break;
        }
        hit = false;
      }
    }

    const expired = bullet.life <= 0 || bullet.x < -50 || bullet.x > W + 50 || bullet.y < -50 || bullet.y > H + 50;
    if (!hit && expired && bullet.explosionRadius > 0) {
      explodeBullet(bullet);
      hit = true;
    }

    if (hit || expired) {
      state.bullets.splice(i, 1);
    }
  }
}

function updateWeaponSwings(dt) {
  for (let i = state.swings.length - 1; i >= 0; i -= 1) {
    const swing = state.swings[i];
    swing.life -= dt;
    processWeaponSwingHits(swing);
    if (swing.life <= 0) {
      state.swings.splice(i, 1);
    }
  }
}

function processWeaponSwingHits(swing) {
  const geom = weaponSwingGeometry(swing);
  const hitWidth = 14;
  if (geom.progress > 0.74) return;
  if (swing.hits >= swing.maxHits) return;

  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    if (swing.hitEnemies.has(enemy)) continue;
    const distance = pointToSegmentDistance(enemy.x, enemy.y, geom.innerX, geom.innerY, geom.headX, geom.headY);
    if (distance > enemy.radius + hitWidth) continue;

    swing.hitEnemies.add(enemy);
    swing.hits += 1;
    applyBulletHit({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(geom.current),
      vy: Math.sin(geom.current),
      weaponName: swing.weaponName,
      damage: swing.damage,
      crit: swing.crit,
      burnDps: swing.burnDps,
      burnDuration: swing.burnDuration,
      knockback: swing.knockback,
      impactColor: swing.impactColor
    }, enemy, i);
    if (swing.hits >= swing.maxHits) break;
  }

  for (let i = state.trees.length - 1; i >= 0; i -= 1) {
    const tree = state.trees[i];
    if (swing.hitTrees.has(tree)) continue;
    const distance = pointToSegmentDistance(tree.x, tree.y, geom.innerX, geom.innerY, geom.headX, geom.headY);
    if (distance > tree.radius + hitWidth) continue;

    swing.hitTrees.add(tree);
    damageTree(tree, swing.damage);
    burst(tree.x, tree.y, "#92d486", 6);
    if (tree.hp <= 0) {
      breakTree(i);
    }
  }

  for (let i = state.crates.length - 1; i >= 0; i -= 1) {
    const crate = state.crates[i];
    if (crate.broken || swing.hitCrates.has(crate)) continue;
    const distance = pointToSegmentDistance(crate.x, crate.y, geom.innerX, geom.innerY, geom.headX, geom.headY);
    if (distance > crate.radius + hitWidth) continue;

    swing.hitCrates.add(crate);
    damageCrate(crate, swing.damage);
    burst(crate.x, crate.y, "#c79a5a", 6);
    if (crate.hp <= 0) {
      breakCrate(i);
    }
  }
}

function weaponSwingGeometry(swing) {
  const progress = clamp(1 - swing.life / swing.maxLife, 0, 1);
  const start = swing.startAngle ?? swing.angle - swing.arc / 2;
  const end = swing.endAngle ?? swing.angle + swing.arc / 2;
  const sweepProgress = clamp(progress / 0.72, 0, 1);
  // A short anticipation: the first ~14% of the swing winds slightly PAST the start angle
  // (a back-swing) before the main forward sweep, giving the club weight and follow-through
  // instead of a stiff, instant arc.
  const windup = progress < 0.14 ? -Math.sin(progress / 0.14 * Math.PI) * (end - start) * 0.12 : 0;
  const current = start + windup + (end - start) * easeOutCubic(sweepProgress);
  const extension = progress < 0.18
    ? easeOutCubic(progress / 0.18)
    : progress < 0.72
      ? 1
      : 1 - easeOutCubic((progress - 0.72) / 0.28) * 0.62;
  const reach = swing.range * extension;
  const weaponLength = meleeWeaponVisualLength(swing.weaponName, swing.tier ?? 1);
  const activeLength = Math.min(weaponLength, Math.max(16, reach));
  const gripPush = Math.max(0, reach - activeLength);
  const inner = gripPush + Math.min(12, activeLength * 0.28);
  const head = gripPush + activeLength;
  return {
    progress,
    current,
    reach,
    inner,
    gripPush,
    activeLength,
    weaponLength,
    innerX: swing.x + Math.cos(current) * inner,
    innerY: swing.y + Math.sin(current) * inner,
    headX: swing.x + Math.cos(current) * head,
    headY: swing.y + Math.sin(current) * head
  };
}

function meleeWeaponVisualLength(name, tier = 1) {
  if (name === "Stub Club") return 54 + Math.min(MAX_WEAPON_RANK, tier) * 3;
  return 56 + Math.min(MAX_WEAPON_RANK, tier) * 2;
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.0001) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
}

function playerHitRadius() {
  return state.player.radius + 7;
}

function updateEnemies(dt) {
  const player = state.player;
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    enemy.contactCooldown -= dt;
    enemy.actionCooldown -= dt;
    enemy.flashTimer = Math.max(0, (enemy.flashTimer ?? 0) - dt);
    enemy.fireAnim = Math.max(0, (enemy.fireAnim ?? 0) - dt);
    if (enemy.burnTime > 0 && enemy.burnDps > 0) {
      enemy.hp -= enemy.burnDps * dt;
      trackDamage("Burn", enemy.burnDps * dt);
      enemy.burnTime = Math.max(0, enemy.burnTime - dt);
      if (enemy.hp <= 0) {
        killEnemy(i);
        continue;
      }
      if (enemy.burnTime <= 0) {
        enemy.burnDps = 0;
      }
    }

    updateEnemyBehavior(enemy, dt);

    // Natural, slime-like motion: instead of snapping straight at the player every frame,
    // ease the actual movement velocity (mvx/mvy) toward the behavior's desired velocity
    // so turns are gradual, and add a gentle per-enemy sideways sway so paths meander
    // rather than beeline. Charge lunges keep their snap (they want to feel instant).
    enemy.mvx = enemy.mvx ?? enemy.vx;
    enemy.mvy = enemy.mvy ?? enemy.vy;
    const lunging = enemy.chargeTimer > 0;
    const ease = lunging ? 1 : 1 - Math.pow(0.0025, dt); // ~turn responsiveness
    enemy.mvx += (enemy.vx - enemy.mvx) * ease;
    enemy.mvy += (enemy.vy - enemy.mvy) * ease;

    let moveX = enemy.mvx;
    let moveY = enemy.mvy;
    if (!lunging) {
      // Sideways sway perpendicular to travel, small and slow, phase-offset per enemy.
      const spd = Math.hypot(enemy.mvx, enemy.mvy);
      if (spd > 1) {
        const nx = -enemy.mvy / spd, ny = enemy.mvx / spd;
        const sway = Math.sin(enemy.bob * 0.6 + (enemy.swayPhase ?? 0)) * spd * 0.16;
        moveX += nx * sway;
        moveY += ny * sway;
      }
    }

    enemy.x += (moveX + (enemy.knockX ?? 0)) * dt;
    enemy.y += (moveY + (enemy.knockY ?? 0)) * dt;
    enemy.knockX = (enemy.knockX ?? 0) * Math.pow(0.06, dt);
    enemy.knockY = (enemy.knockY ?? 0) * Math.pow(0.06, dt);
    enemy.bob += dt * 5;

    const overlap = playerHitRadius() + enemy.radius;
    if (distSq(player, enemy) < overlap * overlap) {
      if (enemy.contactCooldown <= 0) {
        damagePlayer(enemyContactDamage(enemy), enemy.x, enemy.y);
        enemy.contactCooldown = 0.48;
      }
    }
  }
}

function updateEnemyBehavior(enemy, dt) {
  const player = state.player;
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  const bufferBoost = isEnemyDrummerBuffed(enemy) ? DRUMMER_SPEED_MULTIPLIER : 1;
  let speed = enemy.speed * bufferBoost;

  if (enemy.behavior === "charge") {
    if (enemy.windupTimer > 0) {
      enemy.windupTimer -= dt;
      enemy.vx = 0;
      enemy.vy = 0;
      if (enemy.windupTimer <= 0) {
        enemy.chargeTimer = 0.42;
        enemy.lungeAngle = angle;
        enemy.actionCooldown = 2.35;
        burst(enemy.x, enemy.y, "#ffd15f", 9);
      }
      return;
    }

    if (enemy.chargeTimer > 0) {
      enemy.chargeTimer -= dt;
      speed *= 8.45;
      enemy.vx = Math.cos(enemy.lungeAngle) * speed;
      enemy.vy = Math.sin(enemy.lungeAngle) * speed;
      return;
    }

    if (enemy.actionCooldown <= 0 && distance < 380) {
      enemy.windupTimer = 0.52;
      enemy.lungeAngle = angle;
      burst(enemy.x, enemy.y, "#ffd15f", 5);
      enemy.vx = 0;
      enemy.vy = 0;
      return;
    }
    enemy.vx = Math.cos(angle) * speed;
    enemy.vy = Math.sin(angle) * speed;
    return;
  }

  if (enemy.behavior === "shoot") {
    const desired = 260;
    const direction = distance < desired ? angle + Math.PI : angle;
    const moveSpeed = distance < desired + 70 ? speed * 0.72 : speed;
    enemy.vx = Math.cos(direction) * moveSpeed;
    enemy.vy = Math.sin(direction) * moveSpeed;
    if (enemy.actionCooldown <= 0 && distance < 560) {
      shootEnemyProjectile(enemy, angle);
      enemy.actionCooldown = Math.max(0.75, 1.75 - state.wave * 0.025);
      enemy.fireAnim = 0.32;            // recoil/puff animation window
      enemy.fireAngle = angle;
    }
    return;
  }

  if (enemy.behavior === "fireball") {
    const desired = 310;
    const direction = distance < desired ? angle + Math.PI : angle;
    const moveSpeed = distance < desired + 90 ? speed * 0.65 : speed;
    enemy.vx = Math.cos(direction) * moveSpeed;
    enemy.vy = Math.sin(direction) * moveSpeed;
    if (enemy.actionCooldown <= 0 && distance < 590) {
      shootEnemyFireball(enemy, angle);
      enemy.actionCooldown = Math.max(1.35, 2.85 - state.wave * 0.035);
      enemy.fireAnim = 0.32;
      enemy.fireAngle = angle;
    }
    return;
  }

  if (enemy.behavior === "orbit") {
    const orbit = angle + Math.PI / 2;
    enemy.vx = Math.cos(angle) * speed * 0.68 + Math.cos(orbit) * speed * 1.12;
    enemy.vy = Math.sin(angle) * speed * 0.68 + Math.sin(orbit) * speed * 1.12;
    return;
  }

  if (enemy.behavior === "buffer") {
    enemy.vx = Math.cos(angle) * speed * 0.72;
    enemy.vy = Math.sin(angle) * speed * 0.72;
    return;
  }

  enemy.vx = Math.cos(angle) * speed;
  enemy.vy = Math.sin(angle) * speed;
}

function enemyContactDamage(enemy) {
  const multiplier = isEnemyDrummerBuffed(enemy) ? DRUMMER_DAMAGE_MULTIPLIER : 1;
  return Math.max(1, Math.round(enemy.damage * multiplier));
}

function isEnemyDrummerBuffed(enemy) {
  return state.enemies.some((other) => isDrummerBuffingEnemy(other, enemy));
}

function isDrummerBuffingEnemy(drummer, target) {
  if (drummer === target || drummer.behavior !== "buffer") {
    return false;
  }
  return distSq(drummer, target) < DRUMMER_BUFF_RADIUS * DRUMMER_BUFF_RADIUS;
}

function shootEnemyProjectile(enemy, angle) {
  state.enemyBullets.push({
    x: enemy.x + Math.cos(angle) * (enemy.radius + 8),
    y: enemy.y + Math.sin(angle) * (enemy.radius + 8),
    vx: Math.cos(angle) * 235,
    vy: Math.sin(angle) * 235,
    radius: 7,
    damage: Math.max(1, Math.round(enemyContactDamage(enemy) * 0.8)),
    life: 2.8
  });
  burst(enemy.x, enemy.y, "#66c7d8", 4);
}

function shootEnemyFireball(enemy, angle) {
  state.enemyBullets.push({
    kind: "fireball",
    x: enemy.x + Math.cos(angle) * (enemy.radius + 10),
    y: enemy.y + Math.sin(angle) * (enemy.radius + 10),
    vx: Math.cos(angle) * 132,
    vy: Math.sin(angle) * 132,
    radius: 10,
    damage: Math.max(1, Math.round(enemyContactDamage(enemy) * 0.8)),
    life: 4.4,
    spin: rand(0, Math.PI * 2)
  });
  burst(enemy.x, enemy.y, "#ff9c5b", 7);
}

function updateEnemyBullets(dt) {
  const player = state.player;
  for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.enemyBullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.kind === "fireball") {
      bullet.spin += dt * 5;
      if (Math.random() < 0.28) {
        state.particles.push({
          x: bullet.x - bullet.vx * 0.035 + rand(-4, 4),
          y: bullet.y - bullet.vy * 0.035 + rand(-4, 4),
          vx: rand(-18, 18),
          vy: rand(-18, 18),
          color: Math.random() < 0.5 ? "#ff9c5b" : "#5f3828",
          radius: rand(2, 4),
          life: rand(0.12, 0.26)
        });
      }
    }

    const radius = bullet.radius + playerHitRadius();
    if (distSq(bullet, player) <= radius * radius) {
      damagePlayer(bullet.damage, bullet.x, bullet.y);
      burst(bullet.x, bullet.y, bullet.kind === "fireball" ? "#ff9c5b" : "#66c7d8", bullet.kind === "fireball" ? 8 : 5);
      state.enemyBullets.splice(i, 1);
    } else if (bullet.life <= 0 || bullet.x < -60 || bullet.x > W + 60 || bullet.y < -60 || bullet.y > H + 60) {
      state.enemyBullets.splice(i, 1);
    }
  }
}

function updateCoins(dt) {
  const player = state.player;
  for (let i = state.coins.length - 1; i >= 0; i -= 1) {
    const coin = state.coins[i];
    const dx = player.x - coin.x;
    const dy = player.y - coin.y;
    const distance = Math.hypot(dx, dy);

    if (distance < player.pickupRange) {
      const pull = (1 - distance / player.pickupRange) * 520;
      coin.x += (dx / (distance || 1)) * pull * dt;
      coin.y += (dy / (distance || 1)) * pull * dt;
    }

    if (distance < player.radius + coin.radius) {
      state.scrap += coin.value;
      trackScrap(coin.value);
      playSfx("coin");
      burst(coin.x, coin.y, "#f2c45f", 5);
      state.coins.splice(i, 1);
    }
  }
}

function updateBulbs() {
  const player = state.player;
  for (let i = state.bulbs.length - 1; i >= 0; i -= 1) {
    const bulb = state.bulbs[i];
    const radius = player.radius + bulb.radius;
    if (distSq(player, bulb) <= radius * radius) {
      breakBulb(i);
    }
  }
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }

  for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
    const floater = state.floaters[i];
    floater.y -= (floater.riseSpeed ?? 42) * dt;
    floater.x += (floater.driftX ?? 0) * dt;
    floater.life -= dt;
    if (floater.life <= 0) {
      state.floaters.splice(i, 1);
    }
  }

  for (let i = state.zaps.length - 1; i >= 0; i -= 1) {
    const zap = state.zaps[i];
    zap.life -= dt;
    if (zap.life <= 0) {
      state.zaps.splice(i, 1);
    }
  }

  for (let i = state.ashes.length - 1; i >= 0; i -= 1) {
    const ash = state.ashes[i];
    ash.life -= dt;
    if (ash.life <= 0) {
      state.ashes.splice(i, 1);
    }
  }
}

function breakTree(index) {
  const tree = state.trees[index];
  state.trees.splice(index, 1);
  const scrap = 1 + Math.floor(state.wave / 5);
  state.coins.push({ x: tree.x, y: tree.y, radius: 8, value: scrap });
  playSfx("tree");
  burst(tree.x, tree.y, "#92d486", 18);
  // Trees always drop fruit now; crates spawn on their own in the arena instead.
  dropTreeFruit(tree);
  addFloater(tree.x, tree.y - tree.radius, "FRUIT");
}

function dropTreeFruit(tree) {
  state.bulbs.push({
    x: tree.x + rand(-10, 10),
    y: tree.y + rand(-8, 8),
    radius: 15,
    hp: 1,
    maxHp: 1,
    heal: 9 + state.wave,
    bob: Math.random() * Math.PI * 2
  });
}

// --- Crates: physical arena objects that spawn randomly, break when shot, and drop an
// item/weapon reward the player collects by walking over it. -----------------------

// Crates are rare early and ramp up with the wave. Each wave has a small BUDGET of how
// many crates may spawn total, plus a low cap on how many can be alive at once. Both grow
// slowly so wave 1 sees ~1 crate and late waves see several.
function crateWaveBudget() {
  // wave 1: 1, wave 3: 2, wave 6: 3, wave 10: 4, ... capped at 6
  return Math.min(6, 1 + Math.floor((state.wave - 1) / 2.5));
}
function crateLiveCap() {
  return Math.min(3, 1 + Math.floor(state.wave / 5));   // 1 early, up to 3 late
}
function crateSpawnInterval() {
  // long gaps early (~18s), tightening in later waves down to ~8s
  return Math.max(8, 20 - state.wave * 0.8);
}

function updateCrateSpawns(dt) {
  if (state.mode !== "playing") return;
  if ((state.crateBudget ?? 0) <= 0) return;             // wave's crate allowance spent
  state.crateSpawnTimer = (state.crateSpawnTimer ?? crateSpawnInterval()) - dt;
  if (state.crateSpawnTimer <= 0) {
    if (state.crates.length < crateLiveCap()) {
      spawnCrate();
      state.crateBudget -= 1;
    }
    state.crateSpawnTimer = crateSpawnInterval() * rand(0.8, 1.2);
  }
}

function spawnCrate() {
  const hp = 18 + state.wave * 3;
  state.crates.push({
    x: rand(110, W - 110),
    y: rand(120, H - 110),
    radius: 24,
    hp,
    maxHp: hp,
    broken: false,
    brokenTimer: 0,
    // Roll the loot now so the drop is deterministic once the crate is hit.
    item: rollUpgradeOffer(new Set(), 0, true),
    bob: Math.random() * Math.PI * 2,
    spawnPop: 0.3
  });
}

function damageCrate(crate, damage) {
  crate.hp -= damage;
  crate.flash = 0.08;
}

function breakCrate(index) {
  const crate = state.crates[index];
  crate.broken = true;
  crate.brokenTimer = 0.5;              // show the broken sprite briefly before the pop
  playSfx("tree");
  burst(crate.x, crate.y, "#c79a5a", 16);
  addFloater(crate.x, crate.y - crate.radius, "CRATE");
  // Spawn the collectible reward drop (magnet-collected like a coin).
  state.crateDrops.push({
    x: crate.x,
    y: crate.y - 6,
    radius: 16,
    item: crate.item,
    bob: Math.random() * Math.PI * 2,
    life: 0,
    ready: false                        // becomes collectible after the broken crate fades
  });
}

// Broken crates linger a moment (showing the open sprite), then are removed; their drop
// becomes collectible. Drops magnet toward the player and, on contact, hand the reward to
// the crate-reward flow so the player picks the item up mid-run.
function updateCrates(dt) {
  const player = state.player;
  for (let i = state.crates.length - 1; i >= 0; i -= 1) {
    const crate = state.crates[i];
    crate.bob += dt * 2.2;
    if (crate.flash > 0) crate.flash -= dt;
    if (crate.spawnPop > 0) crate.spawnPop -= dt;
    if (crate.broken) {
      crate.brokenTimer -= dt;
      if (crate.brokenTimer <= 0) {
        // reveal the drop and remove the crate shell
        const drop = state.crateDrops.find((d) => !d.ready && d.item === crate.item);
        if (drop) drop.ready = true;
        state.crates.splice(i, 1);
      }
    }
  }

  for (let i = state.crateDrops.length - 1; i >= 0; i -= 1) {
    const drop = state.crateDrops[i];
    drop.bob += dt * 3;
    drop.life += dt;
    if (!drop.ready) continue;
    const dx = player.x - drop.x;
    const dy = player.y - drop.y;
    const distance = Math.hypot(dx, dy);
    // magnet within pickup range (same feel as coins)
    if (distance < player.pickupRange) {
      const pull = (1 - distance / player.pickupRange) * 480;
      drop.x += (dx / (distance || 1)) * pull * dt;
      drop.y += (dy / (distance || 1)) * pull * dt;
    }
    if (distance < player.radius + drop.radius) {
      collectCrateDrop(drop);
      state.crateDrops.splice(i, 1);
    }
  }
}

function collectCrateDrop(drop) {
  // Don't apply the reward now — stash the crate's rolled item so that at wave end the
  // player gets a Take-or-discard-for-scrap choice (see continueRewards/showCrateReward).
  playSfx("coin");
  burst(drop.x, drop.y, "#ffd15f", 12);
  state.pendingCrateItems.push(drop.item);
  addFloater(drop.x, drop.y - 12, "CRATE");
}

function breakBulb(index) {
  const bulb = state.bulbs[index];
  state.bulbs.splice(index, 1);
  heal(bulb.heal);
  playSfx("heal");
  burst(bulb.x, bulb.y, "#ff8fa3", 15);
  addFloater(bulb.x, bulb.y - bulb.radius, `+${bulb.heal} HP`);
}

function killEnemy(index) {
  const enemy = state.enemies[index];
  state.enemies.splice(index, 1);
  state.waveKills += 1;
  state.runStats.kills += 1;
  playSfx("kill");
  addShake(Math.min(3, 0.8 + enemy.radius * 0.05));
  spawnRing(enemy.x, enemy.y, enemy.color, enemy.radius * 2.2);
  spawnEnemyDeath(enemy);
  const waveBonus = Math.random() < Math.min(0.5, state.wave * 0.025) ? 1 : 0;
  const luckBonus = Math.random() * 100 < Math.min(70, effectiveStat("luck") * 0.55) ? 1 : 0;
  const value = enemy.scrap + waveBonus + luckBonus;
  state.coins.push({
    x: enemy.x,
    y: enemy.y,
    radius: 8,
    value
  });
  burst(enemy.x, enemy.y, enemy.color, 10);
}

function burst(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(45, 150);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      radius: rand(2, 5),
      life: rand(0.18, 0.48)
    });
  }
}

function addFloater(x, y, text, options = {}) {
  state.floaters.push({
    x,
    y,
    text,
    color: options.color ?? "#fff7e7",
    size: options.size ?? 15,
    life: options.life ?? 0.42,
    maxLife: options.life ?? 0.42,
    riseSpeed: options.riseSpeed ?? 42,
    driftX: options.driftX ?? 0,
    fadePower: options.fadePower ?? 1,
    scaleOut: options.scaleOut ?? 0
  });
}
