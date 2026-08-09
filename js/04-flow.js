"use strict";

// flow.js - run state, wave flow, shop rolls, rewards

let state;
let lastTime = performance.now();
let messageToken = 0;

function maxWeaponSlots() {
  return BASE_WEAPON_SLOTS + (state?.extraWeaponSlots ?? 0);
}

function freshState() {
  return {
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
    bodyRewardChoices: [],
    rewardRerollCount: 0,
    detailTipDismissed: false,
    openActionMenu: null,
    shopDiscount: 0,
    recycleRate: 0.35,
    treeOneShot: false,
    extraWeaponSlots: 0,
    character: selectedCharacter,
    runStats: freshRunStats(),
    player: {
      x: W / 2,
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
      stats: { ...BASE_PLAYER_STATS }
    },
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
}

function syncDerivedStats() {
  const player = state.player;
  const ownedEffects = calculateOwnedUpgradeEffects();
  state.shopDiscount = Math.min(0.55, ownedEffects.shopDiscount);
  state.recycleRate = Math.min(0.75, 0.35 + ownedEffects.recycleRateBonus);
  state.treeOneShot = ownedEffects.treeOneShot;
  state.extraWeaponSlots = ownedEffects.extraWeaponSlots;
  player.projectiles = 1 + ownedEffects.projectiles;
  player.maxHp = Math.max(1, effectiveStat("maxHp"));
  player.hp = Math.min(player.hp, player.maxHp);
  player.speed = 210 * brotatoPercentMultiplier(effectiveStat("speed"));
  player.fireRate = 1.7 * brotatoPercentMultiplier(effectiveStat("attackSpeed"));
  player.range = Math.max(80, effectiveStat("range"));
  player.pickupRange = Math.max(40, effectiveStat("pickupRange"));
  player.shotSpeed = 540 + effectiveStat("range") * 0.06 + effectiveStat("engineering") * 8;
  const equipped = state.weapons.slice(0, maxWeaponSlots());
  player.damage = equipped.length
    ? equipped.reduce((sum, weapon) => sum + weaponShotDamage(weapon), 0) / equipped.length
    : Math.max(1, effectiveStat("rangedDamage") * brotatoPercentMultiplier(effectiveStat("damagePercent")));
}

function weaponPowerValue(weapon) {
  return weaponShotDamage(weapon);
}

function startGame() {
  state = freshState();
  applyCharacter(selectedCharacter);
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
  for (const [key, amount] of Object.entries(character.stats)) {
    state.player.stats[key] += amount;
  }
  state.player.hp = state.player.stats.maxHp;
}

function startWave() {
  state.mode = "playing";
  state.wave += 1;
  state.waveDuration = Math.min(56, 32 + state.wave * 3);
  state.waveTime = state.waveDuration;
  state.spawnTimer = 0;
  state.waveKills = 0;
  if (state.runStats) state.runStats.damageTakenThisWave = 0;
  state.rerollCount = 0;
  state.rerollCost = firstRerollPrice();
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 8);
  spawnTrees();
  // Crates appear randomly through the wave, rare early and ramping up with the wave.
  // Each wave gets a small budget of crates (see crateWaveBudget) and a long first delay.
  state.crateBudget = crateWaveBudget();
  state.crateSpawnTimer = crateSpawnInterval();
  hideShop();
  hideReward();
  playSfx("wave");
  showMessage(`Wave ${state.wave}`, "More scrap. Meaner shapes.", 1100);
}

function endWave() {
  state.mode = "bagging";
  // waveKills > 0 confirms this wave was actually played (as opposed to a stray call before
  // anything spawned), the same way startWave/killEnemy already use it elsewhere.
  if (state.runStats && state.runStats.damageTakenThisWave === 0 && state.waveKills > 0) {
    if (typeof unlockAchievement === "function") unlockAchievement("untouched_wave");
  }
  if (typeof checkAchievements === "function") checkAchievements();
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
  state.player.burnTicksLeft = 0;
  state.player.burnTickTimer = 0;
  state.player.burnSourceName = null;
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
  const luckMultiplier = 1 + Math.max(0, effectiveStat("luck")) / 70;
  const tier5 = rarityChance(9, 0.42, 9, luckMultiplier);
  const tier4 = rarityChance(6, 1.5, 24, luckMultiplier);
  const tier3 = rarityChance(3, 3.4, 42, luckMultiplier);
  const tier2 = rarityChance(2, 8.5, 72, luckMultiplier);
  const roll = Math.random() * 100;
  if (roll < tier5) return 5;
  if (roll < tier5 + tier4) return 4;
  if (roll < tier5 + tier4 + tier3) return 3;
  if (roll < tier5 + tier4 + tier3 + tier2) return 2;
  return 1;
}

function rarityChance(minWave, perWave, cap, luckMultiplier) {
  if (state.wave < minWave) return 0;
  return Math.min(cap, Math.max(0, perWave * (state.wave - minWave + 1)) * luckMultiplier);
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

function renderCharacterSelect() {
  ui.characterCards.innerHTML = "";
  characterPortraits.length = 0;   // old portrait canvases are gone; drop stale refs
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
  card.className = `card tier-${tier}`;
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
