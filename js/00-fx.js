"use strict";

// fx.js - screen shake, hit feedback, pause flag, and run statistics tracking

const fx = {
  shake: 0,
  playerFlash: 0
};

let paused = false;

// Shake ACCUMULATES, and the per-kill shake fires once per enemy. Late waves kill well over
// a hundred enemies a second, which outruns the decay and pins the screen at the ceiling for
// the whole wave: measured at 150 kills/sec it sat at 13.9 of a possible 16, permanently.
// Early waves were never the problem (below ~20 kills/sec the decay keeps up and shake sits
// near zero), so the ceiling is what scales, not the individual amounts. Big one-off hits
// (taking damage, dying, explosions) still read clearly because they ask for a lot at once.
const SHAKE_CAP_EARLY = 16;
const SHAKE_CAP_LATE = 6.5;

function shakeCap() {
  const wave = Math.max(1, state?.wave ?? 1);
  // Full range until wave 6, then ease down to the late-wave ceiling by wave 16.
  const t = Math.min(1, Math.max(0, (wave - 6) / 10));
  return SHAKE_CAP_EARLY + (SHAKE_CAP_LATE - SHAKE_CAP_EARLY) * t;
}

// Two ceilings, because two different things use shake. The ambient cap tames the constant
// churn of hundreds of kills a second. A one-off event (taking a hit, dying, an explosion)
// is the whole point of shake and must still read as distinct from that churn, so a single
// big request is allowed above the ambient ceiling -- it just decays back under it fast.
function shakeBurstCap() {
  return Math.max(shakeCap(), 11);
}

function addShake(amount, burst = false) {
  if (!gameSettings.screenShake) return;
  const cap = burst ? shakeBurstCap() : shakeCap();
  fx.shake = Math.min(cap, fx.shake + amount);
}

function decayFx(dt) {
  // Clamp here too, not just in addShake: shake built up under a higher cap (or before the
  // wave advanced) would otherwise ride above the current ceiling until it decayed past it.
  fx.shake = Math.min(fx.shake, shakeCap());
  fx.shake = Math.max(0, fx.shake - dt * 30 - fx.shake * dt * 6);
  fx.playerFlash = Math.max(0, fx.playerFlash - dt * 3.2);
}

function spawnRing(x, y, color, maxRadius, life = 0.3) {
  state.particles.push({
    type: "ring",
    x,
    y,
    vx: 0,
    vy: 0,
    color,
    radius: 4,
    maxRadius,
    life,
    maxLife: life
  });
}

// Muzzle flash: a short-lived oriented burst at the gun barrel when it fires. Drawn as a
// bright star/cone pointing along the shot so shooting reads with a snappy pop of light,
// plus a couple of spark streaks. `angle` is the shot direction (radians).
function spawnMuzzleFlash(x, y, angle, color = "#ffe6a0", size = 1) {
  state.particles.push({
    type: "muzzle",
    x,
    y,
    vx: 0,
    vy: 0,
    angle,
    color,
    size,
    life: 0.09,
    maxLife: 0.09
  });
  // a few forward spark streaks for extra energy
  for (let i = 0; i < 3; i += 1) {
    const spread = (Math.sin(x * 0.7 + i * 2.3) * 0.5) * 0.5;   // deterministic jitter
    const spd = 120 + i * 40;
    state.particles.push({
      type: "spark",
      x,
      y,
      vx: Math.cos(angle + spread) * spd,
      vy: Math.sin(angle + spread) * spd,
      color,
      radius: 2.2 - i * 0.4,
      life: 0.14,
      maxLife: 0.14
    });
  }
}

// Death pop: keeps the enemy's sprite on screen for a moment so it can squash,
// spin slightly, and fade instead of vanishing on the frame it dies.
function spawnEnemyDeath(enemy) {
  if (!state.enemyDeaths) return;
  if (state.enemyDeaths.length > 40) state.enemyDeaths.shift();
  state.enemyDeaths.push({
    name: enemy.name,
    x: enemy.x,
    y: enemy.y,
    radius: enemy.radius,
    color: enemy.color,
    bob: enemy.bob,
    // Same orientation correction the live sprite uses, so left-facing art (the Darter)
    // doesn't snap around the moment it dies.
    facing: (state.player && state.player.x < enemy.x ? -1 : 1) * enemyArtFacingSign(enemy.name),
    life: 0.28,
    maxLife: 0.28
  });
}

function updateEnemyDeaths(dt) {
  const list = state.enemyDeaths;
  if (!list) return;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    list[i].life -= dt;
    if (list[i].life <= 0) list.splice(i, 1);
  }
}

function freshRunStats() {
  return {
    kills: 0,
    scrapEarned: 0,
    wastedApples: 0,
    timePlayed: 0,
    damageBySource: {},
    // Kept separate from damageBySource: that map is damage the player DEALT, and mixing
    // harm they received into it would inflate their own weapon totals.
    damageTakenBySource: {},
    // Per-wave (not per-run) counter reset in startWave, used to detect an untouched wave.
    damageTakenThisWave: 0,
    // Apples eaten while already on full HP - the healing is wasted, which is the joke.
    wastedApples: 0
  };
}

function trackDamage(source, amount) {
  const stats = state?.runStats;
  if (!stats || !(amount > 0)) return;
  const key = source ?? "Other";
  stats.damageBySource[key] = (stats.damageBySource[key] ?? 0) + amount;
}

function trackDamageTaken(source, amount) {
  const stats = state?.runStats;
  if (!stats || !(amount > 0)) return;
  const key = source ?? "Unknown";
  stats.damageTakenBySource[key] = (stats.damageTakenBySource[key] ?? 0) + amount;
  stats.damageTakenThisWave = (stats.damageTakenThisWave ?? 0) + amount;
  if (typeof unlockAchievement === "function") unlockAchievement("ouch");
}

function trackScrap(amount) {
  const stats = state?.runStats;
  if (!stats || !(amount > 0)) return;
  stats.scrapEarned += amount;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
