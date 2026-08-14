"use strict";

// core.js - DOM references, helpers, constants, enemy/character data

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  wave: document.getElementById("waveText"),
  time: document.getElementById("timeText"),
  scrap: document.getElementById("scrapText"),
  bag: document.getElementById("bagText"),
  hpFill: document.getElementById("hpFill"),
  hpText: document.getElementById("hpText"),
  // PHASE 1 CO-OP: P2's health bar, hidden unless P2 is active -- see updateHud() (js/06-shop.js).
  hpStat2: document.getElementById("hpStat2"),
  hpFill2: document.getElementById("hpFill2"),
  hpText2: document.getElementById("hpText2"),
  // Boss health bar (BOSS SYSTEM). Only shown during a boss fight -- see updateHud().
  bossBar: document.getElementById("bossBar"),
  bossBarFill: document.getElementById("bossBarFill"),
  bossBarName: document.getElementById("bossBarName"),
  message: document.getElementById("message"),
  titleScreen: document.getElementById("titleScreen"),
  titleStage: document.getElementById("titleStage"),
  titlePlayButton: document.getElementById("titlePlayButton"),
  titleOptionsButton: document.getElementById("titleOptionsButton"),
  titleQuitButton: document.getElementById("titleQuitButton"),
  titleOptions: document.getElementById("titleOptions"),
  titleOptionsBack: document.getElementById("titleOptionsBack"),
  titleAccountButton: document.getElementById("titleAccountButton"),
  titleLogInButton: document.getElementById("titleLogInButton"),
  titleSignUpButton: document.getElementById("titleSignUpButton"),
  titleAccount: document.getElementById("titleAccount"),
  titleAccountBack: document.getElementById("titleAccountBack"),
  titleVolumeSlider: document.getElementById("titleVolumeSlider"),
  titleMuteToggle: document.getElementById("titleMuteToggle"),
  titleShakeToggle: document.getElementById("titleShakeToggle"),
  startMenu: document.getElementById("startMenu"),
  characterCards: document.getElementById("characterCards"),
  classBonusList: document.getElementById("classBonusList"),
  compendiumButton: document.getElementById("compendiumButton"),
  achievementsButton: document.getElementById("achievementsButton"),
  shop: document.getElementById("shop"),
  shopCards: document.getElementById("shopCards"),
  shopScrap: document.getElementById("shopScrapText"),
  shopBag: document.getElementById("shopBagText"),
  shopStatList: document.getElementById("shopStatList"),
  playerPreview: document.getElementById("playerPreview"),
  weaponList: document.getElementById("weaponList"),
  itemList: document.getElementById("itemList"),
  detailTitle: document.getElementById("detailTitle"),
  detailMeta: document.getElementById("detailMeta"),
  detailText: document.getElementById("detailText"),
  detailActions: document.getElementById("detailActions"),
  reward: document.getElementById("reward"),
  rewardEyebrow: document.getElementById("rewardEyebrow"),
  rewardTitle: document.getElementById("rewardTitle"),
  rewardText: document.getElementById("rewardText"),
  rewardCards: document.getElementById("rewardCards"),
  rewardLuck: document.getElementById("rewardLuckText"),
  rewardActions: document.getElementById("rewardActions"),
  mutationRerollButton: document.getElementById("mutationRerollButton"),
  mutationRerollCost: document.getElementById("mutationRerollCostText"),
  rerollButton: document.getElementById("rerollButton"),
  rerollCost: document.getElementById("rerollCostText"),
  nextWaveButton: document.getElementById("nextWaveButton"),
  pauseMenu: document.getElementById("pauseMenu"),
  resumeButton: document.getElementById("resumeButton"),
  abandonButton: document.getElementById("abandonButton"),
  volumeSlider: document.getElementById("volumeSlider"),
  muteToggle: document.getElementById("muteToggle"),
  shakeToggle: document.getElementById("shakeToggle"),
  summary: document.getElementById("summary"),
  summaryTitle: document.getElementById("summaryTitle"),
  summaryStats: document.getElementById("summaryStats"),
  summaryWeapons: document.getElementById("summaryWeapons"),
  summaryDamageTaken: document.getElementById("summaryDamageTaken"),
  summaryRestartButton: document.getElementById("summaryRestartButton")
};

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const shadeHexColor = (hex, blackMix) => {
  const clean = String(hex).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return "rgb(17, 23, 34)";
  const keep = 1 - clamp(blackMix, 0, 1);
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * keep);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * keep);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * keep);
  return `rgb(${r}, ${g}, ${b})`;
};
const distSq = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

