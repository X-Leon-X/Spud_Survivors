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

// Placeholder only: the monster compendium isn't built yet, so clicking flashes a
// "coming soon" toast rather than opening anything.
const compendiumButton = ui.compendiumButton;
if (compendiumButton) {
  compendiumButton.addEventListener("click", () => {
    playSfx("click");
    compendiumButton.classList.remove("compendium-toast-show");
    // force reflow so re-adding the class restarts the animation if clicked again quickly
    void compendiumButton.offsetWidth;
    compendiumButton.classList.add("compendium-toast-show");
    clearTimeout(compendiumButton._toastTimer);
    compendiumButton._toastTimer = setTimeout(() => {
      compendiumButton.classList.remove("compendium-toast-show");
    }, 1600);
  });
}

state = freshState();
initSettingsControls();
renderCharacterSelect();
updateHud();
requestAnimationFrame(loop);
// Title screen boot happens at the end of 09b-title.js (which loads after this file and
// defines showTitleScreen / initTitleControls).
