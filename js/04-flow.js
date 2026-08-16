"use strict";

// flow.js - run state, wave flow, shop rolls, rewards

let state;
let lastTime = performance.now();
let messageToken = 0;

function maxWeaponSlots() {
  return BASE_WEAPON_SLOTS + (state?.extraWeaponSlots ?? 0) + (state?.temp?.extraWeaponSlots ?? 0);
}

// PHASE 1 CO-OP: builds one player object. `index` 0 = P1 (WASD), 1 = P2 (Arrow keys) -- see
// getPlayerInput() in js/07-combat.js for the key mapping this feeds. Both players share the
// same base stat block (BASE_PLAYER_STATS) and, per the design decision, the SAME weapon
// loadout (state.weapons) -- what's per-player here is only what has to be separate DURING a
// wave: position, HP, and the small set of per-player cooldown/timer fields already on the
// original player object. `downed` is the phase-1 death model: a downed player stops moving/
// firing/taking damage and renders greyed out, but the run only ends once every player is
// downed (see the game-over check in update(), js/07-combat.js).
function makePlayer(index) {
  return {
    index,
    x: W / 2 + (index === 0 ? 0 : 60),
    y: H / 2,
    radius: 21,
    hp: 80,
    maxHp: 80,
    speed: 210,
    damage: 8,
    fireRate: 1.7,
    fireCooldown: 0.25,
    engineeringCooldown: engineeringZapCooldown(0),
    meleeCooldown: 0.6,
    shotSpeed: 540,
    range: 390,
    pickupRange: 120,
    projectiles: 1,
    hurtTimer: 0,
    damageCooldown: 0,
    burnTicksLeft: 0,
    burnTickTimer: 0,
    burnTickDamage: 0,
    burnSourceName: null,
    lifeStealCooldown: 0,
    regenTimer: 0,
    downed: false,
    stats: { ...BASE_PLAYER_STATS },
    // Per-player weapon runtime state (cooldown/recoil/fire-anim/airborne), keyed by weapon
    // slot index -- see weaponRuntimeFor() in js/07-combat.js. Kept OFF the shared
    // state.weapons objects so P2 firing a shared loadout never blocks/duplicates P1's shots.
    weaponRuntime: []
  };
}

// PHASE 1 CO-OP: P2 join/leave toggle. v0.23.0: no longer bound to any key (previously KeyP in
// js/09-main.js) -- P2 is now chosen up front via the "2 Players" checkbox on character select
// (see coopToggle/coopRequested and startGame(), which calls the same spawn logic used here).
// This function itself is kept as-is (unused by any binding right now) since it's still
// harmless and cheap to keep around for a future mid-run join/leave feature. Joining spawns P2
// next to P1 with full HP (per the design doc); leaving just drops the second player object --
// their weapon/HP state is discarded, matching "P2 is optional and only separate DURING a wave"
// (the shared build/scrap is untouched either way).
function togglePlayerTwo() {
  if (!state) return;
  if (state.players.length > 1) {
    state.players.length = 1;
    showMessage("Player 2 Left", "Back to solo.", 1200);
  } else {
    const p1 = state.player;
    const p2 = makePlayer(1);
    // Spawn beside P1 (a little inside the arena bounds so a P1 standing at the very edge
    // doesn't push P2 off it), with full HP regardless of P1's current HP.
    p2.x = clamp((p1?.x ?? W / 2) + 60, p2.radius + 8, W - p2.radius - 8);
    p2.y = clamp(p1?.y ?? H / 2, p2.radius + 8, H - p2.radius - 8);
    state.players.push(p2);
    syncDerivedStats(); // pick up the shared build's maxHp/speed/etc. immediately, not next tick
    showMessage("Player 2 Joined", "Arrow keys to move.", 1600);
  }
}

function freshState() {
  const fresh = {
    mode: "menu",
    wave: 1,
    waveDuration: 35,
    waveTime: 35,
    spawnTimer: 0,
    waveKills: 0,
    graveTimer: 0,
    scrap: 0,
    unusedScrap: 0,
    pendingBagScrap: 0,
    bagPulse: 0,
    bagSettleTimer: 0,
    rerollCost: 3,
    rerollCount: 0,
    freeRerolls: 0,
    shopChoices: [],
    items: [],
    weapons: [{ name: "Spark Peashooter", tier: 1, fireCooldown: 0.22 }],
    weaponMods: [],
    pendingCrates: 0,
    pendingCrateItems: [],
    pendingFortunes: [],
    armedFortunes: [],
    bodyRewardChoices: [],
    rewardRerollCount: 0,
    detailTipDismissed: false,
    openActionMenu: null,
    shopDiscount: 0,
    recycleRate: 0.35,
    treeOneShot: false,
    // BOSS SYSTEM: null outside a boss fight. See startBossFight() below for the shape
    // (index/phase/timers) and js/07-combat.js updateBossEnemy for the attack machine that
    // lives on the boss enemy instance itself. bossFightClearedForWave records the completed
    // wave NUMBER (e.g. 10, 20...) whose boss has already been beaten, so a dev-panel wave
    // jump or a re-entrant startWave() call can't re-trigger the same interstitial twice.
    bossFight: null,
    bossFightClearedForWave: null,
    // Set by endBossFight() when a boss dies, consumed by resolveBossFightEnding() at the top
    // of the next update() tick -- see the comments on both in js/04-flow.js. Deferring this
    // teardown (instead of mutating state.enemies etc. synchronously) is what stops the crash
    // where a piercing/explosive/multi-hit kill on the boss truncated arrays mid-loop.
    bossFightEnding: null,
    extraWeaponSlots: 0,
    temp: { stats: {}, effects: {}, extraWeaponSlots: 0, weapons: [], flags: {} },
    character: selectedCharacter,
    runStats: freshRunStats(),
    // PHASE 1 CO-OP: players is now an array (state.player stays available as a GETTER alias
    // for players[0] -- see the Object.defineProperty call right after freshState() runs, at
    // the bottom of this file -- so the ~96 pre-existing `state.player` reads across the
    // codebase keep working unchanged). Single player defaults to exactly one entry; P2 is
    // opt-in (see the "2 Players" checkbox on character select -- coopToggle/coopRequested --
    // and startGame(), below).
    players: [makePlayer(0)],
    enemies: [],
    enemyDeaths: [],
    trees: [],
    crates: [],
    crateDrops: [],
    fortuneCookies: [],
    poisonPools: [],
    // Shop variety tracking: shopSeen maps upgrade id -> the shop number it last appeared
    // in, and shopRollCount is that counter. Drives upgradeFreshnessBonus.
    shopSeen: {},
    shopRollCount: 0,
    bulbs: [],
    bullets: [],
    swings: [],
    enemyBullets: [],
    zaps: [],
    ashes: [],
    coins: [],
    bagAnimations: [],
    particles: [],
    floaters: []
  };
  installPlayerAlias(fresh);
  return fresh;
}

// PHASE 1 CO-OP: makes `state.player` a read-only GETTER alias for `state.players[0]`, so the
// large existing body of code that reads/writes state.player.<field> (hp, x, y, stats, etc.)
// keeps working completely unchanged -- it always sees whichever object is currently
// players[0]. Deliberately no setter: `state.player = something` must be a hard error rather
// than silently doing nothing, so a future accidental wholesale reassignment is caught loudly
// instead of quietly breaking the alias. Grepped the whole codebase for `state.player =` before
// relying on this -- there are zero such assignments (every existing site only ever does
// `state.player.<field> = ...`, which mutates the aliased object in place and needs no setter).
function installPlayerAlias(target) {
  Object.defineProperty(target, "player", {
    get() {
      return target.players[0];
    },
    enumerable: true,
    configurable: true
  });
}

