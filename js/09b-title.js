"use strict";

// title.js - the Brotato-inspired title screen: a looping centered potato animation
// (idle bob + orbiting weapons + drifting spore motes + roaming enemy blobs) and the
// Play / Options / Quit menu, plus a couple of click interactions (shoot the "O",
// pulse the potato) layered on top of the same canvas.

let titleRafId = null;
const titleMotes = [];
const titleEnemies = [];
const titleShots = [];   // projectiles fired by clicking the "O"
const titleBursts = [];  // little particle bursts (enemy deaths, muzzle flash follow-through)

// Potato click-pulse state: a scale bounce that decays back to 1 over time.
let potatoPulseStart = -Infinity;
let titleLastT = null;   // shared per-frame delta-time clock for cosmetic motion (enemies, shots)
const titleHeroHit = { x: 0, y: 0, r: 0 }; // potato's current on-canvas hit circle, refreshed every frame

function initTitleMotes() {
  if (titleMotes.length) return;
  // Deterministic drifting spores that float upward behind the hero. Seeded so they
  // spread across the canvas without Math.random at module load.
  for (let i = 0; i < 16; i += 1) {
    titleMotes.push({
      x: 24 + (i * 53) % 320,
      y: (i * 37) % 300,
      r: 1.4 + (i % 3) * 0.9,
      speed: 8 + (i % 4) * 4,
      sway: 0.6 + (i % 5) * 0.25,
      phase: i * 0.7
    });
  }
}

// Small roaming enemy blobs behind the potato, purely decorative. Reuses the real enemy
// PNGs (enemyArt) so it stays visually consistent with the arena, but does NOT touch
// state.enemies or any combat code -- these are self-contained title-screen props.
// Each gets its own motion style (bounce / crawl / hop) driven off a deterministic seed,
// matching initTitleMotes's no-Math.random-at-load-time approach.
const TITLE_ENEMY_KINDS = ["Nibbler", "Skitter", "Orbiter", "Darter"];
const TITLE_ENEMY_STYLES = ["bounce", "crawl", "hop"];
// The title screen used to keep a few small blobs on #titleStage (360x300), but they were
// boxed in around the potato and read as clutter. The roaming slimes on the full-bleed
// background layer (09c-title-slimes.js) replaced them, so this is now a no-op kept only
// so the existing call sites stay valid.
function initTitleEnemies() {}

// Advances one title-screen enemy's position per its motion style. dt is computed once per
// frame by the caller (drawTitleFrame) and passed in -- these are cosmetic-only props, not
// physics, so a clamped per-frame delta is enough.
function stepTitleEnemy(e, t, dt, w, h) {
  const marginX = 16, marginTop = 24, marginBottom = 96; // keep clear of the potato's feet area
  if (e.style === "bounce") {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.x < marginX || e.x > w - marginX) { e.vx *= -1; e.x = Math.max(marginX, Math.min(w - marginX, e.x)); }
    if (e.y < marginTop || e.y > h - marginBottom) { e.vy *= -1; e.y = Math.max(marginTop, Math.min(h - marginBottom, e.y)); }
  } else if (e.style === "crawl") {
    // Crawls back and forth along a low band near the bottom of the stage.
    const groundY = h - 34;
    e.x += e.vx * dt;
    if (e.x < marginX || e.x > w - marginX) { e.vx *= -1; e.x = Math.max(marginX, Math.min(w - marginX, e.x)); }
    e.y = groundY + Math.sin(t * 3 + e.phase) * 2;
  } else if (e.style === "hop") {
    // Hops sideways in little arcs instead of gliding smoothly.
    const cyclePos = (t * 1.4 + e.phase) % 1;
    const hopHeight = Math.sin(cyclePos * Math.PI) * 16;
    e.x += e.vx * dt * 0.6;
    if (e.x < marginX || e.x > w - marginX) { e.vx *= -1; e.x = Math.max(marginX, Math.min(w - marginX, e.x)); }
    e.baseY = e.baseY ?? e.y;
    e.y = e.baseY - hopHeight;
  }
}

