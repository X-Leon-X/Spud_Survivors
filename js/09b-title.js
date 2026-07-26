"use strict";

// title.js - the Brotato-inspired title screen: a looping centered potato animation
// (idle bob + orbiting weapons + drifting spore motes) and the Play / Options / Quit menu.

let titleRafId = null;
const titleMotes = [];

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

// One animation frame of the title hero. Reuses drawSpudBody (so it shows the real
// character PNG) and a couple of gently orbiting weapon sprites for life.
function drawTitleFrame(now) {
  const cv = ui.titleStage;
  if (!cv) return;
  const g = cv.getContext("2d");
  const w = cv.width, h = cv.height;
  const t = now / 1000;
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
        const size = 62 * s;
        g.imageSmoothingEnabled = true;
        g.globalAlpha = behind ? 0.82 : 1;
        g.drawImage(art, -size / 2, -size / 2, size, size);
      }
      g.restore();
    }
  };

  drawGear(true);   // weapons behind the hero

  // The hero: idle bob + slight lean, drawn via the shared body renderer (PNG art).
  const bob = Math.sin(t * 1.8) * 5;
  const lean = Math.sin(t * 1.1) * 0.05;
  g.save();
  g.translate(cx, cy + bob);
  g.rotate(lean);
  const scale = 1.7 * breath;
  g.scale(scale, scale * (1 - Math.sin(t * 1.8) * 0.02));
  drawSpudBody(g, hero);
  g.restore();

  drawGear(false);  // weapons in front
}

function titleLoop(now) {
  if (state.mode !== "title") { titleRafId = null; return; }
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

// Browser games can't truly "quit". Fade the menu to a goodbye card the player can
// dismiss to return — closest sensible behaviour.
function quitToFarewell() {
  const inner = ui.titleScreen.querySelector(".title-inner");
  const menu = ui.titleScreen.querySelector(".title-menu");
  if (!menu || menu.dataset.farewell) return;
  menu.dataset.farewell = "1";
  menu.innerHTML = `
    <p style="text-align:center;font-weight:800;line-height:1.4;margin:0 0 4px;color:var(--cream)">
      Thanks for playing,<br>brave potato. 🥔
    </p>
    <button type="button" class="title-btn title-btn-primary" id="titleReturnButton">Back to Menu</button>
  `;
  inner.querySelector("#titleReturnButton").addEventListener("click", () => {
    playSfx("click");
    location.reload();
  });
}

// ---- Intro cinematic ----------------------------------------------------------------
// A short presenter gag that plays every launch (skippable) before the title menu:
//   1. "Leon & Company present"                         (fade in / hold / fade out)
//   2. "Brotato ripoff"                                 (pop in + vine-boom SFX)
//   3. it falls off screen, replaced by
//      "I mean, Spud Survivors, a totally original game" (fade in / hold)
//   4. fade the whole overlay out into the normal title menu.
const VINE_BOOM_SRC = "assets/audio/vine_boom.mp3";

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

  // Card 1: "Leon & Company present"
  setLine("Leon & Company present", "intro-fade-in");
  at(1900, () => setLine("Leon & Company present", "intro-fade-out"));

  // Card 2: "Brotato ripoff" + vine boom
  at(2700, () => {
    setLine("Brotato ripoff", "intro-pop");
    playClip(VINE_BOOM_SRC, { gain: 0.9 }).then((ok) => { if (!ok) synthVineBoom(); });
  });

  // Card 2 drops off the screen
  at(4100, () => setLine("Brotato ripoff", "intro-drop"));

  // Card 3: the "correction"
  at(4850, () => setLine("I mean, Spud Survivors, a totally original game", "intro-fade-in"));

  // Hold, then hand off to the menu.
  at(7700, finish);
}

// Boot: this file loads last, so showTitleScreen/initTitleControls are defined by now.
initTitleControls();
playIntroThenTitle();