// PHASE 1 CO-OP: the build (items/upgrades/weapons) is a SHARED, single decision per the
// design (one shop, shared scrap), and effectiveStat() reads state.player.stats (i.e.
// players[0]'s stats -- see applyCharacter/addStat, the only writers of that bag) for every
// player alike, so both players always end up with identical derived numbers here. What is
// NOT shared is hp -- each player keeps their own current hp, only re-clamped to the shared
// maxHp -- so a player who has been hit stays down a chunk of health even though the cap just
// changed under them.
function syncDerivedStats() {
  const ownedEffects = calculateOwnedUpgradeEffects();
  state.shopDiscount = Math.min(0.55, ownedEffects.shopDiscount);
  state.recycleRate = Math.min(0.75, 0.35 + ownedEffects.recycleRateBonus);
  state.treeOneShot = ownedEffects.treeOneShot;
  state.extraWeaponSlots = ownedEffects.extraWeaponSlots;
  const equipped = state.weapons.slice(0, maxWeaponSlots());
  const sharedMaxHp = Math.max(1, effectiveStat("maxHp"));
  const sharedSpeed = 210 * brotatoPercentMultiplier(effectiveStat("speed"));
  const sharedFireRate = 1.7 * brotatoPercentMultiplier(effectiveStat("attackSpeed"));
  const sharedRange = Math.max(80, effectiveStat("range"));
  const sharedPickupRange = Math.max(40, effectiveStat("pickupRange"));
  const sharedShotSpeed = 540 + effectiveStat("range") * 0.06 + effectiveStat("engineering") * 8;
  const sharedDamage = equipped.length
    ? equipped.reduce((sum, weapon) => sum + weaponShotDamage(weapon), 0) / equipped.length
    : Math.max(1, effectiveStat("rangedDamage") * brotatoPercentMultiplier(effectiveStat("damagePercent")));
  const sharedProjectiles = 1 + ownedEffects.projectiles;
  for (const player of state.players) {
    player.projectiles = sharedProjectiles;
    player.maxHp = sharedMaxHp;
    player.hp = Math.min(player.hp, player.maxHp);
    player.speed = sharedSpeed;
    player.fireRate = sharedFireRate;
    player.range = sharedRange;
    player.pickupRange = sharedPickupRange;
    player.shotSpeed = sharedShotSpeed;
    player.damage = sharedDamage;
  }
}

function weaponPowerValue(weapon) {
  return weaponShotDamage(weapon);
}

function startGame() {
  state = freshState();
  applyCharacter(selectedCharacter);
  // TASK 2: P2 is now chosen on the character select screen (the "2 Players" checkbox --
  // see coopToggle/coopRequested) instead of the KeyP hotkey mid-run. Pushed AFTER
  // applyCharacter (so P2 doesn't receive character stats meant only for state.player, same
  // as togglePlayerTwo's contract) and BEFORE syncDerivedStats (so the shared build's
  // maxHp/speed/etc. reaches P2 immediately instead of on the next tick). Same +60 x offset
  // and edge-clamp togglePlayerTwo uses, so joining from the start screen looks and behaves
  // identically to joining mid-run.
  if (coopRequested) {
    const p1 = state.player;
    const p2 = makePlayer(1);
    p2.x = clamp((p1?.x ?? W / 2) + 60, p2.radius + 8, W - p2.radius - 8);
    p2.y = clamp(p1?.y ?? H / 2, p2.radius + 8, H - p2.radius - 8);
    p2.hp = state.player.stats.maxHp;
    p2.maxHp = state.player.stats.maxHp;
    state.players.push(p2);
  }
  syncDerivedStats();
  spawnTrees();
  hideMessage();
  hideShop();
  hideReward();
  hideSummary();
  setPaused(false);
  ui.startMenu.classList.add("hidden");
  state.mode = "playing";
  playSfx("wave");
  updateHud();
}

const CHARACTER_ACHIEVEMENTS = {
  chunk: "chunky",
  zip: "zoooom",
  sprout: "balanced"
};

function applyCharacter(character) {
  state.character = character;
  const characterAchievement = CHARACTER_ACHIEVEMENTS[character?.id];
  if (characterAchievement && typeof unlockAchievement === "function") {
    unlockAchievement(characterAchievement);
  }
  // Character stats stay on state.player (players[0]) -- the shared stats bag effectiveStat()
  // reads for every player alike (see syncDerivedStats). hp is seeded per player here since
  // this runs before any P2 join in the normal flow; togglePlayerTwo() seeds P2's hp itself
  // when joining mid-run.
  for (const [key, amount] of Object.entries(character.stats)) {
    state.player.stats[key] += amount;
  }
  for (const player of state.players) {
    player.hp = state.player.stats.maxHp;
  }
}

// BOSS SYSTEM -- the single entry point every "advance past a wave" path goes through
// (the shop's Start Next Wave button and the dev panel's wave-jump both call startWave()
// directly), so intercepting here is the one place that reliably catches every route out of
// wave 10, 20, 30, etc. A boss fight is an INTERSTITIAL that happens AFTER a multiple-of-10
// wave has been fully played (normal enemies, normal timer, normal end, normal shop) -- it
// must NOT replace that wave. So the trigger checks state.wave (the wave the player just
// finished and shopped after), not state.wave + 1: if state.wave is already a multiple of
// BOSS_WAVE_INTERVAL and that interval's boss hasn't been cleared yet, redirect into
// startBossFight() instead of incrementing to wave 11/21/31. When the fight ends (see
// endBossFight below) it calls startWave() again itself; state.wave is still 10 (unchanged
// by the boss fight) and bossFightClearedForWave has been stamped to 10, so this check falls
// through and wave 11 starts normally on that second call.
function startWave() {
  if (
    state.wave > 0 &&
    state.wave % BOSS_WAVE_INTERVAL === 0 &&
    state.bossFightClearedForWave !== state.wave &&
    !state.bossFight
  ) {
    startBossFight(state.wave / BOSS_WAVE_INTERVAL);
    return;
  }

  state.mode = "playing";
  state.wave += 1;
  state.waveDuration = Math.min(56, 32 + state.wave * 3);
  state.waveTime = state.waveDuration;
  state.spawnTimer = 0;
  state.waveKills = 0;
  if (state.runStats) state.runStats.damageTakenThisWave = 0;
  state.rerollCount = 0;
  state.rerollCost = firstRerollPrice();
  // Between-wave top-up: +8 HP for every player, and a downed player is revived with it too
  // (the only revive path in this phase -- reviving a downed player mid-wave is a follow-up).
  for (const player of state.players) {
    player.hp = Math.min(player.maxHp, player.hp + 8);
    player.downed = false;
  }
  spawnTrees();
  // Crates appear randomly through the wave, rare early and ramping up with the wave.
  // Each wave gets a small budget of crates (see crateWaveBudget) and a long first delay.
  state.crateBudget = crateWaveBudget();
  state.crateSpawnTimer = crateSpawnInterval();
  hideShop();
  hideReward();
  playSfx("wave");
  showMessage(`Wave ${state.wave}`, "More scrap. Meaner shapes.", 1100);
  applyArmedFortunes();
}

// BOSS SYSTEM -- begins an interstitial boss fight. `bossIndex` is 1 for the first fight
// (between wave 10 and 11), 2 for the second (wave 20/21), etc. -- see startWave() above for
// the trigger. Deliberately does NOT touch state.wave: the fight sits BETWEEN two wave
// numbers, so the HUD wave chip is hidden entirely for its duration (see updateHud(),
// js/06-shop.js) rather than shown as a fake wave number.
//
// The fight reuses the normal "playing" simulation loop (movePlayer, updateEnemies, weapon
// fire, etc. in js/07-combat.js's update()) -- only the wave-end condition and the enemy
// spawner are special-cased for state.bossFight (see the waveTime guard and the
// spawnWaveEnemies early-return, both in js/07-combat.js), so nothing here needs to duplicate
// that machinery.
function startBossFight(bossIndex) {
  state.mode = "playing";
  state.bossFight = {
    index: bossIndex,
    phase: 1,
    // Trees respawn periodically through the fight (a modest trickle, not a full
    // spawnTrees() reset) so the arena doesn't go bare over a long fight -- see
    // updateBossFight()'s tick, called from update() in js/07-combat.js.
    treeTimer: 22,
    // v0.20.0: seed the side-nibbler trickle timer to a fixed post-arrival GRACE PERIOD instead
    // of the normal rand(1.2, 2.2) roll (see BOSS_TRICKLE_INTERVAL_P1 in js/07-combat.js), so the
    // first trickle nibbler can't spawn until the boss has actually landed and had a real chance
    // to act. updateBossTrickle doesn't tick this timer at all while boss.bossState === "arriving"
    // (0.6s), so combined with this 3s seed the first spawn lands at roughly arrival + 3s into the
    // fight -- comfortably past the boss's opening idle window and its first telegraph.
    trickleTimer: 3.0
  };
  state.spawnTimer = 0;
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
  state.crateBudget = 0; // no crates during a boss fight -- see updateCrateSpawns' guard
  // Full heal on boss-fight entry (not the normal +8 top-up used between regular waves): a boss
  // fight is a discrete set-piece, not a continuation of the wave that came before it, so a rough
  // previous wave shouldn't mean starting the fight already low. See js/00-changelog.js v0.20.0.
  for (const player of state.players) {
    player.hp = player.maxHp;
    player.downed = false;
  }
  spawnTrees();
  hideShop();
  hideReward();
  playSfx("wave");
  spawnNibblerKing(bossIndex);
  // Title reads EXACTLY "Boss Fight N" -- no wave number anywhere in it (spec requirement).
  showMessage(`Boss Fight ${bossIndex}`, "The Nibbler King rises.", 1400);
  applyArmedFortunes();
}