const MAX_ENEMIES = 480;   // raised with the faster spawn curve so late waves stay dense
const BASE_WEAPON_SLOTS = 6;
const MAX_WEAPON_RANK = 5;
const DRUMMER_BUFF_RADIUS = 260;
const DRUMMER_SPEED_MULTIPLIER = 1.4;
const DRUMMER_DAMAGE_MULTIPLIER = 1.25;

// --- BOSS SYSTEM constants (see js/04-flow.js for the interstitial fight flow, and
// js/07-combat.js for the Nibbler King attack state machine / updateBossEnemy). Grouped
// here, away from the enemyTypes array below, so they don't collide with edits to it.
const BOSS_WAVE_INTERVAL = 10;   // a boss fight happens after every 10th wave, as an interstitial
const BOSS_PHASE2_HP_FRACTION = 0.5;

const enemyTypes = [
  { name: "Nibbler", behavior: "chase", size: "small", color: "#f1766e", hp: 9, speed: 106, radius: 16, damage: 6, scrap: 1, minWave: 1, weight: 14 },
  { name: "Skitter", behavior: "chase", size: "small", color: "#88d27a", hp: 6, speed: 158, radius: 12, damage: 3, scrap: 1, minWave: 2, weight: 12 },
  { name: "Bruiser", behavior: "chase", size: "large", color: "#b28cf2", hp: 92, speed: 34, radius: 28, damage: 14, scrap: 9, minWave: 3, weight: 2 },
  { name: "Darter", behavior: "charge", size: "medium", color: "#ff9c5b", hp: 40, speed: 68, radius: 18, damage: 10, scrap: 2, minWave: 4, weight: 1 },
  { name: "Ember Glob", behavior: "fireball", size: "medium", color: "#e56f45", hp: 16, speed: 52, radius: 17, damage: 5, scrap: 2, minWave: 5, weight: 1 },
  { name: "Spitter", behavior: "shoot", size: "medium", color: "#66c7d8", hp: 20, speed: 58, radius: 18, damage: 8, scrap: 2, minWave: 5, weight: 3 },
  { name: "Orbiter", behavior: "orbit", size: "small", color: "#f2d35f", hp: 11, speed: 162, radius: 14, damage: 6, scrap: 1, minWave: 6, weight: 6 },
  { name: "Drummer", behavior: "buffer", size: "large", color: "#ff7eb6", hp: 80, speed: 36, radius: 30, damage: 10, scrap: 5, minWave: 7, weight: 1 },

  // --- New cast (see brotato-art-wiring / ART_BRIEF for how the PNGs are registered) ---
  // Husk: small and brittle, cheap scrap. Its whole point is the death split (see killEnemy),
  // so its own HP/damage stay modest — the threat is what it leaves behind, not itself.
  { name: "Husk", behavior: "chase", size: "small", color: "#c9a26a", hp: 13, speed: 96, radius: 15, damage: 5, scrap: 1, minWave: 4, weight: 4 },
  // Thistle: stationary turret, spawned in-arena by its own placement logic (not the edge
  // spawner) — see rollTurretSpawnPos in js/07-combat.js. HP is on the higher side since it
  // can't dodge or flee.
  // HP 34 -> 58: it is a rooted, woody plant that can never dodge, flee or reposition, so it
  // should take real effort to clear rather than dying faster than a Darter (40) that can
  // actually escape. Still well under the Bruiser (92) -- it is sturdy, not a boss.
  { name: "Thistle", behavior: "turret", size: "medium", color: "#7fae5c", hp: 58, speed: 0, radius: 19, damage: 6, scrap: 3, minWave: 6, weight: 2 },
  // Blight Sac: medium bloated chaser, drops a poison pool on death (see killEnemy/updatePoisonPools).
  { name: "Blight Sac", behavior: "chase", size: "medium", color: "#8fbf5a", hp: 30, speed: 46, radius: 20, damage: 7, scrap: 3, minWave: 7, weight: 2 },
  // Gravebloom: large, slow, interruptible summoner. Big HP pool so a focus-fire interrupt
  // is a real decision rather than a free kill — see the "summoner" behavior branch.
  { name: "Gravebloom", behavior: "summoner", size: "large", color: "#7a5ea8", hp: 70, speed: 30, radius: 27, damage: 11, scrap: 6, minWave: 9, weight: 1 },
  // Clown family: base Clown implodes into 2 Clown Mid, which each implode into 2 Clown
  // Small (see killEnemy). Kept RARE (weight 1) since one kill eventually yields 7 bodies.
  // Clown Mid/Small exist here only as spawnEnemy templates — chooseEnemyType filters them
  // out via spawnable:false so the wave roll never picks them directly.
  { name: "Clown", behavior: "chase", size: "large", color: "#ff6f91", hp: 60, speed: 50, radius: 26, damage: 10, scrap: 5, minWave: 10, weight: 1 },
  { name: "Clown Mid", behavior: "chase", size: "medium", color: "#ff8fab", hp: 22, speed: 72, radius: 18, damage: 7, scrap: 2, minWave: Infinity, weight: 0, spawnable: false },
  { name: "Clown Small", behavior: "chase", size: "small", color: "#ffb0c4", hp: 9, speed: 128, radius: 12, damage: 4, scrap: 1, minWave: Infinity, weight: 0, spawnable: false },

  // --- BOSS SYSTEM: Nibbler King (see js/04-flow.js startBossFight / js/07-combat.js
  // updateBossEnemy for the fight logic). Never rolled by chooseEnemyType (spawnable:false,
  // minWave:Infinity) -- it is only ever created directly via spawnEnemy(nibblerKingTemplate(idx)).
  // hp below is a PLACEHOLDER base; the real per-fight HP is computed by nibblerKingHp(bossIndex)
  // in js/07-combat.js and stamped onto the spawned instance after spawnEnemy() runs (spawnEnemy's
  // own enemyScaling()/sizeHpMultiplier() math is tuned for swarm enemies, not a single boss, so
  // it is overridden rather than fought). speed is deliberately slow -- a massive, lumbering
  // Nibbler that wins through attacks and adds, not by outrunning the player. damage is its
  // CONTACT damage only (touching its body -- see the generic contact-damage loop in
  // updateEnemies(), js/07-combat.js, which the boss goes through unmodified like any other
  // enemy); attack damage is set per-attack in the boss attack state machine.
  // radius bumped 52 -> 66 (+27%) so the King's body is genuinely dangerous to stand in --
  // spawnEnemy() copies template.radius straight onto the instance with no separate scaling,
  // and drawEnemyArtBody() sizes the sprite as `enemy.radius * 2 * cfg.scale`, so this single
  // number drives BOTH the collision circle and the rendered size together: bumping it alone
  // cannot desync hitbox from what the player sees, unlike a fixed pixel hitbox would.
  // damage bumped 22 -> 34 (contact-only; ~1.5x) to make standing in the enlarged body actually
  // punishing rather than a minor chip -- see enemyContactDamage()/ENEMY_CONTACT_COOLDOWN in
  // js/07-combat.js for the tick mechanism this number feeds, reused unmodified from every
  // other enemy's contact damage (no separate boss-only system).
  // v0.18.0: dropped 34 -> 20. At 34, standing inside the boss's now-doubled body (contact
  // overlap = playerHitRadius() + 132 radius) hit a lean 90 HP player every ENEMY_CONTACT_COOLDOWN
  // (0.48s) for 3 hits (0/0.48/0.96s) -- dead in under 1s, effectively a standing one-shot. At 20,
  // the same player needs 5 hits (0/0.48/0.96/1.44/1.92s) to die, pushing survival past ~1.9s of
  // continuous contact -- enough time to react and step out. Every attack's damage below is
  // expressed as boss.damage * a multiplier, so this single field change also scales every
  // attack down proportionally (~59% of its old value) -- see the final v0.18.0 balance report
  // for confirmation none of them one-shot a 90 HP player after this change.
  { name: "Nibbler King", behavior: "boss", size: "large", color: "#f1766e", hp: 1400, speed: 58, radius: 132, damage: 20, scrap: 260, minWave: Infinity, weight: 0, spawnable: false }
];

