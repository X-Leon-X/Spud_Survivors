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
    case "potato_masher":
    case "thorn_lasher":
      return { stats: { meleeDamage: 2 } };
    case "seed_shotgun":
    case "frost_bow":
      return { stats: { rangedDamage: 2 } };
    case "shuriken":
      return { stats: { rangedDamage: 1, critChance: 2 } };
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
    case "fun_hat":
      return { stats: { luck: 16 } };
    case "flint_steel":
      return { stats: { elementalDamage: 4 } };
    case "useful_glasses":
      return { stats: { range: 80 } };
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
      // extraEnemies is a genuine downside, but it pairs with the luck bonus: more bodies
      // per wave means more scrap and more drops, so the alien is a greed pick rather than
      // a pure stat stick.
      return { stats: { maxHp: 12, luck: 8, speed: -6 }, extraEnemies: 1 };
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
    extraEnemies: 0,
    heal: 0
  };
  for (const [key, value] of Object.entries(base.stats ?? {})) {
    effects.stats[key] = scaleOwnedAmount(value, effectLevel);
  }
  if (base.projectiles) effects.projectiles = scaleOwnedAmount(base.projectiles, effectLevel);
  if (base.shopDiscount) effects.shopDiscount = base.shopDiscount * ownedTierMultiplier(effectLevel);
  if (base.recycleRateBonus) effects.recycleRateBonus = base.recycleRateBonus * ownedTierMultiplier(effectLevel);
  if (base.extraWeaponSlots) effects.extraWeaponSlots = scaleOwnedAmount(base.extraWeaponSlots, effectLevel);
  if (base.extraEnemies) effects.extraEnemies = scaleOwnedAmount(base.extraEnemies, effectLevel);
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
  target.extraEnemies += effects.extraEnemies ?? 0;
  target.treeOneShot = target.treeOneShot || Boolean(effects.treeOneShot);
}

