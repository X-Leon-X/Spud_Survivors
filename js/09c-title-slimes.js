"use strict";

// title-slimes.js - free-roaming slimes on the title screen's full-bleed background layer.
//
// Deliberately separate from the enemies in 09b-title.js: those live on #titleStage, a
// 360x300 canvas parked around the potato, so they can never leave the middle of the
// screen. These get their own full-size canvas behind the title content and glide across
// the whole thing. Clicking the "o" in "Move" (bottom footer) adds another one.

const titleSlimes = [];
const TITLE_SLIME_KINDS = ["Nibbler", "Skitter", "Orbiter", "Darter", "Ember Glob", "Spitter"];
// Deliberately high: spawning a swarm is the whole point of the easter egg, so the cap is
// only here as a last-resort guard against a genuinely absurd click-spam session.
const TITLE_SLIME_MAX = 400;
let titleSlimeSeed = 0;
let titleSlimeLastT = null;
const slimeShots = [];    // projectiles fired from the "O" in SURVIVORS
const slimeBursts = [];   // death puffs

// Cheap deterministic-ish spread. Math.random is fine here (unlike the seeded motes, which
// run at module load) because slimes are only ever created from a click or from showTitle.
function spawnTitleSlime(cv, opts = {}) {
  if (!cv || titleSlimes.length >= TITLE_SLIME_MAX) return null;
  const w = cv.width, h = cv.height;
  titleSlimeSeed += 1;
  const name = opts.name ?? TITLE_SLIME_KINDS[titleSlimeSeed % TITLE_SLIME_KINDS.length];
  // Gliding speeds: slow enough to read as drifting, varied enough to not look synced.
  const speed = 26 + Math.random() * 46;
  const angle = Math.random() * Math.PI * 2;
  const slime = {
    name,
    x: opts.x ?? rand(60, w - 60),
    y: opts.y ?? rand(60, h - 60),
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    scale: 0.5 + Math.random() * 0.45,
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.5,
    pop: 0            // spawn-in scale pop, decays to 0
  };
  if (opts.fromX !== undefined) {
    // Spawned by the footer "o": burst upward out of the letter so the source is obvious.
    slime.x = opts.fromX;
    slime.y = opts.fromY;
    const launch = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    const power = 120 + Math.random() * 90;
    slime.vx = Math.cos(launch) * power;
    slime.vy = Math.sin(launch) * power;
    slime.pop = 1;
  }
  titleSlimes.push(slime);
  return slime;
}

function seedTitleSlimes(cv) {
  if (titleSlimes.length || !cv) return;
  for (let i = 0; i < 7; i += 1) spawnTitleSlime(cv);
}

// Free-gliding motion: drift, wall-bounce off all four edges, gentle speed normalisation so
// footer-launched slimes settle into the same lazy drift as the ambient ones.
function stepTitleSlime(s, t, dt, w, h) {
  const r = 26 * s.scale;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  if (s.x < r) { s.x = r; s.vx = Math.abs(s.vx); }
  if (s.x > w - r) { s.x = w - r; s.vx = -Math.abs(s.vx); }
  if (s.y < r) { s.y = r; s.vy = Math.abs(s.vy); }
  if (s.y > h - r) { s.y = h - r; s.vy = -Math.abs(s.vy); }

  // Ease any launch burst back toward a gliding pace instead of ricocheting forever.
  const sp = Math.hypot(s.vx, s.vy);
  if (sp > 80) {
    const k = Math.max(80 / sp, 1 - dt * 0.8);
    s.vx *= k;
    s.vy *= k;
  }
  if (s.pop > 0) s.pop = Math.max(0, s.pop - dt * 2.2);
}