const rarities = {
  1: { name: "Common", color: "#9aa7b8", cost: 1, minWave: 1 },
  2: { name: "Uncommon", color: "#74d3a4", cost: 1.35, minWave: 2 },
  3: { name: "Rare", color: "#58aaff", cost: 1.85, minWave: 4 },
  4: { name: "Epic", color: "#ba7eff", cost: 2.65, minWave: 7 },
  5: { name: "Legendary", color: "#ff9c3d", cost: 4.2, minWave: 11 }
};

const bodyUpgrades = [
  { key: "maxHp", name: "Reinforced Heart", part: "Heart", amounts: [3, 6, 10, 16, 26] },
  { key: "hpRegen", name: "Steady Heartbeat", part: "Heart", amounts: [1, 2, 3, 5, 8] },
  { key: "lifeSteal", name: "Hungry Veins", part: "Veins", amounts: [1, 2, 4, 6, 10], suffix: "%" },
  { key: "damagePercent", name: "Buff Arms", part: "Muscles", amounts: [4, 8, 12, 18, 28], suffix: "%" },
  { key: "meleeDamage", name: "Heavy Hands", part: "Hands", amounts: [1, 2, 3, 5, 8] },
  { key: "rangedDamage", name: "Steady Eye", part: "Eye", amounts: [1, 2, 3, 5, 8] },
  { key: "elementalDamage", name: "Charged Nerves", part: "Nerves", amounts: [1, 2, 3, 5, 8] },
  { key: "attackSpeed", name: "Twitch Tendons", part: "Tendons", amounts: [5, 9, 14, 20, 32], suffix: "%" },
  { key: "critChance", name: "Sharp Instinct", part: "Brain", amounts: [2, 4, 7, 10, 16], suffix: "%" },
  { key: "engineering", name: "Tool Sense", part: "Fingers", amounts: [1, 2, 4, 6, 10] },
  { key: "range", name: "Longer Arms", part: "Arms", amounts: [15, 30, 50, 75, 115] },
  { key: "armor", name: "Thicker Skin", part: "Skin", amounts: [1, 2, 4, 6, 10] },
  { key: "dodge", name: "Loose Ankles", part: "Ankles", amounts: [2, 3, 5, 8, 12], suffix: "%" },
  { key: "speed", name: "Quicker Legs", part: "Legs", amounts: [3, 6, 10, 15, 23], suffix: "%" },
  { key: "luck", name: "Lucky Mole", part: "Mole", amounts: [3, 6, 10, 15, 24], note: "I know it is supposed to be a skin mole, but I thought this looked better." },
  { key: "harvesting", name: "Greener Thumb", part: "Thumb", amounts: [3, 6, 10, 15, 24] }
];