function calculateOwnedUpgradeEffects() {
  const total = {
    stats: {},
    projectiles: 0,
    shopDiscount: 0,
    recycleRateBonus: 0,
    treeOneShot: false,
    extraWeaponSlots: 0,
    extraEnemies: 0
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

  // Wave-scoped temp bonuses for the NON-stat effect fields. These siblings of `stats` are read
  // directly off this object by their consumers (e.g. extraEnemies at js/07-combat.js:483), so
  // they never pass through ownedStatBonus() and the temp layer there cannot reach them.
  // Applied after the weapon loop so temp values can't feed back into activeWeaponSlots above.
  // extraWeaponSlots is deliberately EXCLUDED: temp slots are added at the maxWeaponSlots()
  // accessor instead, and adding them here would widen the slice and double-count the temp
  // weapons that grantTempWeapon() has already pushed onto state.weapons.
  const temp = state?.temp?.effects;
  if (temp) {
    total.projectiles += temp.projectiles ?? 0;
    total.shopDiscount += temp.shopDiscount ?? 0;
    total.recycleRateBonus += temp.recycleRateBonus ?? 0;
    total.extraEnemies += temp.extraEnemies ?? 0;
    total.treeOneShot = total.treeOneShot || Boolean(temp.treeOneShot);
  }

  return total;
}

function ownedUpgradeEffectsFor(item) {
  const effects = upgradeEffectsFor(item.id, item.tier);
  if (item.id === "slot_machine" && item.slotRoll?.effects) {
    // Two independent effects; each is added or subtracted depending on which way it rolled.
    for (const effect of item.slotRoll.effects) {
      const delta = effect.good ? effect.amount : -effect.amount;
      effects.stats[effect.key] = (effects.stats[effect.key] ?? 0) + delta;
    }
  }
  return effects;
}

function ownedStatBonus(key) {
  return (calculateOwnedUpgradeEffects().stats[key] ?? 0) + (state?.temp?.stats?.[key] ?? 0);
}

// --- Wave-scoped temp modifiers ---------------------------------------------------------
// A "this wave only" layer that sits on top of permanent owned-item stats. Nothing consumes
// this yet (that's a later pass, e.g. fortune cookies); this is infrastructure only.
//
// effectiveStat(key) (js/07-combat.js) is: state.player.stats[key] + ownedStatBonus(key) +
// weaponClassBonusStats()[key]. That whole expression is a flat sum, and the "percent" stats
// (e.g. damagePercent) are only turned into a multiplier LATER via brotatoPercentMultiplier.
// So adding state.temp.stats[key] here, inside ownedStatBonus, makes a temp point behave
// exactly like a permanent point of the same stat -- no separate percent-vs-flat handling is
// needed, because effectiveStat never distinguishes them; it's additive all the way through.
// This also means the temp layer transparently survives syncDerivedStats(), since that
// function re-derives everything by calling effectiveStat()/ownedStatBonus() fresh each time
// rather than caching a value that could be stale-overwritten.

function grantTempStat(key, amount) {
  if (!state.temp) state.temp = { stats: {}, effects: {}, extraWeaponSlots: 0, weapons: [], flags: {} };
  state.temp.stats[key] = (state.temp.stats[key] ?? 0) + amount;
}

// Wave-scoped bonus for the NON-stat effect fields (projectiles, shopDiscount, recycleRateBonus,
// extraEnemies, treeOneShot). These are siblings of `stats` on the calculateOwnedUpgradeEffects()
// return and are read straight off it, so grantTempStat() cannot reach them -- use this instead.
// Do NOT pass extraWeaponSlots here; temp slots go through grantTempSlot().
function grantTempEffect(key, amount) {
  if (!state.temp) state.temp = { stats: {}, effects: {}, extraWeaponSlots: 0, weapons: [], flags: {} };
  if (!state.temp.effects) state.temp.effects = {};
  if (key === "treeOneShot") {
    state.temp.effects.treeOneShot = Boolean(amount);
    return;
  }
  state.temp.effects[key] = (state.temp.effects[key] ?? 0) + amount;
}

function grantTempSlot(n) {
  if (!state.temp) state.temp = { stats: {}, effects: {}, extraWeaponSlots: 0, weapons: [], flags: {} };
  state.temp.extraWeaponSlots = (state.temp.extraWeaponSlots ?? 0) + n;
}

// Grants a weapon for this wave only. If there is no free slot under the CURRENT
// maxWeaponSlots(), a temp slot is opened first so the weapon is never silently dropped.
// The entry shape mirrors addWeapon() in js/06-shop.js:912 ({name, tier, fireCooldown}).
// The same object reference is pushed onto both state.weapons and state.temp.weapons so
// clearTempModifiers() can remove it by identity later, never by name/tier matching (the
// player may separately own a permanent weapon with the same name and tier).
function grantTempWeapon(name, tier) {
  if (!state.temp) state.temp = { stats: {}, effects: {}, extraWeaponSlots: 0, weapons: [], flags: {} };
  if (state.weapons.length >= maxWeaponSlots()) {
    grantTempSlot(1);
  }
  const entry = { name, tier, fireCooldown: rand(0.05, 0.35) };
  state.weapons.push(entry);
  state.temp.weapons.push(entry);
  return entry;
}

function setTempFlag(key, value) {
  if (!state.temp) state.temp = { stats: {}, effects: {}, extraWeaponSlots: 0, weapons: [], flags: {} };
  state.temp.flags[key] = value;
}

function tempFlag(key) {
  return state.temp?.flags?.[key];
}

// Wipes the whole temp bucket. Temp weapons are removed from state.weapons BEFORE the temp
// extraWeaponSlots bonus is zeroed out, so nothing that was granted a temp slot ends up
// stranded past the (now-shrunk) slice window -- the weapon and the slot that housed it
// disappear together, in that order.
function clearTempModifiers() {
  if (!state.temp) {
    state.temp = { stats: {}, effects: {}, extraWeaponSlots: 0, weapons: [], flags: {} };
    return;
  }
  for (const entry of state.temp.weapons) {
    const index = state.weapons.indexOf(entry);
    if (index !== -1) state.weapons.splice(index, 1);
  }
  state.temp = { stats: {}, effects: {}, extraWeaponSlots: 0, weapons: [], flags: {} };
}

function applyImmediatePurchaseEffect(item) {
  const effects = upgradeEffectsFor(item.id, item.tier ?? 1);
  if (effects.heal > 0) {
    // PHASE 1 CO-OP: the shop/build is shared (one mouse, one purchase), so an immediate-heal
    // item heals every player, not just P1.
    const targets = Array.isArray(state.players) ? state.players : [state.player];
    for (const player of targets) {
      if (player) heal(effects.heal, player);
    }
  }
}

// Rolls TWO independent effects, each a coin flip between a buff and a downside. That means
// a spin can land two buffs, two downsides, or one of each -- the gamble is the whole point,
// so the result is deliberately NOT weighted toward being favourable. The two effects always
// use different stats so they can never silently cancel out into "nothing happened".
// One spin per machine, ever (see spinSlotMachine), so the numbers are big enough for that
// single pull to genuinely reshape a run. 14-32 per effect versus the old 4-10: a good spin
// should feel like a legendary item, a bad one like a real wound you have to build around.
function rollSlotMachineEffect() {
  const rollOne = (excludeKey) => {
    const good = Math.random() < 0.5;
    const pool = (good ? SLOT_MACHINE_BUFFS : SLOT_MACHINE_DOWNSIDES).filter((key) => key !== excludeKey);
    // If exclusion emptied the pool (the downside list is short), fall back to the full list.
    const source = pool.length ? pool : (good ? SLOT_MACHINE_BUFFS : SLOT_MACHINE_DOWNSIDES);
    return {
      key: source[Math.floor(Math.random() * source.length)],
      amount: Math.ceil(rand(14, 32)),
      good
    };
  };
  const first = rollOne(null);
  const second = rollOne(first.key);
  return { effects: [first, second] };
}

// The player must not know what they bought until they spin it, so a freshly bought machine
// carries no roll at all. `revealed` gates the detail text -- see formatSlotMachineRoll.
function unspunSlotMachineRoll() {
  return null;
}

// How long the reels spin before the result lands, in ms.
const SLOT_SPIN_DURATION = 1700;

// Text for the machine's detail panel. Three states: never spun (reveals nothing), currently
// spinning (animated reels), and settled (the permanent result).
function formatSlotMachineRoll(roll, item) {
  if (item?.spinning) return formatSlotMachineSpinning(item);
  if (!roll?.effects) return "Not spun yet. One spin only, so make it count.";
  return `Spin result: ${roll.effects.map(formatSlotMachineEffect).join(" | ")}.`;
}

// The spinning animation itself: two reels of scrambling stat names and numbers that slow
// down and lock in one at a time, left first, so it builds to the second reel the way a real
// slot machine does.
function formatSlotMachineSpinning(item) {
  const elapsed = performance.now() - (item.spinStart ?? 0);
  const t = clamp(elapsed / SLOT_SPIN_DURATION, 0, 1);
  const reel = (index) => {
    // Reel 0 locks at 55% through, reel 1 at 100%: staggered stops, not a simultaneous snap.
    const lockAt = index === 0 ? 0.55 : 1;
    if (t >= lockAt) return "???";
    // Scramble speed eases off as the reel approaches its stop.
    const remaining = (lockAt - t) / lockAt;
    const rate = 45 + (1 - remaining) * 130;
    const step = Math.floor(elapsed / rate) + index * 3;
    const pool = SLOT_MACHINE_BUFFS;
    const stat = statDefs.find((s) => s.key === pool[step % pool.length]);
    const amount = 14 + (step * 7) % 19;
    const sign = step % 2 === 0 ? "+" : "-";
    return `${sign}${amount}${stat?.suffix ?? ""} ${stat?.name ?? "?"}`;
  };
  const dots = ".".repeat(1 + (Math.floor(elapsed / 220) % 3));
  return `Spinning${dots} ${reel(0)} | ${reel(1)}`;
}

function formatSlotMachineEffect(effect) {
  const stat = statDefs.find((entry) => entry.key === effect.key);
  const sign = effect.good ? "+" : "-";
  return `${sign}${effect.amount}${stat?.suffix ?? ""} ${stat?.name ?? effect.key}`;
}

function slotMachineThrowAwayCost() {
  return Math.max(220, Math.round(calculateShopCost(70, UNIQUE_TIER)));
}

// PHASE 1 CO-OP: `player` defaults to state.player (P1) so every pre-existing no-arg call
// (regeneratePlayer, lifesteal in applyBulletHit, etc.) keeps healing exactly who it always
// did. Callers that now loop per-player (see regeneratePlayer below) pass the specific player.
function heal(amount, player = state.player) {
  player.hp = Math.min(player.maxHp, player.hp + amount);
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

// `sourceName` is only used for the run-summary breakdown. It is recorded after the dodge
// early-return and after armor is applied, so the logged figure is the HP actually lost
// rather than the raw incoming number, and dodged hits never appear at all.
// The player-wide hit cooldown below is still load-bearing. Enemies now DO shove each other
// apart (see applyEnemySeparation in 07-combat.js), which cut the contact crowd hard --
// wave 15 went from ~287 enemies touching you at once to ~53. But 53 simultaneous hits would
// still delete a 95 HP player instantly, so the window stays.
//
// If you ever want to remove it, the separation strength is the dial: contact damage only
// becomes survivable without i-frames once the touching count is in single digits, i.e.
// roughly the physical first-rank limit of ~6-7 bodies.
//
// What DID change to match Brotato: the player is no longer knocked back on hit. You keep
// full control and positioning is entirely yours -- the old 18px punt fought your own
// movement and could shove you somewhere worse.
// `opts.ignoreCooldown` is for hazards that ALREADY have their own tick timer -- currently
// just the Blight Sac's poison pool. Those are self-limiting, so putting them behind the
// shared i-frame window as well double-limits them into irrelevance: whichever of "an enemy
// touched you" or "the pool ticked" landed first silently ate the other. It must NOT be used
// for contact or projectile damage, where the shared window is the actual crowd balance.
//
// PHASE 1 CO-OP: takes an explicit `player` target as the new first argument (every call site
// across the codebase was updated to pass one -- grepped for every damagePlayer( call). A
// downed player can't be damaged further (already at 0 HP and out of the fight), so that's
// checked right alongside the existing cooldown early-return.
function damagePlayer(player, rawDamage, sourceX, sourceY, sourceName, opts = {}) {
  if (player.downed) {
    return false;
  }
  if (!opts.ignoreCooldown && player.damageCooldown > 0) {
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
  trackDamageTaken(sourceName, damage);
  // 0.32 -> 0.22. Blocked enemy bullets are no longer eaten (see updateEnemyBullets), so a
  // volley now lands repeatedly across this window instead of once: ~4.5 hits/sec under
  // sustained fire rather than ~3. Short enough that a real barrage hurts, long enough that
  // a crowd still can't delete you in three frames the way removing i-frames entirely did.
  // A self-limiting hazard tick must not GRANT i-frames either, or standing in a poison pool
  // would shield you from the enemies surrounding you -- turning a hazard into cover.
  if (!opts.ignoreCooldown) {
    player.damageCooldown = 0.22;
  }
  player.hurtTimer = 0.16;
  addFloater(player.x, player.y - player.radius - 8, `-${damage}`, { color: "#ff8fa3", size: 17 });
  playSfx("hurt");
  // Burst: getting hit must stay legible even in a late-wave crowd.
  addShake(Math.min(11, 3.5 + damage * 0.3), true);
  fx.playerFlash = Math.min(1, 0.4 + damage * 0.02);
  return true;
}

// Ember Glob burn: a small, discrete DoT (3 ticks ~1s apart) applied only on a real hit.
// Deliberately bypasses damagePlayer — that has a 0.32s hit-cooldown and would both block
// burn ticks during normal i-frames and steal i-frames from a real follow-up hit. Reapplying
// while already burning refreshes the ticks rather than stacking them indefinitely.
// `kind` selects the flavour shown on each tick ("burn" or "poison"); see tickPlayerBurn.
// PHASE 1 CO-OP: `player` defaults to state.player (P1) so the many existing no-arg call sites
// (Ember Glob fireball impact, etc. -- all still single-player-shaped call paths) keep burning
// whoever they always burned. The one NEW multi-player call site (Blight Sac contact poison, in
// updateEnemies) passes the specific player who got touched.
function applyPlayerBurn(player, ticks, tickDamage, sourceName, kind = "burn") {
  if (player.downed) return;
  player.burnTicksLeft = ticks;
  player.burnTickTimer = 1;
  player.burnTickDamage = tickDamage;
  player.burnSourceName = sourceName;
  player.burnKind = kind;
}

// PHASE 1 CO-OP: loops every player instead of ticking a single state.player -- each player's
// burn/poison state (burnTicksLeft/burnTickTimer/etc.) already lives on their own player
// object, so this only needed to stop assuming there is exactly one.
function tickPlayerBurn(dt) {
  for (const player of state.players) {
    tickPlayerBurnFor(player, dt);
  }
}

function tickPlayerBurnFor(player, dt) {
  if (player.downed) {
    player.burnTicksLeft = 0;
    return;
  }
  if (!player.burnTicksLeft || player.burnTicksLeft <= 0) {
    return;
  }
  player.burnTickTimer -= dt;
  if (player.burnTickTimer > 0) {
    return;
  }
  player.burnTickTimer += 1;
  player.burnTicksLeft -= 1;
  // Logged to damageTakenBySource, NOT trackDamage(): damageBySource is the player's
  // damage-DEALT breakdown, so recording harm they receive there would inflate their own
  // "Burn" total with damage done to them.
  const damage = Math.max(1, Math.ceil(player.burnTickDamage * armorDamageMultiplier(effectiveStat("armor"))));
  player.hp -= damage;
  // The same DoT channel carries both fire (Ember Glob) and poison (Blight Sac), so the
  // label and colour follow the source instead of always saying "Burn" in orange -- being
  // told you are on fire by a poisonous sac reads as a bug.
  const poison = player.burnKind === "poison";
  const suffix = poison ? "Poison" : "Burn";
  const color = poison ? "#9ede5a" : "#ff9c5b";
  trackDamageTaken(player.burnSourceName ? `${player.burnSourceName} (${suffix})` : suffix, damage);
  addFloater(player.x, player.y - player.radius - 8, `-${damage}`, { color, size: 15 });
  burst(player.x, player.y, color, 4);
}
