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
  message: document.getElementById("message"),
  titleScreen: document.getElementById("titleScreen"),
  titleStage: document.getElementById("titleStage"),
  titlePlayButton: document.getElementById("titlePlayButton"),
  titleOptionsButton: document.getElementById("titleOptionsButton"),
  titleQuitButton: document.getElementById("titleQuitButton"),
  titleOptions: document.getElementById("titleOptions"),
  titleOptionsBack: document.getElementById("titleOptionsBack"),
  titleVolumeSlider: document.getElementById("titleVolumeSlider"),
  titleMuteToggle: document.getElementById("titleMuteToggle"),
  titleShakeToggle: document.getElementById("titleShakeToggle"),
  startMenu: document.getElementById("startMenu"),
  characterCards: document.getElementById("characterCards"),
  classBonusList: document.getElementById("classBonusList"),
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

const MAX_ENEMIES = 320;
const BASE_WEAPON_SLOTS = 6;
const MAX_WEAPON_RANK = 5;
const DRUMMER_BUFF_RADIUS = 260;
const DRUMMER_SPEED_MULTIPLIER = 1.25;
const DRUMMER_DAMAGE_MULTIPLIER = 1.1;

const enemyTypes = [
  { name: "Nibbler", behavior: "chase", size: "small", color: "#f1766e", hp: 9, speed: 106, radius: 16, damage: 6, scrap: 1, minWave: 1, weight: 8 },
  { name: "Skitter", behavior: "chase", size: "small", color: "#88d27a", hp: 6, speed: 158, radius: 12, damage: 4, scrap: 1, minWave: 2, weight: 6 },
  { name: "Bruiser", behavior: "chase", size: "large", color: "#b28cf2", hp: 42, speed: 45, radius: 28, damage: 20, scrap: 4, minWave: 4, weight: 2 },
  { name: "Darter", behavior: "charge", size: "medium", color: "#ff9c5b", hp: 57, speed: 68, radius: 18, damage: 15, scrap: 2, minWave: 5, weight: 3 },
  { name: "Ember Glob", behavior: "fireball", size: "medium", color: "#e56f45", hp: 16, speed: 52, radius: 17, damage: 5, scrap: 2, minWave: 6, weight: 1 },
  { name: "Spitter", behavior: "shoot", size: "medium", color: "#66c7d8", hp: 20, speed: 58, radius: 18, damage: 10, scrap: 2, minWave: 6, weight: 3 },
  { name: "Orbiter", behavior: "orbit", size: "small", color: "#f2d35f", hp: 11, speed: 162, radius: 14, damage: 6, scrap: 1, minWave: 7, weight: 3 },
  { name: "Drummer", behavior: "buffer", size: "large", color: "#ff7eb6", hp: 58, speed: 36, radius: 30, damage: 18, scrap: 5, minWave: 9, weight: 1 }
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
  { key: "damagePercent", name: "Knotted Muscles", part: "Muscles", amounts: [4, 8, 12, 18, 28], suffix: "%" },
  { key: "meleeDamage", name: "Heavy Hands", part: "Hands", amounts: [1, 2, 3, 5, 8] },
  { key: "rangedDamage", name: "Steady Eye", part: "Eye", amounts: [1, 2, 3, 5, 8] },
  { key: "elementalDamage", name: "Hot Nerves", part: "Nerves", amounts: [1, 2, 3, 5, 8] },
  { key: "attackSpeed", name: "Twitch Tendons", part: "Tendons", amounts: [5, 9, 14, 20, 32], suffix: "%" },
  { key: "critChance", name: "Sharp Instinct", part: "Brain", amounts: [2, 4, 7, 10, 16], suffix: "%" },
  { key: "engineering", name: "Tool Sense", part: "Fingers", amounts: [1, 2, 4, 6, 10] },
  { key: "range", name: "Longer Arms", part: "Arms", amounts: [15, 30, 50, 75, 115] },
  { key: "armor", name: "Thicker Skin", part: "Skin", amounts: [1, 2, 4, 6, 10] },
  { key: "dodge", name: "Loose Ankles", part: "Ankles", amounts: [2, 3, 5, 8, 12], suffix: "%" },
  { key: "speed", name: "Quicker Legs", part: "Legs", amounts: [3, 6, 10, 15, 23], suffix: "%" },
  { key: "luck", name: "Lucky Mole", part: "Mole", amounts: [3, 6, 10, 15, 24] },
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
  maxHp: 80,
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
const SLOT_MACHINE_BUFFS = ["damagePercent", "attackSpeed", "critChance", "dodge", "speed"];
const SLOT_MACHINE_DOWNSIDES = ["damagePercent", "attackSpeed", "speed"];

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
    role: "Big and stubborn",
    description: "+22 Max HP, +4 Armor, -12% Speed, -8% Attack Speed.",
    body: "#e3b071",
    leaf: "#74d3a4",
    accent: "#b28cf2",
    scale: 1.18,
    stats: { maxHp: 22, armor: 4, speed: -12, attackSpeed: -8 }
  },
  {
    id: "zip",
    name: "Zip",
    role: "Fast scavenger",
    description: "+14% Speed, +12 Luck, -12 Max HP, -6% Damage.",
    body: "#f4c7a3",
    leaf: "#f2d35f",
    accent: "#ff9c5b",
    scale: 0.9,
    stats: { speed: 14, luck: 12, maxHp: -12, damagePercent: -6 }
  }
];

let selectedCharacter = characters[0];
