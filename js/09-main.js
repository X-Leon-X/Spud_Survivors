"use strict";

// main.js - game loop, pause menu, run summary, input, and boot

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  if (!paused) {
    update(dt);
  }
  draw();
  // Animate any redesigned-PNG icons currently on screen (shop, reward, loadout).
  // Only runs while a menu with such icons is open; the set is empty otherwise.
  if (animatedIcons.size > 0) {
    renderAnimatedIcons(now);
  }
  // Idle-animate the character-select portraits and the Field Market loadout preview
  // (each is a no-op unless its screen is open).
  renderCharacterPortraits(now);
  requestAnimationFrame(loop);
}

// Called by the asset loader when a redesigned PNG finishes loading. Repaint whatever
// menu is open so its cards pick up the art (and the has-art-tile framing) immediately,
// instead of waiting for the next reroll or menu open.
function onArtLoaded() {
  if (!state) return;
  if (state.mode === "shop" && !ui.shop.classList.contains("hidden")) {
    renderShop();
  } else if (state.mode === "reward" && !ui.reward.classList.contains("hidden")) {
    renderLoadout();
  } else if (state.mode === "menu") {
    renderLoadout?.();
  }
}

function setPaused(value) {
  paused = Boolean(value);
  ui.pauseMenu.classList.toggle("hidden", !paused);
}

function togglePause() {
  if (state.mode !== "playing" && !paused) {
    return;
  }
  playSfx("click");
  setPaused(!paused);
}

function showSummary() {
  const stats = state.runStats;
  ui.summary.classList.remove("hidden");
  // Cloud sync, only if signed in. Deliberately NOT awaited and errors are swallowed: a
  // slow or failed request must never delay or break the summary screen.
  if (typeof isLoggedIn === "function" && isLoggedIn()) {
    accountRecordRun({
      character: state.character?.name ?? null,
      wave: state.wave,
      kills: stats.kills,
      scrap: stats.scrapEarned,
      timePlayed: stats.timePlayed
    }).catch(() => {});
    accountPushProgress().catch(() => {});
  }
  ui.summaryTitle.textContent = `${state.character?.name ?? "Spud"} went down`;

  const rows = [
    ["Waves Survived", state.wave],
    ["Time Fighting", formatDuration(stats.timePlayed)],
    ["Enemies Squashed", stats.kills],
    ["Scrap Earned", stats.scrapEarned],
    ["Weapons Carried", state.weapons.length],
    ["Items Collected", state.items.length]
  ];
  ui.summaryStats.innerHTML = rows
    .map(([label, value]) => `
      <div class="summary-stat">
        <span class="summary-stat-value">${value}</span>
        <span class="summary-stat-label">${label}</span>
      </div>
    `)
    .join("");

  const sources = Object.entries(stats.damageBySource)
    .map(([name, amount]) => [name, Math.round(amount)])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxDamage = sources.length ? sources[0][1] : 1;
  ui.summaryWeapons.innerHTML = sources.length
    ? sources
        .map(([name, amount]) => `
          <div class="summary-weapon-row">
            <span class="summary-weapon-name">${name}</span>
            <span class="summary-weapon-bar"><i style="width:${Math.max(3, Math.round((amount / maxDamage) * 100))}%"></i></span>
            <span class="summary-weapon-value">${amount.toLocaleString()}</span>
          </div>
        `)
        .join("")
    : `<p class="summary-empty">No damage dealt. A pacifist potato is a brave potato.</p>`;

  const takenSources = Object.entries(stats.damageTakenBySource ?? {})
    .map(([name, amount]) => [name, Math.round(amount)])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxTaken = takenSources.length ? takenSources[0][1] : 1;
  ui.summaryDamageTaken.innerHTML = takenSources.length
    ? takenSources
        .map(([name, amount]) => `
          <div class="summary-weapon-row">
            <span class="summary-weapon-name">${name}</span>
            <span class="summary-weapon-bar taken"><i style="width:${Math.max(3, Math.round((amount / maxTaken) * 100))}%"></i></span>
            <span class="summary-weapon-value">${amount.toLocaleString()}</span>
          </div>
        `)
        .join("")
    : `<p class="summary-empty">Untouched. Flawless run.</p>`;
}

