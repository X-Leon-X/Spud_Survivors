"use strict";

// devpanel.js - a hidden developer/testing sidebar.
//
// Unlocked by typing one of the DEV_CODES below anywhere in the game (the buffer listens on
// window keydown and only tracks plain letter keys). Once unlocked it stays open for the
// session; typing a code again toggles it closed.
//
// Deliberately undocumented: this is a testing tool, not a feature. It is intentionally
// absent from the readme, the changelog, the in-game info panel and every other
// player-visible surface. Keep it that way -- if you add a capability here, do not announce
// it anywhere a player would look.
//
// Everything routes through the game's OWN functions (recordUpgrade, spawnEnemy, startWave,
// syncDerivedStats) rather than poking state directly, so a cheat can't drift out of sync
// with real gameplay or mask a bug in the real code path.

const DEV_CODES = [
  "flintandsteel",
  "mryeast",
  "pneumonoultramicroscopicsilicovolcanoconiosis"
];

// Longest code decides how much typing history we retain. Anything older can't complete a
// code, so the buffer never needs to grow past this.
const DEV_BUFFER_MAX = Math.max(...DEV_CODES.map((code) => code.length));

const devPanel = {
  unlocked: false,
  open: false,
  buffer: "",
  root: null,
  built: false
};

// Typing is matched case-insensitively, so "MrYeast" and "mryeast" both work.
window.addEventListener("keydown", (event) => {
  // Ignore while typing into a real input, and ignore modified keys, so the codes can never
  // fire from an ordinary shortcut or a future text field.
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
    return;
  }
  if (event.key === undefined || event.key.length !== 1 || !/[a-zA-Z]/.test(event.key)) {
    return;
  }
  devPanel.buffer = (devPanel.buffer + event.key.toLowerCase()).slice(-DEV_BUFFER_MAX);
  if (DEV_CODES.some((code) => devPanel.buffer.endsWith(code))) {
    devPanel.buffer = "";
    toggleDevPanel();
  }
});

function toggleDevPanel() {
  if (!devPanel.built) {
    buildDevPanel();
  }
  devPanel.unlocked = true;
  devPanel.open = !devPanel.open;
  devPanel.root.classList.toggle("hidden", !devPanel.open);
  if (devPanel.open) {
    refreshDevPanel();
  }
}