function respawnTitleEnemy(e, t) {
  e.alive = true;
  e.respawnAt = 0;
  e.hitFlash = 0;
  delete e.baseY; // let the "hop" style re-anchor its bounce height at the new position
  // Re-seed a fresh wander position/velocity so it doesn't pop back exactly where it died.
  // t is a seconds-scale float, so scale it up before flooring into the mixing formula --
  // otherwise sub-integer t contributes nothing to the modulo spread.
  const w = 360, h = 300;
  const i = e.id;
  const seed = Math.floor(t * 1000);
  e.x = 20 + ((i * 97 + seed) | 0) % (w - 40);
  e.y = 34 + ((i * 61 + seed) | 0) % (h - 80);
  e.vx = (i % 2 === 0 ? 1 : -1) * (24 + (i * 11) % 20);
  e.vy = (i % 2 === 0 ? -1 : 1) * (16 + (i * 7) % 16);
}

// One animation frame of the title hero. Reuses drawSpudBody (so it shows the real
// character PNG) and a couple of gently orbiting weapon sprites for life.
function drawTitleFrame(now) {
  const cv = ui.titleStage;
  if (!cv) return;
  const g = cv.getContext("2d");
  const w = cv.width, h = cv.height;
  const t = now / 1000;
  const dt = titleLastT == null ? 0 : Math.min(0.05, Math.max(0, t - titleLastT));
  titleLastT = t;
  g.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2 + 22;

  // Drifting spore motes (behind the hero).
  initTitleMotes();
  g.save();
  for (const m of titleMotes) {
    const y = h - ((m.y + t * m.speed) % (h + 20));
    const x = m.x + Math.sin(t * m.sway + m.phase) * 14;
    const twinkle = 0.35 + Math.sin(t * 2 + m.phase) * 0.25;
    g.globalAlpha = twinkle;
    g.fillStyle = "#bfe6b0";
    g.beginPath();
    g.arc(x, y, m.r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // Soft ground shadow with a subtle breathing scale.
  const breath = 1 + Math.sin(t * 1.4) * 0.06;
  g.save();
  g.fillStyle = "rgba(0, 0, 0, 0.30)";
  g.beginPath();
  g.ellipse(cx, cy + 58, 60 * breath, 15, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // Roaming enemy blobs, drawn BEHIND the hero so they never obscure the mascot. Uses the
  // pure `enemyArt`/`enemyArtConfig` lookups (not drawEnemy from 08-render.js, which is
  // hard-bound to the global game ctx and reads state.enemies) and draws with g.drawImage
  // directly -- the same approach drawSpudBody already uses for the potato.
  initTitleEnemies();
  g.save();
  for (const e of titleEnemies) {
    if (!e.alive) {
      // respawnAt is in the same "t" (seconds) clock as everything else here, NOT the raw
      // rAF `now` timestamp (ms) -- keeping one time domain avoids a unit-mismatch bug.
      if (t >= e.respawnAt) { respawnTitleEnemy(e, t); }
      else if (e.hitFlash > 0) {
        // Dying flash-fade: briefly still drawn (bright, shrinking alpha) before the
        // canvas is empty of it until respawn, so the kill doesn't read as a hard cut.
        const art = enemyArt(e.name);
        if (art) {
          const cfg = enemyArtConfig(e.name);
          const size = 34 * cfg.scale * 0.4;
          g.save();
          g.globalAlpha = e.hitFlash * 0.9;
          g.translate(e.x, e.y);
          g.filter = `brightness(${1 + e.hitFlash * 2.5})`;
          g.drawImage(art, -size / 2, -size / 2 + size * cfg.yOffset, size, size);
          g.restore();
        }
        e.hitFlash = Math.max(0, e.hitFlash - 0.12);
      }
      continue;
    }
    stepTitleEnemy(e, t, dt, w, h);
    const art = enemyArt(e.name);
    if (!art) continue;
    const cfg = enemyArtConfig(e.name);
    // Scaled well down from in-arena size -- these are background flavor, not focal points.
    const size = 34 * cfg.scale * 0.4;
    g.save();
    g.globalAlpha = 0.9;
    g.translate(e.x, e.y);
    g.drawImage(art, -size / 2, -size / 2 + size * cfg.yOffset, size, size);
    g.restore();
  }
  g.restore();

  const hero = characters[0];   // the Sprout starter as the mascot

  // Two weapons orbit slowly around the hero, drawn behind and in front so it reads 3D.
  const orbitR = 78;
  const spin = t * 0.6;
  const gearAngles = [spin, spin + Math.PI];
  const gearNames = ["Spark Peashooter", "Stub Club"];
  const drawGear = (behind) => {
    for (let i = 0; i < gearAngles.length; i += 1) {
      const a = gearAngles[i];
      const isBehind = Math.sin(a) < 0;      // top half = behind
      if (isBehind !== behind) continue;
      const gx = cx + Math.cos(a) * orbitR;
      const gy = cy + Math.sin(a) * orbitR * 0.42 - 6;
      const art = weaponArenaArt(gearNames[i]);
      g.save();
      g.translate(gx, gy);
      g.rotate(Math.sin(t * 1.6 + i) * 0.18);
      const s = behind ? 0.62 : 0.8;
      if (art) {
        // Aspect-correct fit (see drawWeaponArtFitted): boxSize is the cropped content's
        // longest edge, scaled down from the old canvas-edge 62 since cropping the
        // transparent padding makes the same box read larger on screen.
        const boxSize = 52 * s;
        g.globalAlpha = behind ? 0.82 : 1;
        drawWeaponArtFitted(g, gearNames[i], art, boxSize);
      }
      g.restore();
    }
  };

  drawGear(true);   // weapons behind the hero

  // The hero: idle bob + slight lean, drawn via the shared body renderer (PNG art).
  const bob = Math.sin(t * 1.8) * 5;
  const lean = Math.sin(t * 1.1) * 0.05;
  // Click-pulse: a decaying damped scale bounce layered on top of the idle breathing scale.
  // elapsed goes to +Infinity once fully decayed, at which point pulse settles to exactly 0.
  const pulseElapsed = t - potatoPulseStart;
  const pulse = pulseElapsed >= 0 && pulseElapsed < 0.6
    ? Math.sin(pulseElapsed * Math.PI * 5) * Math.exp(-pulseElapsed * 6) * 0.16
    : 0;
  g.save();
  g.translate(cx, cy + bob);
  g.rotate(lean);
  const scale = 1.7 * breath * (1 + pulse);
  g.scale(scale, scale * (1 - Math.sin(t * 1.8) * 0.02));
  drawSpudBody(g, hero);
  g.restore();

  drawGear(false);  // weapons in front

  // Expose the potato's current on-canvas hit circle for click handling (see titleStage
  // pointerdown listener below) -- recomputed every frame since bob/breath animate it.
  titleHeroHit.x = cx;
  titleHeroHit.y = cy + bob;
  titleHeroHit.r = 34 * scale; // roughly matches the 88px sprite's visible body radius

  // Projectiles fired by clicking the "O" (task 4): simple lerp from muzzle to target,
  // drawn on top of everything so they read clearly against hero/enemies alike.
  for (let i = titleShots.length - 1; i >= 0; i -= 1) {
    const s = titleShots[i];
    const p = Math.min(1, (t - s.start) / s.duration);
    const x = s.x0 + (s.x1 - s.x0) * p;
    const y = s.y0 + (s.y1 - s.y0) * p - Math.sin(p * Math.PI) * 18; // gentle arc
    g.save();
    g.fillStyle = "#ffe37a";
    g.strokeStyle = "rgba(255, 227, 122, 0.5)";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - (s.x1 - s.x0) * 0.06, y - (s.y1 - s.y0) * 0.06 + Math.sin(p * Math.PI) * 2);
    g.stroke();
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
    if (p >= 1) {
      titleShots.splice(i, 1);
      onTitleShotLanded(s);
    }
  }

  // Little radial particle bursts (muzzle flash follow-through + enemy deaths).
  for (let i = titleBursts.length - 1; i >= 0; i -= 1) {
    const b = titleBursts[i];
    const p = (t - b.start) / b.duration;
    if (p >= 1) { titleBursts.splice(i, 1); continue; }
    g.save();
    g.globalAlpha = 1 - p;
    g.fillStyle = b.color;
    for (let k = 0; k < b.count; k += 1) {
      const a = (Math.PI * 2 * k) / b.count;
      const dist = p * b.radius;
      g.beginPath();
      g.arc(b.x + Math.cos(a) * dist, b.y + Math.sin(a) * dist, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
}

// A fired shot reached its target: kill the enemy (little burst + respawn timer) or, if it
// somehow has no target anymore (e.g. all enemies were mid-respawn when fired), just fizzle.
function onTitleShotLanded(shot) {
  const e = titleEnemies.find((en) => en.id === shot.targetId);
  playSfx("kill");
  if (e && e.alive) {
    // Flash bright for a couple of frames, then vanish -- the fade-out overlaps the burst
    // particle effect below so the "kill" reads as one continuous beat, not a hard cut.
    e.hitFlash = 1;
    e.alive = false;
    e.respawnAt = shot.landT + 2.2 + (e.id % 3) * 0.4; // staggered so they don't pop back in unison
    titleBursts.push({ x: e.x, y: e.y, start: shot.landT, duration: 0.4, radius: 20, color: "#ffb36b", count: 8 });
  } else {
    // No live enemy at the target point anymore -- still show a small burst so the click felt like it did something.
    titleBursts.push({ x: shot.x1, y: shot.y1, start: shot.landT, duration: 0.3, radius: 12, color: "#ffe37a", count: 5 });
  }
}

// Fires a shot from the "O" letter (in canvas space) at a random living title-screen enemy.
// Called by the pointerdown handler wired in initTitleInteractions, which does the DOM ->
// canvas coordinate conversion.
function fireTitleShotFrom(x0, y0) {
  const alive = titleEnemies.filter((e) => e.alive);
  const target = alive.length
    ? alive[Math.floor(Math.abs(Math.sin(x0 * 12.9898 + y0 * 78.233)) * alive.length) % alive.length]
    : null;
  const cv = ui.titleStage;
  const now = cv ? performance.now() : Date.now();
  const t = now / 1000;
  const x1 = target ? target.x : x0;
  const y1 = target ? target.y : y0 - 40;
  const duration = 0.35;
  titleShots.push({
    x0, y0, x1, y1,
    start: t,
    duration,
    landT: t + duration,
    targetId: target ? target.id : -1
  });
  playSfx("shoot");
}

// Wires up the two click interactions that need DOM<->canvas coordinate bridging:
//  - clicking the potato (canvas-space hit test) pulses it
//  - clicking the "O" span (DOM element) fires a shot that starts at the O's screen
//    position, converted into titleStage canvas coordinates.
// Both need the canvas's CSS scale factor since #titleStage is displayed smaller than its
// backing resolution (width: min(360px, 72vw) in styles.css).
function initTitleInteractions() {
  const cv = ui.titleStage;
  const oSpan = document.getElementById("titleO");
  if (!cv) return;

  const toCanvasSpace = (clientX, clientY) => {
    const rect = cv.getBoundingClientRect();
    const scaleX = cv.width / rect.width;
    const scaleY = cv.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  cv.addEventListener("pointerdown", (ev) => {
    if (state.mode !== "title") return;
    const { x, y } = toCanvasSpace(ev.clientX, ev.clientY);
    const dx = x - titleHeroHit.x, dy = y - titleHeroHit.y;
    if (dx * dx + dy * dy <= titleHeroHit.r * titleHeroHit.r) {
      potatoPulseStart = performance.now() / 1000;
      playSfx("click");
    }
  });

  if (oSpan) {
    oSpan.addEventListener("pointerdown", (ev) => {
      // The O sits inside the DOM title, not the canvas -- stop the click from also being
      // interpreted as "clicked the page" elsewhere, and don't let it bubble into anything
      // that treats title clicks as menu navigation.
      ev.stopPropagation();
      if (state.mode !== "title") return;
      const oRect = oSpan.getBoundingClientRect();
      // Fire on the FULL-BLEED slime layer, not #titleStage: the roaming slimes are the
      // only enemies left on the title screen and they live on that bigger canvas.
      if (typeof fireSlimeShotFromElement === "function") fireSlimeShotFromElement(oSpan);
      oSpan.classList.remove("title-o-flash");
      // Force reflow so re-adding the class restarts the animation on rapid repeat clicks.
      void oSpan.offsetWidth;
      oSpan.classList.add("title-o-flash");
    });
  }
}

function titleLoop(now) {
  if (state.mode !== "title") { titleRafId = null; return; }
  // Full-bleed roaming slimes live on their own background canvas (09c-title-slimes.js)
  // because #titleStage is only 360x300 and can never reach the screen edges.
  if (typeof drawTitleSlimeLayer === "function") drawTitleSlimeLayer(now);
  drawTitleFrame(now);
  titleRafId = requestAnimationFrame(titleLoop);
}

function showTitleScreen() {
  state = freshState();
  state.mode = "title";
  hideShop();
  hideReward();
  hideMessage();
  hideSummary();
  setPaused(false);
  ui.startMenu.classList.add("hidden");
  ui.titleOptions.classList.add("hidden");
  ui.titleScreen.classList.remove("hidden");
  syncTitleOptionControls();
  if (!titleRafId) titleRafId = requestAnimationFrame(titleLoop);
}

function hideTitleScreen() {
  ui.titleScreen.classList.add("hidden");
  ui.titleOptions.classList.add("hidden");
}

// Title "Play" -> character select.
function titlePlay() {
  playSfx("whoosh");
  hideTitleScreen();
  showStartMenu();
}

// Keep the title Options controls in sync with the shared pause-menu settings, and wire
// them to the same gameSettings so changing volume/mute here persists everywhere.
function syncTitleOptionControls() {
  if (ui.titleVolumeSlider) ui.titleVolumeSlider.value = Math.round((gameSettings.volume ?? 1) * 100);
  if (ui.titleMuteToggle) ui.titleMuteToggle.checked = Boolean(gameSettings.muted);
  if (ui.titleShakeToggle) ui.titleShakeToggle.checked = Boolean(gameSettings.screenShake);
}

function initTitleControls() {
  ui.titlePlayButton.addEventListener("click", titlePlay);
  ui.titlePlayButton.addEventListener("pointerenter", () => playSfx("hover"));
  ui.titleOptionsButton.addEventListener("pointerenter", () => playSfx("hover"));
  ui.titleQuitButton.addEventListener("pointerenter", () => playSfx("hover"));

  ui.titleOptionsButton.addEventListener("click", () => {
    playSfx("click");
    syncTitleOptionControls();
    ui.titleOptions.classList.remove("hidden");
  });
  ui.titleOptionsBack.addEventListener("click", () => {
    playSfx("click");
    ui.titleOptions.classList.add("hidden");
  });

  initChangelogControls();
  ui.titleQuitButton.addEventListener("click", () => {
    playSfx("click");
    // No process to exit in a browser: show a friendly farewell overlay on the title.
    quitToFarewell();
  });

  // Title Options -> shared settings.
  ui.titleVolumeSlider.addEventListener("input", (e) => {
    gameSettings.volume = Number(e.target.value) / 100;
    if (ui.volumeSlider) ui.volumeSlider.value = e.target.value;
    applyAudioSettings();
    saveSettings();
  });
  ui.titleMuteToggle.addEventListener("change", (e) => {
    gameSettings.muted = e.target.checked;
    if (ui.muteToggle) ui.muteToggle.checked = e.target.checked;
    applyAudioSettings();
    saveSettings();
  });
  ui.titleShakeToggle.addEventListener("change", (e) => {
    gameSettings.screenShake = e.target.checked;
    if (ui.shakeToggle) ui.shakeToggle.checked = e.target.checked;
    saveSettings();
  });
}

// Browser games can't truly "quit", so Quit gets the same send-off as dying: the bong
// and the gravestone, then straight back to a fresh title screen. Nothing is lost - it
// reads as a themed transition, and showTitleScreen() re-runs freshState() for us.
function quitToFarewell() {
  playGravestone("Here lies the run that never was", showTitleScreen);
}

// ---- Intro cinematic ----------------------------------------------------------------
// A short presenter gag that plays every launch (skippable) before the title menu. Every
// card is pure opacity -- fade in, hold, fade out -- no popping/dropping/other motion:
//   1. "Leon & Company present"                          (fade in / hold / fade out)
//   2. "Brotato ripoff"                                  (fade in / hold / fade out + vine-boom SFX)
//   3. "I mean, Spud Survivors, a totally original game"  (fade in / hold)
//   4. fade the whole overlay out into the normal title menu.
const VINE_BOOM_SRC = "assets/audio/vine_boom.mp3";

// Plays the vine boom (real clip, else synth fallback) at most once. If audio is still
// locked by the browser's autoplay policy (no user gesture yet), it doesn't just get lost:
// it's armed to fire on the first unlock instead (see onAudioUnlocked in 00-audio.js).
let vineBoomPlayed = false;
function playBoomOrArm() {
  if (vineBoomPlayed || gameSettings.muted) return;
  const attempt = () => {
    if (vineBoomPlayed) return;
    vineBoomPlayed = true;
    playClip(VINE_BOOM_SRC, { gain: 0.9 }).then((ok) => { if (!ok) synthVineBoom(); });
  };
  if (audioCtx && audioCtx.state !== "suspended") {
    attempt();
  } else {
    onAudioUnlocked(attempt);
  }
}

function playIntroThenTitle() {
  const overlay = document.getElementById("introCinematic");
  const line = document.getElementById("introLine");
  if (!overlay || !line) { showTitleScreen(); return; }

  let timers = [];
  let finished = false;
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const setLine = (text, cls) => {
    line.textContent = text;
    line.className = "intro-line " + cls;
  };

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    overlay.removeEventListener("pointerdown", finish);
    window.removeEventListener("keydown", onKey);
    // Fade the overlay out, then hand off to the real title screen.
    overlay.style.transition = "opacity 0.4s ease";
    overlay.style.opacity = "0";
    setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.style.transition = "";
      overlay.style.opacity = "";
      showTitleScreen();
    }, 400);
  }
  const onKey = () => finish();

  overlay.classList.remove("hidden");
  overlay.style.opacity = "1";
  overlay.addEventListener("pointerdown", finish);
  window.addEventListener("keydown", onKey);
  // ensureAudio needs a user gesture on some browsers; try, and the boom will play if allowed.
  ensureAudio();

  // All cards are pure fade in -> hold -> fade out (no pop/drop/other motion). Timings
  // keep the same beats as before so the vine-boom still lands exactly on the "Brotato
  // ripoff" reveal (see playBoomOrArm) -- only the CSS classes driving the motion changed.
  // Card 1: "Leon & Company present"
  setLine("Leon & Company present", "intro-fade-in");
  at(1900, () => setLine("Leon & Company present", "intro-fade-out"));

  // Card 2: "Brotato ripoff" + vine boom, fading in on the same beat the pop used to land.
  at(2700, () => {
    setLine("Brotato ripoff", "intro-fade-in");
    playBoomOrArm();
  });
  at(4100, () => setLine("Brotato ripoff", "intro-fade-out"));

  // Card 3: the "correction"
  at(4850, () => setLine("I mean, Spud Survivors, a totally original game", "intro-fade-in"));

  // Hold, then hand off to the menu.
  at(7700, finish);
}

// Boot: this file loads last, so showTitleScreen/initTitleControls are defined by now.
initTitleControls();
initTitleInteractions();

// Show a "click to start" gate before the intro cinematic. Browsers block audio until a
// real user gesture, so the intro's 2700ms vine-boom would otherwise get silently blocked
// on first load. Clicking the gate button unlocks audio synchronously inside the gesture,
// then starts the intro - so the boom plays exactly on cue.
(function bootStartGate() {
  const gate = document.getElementById("startGate");
  const button = document.getElementById("startGateButton");
  if (!gate || !button) {
    // Fallback: no gate present, old behavior.
    playIntroThenTitle();
    return;
  }
  button.addEventListener("click", () => {
    ensureAudio();
    if (typeof unlockAudioNow === "function") unlockAudioNow();
    gate.classList.add("hidden");
    playIntroThenTitle();
  });
})();