// BOSS SYSTEM -- called from js/07-combat.js the instant the Nibbler King dies (or, as a
// soft-lock safety, if the boss fight is active but no boss enemy exists in state.enemies --
// see the guard in update()'s wave-end check). Clears the fight flag, stamps
// bossFightClearedForWave so startWave() doesn't re-trigger the same fight, and hands off to
// the SAME post-wave reward flow every normal wave uses (finishWaveTransition ->
// showBodyReward -> continueRewards -> crate/fortune/shop), so the boss reward is not a
// special case the player has to learn separately.
//
// ITERATION-SAFETY: this used to truncate state.enemies (and several other arrays) and hand
// off to the reward flow SYNCHRONOUSLY, from inside killEnemy() -> killBossEnemy(). But
// killEnemy() is itself called from loops that are still iterating state.enemies/state.bullets
// at the time (explodeBullet, updateBullets, processWeaponSwingHits, the dev panel's kill-all),
// so truncating those arrays mid-loop invalidated the iteration and crashed. killEnemy() already
// removes the boss from state.enemies itself (a single splice(index, 1) at the loop's current
// index, which those backwards loops already tolerate) before calling killBossEnemy(), so the
// fight visibly ends and the soft-lock safety sees no boss immediately -- that part needs no
// change here. What this function now defers is everything ELSE: the wholesale array
// truncation, the mode change, and the reward handoff. It only records what needs to happen and
// returns; the actual teardown runs from resolveBossFightEnding(), invoked at the top of the
// next frame (see the one-line dispatch added at the top of update() in js/07-combat.js) once
// no caller can possibly still be mid-loop over this frame's arrays.
function endBossFight(isSoftLockSafety = false) {
  const bossFight = state.bossFight;
  if (!bossFight) return;
  // DOUBLE-END GUARD: once a teardown is pending, state.bossFight is still non-null (cleared
  // only inside resolveBossFightEnding below) but no boss enemy is present in state.enemies --
  // exactly the condition the soft-lock safety in update() looks for. Without this guard, the
  // safety would call endBossFight(true) again on every frame between the boss's death and the
  // deferred teardown running, each call re-entering this function. This flag makes every such
  // re-entry a no-op.
  if (state.bossFightEnding) return;
  state.bossFightEnding = {
    // Stamped as the completed wave NUMBER the boss guards (10, 20, 30...), matching what
    // startWave() compares state.wave against above -- NOT +1. The old +1 offset compared
    // bossFightClearedForWave (11) against a trigger check of nextWave===10, so it could never
    // actually suppress anything; this keeps both sides of the guard in the same units.
    clearedWave: bossFight.index * BOSS_WAVE_INTERVAL,
    isSoftLockSafety
  };
}

// BOSS SYSTEM -- the actual teardown deferred by endBossFight() above. Must only ever run at a
// point where nothing is mid-iteration over state.enemies/state.bullets/etc: called once at the
// very top of update() (js/07-combat.js), before any of this frame's simulation loops start.
// A no-op whenever nothing is pending, so it's safe to call unconditionally every frame.
function resolveBossFightEnding() {
  const pending = state.bossFightEnding;
  if (!pending) return;
  state.bossFightEnding = null;
  if (pending.isSoftLockSafety) {
    // Should never happen in normal play (the boss only leaves state.enemies via
    // killBossEnemy, which calls endBossFight(false) itself) -- this path exists purely so a
    // boss vanishing some other way can never permanently strand the player on a wave that
    // can no longer end. Logged so it's visible during testing if it ever fires.
    console.warn("Boss fight ended via soft-lock safety: no boss enemy found while state.bossFight was active.");
  }
  state.bossFight = null;
  state.bossFightClearedForWave = pending.clearedWave;
  state.mode = "bagging";
  clearTempModifiers();
  state.enemies.length = 0;
  state.enemyDeaths.length = 0;
  state.trees.length = 0;
  state.enemyBullets.length = 0;
  state.bullets.length = 0;
  state.swings.length = 0;
  for (const player of state.players) {
    player.burnTicksLeft = 0;
    player.burnTickTimer = 0;
    player.burnSourceName = null;
  }
  const looseScrap = state.coins.reduce((sum, coin) => sum + coin.value, 0);
  if (looseScrap > 0) {
    startBagCollection(looseScrap);
    showMessage(`+${looseScrap} bagged`, "Loose scrap saved for later", 1000);
    return;
  }
  finishWaveTransition();
}

// Fires every fortune the player cracked open last reward screen (state.armedFortunes, filled
// by showFortuneReward's crack button). Effects are applied via applyFortune() (js/03d-fortunes.js),
// which both performs the effect through the Layer B temp helpers AND returns an explicit
// announce string ("this wave only" is already baked into that string, so nothing here repeats
// the wording). No-op when the array is empty -- most waves never had a cookie cracked.
function applyArmedFortunes() {
  if (!state.armedFortunes || state.armedFortunes.length === 0) return;
  const fortunes = state.armedFortunes.slice();
  state.armedFortunes.length = 0; // fired; must never fire again on a later wave

  fortunes.forEach((fortune, index) => {
    const announceText = typeof applyFortune === "function" ? applyFortune(fortune) : "";
    if (!announceText) return;
    // Stagger so 2-3 armed fortunes don't stack into one unreadable blob: the "Wave N" toast
    // already owns t=0-1100ms, so the first fortune toast starts right after it, and any
    // further fortunes fall back to a floater above the player instead of queuing more toasts
    // (which would just keep overwriting each other via showMessage's shared token).
    if (index === 0) {
      window.setTimeout(() => {
        if (state.mode === "playing") showMessage("Fortune Fulfilled", announceText, 1600);
      }, 1150);
    } else {
      window.setTimeout(() => {
        if (state.mode === "playing" && typeof addFloater === "function") {
          addFloater(state.player.x, state.player.y - state.player.radius - 26, announceText, {
            color: "#f2c45f",
            size: 14,
            life: 2.4,
            riseSpeed: 30,
            driftX: rand(-6, 6),
            fadePower: 1.3,
            scaleOut: 0.18
          });
        }
      }, 1150 + index * 900);
    }
  });
}

function endWave() {
  state.mode = "bagging";
  // waveKills > 0 confirms this wave was actually played (as opposed to a stray call before
  // anything spawned), the same way startWave/killEnemy already use it elsewhere.
  if (state.runStats && state.runStats.damageTakenThisWave === 0 && state.waveKills > 0) {
    if (typeof unlockAchievement === "function") unlockAchievement("untouched_wave");
  }
  if (typeof checkAchievements === "function") checkAchievements();
  // Temp weapons/slots are wave-scoped: remove them (and their bonus slots) together, before
  // anything else touches state.weapons or maxWeaponSlots(), so nothing is left stranded
  // outside the slice window. syncDerivedStats() below (via finishWaveTransition, or directly
  // if the bag-collection early-return skips it here) settles state.extraWeaponSlots/stats
  // afterward the same way the rest of this function already relies on it to.
  clearTempModifiers();
  state.enemies.length = 0;
  state.enemyDeaths.length = 0;
  state.trees.length = 0;
  state.crates.length = 0;
  state.crateDrops.length = 0;
  state.fortuneCookies.length = 0;
  // Poison pools are wave-scoped: a pool left by a Blight Sac must not survive into the
  // next wave and chip the player before anything has even spawned.
  state.poisonPools.length = 0;
  state.bulbs.length = 0;
  state.bullets.length = 0;
  state.swings.length = 0;
  state.enemyBullets.length = 0;
  // Don't let a burn started in the final seconds of a wave keep ticking through
  // bagging/shop and into the next wave — it's tied to enemies that no longer exist.
  for (const player of state.players) {
    player.burnTicksLeft = 0;
    player.burnTickTimer = 0;
    player.burnSourceName = null;
  }
  const looseScrap = state.coins.reduce((sum, coin) => sum + coin.value, 0);
  if (looseScrap > 0) {
    startBagCollection(looseScrap);
    showMessage(`+${looseScrap} bagged`, "Loose scrap saved for later", 1000);
    return;
  }
  finishWaveTransition();
}