function drawTitleSlimeLayer(now) {
  const cv = document.getElementById("titleSlimeLayer");
  if (!cv) return;
  const g = cv.getContext("2d");
  const w = cv.width, h = cv.height;
  const t = now / 1000;
  const dt = titleSlimeLastT === null ? 0 : Math.min(0.05, t - titleSlimeLastT);
  titleSlimeLastT = t;

  g.clearRect(0, 0, w, h);
  seedTitleSlimes(cv);

  for (const s of titleSlimes) {
    stepTitleSlime(s, t, dt, w, h);

    const art = enemyArt(s.name);
    const cfg = enemyArtConfig(s.name);
    // Squash-and-stretch breathing so they read as gelatinous rather than sliding decals.
    const wobble = Math.sin(t * 2.4 + s.phase) * 0.06;
    const popScale = 1 + s.pop * 0.5;
    const size = 34 * s.scale * (cfg.scale / 2) * popScale;

    g.save();
    g.globalAlpha = 0.5;              // muted so they never fight the logo for attention
    g.translate(s.x, s.y);
    g.rotate(Math.sin(t * 0.8 + s.phase) * 0.08 * s.spin);
    g.scale(1 + wobble, 1 - wobble);
    if (art) {
      g.imageSmoothingEnabled = true;
      g.drawImage(art, -size, -size, size * 2, size * 2);
    } else {
      g.fillStyle = "#88d27a";
      g.beginPath();
      g.ellipse(0, 0, size * 0.8, size * 0.66, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // Shots and death puffs draw on top of the slimes themselves.
  updateSlimeShots(g, t);
  updateSlimeBursts(g, t);
}

// Converts the footer "o"'s on-screen position into slime-layer canvas coordinates, so the
// new slime pops out of the letter itself rather than some fixed spot.
function initFooterSlimeSpawner() {
  const span = document.getElementById("footerO");
  const cv = document.getElementById("titleSlimeLayer");
  if (!span || !cv) return;

  span.addEventListener("click", () => {
    const sr = span.getBoundingClientRect();
    const cr = cv.getBoundingClientRect();
    if (!cr.width || !cr.height) return;
    const scaleX = cv.width / cr.width;
    const scaleY = cv.height / cr.height;
    const fromX = (sr.left + sr.width / 2 - cr.left) * scaleX;
    const fromY = (sr.top + sr.height / 2 - cr.top) * scaleY;

    // Two per click so it feels generous, and it's obvious the letter did something.
    for (let i = 0; i < 2; i += 1) spawnTitleSlime(cv, { fromX, fromY });
    playSfx("coin");
    span.classList.remove("footer-o-pop");
    void span.offsetWidth;
    span.classList.add("footer-o-pop");
  });
}

// Boots from this file rather than 09b-title.js's init block: this script loads AFTER that
// one, so its functions don't exist yet when 09b runs its own boot lines.
initFooterSlimeSpawner();

// ---- Shooting the "O" in SURVIVORS -------------------------------------------------
// The O now targets these full-screen slimes rather than the old stage-bound blobs, so a
// shot can cross the entire title screen to reach something near the edges.

// Converts a DOM element's centre into slime-layer canvas coordinates. Shared by the "O"
// (shoots) and the footer "o" (spawns), since both are DOM text over the same canvas.
function elementToSlimeCanvas(el) {
  const cv = document.getElementById("titleSlimeLayer");
  if (!el || !cv) return null;
  const er = el.getBoundingClientRect();
  const cr = cv.getBoundingClientRect();
  if (!cr.width || !cr.height) return null;
  return {
    cv,
    x: (er.left + er.width / 2 - cr.left) * (cv.width / cr.width),
    y: (er.top + er.height / 2 - cr.top) * (cv.height / cr.height)
  };
}

function fireSlimeShotFromElement(el) {
  const at = elementToSlimeCanvas(el);
  if (!at) return;
  if (!titleSlimes.length) {
    playSfx("shoot");
    return;
  }
  // Nearest slime, so the shot visibly picks a sensible target instead of firing across
  // the whole screen past three closer ones.
  let target = null;
  let best = Infinity;
  for (const s of titleSlimes) {
    const d = (s.x - at.x) ** 2 + (s.y - at.y) ** 2;
    if (d < best) { best = d; target = s; }
  }
  if (!target) return;
  const t = performance.now() / 1000;
  slimeShots.push({
    x0: at.x, y0: at.y,
    target,
    start: t,
    duration: 0.28
  });
  playSfx("shoot");
}

function updateSlimeShots(g, t) {
  for (let i = slimeShots.length - 1; i >= 0; i -= 1) {
    const shot = slimeShots[i];
    const p = (t - shot.start) / shot.duration;
    // Home on the target's CURRENT position so a drifting slime can't be missed.
    const tx = shot.target.x;
    const ty = shot.target.y;
    if (p >= 1) {
      const idx = titleSlimes.indexOf(shot.target);
      if (idx >= 0) {
        titleSlimes.splice(idx, 1);
        slimeBursts.push({ x: tx, y: ty, start: t, duration: 0.45 });
        playSfx("kill");
      }
      slimeShots.splice(i, 1);
      continue;
    }
    const x = shot.x0 + (tx - shot.x0) * p;
    const y = shot.y0 + (ty - shot.y0) * p;
    g.save();
    g.globalAlpha = 0.95;
    g.fillStyle = "#ffe37a";
    g.beginPath();
    g.arc(x, y, 5, 0, Math.PI * 2);
    g.fill();
    // Short motion streak back toward the muzzle.
    g.strokeStyle = "rgba(255, 227, 122, 0.5)";
    g.lineWidth = 3;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - (tx - shot.x0) * 0.06, y - (ty - shot.y0) * 0.06);
    g.stroke();
    g.restore();
  }
}

function updateSlimeBursts(g, t) {
  for (let i = slimeBursts.length - 1; i >= 0; i -= 1) {
    const b = slimeBursts[i];
    const p = (t - b.start) / b.duration;
    if (p >= 1) { slimeBursts.splice(i, 1); continue; }
    g.save();
    g.globalAlpha = (1 - p) * 0.9;
    g.fillStyle = "#ffb36b";
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      const r = 6 + p * 30;
      g.beginPath();
      g.arc(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 3.5 * (1 - p), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}
