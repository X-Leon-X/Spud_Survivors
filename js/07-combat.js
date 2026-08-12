"use strict";

// combat.js - simulation update loop: enemies, weapons, pickups

// Shared with js/08-render.js (loads after this file): how long a Darter telegraphs
// before lunging. Single source of truth so the sim timer and the render-side warning
// strobe/stretch can never drift out of sync with each other.
const DARTER_WINDUP = 0.78;

// Shared with js/08-render.js: Thistle's arming delay (red warning telegraph) before it can
// fire, and Gravebloom's summon cast time / the damage threshold that interrupts it.
// Scales the spawn weight of ranged enemies (Spitter, Ember Glob) only: 15% FEWER ranged
// enemies, i.e. 15% off their own count, not 15 percentage points of the whole wave. Total
// enemy count is untouched -- the trimmed share is simply rolled into melee instead.
const RANGED_SHARE_TRIM = 0.85;

// Per-wave spawn-rate multipliers for the opening waves ONLY. Anything not listed here uses
// 1 (unchanged), so waves 1 and 4+ keep their exact original pacing. Wave 3's early-game
// boost lives here rather than in the batch size because a whole extra body per batch there
// would push wave 3 past wave 4 and invert the difficulty curve.
const EARLY_WAVE_SPAWN_RATE = { 2: 1.18, 3: 1.22 };

// How long an individual enemy waits before it can touch you again. Kept at 0.48s: the
// player-wide window in damagePlayer is the real rate limiter in a crowd, so raising this
// only weakens the 1-2 enemy case and makes the game easier, never harder.
const ENEMY_CONTACT_COOLDOWN = 0.48;

const TURRET_ARM_TIME = 5;
const GRAVEBLOOM_CAST_TIME = 2.4;
const GRAVEBLOOM_INTERRUPT_DAMAGE_FRACTION = 0.22; // taking >=22% of max HP during the cast cancels it
const POISON_POOL_LIFE = 5;
const POISON_POOL_TICK = 0.55;
// Pool damage per tick, before armor. Raised hard from 3 + wave*0.35: armor is applied on
// top of this (15/(15+armor)), so the old numbers landed at 2-3 per tick for an armored
// player and the pool read as a cosmetic puddle. At these values a full 5s pool costs a
// meaningful chunk of HP -- it is the Blight Sac's whole identity, and it should hurt enough
// that you actually move.
const POISON_POOL_BASE = 8;
const POISON_POOL_SCALE = 0.6;

// Blight Sac poisons on CONTACT as well as on death. Deliberately lighter than its death
// pool: this stacks on top of the contact hit that delivered it, and reapplying refreshes
// rather than stacks (see applyPlayerBurn), so a long touch is a slow drain, not a spike.
// Touch poison. Also raised: at 2 + wave*0.18 an armored player took 1-2 per tick, which is
// indistinguishable from nothing. Still lighter than the death pool, since this comes free
// with a contact hit rather than requiring you to stand in something.
const BLIGHT_TOUCH_TICKS = 4;
function blightTouchTickDamage() {
  return Math.max(2, Math.round(5 + state.wave * 0.4));
}

// Ember Glob's fireball sets you alight. Scales a little harder than the Blight Sac's touch
// poison because it has to be aimed and can be dodged, whereas walking into a sac cannot.
function emberBurnTickDamage() {
  return Math.max(2, Math.round(3 + state.wave * 0.25));
}