function finishWaveTransition() {
  state.mode = "shop";
  syncDerivedStats();
  const currentHarvesting = effectiveStat("harvesting");
  const harvest = Math.floor(currentHarvesting * (1 + state.wave * 0.05));
  if (harvest > 0) {
    state.scrap += harvest;
    trackScrap(harvest);
    state.player.stats.harvesting += Math.max(1, Math.floor(currentHarvesting * 0.05));
    showMessage(`+${harvest} scrap`, "Harvesting paid out", 1300);
  }
  state.coins.length = 0;
  state.rewardRerollCount = 0;
  state.rerollCount = 0;
  state.freeRerolls = 0;
  state.rerollCost = firstRerollPrice();
  showBodyReward();
}

function startBagCollection(totalValue) {
  const target = bagTarget();
  state.pendingBagScrap = totalValue;
  state.bagSettleTimer = 0.38;
  state.bagAnimations = state.coins.map((coin, index) => ({
    x: coin.x,
    y: coin.y,
    startX: coin.x,
    startY: coin.y,
    value: coin.value,
    radius: coin.radius,
    delay: Math.min(0.36, index * 0.025),
    duration: rand(0.52, 0.8),
    t: 0,
    targetX: target.x + rand(-8, 8),
    targetY: target.y + rand(-7, 7)
  }));
  state.coins.length = 0;
}

function rollShop() {
  const choices = new Array(4).fill(null);
  const usedIds = new Set();
  for (let slot = 0; slot < 4; slot += 1) {
    const existing = state.shopChoices[slot];
    if (existing?.locked && isUpgradeAvailable(existing)) {
      choices[slot] = existing;
      usedIds.add(existing.id);
    }
  }

  for (let slot = 0; slot < choices.length && usedIds.size < upgrades.length; slot += 1) {
    if (choices[slot]) continue;
    const item = rollUpgradeOffer(usedIds, slot);
    usedIds.add(item.id);
    choices[slot] = {
      ...item,
      cost: calculateShopCost(item.baseCost, item.tier)
    };
  }
  const rolled = choices.filter(Boolean);
  markShopOffers(rolled);
  return rolled;
}

function calculateShopCost(baseCost, tier = 1) {
  const shopPrice = 1 - Math.min(0.55, Math.max(0, effectiveStat("luck")) * 0.0015 + state.shopDiscount);
  const wave = Math.max(1, state.wave);
  const rarityMultiplier = rarities[tier]?.cost ?? 1;
  // Prices raised ~15% across the board (and the per-wave slope steepened slightly) to pair
  // with the weapon damage bump in weaponStatProfiles: weapons hit harder, so each purchase
  // has to be a bigger commitment or scrap stops being a meaningful constraint.
  const waveMultiplier = 1.15 + (wave - 1) * 0.095 + Math.max(0, wave - 7) * 0.04 + Math.max(0, wave - 13) * 0.06;
  const earlyDiscount = wave === 1 ? 0.78 : wave === 2 ? 0.86 : wave <= 4 ? 0.94 : 1;
  return Math.max(1, Math.round(baseCost * rarityMultiplier * waveMultiplier * earlyDiscount * shopPrice));
}

function rerollIncrease() {
  return Math.max(1, Math.floor(0.32 * state.wave));
}

function firstRerollPrice() {
  return Math.max(2, Math.floor(state.wave * 0.55) + rerollIncrease());
}

function mutationRerollPrice() {
  return Math.max(2, Math.floor(2 + state.wave * 0.5 + state.rewardRerollCount * (1 + state.wave * 0.22)));
}

function rollUpgradeOffer(usedIds = new Set(), slot = 0, crate = false) {
  const targetTier = rollRarity();
  const wantWeapon = crate ? Math.random() < 0.25 : shouldRollWeaponSlot(slot);
  const preferred = upgrades.filter((upgrade) => {
    if (usedIds.has(upgrade.id)) return false;
    if (!isUpgradeAvailable(upgrade)) return false;
    if (wantWeapon && upgrade.loadoutType === "weapon") {
      if (upgrade.tier > targetTier) return false;
    } else if (upgrade.tier !== targetTier) {
      return false;
    }
    if (!isUpgradeWaveAvailable(upgrade)) return false;
    return wantWeapon ? upgrade.loadoutType === "weapon" : upgrade.loadoutType !== "weapon";
  });
  const fallback = upgrades.filter((upgrade) => {
    if (usedIds.has(upgrade.id)) return false;
    if (!isUpgradeAvailable(upgrade)) return false;
    if (upgrade.tier > targetTier) return false;
    if (!isUpgradeWaveAvailable(upgrade)) return false;
    return true;
  });
  const broadFallback = upgrades.filter((upgrade) => {
    if (usedIds.has(upgrade.id)) return false;
    if (!isUpgradeAvailable(upgrade)) return false;
    if (!isUpgradeWaveAvailable(upgrade)) return false;
    return true;
  });
  const pool = preferred.length > 0 ? preferred : fallback.length > 0 ? fallback : broadFallback;
  const selected = weightedUpgradeChoice(pool);
  if (selected?.weaponName && selected.tier <= targetTier) {
    return { ...selected, tier: rollWeaponOfferTier(selected.tier, targetTier) };
  }
  return selected;
}

function isUpgradeWaveAvailable(upgrade) {
  const minWave = upgrade.minWave ?? rarities[upgrade.tier]?.minWave ?? 1;
  return state.wave >= minWave;
}

function weightedUpgradeChoice(pool) {
  if (!pool.length) return null;
  const total = pool.reduce((sum, upgrade) => sum + upgradeOfferWeight(upgrade), 0);
  let roll = Math.random() * total;
  for (const upgrade of pool) {
    roll -= upgradeOfferWeight(upgrade);
    if (roll <= 0) return upgrade;
  }
  return pool[pool.length - 1];
}

function upgradeOfferWeight(upgrade) {
  let weight = 1;
  if (upgrade.id === "split") weight = 0.28;
  else if (upgrade.id === "dodge") weight = 0.45;
  else if (upgrade.key === "dodge") weight = 0.45;
  else if (upgrade.unique) weight = 0.55;
  return weight * upgradeFreshnessBonus(upgrade);
}

// "Pity" weighting, so the shop stops showing you the same four things. Every item tracks
// how many shops have passed since you last saw it; the longer it has been missing, the
// heavier it rolls. Items you just saw are damped instead, which is what actually breaks up
// repetition -- rarity tiers alone can't, because a common item competes only with other
// commons and the same handful kept winning.
//
// Capped so this biases the roll without overriding rarity: a legendary is still a
// legendary, it just cannot stay invisible for an entire run.
const SHOP_FRESHNESS_CAP = 3.5;
function upgradeFreshnessBonus(upgrade) {
  const lastSeen = state.shopSeen?.[upgrade.id];
  if (lastSeen === undefined) return SHOP_FRESHNESS_CAP;   // never offered: maximum pity
  const gap = (state.shopRollCount ?? 0) - lastSeen;
  if (gap <= 1) return 0.35;                               // seen in the last shop: damped
  return Math.min(SHOP_FRESHNESS_CAP, 0.6 + gap * 0.42);
}