function buildDevPanel() {
  const root = document.createElement("aside");
  root.id = "devPanel";
  root.className = "dev-panel hidden";
  root.innerHTML = `
    <header class="dev-panel-head">
      <strong>DEV</strong>
      <button type="button" class="dev-close" data-dev="close">x</button>
    </header>
    <div class="dev-row"><span class="dev-status" data-dev="status"></span></div>

    <section class="dev-section">
      <label class="dev-label">Jump To Wave</label>
      <div class="dev-row">
        <input type="number" min="1" max="999" value="1" class="dev-input" data-dev="waveInput">
        <button type="button" class="dev-btn" data-dev="setWave">Go</button>
      </div>
      <div class="dev-row">
        <button type="button" class="dev-btn wide" data-dev="skipWave">End Current Wave</button>
      </div>
    </section>

    <section class="dev-section">
      <label class="dev-label">Scrap</label>
      <div class="dev-row">
        <input type="number" min="1" max="99999" value="500" class="dev-input" data-dev="scrapInput">
        <button type="button" class="dev-btn" data-dev="giveScrap">Give</button>
      </div>
    </section>

    <section class="dev-section">
      <label class="dev-label">Spawn Enemy</label>
      <div class="dev-row">
        <select class="dev-input" data-dev="enemySelect"></select>
      </div>
      <div class="dev-row">
        <input type="number" min="1" max="50" value="1" class="dev-input narrow" data-dev="enemyCount">
        <button type="button" class="dev-btn" data-dev="spawnEnemy">Spawn</button>
      </div>
    </section>

    <section class="dev-section">
      <label class="dev-label">Give Item / Weapon</label>
      <div class="dev-row">
        <select class="dev-input" data-dev="itemSelect"></select>
      </div>
      <div class="dev-row">
        <button type="button" class="dev-btn wide" data-dev="giveItem">Give Free</button>
      </div>
    </section>

    <section class="dev-section">
      <label class="dev-label">Player</label>
      <div class="dev-row">
        <button type="button" class="dev-btn" data-dev="heal">Full HP</button>
        <button type="button" class="dev-btn" data-dev="kill">Kill All</button>
      </div>
    </section>
  `;
  document.body.appendChild(root);
  devPanel.root = root;
  devPanel.built = true;

  const el = (name) => root.querySelector(`[data-dev="${name}"]`);

  // Populate the enemy dropdown from the live enemyTypes table, including the templates
  // that the wave roll deliberately never picks (Clown Mid/Small) -- being able to spawn
  // those directly is exactly why this tool exists.
  const enemySelect = el("enemySelect");
  for (const type of enemyTypes) {
    const option = document.createElement("option");
    option.value = type.name;
    option.textContent = type.spawnable === false ? `${type.name} (split-only)` : type.name;
    enemySelect.appendChild(option);
  }

  // Populate items/weapons from the live upgrades table, weapons first so they're easy to find.
  const itemSelect = el("itemSelect");
  const sorted = [...upgrades].sort((a, b) => {
    const aw = a.weaponName ? 0 : 1;
    const bw = b.weaponName ? 0 : 1;
    return aw - bw || a.name.localeCompare(b.name);
  });
  for (const item of sorted) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.weaponName ? "[W] " : "[I] "}${item.name}`;
    itemSelect.appendChild(option);
  }

  root.addEventListener("click", (event) => {
    const action = event.target?.dataset?.dev;
    if (!action) return;
    handleDevAction(action, el);
  });
}

function handleDevAction(action, el) {
  const clampInt = (raw, min, max, fallback) => {
    const value = Math.floor(Number(raw));
    return Number.isFinite(value) ? clamp(value, min, max) : fallback;
  };

  if (action === "close") {
    devPanel.open = false;
    devPanel.root.classList.add("hidden");
    return;
  }

  if (!state || !state.player) {
    devStatus("Start a run first.");
    return;
  }

  if (action === "setWave") {
    // Jump straight to an arbitrary wave from anywhere -- wave 1 to wave 80 in one click.
    // startWave() increments, so store one below and let the real wave-start path do the
    // setup rather than duplicating it here.
    //
    // startWave() does NOT clear the arena (that is endWave's job during the normal
    // wave -> bagging -> shop transition). Jumping mid-wave would therefore drag the old
    // wave's enemies, projectiles and poison pools into the new one, so clear them first.
    const target = clampInt(el("waveInput").value, 1, 999, 1);
    clearArenaForDevJump();
    state.wave = target - 1;
    startWave();
    devStatus(`Jumped to wave ${target}.`);
  } else if (action === "skipWave") {
    state.waveTime = 0;
    devStatus("Wave ended.");
  } else if (action === "giveScrap") {
    const amount = clampInt(el("scrapInput").value, 1, 99999, 500);
    state.scrap += amount;
    updateHud();
    devStatus(`+${amount} scrap.`);
  } else if (action === "spawnEnemy") {
    const name = el("enemySelect").value;
    const count = clampInt(el("enemyCount").value, 1, 50, 1);
    const template = enemyTypes.find((type) => type.name === name);
    if (!template) {
      devStatus("Unknown enemy.");
      return;
    }
    let spawned = 0;
    for (let i = 0; i < count; i += 1) {
      if (state.enemies.length >= MAX_ENEMIES) break;
      // Ring them around the player so they're immediately visible for testing rather than
      // walking in from off-screen.
      const angle = (i / count) * Math.PI * 2 + rand(0, 0.5);
      const dist = 190 + rand(0, 60);
      spawnEnemy(template, {
        x: clamp(state.player.x + Math.cos(angle) * dist, 30, W - 30),
        y: clamp(state.player.y + Math.sin(angle) * dist, 30, H - 30)
      });
      spawned += 1;
    }
    devStatus(`Spawned ${spawned}x ${name}.`);
  } else if (action === "giveItem") {
    const id = el("itemSelect").value;
    const item = upgrades.find((entry) => entry.id === id);
    if (!item) {
      devStatus("Unknown item.");
      return;
    }
    if (item.weaponName && state.weapons.length >= maxWeaponSlots()) {
      devStatus("Weapon slots full.");
      return;
    }
    // Same grant path a real purchase uses, minus the cost, so granted gear behaves
    // identically to bought gear (stats, merging, recycling all stay consistent).
    recordUpgrade(item);
    applyImmediatePurchaseEffect(item);
    syncDerivedStats();
    updateHud();
    devStatus(`Granted ${item.name}.`);
  } else if (action === "heal") {
    // PHASE 1 CO-OP: heal every player, not just P1, so the dev panel's heal button matches
    // what a player testing co-op would expect.
    const targets = Array.isArray(state.players) ? state.players : [state.player];
    for (const player of targets) {
      if (player) player.hp = player.maxHp;
    }
    updateHud();
    devStatus("Healed to full.");
  } else if (action === "kill") {
    const count = state.enemies.length;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      killEnemy(i);
    }
    devStatus(`Killed ${count}.`);
  }
}

// Wipes everything wave-scoped before a dev wave jump. Mirrors the arena teardown in
// endWave() (js/04-flow.js) -- kept in step with it, minus the scrap bagging and the shop
// transition, since a jump should land straight in the new wave rather than route through
// the reward flow. Without this, jumping mid-wave carries the old wave's enemies, bullets
// and poison pools into the new one.
function clearArenaForDevJump() {
  state.enemies.length = 0;
  state.enemyDeaths.length = 0;
  state.trees.length = 0;
  state.crates.length = 0;
  state.crateDrops.length = 0;
  state.fortuneCookies.length = 0;
  state.poisonPools.length = 0;
  state.bulbs.length = 0;
  state.bullets.length = 0;
  state.swings.length = 0;
  state.enemyBullets.length = 0;
  state.coins.length = 0;
  // A burn started in the old wave is tied to enemies that no longer exist.
  // PHASE 1 CO-OP: clear it for every player, not just P1.
  const burnTargets = Array.isArray(state.players) ? state.players : [state.player];
  for (const player of burnTargets) {
    if (!player) continue;
    player.burnTicksLeft = 0;
    player.burnTickTimer = 0;
    player.burnSourceName = null;
  }
}

function devStatus(text) {
  const status = devPanel.root?.querySelector('[data-dev="status"]');
  if (status) status.textContent = text;
}

// Prefills the wave field with the CURRENT wave, but only when the panel is opened. It must
// not run after every action: typing a target ("80") and then clicking any other button
// would otherwise snap the field back to the live wave and you'd jump to the wrong place.
function refreshDevPanel() {
  if (!devPanel.root || !devPanel.open) return;
  const waveInput = devPanel.root.querySelector('[data-dev="waveInput"]');
  if (waveInput && state) waveInput.value = Math.max(1, state.wave ?? 1);
}
