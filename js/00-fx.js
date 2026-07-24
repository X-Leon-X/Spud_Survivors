"use strict";

// fx.js - screen shake, hit feedback, pause flag, and run statistics tracking

const fx = {
  shake: 0,
  playerFlash: 0
};

let paused = false;

function addShake(amount) {
  if (!gameSettings.screenShake) return;
  fx.shake = Math.min(16, fx.shake + amount);
}

function decayFx(dt) {
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
    facing: state.player && state.player.x < enemy.x ? -1 : 1,
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
    timePlayed: 0,
    damageBySource: {}
  };
}

function trackDamage(source, amount) {
  const stats = state?.runStats;
  if (!stats || !(amount > 0)) return;
  const key = source ?? "Other";
  stats.damageBySource[key] = (stats.damageBySource[key] ?? 0) + amount;
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