// Records which items a shop actually offered, so the freshness weighting above has data.
function markShopOffers(choices) {
  state.shopRollCount = (state.shopRollCount ?? 0) + 1;
  state.shopSeen = state.shopSeen ?? {};
  for (const choice of choices) {
    if (choice) state.shopSeen[choice.id] = state.shopRollCount;
  }
}

function rollWeaponOfferTier(baseTier, targetTier) {
  const wave = Math.max(1, state.wave);
  const luck = Math.max(0, effectiveStat("luck"));
  let tier = Math.max(baseTier, targetTier);
  const bumpOne = Math.min(38, Math.max(0, wave - 2) * 2.1 + luck * 0.18);
  const bumpTwo = Math.min(18, Math.max(0, wave - 8) * 1.25 + luck * 0.08);
  if (tier < MAX_WEAPON_RANK && Math.random() * 100 < bumpOne) tier += 1;
  if (tier < MAX_WEAPON_RANK && Math.random() * 100 < bumpTwo) tier += 1;
  return Math.min(MAX_WEAPON_RANK, tier);
}

function isUpgradeAvailable(upgrade) {
  syncDerivedStats();
  if (upgrade.unique && state.items.some((item) => item.id === upgrade.id)) {
    return false;
  }
  if (upgrade.id === "garden_shears" && state.treeOneShot) {
    return false;
  }
  if (upgrade.id === "extra_arm" && state.extraWeaponSlots > 0) {
    return false;
  }
  return true;
}

function shouldRollWeaponSlot(slot) {
  if (state.wave <= 2) return slot < 2;
  if (state.wave <= 5 && slot === 0) return true;
  return Math.random() < 0.35;
}

function rollRarity() {
  // Luck matters MORE than it used to (x1.4 exponent-ish via the doubled divisor effect on
  // the multiplier below), but the base rates are what actually decide whether you ever see
  // a legendary. The old tier-5 curve reached only ~0.55% per slot by wave 20 and was then
  // split across 5 legendaries -- measured over 6,000 shops, the Flamethrower appeared ZERO
  // times. These rates start earlier, climb faster and cap higher so rare items are rare,
  // not absent, even at 0 luck.
  const luck = Math.max(0, effectiveStat("luck"));
  const luckMultiplier = 1 + luck / 70;
  // Caps raised well above the old 9%/24%: they used to saturate by roughly 150 luck, so
  // every value past that rolled identically and stacking luck did literally nothing.
  // The tier-5 cap itself creeps up with luck, so stacking it past the point where the
  // curve pins keeps paying instead of flatlining (600 and 900 luck used to be identical).
  const tier5Cap = 34 + Math.min(26, luck / 24);
  const tier5 = rarityChance(9, 0.42, tier5Cap, luckMultiplier, luck);
  const tier4 = rarityChance(6, 1.5, 46, luckMultiplier, luck);
  const tier3 = rarityChance(3, 3.4, 52, luckMultiplier, luck);
  const tier2 = rarityChance(2, 8.5, 72, luckMultiplier, luck);

  // These are independent curves, so at high luck/wave they can sum past 100. Rolling them
  // sequentially against a flat 0-100 then silently truncated whichever bands fell off the
  // end (tier 1 and 2 first), which made the stated rates a lie. Normalising keeps the
  // RATIOS the curves describe while guaranteeing the bands always fit.
  const tier1 = Math.max(0, 100 - (tier5 + tier4 + tier3 + tier2));
  const total = tier5 + tier4 + tier3 + tier2 + tier1;
  const roll = Math.random() * total;
  if (roll < tier5) return 5;
  if (roll < tier5 + tier4) return 4;
  if (roll < tier5 + tier4 + tier3) return 3;
  if (roll < tier5 + tier4 + tier3 + tier2) return 2;
  return 1;
}

// Luck erodes the wave gate instead of being blocked by it. The gate used to be absolute:
// tier 4 was impossible before wave 6 and tier 5 before wave 9, so ANY amount of luck rolled
//0% for them (verified at 900 luck: hundreds of rerolls could never produce a tier 4). A
// gate you cannot influence makes luck feel broken, so every 60 luck now pulls each gate one
// wave earlier, down to a floor that keeps wave 1 from handing out legendaries.
function effectiveMinWave(minWave, luck) {
  const shift = Math.floor(Math.max(0, luck) / 60);
  // Floor of 2 for the top tiers: wave 1 should never open with a legendary, however lucky.
  return Math.max(minWave <= 3 ? 1 : 2, minWave - shift);
}

function rarityChance(minWave, perWave, cap, luckMultiplier, luck) {
  const gate = effectiveMinWave(minWave, luck);
  if (state.wave < gate) return 0;
  return Math.min(cap, Math.max(0, perWave * (state.wave - gate + 1)) * luckMultiplier);
}

function showShop() {
  state.mode = "shop";
  hideReward();
  syncDerivedStats();
  state.shopChoices = rollShop();
  ui.shop.classList.remove("hidden");
  renderShop();
  renderLoadout();
  updateHud();
}

function hideShop() {
  ui.shop.classList.add("hidden");
}

function hideReward() {
  ui.reward.classList.add("hidden");
  ui.rewardActions.classList.add("hidden");
}

// TASK 2: wires the "2 Players" checkbox's change listener exactly once (module load), so
// repeated calls to renderCharacterSelect() (every time the player returns to character
// select -- see showStartMenu()) never stack duplicate listeners. Sets the checkbox's
// CHECKED state from coopRequested every render instead, which is what actually makes the
// visual state persist across a return trip to this screen.
if (ui.coopToggle) {
  ui.coopToggle.addEventListener("change", () => {
    coopRequested = ui.coopToggle.checked;
  });
}

function renderCharacterSelect() {
  ui.characterCards.innerHTML = "";
  characterPortraits.length = 0;   // old portrait canvases are gone; drop stale refs
  if (ui.coopToggle) {
    ui.coopToggle.checked = coopRequested;
  }
  for (const character of characters) {
    const card = document.createElement("article");
    card.className = "character-card";
    card.innerHTML = `
      <canvas width="180" height="180" aria-hidden="true"></canvas>
      <h2>${character.name}</h2>
      <div class="card-meta"><span>${character.role}</span></div>
      <p>${character.description}</p>
      <button type="button">Start Run</button>
    `;
    drawCharacterPortrait(card.querySelector("canvas"), character);
    card.querySelector("button").addEventListener("click", () => {
      selectedCharacter = character;
      startGame();
    });
    ui.characterCards.appendChild(card);
  }
  renderClassBonusList();
}

function renderClassBonusList() {
  const rows = Object.entries(weaponClassBonuses).map(([tag, bonus]) => {
    const statName = statDefs.find((stat) => stat.key === bonus.stat)?.name ?? bonus.stat;
    return `
      <div class="class-bonus-row">
        <strong>${tag}</strong>
        <span>2: +${bonus.amounts[1]} ${statName}</span>
        <span>4: +${bonus.amounts[2]} ${statName}</span>
        <span>6: +${bonus.amounts[3]} ${statName}</span>
      </div>
    `;
  });
  rows.push(`
    <div class="class-bonus-row">
      <strong>Ranks</strong>
      <span>I: 1 point</span>
      <span>II: 2 points</span>
      <span>III+: 4+ points</span>
    </div>
  `);
  ui.classBonusList.innerHTML = rows.join("");
}

function showStartMenu() {
  state = freshState();
  hideShop();
  hideReward();
  hideMessage();
  hideSummary();
  setPaused(false);
  ui.startMenu.classList.remove("hidden");
  renderCharacterSelect();
  updateHud();
}

function showBodyReward() {
  state.mode = "reward";
  hideShop();
  ui.reward.classList.remove("hidden");
  ui.rewardEyebrow.textContent = "Body Upgrade";
  ui.rewardTitle.textContent = "Choose a Mutation";
  ui.rewardText.textContent = "Your body adapts after surviving the wave.";
  ui.rewardLuck.textContent = effectiveStat("luck");
  ui.rewardActions.classList.remove("hidden");
  state.bodyRewardChoices = rollBodyUpgrades();
  renderBodyRewardChoices();
}

