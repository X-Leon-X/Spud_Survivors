"use strict";

// title-slimes.js - free-roaming slimes on the title screen's full-bleed background layer.
//
// Deliberately separate from the enemies in 09b-title.js: those live on #titleStage, a
// 360x300 canvas parked around the potato, so they can never leave the middle of the
// screen. These get their own full-size canvas behind the title content and glide across
// the whole thing. Clicking the "o" in "Move" (bottom footer) adds another one.

const titleSlimes = [];
const TITLE_SLIME_KINDS = ["Nibbler", "Skitter", "Orbiter", "Darter", "Ember Glob", "Spitter"];
const TITLE_SLIME_MAX = 40;   // generous, but stops a click-spammer melting the framerate
let titleSlimeSeed = 0;
let titleSlimeLastT = null;

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
