"use strict";

// stats.js - stat math, item effects, player damage

function addStat(key, amount) {
  state.player.stats[key] += amount;
  syncDerivedStats();
}

function ownedTierMultiplier(tier) {
  return OWNED_TIER_MULTIPLIERS[Math.min(MAX_WEAPON_RANK, Math.max(1, tier ?? 1))] ?? 1;
}

function scaleOwnedAmount(amount, tier) {
  const scaled = amount * ownedTierMultiplier(tier);
  return amount < 0 ? Math.round(scaled) : Math.max(1, Math.round(scaled));
}

function upgradeEffectLevel(id, tier = 1) {
  const upgrade = upgrades.find((candidate) => candidate.id === id);
  if (upgrade?.unique) {
    return 1;
  }
  if (upgrade?.weaponName) {
    return Math.min(MAX_WEAPON_RANK, Math.max(1, tier ?? 1));
  }
  const baseTier = upgrade?.tier ?? 1;
  return Math.min(MAX_WEAPON_RANK, Math.max(1, (tier ?? baseTier) - baseTier + 1));
}

function baseUpgradeEffects(id) {
  switch (id) {
    case "spark_weapon":
    case "rusty_pistol":
    case "grenade_launcher":
      return { stats: { rangedDamage: 1 } };
    case "twig_wand":
      return { stats: { elementalDamage: 1 } };
    case "stub_club":
      return { stats: { meleeDamage: 1 } };
    case "forked_slingshot":
      return { stats: { rangedDamage: 1, critChance: 1 } };
    case "scrap_revolver":
      return { stats: { rangedDamage: 2, critChance: 2 } };
    case "flamethrower":
      return { stats: { elementalDamage: 3, damagePercent: 4 } };
    case "damage":
      return { stats: { damagePercent: 8 } };
    case "speed":
      return { stats: { speed: 8 } };
    case "rate":
      return { stats: { attackSpeed: 12 } };
    case "heart":
      return { stats: { maxHp: 10 }, heal: 18 };
    case "magnet":
      return { stats: { pickupRange: 40 } };
    case "split":
      return { stats: { damagePercent: -5 }, projectiles: 1 };
    case "range":
      return { stats: { range: 55 } };
    case "ranged":
      return { stats: { rangedDamage: 2 } };
    case "regen":
      return { stats: { hpRegen: 2 } };
    case "lifesteal":
      return { stats: { lifeSteal: 3 } };
    case "crit":
      return { stats: { critChance: 5 } };
    case "armor":
      return { stats: { armor: 3 } };
    case "dodge":
      return { stats: { dodge: 4 } };
    case "luck":
      return { stats: { luck: 10 } };
    case "harvesting":
      return { stats: { harvesting: 6 } };
    case "coupon_leaf":
      return { shopDiscount: 0.06 };
    case "recycling_clamp":
      return { recycleRateBonus: 0.12 };
    case "garden_shears":
      return { stats: { luck: 4, damagePercent: 4 }, treeOneShot: true };
    case "engineering":
      return { stats: { engineering: 3 } };
    case "melee":
      return { stats: { meleeDamage: 2 } };
    case "elemental":
      return { stats: { elementalDamage: 2 } };
    case "pet_alien":
      return { stats: { maxHp: 12, luck: 8, speed: -6 } };
    case "glass_charm":
      return { stats: { damagePercent: 18, maxHp: -8, armor: -2 } };
    case "slot_machine":
      return { stats: {} };
    case "extra_arm":
      return { stats: { damagePercent: 6 }, extraWeaponSlots: 1 };
    case "royal_whetstone":
      return { stats: { damagePercent: 28, critChance: 8 } };
    default:
      return { stats: {} };
  }
}

function upgradeEffectsFor(id, tier = 1) {
  const base = baseUpgradeEffects(id);
  const effectLevel = upgradeEffectLevel(id, tier);
  const effects = {
    stats: {},
    projectiles: 0,
    shopDiscount: 0,
    recycleRateBonus: 0,
    treeOneShot: Boolean(base.treeOneShot),
    extraWeaponSlots: 0,
    heal: 0
  };
  for (const [key, value] of Object.entries(base.stats ?? {})) {
    effects.stats[key] = scaleOwnedAmount(value, effectLevel);
  }
  if (base.projectiles) effects.projectiles = scaleOwnedAmount(base.projectiles, effectLevel);
  if (base.shopDiscount) effects.shopDiscount = base.shopDiscount * ownedTierMultiplier(effectLevel);
  if (base.recycleRateBonus) effects.recycleRateBonus = base.recycleRateBonus * ownedTierMultiplier(effectLevel);
  if (base.extraWeaponSlots) effects.extraWeaponSlots = scaleOwnedAmount(base.extraWeaponSlots, effectLevel);
  if (base.heal) effects.heal = scaleOwnedAmount(base.heal, effectLevel);
  return effects;
}

function combineOwnedEffects(target, effects) {
  for (const [key, value] of Object.entries(effects.stats ?? {})) {
    target.stats[key] = (target.stats[key] ?? 0) + value;
  }
  target.projectiles += effects.projectiles ?? 0;
  target.shopDiscount += effects.shopDiscount ?? 0;
  target.recycleRateBonus += effects.recycleRateBonus ?? 0;
  target.extraWeaponSlots += effects.extraWeaponSlots ?? 0;
  target.treeOneShot = target.treeOneShot || Boolean(effects.treeOneShot);
}