function renderBodyRewardChoices() {
  ui.rewardCards.innerHTML = "";
  const price = mutationRerollPrice();
  ui.mutationRerollCost.textContent = price;
  ui.mutationRerollButton.disabled = state.scrap < price;

  for (const choice of state.bodyRewardChoices) {
    const card = rewardCard(choice.name, choice.description, choice.tier, "Grow", choice.part, "mutation", choice);
    card.querySelector("button").addEventListener("click", () => {
      addStat(choice.key, choice.amount);
      if (typeof unlockAchievement === "function") {
        unlockAchievement("mutated");
        // Tier 5 is the Legendary band on a body-part reward card.
        if (choice.tier === 5) unlockAchievement("built_different");
      }
      state.bodyRewardChoices = [];
      continueRewards();
    });
    ui.rewardCards.appendChild(card);
  }
}

function rollBodyUpgrades() {
  const used = new Set();
  const choices = [];
  while (choices.length < 3 && used.size < bodyUpgrades.length) {
    const tier = rollRarity();
    const upgrade = weightedBodyUpgradeChoice(bodyUpgrades.filter((candidate) => !used.has(candidate.key)));
    if (!upgrade) break;
    if (used.has(upgrade.key)) {
      continue;
    }
    used.add(upgrade.key);
    const amount = upgrade.amounts[tier - 1];
    const sign = amount > 0 ? "+" : "";
    const description = `${upgrade.part}: ${sign}${amount}${upgrade.suffix ?? ""} ${statDefs.find((stat) => stat.key === upgrade.key)?.name ?? upgrade.key}`;
    choices.push({
      ...upgrade,
      tier,
      amount,
      description: `${description}${upgrade.note ? `\n${upgrade.note}` : ""}`
    });
  }
  return choices;
}

function weightedBodyUpgradeChoice(pool) {
  if (!pool.length) return null;
  const total = pool.reduce((sum, upgrade) => sum + bodyUpgradeWeight(upgrade), 0);
  let roll = Math.random() * total;
  for (const upgrade of pool) {
    roll -= bodyUpgradeWeight(upgrade);
    if (roll <= 0) return upgrade;
  }
  return pool[pool.length - 1];
}

function bodyUpgradeWeight(upgrade) {
  if (upgrade.key === "dodge") return 0.42;
  return 1;
}

function continueRewards() {
  // Crates the player collected in the arena queue their rolled item; drain that queue
  // first, one Take-or-recycle screen each. (Legacy pendingCrates counter still honored.)
  if (state.pendingCrateItems.length > 0) {
    showCrateReward(state.pendingCrateItems.shift());
    return;
  }
  if (state.pendingCrates > 0) {
    state.pendingCrates -= 1;
    showCrateReward(rollUpgradeOffer(new Set(), 0, true));
    return;
  }
  if (state.pendingFortunes?.length > 0) {
    showFortuneReward(state.pendingFortunes.shift());
    return;
  }
  showShop();
}

function showCrateReward(item) {
  state.mode = "reward";
  ui.reward.classList.remove("hidden");
  ui.rewardActions.classList.add("hidden");
  ui.rewardEyebrow.textContent = "Crate";
  ui.rewardTitle.textContent = "Crate Found";
  ui.rewardLuck.textContent = effectiveStat("luck");
  ui.rewardCards.innerHTML = "";

  const remaining = state.pendingCrateItems.length + state.pendingCrates;
  const recycleValue = Math.max(4, Math.floor(calculateShopCost(item.baseCost, item.tier) * state.recycleRate));
  const weaponRewardBlocked = Boolean(item.weaponName && state.weapons.length >= maxWeaponSlots());
  ui.rewardText.textContent = remaining > 0
    ? `${remaining} more crate${remaining === 1 ? "" : "s"} to open.`
    : "A cracked crate spills something useful.";

  const takeCard = rewardCard(item.name, buildUpgradeDetailText(item), item.tier, "Take", "Box", "crate", item);
  takeCard.classList.add("crate-choice");
  takeCard.querySelector(".price strong").textContent = `${rarityNameFor(item)} | Recycle ${recycleValue}`;
  const takeButton = takeCard.querySelector(".price button");
  if (weaponRewardBlocked) {
    takeButton.disabled = true;
    takeButton.textContent = "Slots Full";
    takeButton.title = "Replace an equipped weapon below, or recycle this crate reward.";
    takeCard.appendChild(crateReplacementPanel(item));
  } else {
    takeButton.addEventListener("click", () => takeCrateReward(item));
  }

  const recycleButton = document.createElement("button");
  recycleButton.type = "button";
  recycleButton.className = "recycle";
  recycleButton.textContent = `Recycle +${recycleValue}`;
  recycleButton.addEventListener("click", () => {
    state.scrap += recycleValue;
    trackScrap(recycleValue);
    playSfx("coin");
    continueRewards();
  });
  takeCard.querySelector(".price").appendChild(recycleButton);
  ui.rewardCards.appendChild(takeCard);
}

// The slip is now WHITE (#fefefe), so the readability problem has FLIPPED versus the old pale
// parchment: it is the LIGHT rarity colours that wash out on white, while dark ones are perfectly
// readable. ONE general mechanism handles it -- any colour too light for white gets a soft gray
// chip behind the word plus a hairline dark ring and a fine dark text-shadow (.fortune-rarity-light
// in styles.css), which anchors the word without altering the rarity colour itself.
// Measured luminance of the seven rarity colours against the 0.55 threshold:
//   unique    #f2c45f 0.777 -> chip      legendary #ff9c3d 0.685 -> chip
//   uncommon  #74d3a4 0.695 -> chip      common    #9aa7b8 0.647 -> chip
//   epic      #ba7eff 0.622 -> chip      rare      #58aaff 0.609 -> chip
//   clown     #5a1f24 0.193 -> bare (near-black red; plenty of contrast on white already)
// So six of seven take the chip and clown alone goes bare, which is exactly the inverse of the
// old pale-slip behaviour. The threshold is data-driven, so any future rarity colour is handled.
function isLightRarityColor(hexColor) {
  const hex = String(hexColor).replace("#", "");
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
}

// ---- Fortune crack timing. These MUST stay in step with the @keyframes/animation declarations
// in styles.css (.fortune-stage.fortune-cracking* and its children):
//   phase 1  anticipation/squeeze   0 -> 210ms   (cookieSqueeze / cookieSqueezeClown, stage)
//            includes two stress jolts (micro counter-rotations) before the release
//   snap     sfx + crack flash + crumb burst  @ 210ms
//   phase 1b jagged crack line flash 210 -> 320ms (cookieCrackFlash, .fortune-crack-line)
//   phase 2  asymmetric 3D split     210 -> 680ms (cookieSnapLeft/Right, halves)
//   phase 2b slip unfurl             230 -> 730ms (fortuneSlipUnfurl, slip)
// Total ~730ms of animation; the reveal fires on the LAST half animation (cookieSnapRight*).
const CRACK_SQUEEZE_MS = 210;
const CRACK_SNAP_MS = CRACK_SQUEEZE_MS;
const CRACK_TOTAL_MS = 730;
const CRUMB_LIFE_MS = 760;
// The jagged white crack line lives only for its flash; removed slightly after it ends.
const CRACK_FLASH_MS = 110;