function hideSummary() {
  ui.summary.classList.add("hidden");
}

function initSettingsControls() {
  ui.volumeSlider.value = Math.round(gameSettings.volume * 100);
  ui.muteToggle.checked = gameSettings.muted;
  ui.shakeToggle.checked = gameSettings.screenShake;

  ui.volumeSlider.addEventListener("input", () => {
    gameSettings.volume = ui.volumeSlider.value / 100;
    applyAudioSettings();
    saveSettings();
    playSfx("click");
  });
  ui.muteToggle.addEventListener("change", () => {
    gameSettings.muted = ui.muteToggle.checked;
    applyAudioSettings();
    saveSettings();
  });
  ui.shakeToggle.addEventListener("change", () => {
    gameSettings.screenShake = ui.shakeToggle.checked;
    if (!gameSettings.screenShake) fx.shake = 0;
    saveSettings();
  });
}

window.addEventListener("keydown", (event) => {
  ensureAudio();
  keys.add(event.code);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === "Escape") {
    togglePause();
  }
  if (event.code === "KeyM") {
    gameSettings.muted = !gameSettings.muted;
    ui.muteToggle.checked = gameSettings.muted;
    applyAudioSettings();
    saveSettings();
  }
  if (event.code === "KeyR" && state.mode === "gameover") {
    showStartMenu();
  }
  // PHASE 1 CO-OP: KeyP toggles Player 2 in/out. Works at the title screen and mid-run;
  // deliberately excluded while a text input might have focus (none exist in this game, but
  // guarding on state.mode keeps it from firing during, say, the pause/shop/reward overlays
  // where a stray P shouldn't silently add a second player behind a menu).
  if (event.code === "KeyP" && (state.mode === "playing" || state.mode === "menu")) {
    togglePlayerTwo();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("pointerdown", ensureAudio);

document.addEventListener("click", (event) => {
  if (!ui.shop.classList.contains("hidden") && state.openActionMenu && !event.target.closest(".weapon-slot, .pill")) {
    state.openActionMenu = null;
    renderLoadout();
  }
});

ui.resumeButton.addEventListener("click", () => {
  playSfx("click");
  setPaused(false);
});

ui.abandonButton.addEventListener("click", () => {
  playSfx("click");
  // Only counts from the pause menu's Abandon. Leaving via the run summary is quitting AFTER
  // dying, which is what RIP already covers, so it must not unlock this as well.
  if (typeof unlockAchievement === "function") unlockAchievement("abort_mission");
  showTitleScreen();
});

ui.summaryRestartButton.addEventListener("click", () => {
  playSfx("click");
  showTitleScreen();
});

ui.rerollButton.addEventListener("click", () => {
  if (state.shopChoices.length > 0 && state.shopChoices.every((choice) => choice.locked)) {
    showMessage("All Offers Locked", "Unlock something before rerolling.", 1000);
    return;
  }
  if (state.freeRerolls > 0) {
    state.freeRerolls -= 1;
  } else {
    if (state.scrap < state.rerollCost) {
      return;
    }
    state.scrap -= state.rerollCost;
    state.rerollCount += 1;
    state.rerollCost += rerollIncrease();
  }
  playSfx("reroll");
  syncDerivedStats();
  state.shopChoices = rollShop();
  renderShop();
  updateHud();
});

ui.mutationRerollButton.addEventListener("click", () => {
  if (state.mode !== "reward" || ui.rewardActions.classList.contains("hidden")) {
    return;
  }
  const price = mutationRerollPrice();
  if (state.scrap < price) {
    return;
  }
  state.scrap -= price;
  state.rewardRerollCount += 1;
  playSfx("reroll");
  state.bodyRewardChoices = rollBodyUpgrades();
  renderBodyRewardChoices();
  updateHud();
});

ui.nextWaveButton.addEventListener("click", () => {
  playSfx("click");
  startWave();
});

// --- Monster Compendium ----------------------------------------------------------------
// A bestiary that fills in as you meet each enemy. Lore lives in js/03b-compendium.js;
// stats are read live from enemyTypes so a page can never disagree with the real balance.
const compendiumButton = ui.compendiumButton;
const compendiumPanel = document.getElementById("compendiumPanel");
const compendiumList = document.getElementById("compendiumList");
const compendiumDetail = document.getElementById("compendiumDetail");
const compendiumCount = document.getElementById("compendiumCount");
let compendiumSelection = null;

function openCompendium() {
  if (!compendiumPanel) return;
  playSfx("click");
  compendiumPanel.classList.remove("hidden");
  renderCompendium();
}

function closeCompendium() {
  if (!compendiumPanel) return;
  playSfx("click");
  compendiumPanel.classList.add("hidden");
}

function renderCompendium() {
  if (!compendiumList) return;
  const entries = compendiumEntries();
  const found = compendiumDiscoveredCount();
  compendiumCount.textContent = `${found} / ${entries.length} discovered`;

  // Default to the first thing you've actually met.
  if (!compendiumSelection || !isEnemyDiscovered(compendiumSelection)) {
    compendiumSelection = entries.find((e) => isEnemyDiscovered(e.name))?.name ?? null;
  }

  compendiumList.innerHTML = entries.map((entry) => {
    const known = isEnemyDiscovered(entry.name);
    const selected = entry.name === compendiumSelection ? " selected" : "";
    // Undiscovered enemies are listed but not named, so the book shows how much is left
    // without spoiling what is coming.
    const label = known ? escapeChangelogText(entry.name) : "???";
    return `<button type="button" class="compendium-row${known ? "" : " locked"}${selected}"
      data-enemy="${escapeChangelogText(entry.name)}" ${known ? "" : "disabled"}>
      <span class="compendium-row-dot" style="background:${known ? entry.type.color : "rgba(255,247,231,0.15)"}"></span>
      <span class="compendium-row-name">${label}</span>
      <span class="compendium-row-wave">${known ? `W${entry.type.minWave === Infinity ? "-" : entry.type.minWave}` : ""}</span>
    </button>`;
  }).join("");

  for (const row of compendiumList.querySelectorAll(".compendium-row")) {
    row.addEventListener("click", () => {
      compendiumSelection = row.dataset.enemy;
      renderCompendium();
    });
  }

  renderCompendiumDetail(entries.find((e) => e.name === compendiumSelection) ?? null);
}

function renderCompendiumDetail(entry) {
  if (!compendiumDetail) return;
  if (!entry) {
    compendiumDetail.innerHTML = `<p class="compendium-empty">Nothing catalogued yet.
      Enemies are added to the book the first time you meet one.</p>`;
    return;
  }

  const t = entry.type;
  // Stats are pulled from the live table, and labelled as BASE values because enemy HP
  // scales with the wave -- showing "9 HP" for a wave-20 Nibbler would be a lie.
  const stats = [
    ["HP", t.hp],
    ["Damage", t.damage],
    ["Speed", t.speed === 0 ? "rooted" : t.speed],
    ["Scrap", t.scrap],
    ["Size", t.size]
  ];

  const lore = entry.lore
    ? entry.lore.body.map((p) => `<p>${escapeChangelogText(p)}</p>`).join("")
    : `<p class="compendium-empty">No field notes recorded.</p>`;

  const sharedNote = entry.sharesLoreWith
    ? `<p class="compendium-shared">Field notes shared with ${escapeChangelogText(entry.sharesLoreWith)}.</p>`
    : "";

  const splitNote = entry.splitOnly
    ? `<p class="compendium-shared">Never appears on its own. Only produced when a larger one is destroyed.</p>`
    : "";

  compendiumDetail.innerHTML = `
    <div class="compendium-detail-head">
      <canvas class="compendium-art" width="128" height="128"></canvas>
      <div>
        <h3>${escapeChangelogText(entry.name)}</h3>
        ${entry.lore ? `<p class="compendium-tagline">${escapeChangelogText(entry.lore.tagline)}</p>` : ""}
        <p class="compendium-threat">${escapeChangelogText(entry.threat)}</p>
      </div>
    </div>
    <div class="compendium-stats">
      ${stats.map(([k, v]) => `<div><span>${k}</span><strong>${escapeChangelogText(String(v))}</strong></div>`).join("")}
    </div>
    <p class="compendium-basenote">Base values. Enemy health grows with every wave.</p>
    ${splitNote}
    <div class="compendium-lore">${lore}</div>
    ${sharedNote}
  `;

  drawCompendiumArt(compendiumDetail.querySelector(".compendium-art"), entry);
}

// Draws the enemy's real in-game sprite into the entry, falling back to a coloured blob so
// a missing PNG never leaves an empty box.
function drawCompendiumArt(canvas, entry) {
  if (!canvas) return;
  const c = canvas.getContext("2d");
  const size = canvas.width;
  c.clearRect(0, 0, size, size);
  const art = enemyArt(entry.name);
  if (art) {
    const scale = Math.min(size / art.width, size / art.height) * 0.92;
    const w = art.width * scale;
    const h = art.height * scale;
    c.imageSmoothingEnabled = true;
    c.drawImage(art, (size - w) / 2, (size - h) / 2, w, h);
    return;
  }
  c.fillStyle = entry.type.color;
  c.beginPath();
  c.ellipse(size / 2, size / 2, size * 0.3, size * 0.26, 0, 0, Math.PI * 2);
  c.fill();
}

if (compendiumButton) {
  compendiumButton.addEventListener("click", openCompendium);
}
document.getElementById("compendiumClose")?.addEventListener("click", closeCompendium);

// --- Achievements ------------------------------------------------------------------------
// A checklist of run milestones. Progress lives in js/03c-achievements.js; this panel just
// reads and renders it, same split as the compendium above.
const achievementsButton = ui.achievementsButton;
const achievementsPanel = document.getElementById("achievementsPanel");
const achievementsList = document.getElementById("achievementsList");
const achievementsCount = document.getElementById("achievementsCount");

function openAchievements() {
  if (!achievementsPanel) return;
  playSfx("click");
  achievementsPanel.classList.remove("hidden");
  renderAchievements();
}

function closeAchievements() {
  if (!achievementsPanel) return;
  playSfx("click");
  achievementsPanel.classList.add("hidden");
}

function renderAchievements() {
  if (!achievementsList) return;
  const entries = achievementEntries();
  const found = achievementUnlockedCount();
  achievementsCount.textContent = `${found} / ${entries.length} unlocked`;

  achievementsList.innerHTML = entries.map((entry) => {
    // What a row is allowed to reveal is decided in ONE place (achievementDisplay), so the
    // secret-vs-locked-vs-unlocked rules can never drift between here and anywhere else.
    const shown = achievementDisplay(entry);
    // Bars are a nudge toward things you can still earn, so unlocked rows get none --
    // achievementProgress already returns null for those.
    const progress = entry.unlocked ? null : achievementProgress(entry);
    const bar = progress
      ? `<span class="achievement-bar" role="presentation">
          <span class="achievement-bar-fill" style="width:${(progress.ratio * 100).toFixed(1)}%"></span>
        </span>
        <span class="achievement-bar-text">${progress.current} / ${progress.goal}</span>`
      : "";
    return `<div class="achievement-row${entry.unlocked ? "" : " locked"}">
      <span class="achievement-row-mark">${entry.unlocked ? "&#9733;" : "&#9734;"}</span>
      <span class="achievement-row-text">
        <span class="achievement-row-name">${escapeChangelogText(shown.name)}</span>
        <span class="achievement-row-desc">${escapeChangelogText(shown.sub)}</span>
        ${bar}
      </span>
    </div>`;
  }).join("");
}


if (achievementsButton) {
  achievementsButton.addEventListener("click", openAchievements);
}
document.getElementById("achievementsClose")?.addEventListener("click", closeAchievements);

state = freshState();
initSettingsControls();
renderCharacterSelect();
updateHud();
requestAnimationFrame(loop);
// Title screen boot happens at the end of 09b-title.js (which loads after this file and
// defines showTitleScreen / initTitleControls).