function calculateOwnedUpgradeEffects() {
  const total = {
    stats: {},
    projectiles: 0,
    shopDiscount: 0,
    recycleRateBonus: 0,
    treeOneShot: false,
    extraWeaponSlots: 0
  };

  for (const item of state.items ?? []) {
    combineOwnedEffects(total, ownedUpgradeEffectsFor(item));
  }

  const activeWeaponSlots = BASE_WEAPON_SLOTS + total.extraWeaponSlots;
  for (const weapon of (state.weapons ?? []).slice(0, activeWeaponSlots)) {
    const upgrade = upgrades.find((candidate) => candidate.weaponName === weapon.name);
    if (upgrade) {
      combineOwnedEffects(total, upgradeEffectsFor(upgrade.id, weapon.tier));
    }
  }

  return total;
}

function ownedUpgradeEffectsFor(item) {
  const effects = upgradeEffectsFor(item.id, item.tier);
  if (item.id === "slot_machine" && item.slotRoll) {
    effects.stats[item.slotRoll.buffKey] = (effects.stats[item.slotRoll.buffKey] ?? 0) + item.slotRoll.buffAmount;
    effects.stats[item.slotRoll.downsideKey] = (effects.stats[item.slotRoll.downsideKey] ?? 0) - item.slotRoll.downsideAmount;
  }
  return effects;
}

function ownedStatBonus(key) {
  return calculateOwnedUpgradeEffects().stats[key] ?? 0;
}

function applyImmediatePurchaseEffect(item) {
  const effects = upgradeEffectsFor(item.id, item.tier ?? 1);
  if (effects.heal > 0) {
    heal(effects.heal);
  }
}

function rollSlotMachineEffect() {
  const buffKey = SLOT_MACHINE_BUFFS[Math.floor(Math.random() * SLOT_MACHINE_BUFFS.length)];
  const downsidePool = SLOT_MACHINE_DOWNSIDES.filter((key) => key !== buffKey);
  const downsideKey = downsidePool[Math.floor(Math.random() * downsidePool.length)];
  return {
    buffKey,
    buffAmount: Math.ceil(rand(4, 10)),
    downsideKey,
    downsideAmount: Math.ceil(rand(4, 10))
  };
}

function formatSlotMachineRoll(roll) {
  if (!roll) return "Not spun yet.";
  const buffStat = statDefs.find((stat) => stat.key === roll.buffKey);
  const downsideStat = statDefs.find((stat) => stat.key === roll.downsideKey);
  return `Spin result: +${roll.buffAmount}${buffStat?.suffix ?? ""} ${buffStat?.name ?? roll.buffKey} | -${roll.downsideAmount}${downsideStat?.suffix ?? ""} ${downsideStat?.name ?? roll.downsideKey}.`;
}

function slotMachineThrowAwayCost() {
  return Math.max(220, Math.round(calculateShopCost(70, UNIQUE_TIER)));
}

function heal(amount) {
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + amount);
}

function brotatoPercentMultiplier(value) {
  if (value >= 0) {
    return 1 + value / 100;
  }
  return 1 / (1 + Math.abs(value) / 100);
}

function armorDamageMultiplier(armor) {
  if (armor >= 0) {
    return 15 / (15 + armor);
  }
  return 2 - 15 / (15 + Math.abs(armor));
}

function hpRegenHealDelay(regen) {
  if (regen <= 0) {
    return Infinity;
  }
  const healsPerSecond = 0.2 + Math.max(0, regen - 1) * 0.089;
  return 1 / healsPerSecond;
}

function damagePlayer(rawDamage, sourceX, sourceY) {
  const player = state.player;
  if (player.damageCooldown > 0) {
    return false;
  }

  const dodgeChance = Math.min(60, Math.max(0, effectiveStat("dodge")));
  if (Math.random() * 100 < dodgeChance) {
    player.damageCooldown = 0.18;
    player.hurtTimer = 0.08;
    addFloater(player.x, player.y - player.radius - 8, "DODGE", {
      color: "#74d3a4",
      size: 20,
      life: 1.15,
      riseSpeed: 84,
      driftX: rand(-12, 12),
      fadePower: 1.6,
      scaleOut: 0.22
    });
    playSfx("dodge");
    return false;
  }

  const damage = Math.max(1, Math.ceil(rawDamage * armorDamageMultiplier(effectiveStat("armor"))));
  player.hp -= damage;
  player.damageCooldown = 0.32;
  player.hurtTimer = 0.16;
  addFloater(player.x, player.y - player.radius - 8, `-${damage}`, { color: "#ff8fa3", size: 17 });
  playSfx("hurt");
  addShake(Math.min(11, 3.5 + damage * 0.3));
  fx.playerFlash = Math.min(1, 0.4 + damage * 0.02);

  if (sourceX !== undefined && sourceY !== undefined) {
    const push = Math.atan2(player.y - sourceY, player.x - sourceX);
    player.x = clamp(player.x + Math.cos(push) * 18, player.radius + 8, W - player.radius - 8);
    player.y = clamp(player.y + Math.sin(push) * 18, player.radius + 8, H - player.radius - 8);
  }
  return true;
}