function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Spawns a debris burst at the seam of the cracked cookie: 7-10 small crumbs PLUS 2-3 larger
// chunks. Each is randomized inline (size, tan tone, seam offset, horizontal drift via the --dx
// custom property, spin via --spin, and a small stagger) so no two bursts look alike; the CSS
// keyframes do pop-up-then-accelerating-fall. The chunks are the realism beat -- a snapping
// cookie sheds a couple of visible shards, not just dust -- so they are bigger (7-10px), spin
// far less, and fall harder/faster (.fortune-chunk shortens the duration and steepens the drop).
// Every particle is removed by ONE cleanup timeout keyed off the longest possible life.
function spawnCookieCrumbs(stage, isClown) {
  const layer = document.createElement("div");
  layer.className = "fortune-crumbs";

  const tones = ["#d9a45b", "#cf9850", "#c08a45", "#b5813e", "#a8763a", "#e0b06a"];
  const smallCount = 7 + Math.floor(Math.random() * 4); // 7-10
  const chunkCount = 2 + Math.floor(Math.random() * 2); // 2-3
  // Clown cookies throw debris further and faster.
  const spread = isClown ? 52 : 30;

  for (let i = 0; i < smallCount + chunkCount; i += 1) {
    const isChunk = i >= smallCount;
    const crumb = document.createElement("div");
    crumb.className = isChunk ? "fortune-crumb fortune-chunk" : "fortune-crumb";
    const size = isChunk ? 7 + Math.random() * 3 : 3 + Math.random() * 3; // 7-10px / 3-6px
    crumb.style.width = `${size.toFixed(1)}px`;
    crumb.style.height = `${(size * (0.72 + Math.random() * 0.5)).toFixed(1)}px`;
    crumb.style.background = tones[Math.floor(Math.random() * tones.length)];
    // Seam-relative start: the seam is the horizontal centre of the stage.
    crumb.style.left = `calc(50% + ${(Math.random() * 16 - 8).toFixed(1)}px)`;
    crumb.style.top = `${(70 + Math.random() * 30).toFixed(1)}px`;
    // Chunks carry more mass: wider throw, but a lazier pop and much less spin.
    crumb.style.setProperty(
      "--dx",
      `${((Math.random() * 2 - 1) * spread * (isChunk ? 1.25 : 1)).toFixed(1)}px`
    );
    crumb.style.setProperty(
      "--pop",
      isChunk
        ? `${(-6 - Math.random() * 8).toFixed(1)}px`
        : `${(-10 - Math.random() * 12).toFixed(1)}px`
    );
    crumb.style.setProperty(
      "--spin",
      `${((Math.random() * 2 - 1) * (isClown ? 540 : 260) * (isChunk ? 0.28 : 1)).toFixed(0)}deg`
    );
    crumb.style.animationDelay = `${Math.floor(Math.random() * (isChunk ? 40 : 70))}ms`;
    layer.appendChild(crumb);
  }

  stage.appendChild(layer);
  window.setTimeout(() => layer.remove(), CRUMB_LIFE_MS + 200);
}

function showFortuneReward(fortune) {
  state.mode = "reward";
  ui.reward.classList.remove("hidden");
  ui.rewardActions.classList.add("hidden");
  ui.rewardEyebrow.textContent = "Fortune Cookie";
  ui.rewardTitle.textContent = "Unopened";
  ui.rewardLuck.textContent = effectiveStat("luck");
  ui.rewardCards.innerHTML = "";

  const remaining = state.pendingFortunes.length;
  ui.rewardText.textContent = remaining > 0
    ? `${remaining} more fortune cookie${remaining === 1 ? "" : "s"} to open.`
    : "A fortune cookie, still sealed.";

  const card = document.createElement("article");
  // .fortune-card is the dedicated look (warm dark backdrop, gold radial glow behind the stage,
  // thin amber border). It is deliberately rarity-NEUTRAL: nothing about the card, glow, border
  // or button colours varies with fortune.rarity, so the panel leaks nothing before the crack.
  card.className = "card fortune-card";

  const heading = document.createElement("h2");
  heading.textContent = "Fortune Cookie";
  card.appendChild(heading);

  // The cookie sprite is drawn as TWO halves of one background image (left half / right half,
  // offset by background-position) so the crack animation can pull them apart and leave them
  // flanking the fortune paper: half | paper | half. The stage is the HERO of a full-width
  // panel (.fortune-card spans the whole reward grid), so the halves are 90x180 each.
  const stage = document.createElement("div");
  stage.className = "fortune-stage";

  const cookieLeft = document.createElement("div");
  cookieLeft.className = "fortune-half fortune-half-left";

  const cookieRight = document.createElement("div");
  cookieRight.className = "fortune-half fortune-half-right";

  stage.appendChild(cookieLeft);
  stage.appendChild(cookieRight);
  card.appendChild(stage);

  const body = document.createElement("p");
  body.className = "fortune-intro";
  body.textContent = "Still sealed. What's inside stays secret until you crack it.";
  card.appendChild(body);

  const priceRow = document.createElement("div");
  priceRow.className = "price fortune-actions";

  const crackButton = document.createElement("button");
  crackButton.type = "button";
  // Primary action: warm gold fill, owns the row.
  crackButton.className = "fortune-crack-btn";
  crackButton.textContent = "Crack it open";

  const eatButton = document.createElement("button");
  eatButton.type = "button";
  // Secondary/ominous. The old .recycle class is dropped on purpose: its only rule is
  // `.price button.recycle { background: var(--gold) }`, which would fight the muted eat styling
  // at equal-ish specificity. Nothing else in the codebase keys off .recycle for this button
  // (grep: it is only ever used for shop/crate recycle buttons, which are untouched).
  eatButton.className = "fortune-eat-btn";
  eatButton.textContent = "Eat it whole";

  // Small muted line under the buttons so the cost of the shortcut is unambiguous before the
  // player commits. Declared here (ahead of the handlers that capture it) and appended to the
  // card further down, after priceRow; it is removed at reveal, by which point the choice has
  // already been made.
  const hint = document.createElement("p");
  hint.className = "fortune-hint";
  hint.textContent = "Eating it whole skips the fortune. You will choke (-1 max HP).";

  eatButton.addEventListener("click", () => {
    // Eating it whole skips the fortune entirely: no paper, no effect, and you choke on it for
    // 1 max HP. addStat already calls syncDerivedStats, which recomputes player.maxHp and
    // clamps current hp down to it, so no manual clamp is needed here.
    addStat("maxHp", -1);
    playSfx("hurt");
    showMessage("You choke on it", "-1 max HP, and no fortune", 1200);
    continueRewards();
  });

  crackButton.addEventListener("click", () => {
    // Both buttons must be dead before anything else happens: no double-crack, no eating a
    // cookie that is already mid-crack. Disable AND remove so a queued click on a button that
    // is still in the DOM for one more frame can't slip through.
    crackButton.disabled = true;
    eatButton.disabled = true;
    eatButton.remove();
    crackButton.remove();

    if (!state.armedFortunes) state.armedFortunes = [];
    state.armedFortunes.push(fortune); // pushed exactly once, right here, before the animation

    const isClown = fortune.rarity?.key === "clown";
    // The animation lives on the stage (shake -> halves split apart), not on the card, so the
    // card's own layout stays still while the cookie breaks.
    stage.classList.add("fortune-cracking");
    if (isClown) stage.classList.add("fortune-cracking-clown");

    // Blank white sliver that unrolls HORIZONTALLY out from between the halves during the split;
    // it is replaced by the real .fortune-paper at reveal time (same box, so the swap is
    // invisible), so the player never sees an empty gap.
    const slip = document.createElement("div");
    slip.className = "fortune-slip";
    stage.insertBefore(slip, cookieRight);

    // The crunch is fired at the SNAP moment (end of the squeeze), not at click: hearing the
    // break before the cookie has visibly given way is what made the old version feel fake.
    // "tree" is the existing tree-breaking sfx -- dry and crunchy, no new audio files.
    window.setTimeout(() => {
      if (typeof playSfx === "function") playSfx("tree");
    }, CRACK_SNAP_MS);

    // Crumb burst + crack flash: real breakage throws debris AND the fracture itself is visible
    // for an instant. Both are spawned at the snap and removed by their own cleanup timeouts, so
    // repeated fortune panels never accumulate orphan nodes. Skipped entirely under reduced
    // motion (no particles, no flash at all).
    if (!prefersReducedMotion()) {
      window.setTimeout(() => {
        if (!stage.isConnected) return;
        spawnCookieCrumbs(stage, isClown);
        // The fracture line: a thin white zigzag (clip-path polygon, see .fortune-crack-line in
        // styles.css) that snaps across the seam and fades in ~110ms. Purely decorative and
        // pointer-events: none, so it can never intercept the Continue click that follows.
        const crackLine = document.createElement("div");
        crackLine.className = "fortune-crack-line";
        stage.appendChild(crackLine);
        window.setTimeout(() => crackLine.remove(), CRACK_FLASH_MS + 90);
      }, CRACK_SNAP_MS);
    }

    let revealed = false;
    const revealFortune = () => {
      if (revealed) return; // animationend + timeout fallback must not both fire
      // The player may have already moved on (panel replaced, reward advanced) by the time this
      // runs -- state.mode !== "reward" or the card no longer being in the live document both
      // mean it's stale, so bail instead of writing into a detached/reused node.
      // NOTE: `revealed` is latched only on a SUCCESSFUL reveal, never on a stale bail. Latching
      // it here would be irreversible: the buttons are already gone, so if the primary trigger
      // bailed on a transient stale read the fallback could never retry and the player would be
      // stuck on a fortune panel with no Continue button -- a soft-locked run.
      if (state.mode !== "reward" || !card.isConnected) return;
      revealed = true;

      card.removeEventListener("animationend", onCrackAnimationEnd);
      // .fortune-cracking is deliberately LEFT ON the stage: its half-split animations use
      // animation-fill-mode: both, and that is what pins the two halves at their parted
      // positions for the final half | paper | half layout. Removing it would snap the cookie
      // back together. Only the intro text goes away here.
      ui.rewardTitle.textContent = "Your Fortune";
      body.remove();
      hint.remove();
      // Post-reveal styling hook: dims the heading and lets the paper be the visual hero while
      // the warm glow stays. Purely presentational -- still no rarity information on the card.
      card.classList.add("fortune-card-revealed");

      const paper = document.createElement("p");
      paper.className = "fortune-paper";
      paper.textContent = fortune.paperText;

      const rarityTag = document.createElement("div");
      rarityTag.className = "fortune-rarity";
      if (isLightRarityColor(fortune.rarity.color)) {
        rarityTag.classList.add("fortune-rarity-light");
      }
      rarityTag.textContent = fortune.rarity.label;
      rarityTag.style.color = fortune.rarity.color;
      paper.appendChild(rarityTag);
      // Final layout: half | paper | half. The blank slip is swapped out for the real paper in
      // the exact same slot between the two halves.
      stage.replaceChild(paper, slip);

      const continueButton = document.createElement("button");
      continueButton.type = "button";
      continueButton.className = "fortune-continue-btn";
      continueButton.textContent = "Continue";
      continueButton.addEventListener("click", () => continueRewards());
      priceRow.innerHTML = "";
      priceRow.appendChild(continueButton);
    };

    // animationend BUBBLES, and the crack plays several animations at once (stage squeeze, both
    // halves snapping apart, the slip unfurling, every crumb falling). A plain { once: true }
    // listener would be consumed by whichever finishes FIRST -- the 170ms squeeze -- revealing
    // the paper before the halves have parted. So the listener is NOT once-only: it ignores
    // every animationend except the one named cookieSnapRight (the right half, which runs to the
    // end of the sequence), and only then reveals. This deliberately filters on animation NAME,
    // not on target: the clown variant swaps the name via animation-name, so both are accepted.
    // If these keyframes are ever renamed in styles.css, THIS LIST MUST BE RENAMED WITH THEM --
    // a mismatch silently downgrades every reveal to the slow timeout fallback.
    const FINAL_ANIMATIONS = ["cookieSnapRight", "cookieSnapRightClown"];
    function onCrackAnimationEnd(event) {
      if (!FINAL_ANIMATIONS.includes(event.animationName)) return;
      revealFortune();
    }
    card.addEventListener("animationend", onCrackAnimationEnd);

    // A mis-fired/skipped animationend (tab backgrounded, style recalculated away, etc.) must
    // never leave the player stuck with no Continue button -- the timeout fallback guarantees
    // the reveal happens regardless. Sized to the full sequence (~690ms) plus a generous margin.
    window.setTimeout(revealFortune, CRACK_TOTAL_MS + 600);
  });

  priceRow.appendChild(crackButton);
  priceRow.appendChild(eatButton);
  card.appendChild(priceRow);
  card.appendChild(hint);

  ui.rewardCards.appendChild(card);
}