const statDefs = [
  { key: "maxHp", name: "Max HP" },
  { key: "hpRegen", name: "HP Regen" },
  { key: "lifeSteal", name: "Life Steal", suffix: "%" },
  { key: "damagePercent", name: "Damage", suffix: "%", signed: true },
  { key: "meleeDamage", name: "Melee Damage" },
  { key: "rangedDamage", name: "Ranged Damage" },
  { key: "elementalDamage", name: "Elemental Damage" },
  { key: "attackSpeed", name: "Attack Speed", suffix: "%", signed: true },
  { key: "critChance", name: "Crit Chance", suffix: "%" },
  { key: "engineering", name: "Engineering" },
  { key: "range", name: "Range" },
  { key: "armor", name: "Armor" },
  { key: "dodge", name: "Dodge", suffix: "%" },
  { key: "speed", name: "Speed", suffix: "%", signed: true },
  { key: "luck", name: "Luck" },
  { key: "harvesting", name: "Harvesting" },
  { key: "pickupRange", name: "Pickup Range" }
];

const BASE_PLAYER_STATS = {
  maxHp: 100,
  hpRegen: 0,
  lifeSteal: 0,
  damagePercent: 0,
  meleeDamage: 0,
  rangedDamage: 8,
  elementalDamage: 0,
  attackSpeed: 0,
  critChance: 3,
  engineering: 0,
  range: 390,
  armor: 0,
  dodge: 0,
  speed: 0,
  luck: 0,
  harvesting: 0,
  pickupRange: 120
};

const OWNED_TIER_MULTIPLIERS = [0, 1, 2.25, 5.1, 11.5, 26];
const UNIQUE_TIER = 5;
// The slot machine rolls two independent effects, each of which flips good/bad on its own
// (see rollSlotMachineEffect). The downside pool is kept as wide as the buff pool so a
// two-downside spin doesn't keep landing on the same two or three stats and feel repetitive.
// Both pools use percentage-style stats so a 4-10 roll reads consistently either way.
const SLOT_MACHINE_BUFFS = ["damagePercent", "attackSpeed", "critChance", "dodge", "speed"];
const SLOT_MACHINE_DOWNSIDES = ["damagePercent", "attackSpeed", "critChance", "dodge", "speed"];

const characters = [
  {
    id: "sprout",
    name: "Sprout",
    role: "Balanced starter",
    description: "+5 Max HP, +4% Damage. No downside.",
    body: "#f6d28f",
    leaf: "#92d486",
    accent: "#73b7ff",
    stats: { maxHp: 5, damagePercent: 4 }
  },
  {
    id: "chunk",
    name: "Chunk",
    role: "Slow armored heavy hitter",
    description: "+30 Max HP, +7 Armor, +15% Damage, -18% Speed, -14% Attack Speed.",
    body: "#e3b071",
    leaf: "#74d3a4",
    accent: "#b28cf2",
    scale: 1.18,
    stats: { maxHp: 30, armor: 7, damagePercent: 15, speed: -18, attackSpeed: -14 }
  },
  {
    id: "zip",
    name: "Zip",
    role: "Fast, lucky scavenger",
    description: "+26% Speed, +22 Luck, +6% Attack Speed, -20 Max HP, -8% Damage.",
    body: "#f4c7a3",
    leaf: "#f2d35f",
    accent: "#ff9c5b",
    scale: 0.9,
    stats: { speed: 26, luck: 22, attackSpeed: 6, maxHp: -20, damagePercent: -8 }
  }
];

let selectedCharacter = characters[0];