function update(dt) {
  if (typeof resolveBossFightEnding === "function") resolveBossFightEnding();
  decayFx(dt);
  if (state.mode === "bagging") {
    updateBagCollection(dt);
    updateParticles(dt);
    updateHud();
    return;
  }

  if (state.mode !== "playing") {
    // Keep the death headstone's rise animating after the run ends — everything else in
    // update() is gated off, so this needs its own tick.
    if (state.mode === "gameover") {
      state.graveTimer = (state.graveTimer ?? 0) + dt;
      updateParticles(dt);
    }
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
  tickPlayerBurn(dt);
  regeneratePlayer(dt);

  movePlayer(dt);
  // BOSS SYSTEM: normal wave spawning is suppressed during a boss fight -- the Nibbler King
  // summons its own adds (see the "summonNibblers"/"nibblerLaunch" attacks below), so the
  // regular swarm spawner must not also be dumping enemies into the arena on top of that.
  if (!state.bossFight) {
    spawnWaveEnemies(dt);
  } else {
    updateBossFight(dt);
  }
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
  updateFortuneCookies(dt);
  updatePoisonPools(dt);
  updateParticles(dt);

  if (state.player.hp <= 0) {
    state.mode = "gameover";
    if (typeof checkAchievements === "function") checkAchievements();
    if (typeof unlockAchievement === "function") unlockAchievement("rip");
    playSfx("gameover");
    addShake(12, true);
    burst(state.player.x, state.player.y, "#ff8fa3", 26);
    spawnRing(state.player.x, state.player.y, "#ff8fa3", 90, 0.5);
    // Bong + gravestone first, then the summary — showing the stats immediately would
    // step on the death beat.
    const fallen = state.character?.name ?? "Spud";
    playGravestone(fallen + " — wave " + state.wave, showSummary);
  } else if (state.bossFight) {
    // BOSS SYSTEM: the boss wave never ends on the waveTime timer (see startBossFight, which
    // freezes/hides the timer display). It ends ONLY when the Nibbler King dies -- handled by
    // killBossEnemy(), called from killEnemy() below once the boss's hp hits 0.
    //
    // SOFT-LOCK SAFETY: if a boss fight is flagged active but no boss instance actually exists
    // in state.enemies (it despawned some other way, failed to spawn, or was removed by code
    // this feature doesn't know about), waiting forever for a death event that can never fire
    // would permanently strand the player. Detect that and end the fight defensively.
    const bossAlive = state.enemies.some((e) => e.behavior === "boss");
    if (!bossAlive) {
      endBossFight(true);
    }
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
  checkGravebloomInterrupt(target);
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
      checkGravebloomInterrupt(enemy);
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
  let spawned = 0;
  while (spawned < count) {
    if (state.enemies.length >= activeCap) {
      break;
    }
    // Darters are meant to feel like a pack, not scattered loners. When one is rolled,
    // pull 1-2 more copies from this same spawn call and drop the whole cluster on one
    // shared edge instead of independently re-rolling chooseEnemyType() per member (which
    // would scatter them across edges). Each clustered member still consumes one slot from
    // the wave's spawn batch, so a Darter roll never inflates total enemy count/difficulty
    // beyond what the batch size already budgeted.
    const template = chooseEnemyType();
    if (template.name === "Darter") {
      const remaining = count - spawned;
      const clusterSize = Math.min(remaining, 2 + Math.floor(Math.random() * 2)); // 2-3
      spawnCluster(template, clusterSize, activeCap);
      spawned += clusterSize;
    } else if (template.behavior === "turret") {
      // Thistle is a rooted turret — it must appear INSIDE the arena (never at the edges
      // like every other spawn) and away from the player so it doesn't ambush on arrival.
      spawnEnemy(template, rollTurretSpawnPos());
      spawned += 1;
    } else {
      spawnEnemy(template);
      spawned += 1;
    }
  }
}

// Picks an in-arena position for a Thistle: clear of the walls, and at least
// TURRET_MIN_PLAYER_DIST from the player so it can't plant itself on top of them.
const TURRET_MIN_PLAYER_DIST = 260;
function rollTurretSpawnPos() {
  const player = state.player;
  const margin = 70;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const x = rand(margin, W - margin);
    const y = rand(margin, H - margin);
    if (distSq({ x, y }, player) >= TURRET_MIN_PLAYER_DIST * TURRET_MIN_PLAYER_DIST) {
      return { x, y };
    }
  }
  // Fallback if every attempt landed too close (small arena / player near centre): push the
  // last roll directly away from the player instead of giving up and spawning on top of them.
  const angle = rand(0, Math.PI * 2);
  return {
    x: clamp(player.x + Math.cos(angle) * TURRET_MIN_PLAYER_DIST, margin, W - margin),
    y: clamp(player.y + Math.sin(angle) * TURRET_MIN_PLAYER_DIST, margin, H - margin)
  };
}

// Spawns `size` copies of `template` together on one randomly chosen screen edge, offset
// along that edge so they don't perfectly overlap. Stops early if the active enemy cap
// is hit mid-cluster.
function spawnCluster(template, size, activeCap) {
  const side = Math.floor(Math.random() * 4);
  const margin = 42;
  const spacing = 34;
  // Pick the cluster's centre far enough from the corners that every member's offset still
  // fits on the edge. Clamping each member individually instead would collapse the whole
  // pack onto one point whenever the centre landed near a corner.
  const span = (size - 1) * spacing;
  const vertical = side === 0 || side === 1;
  const limit = vertical ? H : W;
  const centre = rand(Math.min(span / 2, limit / 2), Math.max(limit - span / 2, limit / 2));
  for (let i = 0; i < size; i += 1) {
    if (state.enemies.length >= activeCap) {
      break;
    }
    const along = centre + (i - (size - 1) / 2) * spacing;
    let x;
    let y;
    if (side === 0) {
      x = -margin;
      y = along;
    } else if (side === 1) {
      x = W + margin;
      y = along;
    } else if (side === 2) {
      x = along;
      y = -margin;
    } else {
      x = along;
      y = H + margin;
    }
    spawnEnemy(template, { x, y });
  }
}

function enemySpawnInterval() {
  const wave = Math.max(1, state.wave);
  const elapsedRatio = state.waveDuration
    ? clamp((state.waveDuration - state.waveTime) / state.waveDuration, 0, 1)
    : 0;
  // Enemies are individually squishier now, so the pressure comes from VOLUME instead:
  // roughly 2.8x the throughput of the old curve. Carving a path through a thick crowd is
  // the point, and a faster trickle keeps kills landing constantly.
  const wavePressure = Math.pow(1.26, wave - 1) * (1 + Math.max(0, wave - 6) * 0.05 + Math.max(0, wave - 13) * 0.05);
  const lateWavePush = 1 + elapsedRatio * Math.min(0.4, wave * 0.02);
  // Waves 2-3 only: spawn a bit faster so the opening isn't sparse. Applied here rather than
  // as a batch bonus so wave 3 stays below wave 4's throughput instead of leapfrogging it.
  const earlyPush = EARLY_WAVE_SPAWN_RATE[wave] ?? 1;
  return Math.max(0.09, 1.30 / Math.min(15.5, wavePressure * lateWavePush * earlyPush));
}

function enemySpawnBatchSize() {
  const wave = Math.max(1, state.wave);
  // Bigger early batches (kicks in from wave 2 instead of 3, steeper exponent).
  const growth = Math.floor(Math.pow(Math.max(0, wave - 1), 1.22) / 2.3);
  const midBonus = Math.floor(Math.max(0, wave - 8) / 3);
  const lateBonus = Math.floor(Math.max(0, wave - 13) / 2);
  // Pet Alien (and anything else granting extraEnemies) thickens every wave slightly. The
  // cap still applies, so it makes waves arrive denser rather than uncapping the arena.
  const owned = calculateOwnedUpgradeEffects().extraEnemies ?? 0;
  const batch = 1 + growth + midBonus + lateBonus + owned + earlyWaveEnemyBonus(wave);
  // CLOWN fortune clownWave: every base spawn is a Clown, and each Clown death implodes into
  // ~7 bodies (spawnClownImplosion, ~2340 below) on top of MAX_ENEMIES=480 already guarding the
  // total. An all-Clown wave at the normal batch size is a huge, unintended density spike --
  // roughly halving the batch here keeps the wave chaotic (still visibly "everything is a
  // Clown") without the implosion math turning it lethal instead of funny.
  if (typeof tempFlag === "function" && tempFlag("clownWave")) {
    return Math.max(1, Math.round(batch / 2));
  }
  return Math.min(22, batch);
}

// Waves 2 and 3 ONLY: extra enemies per spawn batch. Wave 2 used to be the thinnest wave in
// the run, which made the opening drag; more bodies there means more scrap, so the player
// walks into wave 4 with a real build instead of one cheap item.
//
// Wave 2 gets the full +1 (it has the most room to grow). Wave 3 only gets the batch bonus
// via the interval instead -- a flat +1 there would push wave 3's throughput ABOVE wave 4's
// and invert the difficulty curve, which is exactly the "impacts later waves" problem this
// is meant to avoid. See EARLY_WAVE_SPAWN_RATE for wave 3's share.
//
// Deliberately a hard-coded window, not a curve: it must not leak into any other wave.
// enemyScaling() and enemyActiveCap() are untouched, so wave 4+ difficulty is unchanged.
function earlyWaveEnemyBonus(wave) {
  return wave === 2 ? 1 : 0;
}

function enemyActiveCap() {
  const wave = Math.max(1, state.wave);
  // Higher concurrent-enemy cap earlier, so the screen gets crowded sooner.
  const curve = 40 + wave * 17 + Math.pow(Math.max(0, wave - 3), 1.45) * 3.6 + Math.max(0, wave - 10) * 6.5;
  return Math.min(MAX_ENEMIES, Math.round(curve));
}

function spawnEnemy(presetTemplate, presetPos) {
  const template = presetTemplate || chooseEnemyType();
  // Meeting one is what unlocks its compendium page (see js/03b-compendium.js). Guarded so
  // spawning never depends on the compendium being loaded -- an enemy failing to spawn
  // because a cosmetic bestiary is missing would be a catastrophic trade.
  if (typeof markEnemyDiscovered === "function") {
    markEnemyDiscovered(template.name);
  }

  let x;
  let y;
  if (presetPos) {
    x = presetPos.x;
    y = presetPos.y;
  } else {
    const side = Math.floor(Math.random() * 4);
    const margin = 42;
    x = side === 0 ? -margin : side === 1 ? W + margin : rand(0, W);
    y = side === 2 ? -margin : side === 3 ? H + margin : rand(0, H);
  }
  const scaling = enemyScaling();
  const sizeHp = sizeHpMultiplier(template.size, state.wave);

  state.enemies.push({
    name: template.name,
    behavior: template.behavior,
    size: template.size,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: Math.round(template.hp * scaling.hp * sizeHp),
    maxHp: Math.round(template.hp * scaling.hp * sizeHp),
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
    mvy: 0,
    // Thistle: arms for TURRET_ARM_TIME after spawning, telegraphed in red, before it can
    // fire. Harmless (and inert to the field entirely) on every other enemy.
    armTimer: template.behavior === "turret" ? TURRET_ARM_TIME : 0,
    // Gravebloom: summon cast state. castTimer counts down the charge-up; castHpAtStart
    // is the HP snapshot taken when the cast begins so incoming damage during the cast can
    // be measured against the interrupt threshold.
    castTimer: 0,
    castHpAtStart: 0
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
  // Hard floor of 3: bushes are the between-fight breather and the fruit/scrap source, so
  // a wave should never open with a bare arena regardless of how the rolls land.
  return clamp(base + randomExtra + luckExtra, 3, 10);
}

function chooseEnemyType() {
  // CLOWN fortune clownWave: every spawn this wave is a Clown instead of the normal weighted
  // roll. Looked up by name rather than assumed to exist, so a future rename/removal of the
  // Clown template falls through to the normal roll instead of throwing. The implosion-only
  // density spike this causes is compensated in enemySpawnBatchSize() below, not here.
  if (typeof tempFlag === "function" && tempFlag("clownWave")) {
    const clownTemplate = enemyTypes.find((type) => type.name === "Clown");
    if (clownTemplate) return clownTemplate;
  }
  // spawnable:false marks templates that only exist so spawnEnemy can use them directly
  // (Clown Mid/Small, spawned by the Clown's death implosion) — the wave roll must never
  // pick them on its own.
  const available = enemyTypes.filter((type) => type.spawnable !== false && state.wave >= type.minWave);
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
  // Ranged enemies (Ember Glob "fireball", Spitter "shoot") are the ones that actually make
  // late waves feel unfair: melee pressure can be kited, but a crowd of ranged attackers
  // covers the whole arena and there is nowhere to stand. Their combined share used to
  // CLIMB from ~7% at wave 6 to ~11% by wave 20, because the fireball weight grew every 3
  // waves while everything else stayed flat. Both are now damped so the ranged share sits
  // roughly 3 points lower and stays flat instead of growing. Total enemy count is
  // untouched (that's enemySpawnInterval/BatchSize) -- the same swarm just skews melee.
  //
  // Weights are floats, not integers: chooseEnemyType does a plain weighted roll, and at
  // wave 6 one whole unit of weight is ~2.3% of the pool, far too coarse to express a 3
  // point cut. RANGED_SHARE_TRIM scales the ranged pool down smoothly instead.
  if (type.behavior === "fireball") {
    const grown = Math.min(3, type.weight + Math.floor(Math.max(0, state.wave - type.minWave) / 6));
    return grown * RANGED_SHARE_TRIM;
  }
  if (type.behavior === "shoot") {
    return Math.max(1, type.weight - 1) * RANGED_SHARE_TRIM;
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
  // HP compounds the whole way, but the rate STEPS DOWN in the late game rather than
  // stopping. Player power isn't unbounded (weapons cap at tier 5, six slots, stat gains
  // taper), so a flat compounding rate eventually outruns any build; but going fully linear
  // makes the late game feel like it stops scaling at all. Instead: 8.5% per wave through
  // wave ~14, then a gentler 3% per wave forever after. Still exponential, just a shallower
  // curve, with swarm size (see enemySpawnInterval) carrying the rest of the difficulty.
  // v0.19.0 late-wave scaling pass: lowered the compounding base (1.10 -> 1.085), moved the
  // taper start earlier (17 -> 13 growth-waves), and lowered the late exponent (1.04 -> 1.03)
  // so late waves stop compounding into absurd HP walls, while waves 1-10 are within ~1-3% of
  // the old curve (unchanged feel early). Approx multiplier: w1 1x, w5 1.4x, w10 2.1x, w15
  // 3.0x, w20 3.5x, w30 4.6x, w40 6.2x, w50 8.4x (was 1x/1.5x/2.4x/3.8x/5.5x/8.1x/12x/17.7x).
  const hpCompoundGrowth = Math.min(growth, 13);
  const hpLateGrowth = Math.max(0, growth - 13);
  const hp = Math.pow(1.085, hpCompoundGrowth) * Math.pow(1.03, hpLateGrowth);
  // Damage deliberately stays shallow and roughly unchanged from before: the goal is to
  // overwhelm the player with numbers and chip damage, not to let any single hit spike, so
  // relative damage between enemy types matters far more here than the absolute scalar.
  // v0.19.0: lateGame coefficient trimmed 0.028 -> 0.02 alongside the HP taper, so damage at
  // wave 50 is ~4.11x instead of ~4.41x (waves 1-10 identical, damage curve untouched there).
  return {
    hp,
    damage: 1 + growth * 0.03 + midGame * 0.02 + lateGame * 0.02,
    speed: 1 + Math.min(0.18, growth * 0.006)
  };
}

// Large enemies (Bruiser, Drummer) are meant to feel like they absorb noticeably more
// punishment than the swarm around them, and that gap should widen as the run goes on --
// otherwise a flat multiplier keeps them proportionally tanky but they still melt in
// absolute terms once player DPS has compounded for 15+ waves. Medium enemies get a
// smaller version of the same treatment; small enemies are the baseline swarm and get none.
function sizeHpMultiplier(size, wave) {
  const growth = Math.max(0, wave - 1);
  // Capped well below the old +220%: stacked on top of compounding HP it turned Bruisers
  // into 10k-HP walls that took ~5s to drop. They should still clearly outlast the swarm,
  // just not stall the run.
  if (size === "large") {
    return 1 + Math.min(1.1, growth * 0.05);
  }
  if (size === "medium") {
    return 1 + Math.min(0.5, growth * 0.022);
  }
  return 1;
}

// Weapons aim from their own orbiting slot position (see getWeaponSlotPosition), not the
// player centre. If each slot independently decided "no enemy in my range, fall back to a
// crate", a slot that has orbited to the far side of the player could lose its enemy just
// outside that slot's range while a crate underfoot stays well inside it — so one weapon
// peels off to hit the crate for a beat while every other weapon keeps firing on enemies.
// The fix: decide ONCE per frame, from the player's position, whether the fight is still
// "on" at all. Only when nothing is engaged does any slot consider destructibles; otherwise
// a slot with no enemy in reach simply holds fire instead of shooting the crate.
function destructiblesTargetable(player, weapons, count, weapon) {
  // Judged PER WEAPON against its own reach. A club with 56px range should not be frozen
  // just because a pistol across the loadout can see something 500px away -- it cannot
  // help in that fight, so it may as well smash the crate it is standing next to.
  // Long-range weapons still hold fire while anything is engaged, which is what stops
  // them peeling off mid-fight (see the orbit-slot note below).
  let reach;
  if (weapon) {
    reach = weaponRange(weapon) + 48;
  } else {
    let maxRange = 0;
    for (let index = 0; index < count; index += 1) {
      maxRange = Math.max(maxRange, weaponRange(weapons[index]));
    }
    // +48 covers the weapon orbit radius (slots sit ~36-45px out) so an enemy just past a
    // slot's own range, but still near the player, still counts as "engaged".
    reach = maxRange + 48;
  }
  return !findNearestEnemyFrom(player.x, player.y, reach);
}

function fireEquippedWeapons(dt) {
  const player = state.player;
  const now = performance.now();
  const count = Math.min(maxWeaponSlots(), state.weapons.length);
  for (let index = 0; index < count; index += 1) {
    const weapon = state.weapons[index];
    const allowDestructibles = destructiblesTargetable(player, state.weapons, count, weapon);
    weapon.fireCooldown = Math.max(0, (weapon.fireCooldown ?? 0) - dt);
    // Recoil springs back to 0 quickly (a snappy kick, not a slow drift).
    if (weapon.recoil > 0) weapon.recoil = Math.max(0, weapon.recoil - dt * 55);
    // Fire-animation clock, read by drawArenaWeapon for the per-weapon motion.
    if (weapon.fireAnim > 0) weapon.fireAnim = Math.max(0, weapon.fireAnim - dt);
    if (weapon.fireCooldown > 0) {
      continue;
    }
    // Thrown weapons (Shuriken) are a physical object: while the star is in the air it is
    // not in your hand, so it cannot be thrown again. The cooldown alone isn't enough --
    // a long flight can outlast it, and firing then would duplicate the weapon.
    if (weapon.airborne) {
      continue;
    }

    const slot = getWeaponSlotPosition(player, index, count, now);
    const range = weaponRange(weapon);
    const target = allowDestructibles
      ? findNearestEnemyFrom(slot.x, slot.y, range) ?? findNearestDestructibleFrom(slot.x, slot.y, range)
      : findNearestEnemyFrom(slot.x, slot.y, range);
    if (!target) {
      continue;
    }

    fireWeaponAttack(weapon, slot, target);
    weapon.fireCooldown = weaponCooldown(weapon);
  }
}

// How long each weapon's fire animation runs. Longer for weapons whose motion is a visible
// mechanical action (a crossbow reloading, a sling being re-drawn) and short for weapons
// that should just snap (fast pistols, thrown stars). Anything unlisted gets a brief default
// so adding a weapon never leaves it animation-less.
const WEAPON_FIRE_ANIM_TIME = {
  Slingshot: 0.34,                  // draw the band back, release, settle
  "Frost Bow": 0.42,                // longest: it visibly re-cocks between bolts
  "Seed Shotgun": 0.3,              // heavy double-barrel lurch
  "Grenade Launcher": 0.32,
  "Scrap Revolver": 0.26,           // cylinder kick
  Shuriken: 0.2,                    // quick flick
  "Rusty Pistol": 0.16,
  "Spark Peashooter": 0.16,
  "Twig Wand": 0.24,                // magical flourish
  "Tin Dragon Flamethrower": 0.12   // continuous spray, barely any per-shot motion
};

function weaponFireAnimTime(name) {
  return WEAPON_FIRE_ANIM_TIME[name] ?? 0.18;
}

function fireWeaponAttack(weapon, slot, target) {
  const profile = getWeaponStatProfile(weapon);
  if (profile.attackType === "swing") {
    fireSwingWeapon(weapon, slot, target);
    return;
  }
  fireWeaponFromSlot(weapon, slot, target);
}

// fireEquippedWeapons (owned by another agent) doesn't pass the weapon's slot index down,
// so recover it here by identity lookup. This lets the swing track the SAME slot every
// frame (see weaponSwingOrigin) without touching that function's signature.
function resolveWeaponSlotIndex(weapon) {
  const count = Math.min(maxWeaponSlots(), state.weapons.length);
  const index = state.weapons.indexOf(weapon);
  return { index: index >= 0 ? index : 0, count };
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
  // Per-weapon fire animation clock. Counts DOWN from fireAnimMax and drives a distinct
  // motion per weapon in drawArenaWeapon (draw-band stretch, reload dip, spin-up), so each
  // weapon reads as its own object instead of every gun sharing one generic kickback.
  weapon.fireAnim = weaponFireAnimTime(weapon.name);
  weapon.fireAnimMax = weapon.fireAnim;
  playSfx(
    weapon.name === "Tin Dragon Flamethrower"
      ? "flame"
      : weapon.name === "Grenade Launcher" || weapon.name === "Scrap Revolver"
        ? "shootHeavy"
        : "shoot"
  );
  // A thrown weapon IS the projectile, so exactly one leaves the hand no matter how many
  // extra projectiles the player has bought. Those instead become the mini stars that split
  // off it in flight (see spawnShurikenSplit), which keeps "+1 projectile" meaningful
  // without cloning the weapon itself out of thin air.
  const thrown = Boolean(profile.returns);
  if (thrown) {
    weapon.airborne = true;
  }
  const shots = thrown ? 1 : weaponProjectileCount(weapon);
  const spread = shots === 1 ? 0 : profile.spread;
  for (let i = 0; i < shots; i += 1) {
    const offset = (i - (shots - 1) / 2) * spread;
    const shotAngle = angle + offset;
    const crit = Math.random() * 100 < weaponCritChance(weapon);
    let baseDamage = weaponShotDamage(weapon);
    // Real multi-pellet weapons (e.g. Seed Shotgun) fire `shots` separate bullets per
    // trigger pull but must keep the same TOTAL damage per shot as a single-projectile
    // weapon would, including as +projectile items push `shots` up. So baseDamage is
    // divided by the actual shot count here (before crit, so crits still apply per-pellet)
    // and the result is clamped with the same Math.max(1, Math.round(...)) idiom used
    // elsewhere in this file to avoid 0-damage pellets when heavily stacked.
    if (profile.splitDamageAcrossProjectiles) {
      baseDamage = Math.max(1, Math.round(baseDamage / shots));
    }
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
      hitEnemies: new Set(),
      // Thrown-and-returning weapons (Shuriken). Driven by a profile flag rather than a
      // weapon-name check so any future boomerang weapon just sets `returns: true`.
      returns: Boolean(profile.returns),
      maxTravel: profile.returns ? weaponRange(weapon) : undefined,
      travelled: 0,
      returning: false,
      // Back-reference to the weapon that threw it, so catching the star can put it back in
      // the player's hand (clears weapon.airborne). Only set for thrown weapons.
      thrownBy: profile.returns ? weapon : undefined
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
  const { index: weaponIndex, count: slotCount } = resolveWeaponSlotIndex(weapon);

  state.swings.push({
    // Origin is re-resolved every frame from the player's CURRENT position via
    // weaponIndex/slotCount (see weaponSwingOrigin), so the club stays anchored to its
    // orbiting slot instead of detaching mid-swing if the player moves. x/y below are
    // only a same-frame fallback for anything reading them before the first update tick.
    x: slot.x,
    y: slot.y,
    weaponIndex,
    slotCount,
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
  checkGravebloomInterrupt(enemy);
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
  // Single tuning point for ALL weapon knockback (profiles feed their per-weapon numbers
  // through here), kept low so hits stagger enemies instead of punting them off-screen.
  const push = (bullet.knockback ?? 0) * 4.5 * enemyKnockbackResist(enemy);
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
  addShake(Math.min(9, 3 + radius * 0.04), true);
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

// A drop worth several scrap becomes several coins scattered around the drop point, so the
// pile reads as "that was worth a lot" at a glance. Coins are picked up individually and the
// pickup code only cares about `value`, so splitting is purely presentational.
//
// Capped at MAX_SCRAP_COINS: a late-wave Bruiser can drop double digits, and one sprite per
// scrap would be a heap of overlapping coins to draw and magnet for no extra readability.
// Past the cap the coins carry a larger value each, with the remainder on the last one so
// the total is always exact.
const MAX_SCRAP_COINS = 5;

function spawnScrapDrop(x, y, total) {
  const value = Math.max(0, Math.round(total));
  if (value <= 0) return;
  const count = Math.min(MAX_SCRAP_COINS, value);
  const per = Math.floor(value / count);
  for (let i = 0; i < count; i += 1) {
    // Last coin carries whatever the division left over, so no scrap is ever lost.
    const coinValue = i === count - 1 ? value - per * (count - 1) : per;
    // A single coin sits exactly on the drop point (unchanged from before). Multiple coins
    // scatter around it: an even ring with a little jitter so it looks dropped, not placed.
    let ox = 0;
    let oy = 0;
    if (count > 1) {
      const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
      const spread = rand(9, 18);
      ox = Math.cos(angle) * spread;
      oy = Math.sin(angle) * spread * 0.7;   // squashed: the arena is viewed at an angle
    }
    state.coins.push({
      x: clamp(x + ox, 12, W - 12),
      y: clamp(y + oy, 12, H - 12),
      radius: 8,
      value: coinValue
    });
  }
}

// A thrown weapon is only back in your hand once its star is gone. EVERY removal path must
// go through this, not just the end-of-throw one: a shuriken that hit a tree or a crate was
// being spliced out with `airborne` still set, which stranded that slot for the rest of the
// run and looked like "sometimes it doesn't come back".
function releaseThrownWeapon(bullet) {
  if (bullet?.thrownBy) bullet.thrownBy.airborne = false;
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
      releaseThrownWeapon(bullet);
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
      releaseThrownWeapon(bullet);
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

    // Thrown projectiles (the Shuriken) own their whole lifetime: updateReturningBullet
    // decides when the throw is spent, sheds the mini stars and hands the weapon back so it
    // can reload. It must run BEFORE the generic expiry check below, since that would
    // despawn the star without ever clearing `airborne`, stranding the slot permanently.
    if (bullet.returns) {
      if (updateReturningBullet(bullet, dt, hit)) {
        state.bullets.splice(i, 1);
      }
      continue;
    }

    const expired = bullet.life <= 0 || bullet.x < -50 || bullet.x > W + 50 || bullet.y < -50 || bullet.y > H + 50;
    if (!hit && expired && bullet.explosionRadius > 0) {
      explodeBullet(bullet);
      hit = true;
    }

    if (hit || expired) {
      releaseThrownWeapon(bullet);
      state.bullets.splice(i, 1);
    }
  }
}

// Drives a thrown projectile (the Shuriken). It flies out, pierces, and is done: at its
// range limit, pierce cap or the arena edge it vanishes and the weapon reloads. It is NOT
// a boomerang and never travels back, so there is no return phase to leak or strand.
// Returns true when the bullet is finished and should be removed.
function updateReturningBullet(bullet, dt, hitSomething) {
  bullet.travelled = (bullet.travelled ?? 0) + Math.hypot(bullet.vx, bullet.vy) * dt;
  const outOfRange = bullet.travelled >= (bullet.maxTravel ?? Infinity);
  const outOfPierce = bullet.hitEnemies ? bullet.hitEnemies.size > (bullet.pierce ?? 0) : false;
  const offArena = bullet.x < 0 || bullet.x > W || bullet.y < 0 || bullet.y > H;
  if (!(outOfRange || outOfPierce || offArena || bullet.life <= 0)) return false;

  // End of the throw. The star does NOT boomerang: it simply vanishes at the edge of its
  // range and the weapon spends its normal cooldown "reloading", then reappears in the
  // hand ready to be thrown again. Clearing `airborne` is what puts it back in the hand;
  // fireEquippedWeapons refuses to throw while it is set, and the weapon's own cooldown
  // (already ticking since the throw) is what gates the next one.
  if (bullet.thrownBy) bullet.thrownBy.airborne = false;
  // At the far end it sheds mini stars outward, which is where extra-projectile stats cash
  // out for a thrown weapon.
  spawnShurikenSplit(bullet);
  return true;
}

// At the top of its arc the thrown star sheds MINI stars sideways. The main star keeps
// flying and returns to the hand as normal; the minis are ordinary short-lived projectiles
// that do not return and do not re-enter the hand, so they can never be confused with the
// weapon itself. Their count comes from the player's extra-projectile stat, which is how a
// thrown weapon benefits from "+1 projectile" without duplicating the weapon.
function spawnShurikenSplit(bullet) {
  const extra = Math.max(0, (state.player.projectiles ?? 1) - 1);
  const minis = 2 + extra;                    // always sheds a pair, more with projectiles
  const baseAngle = Math.atan2(bullet.vy, bullet.vx);
  const speed = Math.hypot(bullet.vx, bullet.vy) * 0.82;
  for (let i = 0; i < minis; i += 1) {
    // Fan them perpendicular to travel, alternating sides so the spray stays symmetric.
    const side = i % 2 === 0 ? 1 : -1;
    const step = Math.floor(i / 2) + 1;
    const angle = baseAngle + side * (Math.PI / 2) * (0.55 + step * 0.16);
    state.bullets.push({
      x: bullet.x,
      y: bullet.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.max(2, bullet.radius * 0.6),
      damage: bullet.damage * 0.45,           // chip damage; the main star is the payload
      crit: false,
      burnDps: 0,
      burnDuration: 0,
      knockback: (bullet.knockback ?? 0) * 0.5,
      pierce: 1,
      damageFalloff: bullet.damageFalloff,
      explosionRadius: 0,
      explosionDamageMultiplier: 1,
      life: 0.42,
      weaponName: bullet.weaponName,
      color: bullet.color,
      impactColor: bullet.impactColor,
      scale: (bullet.scale ?? 1) * 0.55,
      hitEnemies: new Set(),
      // Explicitly NOT a returning projectile and NOT tied to the weapon.
      returns: false,
      isMiniShuriken: true
    });
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

  if (swing.hits < swing.maxHits) {
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
  }

  // Melee swings get a bonus chance to knock enemy projectiles clean out of the air.
  // This is deliberately NOT gated behind swing.hits/maxHits (it's a freebie, not a pierce
  // hit) and does not touch swing.hitEnemies or any other hit-tracking set.
  for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.enemyBullets[i];
    const distance = pointToSegmentDistance(bullet.x, bullet.y, geom.innerX, geom.innerY, geom.headX, geom.headY);
    if (distance > bullet.radius + hitWidth) continue;
    if (Math.random() > 0.45) continue;

    burst(bullet.x, bullet.y, "#ffd9a0", 5);
    state.enemyBullets.splice(i, 1);
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

// Re-anchors a swing's origin to its owning slot's CURRENT position every frame (instead
// of the position frozen at spawn), so a fast orbit or player movement mid-swing can't drag
// the club away from the body. Falls back to the frozen x/y if the slot can no longer be
// resolved (e.g. the weapon was unequipped mid-swing). The aimed angle is NOT touched here —
// direction stays locked at spawn; only the pivot point tracks the player.
function weaponSwingOrigin(swing) {
  if (swing.slotCount > 0) {
    const slot = getWeaponSlotPosition(state.player, swing.weaponIndex, swing.slotCount);
    return slot;
  }
  return swing;
}

function weaponSwingGeometry(swing) {
  const origin = weaponSwingOrigin(swing);
  const progress = clamp(1 - swing.life / swing.maxLife, 0, 1);
  const start = swing.startAngle ?? swing.angle - swing.arc / 2;
  const end = swing.endAngle ?? swing.angle + swing.arc / 2;
  // One clean weighty arc: a readable windup, a fast committed sweep, a gentle recovery.
  // Windup (0-20%) and recovery (82-100%) are separated from the sweep by a plateau-free
  // easing curve so the reach extension (below) can ramp WITH the sweep instead of
  // fighting it — the old timing extended reach during the back-swing, which read as
  // "stab and rotate at once" instead of one motion.
  const windupEnd = 0.2;
  const sweepEnd = 0.82;
  const sweepProgress = clamp((progress - windupEnd) / (sweepEnd - windupEnd), 0, 1);
  const windup = progress < windupEnd
    ? -Math.sin(progress / windupEnd * Math.PI * 0.5) * (end - start) * 0.16
    : 0;
  const current = start + windup + (end - start) * easeOutCubic(sweepProgress);
  const extension = progress < windupEnd
    ? 0.25 + easeOutCubic(progress / windupEnd) * 0.15
    : progress < sweepEnd
      ? 0.4 + easeOutCubic((progress - windupEnd) / (sweepEnd - windupEnd)) * 0.6
      : 1 - easeOutCubic((progress - sweepEnd) / (1 - sweepEnd)) * 0.55;
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
    x: origin.x,
    y: origin.y,
    innerX: origin.x + Math.cos(current) * inner,
    innerY: origin.y + Math.sin(current) * inner,
    headX: origin.x + Math.cos(current) * head,
    headY: origin.y + Math.sin(current) * head
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

// --- Enemy separation ------------------------------------------------------------------
// Enemies push each other apart instead of stacking on one point. This is ordinary
// separation steering (the same collision relaxation used for crowds and unit formations
// everywhere), and it fixes a real gameplay problem: without it, 62 enemies were touching
// the player at wave 3 and ~290 by wave 15, all occupying the same pixel. That is why
// contact damage needs player-wide i-frames to stay survivable, and why a crowd reads as
// one blob rather than a mass of bodies.
//
// Done with a uniform SPATIAL GRID, not all-pairs. At the 480-enemy cap, comparing every
// pair is 115,200 checks per frame -- exactly the O(n^2) trap that made the Drummer buff
// cost a whole frame. Bucketing by cell means each enemy only tests the handful of
// neighbours actually near it, which is linear in practice.
// Cell must be >= the largest minDist so the 3x3 neighbourhood can't miss an overlap.
const SEPARATION_CELL = 48;
// Push has to out-muscle the chase force or enemies simply walk back into each other:
// a Nibbler chases at 106 px/sec, so a weak nudge is erased the same frame it is applied.
const SEPARATION_STRENGTH = 210;
// Extra shove applied to enemies already touching the player, so the front rank can't be
// packed infinitely deep by the ranks behind it pressing forward.
const SEPARATION_PASSES = 2;
let separationGrid = new Map();

// Several relaxation passes per frame. One pass only resolves the worst overlap of each
// pair; in a dense crowd an enemy is squeezed by several neighbours at once and a single
// pass leaves it still buried. Two cheap passes unpack the crowd far better than one strong
// one, which would instead make enemies visibly jitter.
function applyEnemySeparation(dt) {
  for (let pass = 0; pass < SEPARATION_PASSES; pass += 1) {
    separationPass(dt / SEPARATION_PASSES);
  }
}

function separationPass(dt) {
  const enemies = state.enemies;
  if (enemies.length < 2) return;

  separationGrid.clear();
  // Numeric cell keys, not "x,y" strings: building ~480 strings per pass twice a frame was
  // a measurable share of this function's cost. The +4096 bias keeps cells with negative
  // coordinates (enemies just outside the arena) from colliding with positive ones.
  for (let i = 0; i < enemies.length; i += 1) {
    const e = enemies[i];
    const key = (((e.y / SEPARATION_CELL) | 0) + 4096) * 8192 + (((e.x / SEPARATION_CELL) | 0) + 4096);
    let cell = separationGrid.get(key);
    if (!cell) separationGrid.set(key, (cell = []));
    cell.push(e);
  }

  for (let i = 0; i < enemies.length; i += 1) {
    const a = enemies[i];
    const cx = (a.x / SEPARATION_CELL) | 0;
    const cy = (a.y / SEPARATION_CELL) | 0;
    let pushX = 0;
    let pushY = 0;

    // Only the 3x3 neighbourhood can contain anything close enough to overlap.
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const cell = separationGrid.get(((cy + oy) + 4096) * 8192 + ((cx + ox) + 4096));
        if (!cell) continue;
        for (let j = 0; j < cell.length; j += 1) {
          const b = cell[j];
          if (b === a) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          // Near the full radius sum: at 0.78 bodies still buried most of the way into each
          // other and the crowd read as a single blob. A touch under 1 keeps sprites
          // slightly overlapping so a swarm still looks packed, not gridded.
          const minDist = (a.radius + b.radius) * 0.92;
          const distSquared = dx * dx + dy * dy;
          if (distSquared >= minDist * minDist || distSquared === 0) continue;
          const dist = Math.sqrt(distSquared) || 0.001;
          // Push hardest when fully overlapped, fading to nothing at the touch distance.
          const strength = (1 - dist / minDist) / dist;
          pushX += dx * strength;
          pushY += dy * strength;
        }
      }
    }

    if (pushX || pushY) {
      // Heavy enemies shove more than they get shoved, reusing the existing knockback
      // resistance so a Bruiser still bulls through a crowd instead of being jostled by it.
      const give = enemyKnockbackResist(a);
      a.x += pushX * SEPARATION_STRENGTH * give * dt;
      a.y += pushY * SEPARATION_STRENGTH * give * dt;
    }
  }
}

// CLOWN fortune armedEnemies -- CONTAINED implementation, not a full "every enemy gets proper
// ranged AI" pass. Enemies that already shoot (behaviors "shoot"/"fireball"/"turret") are left
// completely alone here, since giving them a second attack on top of their existing one would
// be the opposite of "mild". Every OTHER enemy instead gets an occasional weak poke via the
// existing shootEnemyProjectile() helper (js/07-combat.js:1935) reusing the Spitter's own bullet
// pipeline (so no new rendering/collision path is needed), on its own dedicated cooldown field
// (armedPokeCooldown) so it can never fight with that enemy's real actionCooldown/behavior. This
// does not change movement, contact damage, or any other AI -- purely an extra low-damage,
// low-frequency projectile layered on top. Reported as CONTAINED, not a full ranged rework.
function applyArmedEnemyPoke(enemy, dt, player) {
  if (enemy.behavior === "shoot" || enemy.behavior === "fireball" || enemy.behavior === "turret") return;
  enemy.armedPokeCooldown = (enemy.armedPokeCooldown ?? rand(1.2, 2.6)) - dt;
  if (enemy.armedPokeCooldown > 0) return;
  const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  if (distance > 420) {
    enemy.armedPokeCooldown = rand(0.3, 0.6); // re-check soon rather than parking a long cooldown while out of range
    return;
  }
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  shootEnemyProjectile(enemy, angle);
  // Mild by design: roughly a third of a Spitter's own poke damage, and a long ~3-4.5s cadence
  // per enemy so a whole armed crowd is a background threat, not a bullet-hell reskin.
  const bullet = state.enemyBullets[state.enemyBullets.length - 1];
  if (bullet) bullet.damage = Math.max(1, Math.round(bullet.damage / 3));
  enemy.armedPokeCooldown = rand(3, 4.5);
}

function updateEnemies(dt) {
  const player = state.player;
  // One pass up front instead of a full array scan per lookup - see refreshDrummerBuffs.
  refreshDrummerBuffs();
  applyEnemySeparation(dt);
  const armedEnemiesActive = typeof tempFlag === "function" && tempFlag("armedEnemies");
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
    if (armedEnemiesActive) applyArmedEnemyPoke(enemy, dt, player);

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
    // Cheap per-frame arena clamp for every enemy: knockback (especially the heavy hits that
    // shove a boss) can otherwise push an enemy clean off the visible arena. No extra margin
    // (unlike the player's +8) since enemies don't need breathing room from the wall.
    enemy.x = clamp(enemy.x, enemy.radius, W - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, H - enemy.radius);
    enemy.bob += dt * 5;

    const overlap = playerHitRadius() + enemy.radius;
    if (distSq(player, enemy) < overlap * overlap) {
      if (enemy.contactCooldown <= 0) {
        // NOTE: this deliberately keeps damagePlayer's player-wide hit cooldown rather than
        // bypassing it. Brotato can let every toucher land its own hit because its enemies
        // physically push each other apart, so only a handful reach you at once. Here they
        // stack on the same point -- measured 62 enemies touching at wave 3 and ~290 by wave
        // 15 -- so removing the shared window multiplies contact DPS by 23-110x and kills a
        // full-HP player in about three frames. The shared cooldown IS the balance.
        const connected = damagePlayer(enemyContactDamage(enemy), enemy.x, enemy.y, enemy.name);
        // Blight Sac is poisonous to the touch, not just on death. Only applied when the hit
        // actually lands -- damagePlayer returns false on a dodge or during i-frames, and a
        // blow that never connected should not poison you.
        if (connected && enemy.name === "Blight Sac") {
          applyPlayerBurn(BLIGHT_TOUCH_TICKS, blightTouchTickDamage(), "Blight Sac", "poison");
        }
        enemy.contactCooldown = ENEMY_CONTACT_COOLDOWN;
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
      enemy.windupTimer = DARTER_WINDUP;
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
      enemy.actionCooldown = Math.max(1.05, 2.35 - state.wave * 0.03);
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
      // Ember Globs should feel like a slow, telegraphed threat rather than chip damage
      // spam — much longer cooldown than Spitters so the big hit reads as "rare but scary".
      enemy.actionCooldown = Math.max(2.0, 3.8 - state.wave * 0.035);
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

  if (enemy.behavior === "turret") {
    // Rooted: never moves, arming or armed. armTimer counts down the red-telegraph window
    // (see drawEnemy) before it's allowed to shoot at all.
    enemy.vx = 0;
    enemy.vy = 0;
    if (enemy.armTimer > 0) {
      enemy.armTimer -= dt;
      return;
    }
    if (enemy.actionCooldown <= 0 && distance < 620) {
      shootEnemyProjectile(enemy, angle);
      enemy.actionCooldown = Math.max(1.1, 2.4 - state.wave * 0.03);
      enemy.fireAnim = 0.32;          // reuses the Spitter recoil pattern
      enemy.fireAngle = angle;
    }
    return;
  }

  if (enemy.behavior === "summoner") {
    // While casting, plant and rear up (see enemyLocomotion) rather than continuing to
    // chase — the cast is the whole telegraph, so it should read as a clear pause.
    if (enemy.castTimer > 0) {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.castTimer -= dt;
      if (enemy.castTimer <= 0) {
        completeGravebloomSummon(enemy);
      }
      return;
    }
    if (enemy.actionCooldown <= 0 && distance < 480 && state.enemies.length < MAX_ENEMIES) {
      enemy.castTimer = GRAVEBLOOM_CAST_TIME;
      enemy.castHpAtStart = enemy.hp;
      enemy.actionCooldown = rand(6, 9);
      burst(enemy.x, enemy.y, "#a98fd6", 8);
      enemy.vx = 0;
      enemy.vy = 0;
      return;
    }
    enemy.vx = Math.cos(angle) * speed * 0.85;
    enemy.vy = Math.sin(angle) * speed * 0.85;
    return;
  }

  // BOSS SYSTEM: the Nibbler King's movement/attacks are driven entirely by its own state
  // machine (updateNibblerKingBehavior, defined with the rest of the boss system further down
  // this file) rather than the generic per-behavior branches above -- a boss fight has its own
  // pacing (telegraph/strike/recover) that doesn't map onto any existing behavior.
  if (enemy.behavior === "boss") {
    updateNibblerKingBehavior(enemy, dt, angle, distance, speed);
    return;
  }

  enemy.vx = Math.cos(angle) * speed;
  enemy.vy = Math.sin(angle) * speed;
}

// Gravebloom's cast completing: spawns a small add (Nibbler or Skitter) next to it. Guarded
// by MAX_ENEMIES here too since some time may have passed since the cast started.
function completeGravebloomSummon(enemy) {
  if (state.enemies.length >= MAX_ENEMIES) return;
  const addTemplate = enemyTypes.find((type) => type.name === (Math.random() < 0.5 ? "Nibbler" : "Skitter"));
  const spawnAngle = rand(0, Math.PI * 2);
  const pos = {
    x: clamp(enemy.x + Math.cos(spawnAngle) * (enemy.radius + 20), 20, W - 20),
    y: clamp(enemy.y + Math.sin(spawnAngle) * (enemy.radius + 20), 20, H - 20)
  };
  spawnEnemy(addTemplate, pos);
  spawnRing(enemy.x, enemy.y, "#a98fd6", enemy.radius * 2, 0.3);
  burst(enemy.x, enemy.y, "#a98fd6", 12);
}

// Interrupts an in-progress Gravebloom cast if enough damage lands during it. Called from
// applyBulletHit/updateMeleePulse/updateEngineering wherever enemy.hp is reduced by the
// player — see those call sites for the hookup.
function checkGravebloomInterrupt(enemy) {
  if (enemy.behavior !== "summoner" || enemy.castTimer <= 0) return;
  const lost = enemy.castHpAtStart - enemy.hp;
  if (lost >= enemy.maxHp * GRAVEBLOOM_INTERRUPT_DAMAGE_FRACTION) {
    enemy.castTimer = 0;
    enemy.actionCooldown = Math.max(enemy.actionCooldown, 2.5); // brief breather before it can try again
    addFloater(enemy.x, enemy.y - enemy.radius - 10, "INTERRUPTED!", { color: "#ffd15f", size: 16, life: 0.9, riseSpeed: 60 });
    burst(enemy.x, enemy.y, "#ffd15f", 10);
  }
}

// How much of an incoming hit's knockback an enemy actually takes. Heavy enemies are meant
// to feel like they plant their feet: the Bruiser especially should keep walking through
// fire rather than being skated backwards, which also stops chip damage from trivially
// kiting it forever. Applied to weapon knockback only, not the Darter lunge.
function enemyKnockbackResist(enemy) {
  // The King is meant to feel weighty and immovable: 0.1 means it only takes ~10% of normal
  // knockback (90% resisted), noticeably more planted than even the Bruiser below.
  if (enemy.name === "Nibbler King") return 0.1;
  if (enemy.name === "Bruiser") return 0.25;
  if (enemy.size === "large") return 0.45;
  if (enemy.size === "medium") return 0.8;
  return 1;
}

function enemyContactDamage(enemy) {
  const multiplier = isEnemyDrummerBuffed(enemy) ? DRUMMER_DAMAGE_MULTIPLIER : 1;
  return Math.max(1, Math.round(enemy.damage * multiplier));
}

// Recomputes every enemy's "am I in a Drummer's aura" flag ONCE per frame, into
// enemy._drummerBuffed. This used to be resolved lazily by scanning the whole enemy array on
// every single lookup -- and it is looked up per enemy in updateEnemyBehavior, again in
// enemyContactDamage, and again in drawEnemy. That made it O(n^2) several times per frame:
// at the 480-enemy cap it was ~230k distance checks per pass and measured >20ms/frame on its
// own, which is the entire late-wave frame budget. Collecting the (usually 0-6) Drummers
// first and testing only against those makes it O(n * drummers), which is effectively linear.
function refreshDrummerBuffs() {
  const enemies = state.enemies;
  // Fast path: no Drummers on screen means nothing can be buffed.
  let drummers = null;
  for (let i = 0; i < enemies.length; i += 1) {
    if (enemies[i].behavior === "buffer") (drummers ??= []).push(enemies[i]);
  }
  if (!drummers) {
    for (let i = 0; i < enemies.length; i += 1) enemies[i]._drummerBuffed = false;
    return;
  }
  const radiusSq = DRUMMER_BUFF_RADIUS * DRUMMER_BUFF_RADIUS;
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    let buffed = false;
    for (let d = 0; d < drummers.length; d += 1) {
      const drummer = drummers[d];
      if (drummer === enemy) continue;
      const dx = drummer.x - enemy.x;
      const dy = drummer.y - enemy.y;
      if (dx * dx + dy * dy < radiusSq) {
        buffed = true;
        break;
      }
    }
    enemy._drummerBuffed = buffed;
  }
}

// Reads the per-frame flag set by refreshDrummerBuffs. Falls back to a live scan only for
// enemies that haven't been through a refresh yet (e.g. spawned mid-frame), so a freshly
// spawned enemy can never read a stale/undefined buff state.
function isEnemyDrummerBuffed(enemy) {
  if (enemy._drummerBuffed === undefined) {
    return state.enemies.some((other) => isDrummerBuffingEnemy(other, enemy));
  }
  return enemy._drummerBuffed;
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
    // Speed 235 -> 200 so the shot is readable and sidesteppable at range. Life raised
    // 2.8 -> 3.3 to preserve the old ~660 travel distance (235*2.8 ~= 200*3.3), otherwise
    // the nerf would quietly cut the Spitter's effective reach as well as its speed.
    vx: Math.cos(angle) * 200,
    vy: Math.sin(angle) * 200,
    radius: 7,
    damage: Math.max(1, Math.round(enemyContactDamage(enemy) * 0.8)),
    life: 3.3,
    sourceName: enemy.name,
    // Spitter and Thistle both shoot through this function, but they must not look alike:
    // the Spitter lobs a wet cyan glob, the Thistle fires a barbed green thorn. `kind`
    // selects the sprite in drawEnemyBullet.
    kind: enemy.behavior === "turret" ? "thorn" : "glob",
    spin: 0
  });
  burst(enemy.x, enemy.y, enemy.behavior === "turret" ? "#7fae5c" : "#66c7d8", 4);
}

function shootEnemyFireball(enemy, angle) {
  // Fireballs should hit harder than a Spitter shot (~8) despite Ember Glob's lower base
  // damage stat (5) — a 2.6x multiplier lands a direct hit around 13, clearly the biggest
  // single ranged hit in the game, matching how dangerous the projectile looks.
  // Speed dropped from 132 -> 100 so it's dodgeable at range; life raised from 4.4 -> 5.8
  // to keep the same ~580 travel distance (132*4.4 ~= 100*5.8) despite the slower speed.
  const fireballSpeed = 100;
  state.enemyBullets.push({
    kind: "fireball",
    x: enemy.x + Math.cos(angle) * (enemy.radius + 10),
    y: enemy.y + Math.sin(angle) * (enemy.radius + 10),
    vx: Math.cos(angle) * fireballSpeed,
    vy: Math.sin(angle) * fireballSpeed,
    radius: 12,
    damage: Math.max(1, Math.round(enemyContactDamage(enemy) * 2.6)),
    life: 5.8,
    spin: rand(0, Math.PI * 2),
    // A direct hit sets you ON FIRE for a few seconds on top of the impact damage.
    // burnTickDamage used to be a flat 3, which made it the only damage-over-time in the
    // game that never scaled: by wave 20 the poison pool ticked for ~10 while this still
    // ticked for 3, so the Ember Glob's signature effect quietly became irrelevant. Now it
    // scales with the wave like every other DoT, and slightly harder than poison since it
    // requires actually landing a dodgeable projectile.
    burnTicks: 3,
    burnTickDamage: emberBurnTickDamage(),
    burnKind: "burn",
    sourceName: enemy.name
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
      // Denser, hotter trail than before (0.4 -> 0.6 spawn chance, brighter colour mix,
      // slightly larger embers) so the fireball reads as visibly more dangerous than the
      // Spitter's plain glob at a glance, matching its ~3x higher damage.
      if (Math.random() < 0.6) {
        state.particles.push({
          x: bullet.x - bullet.vx * 0.035 + rand(-4, 4),
          y: bullet.y - bullet.vy * 0.035 + rand(-4, 4),
          vx: rand(-22, 22),
          vy: rand(-22, 22),
          color: Math.random() < 0.6 ? "#fff2a8" : "#ff6a3d",
          radius: rand(2.5, 6),
          life: rand(0.14, 0.34)
        });
      }
    }

    const radius = bullet.radius + playerHitRadius();
    if (distSq(bullet, player) <= radius * radius) {
      // Only apply the burn if the hit actually lands — damagePlayer returns false on
      // dodge/i-frames, and a "hit" that didn't connect shouldn't still set you on fire.
      const landed = damagePlayer(bullet.damage, bullet.x, bullet.y, bullet.sourceName);
      if (landed && bullet.burnTicks) {
        // Pass the flavour explicitly: applyPlayerBurn defaults to "burn", but relying on
        // the default would leave a previously-applied poison's colour/label in place if a
        // projectile ever forgot to set it.
        applyPlayerBurn(bullet.burnTicks, bullet.burnTickDamage, bullet.sourceName, bullet.burnKind ?? "burn");
      }
      if (landed) {
        burst(bullet.x, bullet.y, bullet.kind === "fireball" ? "#ff9c5b" : "#66c7d8", bullet.kind === "fireball" ? 8 : 5);
        state.enemyBullets.splice(i, 1);
        continue;
      }
      // Blocked by i-frames: the shot did NOT connect, so it must not be silently eaten.
      // Previously a 100-bullet volley all vanished for the damage of one, which is exactly
      // the "that made no sense" case. Now blocked bullets keep flying and can hit again a
      // moment later once the window expires -- so a real barrage costs you several hits
      // over a second instead of one, without the instant death of removing i-frames.
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
  spawnScrapDrop(tree.x, tree.y, scrap);
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
    // Scales harder than the old flat "9 + wave": late waves hit for far more and max HP
    // grows too, so a fixed-ish heal quietly became a rounding error. The percentage term
    // keeps fruit meaningful on a big health pool without making it dominant early.
    heal: Math.round(9 + state.wave * 2.2 + (state.player?.maxHp ?? 80) * 0.04),
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
  if (typeof unlockAchievement === "function") unlockAchievement("loot_box");
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
  const wasFull = state.player.hp >= state.player.maxHp;
  state.bulbs.splice(index, 1);
  heal(bulb.heal);
  playSfx("heal");
  burst(bulb.x, bulb.y, "#ff8fa3", 15);
  addFloater(bulb.x, bulb.y - bulb.radius, `+${bulb.heal} HP`);
  if (typeof unlockAchievement === "function") unlockAchievement("food");
  if (wasFull && state.runStats) {
    state.runStats.wastedApples = (state.runStats.wastedApples ?? 0) + 1;
    if (state.runStats.wastedApples >= 5 && typeof unlockAchievement === "function") {
      unlockAchievement("wasted");
    }
  }
}

function killEnemy(index) {
  const enemy = state.enemies[index];
  state.enemies.splice(index, 1);
  state.waveKills += 1;
  state.runStats.kills += 1;
  if (typeof checkAchievements === "function") checkAchievements();
  playSfx("kill");
  addShake(Math.min(3, 0.8 + enemy.radius * 0.05));
  spawnRing(enemy.x, enemy.y, enemy.color, enemy.radius * 2.2);
  spawnEnemyDeath(enemy);
  // BOSS SYSTEM: the Nibbler King's death is its own dedicated moment (bigger burst, its own
  // sfx cadence, generous scrap, then hands off to endBossFight -> the normal reward flow) --
  // see killBossEnemy below. It still falls through none of the ordinary per-enemy death hooks
  // (Husk split / poison pool / Clown implosion) since none of those apply to it.
  if (enemy.behavior === "boss") {
    killBossEnemy(enemy);
    return;
  }
  const waveBonus = Math.random() < Math.min(0.5, state.wave * 0.025) ? 1 : 0;
  const luckBonus = Math.random() * 100 < Math.min(70, effectiveStat("luck") * 0.55) ? 1 : 0;
  const value = enemy.scrap + waveBonus + luckBonus;
  spawnScrapDrop(enemy.x, enemy.y, value);
  // Fortune cookie: a flat 1% drop from ANY enemy, deliberately NOT luck-scaled so the
  // rate stays predictable. PLACEHOLDER — collecting it currently grants nothing; the
  // effect is still undecided, so this only wires up the drop, art and pickup.
  if (Math.random() < 0.01) {
    state.fortuneCookies.push({
      x: enemy.x,
      y: enemy.y,
      radius: 14,
      bob: Math.random() * Math.PI * 2,
      life: 0
    });
  }
  burst(enemy.x, enemy.y, enemy.color, 10);

  // --- Per-enemy death hooks (splitting, implosion, poison pool) -----------------------
  if (enemy.name === "Husk") {
    spawnHuskSplit(enemy);
  } else if (enemy.name === "Blight Sac") {
    spawnPoisonPool(enemy);
  } else if (enemy.name === "Clown" || enemy.name === "Clown Mid") {
    spawnClownImplosion(enemy);
  }
}

// Husk splits into 2 Nibblers on death, offset slightly so they don't spawn stacked.
// Guarded by MAX_ENEMIES so a screen already at the hard cap doesn't keep growing.
function spawnHuskSplit(enemy) {
  const nibblerTemplate = enemyTypes.find((type) => type.name === "Nibbler");
  if (!nibblerTemplate) return;
  // Three, not two: two made the Husk read as a wash (kill one, get two back), where three
  // makes it a genuine "this gets worse before it gets better" decision.
  for (let i = 0; i < 3; i += 1) {
    if (state.enemies.length >= MAX_ENEMIES) break;
    // Even spacing plus a jitter, so the trio fans out instead of clumping on one side.
    const spawnAngle = (i / 3) * Math.PI * 2 + rand(0, 0.8);
    const pos = {
      x: clamp(enemy.x + Math.cos(spawnAngle) * (enemy.radius + 16), 16, W - 16),
      y: clamp(enemy.y + Math.sin(spawnAngle) * (enemy.radius + 16), 16, H - 16)
    };
    spawnEnemy(nibblerTemplate, pos);
  }
}

// Clown implosion: base Clown -> 2 Clown Mid -> (each) 2 Clown Small, which die for real.
// Clown Small is intentionally excluded from the trigger above so it doesn't recurse.
function spawnClownImplosion(enemy) {
  const nextName = enemy.name === "Clown" ? "Clown Mid" : "Clown Small";
  const nextTemplate = enemyTypes.find((type) => type.name === nextName);
  if (!nextTemplate) return;
  for (let i = 0; i < 2; i += 1) {
    if (state.enemies.length >= MAX_ENEMIES) break;
    const spawnAngle = rand(0, Math.PI * 2);
    const pos = {
      x: clamp(enemy.x + Math.cos(spawnAngle) * (enemy.radius + 14), 14, W - 14),
      y: clamp(enemy.y + Math.sin(spawnAngle) * (enemy.radius + 14), 14, H - 14)
    };
    spawnEnemy(nextTemplate, pos);
  }
}

// Blight Sac leaves a lingering poison pool where it died — see updatePoisonPools for the
// tick-damage/lifetime handling and js/08-render.js drawPoisonPool for the visual.
// state.poisonPools is initialised in freshState() and cleared in endWave() (js/04-flow.js)
// alongside the other wave-scoped arrays; the lazy-init below is just a safety net.
function spawnPoisonPool(enemy) {
  if (!state.poisonPools) state.poisonPools = [];
  state.poisonPools.push({
    x: enemy.x,
    y: enemy.y,
    radius: enemy.radius * 1.7,
    life: POISON_POOL_LIFE,
    maxLife: POISON_POOL_LIFE,
    tickTimer: 0,
    bob: Math.random() * Math.PI * 2
  });
}

// Magnet-collected like a coin. Kept in its own array rather than reusing state.coins so
// the cookie can grow a real effect later without entangling it with the scrap economy.
function updateFortuneCookies(dt) {
  const player = state.player;
  for (let i = state.fortuneCookies.length - 1; i >= 0; i -= 1) {
    const cookie = state.fortuneCookies[i];
    cookie.bob += dt * 2.4;
    cookie.life += dt;
    const dx = player.x - cookie.x;
    const dy = player.y - cookie.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance < player.pickupRange) {
      const pull = (1 - distance / player.pickupRange) * 470;
      cookie.x += (dx / distance) * pull * dt;
      cookie.y += (dy / distance) * pull * dt;
    }
    if (distance < player.radius + cookie.radius) {
      // Roll the fortune at pickup so the outcome is locked in the moment it is collected.
      // If js/03d-fortunes.js somehow failed to load, leave the cookie in the arena rather
      // than consuming it into nothing -- a silently vanishing pickup is worse than one the
      // player can walk over again once the script is there. The feedback lives inside the
      // guard too, so an unconsumed cookie doesn't retrigger the sfx every frame on overlap.
      if (typeof rollFortune === "function") {
        playSfx("coin");
        burst(cookie.x, cookie.y, "#ffd873", 14);
        addFloater(cookie.x, cookie.y - 16, "Fortune Cookie!", { color: "#ffd873", size: 19, life: 1.5 });
        addFloater(cookie.x, cookie.y + 2, "Saved for after the wave", { color: "#bfe6b0", size: 13, life: 1.5 });
        if (!state.pendingFortunes) state.pendingFortunes = [];
        state.pendingFortunes.push(rollFortune());
        state.fortuneCookies.splice(i, 1);
      }
    }
  }
}

// Ticks pool lifetime and damages the player on a cooldown (not every frame) while they
// stand in the pool. Mirrors updateFortuneCookies' structure/array ownership pattern.
function updatePoisonPools(dt) {
  if (!state.poisonPools) return;
  const player = state.player;
  for (let i = state.poisonPools.length - 1; i >= 0; i -= 1) {
    const pool = state.poisonPools[i];
    pool.bob += dt * 2;
    pool.life -= dt;
    pool.tickTimer = Math.max(0, pool.tickTimer - dt);
    if (pool.life <= 0) {
      state.poisonPools.splice(i, 1);
      continue;
    }
    const radius = pool.radius + playerHitRadius();
    if (pool.tickTimer <= 0 && distSq(pool, player) <= radius * radius) {
      // damagePlayer already raises its own "-N" floater on a successful hit, so no need
      // to duplicate it here.
      //
      // ignoreCooldown is essential here: while you are standing in a pool you are almost
      // always being touched by something too, and the shared 0.22s i-frame window meant
      // whichever landed first ate the other. The pool has its OWN 0.55s tick timer, so it
      // is already rate-limited -- the shared window was double-limiting it down to near
      // nothing, which is why it felt like standing in poison barely mattered.
      const tickDamage = Math.max(1, Math.round(POISON_POOL_BASE + state.wave * POISON_POOL_SCALE));
      damagePlayer(tickDamage, pool.x, pool.y, "Poison Pool", { ignoreCooldown: true });
      pool.tickTimer = POISON_POOL_TICK;
    }
  }
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

// =====================================================================================
// BOSS SYSTEM -- the Nibbler King. A boss fight is INTERSTITIAL: it happens between two
// normal waves and does not itself consume a wave number (see startBossFight in
// js/04-flow.js for exactly where it is spliced into the wave flow, and the wave-end guard
// near the top of update() in this file for how the timer is disabled while it runs).
//
// state.bossFight, when active, looks like:
//   {
//     index: 1,          // 1st boss, 2nd boss, ... (wave/BOSS_WAVE_INTERVAL)
//     phase: 1,           // 1 or 2 (2 = <=BOSS_PHASE2_HP_FRACTION of max hp)
//     treeTimer: <seconds until the next periodic tree respawn>
//   }
// It is null/undefined outside of a boss fight.
// =====================================================================================

// ---- DPS-scaled HP ----------------------------------------------------------------------
// PROBLEM (measured, not theoretical): a flat 5200 HP was sized against an ESTIMATED
// wave-10 build of 110-250 DPS (4-6 weapons around tier 2-3). Real builds blow past that --
// weaponTierStatScalingMultiplier goes up to 4.85x at tier 5 (see that function above), and
// damagePercent/attackSpeed stack multiplicatively with no cap (brotatoPercentMultiplier),
// so a lucky/greedy build can reach 1700+ DPS. Against flat 5200 HP that is a 3-second boss.
//
// FIX (user's explicit decision): scale boss HP off the player's ACTUAL estimated DPS at the
// moment the fight starts, instead of a single flat number tuned for an "average" build --
// but with a HIGH MINIMUM FLOOR so a stripped-down/sold-everything build still gets a real
// fight instead of a 100 HP joke.

// Single lookup point for "the player" this estimator scales against. Deliberately reads
// state.player rather than assuming a global singleton elsewhere baked in — if/when
// multiplayer is added, this is the one function that needs to change (e.g. to take a
// specific player object or sum/average across several), nothing else in this formula does.
function currentPlayerForDpsEstimate() {
  return state.player;
}

// Estimates the player's current total sustained DPS across every EQUIPPED weapon, using the
// exact same helpers the real firing code uses (weaponShotDamage, weaponCooldown,
// weaponProjectileCount, getWeaponStatProfile().splitDamageAcrossProjectiles) so this can
// never drift out of sync with how damage is actually computed in fireProjectileWeapon/
// fireSwingWeapon. APPROXIMATE by nature: it assumes every shot lands (real play has misses,
// travel time, and pierce/falloff this does not model), so treat it as a fair upper-middle
// estimate of raw output, not a guarantee.
//
// Per weapon:
//   shots        = weaponProjectileCount(weapon)              (1 for swing weapons)
//   perShotDmg   = weaponShotDamage(weapon), divided by `shots` first when the weapon's
//                  profile sets splitDamageAcrossProjectiles (e.g. Seed Shotgun) -- otherwise
//                  a 4-pellet shotgun would be counted as 4x its real total-per-trigger damage,
//                  mirroring the exact same divide fireProjectileWeapon does before it spawns
//                  bullets (see the `if (profile.splitDamageAcrossProjectiles)` block there).
//   totalPerTrigger = perShotDmg * shots                       (back to the full trigger-pull total)
//   critMultiplier  = 1 + (critChance/100) * (weaponCritMultiplier(weapon) - 1)   (expected value)
//   weaponDps       = totalPerTrigger * critMultiplier / weaponCooldown(weapon)
// Summed across every weapon in the player's equipped slots (state.weapons sliced to
// maxWeaponSlots(), same as syncDerivedStats() does for the HUD damage stat).
function estimatePlayerDps() {
  const player = currentPlayerForDpsEstimate();
  if (!player) return 0;
  const equipped = state.weapons.slice(0, maxWeaponSlots());
  let totalDps = 0;
  for (const weapon of equipped) {
    const profile = getWeaponStatProfile(weapon);
    const shots = weaponProjectileCount(weapon);
    let perShotDamage = weaponShotDamage(weapon);
    // Same divide fireProjectileWeapon uses before crit is applied -- without it, multi-pellet
    // weapons (shots > 1 AND splitDamageAcrossProjectiles) would be counted `shots` times over.
    if (profile.splitDamageAcrossProjectiles) {
      perShotDamage = Math.max(1, Math.round(perShotDamage / shots));
    }
    const totalPerTrigger = perShotDamage * shots;
    const critChance = Math.min(95, Math.max(0, weaponCritChance(weapon))) / 100;
    const critMultiplier = weaponCritMultiplier(weapon);
    const critFactor = 1 + critChance * (critMultiplier - 1);
    const cooldown = Math.max(0.001, weaponCooldown(weapon));
    totalDps += (totalPerTrigger * critFactor) / cooldown;
  }
  return totalDps;
}

// Fight-length target: ~60 seconds of WALL-CLOCK time.
//
// CAREFUL -- the uptime fraction must be applied EXACTLY ONCE. estimatePlayerDps() returns a
// theoretical maximum: it assumes every shot fires on cooldown and every shot connects (it
// says so in its own comment). Real uptime in a dodge-heavy telegraph fight is well under
// that, so the HP pool is scaled DOWN by UPTIME_FRACTION to match what the player will
// actually land, giving a fight close to TARGET_SECONDS of wall-clock time.
//
// An earlier pass DIVIDED by the fraction instead of multiplying, which double-counted it:
// the pool was inflated 1.67x AND then chewed through at ~60% uptime, yielding ~167s fights
// at every DPS level instead of 60s. Multiply here; do not divide.
//   e.g. 500 dps theoretical -> 500 * 60 * 0.6 = 18000 HP -> ~60s at 60% real uptime.
const BOSS_DPS_TARGET_SECONDS = 60;
const BOSS_DPS_UPTIME_FRACTION = 0.6;

// HARD MINIMUM FLOOR (explicit user requirement): "we don't want the hp to be like only 100
// because the player sold everything and bought the worst item." Boss 1 never drops below
// 8000 HP no matter how weak the estimated DPS is -- a stripped/sold-off build still faces a
// real fight, just a slower one. Grows 1.55x per boss index, same curve as the DPS-scaled
// value below, so the floor stays proportionate at every boss instead of becoming irrelevant
// (too low) or dominant (too high) at bosses 2/3+.
const BOSS_HP_FLOOR_BASE = 8000;
// HARD MAXIMUM CAP: a pathological low-DPS build (e.g. 0 weapons after a bad crate recycle
// run) must not turn this into a 10-minute slog just because the floor logic has no ceiling.
// Capped at 25x the floor -- generous enough that it only ever engages for genuinely broken
// builds, while still bounding worst-case fight length to something finishable.
const BOSS_HP_CAP_MULTIPLIER = 25;

function bossIndexGrowth(bossIndex) {
  return Math.pow(1.55, Math.max(0, bossIndex - 1));
}

// Computed ONCE per fight, at spawn time (see spawnNibblerKing below) -- NOT per frame. The
// DPS estimate is a snapshot of the player's build the instant the fight starts; mid-fight
// purchases don't retroactively resize an in-progress boss.
//   dpsScaledHp = estimatePlayerDps() * BOSS_DPS_TARGET_SECONDS * BOSS_DPS_UPTIME_FRACTION
//   growth      = bossIndexGrowth(bossIndex)     -- 1.55x per boss index (1, 1.55, 2.4025, ...)
//   floor       = BOSS_HP_FLOOR_BASE * growth    -- 8000 for boss 1, 12400 for boss 2, ...
//   cap         = floor * BOSS_HP_CAP_MULTIPLIER -- 25x the floor
//   result      = clamp(dpsScaledHp, floor, cap)
// The 1.55x per-boss-index growth is carried entirely by the floor/cap (both scale with it),
// so later bosses are guaranteed to be at least as tough as the last even for a build whose
// DPS barely grew, while a build that DID get much stronger is still governed by its own
// fresh DPS estimate at each fight rather than a second multiplicative layer on top of it.
//
// WORKED EXAMPLES against boss 1 (growth = 1, floor = 8000, cap = 200000). "Predicted fight"
// divides the pool by (theoretical dps * uptime), i.e. what the player actually lands:
//   weak build    (~120 dps -- 1-2 low-tier weapons, e.g. after selling most of a run):
//                 dpsScaledHp = 120 * 60 * 0.6 = 4320 -> BELOW the 8000 floor -> HP = 8000.
//                 Predicted fight: 8000 / (120 * 0.6) = ~111s. Long, but that is the floor
//                 doing exactly its job rather than handing a stripped build a joke boss.
//   typical build (~500 dps -- several tier-2/3 weapons, a wave-10 build in reasonable shape):
//                 dpsScaledHp = 500 * 60 * 0.6 = 18000 -> between floor and cap -> HP = 18000.
//                 Predicted fight: 18000 / (500 * 0.6) = 60s, exactly the target.
//   monster build (~1700 dps -- tier-5 weapons, stacked damagePercent/attackSpeed):
//                 dpsScaledHp = 1700 * 60 * 0.6 = 61200 -> under the 200000 cap -> HP = 61200.
//                 Predicted fight: 61200 / (1700 * 0.6) = 60s. This is the case the whole
//                 rewrite exists for: the old flat 5200 HP died to this build in ~3 seconds
//                 (5200/1700), whereas scaling holds the same 60s target no matter how strong
//                 the build gets, instead of trivializing the harder the player is winning.
//                 The cap only engages past ~5600 theoretical dps.
// Note the "predicted fight" arithmetic above (hp / (dps * uptime)) is the inverse of the
// formula and is included only to sanity-check it -- it is not itself part of the formula.
// APPROXIMATE BY DESIGN: estimatePlayerDps() assumes every shot lands with no travel-time
// misses, so real fights likely run a bit longer than the target even at full assumed uptime.
// Treat 60s/60% as a tuning target, not a guarantee -- UNTESTED against a real playthrough,
// adjust from actual playtesting.
function nibblerKingHp(bossIndex) {
  const growth = bossIndexGrowth(bossIndex);
  const estimatedDps = Math.max(0, estimatePlayerDps());
  const dpsScaledHp = estimatedDps * BOSS_DPS_TARGET_SECONDS * BOSS_DPS_UPTIME_FRACTION;
  const floor = BOSS_HP_FLOOR_BASE * growth;
  const cap = floor * BOSS_HP_CAP_MULTIPLIER;
  const clamped = Math.min(cap, Math.max(floor, dpsScaledHp));
  return Math.round(clamped);
}

// Generous scrap reward, scaling with boss index the same way its HP does so a later boss
// (which took just as long to kill, just against a bigger pool) still feels like a big payout
// relative to what the shop costs by then.
function nibblerKingScrapReward(bossIndex) {
  return Math.round(260 * Math.pow(1.4, Math.max(0, bossIndex - 1)));
}

// Entry point for the interstitial boss fight, called from js/04-flow.js's startBossFight().
// Spawns the King at the arena centre-top (clear of the player's start position), sets up
// state.bossFight, and shows the "Boss Fight N" title (title text/number owned by the caller).
function spawnNibblerKing(bossIndex) {
  const template = enemyTypes.find((type) => type.name === "Nibbler King");
  if (!template) return null;
  const pos = { x: W / 2, y: H * 0.32 };
  spawnEnemy(template, pos);
  const boss = state.enemies[state.enemies.length - 1];
  // Override spawnEnemy's generic enemyScaling()/sizeHpMultiplier() math (tuned for swarm
  // enemies scaling with state.wave, not a single boss instance) with the dedicated formula.
  const hp = nibblerKingHp(bossIndex);
  boss.hp = hp;
  boss.maxHp = hp;
  boss.scrap = nibblerKingScrapReward(bossIndex);
  // ARRIVAL BEAT (v0.19.0): the King used to just materialize fully-formed at pos the instant
  // the fight started -- an abrupt pop-in with no sense of an opening moment. Now he drops in
  // from above: spawned well off the top of the screen, then "arriving" (below) tweens him
  // down to his real spot over ARRIVAL_TIME seconds and fires a landing shockwave on arrival,
  // before the normal idle/telegraph/strike/recover state machine ever runs. He can't act (no
  // attacks queue) or be meaningfully hit while off-screen, so this needs no separate
  // invulnerability flag -- being out of the arena during the drop is enough.
  boss._arrivalFromY = pos.y - 520;
  boss._arrivalToY = pos.y;
  boss.y = boss._arrivalFromY;
  boss._arrivalTimer = 0;
  const ARRIVAL_TIME = 0.6;
  boss._arrivalDuration = ARRIVAL_TIME;
  // Attack state machine fields (see updateNibblerKingBehavior below).
  boss.bossState = "arriving";
  boss.bossTimer = rand(1.2, 2.2); // brief pause before the first attack once idle begins, so the arrival reads
  boss.bossAttack = null;
  boss.bossPhase = 1;
  boss.bossFlash = 0;          // phase-2-transition screen/body flash pulse
  boss.bossTelegraph = null;   // per-attack telegraph payload consumed by js/08-render.js
  return boss;
}

// ---- Shared melee reach/arc/radius constants (v0.18.0). Single source of truth so the
// damage-check geometry here and the telegraph-drawn warning shape in js/08-render.js can never
// drift out of sync -- both read these same numbers. See each attack's strike branch below and
// its startBossTelegraph payload for where these get consumed.
// v0.18.0 REBALANCE: boss.radius doubled 66 -> 132 (js/01-core.js) to match the King's visible
// body -- render scale was lowered to compensate so his ON-SCREEN size is unchanged, but every
// reach below was a MULTIPLE of boss.radius, so leaving these multipliers alone would have
// silently DOUBLED every attack's pixel reach in an 810px-tall arena. The multipliers below are
// halved (roughly) so the ABSOLUTE pixel reach lands back near what was originally tuned at
// radius 66, with a modest genuine increase on top where this round intentionally buffed a value
// (the "was X" comments below are the OLD multiplier at the OLD radius-132 math, not the
// original r66 tuning -- see the changelog / balance report for the full before/after table).
const BOSS_CLUB_REACH_MULT = 2.0; // weaponSwing club reach = boss.radius * this (was 3.6 -> 475px; now 264px)
const BOSS_CLUB_ARC_HALF = { p1: 0.95, p2: 1.1 }; // radians, half-angle of swing arc (was 0.8/0.95)
const BOSS_COMBO_REACH_MULT = 1.8; // slamCombo reach = boss.radius * this (was 3.3 -> 436px; now 238px)
const BOSS_COMBO_ARC_HALF = { p1: 0.72, p2: 0.85 }; // radians (was 0.6/0.72)
const BOSS_SPIN_REACH_MULT = { p1: 1.5, p2: 1.75 }; // spinSweep ring radius = boss.radius * this (was 2.6/3.0 -> 343/396px; now 198/231px)
const BOSS_SMASH_RADIUS = 130; // overheadSmash hit radius, fixed px (was a fixed 46 -- way too small)
// CHARGE speed multiplier (v0.18.0 lunge buff): boss.speed * this = the dash's flat velocity.
// Raised from 8.5/11 to 11/14 (~+27-29%) so the lunge is a genuinely faster, further-reaching
// threat instead of a slow-motion tell. Paired with the strike-duration bump in
// BOSS_ATTACK_TIMING.charge so the dash also travels further, not just hits harder per frame.
const BOSS_CHARGE_SPEED_MULT = { p1: 11, p2: 14 };
const BOSS_LASER_REACH_MULT = 3.6; // laserSweep line length = boss.radius * this (was 4.2 -> 554px; now 475px -- long is fine, it's a line)
// GROUND SLAM / SPIN RING / SPIN TICK / STOMP QUAKE / GROUND POUND / CROWN TOSS reach constants
// (v0.18.0 rebalance -- previously inline literals at each call site, now centralised here so
// the damage-check geometry and the telegraph in js/08-render.js can never drift apart).
const BOSS_SLAM_REACH_MULT = { p1: 2.3, p2: 2.75 }; // groundSlam shockwave radius = boss.radius * this (was 4.5/5.5 -> 594/726px; now 304/363px)
const BOSS_QUAKE_REACH_MULT = 1.6; // stompQuake pulse radius = boss.radius * this (was 1.8 -> 238px; now 211px)
const BOSS_POUND_REACH_MULT = { p1: 1.6, p2: 1.9 }; // groundPoundShockwave ring radius = boss.radius * this (was 2.6/3.2 -> 343/422px; now 211/251px)
const BOSS_CROWN_THROW_MULT = 3.0; // crownToss throw range = boss.radius * this (was 3.4 -> 449px; now 396px)

// ---- Attack tuning: [telegraph, strike, recover] in seconds, per phase. Phase 2 numbers are
// noticeably faster (shorter telegraph AND recover) so the fight visibly speeds up, but the
// telegraph never drops so low that the hit becomes undodgeable -- see each attack's own
// comment for the reasoning against its specific danger.
// v0.18.0: every telegraph below was lengthened roughly +25-40% (both phases) so warnings are
// warnings you can actually react to -- see js/00-changelog.js 0.18.0 entry. p2 telegraphs stay
// strictly shorter than p1 for the same attack. Strike/recover values are UNCHANGED except
// charge's strike (see the "charge" entry) and the brand new attacks at the bottom.
const BOSS_ATTACK_TIMING = {
  weaponSwing: { p1: { telegraph: 1.15, strike: 0.22, recover: 0.9 }, p2: { telegraph: 0.72, strike: 0.18, recover: 0.55 } },
  summonNibblers: { p1: { telegraph: 1.5, strike: 0.05, recover: 0.7 }, p2: { telegraph: 1.05, strike: 0.05, recover: 0.45 } },
  nibblerLaunch: { p1: { telegraph: 1.2, strike: 0.05, recover: 1.1 }, p2: { telegraph: 0.78, strike: 0.05, recover: 0.75 } },
  groundSlam: { p1: { telegraph: 1.35, strike: 0.25, recover: 1.0 }, p2: { telegraph: 0.85, strike: 0.2, recover: 0.6 } },
  // CHARGE: telegraph lengthened like everything else, AND strike duration raised (0.55->0.65 /
  // 0.4->0.48) as part of the v0.18.0 lunge buff (see BOSS_CHARGE_SPEED_MULT below) so the
  // faster dash also travels further, not just hits harder per frame.
  charge: { p1: { telegraph: 1.25, strike: 0.65, recover: 1.1 }, p2: { telegraph: 0.85, strike: 0.48, recover: 0.7 } },
  // ---- New attacks below (v0.16.0) ----
  // SLAM COMBO (melee): 3 chained swings. "strike" here covers all 3 hits back to back (each
  // hit has its own short internal telegraph blip handled inside executeBossStrike/the combo
  // ticker), so the strike duration is roughly 3x a single swing's telegraph+strike.
  slamCombo: { p1: { telegraph: 0.68, strike: 1.5, recover: 1.0 }, p2: { telegraph: 0.46, strike: 1.05, recover: 0.65 } },
  // SPIN SWEEP (melee): full 360 whirl, punishes hugging. Longer telegraph (expanding ring
  // needs time to read clearly) so a close player has a real chance to back off.
  spinSweep: { p1: { telegraph: 1.5, strike: 0.4, recover: 1.0 }, p2: { telegraph: 1.05, strike: 0.32, recover: 0.65 } },
  // OVERHEAD SMASH (melee): long telegraph, precise small circle on the player's CURRENT spot.
  // Rewards reading the tell and simply walking away.
  overheadSmash: { p1: { telegraph: 1.8, strike: 0.3, recover: 1.0 }, p2: { telegraph: 1.3, strike: 0.24, recover: 0.65 } },
  // SEED SPRAY (ranged): fan of projectiles, cone telegraph.
  seedSpray: { p1: { telegraph: 1.08, strike: 0.12, recover: 0.9 }, p2: { telegraph: 0.72, strike: 0.1, recover: 0.55 } },
  // SPIT VOLLEY (ranged): several lobbed shots with individual ground markers.
  spitVolley: { p1: { telegraph: 1.35, strike: 0.1, recover: 1.0 }, p2: { telegraph: 0.92, strike: 0.1, recover: 0.65 } },
  // RADIAL BURST (ranged): full-circle projectile ring with gaps.
  radialBurst: { p1: { telegraph: 1.22, strike: 0.08, recover: 0.95 }, p2: { telegraph: 0.78, strike: 0.08, recover: 0.6 } },
  // ---- New attacks below (v0.17.0) ----
  // GROUND POUND SHOCKWAVE: 3 sequential expanding rings, each independently dodgeable. Strike
  // duration covers all 3 rings fired staggered (see the "groundPoundShockwave" branch of
  // executeBossStrike / runGroundPoundTick).
  groundPoundShockwave: { p1: { telegraph: 1.35, strike: 0.9, recover: 1.0 }, p2: { telegraph: 0.85, strike: 0.7, recover: 0.65 } },
  // CROWN TOSS: the crown is thrown out toward the player then arcs back, boomerang-style, with
  // two discrete hit-check points (out-peak, return-peak).
  crownToss: { p1: { telegraph: 0.95, strike: 1.2, recover: 0.8 }, p2: { telegraph: 0.65, strike: 0.9, recover: 0.5 } },
  // STOMP QUAKE (melee): a short flurry of tight tremor pulses right around the boss, punishing
  // players standing in melee range who don't react.
  stompQuake: { p1: { telegraph: 0.81, strike: 0.8, recover: 0.7 }, p2: { telegraph: 0.52, strike: 0.6, recover: 0.5 } },
  // ---- New attacks below (v0.18.0) ----
  // LASER SWEEP (melee/line): a rotating line hazard that sweeps across an arc, multi-tick like
  // slamCombo. See runLaserSweepTick.
  laserSweep: { p1: { telegraph: 1.2, strike: 0.9, recover: 1.0 }, p2: { telegraph: 0.8, strike: 0.7, recover: 0.65 } },
  // GAP WALL (ranged): a line of projectiles fired across the arena with one safe gap.
  gapWall: { p1: { telegraph: 1.15, strike: 0.1, recover: 1.0 }, p2: { telegraph: 0.78, strike: 0.1, recover: 0.65 } },
  // TRIPLE VOLLEY (ranged): 3 fast rounds at the player, tighter interval than spitVolley.
  tripleVolley: { p1: { telegraph: 0.95, strike: 0.55, recover: 0.85 }, p2: { telegraph: 0.65, strike: 0.4, recover: 0.55 } }
};

function bossAttackTiming(name, phase) {
  const entry = BOSS_ATTACK_TIMING[name];
  return phase >= 2 ? entry.p2 : entry.p1;
}

// Weighted random attack pick. nibblerLaunch is PHASE 2 ONLY (see its weight below), so it
// never appears in the phase-1 pool at all rather than being weighted to near-zero.
// v0.20.0: reweighted the OTHER way from v0.18.0's ranged-favoring pass. The fight is themed
// and named around the King's club, but at the old weights (melee 14 / ranged 21) weaponSwing
// itself was only 3/35 (8.6%) of all rolls -- players were reporting they'd die to ranged chip
// damage over 10-20s of a fight without ever actually seeing the signature club swing land. Now
// melee is the dominant identity (weaponSwing's weight roughly doubled, the rest of the melee
// pool raised modestly) while ranged attacks are dialed back but stay a real, common threat --
// see js/00-changelog.js and the final balance report for the resulting percentage breakdown.
function pickBossAttack(boss) {
  const pool = [
    // -- melee --
    { name: "weaponSwing", weight: 6 },
    { name: "groundSlam", weight: 3 },
    { name: "charge", weight: 3 },
    { name: "slamCombo", weight: 3 },
    { name: "spinSweep", weight: 3 },
    { name: "overheadSmash", weight: 3 },
    { name: "stompQuake", weight: 2 },
    // -- ranged --
    { name: "seedSpray", weight: 2 },
    { name: "spitVolley", weight: 2 },
    { name: "radialBurst", weight: 2 },
    { name: "crownToss", weight: 2 },
    { name: "gapWall", weight: 2 },
    { name: "tripleVolley", weight: 2 },
    { name: "groundPoundShockwave", weight: 2 },
    // -- neither ranged-damage nor melee-damage (summon utility) --
    { name: "summonNibblers", weight: 2 },
    // -- melee/multi-tick --
    { name: "laserSweep", weight: 3 }
  ];
  if (boss.bossPhase >= 2) {
    pool.push({ name: "nibblerLaunch", weight: 2 });
  }
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.name;
  }
  return pool[0].name;
}

// The Nibbler King's own movement + the telegraph/strike/recover attack state machine. Called
// once per enemy per frame from updateEnemyBehavior's "boss" branch above. `speed` is the
// template speed already adjusted by any Drummer buff (unused here since bosses don't buff,
// but kept for signature symmetry with the other behavior branches).
function updateNibblerKingBehavior(boss, dt, angleToPlayer, distanceToPlayer, speed) {
  const player = state.player;

  // v0.19.1 club-angle-sync fix: cache ONE timestamp for this whole frame/tick that
  // nibblerKingClubAngle (js/08-render.js) reads instead of each caller independently calling
  // performance.now(). Both the renderer's draw call and the combat code's per-frame damage
  // ticks (runWeaponSwingTick/runSpinSweepTick, called below) end up asking "what angle is the
  // club at right now" -- without a shared timestamp, two performance.now() calls microseconds
  // apart could put spinSweep's continuously-spinning club (spinRate 14) up to 6-13 degrees off
  // between what's drawn and what's tested on a slow frame.
  boss._clubFrameTime = performance.now();

  // Defensive defaults: normally every field here is set by spawnNibblerKing() the instant the
  // boss is created, but the dev panel's "Spawn Enemy" tool can create a raw Nibbler King
  // template directly (enemyTypes lists every template, including spawnable:false ones, for
  // testing -- see js/09d-devpanel.js). Without this, a dev-spawned King would have
  // bossState === undefined, match none of the branches below, and just stand there inert
  // instead of throwing -- silently broken rather than loudly broken. This makes it fight.
  if (boss.bossState === undefined) boss.bossState = "idle";
  if (boss.bossPhase === undefined) boss.bossPhase = 1;
  if (boss.bossTimer === undefined) boss.bossTimer = rand(0.6, 1.2);
  if (boss.bossFlash === undefined) boss.bossFlash = 0;

  // Phase 2 trigger: fires exactly once, the instant hp crosses the threshold, regardless of
  // which attack (or none) is in progress -- a mid-swing phase change still reads clearly
  // because of the flash below, and the state machine itself doesn't need to reset.
  if (boss.bossPhase === 1 && boss.hp <= boss.maxHp * BOSS_PHASE2_HP_FRACTION) {
    boss.bossPhase = 2;
    boss.bossFlash = 1;
    addShake(10, true);
    playSfx("gameover"); // reuses the existing dramatic stinger -- no new sfx asset needed
    showMessage("NIBBLER KING ENRAGES", "Its attacks are faster and hit harder now.", 1800);
    spawnRing(boss.x, boss.y, "#ff3b3b", boss.radius * 1.5, 0.6); // v0.18.0: halved, cosmetic phase-2 flash (radius doubled to 132, this keeps the visual proportionate)
    burst(boss.x, boss.y, "#ff3b3b", 30);
  }
  if (boss.bossFlash > 0) {
    boss.bossFlash = Math.max(0, boss.bossFlash - dt * 1.5);
  }
  // GROUND SLAM shockwave ring: decays after executeBossStrike sets it (see the "groundSlam"
  // branch there). Read by drawNibblerKingTelegraphs in js/08-render.js; cleared once spent so
  // a finished slam doesn't leave a frozen ring on screen.
  if (boss.bossSlamRing) {
    boss.bossSlamRing.life -= dt;
    if (boss.bossSlamRing.life <= 0) boss.bossSlamRing = null;
  }
  // SPIN SWEEP shockwave ring: same decay pattern as bossSlamRing above, just its own field so
  // the two attacks' visual rings can never stomp on each other if their windows overlap.
  if (boss.bossSpinRing) {
    boss.bossSpinRing.life -= dt;
    if (boss.bossSpinRing.life <= 0) boss.bossSpinRing = null;
  }
  // GROUND POUND rings: an array (up to 3 concurrent, staggered) rather than a single slot like
  // bossSlamRing/bossSpinRing, since this attack fires multiple rings across its strike window.
  if (boss.bossPoundRings && boss.bossPoundRings.length) {
    for (const ring of boss.bossPoundRings) ring.life -= dt;
    boss.bossPoundRings = boss.bossPoundRings.filter((ring) => ring.life > 0);
  }
  // STOMP QUAKE ring: same single-slot decay pattern as bossSlamRing, just its own field.
  if (boss.bossQuakeRing) {
    boss.bossQuakeRing.life -= dt;
    if (boss.bossQuakeRing.life <= 0) boss.bossQuakeRing = null;
  }

  // ---- Arriving: the opening beat (see spawnNibblerKing). The King drops in from off the top
  // of the arena to his real spot, sits still the whole time (vx/vy pinned to 0, no attacks can
  // queue), and lands with a shockwave + shake before handing off to idle. Defensive fallback
  // for a dev-panel-spawned King (see the defaults block above) that never got _arrivalToY set.
  if (boss.bossState === "arriving") {
    boss.vx = 0;
    boss.vy = 0;
    if (boss._arrivalToY === undefined) {
      boss.bossState = "idle";
    } else {
      boss._arrivalTimer += dt;
      const p = boss._arrivalDuration > 0 ? clamp(boss._arrivalTimer / boss._arrivalDuration, 0, 1) : 1;
      boss.y = boss._arrivalFromY + (boss._arrivalToY - boss._arrivalFromY) * easeOutCubic(p);
      if (p >= 1) {
        boss.y = boss._arrivalToY;
        boss.bossState = "idle";
        addShake(11, true);
        playSfx("explosion");
        spawnRing(boss.x, boss.y, "#ff9c5b", boss.radius * 1.3, 0.45);
        burst(boss.x, boss.y, "#ff6a5f", 28);
      }
    }
    return;
  }

  // ---- Idle: ambient chase (slow -- see the Nibbler King's template speed) until the
  // attack cooldown between actions elapses, then queue a new attack.
  if (boss.bossState === "idle") {
    boss.vx = Math.cos(angleToPlayer) * speed * 0.6;
    boss.vy = Math.sin(angleToPlayer) * speed * 0.6;
    boss.bossTimer -= dt;
    if (boss.bossTimer <= 0) {
      boss.bossAttack = pickBossAttack(boss);
      const timing = bossAttackTiming(boss.bossAttack, boss.bossPhase);
      boss.bossState = "telegraph";
      boss.bossTimer = timing.telegraph;
      startBossTelegraph(boss);
    }
    return;
  }

  // ---- Telegraph: RED warning for every attack, no exceptions. The boss holds mostly still
  // (a slow creep is fine -- it should not feel frozen) while the telegraph payload
  // (boss.bossTelegraph) is read by js/08-render.js to draw the actual red warning shape.
  if (boss.bossState === "telegraph") {
    boss.vx = Math.cos(angleToPlayer) * speed * 0.15;
    boss.vy = Math.sin(angleToPlayer) * speed * 0.15;
    boss.bossTimer -= dt;
    if (boss.bossTelegraph) boss.bossTelegraph.elapsed = (boss.bossTelegraph.elapsed ?? 0) + dt;
    if (boss.bossTimer <= 0) {
      const timing = bossAttackTiming(boss.bossAttack, boss.bossPhase);
      boss.bossState = "strike";
      boss.bossTimer = timing.strike;
      executeBossStrike(boss);
    }
    return;
  }

  // ---- Strike: the actual hit/spawn/dash happens once, at the moment executeBossStrike ran
  // (called above the instant telegraph ends). This state just holds for the strike's visible
  // duration (charge/slam already move the boss themselves inside their own strike handlers).
  // SLAM COMBO is the one exception: its "strike" window covers all 3 chained hits, so this
  // block also ticks a sub-timer and fires each subsequent hit partway through the window
  // (see runSlamComboTick below) instead of everything landing at strike-start.
  if (boss.bossState === "strike") {
    boss.bossTimer -= dt;
    if (boss.bossAttack === "charge" && boss._chargeVX !== undefined) {
      boss.vx = boss._chargeVX;
      boss.vy = boss._chargeVY;
      // updateEnemies (the caller of updateEnemyBehavior) eases mvx/mvy toward vx/vy every
      // frame UNLESS enemy.chargeTimer > 0, which is the exact "instant snap" lunge path
      // already built for the Darter's own charge. Setting it here makes the boss's dash
      // reuse that same crisp, non-eased movement instead of ramping up smoothly (which would
      // read as sluggish for what is supposed to be a sudden, dodge-worthy dash).
      boss.chargeTimer = boss.bossTimer;
    } else {
      boss.vx = 0;
      boss.vy = 0;
    }
    if (boss.bossAttack === "slamCombo") {
      runSlamComboTick(boss, dt);
    }
    if (boss.bossAttack === "groundPoundShockwave") {
      runGroundPoundTick(boss, dt);
    }
    if (boss.bossAttack === "crownToss") {
      runCrownTossTick(boss, dt);
    }
    if (boss.bossAttack === "stompQuake") {
      runStompQuakeTick(boss, dt);
    }
    if (boss.bossAttack === "laserSweep") {
      runLaserSweepTick(boss, dt);
    }
    if (boss.bossAttack === "tripleVolley") {
      runTripleVolleyTick(boss, dt);
    }
    if (boss.bossAttack === "spinSweep") {
      runSpinSweepTick(boss);
    }
    if (boss.bossAttack === "weaponSwing") {
      // v0.19.1 club-angle-sync fix: test every frame during "strike" against the live,
      // currently-drawn club angle (nibblerKingClubAngle) instead of only once at strike-start
      // (already done above in executeBossStrike, which still covers the very first frame).
      // boss._swingHitLanded latches so this can still only land once per swing.
      runWeaponSwingTick(boss);
    }
    if (boss.bossTimer <= 0) {
      const timing = bossAttackTiming(boss.bossAttack, boss.bossPhase);
      boss.bossState = "recover";
      boss.bossTimer = timing.recover;
      boss.bossTelegraph = null;
      boss._chargeVX = undefined;
      boss._chargeVY = undefined;
      boss.chargeTimer = 0;
      boss._comboHitsLanded = 0;
      boss._comboNextHitAt = undefined;
      boss._comboHitLatch = [false, false, false];
      boss._poundRingsFired = 0;
      boss._poundNextRingAt = undefined;
      boss._crownHitsLanded = 0;
      boss.bossCrownPos = null;
      boss._quakePulsesFired = 0;
      boss._quakeNextPulseAt = undefined;
      boss._laserHitLanded = false;
      boss.bossLaserAngle = null;
      boss._volleyRoundsFired = 0;
      boss._volleyNextRoundAt = undefined;
      boss._swingHitLanded = false;
      boss._spinHitLanded = false;
    }
    return;
  }

  // ---- Recover: brief wait after every attack before the next one can be queued, win or
  // lose (there is no way to "cancel" recovery by damaging the boss -- it is a fixed cost).
  if (boss.bossState === "recover") {
    boss.vx = Math.cos(angleToPlayer) * speed * 0.3;
    boss.vy = Math.sin(angleToPlayer) * speed * 0.3;
    boss.bossTimer -= dt;
    if (boss.bossTimer <= 0) {
      boss.bossState = "idle";
      boss.bossAttack = null;
      boss.bossTimer = boss.bossPhase >= 2 ? rand(0.4, 0.9) : rand(0.8, 1.6);
    }
    return;
  }
}

// Sets up the red-telegraph payload for whichever attack was just picked. js/08-render.js
// reads boss.bossTelegraph to draw the actual warning shape (arc/cone, ground circle(s), or a
// path line) -- this only records WHAT to warn about and WHERE, not how it looks.
function startBossTelegraph(boss) {
  const player = state.player;
  if (boss.bossAttack === "weaponSwing") {
    // v0.19.0 club-hit rework: range now reads the ACTUAL club reach (pivotReach + clubLength)
    // from the shared nibblerKingClubGeometry helper (js/08-render.js) when available, instead
    // of the old BOSS_CLUB_REACH_MULT constant -- the damage check itself now tests the club's
    // real swept segment (see executeBossStrike), so the telegraph's cone should honestly
    // preview that same reach rather than a separately-tuned number that could drift from it.
    // Falls back to the old constant if the geometry helper hasn't loaded yet (should never
    // happen in practice -- both files load together -- but keeps the payload valid either way).
    const phase2 = boss.bossPhase >= 2;
    const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
    const range = typeof nibblerKingClubGeometry === "function"
      ? (() => { const geo = nibblerKingClubGeometry(boss, angle); return geo.pivotReach + geo.clubLength; })()
      : boss.radius * BOSS_CLUB_REACH_MULT;
    boss.bossTelegraph = {
      kind: "swing",
      angle,
      range,
      halfArc: phase2 ? BOSS_CLUB_ARC_HALF.p2 : BOSS_CLUB_ARC_HALF.p1,
      elapsed: 0
    };
  } else if (boss.bossAttack === "summonNibblers") {
    const count = boss.bossPhase >= 2 ? 7 : 2 + Math.floor(rand(0, 2)); // p1: 2-3, p2: 7 (v0.18.0 flood, was 4)
    const spots = [];
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const dist = rand(90, 220);
      spots.push({
        x: clamp(boss.x + Math.cos(angle) * dist, 40, W - 40),
        y: clamp(boss.y + Math.sin(angle) * dist, 40, H - 40)
      });
    }
    boss.bossTelegraph = { kind: "summonSpots", spots, elapsed: 0 };
  } else if (boss.bossAttack === "nibblerLaunch") {
    boss.bossTelegraph = { kind: "flash", elapsed: 0 };
  } else if (boss.bossAttack === "groundSlam") {
    // v0.18.0: radius written into the payload itself so the telegraph in js/08-render.js draws
    // EXACTLY the shockwave radius computed at strike time (BOSS_SLAM_REACH_MULT), instead of
    // the renderer recomputing its own phase-based radius from a separate literal that could
    // drift out of sync with this file.
    const phase2 = boss.bossPhase >= 2;
    boss.bossTelegraph = {
      kind: "slam",
      x: boss.x,
      y: boss.y,
      radius: boss.radius * (phase2 ? BOSS_SLAM_REACH_MULT.p2 : BOSS_SLAM_REACH_MULT.p1),
      elapsed: 0
    };
  } else if (boss.bossAttack === "charge") {
    boss.bossTelegraph = {
      kind: "chargePath",
      fromX: boss.x,
      fromY: boss.y,
      toAngle: Math.atan2(player.y - boss.y, player.x - boss.x),
      elapsed: 0
    };
  } else if (boss.bossAttack === "slamCombo") {
    // MELEE: three swings in a row, each a bit rotated from the last so it isn't a single
    // dodge -- angles are rolled now, up front, so the whole combo's directions are fixed the
    // instant the telegraph starts (an honest preview, not decided on the fly mid-strike).
    const baseAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
    const spread = 0.55;
    // v0.19.0 club-hit rework: range reads the ACTUAL club reach from the shared
    // nibblerKingClubGeometry helper (same convention as weaponSwing above), so the cones stay
    // an honest preview of landSlamComboHit's real club-segment hit test.
    const phase2 = boss.bossPhase >= 2;
    const range = typeof nibblerKingClubGeometry === "function"
      ? (() => { const geo = nibblerKingClubGeometry(boss, baseAngle); return geo.pivotReach + geo.clubLength; })()
      : boss.radius * BOSS_COMBO_REACH_MULT;
    boss.bossTelegraph = {
      kind: "comboSwing",
      angles: [baseAngle - spread, baseAngle, baseAngle + spread],
      range,
      halfArc: phase2 ? BOSS_COMBO_ARC_HALF.p2 : BOSS_COMBO_ARC_HALF.p1,
      hit: 0,
      elapsed: 0
    };
  } else if (boss.bossAttack === "spinSweep") {
    // MELEE: full 360 whirl -- the telegraph is an expanding ring at club reach, no direction
    // to read because it hits everywhere around the boss. v0.19.0 club-hit rework: range reads
    // the ACTUAL club reach (pivotReach + clubLength, using spinSweep's own r*0.7 pivot from the
    // shared geometry helper) so the ring honestly previews runSpinSweepTick's real segment test.
    const phase2 = boss.bossPhase >= 2;
    const range = typeof nibblerKingClubGeometry === "function"
      ? (() => { const geo = nibblerKingClubGeometry(boss, 0); return geo.pivotReach + geo.clubLength; })()
      : boss.radius * (phase2 ? BOSS_SPIN_REACH_MULT.p2 : BOSS_SPIN_REACH_MULT.p1);
    boss.bossTelegraph = {
      kind: "spinRing",
      range,
      elapsed: 0
    };
  } else if (boss.bossAttack === "overheadSmash") {
    // MELEE: precise small circle pinned to the player's CURRENT position at telegraph start
    // (not tracked afterward) -- rewards simply walking off the marked spot.
    boss.bossTelegraph = { kind: "overheadMark", x: player.x, y: player.y, elapsed: 0 };
  } else if (boss.bossAttack === "seedSpray") {
    // RANGED: a fan of pellets straight at the player. Telegraph is a red cone matching the
    // fan's spread so the warning honestly previews where the pellets will fly.
    boss.bossTelegraph = {
      kind: "cone",
      angle: Math.atan2(player.y - boss.y, player.x - boss.x),
      halfArc: 0.42,
      elapsed: 0
    };
  } else if (boss.bossAttack === "spitVolley") {
    // RANGED: several lobbed shots landing near (not exactly on) the player, each with its
    // own small ground marker rolled now so the warning matches where they will actually land.
    const count = boss.bossPhase >= 2 ? 5 : 4;
    const spots = [];
    for (let i = 0; i < count; i += 1) {
      const angle = rand(0, Math.PI * 2);
      const dist = rand(0, 90);
      spots.push({
        x: clamp(player.x + Math.cos(angle) * dist, 30, W - 30),
        y: clamp(player.y + Math.sin(angle) * dist, 30, H - 30)
      });
    }
    boss.bossTelegraph = { kind: "lobSpots", spots, elapsed: 0 };
  } else if (boss.bossAttack === "radialBurst") {
    // RANGED: full-circle burst with gaps the player can slip through. Telegraph is a brief
    // flash plus an expanding ring, distinct from the phase-2 nibblerLaunch's own flash (that
    // one throws real Nibblers, this one throws projectiles).
    boss.bossTelegraph = { kind: "radialFlash", elapsed: 0 };
  } else if (boss.bossAttack === "groundPoundShockwave") {
    // RANGED/AOE: 3 sequential rings centred on the boss, staggered so each is individually
    // dodgeable. Telegraph is a single growing warning ring at the boss (the rings themselves
    // are visualized as they fire, during strike, via boss.bossPoundRings).
    // v0.18.0: range written into the payload (BOSS_POUND_REACH_MULT, phase-1 value -- the
    // largest-window first ring) so the renderer's preview ring matches the real first-ring
    // radius; later rings 2/3 reuse the same phase multiplier (see fireGroundPoundRing).
    boss.bossTelegraph = {
      kind: "poundWarn",
      range: boss.radius * (boss.bossPhase >= 2 ? BOSS_POUND_REACH_MULT.p2 : BOSS_POUND_REACH_MULT.p1),
      elapsed: 0
    };
  } else if (boss.bossAttack === "crownToss") {
    // The crown is thrown toward the player's position at telegraph start (not homing), then
    // arcs back to the boss -- an honest fixed-angle preview, same convention as chargePath.
    // v0.18.0: throwRange written into the payload (BOSS_CROWN_THROW_MULT) so the renderer's
    // dashed preview line matches the real throw distance exactly.
    boss.bossTelegraph = {
      kind: "crownArc",
      fromX: boss.x,
      fromY: boss.y,
      angle: Math.atan2(player.y - boss.y, player.x - boss.x),
      throwRange: boss.radius * BOSS_CROWN_THROW_MULT,
      elapsed: 0
    };
  } else if (boss.bossAttack === "stompQuake") {
    // MELEE: tight tremor pulses right around the boss -- short telegraph since it's meant to
    // punish players who don't react to being in melee range. v0.18.0: range written into the
    // payload (BOSS_QUAKE_REACH_MULT) so the renderer's ring matches the real pulse radius.
    boss.bossTelegraph = { kind: "quakeWarn", range: boss.radius * BOSS_QUAKE_REACH_MULT, elapsed: 0 };
  } else if (boss.bossAttack === "laserSweep") {
    // MELEE/LINE (v0.18.0): a long line hazard that sweeps from a start angle to an end angle
    // across the strike window, checked multi-tick like slamCombo (see runLaserSweepTick). The
    // sweep direction and total arc are rolled now so the whole path is an honest upfront
    // preview, not decided mid-strike.
    const baseAngle = Math.atan2(player.y - boss.y, player.x - boss.x);
    const sweepArc = 1.7; // total angle swept, radians (~97 degrees)
    const dir = Math.random() < 0.5 ? -1 : 1;
    boss.bossTelegraph = {
      kind: "laserSweep",
      startAngle: baseAngle - dir * sweepArc * 0.5,
      endAngle: baseAngle + dir * sweepArc * 0.5,
      range: boss.radius * BOSS_LASER_REACH_MULT,
      elapsed: 0
    };
  } else if (boss.bossAttack === "gapWall") {
    // RANGED (v0.18.0): a line of projectiles fired across the arena perpendicular to the
    // boss->player axis, with one safe gap slot the player must find and stand in during the
    // telegraph. The gap slot is rolled now so the warning honestly shows where it will be.
    const count = boss.bossPhase >= 2 ? 9 : 7;
    const gapIndex = Math.floor(rand(0, count));
    boss.bossTelegraph = {
      kind: "gapWallWarn",
      angle: Math.atan2(player.y - boss.y, player.x - boss.x),
      count,
      gapIndex,
      elapsed: 0
    };
  } else if (boss.bossAttack === "tripleVolley") {
    // RANGED (v0.18.0): 3 fast rounds straight at the player, tighter interval than spitVolley's
    // lobbed spread. Telegraph is a narrow cone (tighter than seedSpray's fan) since these are
    // aimed shots, not a spray.
    boss.bossTelegraph = {
      kind: "tripleCone",
      angle: Math.atan2(player.y - boss.y, player.x - boss.x),
      halfArc: 0.18,
      elapsed: 0
    };
  }
}

// Fires the moment telegraph ends. This is where actual damage/spawns/motion happen -- see
// each branch. All damage numbers are boss contact-scale multiples, not the flat contact
// damage itself, so each attack reads as clearly more dangerous than just touching the boss.
function executeBossStrike(boss) {
  const player = state.player;
  const phase2 = boss.bossPhase >= 2;

  if (boss.bossAttack === "weaponSwing") {
    // ATTACK 1: WEAPON SWING (v0.19.0 club-hit rework; v0.19.1 club-angle-sync fix). The user's
    // core complaint: "the warnings shouldn't do the damage, the weapon should" / "if the player
    // gets hit by or touches the club, they take damage." Damage tests against the CLUB'S ACTUAL
    // SWEPT SEGMENT (pivot->tip, from the shared js/08-render.js geometry helper the renderer
    // itself draws the club with). This only fires the SFX/VFX/damage-cooldown-reset side effects
    // once at strike start -- the actual per-frame hit test now happens in runWeaponSwingTick
    // (called every frame during "strike" from updateNibblerKingBehavior), so the player is hit
    // when the swinging club visually reaches them instead of at strike-start when the club is
    // still fully wound back (the angle bug this version fixes).
    const angle = (typeof nibblerKingClubAngle === "function" ? nibblerKingClubAngle(boss) : null)
      ?? boss.bossTelegraph?.angle ?? Math.atan2(player.y - boss.y, player.x - boss.x);
    const range = boss.bossTelegraph?.range ?? boss.radius * BOSS_CLUB_REACH_MULT;
    playSfx("swing");
    burst(boss.x + Math.cos(angle) * range * 0.6, boss.y + Math.sin(angle) * range * 0.6, "#ff6a5f", 14);
    addShake(6, true);
    runWeaponSwingTick(boss); // also does the strike-start frame's own hit test
  } else if (boss.bossAttack === "summonNibblers") {
    // ATTACK 2: SUMMON NIBBLERS. Materialize a Nibbler at each warned spot, respecting the
    // active enemy cap so this can never run away with the enemy count.
    const nibblerTemplate = enemyTypes.find((type) => type.name === "Nibbler");
    const spots = boss.bossTelegraph?.spots ?? [];
    if (nibblerTemplate) {
      for (const spot of spots) {
        if (state.enemies.length >= enemyActiveCap()) break;
        spawnEnemy(nibblerTemplate, spot);
        spawnRing(spot.x, spot.y, "#ff6a5f", 34, 0.3);
        burst(spot.x, spot.y, "#f1766e", 10);
      }
    }
    playSfx("kill");
  } else if (boss.bossAttack === "nibblerLaunch") {
    // ATTACK 3 (PHASE 2 ONLY): NIBBLER LAUNCH. Chosen as REAL Nibbler enemies given an
    // outward dash velocity (rather than projectiles-that-become-enemies) because the combat
    // loop already has a working "lunge" pattern for the Darter (chargeTimer/lungeAngle in
    // updateEnemyBehavior) -- reusing that same field pair here means these launched Nibblers
    // fall straight into existing collision/damage/knockback code with zero new bullet-vs-
    // enemy interaction to write. A projectile-based version would need its own hit-test
    // against the player AND a spawn-on-landing path, which is strictly more new surface
    // area for the same visual result.
    const nibblerTemplate = enemyTypes.find((type) => type.name === "Nibbler");
    const count = 15; // v0.18.0 phase-2 flood: raised from 8 (enemyActiveCap() still gates total)
    if (nibblerTemplate) {
      for (let i = 0; i < count; i += 1) {
        if (state.enemies.length >= enemyActiveCap()) break;
        const angle = (i / count) * Math.PI * 2;
        const spawnDist = boss.radius * 0.8;
        const pos = {
          x: clamp(boss.x + Math.cos(angle) * spawnDist, 20, W - 20),
          y: clamp(boss.y + Math.sin(angle) * spawnDist, 20, H - 20)
        };
        spawnEnemy(nibblerTemplate, pos);
        const launched = state.enemies[state.enemies.length - 1];
        // Borrow the Darter's own lunge fields: chargeTimer counts down while vx/vy (set
        // every frame from lungeAngle in updateEnemyBehavior's "charge" branch) drive an
        // outward dash. Nibbler's behavior is "chase", not "charge", so instead the dash is
        // driven directly here for a short window via knockX/knockY (already summed into
        // position every frame in updateEnemies), which decays naturally on its own.
        launched.knockX = Math.cos(angle) * 620;
        launched.knockY = Math.sin(angle) * 620;
      }
    }
    burst(boss.x, boss.y, "#fff2a8", 40);
    spawnRing(boss.x, boss.y, "#ffe28a", boss.radius * 1.2, 0.35); // v0.18.0: halved, cosmetic nibblerLaunch flash (radius doubled to 132, this keeps the visual proportionate)
    addShake(9, true);
    playSfx("explosion");
  } else if (boss.bossAttack === "groundSlam") {
    // ATTACK 4: GROUND SLAM. Telegraphed circle already shown during telegraph; the shockwave
    // damage is applied once here, at the moment the ring "hits" (visualized as an expanding
    // ring in js/08-render.js reading boss.bossSlamRing, set here for the render step to pick
    // up and animate over the strike/recover window).
    const cx = boss.bossTelegraph?.x ?? boss.x;
    const cy = boss.bossTelegraph?.y ?? boss.y;
    const slamRadius = boss.radius * (phase2 ? BOSS_SLAM_REACH_MULT.p2 : BOSS_SLAM_REACH_MULT.p1);
    boss.bossSlamRing = { x: cx, y: cy, radius: slamRadius, life: 0.4, maxLife: 0.4 };
    const dist = Math.hypot(player.x - cx, player.y - cy);
    if (dist <= slamRadius + playerHitRadius()) {
      const damage = Math.round(boss.damage * (phase2 ? 2.2 : 1.7));
      damagePlayer(damage, cx, cy, "Nibbler King");
    }
    addShake(9, true);
    playSfx("explosion");
    burst(cx, cy, "#ff6a5f", 24);
  } else if (boss.bossAttack === "charge") {
    // ATTACK 5: CHARGE/TACKLE. Dash along the telegraphed straight line toward where the
    // player WAS when the telegraph started (not a homing dash -- that's what makes it
    // dodgeable). Speed is a flat velocity set for the whole strike duration.
    const path = boss.bossTelegraph;
    const angle = path?.toAngle ?? Math.atan2(player.y - boss.y, player.x - boss.x);
    const chargeSpeed = boss.speed * (phase2 ? BOSS_CHARGE_SPEED_MULT.p2 : BOSS_CHARGE_SPEED_MULT.p1);
    boss._chargeVX = Math.cos(angle) * chargeSpeed;
    boss._chargeVY = Math.sin(angle) * chargeSpeed;
    // Damage is checked continuously while charging via the normal enemy-contact code path
    // (overlap test in updateEnemies), but that hit is capped by ENEMY_CONTACT_COOLDOWN /
    // the player's own i-frame window like any other contact -- so a bonus direct-hit check
    // right at charge start rewards actually being in the boss's way when it launches.
    const dist = Math.hypot(player.x - boss.x, player.y - boss.y);
    if (dist <= boss.radius + playerHitRadius() + 40) {
      const damage = Math.round(boss.damage * (phase2 ? 2.4 : 1.8));
      damagePlayer(damage, boss.x, boss.y, "Nibbler King");
    }
    burst(boss.x, boss.y, "#ffd15f", 16);
    playSfx("hit");
  } else if (boss.bossAttack === "slamCombo") {
    // ATTACK 6 (MELEE): SLAM COMBO. First of 3 hits lands here, at strike-start, using the
    // combo's angles[0]. Hits 2 and 3 are fired later, mid-strike, by runSlamComboTick (called
    // from updateNibblerKingBehavior's "strike" state) -- see landSlamComboHit for the shared
    // per-hit damage/arc logic all 3 swings use.
    boss._comboHitsLanded = 0;
    boss._comboNextHitAt = undefined;
    landSlamComboHit(boss, 0);
  } else if (boss.bossAttack === "spinSweep") {
    // ATTACK 7 (MELEE, v0.19.0 club-hit rework): SPIN SWEEP. The club sweeps a full circle
    // continuously through the whole strike (see the spin angle formula in
    // drawNibblerKingClub, js/08-render.js: angle = time * spinRate during "strike"), so unlike
    // weaponSwing this can't be a single strike-start check -- the segment has to be tested
    // every frame as it rotates, which is what runSpinSweepTick (below, called each frame from
    // updateNibblerKingBehavior's "strike" state) does. This branch only resets the hit latch
    // and does the initial instant's check (mirrors every other attack firing its first
    // effects at strike-start) plus the one-time cosmetics (ring/shake/sfx).
    boss._spinHitLanded = false;
    runSpinSweepTick(boss);
    const range = boss.bossTelegraph?.range ?? boss.radius * (phase2 ? BOSS_SPIN_REACH_MULT.p2 : BOSS_SPIN_REACH_MULT.p1);
    boss.bossSpinRing = { x: boss.x, y: boss.y, radius: range, life: 0.35, maxLife: 0.35 };
    addShake(8, true);
    playSfx("swing");
    burst(boss.x, boss.y, "#ff6a5f", 22);
  } else if (boss.bossAttack === "overheadSmash") {
    // ATTACK 8 (MELEE): OVERHEAD SMASH. Long telegraph already gave a clear warning pinned to
    // where the player WAS when it started (boss.bossTelegraph.x/y) -- big damage if they never
    // moved off that spot, nothing if they stepped away, regardless of where the boss itself is.
    const cx = boss.bossTelegraph?.x ?? player.x;
    const cy = boss.bossTelegraph?.y ?? player.y;
    const smashRadius = BOSS_SMASH_RADIUS;
    const dist = Math.hypot(player.x - cx, player.y - cy);
    if (dist <= smashRadius + playerHitRadius()) {
      // 1.9/1.6x (down from an earlier 2.8/2.3x): with the boss's contact damage scaled up
      // (see js/01-core.js), the old multiplier could approach a one-shot on a lean, low-HP,
      // no-armor wave-10 build. This keeps it the hardest-hitting punish attack in the kit
      // while still leaving real margin to survive a missed dodge.
      const damage = Math.round(boss.damage * (phase2 ? 1.9 : 1.6));
      damagePlayer(damage, cx, cy, "Nibbler King");
    }
    addShake(10, true);
    playSfx("explosion");
    burst(cx, cy, "#ff6a5f", 26);
    spawnRing(cx, cy, "#ff3b3b", smashRadius * 1.4, 0.35);
  } else if (boss.bossAttack === "seedSpray") {
    // ATTACK 9 (RANGED): SEED SPRAY. A fan of real projectiles via shootEnemyProjectile, spread
    // across the telegraphed cone. Count/speed tuned so sidestepping clears the fan easily.
    const angle = boss.bossTelegraph?.angle ?? Math.atan2(player.y - boss.y, player.x - boss.x);
    const halfArc = boss.bossTelegraph?.halfArc ?? 0.42;
    const count = phase2 ? 7 : 5;
    for (let i = 0; i < count; i += 1) {
      const offset = count === 1 ? 0 : -halfArc + (halfArc * 2 * i) / (count - 1);
      shootBossPellet(boss, angle + offset, phase2);
    }
    playSfx("shoot");
    burst(boss.x, boss.y, "#f2d35f", 10);
  } else if (boss.bossAttack === "spitVolley") {
    // ATTACK 10 (RANGED): SPIT VOLLEY. Several arcing lobs toward the pre-rolled ground spots
    // (already shown as markers during telegraph) -- one real projectile per spot, aimed so it
    // lands roughly on its marker rather than tracking the player live.
    const spots = boss.bossTelegraph?.spots ?? [];
    for (const spot of spots) {
      const angle = Math.atan2(spot.y - boss.y, spot.x - boss.x);
      shootBossLob(boss, angle, spot, phase2);
    }
    playSfx("shoot");
    burst(boss.x, boss.y, "#66c7d8", 10);
  } else if (boss.bossAttack === "radialBurst") {
    // ATTACK 11 (RANGED): RADIAL BURST. Full ring of projectiles fired outward with gaps a
    // player can slip through -- distinct from nibblerLaunch (phase 2's real-Nibbler burst).
    const count = phase2 ? 14 : 10;
    const gapEvery = 4; // skip one shot every 4th slot to leave a slip-through lane
    for (let i = 0; i < count; i += 1) {
      if (i % gapEvery === gapEvery - 1) continue;
      const angle = (i / count) * Math.PI * 2;
      shootBossPellet(boss, angle, phase2);
    }
    addShake(7, true);
    playSfx("explosion");
    burst(boss.x, boss.y, "#ff9c5b", 20);
    spawnRing(boss.x, boss.y, "#ff9c5b", boss.radius * 1, 0.3); // v0.18.0: halved, cosmetic radialBurst flash (radius doubled to 132, this keeps the visual proportionate)
  } else if (boss.bossAttack === "groundPoundShockwave") {
    // ATTACK 12 (RANGED/AOE): GROUND POUND SHOCKWAVE. 3 rings fired staggered across the strike
    // window (first one now, the rest via runGroundPoundTick), each independently dodgeable and
    // individually weaker than a single groundSlam.
    boss._poundRingsFired = 0;
    boss._poundNextRingAt = undefined;
    fireGroundPoundRing(boss, 0);
  } else if (boss.bossAttack === "crownToss") {
    // ATTACK 13 (RANGED): CROWN TOSS. Boomerang throw -- out toward the telegraphed angle, then
    // back to the boss. Hit-checked at two discrete points (out-peak, return-peak) via
    // runCrownTossTick rather than continuous tracking, since the arc is a fixed, honest path.
    boss._crownHitsLanded = 0;
    playSfx("shoot");
    burst(boss.x, boss.y, "#f2c45f", 12);
  } else if (boss.bossAttack === "stompQuake") {
    // ATTACK 14 (MELEE): STOMP QUAKE. First of 3-4 tight tremor pulses lands here; the rest
    // fire via runStompQuakeTick. Punishes players standing right next to the boss.
    boss._quakePulsesFired = 0;
    boss._quakeNextPulseAt = undefined;
    fireStompQuakePulse(boss, 0);
  } else if (boss.bossAttack === "laserSweep") {
    // ATTACK 15 (MELEE/LINE): LASER SWEEP. The line rotates from startAngle to endAngle over the
    // strike window; damage is checked every frame via runLaserSweepTick (below), same guarded
    // "only once per victim per attack... actually here, checked continuously but naturally
    // self-limiting because the strike is short and damagePlayer has its own contact cooldown"
    // convention as the rest of the kit uses ENEMY_CONTACT_COOLDOWN-style gating on damagePlayer.
    boss._laserHitLanded = false;
    playSfx("shoot");
    burst(boss.x, boss.y, "#7ef2ff", 14);
  } else if (boss.bossAttack === "gapWall") {
    // ATTACK 16 (RANGED): GAP WALL. A line of projectiles fired across the arena perpendicular
    // to the boss->player axis, one slot left empty (the telegraphed gap) for the player to
    // stand in. Reuses shootBossPellet's plumbing but overrides velocity so each bullet travels
    // straight along the wall line instead of radially outward.
    const angle = boss.bossTelegraph?.angle ?? Math.atan2(player.y - boss.y, player.x - boss.x);
    const perp = angle + Math.PI / 2;
    const count = boss.bossTelegraph?.count ?? (phase2 ? 9 : 7);
    const gapIndex = boss.bossTelegraph?.gapIndex ?? 0;
    const spacing = 60;
    const wallDist = 40; // spawn offset so the wall starts just past the boss's own body
    for (let i = 0; i < count; i += 1) {
      if (i === gapIndex) continue;
      const offset = (i - (count - 1) / 2) * spacing;
      const originX = boss.x + Math.cos(angle) * wallDist + Math.cos(perp) * offset;
      const originY = boss.y + Math.sin(angle) * wallDist + Math.sin(perp) * offset;
      shootEnemyProjectile(boss, angle);
      const bullet = state.enemyBullets[state.enemyBullets.length - 1];
      if (bullet) {
        bullet.x = originX;
        bullet.y = originY;
        bullet.vx = Math.cos(angle) * 210;
        bullet.vy = Math.sin(angle) * 210;
        bullet.damage = Math.round(boss.damage * (phase2 ? 0.5 : 0.4));
        bullet.kind = "kingSeed";
      }
    }
    playSfx("shoot");
    burst(boss.x, boss.y, "#c48bff", 16);
  } else if (boss.bossAttack === "tripleVolley") {
    // ATTACK 17 (RANGED): TRIPLE VOLLEY. First of 3 fast aimed shots lands here; the remaining
    // 2 fire via runTripleVolleyTick, spaced tighter than spitVolley's lobs since these are
    // meant to punish standing still rather than reward a slow read.
    boss._volleyRoundsFired = 0;
    boss._volleyNextRoundAt = undefined;
    fireTripleVolleyRound(boss, 0);
  }
}

// Fires ring N (0-2) of the ground pound shockwave: a moderate-radius expanding ring centred on
// the boss's CURRENT position (each ring re-centres, unlike groundSlam's single fixed spot),
// dealing damage once via a simple distance check, same convention as groundSlam.
function fireGroundPoundRing(boss, index) {
  const player = state.player;
  const phase2 = boss.bossPhase >= 2;
  const ringRadius = boss.radius * (phase2 ? BOSS_POUND_REACH_MULT.p2 : BOSS_POUND_REACH_MULT.p1);
  boss.bossPoundRings = boss.bossPoundRings ?? [];
  boss.bossPoundRings.push({ x: boss.x, y: boss.y, radius: ringRadius, life: 0.35, maxLife: 0.35 });
  const dist = Math.hypot(player.x - boss.x, player.y - boss.y);
  if (dist <= ringRadius + playerHitRadius()) {
    const damage = Math.round(boss.damage * (phase2 ? 0.85 : 0.6));
    damagePlayer(damage, boss.x, boss.y, "Nibbler King");
  }
  addShake(5, true);
  playSfx("explosion");
  burst(boss.x, boss.y, "#ff6a5f", 14);
}

// Per-frame ticker for groundPoundShockwave, called from updateNibblerKingBehavior's "strike"
// state -- fires rings 1 and 2 staggered across the strike window, same pattern as
// runSlamComboTick.
function runGroundPoundTick(boss, dt) {
  const timing = bossAttackTiming("groundPoundShockwave", boss.bossPhase);
  const ringCount = 3;
  const ringSpacing = timing.strike / ringCount;
  if (boss._poundNextRingAt === undefined) {
    boss._poundNextRingAt = ringSpacing;
  }
  const elapsedInStrike = timing.strike - boss.bossTimer;
  if (boss._poundRingsFired < ringCount - 1 && elapsedInStrike >= boss._poundNextRingAt) {
    boss._poundRingsFired += 1;
    boss._poundNextRingAt += ringSpacing;
    fireGroundPoundRing(boss, boss._poundRingsFired);
  }
}

// Per-frame ticker for crownToss, called from updateNibblerKingBehavior's "strike" state.
// Rather than tracking the crown continuously, this checks two discrete points along the
// out-and-back arc: the outward peak (roughly 40% through the strike) and the return peak
// (roughly 90% through), matching the documented "simplify to 1-2 discrete hit-check points"
// fallback for this attack.
function runCrownTossTick(boss, dt) {
  const player = state.player;
  const phase2 = boss.bossPhase >= 2;
  const timing = bossAttackTiming("crownToss", boss.bossPhase);
  const elapsedInStrike = timing.strike - boss.bossTimer;
  const angle = boss.bossTelegraph?.angle ?? 0;
  const throwRange = boss.bossTelegraph?.throwRange ?? boss.radius * BOSS_CROWN_THROW_MULT;

  const outAt = timing.strike * 0.4;
  const backAt = timing.strike * 0.9;

  if (boss._crownHitsLanded < 1 && elapsedInStrike >= outAt) {
    boss._crownHitsLanded = 1;
    const hitX = boss.x + Math.cos(angle) * throwRange;
    const hitY = boss.y + Math.sin(angle) * throwRange;
    boss.bossCrownPos = { x: hitX, y: hitY };
    const dist = Math.hypot(player.x - hitX, player.y - hitY);
    if (dist <= 40 + playerHitRadius()) {
      const damage = Math.round(boss.damage * (phase2 ? 1.3 : 0.9));
      damagePlayer(damage, hitX, hitY, "Nibbler King");
    }
    burst(hitX, hitY, "#f2c45f", 10);
  } else if (boss._crownHitsLanded < 2 && elapsedInStrike >= backAt) {
    boss._crownHitsLanded = 2;
    boss.bossCrownPos = { x: boss.x, y: boss.y };
    const dist = Math.hypot(player.x - boss.x, player.y - boss.y);
    if (dist <= 40 + playerHitRadius()) {
      const damage = Math.round(boss.damage * (phase2 ? 1.3 : 0.9));
      damagePlayer(damage, boss.x, boss.y, "Nibbler King");
    }
    burst(boss.x, boss.y, "#f2c45f", 10);
  } else if (elapsedInStrike < outAt) {
    // In-flight toward the peak: interpolate for the render step (drawn in js/08-render.js).
    const p = clamp(elapsedInStrike / outAt, 0, 1);
    boss.bossCrownPos = { x: boss.x + Math.cos(angle) * throwRange * p, y: boss.y + Math.sin(angle) * throwRange * p };
  } else if (elapsedInStrike < backAt) {
    const p = clamp((elapsedInStrike - outAt) / (backAt - outAt), 0, 1);
    boss.bossCrownPos = {
      x: boss.x + Math.cos(angle) * throwRange * (1 - p),
      y: boss.y + Math.sin(angle) * throwRange * (1 - p)
    };
  }
}

// Fires pulse N (0-3) of the stomp quake: a small fixed-radius tremor right around the boss,
// same distance-check convention as spinSweep but much shorter range and lower per-hit damage
// since it fires several times in quick succession.
function fireStompQuakePulse(boss, index) {
  const player = state.player;
  const phase2 = boss.bossPhase >= 2;
  const quakeRadius = boss.radius * BOSS_QUAKE_REACH_MULT;
  const dist = Math.hypot(player.x - boss.x, player.y - boss.y);
  if (dist <= quakeRadius + playerHitRadius()) {
    // 0.65/0.45x (down from 0.7/0.5x, v0.18.0 no-one-shot pass): this fires 4 pulses per strike,
    // and at 0.7x the phase-2 chain totalled 96 damage -- over a lean ~90 HP build's entire
    // health bar. At 0.65x the full 4-pulse chain is 88 phase-2 / 61 phase-1, safely under.
    const damage = Math.round(boss.damage * (phase2 ? 0.65 : 0.45));
    damagePlayer(damage, boss.x, boss.y, "Nibbler King");
  }
  boss.bossQuakeRing = { x: boss.x, y: boss.y, radius: quakeRadius, life: 0.25, maxLife: 0.25 };
  addShake(4, true);
  playSfx("hit");
  burst(boss.x, boss.y, "#ff9c5b", 10);
}

// Per-frame ticker for stompQuake, called from updateNibblerKingBehavior's "strike" state --
// fires 3 more pulses (4 total, pulse 0 already fired in executeBossStrike) evenly spaced
// across the strike window, same pattern as runSlamComboTick/runGroundPoundTick.
function runStompQuakeTick(boss, dt) {
  const timing = bossAttackTiming("stompQuake", boss.bossPhase);
  const pulseCount = 4;
  const pulseSpacing = timing.strike / pulseCount;
  if (boss._quakeNextPulseAt === undefined) {
    boss._quakeNextPulseAt = pulseSpacing;
  }
  const elapsedInStrike = timing.strike - boss.bossTimer;
  if (boss._quakePulsesFired < pulseCount - 1 && elapsedInStrike >= boss._quakeNextPulseAt) {
    boss._quakePulsesFired += 1;
    boss._quakeNextPulseAt += pulseSpacing;
    fireStompQuakePulse(boss, boss._quakePulsesFired);
  }
}

// Per-frame ticker for laserSweep, called from updateNibblerKingBehavior's "strike" state.
// Rotates a line from telegraph.startAngle to telegraph.endAngle over the strike window and
// checks the player's distance to that line segment every frame -- unlike the other multi-tick
// attacks (slamCombo/groundPound/stompQuake) this isn't discrete hit points, it's a continuously
// moving hazard, so it uses a single "already hit this strike" guard (boss._laserHitLanded)
// instead of a hit counter: touching the beam at any point during the sweep lands exactly one
// hit, same one-hit-per-strike contract as every other melee attack in the kit.
function runLaserSweepTick(boss, dt) {
  const player = state.player;
  const phase2 = boss.bossPhase >= 2;
  const timing = bossAttackTiming("laserSweep", boss.bossPhase);
  const telegraph = boss.bossTelegraph;
  if (!telegraph || telegraph.kind !== "laserSweep") return;
  const elapsedInStrike = timing.strike - boss.bossTimer;
  const p = clamp(elapsedInStrike / timing.strike, 0, 1);
  const angle = telegraph.startAngle + (telegraph.endAngle - telegraph.startAngle) * p;
  boss.bossLaserAngle = angle; // read by js/08-render.js to draw the live beam
  const range = telegraph.range ?? boss.radius * BOSS_LASER_REACH_MULT;

  if (!boss._laserHitLanded) {
    // Distance from the player to the line SEGMENT from the boss out to `range` along `angle`,
    // clamped to the segment (not the infinite line), then compared against the player's hit
    // radius plus a fixed beam thickness.
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const toPlayerX = player.x - boss.x;
    const toPlayerY = player.y - boss.y;
    const along = clamp(toPlayerX * dx + toPlayerY * dy, 0, range);
    const closestX = boss.x + dx * along;
    const closestY = boss.y + dy * along;
    const dist = Math.hypot(player.x - closestX, player.y - closestY);
    const beamThickness = 26;
    if (dist <= beamThickness + playerHitRadius()) {
      boss._laserHitLanded = true;
      const damage = Math.round(boss.damage * (phase2 ? 1.4 : 1.1));
      damagePlayer(damage, closestX, closestY, "Nibbler King");
      burst(closestX, closestY, "#7ef2ff", 12);
    }
  }
}

// Fires round N (0-2) of the triple volley: a single fast aimed shot at the player's position
// AT THE MOMENT OF FIRING (not homing), same convention as shootBossPellet.
function fireTripleVolleyRound(boss, index) {
  const player = state.player;
  const phase2 = boss.bossPhase >= 2;
  const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
  shootBossPellet(boss, angle, phase2);
  const bullet = state.enemyBullets[state.enemyBullets.length - 1];
  if (bullet) {
    // A bit lighter per-shot than a seedSpray pellet since these come 3 in a row -- see the
    // no-one-shot chain math in the final report.
    bullet.damage = Math.round(boss.damage * (phase2 ? 0.4 : 0.32));
  }
  playSfx("shoot");
}

// Per-frame ticker for tripleVolley, called from updateNibblerKingBehavior's "strike" state --
// fires rounds 1 and 2 evenly spaced across the strike window, same pattern as
// runSlamComboTick/runStompQuakeTick.
function runTripleVolleyTick(boss, dt) {
  const timing = bossAttackTiming("tripleVolley", boss.bossPhase);
  const roundCount = 3;
  const roundSpacing = timing.strike / roundCount;
  if (boss._volleyNextRoundAt === undefined) {
    boss._volleyNextRoundAt = roundSpacing;
  }
  const elapsedInStrike = timing.strike - boss.bossTimer;
  if (boss._volleyRoundsFired < roundCount - 1 && elapsedInStrike >= boss._volleyNextRoundAt) {
    boss._volleyRoundsFired += 1;
    boss._volleyNextRoundAt += roundSpacing;
    fireTripleVolleyRound(boss, boss._volleyRoundsFired);
  }
}

// SLAM COMBO's per-frame ticker, called from updateNibblerKingBehavior's "strike" state while
// bossAttack === "slamCombo". The 3 hits are spaced evenly across the strike window (hit 0 has
// already landed in executeBossStrike at strike-start) so the combo reads as 3 distinct blows
// rather than one lump of damage.
function runSlamComboTick(boss, dt) {
  const timing = bossAttackTiming("slamCombo", boss.bossPhase);
  const hitCount = 3;
  const hitSpacing = timing.strike / hitCount;
  if (boss._comboNextHitAt === undefined) {
    boss._comboNextHitAt = hitSpacing;
  }
  const elapsedInStrike = timing.strike - boss.bossTimer;
  if (boss._comboHitsLanded < hitCount - 1 && elapsedInStrike >= boss._comboNextHitAt) {
    boss._comboHitsLanded += 1;
    boss._comboNextHitAt += hitSpacing;
    if (boss.bossTelegraph) boss.bossTelegraph.hit = boss._comboHitsLanded;
    landSlamComboHit(boss, boss._comboHitsLanded);
  }
}

// Lands one hit of the slam combo (index 0/1/2). Same club-segment hit test as weaponSwing
// (v0.19.0 club-hit rework), just at each combo swing's own angle, with a lower per-hit
// damage since a player caught flat-footed can take more than one of these in a row.
// v0.19.1 club-angle-sync fix: this still fires once per hit at a fixed checkpoint (not tested
// every frame like weaponSwing now is -- runSlamComboTick's 3 evenly-spaced checkpoints already
// land near the visual peak of each of the 3 tweened sub-swings, and each hit's own damage
// window is much shorter than weaponSwing's single strike, so the "wound back at strike-start"
// failure mode doesn't apply the same way here). What DOES change: it now reads the shared
// nibblerKingClubAngle(boss) -- the exact angle the renderer is drawing the club at THIS
// instant -- instead of the raw, un-eased angles[index] telegraph value, so the checkpoint hit
// test matches what's on screen at the moment it fires rather than the combo's final rest angle.
function landSlamComboHit(boss, index) {
  const player = state.player;
  const phase2 = boss.bossPhase >= 2;
  const angle = (typeof nibblerKingClubAngle === "function" ? nibblerKingClubAngle(boss) : null)
    ?? boss.bossTelegraph?.angles?.[index] ?? Math.atan2(player.y - boss.y, player.x - boss.x);
  let hit = false;
  if (typeof nibblerKingClubGeometry === "function") {
    const geo = nibblerKingClubGeometry(boss, angle);
    const dist = pointToSegmentDistance(player.x, player.y, geo.pivotX, geo.pivotY, geo.tipX, geo.tipY);
    hit = dist <= geo.thickness / 2 + playerHitRadius();
  } else {
    // Fallback: cone from the boss's centre, same convention as weaponSwing's fallback.
    const range = boss.bossTelegraph?.range ?? boss.radius * BOSS_COMBO_REACH_MULT;
    const halfArc = boss.bossTelegraph?.halfArc ?? (phase2 ? BOSS_COMBO_ARC_HALF.p2 : BOSS_COMBO_ARC_HALF.p1);
    const toPlayer = Math.hypot(player.x - boss.x, player.y - boss.y);
    if (toPlayer <= range) {
      const angleDiff = Math.abs(angleDifference(Math.atan2(player.y - boss.y, player.x - boss.x), angle));
      hit = angleDiff <= halfArc;
    }
  }
  // Per-hit latch keyed by index: each of the 3 swings can only land once (mirrors
  // boss._laserHitLanded's pattern), tracked in an array so hit 0/1/2 don't share one flag.
  if (!boss._comboHitLatch) boss._comboHitLatch = [false, false, false];
  if (hit && !boss._comboHitLatch[index]) {
    boss._comboHitLatch[index] = true;
    // 0.85/0.68x (down from 1.0/0.8x, v0.18.0 no-one-shot pass). Per-hit these look mild, but
    // this attack lands up to THREE times and the multiplier has to be read against the full
    // chain, not one swing: at 1.0x the phase-2 combo totalled 102 damage, which meets or
    // exceeds a lean ~90 HP build's ENTIRE health bar from full in one combo. At 0.85x the
    // full chain is 87 phase-2 / 69 phase-1 -- eating all three is still a catastrophic,
    // near-death mistake for the leanest build, but no longer a guaranteed kill, and each
    // individual swing still hurts enough to demand real movement.
    const damage = Math.round(boss.damage * (phase2 ? 0.85 : 0.68));
    damagePlayer(damage, boss.x, boss.y, "Nibbler King");
  }
  const range = boss.bossTelegraph?.range ?? boss.radius * BOSS_COMBO_REACH_MULT;
  playSfx("swing");
  burst(boss.x + Math.cos(angle) * range * 0.6, boss.y + Math.sin(angle) * range * 0.6, "#ff6a5f", 12);
  addShake(4, true);
}

// WEAPON SWING's per-frame ticker (v0.19.1 club-angle-sync fix), called every frame during
// "strike" from updateNibblerKingBehavior (and once from executeBossStrike at strike-start, same
// pattern as runSpinSweepTick below). Previously the swing's damage was tested exactly ONCE, at
// strike-start, against the RAW un-eased telegraph angle -- the worst possible moment, since the
// renderer (drawNibblerKingClub / nibblerKingClubAngle in js/08-render.js) draws the club wound
// back at that instant and only sweeps through to the visible impact angle over the course of
// the strike. Now this reads the SAME shared nibblerKingClubAngle(boss) the renderer draws with,
// every frame, so the player is hit exactly when the swinging club visually reaches them. A
// single latch (boss._swingHitLanded, reset in executeBossStrike's caller/strike-end cleanup)
// means only the first frame the sweeping club touches the player deals damage.
function runWeaponSwingTick(boss) {
  const player = state.player;
  const phase2 = boss.bossPhase >= 2;
  const angle = (typeof nibblerKingClubAngle === "function" ? nibblerKingClubAngle(boss) : null)
    ?? boss.bossTelegraph?.angle ?? Math.atan2(player.y - boss.y, player.x - boss.x);
  let hit = false;
  if (typeof nibblerKingClubGeometry === "function") {
    const geo = nibblerKingClubGeometry(boss, angle);
    const dist = pointToSegmentDistance(player.x, player.y, geo.pivotX, geo.pivotY, geo.tipX, geo.tipY);
    hit = dist <= geo.thickness / 2 + playerHitRadius();
  } else {
    // Fallback: cone from the boss's centre, reading the SAME range/halfArc the telegraph
    // payload carries (see startBossTelegraph) so the check and the drawn warning at least
    // stay in sync with each other even without the club geometry helper.
    const range = boss.bossTelegraph?.range ?? boss.radius * BOSS_CLUB_REACH_MULT;
    const halfArc = boss.bossTelegraph?.halfArc ?? (phase2 ? BOSS_CLUB_ARC_HALF.p2 : BOSS_CLUB_ARC_HALF.p1);
    const toPlayer = Math.hypot(player.x - boss.x, player.y - boss.y);
    if (toPlayer <= range) {
      const angleDiff = Math.abs(angleDifference(Math.atan2(player.y - boss.y, player.x - boss.x), angle));
      hit = angleDiff <= halfArc;
    }
  }
  if (hit && !boss._swingHitLanded) {
    boss._swingHitLanded = true; // latch: this strike can only land once, same pattern as boss._laserHitLanded
    const damage = Math.round(boss.damage * (phase2 ? 2.6 : 2.0));
    damagePlayer(damage, boss.x, boss.y, "Nibbler King");
  }
}

// SPIN SWEEP's per-frame ticker (v0.19.0 club-hit rework), called every frame during "strike"
// from updateNibblerKingBehavior (and once from executeBossStrike at strike-start). The club
// spins continuously (see nibblerKingClubAngle, js/08-render.js -- angle = time * spinRate
// during "strike", spinRate 14), so this reads that SAME shared function (v0.19.1: previously
// reimplemented the formula locally with its own performance.now() call, which could drift from
// the renderer's angle by 6-13 degrees on a slow frame -- see nibblerKingClubAngle's per-frame
// timestamp cache) to get the exact current swing angle each frame, builds the club segment via
// the shared geometry helper, and tests the player against it. A single latch (boss._spinHitLanded,
// reset in executeBossStrike) means only the FIRST frame the sweeping club touches the player deals
// damage -- without it, the player could take damage every single frame the club overlaps them
// (a continuous circle-based tick), which would erase any benefit of dodging out mid-spin.
function runSpinSweepTick(boss) {
  const player = state.player;
  const phase2 = boss.bossPhase >= 2;
  const angle = (typeof nibblerKingClubAngle === "function" ? nibblerKingClubAngle(boss) : null)
    ?? (performance.now() / 1000) * (boss.bossState === "strike" ? 14 : 4);
  let hit = false;
  if (typeof nibblerKingClubGeometry === "function") {
    const geo = nibblerKingClubGeometry(boss, angle);
    const dist = pointToSegmentDistance(player.x, player.y, geo.pivotX, geo.pivotY, geo.tipX, geo.tipY);
    hit = dist <= geo.thickness / 2 + playerHitRadius();
  } else {
    // Fallback: full-circle radius check (the pre-rework behavior) at club reach.
    const range = boss.bossTelegraph?.range ?? boss.radius * (phase2 ? BOSS_SPIN_REACH_MULT.p2 : BOSS_SPIN_REACH_MULT.p1);
    const dist = Math.hypot(player.x - boss.x, player.y - boss.y);
    hit = dist <= range + playerHitRadius();
  }
  if (hit && !boss._spinHitLanded) {
    boss._spinHitLanded = true;
    const damage = Math.round(boss.damage * (phase2 ? 2.0 : 1.5));
    damagePlayer(damage, boss.x, boss.y, "Nibbler King");
  }
}

// Fires a single fast-ish projectile from the boss toward `angle`, reusing the enemy bullet
// pipeline (shootEnemyProjectile) rather than inventing a parallel one -- lands in
// state.enemyBullets and gets movement/collision/removal for free from updateEnemyBullets.
// Damage is expressed as a multiple of the boss's own contact damage, same convention as every
// melee boss attack above, so ranged and melee attacks stay comparable at a glance.
function shootBossPellet(boss, angle, phase2) {
  shootEnemyProjectile(boss, angle);
  const bullet = state.enemyBullets[state.enemyBullets.length - 1];
  if (bullet) {
    bullet.damage = Math.round(boss.damage * (phase2 ? 0.55 : 0.4));
    bullet.kind = "kingSeed";
  }
}

// Fires one arcing lob toward a specific ground spot (used by spitVolley). Reuses
// shootEnemyProjectile for the bullet's plumbing, then overrides velocity so it actually
// travels toward the marked spot instead of a fixed range, and gives it a modest lifetime so it
// despawns shortly after passing the target rather than flying clean across the arena.
function shootBossLob(boss, angle, spot, phase2) {
  shootEnemyProjectile(boss, angle);
  const bullet = state.enemyBullets[state.enemyBullets.length - 1];
  if (!bullet) return;
  const dist = Math.hypot(spot.x - boss.x, spot.y - boss.y);
  const speed = 180;
  const travelTime = Math.max(0.35, dist / speed);
  bullet.vx = ((spot.x - boss.x) / travelTime);
  bullet.vy = ((spot.y - boss.y) / travelTime);
  bullet.life = travelTime + 0.4;
  bullet.damage = Math.round(boss.damage * (phase2 ? 0.7 : 0.55));
  bullet.kind = "kingLob";
}

// Boss death: a bigger, longer death beat than a normal kill, generous scrap already stamped
// onto boss.scrap by spawnNibblerKing, then hands off to endBossFight (js/04-flow.js) which
// flows into the NORMAL post-wave reward sequence (crate -> fortune -> shop) so the player is
// rewarded exactly like finishing any other wave, just after a boss instead of a timer.
function killBossEnemy(boss) {
  playSfx("gameover");
  addShake(14, true);
  for (let i = 0; i < 4; i += 1) {
    window.setTimeout(() => {
      burst(boss.x + rand(-40, 40), boss.y + rand(-40, 40), i % 2 ? "#f2c45f" : "#ff6a5f", 26);
    }, i * 140);
  }
  spawnRing(boss.x, boss.y, "#f2c45f", boss.radius * 1.7, 0.7); // v0.18.0: halved, cosmetic death ring (radius doubled to 132, this keeps the visual proportionate)
  burst(boss.x, boss.y, "#ff6a5f", 40);
  spawnScrapDrop(boss.x, boss.y, boss.scrap);
  showMessage("Nibbler King Defeated!", `+${boss.scrap} scrap`, 2200);
  // NOTE: no dedicated "beat a boss" achievement exists yet in js/03c-achievements.js -- adding
  // one is outside this feature's scope (achievements are their own system), so this
  // deliberately does NOT call unlockAchievement with a borrowed, semantically-wrong id.
  if (typeof endBossFight === "function") {
    endBossFight(false);
  }
}

// Called every frame from update() while state.bossFight is active (in place of the normal
// spawnWaveEnemies). The boss's own attack state machine runs from updateEnemyBehavior via
// the "boss" branch like any other enemy -- this function only owns the periodic tree respawn
// the player explicitly asked for ("trees spawn during the boss wave randomly"), kept modest
// (a handful at a time, well spaced out) so it's scenery, not a spawnWaveEnemies replacement.
const BOSS_TREE_RESPAWN_INTERVAL = 14;

// SIDE-NIBBLER TRICKLE: a steady drip of Nibblers entering from the arena edges throughout the
// boss fight, separate from the boss's own "summonNibblers" attack (which materializes them
// near the boss itself, not at the edges). The timer lives on state.bossFight (same precedent
// as treeTimer above) rather than a module-level variable so it resets cleanly the instant a
// new fight starts (startBossFight in js/04-flow.js creates a fresh state.bossFight object every
// time, so there is nothing to manually reset here).
const BOSS_TRICKLE_INTERVAL_P1 = [1.2, 2.2]; // phase 1: one every 1.2-2.2s
// v0.18.0 phase-2 nibbler flood: tightened from [0.8, 1.5] so the enraged boss visibly floods
// the arena with side-nibblers, not just its own attacks. enemyActiveCap() is the real safety
// valve against runaway enemy count -- see the cap check in updateBossTrickle below -- so
// tightening this interval just means the cap gets reached sooner, not that it's bypassed.
const BOSS_TRICKLE_INTERVAL_P2 = [0.35, 0.7]; // phase 2: much faster, one every 0.35-0.7s
const BOSS_TRICKLE_CAP = 36; // hard cap on trickle-spawned Nibblers alive at once (was 16)

function updateBossFight(dt) {
  if (!state.bossFight) return;
  state.bossFight.treeTimer = (state.bossFight.treeTimer ?? BOSS_TREE_RESPAWN_INTERVAL) - dt;
  if (state.bossFight.treeTimer <= 0) {
    state.bossFight.treeTimer = BOSS_TREE_RESPAWN_INTERVAL * rand(0.85, 1.25);
    if (state.trees.length < 6) {
      const count = 1 + Math.floor(rand(0, 2)); // 1-2 at a time, modest
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
  }

  updateBossTrickle(dt);
}

// Ticks the side-nibbler trickle timer and spawns one Nibbler from a random arena edge when it
// elapses, respecting both the trickle's own hard cap and the shared enemyActiveCap(). Reuses
// spawnEnemy's own default edge-positioning (called here with no presetPos, exactly like a
// normal wave spawn) rather than inventing new placement logic.
function updateBossTrickle(dt) {
  const bossFight = state.bossFight;
  const boss = state.enemies.find((e) => e.behavior === "boss");
  // v0.20.0: don't pressure the player while the King is still arriving. Before this gate, the
  // trickle timer (seeded ~1.2-2.2s, see startBossFight) could fire WHILE the boss was still
  // dropping in (0.6s arrival) + sitting in its opening idle window (0.6-1.2s) -- so nibblers
  // started chipping the player before the boss had thrown a single attack. Simply not ticking
  // during "arriving" holds the timer at whatever it was seeded to until the boss actually lands.
  if (boss?.bossState === "arriving") return;
  const phase2 = (boss?.bossPhase ?? 1) >= 2;
  const [minInterval, maxInterval] = phase2 ? BOSS_TRICKLE_INTERVAL_P2 : BOSS_TRICKLE_INTERVAL_P1;

  bossFight.trickleTimer = (bossFight.trickleTimer ?? rand(minInterval, maxInterval)) - dt;
  if (bossFight.trickleTimer > 0) return;
  bossFight.trickleTimer = rand(minInterval, maxInterval);

  const trickleAlive = state.enemies.filter((e) => e._bossTrickle).length;
  if (trickleAlive >= BOSS_TRICKLE_CAP) return;
  if (state.enemies.length >= enemyActiveCap()) return;

  const nibblerTemplate = enemyTypes.find((type) => type.name === "Nibbler");
  if (!nibblerTemplate) return;
  spawnEnemy(nibblerTemplate); // no presetPos -- reuses spawnEnemy's own random-edge placement
  const spawned = state.enemies[state.enemies.length - 1];
  spawned._bossTrickle = true; // tags it so the cap above only counts trickle spawns, not the
                                // boss's own summonNibblers/nibblerLaunch adds or the boss itself
}