function takeCrateReward(item) {
  recordUpgrade(item);
  applyImmediatePurchaseEffect(item);
  continueRewards();
}

function takeCrateWeaponReplacing(item, weaponIndex) {
  if (!item.weaponName || weaponIndex < 0 || weaponIndex >= state.weapons.length) return;
  state.weapons[weaponIndex] = { name: item.weaponName, tier: item.tier ?? 1, fireCooldown: rand(0.05, 0.35) };
  syncDerivedStats();
  applyImmediatePurchaseEffect(item);
  continueRewards();
}

function crateReplacementPanel(item) {
  const panel = document.createElement("div");
  panel.className = "crate-replace-panel";
  panel.innerHTML = `
    <strong>Weapon slots full</strong>
    <span>Pick one equipped weapon to replace with ${item.name}.</span>
    <div class="crate-replace-grid"></div>
  `;
  const grid = panel.querySelector(".crate-replace-grid");
  for (let index = 0; index < Math.min(maxWeaponSlots(), state.weapons.length); index += 1) {
    const weapon = state.weapons[index];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `crate-replace-weapon tier-${weapon.tier}`;
    button.innerHTML = `
      <canvas width="54" height="54" aria-hidden="true"></canvas>
      <span>${weapon.name}</span>
      <small>${tierLabel(weapon.tier)} | ${formatWeaponCombatStats(weapon).split("\n")[1] ?? ""}</small>
    `;
    drawWeaponIcon(button.querySelector("canvas"), weapon.name, weapon.tier);
    button.addEventListener("click", () => takeCrateWeaponReplacing(item, index));
    grid.appendChild(button);
  }
  return panel;
}

function rewardCard(title, description, tier, buttonText, badgeText = tier, artKind = "tier", artData = null) {
  const card = document.createElement("article");
  card.className = `card tier-${tier}${isUniqueUpgrade(artData) ? " unique" : ""}`;
  const rewardLabel = artData ? rarityNameFor(artData) : rarities[tier].name;
  card.innerHTML = `
    ${rewardArtHtml(artKind, badgeText, tier, artData)}
    <h2>${title}</h2>
    <p>${String(description).replace(/\n/g, "<br>")}</p>
    <div class="price">
      <strong>${rewardLabel}</strong>
      <button type="button">${buttonText}</button>
    </div>
  `;
  const icon = card.querySelector(".item-icon");
  if (icon) {
    const iconData = artData ?? { badge: badgeText, tier };
    drawItemIcon(icon, iconData, artKind);
    if (itemArtIsFullCard(iconData)) card.classList.add("has-art-tile");
  }
  return card;
}

function rewardArtHtml(kind, label, tier, artData = null) {
  const badge = artData ? rankLabelFor(artData) : tierLabel(tier);
  if (kind === "crate") {
    return `
      <div class="reward-art-wrap">
        <canvas class="item-icon reward-icon" width="96" height="96" aria-hidden="true"></canvas>
        <div class="rank-badge">${badge}</div>
      </div>
    `;
  }

  if (kind === "scrap") {
    return `
      <div class="reward-art-wrap">
        <div class="reward-art scrap-art">
          <span class="scrap-coin coin-one"></span>
          <span class="scrap-coin coin-two"></span>
          <span class="scrap-coin coin-three"></span>
          <span class="scrap-bolt"></span>
        </div>
        <div class="badge">${label}</div>
      </div>
    `;
  }

  if (kind === "mutation") {
    return `
      <div class="reward-art-wrap">
        <canvas class="item-icon reward-icon" width="96" height="96" aria-hidden="true"></canvas>
        <div class="rank-badge">${badge}</div>
      </div>
    `;
  }

  return `
    <div class="reward-art-wrap">
      <canvas class="item-icon reward-icon" width="96" height="96" aria-hidden="true"></canvas>
      <div class="rank-badge">${badge}</div>
    </div>
  `;
}

function tierLabel(tier) {
  return ["", "I", "II", "III", "IV", "V"][Math.max(1, Math.min(MAX_WEAPON_RANK, tier))] ?? "I";
}

function isUniqueUpgrade(item) {
  if (!item) return false;
  if (item.unique) return true;
  const id = item.id;
  return Boolean(id && upgrades.find((upgrade) => upgrade.id === id)?.unique);
}

function rankLabelFor(item) {
  return isUniqueUpgrade(item) ? "Unique" : tierLabel(item.tier ?? 1);
}

function rarityNameFor(item) {
  return isUniqueUpgrade(item) ? "Unique" : rarities[item.tier]?.name ?? "Common";
}

function tierTextFor(item) {
  return isUniqueUpgrade(item) ? "Unique" : `Tier ${tierLabel(item.tier ?? 1)}`;
}
