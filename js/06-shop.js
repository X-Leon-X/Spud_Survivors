"use strict";

// shop.js - shop UI, detail panel, loadout, HUD text

// Lightweight header refresh: scrap counts, bag, and the reroll button state. Never touches
// the card grid, so calling it after a buy does NOT flash the shop. buyUpgrade/toggleLock
// call this instead of a full renderShop() rebuild.
function renderShopHeader() {
  ui.shopScrap.textContent = state.scrap;
  ui.shopBag.textContent = state.unusedScrap;
  ui.rerollCost.textContent = state.freeRerolls > 0 ? "Free" : state.rerollCost;
  const allOffersLocked = state.shopChoices.length > 0 && state.shopChoices.every((choice) => choice.locked);
  ui.rerollButton.disabled = allOffersLocked || (state.freeRerolls <= 0 && state.scrap < state.rerollCost);
  ui.rerollButton.title = allOffersLocked ? "Unlock an offer before rerolling." : "";
}

// Re-evaluate each still-present card's Buy button without rebuilding the grid, so buying a
// cheap item that pushes a pricier one out of budget greys it out with no flash.
function refreshShopCardButtons() {
  for (const card of ui.shopCards.querySelectorAll(".card")) {
    const item = card._item;
    if (!item) continue;
    const button = card.querySelector(".price button:last-child");
    if (!button) continue;
    button.disabled = !canBuyUpgrade(item);
    if (item.weaponName && state.weapons.length >= maxWeaponSlots()) {
      button.textContent = "Full";
      button.title = "Merge or recycle a weapon to open a slot.";
    }
  }
}

function renderShop() {
  renderShopHeader();
  ui.shopCards.innerHTML = "";
  renderStatSheets();
  renderLoadout();
  setDetailPanel({
    title: "Hover an item",
    text: "Shop offers and owned gear show details, recycle values, and combine actions here.",
    meta: ["Details"],
    actions: []
  });

  for (const item of state.shopChoices) {
    const card = document.createElement("article");
    card._item = item;
    card.className = `card tier-${item.tier}`;
    const ownedText = getOwnedText(item);
    const typeText = item.weaponName ? "Weapon" : "Item";
    const rarityText = rarityNameFor(item);
    const marketStats = getMarketCardStats(item);
    if (item.locked) {
      card.classList.add("locked");
    }
    card.innerHTML = `
      <div class="item-visual">
        <canvas class="item-icon" width="96" height="96" aria-hidden="true"></canvas>
        <div class="rank-badge">${rankLabelFor(item)}</div>
      </div>
      <div class="card-title-row">
        <h2>${item.name}</h2>
        <span class="type-bubble">${typeText}</span>
      </div>
      <div class="card-meta">
        <span class="rarity-chip tier-${item.tier}">${rarityText}</span>
        <span class="tier-line">${tierTextFor(item)}</span>
        ${ownedText ? `<span>${ownedText}</span>` : ""}
      </div>
      ${marketStats ? `<div class="market-stats">${marketStats}</div>` : ""}
      <p>${getShopCardDescription(item)}</p>
      <div class="price">
        <strong>${item.cost} scrap</strong>
        <button class="lock-button" type="button">${item.locked ? "Locked" : "Lock"}</button>
        <button type="button">Buy</button>
      </div>
    `;

    const lockButton = card.querySelector(".lock-button");
    lockButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleShopLock(item);
    });

    const button = card.querySelector(".price button:last-child");
    button.disabled = !canBuyUpgrade(item);
    if (item.weaponName && state.weapons.length >= maxWeaponSlots()) {
      button.textContent = "Full";
      button.title = "Merge or recycle a weapon to open a slot.";
    }
    button.addEventListener("click", () => buyUpgrade(item));
    card.addEventListener("mouseenter", () => showShopDetails(item));
    drawItemIcon(card.querySelector(".item-icon"), item);
    if (itemArtIsFullCard(item)) card.classList.add("has-art-tile");
    ui.shopCards.appendChild(card);
  }
}

function toggleShopLock(item) {
  item.locked = !item.locked;
  // Update just this card's lock state in place — no grid rebuild, no flash.
  const card = [...ui.shopCards.querySelectorAll(".card")].find((c) => c._item === item);
  if (card) {
    card.classList.toggle("locked", item.locked);
    const lockButton = card.querySelector(".lock-button");
    if (lockButton) lockButton.textContent = item.locked ? "Locked" : "Lock";
  }
  renderShopHeader();
  showShopDetails(item);
}

function getMarketCardStats(item) {
  if (!item.weaponName) return "";
  const weapon = { name: item.weaponName, tier: item.tier ?? 1 };
  const damage = weaponShotDamage(weapon);
  const cooldown = weaponCooldown(weapon);
  const attacksPerSecond = 1 / cooldown;
  const dps = damage * attacksPerSecond;
  return [
    `<span><b>${damage.toFixed(1)}</b> dmg</span>`,
    `<span><b>${attacksPerSecond.toFixed(2)}/s</b> atk</span>`,
    `<span><b>${dps.toFixed(1)}</b> DPS</span>`
  ].join("");
}

function getOwnedText(item) {
  if (item.weaponName) {
    const matching = state.weapons.filter((weapon) => weapon.name === item.weaponName);
    const slotText = `Slots ${state.weapons.length}/${maxWeaponSlots()}`;
    if (matching.length === 0) return `New weapon | ${slotText}`;
    return `Owned x${matching.length} | ${slotText}`;
  }

  const count = state.items.filter((owned) => owned.name === item.name).length;
  return count > 0 ? `Owned x${count}` : "";
}

function getShopCardDescription(item) {
  const profile = upgradeProfiles[item.id];
  return profile?.properties ?? item.description;
}

function canBuyUpgrade(item) {
  if (state.scrap < item.cost) return false;
  if (item.weaponName && state.weapons.length >= maxWeaponSlots()) return false;
  return true;
}

function getUpgradeMeta(item, typeText, extra = []) {
  const rankText = item.tier ? tierTextFor(item) : "";
  return [rarityNameFor(item), typeText, rankText, ...extra].filter(Boolean);
}

function formatStatAmount(key, value) {
  const stat = statDefs.find((entry) => entry.key === key);
  const suffix = stat?.suffix ?? "";
  return `${Number(value).toFixed(stat?.decimals ?? 0)}${suffix}`;
}

function formatStatChange(key, amount) {
  const stat = statDefs.find((entry) => entry.key === key);
  const before = effectiveStat(key);
  const after = before + amount;
  return `${stat?.name ?? key}: ${formatStatAmount(key, before)} -> ${formatStatAmount(key, after)}`;
}

function formatMultiplier(value) {
  return `x${brotatoPercentMultiplier(value).toFixed(2)}`;
}

function formatDamageTaken(value) {
  return `${Math.round(armorDamageMultiplier(value) * 100)}%`;
}

function buildUpgradeNumberLines(item) {
  const slotsFull = state.weapons.length >= maxWeaponSlots();
  const slotNote = slotsFull ? "No free weapon slot — replaces one." : "Takes 1 weapon slot.";
  if (item.weaponName && !["spark_weapon", "twig_wand", "stub_club"].includes(item.id)) {
    return [slotNote];
  }
  switch (item.id) {
    case "spark_weapon":
      return [`${slotNote} ${formatStatChange("rangedDamage", 1)}.`];
    case "twig_wand":
      return [`${slotNote} ${formatStatChange("elementalDamage", 1)}.`];
    case "stub_club":
      return [`${slotNote} ${formatStatChange("meleeDamage", 1)}.`];
    case "damage":
      return [`${formatStatChange("damagePercent", 8)} (${formatMultiplier(effectiveStat("damagePercent"))} -> ${formatMultiplier(effectiveStat("damagePercent") + 8)} damage scaling).`];
    case "speed":
      return [`${formatStatChange("speed", 8)}. Move speed: ${Math.round(state.player.speed)} -> ${Math.round(210 * brotatoPercentMultiplier(effectiveStat("speed") + 8))}.`];
    case "rate":
      return [`${formatStatChange("attackSpeed", 12)}. Weapon cooldowns divide by ${formatMultiplier(effectiveStat("attackSpeed"))} -> ${formatMultiplier(effectiveStat("attackSpeed") + 12)}.`];
    case "heart":
      return [`${formatStatChange("maxHp", 10)}. Also heals 18 HP immediately.`];
    case "magnet":
      return [`${formatStatChange("pickupRange", 40)}. Scrap starts pulling from farther away.`];
    case "split":
      return [`Projectiles: ${state.player.projectiles} -> ${state.player.projectiles + 1}. ${formatStatChange("damagePercent", -5)}.`];
    case "range":
      return [`${formatStatChange("range", 55)}. Most ranged weapons gain about +19 practical range from this item.`];
    case "ranged":
      return [`${formatStatChange("rangedDamage", 2)}. Spark Peashooter gains about +1.3 hit damage from this before Damage %.`];
    case "regen": {
      const before = hpRegenHealDelay(effectiveStat("hpRegen"));
      const after = hpRegenHealDelay(effectiveStat("hpRegen") + 2);
      return [`${formatStatChange("hpRegen", 2)}. Heal timing: ${before === Infinity ? "none" : `1 HP / ${before.toFixed(1)}s`} -> 1 HP / ${after.toFixed(1)}s.`];
    }
    case "lifesteal":
      return [`${formatStatChange("lifeSteal", 3)}. Hits can heal 1 HP, checked with a short 0.1s cooldown.`];
    case "crit":
      return [`${formatStatChange("critChance", 5)}. Added to each weapon's own crit chance.`];
    case "armor":
      return [`${formatStatChange("armor", 3)}. Damage taken: ${formatDamageTaken(effectiveStat("armor"))} -> ${formatDamageTaken(effectiveStat("armor") + 3)}.`];
    case "dodge":
      return [`${formatStatChange("dodge", 4)}. Dodge can ignore contact or projectile damage completely, capped at 60%. This item is rarer and pricier now.`];
    case "luck":
      return [`${formatStatChange("luck", 10)}. Higher-tier offer chance multiplier: x${(1 + Math.max(0, effectiveStat("luck")) / 100).toFixed(2)} -> x${(1 + Math.max(0, effectiveStat("luck") + 10) / 100).toFixed(2)}. Shop prices also drop by about 1.5%.`];
    case "harvesting": {
      const before = Math.floor(effectiveStat("harvesting") * (1 + state.wave * 0.05));
      const after = Math.floor((effectiveStat("harvesting") + 6) * (1 + state.wave * 0.05));
      return [`${formatStatChange("harvesting", 6)}. End-of-wave payout this wave: ${before} -> ${after} scrap before growth.`];
    }
    case "coupon_leaf":
      return [`Shop discount: ${Math.round(state.shopDiscount * 100)}% -> ${Math.round((state.shopDiscount + 0.06) * 100)}%. Stacks with Luck and caps with total shop discounts.`];
    case "recycling_clamp":
      return [`Recycle value: ${Math.round(state.recycleRate * 100)}% -> ${Math.round(Math.min(0.75, state.recycleRate + 0.12) * 100)}% of shop value. Cap: 75%.`];
    case "garden_shears":
      return [`Trees: ${state.treeOneShot ? "already one-shot" : "normal HP"} -> one hit to break. Also ${formatStatChange("luck", 4)} and ${formatStatChange("damagePercent", 4)}.`];
    case "engineering": {
      const before = 5 + effectiveStat("engineering") * 3;
      const after = 5 + (effectiveStat("engineering") + 3) * 3;
      const beforeCooldown = Math.max(1.25, 4.25 - effectiveStat("engineering") * 0.07);
      const afterCooldown = Math.max(1.25, 4.25 - (effectiveStat("engineering") + 3) * 0.07);
      return [`${formatStatChange("engineering", 3)}. Zap damage: ${before} -> ${after}. Zap cooldown: ${beforeCooldown.toFixed(2)}s -> ${afterCooldown.toFixed(2)}s.`];
    }
    case "melee":
      return [`${formatStatChange("meleeDamage", 2)}. Stub Club gains about +1.8 hit damage from this before Damage %. Point-blank melee damage also rises.`];
    case "elemental":
      return [`${formatStatChange("elementalDamage", 2)}. Twig Wand gains about +1.5 hit damage and +0.9 burn/sec before Damage %.`];
    case "pet_alien":
      return [`${formatStatChange("maxHp", 12)}. ${formatStatChange("luck", 8)}. ${formatStatChange("speed", -6)}.`];
    case "glass_charm":
      return [`${formatStatChange("damagePercent", 18)}. ${formatStatChange("maxHp", -8)}. ${formatStatChange("armor", -2)}.`];
    case "slot_machine":
      return ["Unique item. Starts with a random spin result when bought. Spin rerolls one buff and one downside, each from 4% to 10%."];
    case "extra_arm":
      return [`Weapon slots: ${maxWeaponSlots()} -> ${maxWeaponSlots() + 1}. ${formatStatChange("damagePercent", 6)}.`];
    case "royal_whetstone":
      return [`${formatStatChange("damagePercent", 28)}. ${formatStatChange("critChance", 8)}.`];
    default:
      return [];
  }
}

function buildUpgradeDetailText(item) {
  const profile = upgradeProfiles[item.id] ?? {
    lore: item.description,
    properties: item.description,
    stats: [item.description]
  };
  // Only the flavor line, the "what it does" line, and ONE precise stat readout. The static
  // profile.stats summary is dropped (it restated numbers, and added implied lines like
  // "Adds Stub Club" whose name is already the title). The number lines (buildUpgradeNumberLines)
  // show the resulting before->after value, so they're preferred; the "Actual gain: +N" lines
  // are only used as a fallback when an item has no number line, otherwise they'd say the same
  // stat twice (e.g. "+10 Max HP" then "Max HP: 85 -> 95").
  const numberLines = buildUpgradeNumberLines(item);
  const lines = [
    profile.lore,
    profile.properties,
    ...(numberLines.length ? numberLines : formatUpgradeGainLines(item))
  ];

  if (item.weaponName) {
    const weaponProfile = weaponProfiles[item.weaponName];
    const previewWeapon = { name: item.weaponName, tier: item.tier ?? 1 };
    if (weaponProfile) {
      lines.push(`Tier ${tierLabel(item.tier ?? 1)} | ${weaponProfile.role}`);
      lines.push(formatWeaponCombatStats(previewWeapon));
      lines.push(weaponProfile.scaling);
      lines.push(weaponProfile.attack);
    }
  }

  return dedupeDetailLines(lines).join("\n");
}

// Drop empty lines and any line whose meaningful stat content already appeared, so the
// same "+N Stat" never shows twice even when two builders happen to phrase it alike.
function dedupeDetailLines(lines) {
  const seen = new Set();
  const out = [];
  for (const raw of lines) {
    const line = (raw ?? "").trim();
    if (!line) continue;
    const key = line.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function formatUpgradeGainLines(item) {
  const effects = upgradeEffectsFor(item.id, item.tier ?? 1);
  const lines = [];
  const label = rankLabelFor(item);
  const statParts = Object.entries(effects.stats ?? {}).map(([key, value]) => {
    const stat = statDefs.find((entry) => entry.key === key);
    const sign = value > 0 ? "+" : "";
    return `${sign}${Number(value).toFixed(stat?.decimals ?? 0)}${stat?.suffix ?? ""} ${stat?.name ?? key}`;
  });
  if (statParts.length) {
    lines.push(`Actual gain (${label}): ${statParts.join(" | ")}`);
  }
  if (effects.projectiles) {
    lines.push(`Actual gain (${label}): +${effects.projectiles} projectile${effects.projectiles === 1 ? "" : "s"}.`);
  }
  if (effects.shopDiscount) {
    lines.push(`Actual gain (${label}): -${Math.round(effects.shopDiscount * 100)}% shop prices.`);
  }
  if (effects.recycleRateBonus) {
    lines.push(`Actual gain (${label}): +${Math.round(effects.recycleRateBonus * 100)}% recycle value.`);
  }
  if (effects.treeOneShot) {
    lines.push(`Actual gain (${label}): trees break in one hit.`);
  }
  if (effects.extraWeaponSlots) {
    lines.push(`Actual gain (${label}): +${effects.extraWeaponSlots} weapon slot${effects.extraWeaponSlots === 1 ? "" : "s"}.`);
  }
  if (effects.heal) {
    lines.push(`Immediate effect: heal ${effects.heal} HP.`);
  }
  return lines;
}

function formatOwnedEffectLines(itemGroup) {
  const effects = ownedUpgradeEffectsFor(itemGroup);
  const lines = [];
  const statParts = Object.entries(effects.stats ?? {}).map(([key, value]) => {
    const stat = statDefs.find((entry) => entry.key === key);
    const suffix = stat?.suffix ?? "";
    const sign = value > 0 ? "+" : "";
    return `${sign}${Number(value).toFixed(stat?.decimals ?? 0)}${suffix} ${stat?.name ?? key}`;
  });
  if (statParts.length) {
    lines.push(`Current item stats: ${statParts.join(" | ")}`);
  }
  if (effects.projectiles) {
    lines.push(`Current item effect: +${effects.projectiles} projectile${effects.projectiles === 1 ? "" : "s"}.`);
  }
  if (effects.shopDiscount) {
    lines.push(`Current item effect: -${Math.round(effects.shopDiscount * 100)}% shop prices.`);
  }
  if (effects.recycleRateBonus) {
    lines.push(`Current item effect: +${Math.round(effects.recycleRateBonus * 100)}% recycle value.`);
  }
  if (effects.treeOneShot) {
    lines.push("Current item effect: trees break in one hit.");
  }
  if (effects.extraWeaponSlots) {
    lines.push(`Current item effect: +${effects.extraWeaponSlots} weapon slot${effects.extraWeaponSlots === 1 ? "" : "s"}.`);
  }
  if (itemGroup.id === "slot_machine") {
    lines.push(formatSlotMachineRoll(itemGroup.slotRoll));
  }
  return lines;
}

function buildOwnedItemDetailText(itemGroup) {
  const profile = upgradeProfiles[itemGroup.id] ?? {
    lore: itemGroup.description,
    properties: itemGroup.description,
    stats: [itemGroup.description]
  };
  return [
    profile.lore,
    profile.properties,
    ...formatOwnedEffectLines(itemGroup),
    isUniqueUpgrade(itemGroup) ? "Unique item. No rank and no merging." : `${itemGroup.count} owned at tier ${tierLabel(itemGroup.tier)}.`
  ].join("\n");
}

function buildWeaponDetailText(weapon) {
  const profile = weaponProfiles[weapon.name] ?? {
    lore: "A rough field weapon with room to grow.",
    properties: "Adds weapon tier power and contributes to your current attack damage.",
    role: "General weapon",
    scaling: "Adds weapon power",
    attack: "Uses your current attack stats."
  };
  return [
    profile.lore,
    profile.properties,
    `Tier ${tierLabel(weapon.tier)} | ${profile.role}`,
    formatWeaponCombatStats(weapon),
    formatWeaponTierProgression(weapon.name),
    profile.scaling,
    profile.attack
  ].join("\n");
}

function buildModDetailText(modName) {
  if (modName === "Forked Barrel") {
    return [
      "A forked barrel hammered together on a kitchen counter.",
      "Adds another projectile to each auto-attack while slightly lowering overall damage.",
      `${state.player.projectiles} projectile${state.player.projectiles === 1 ? "" : "s"} currently | ${Math.round(state.player.damage)} damage per normal hit.`
    ].join("\n");
  }
  const base = upgrades.find((upgrade) => upgrade.name === modName);
  return base ? buildUpgradeDetailText(base) : "Attack modifier.\nShapes how your equipped weapons fire.\nEquipped.";
}

function formatCurrentAttackStats() {
  const activeWeapons = Math.min(maxWeaponSlots(), state.weapons.length);
  const averageDamage = activeWeapons
    ? state.weapons.slice(0, maxWeaponSlots()).reduce((sum, weapon) => sum + weaponShotDamage(weapon), 0) / activeWeapons
    : 0;
  const projectileWeapons = state.weapons.slice(0, maxWeaponSlots()).filter((weapon) => getWeaponStatProfile(weapon).attackType !== "swing").length;
  const swingWeapons = activeWeapons - projectileWeapons;
  return `${activeWeapons}/${maxWeaponSlots()} weapons, avg ${averageDamage.toFixed(1)} damage per hit, ${projectileWeapons} projectile weapon${projectileWeapons === 1 ? "" : "s"}, ${swingWeapons} swing weapon${swingWeapons === 1 ? "" : "s"}, +${effectiveStat("attackSpeed")}% attack speed, ${effectiveStat("critChance")}% base crit.`;
}

function formatWeaponCombatStats(weapon) {
  const profile = getWeaponStatProfile(weapon);
  const burn = weaponBurnDps(weapon);
  const damage = weaponShotDamage(weapon);
  const cooldown = weaponCooldown(weapon);
  const perTargetDps = damage / cooldown;
  const tags = profile.tags?.join(" / ") ?? "Weapon";
  const parts = [
    `${damage.toFixed(1)} damage`,
    `${perTargetDps.toFixed(1)} DPS`,
    `${cooldown.toFixed(2)}s cooldown`,
    `${weaponCritChance(weapon)}% crit`,
    `${weaponKnockback(weapon)} knockback`
  ];
  const pierce = weaponPierce(weapon);
  if (profile.attackType === "swing") {
    parts.push("Swing");
    parts.push(`${Math.round(weaponRange(weapon))} reach`);
    parts.push(`${Math.round(weaponSwingArc(weapon) * 180 / Math.PI)} deg arc`);
    parts.push(`${1 + pierce} max hit${1 + pierce === 1 ? "" : "s"}`);
  } else if (pierce > 0) {
    parts.splice(3, 0, `${Math.round(weaponRange(weapon))} range`);
    parts.push(`${weaponProjectileCount(weapon)} projectile${weaponProjectileCount(weapon) === 1 ? "" : "s"}`);
    parts.push(`${pierce} pierce`);
  } else {
    parts.splice(3, 0, `${Math.round(weaponRange(weapon))} range`);
    parts.push(`${weaponProjectileCount(weapon)} projectile${weaponProjectileCount(weapon) === 1 ? "" : "s"}`);
  }
  if (burn > 0) {
    parts.push(`${burn.toFixed(1)} burn/sec`);
  }
  return `${tags}\n${parts.join(" | ")}\n${formatWeaponFormula(weapon)}`;
}

function formatWeaponFormula(weapon) {
  const profile = getWeaponStatProfile(weapon);
  const tierIndex = Math.max(0, Math.min(MAX_WEAPON_RANK - 1, (weapon.tier ?? 1) - 1));
  const baseDamage = profile.baseDamage?.[tierIndex] ?? weaponTierValue(weapon, "baseDamage");
  const tierScaling = weaponTierStatScalingMultiplier(weapon);
  const scaling = Object.entries(profile.scaling ?? {})
    .map(([key, value]) => `${Math.round(value * 100 * tierScaling)}% ${statDefs.find((stat) => stat.key === key)?.name ?? key}`)
    .join(" + ");
  const formulaParts = [`Hit formula: ${baseDamage} base`];
  if (scaling) formulaParts.push(scaling);
  if (tierScaling > 1) formulaParts.push(`rank scaling x${tierScaling.toFixed(2)}`);
  formulaParts.push("then Damage %");

  if (profile.attackType === "swing") {
    formulaParts.push(`swing can hit up to ${1 + weaponPierce(weapon)} target${1 + weaponPierce(weapon) === 1 ? "" : "s"}`);
  } else {
    formulaParts.push(`${weaponProjectileCount(weapon)} projectile${weaponProjectileCount(weapon) === 1 ? "" : "s"} per attack`);
  }

  if (profile.burnBase) {
    const baseBurn = profile.burnBase[tierIndex] ?? weaponTierValue(weapon, "burnBase");
    const burnScaling = Object.entries(profile.burnScaling ?? {})
      .map(([key, value]) => `${Math.round(value * 100 * tierScaling)}% ${statDefs.find((stat) => stat.key === key)?.name ?? key}`)
      .join(" + ");
    formulaParts.push(`Burn: ${baseBurn}/sec${burnScaling ? ` + ${burnScaling}` : ""}, ${profile.burnDuration.toFixed(1)}s duration`);
  }

  return formulaParts.join(" | ");
}

function formatWeaponTierProgression(name) {
  const profile = weaponStatProfiles[name];
  if (!profile) return "";
  const tiers = [1, 2, 3, 4, 5].map((tier) => {
    const weapon = { name, tier };
    return `${tierLabel(tier)} ${weaponShotDamage(weapon).toFixed(1)} dmg / ${weaponCooldown(weapon).toFixed(2)}s`;
  });
  return `Tier growth: ${tiers.join(" | ")}`;
}

function formatWeaponClassBonuses() {
  const bonuses = weaponClassBonusStats();
  return Object.entries(bonuses)
    .map(([key, value]) => `+${value} ${statDefs.find((stat) => stat.key === key)?.name ?? key}`)
    .join(", ");
}

function showShopDetails(item) {
  const typeText = item.weaponName ? "Weapon" : "Item";
  setDetailPanel({
    title: item.name,
    text: buildUpgradeDetailText(item),
    meta: getUpgradeMeta(item, typeText, [`${item.cost} scrap`]),
    actions: [],
    tier: item.tier,
    tip: ""
  });
}

function showWeaponDetails(weapon) {
  const actions = getWeaponActions(weapon);
  setDetailPanel({
    title: `${weapon.name} ${tierLabel(weapon.tier)}`,
    text: buildWeaponDetailText(weapon),
    meta: [rarities[Math.min(MAX_WEAPON_RANK, weapon.tier)].name, "Weapon", `Tier ${tierLabel(weapon.tier)}`],
    actions: [],
    tier: weapon.tier,
    tip: ""
  });
}

function getWeaponActions(weapon) {
  const duplicate = state.weapons.find((other) => other !== weapon && other.name === weapon.name && other.tier === weapon.tier);
  const recycle = getWeaponRecycleValue(weapon);
  const canMerge = Boolean(duplicate && weapon.tier < MAX_WEAPON_RANK);
  return [
    {
      label: `Recycle +${recycle}`,
      className: "recycle",
      onClick: () => recycleWeapon(weapon, recycle)
    },
    {
      label: "Merge",
      className: "combine",
      disabled: !canMerge,
      onClick: () => combineWeapon(weapon.name, weapon.tier)
    }
  ];
}

function showModDetails(modName) {
  setDetailPanel({
    title: modName,
    text: buildModDetailText(modName),
    meta: ["Item Modifier", "Equipped"],
    actions: [],
    tip: ""
  });
}

function showOwnedItemDetails(itemGroup) {
  setDetailPanel({
    title: `${itemGroup.name}${itemGroup.count > 1 ? ` x${itemGroup.count}` : ""}`,
    text: buildOwnedItemDetailText(itemGroup),
    meta: [rarityNameFor(itemGroup), "Item", tierTextFor(itemGroup)],
    actions: [],
    tier: itemGroup.tier,
    tip: ""
  });
}

function getOwnedItemActions(itemGroup) {
  if (itemGroup.id === "slot_machine") {
    const throwCost = slotMachineThrowAwayCost();
    return [
      {
        label: "Spin",
        className: "combine",
        onClick: () => spinSlotMachine(itemGroup)
      },
      {
        label: `Throw Away -${throwCost}`,
        className: "recycle",
        disabled: state.scrap < throwCost,
        onClick: () => throwAwaySlotMachine(itemGroup, throwCost)
      }
    ];
  }
  const recycle = Math.max(1, Math.floor(calculateShopCost(itemGroup.baseCost, itemGroup.tier) * state.recycleRate));
  const canMerge = itemGroup.count >= 2 && itemGroup.tier < MAX_WEAPON_RANK;
  return [
    {
      label: `Recycle +${recycle}`,
      className: "recycle",
      onClick: () => recycleOwnedItem(itemGroup.id, itemGroup.tier, recycle)
    },
    {
      label: "Merge",
      className: "combine",
      disabled: !canMerge,
      onClick: () => mergeOwnedItem(itemGroup.id, itemGroup.tier)
    }
  ];
}

function spinSlotMachine(itemGroup) {
  const item = state.items.find((owned) => owned.id === itemGroup.id && owned.tier === itemGroup.tier);
  if (!item) return;
  item.slotRoll = rollSlotMachineEffect();
  state.openActionMenu = { type: "item", key: `${item.id}:${item.tier}` };
  syncDerivedStats();
  renderShop();
  const group = groupItems(state.items).find((owned) => owned.id === item.id && owned.tier === item.tier);
  if (group) showOwnedItemDetails(group);
  updateHud();
}

function throwAwaySlotMachine(itemGroup, cost) {
  if (state.scrap < cost) return;
  const index = state.items.findIndex((owned) => owned.id === itemGroup.id && owned.tier === itemGroup.tier);
  if (index < 0) return;
  state.scrap -= cost;
  state.items.splice(index, 1);
  state.openActionMenu = null;
  syncDerivedStats();
  renderShop();
  updateHud();
}

function appendActionDropdown(parent, actions) {
  const menu = document.createElement("div");
  menu.className = "action-dropdown";
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    if (action.className) button.classList.add(action.className);
    button.disabled = Boolean(action.disabled);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!button.disabled) action.onClick();
    });
    menu.appendChild(button);
  }
  parent.appendChild(menu);
}

function setDetailPanel({ title, text, meta, actions, tip = "", tier = 0 }) {
  ui.detailTitle.textContent = title;
  ui.detailText.textContent = text;
  ui.detailActions.closest(".detail-panel")?.setAttribute("data-tier", tier ? String(Math.min(MAX_WEAPON_RANK, Math.max(1, tier))) : "0");
  ui.detailMeta.innerHTML = "";
  for (const value of meta) {
    const span = document.createElement("span");
    span.textContent = value;
    const rarityTier = getRarityTierByName(value);
    if (rarityTier) {
      span.classList.add("rarity-chip", `tier-${rarityTier}`);
    } else if (String(value).startsWith("Tier ")) {
      span.classList.add("tier-line");
    }
    ui.detailMeta.appendChild(span);
  }
  ui.detailActions.innerHTML = "";
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    if (action.className) button.classList.add(action.className);
    button.disabled = Boolean(action.disabled);
    button.addEventListener("click", action.onClick);
    ui.detailActions.appendChild(button);
  }
  renderDetailTip(tip);
}

function getRarityTierByName(name) {
  if (name === "Unique") return UNIQUE_TIER;
  for (const [tier, rarity] of Object.entries(rarities)) {
    if (rarity.name === name) {
      return Number(tier);
    }
  }
  return 0;
}

function renderDetailTip(tip) {
  let tipBox = document.getElementById("detailTip");
  if (!tipBox) {
    tipBox = document.createElement("div");
    tipBox.id = "detailTip";
    tipBox.className = "detail-tip";
    ui.detailActions.parentNode.insertBefore(tipBox, ui.detailActions);
  }

  if (!tip || state.detailTipDismissed === tip) {
    tipBox.classList.add("hidden");
    tipBox.innerHTML = "";
    return;
  }

  tipBox.classList.remove("hidden");
  tipBox.innerHTML = `
    <span>${tip}</span>
    <button type="button" aria-label="Close tip">x</button>
  `;
  tipBox.querySelector("button").addEventListener("click", () => {
    state.detailTipDismissed = tip;
    tipBox.classList.add("hidden");
  });
}

function recycleOwnedItem(itemId, tier, value) {
  if (upgrades.find((upgrade) => upgrade.id === itemId)?.unique) return;
  const index = state.items.findIndex((item) => item.id === itemId && item.tier === tier);
  if (index < 0) return;
  state.items.splice(index, 1);
  state.scrap += value;
  trackScrap(value);
  playSfx("coin");
  state.openActionMenu = null;
  syncDerivedStats();
  renderShop();
  updateHud();
}

function mergeOwnedItem(itemId, tier) {
  if (upgrades.find((upgrade) => upgrade.id === itemId)?.unique) return;
  if (tier >= MAX_WEAPON_RANK) return;
  const matches = [];
  for (let i = 0; i < state.items.length; i += 1) {
    const item = state.items[i];
    if (item.id === itemId && item.tier === tier) {
      matches.push(i);
    }
  }
  if (matches.length < 2) return;
  const first = state.items[matches[0]];
  const insertAt = matches[0];
  state.items.splice(matches[1], 1);
  state.items.splice(matches[0], 1);
  const merged = {
    ...first,
    tier: tier + 1,
    baseCost: Math.round(first.baseCost * 1.35)
  };
  state.items.splice(insertAt, 0, merged);
  playSfx("merge");
  state.openActionMenu = { type: "item", key: `${itemId}:${tier + 1}` };
  syncDerivedStats();
  renderShop();
  const mergedGroup = groupItems(state.items).find((group) => group.id === itemId && group.tier === tier + 1);
  if (mergedGroup) {
    showOwnedItemDetails(mergedGroup);
  }
  updateHud();
}

function combineWeapon(name, tier) {
  const matches = [];
  for (let i = 0; i < state.weapons.length; i += 1) {
    const weapon = state.weapons[i];
    if (weapon.name === name && weapon.tier === tier) {
      matches.push(i);
    }
  }
  if (matches.length < 2 || tier >= MAX_WEAPON_RANK) return;
  const first = state.weapons[matches[0]];
  const insertAt = matches[0];
  state.weapons.splice(matches[1], 1);
  state.weapons.splice(matches[0], 1);
  const merged = { ...first, tier: tier + 1, fireCooldown: Math.min(first.fireCooldown ?? 0, 0.15) };
  state.weapons.splice(insertAt, 0, merged);
  playSfx("merge");
  state.openActionMenu = { type: "weapon", index: insertAt };
  syncDerivedStats();
  renderShop();
  showWeaponDetails(merged);
  updateHud();
}

function getWeaponRecycleValue(weapon) {
  const base = upgrades.find((upgrade) => upgrade.weaponName === weapon.name);
  const baseCost = base?.baseCost ?? 18;
  return Math.max(1, Math.floor(calculateShopCost(baseCost, weapon.tier) * state.recycleRate));
}

function recycleWeapon(weapon, value) {
  const index = state.weapons.indexOf(weapon);
  if (index < 0) return;
  state.weapons.splice(index, 1);
  state.scrap += value;
  trackScrap(value);
  playSfx("coin");
  state.openActionMenu = null;
  syncDerivedStats();
  renderShop();
  updateHud();
}

function getRecycleValue(item) {
  return Math.max(1, Math.floor(calculateShopCost(item.baseCost, item.tier) * state.recycleRate));
}

function buyUpgrade(item) {
  if (!canBuyUpgrade(item)) {
    if (item.weaponName && state.weapons.length >= maxWeaponSlots()) {
      showMessage("Weapon Slots Full", "Merge or recycle a weapon first.", 1200);
    }
    return;
  }
  state.scrap -= item.cost;
  playSfx("buy");
  recordUpgrade(item);
  applyImmediatePurchaseEffect(item);
  state.shopChoices = state.shopChoices.filter((choice) => choice !== item);
  if (state.shopChoices.length === 0) {
    state.freeRerolls += 1;
    showMessage("Free Reroll", "Bought out the shop", 1200);
  }
  // Smoothly fade out just the purchased card instead of tearing down and repainting the
  // whole grid (that full rebuild was the "screen flash" on every click). Everything else
  // stays put; only counts and the other Buy buttons refresh.
  const boughtCard = [...ui.shopCards.querySelectorAll(".card")].find((c) => c._item === item);
  if (boughtCard) {
    boughtCard.classList.add("card-bought");
    boughtCard.addEventListener("transitionend", () => boughtCard.remove(), { once: true });
    // Safety net in case the transition doesn't fire (e.g. reduced-motion).
    setTimeout(() => boughtCard.remove(), 260);
  }
  renderShopHeader();
  refreshShopCardButtons();
  renderStatSheets();
  renderLoadout();
  updateHud();
}

function recordUpgrade(item) {
  if (item.weaponName) {
    addWeapon(item.weaponName, item.tier ?? 1);
  } else {
    state.items.push({
      id: item.id,
      name: item.name,
      tier: item.tier,
      unique: Boolean(item.unique),
      baseCost: item.baseCost,
      description: item.description,
      slotRoll: item.id === "slot_machine" ? rollSlotMachineEffect() : undefined
    });
  }
  syncDerivedStats();
}

function addWeapon(name, tier) {
  if (state.weapons.length >= maxWeaponSlots()) {
    return false;
  }
  state.weapons.push({ name, tier, fireCooldown: rand(0.05, 0.35) });
  return true;
}

function showMessage(title, detail = "", duration = 0) {
  const token = ++messageToken;
  ui.message.innerHTML = `${title}${detail ? `<small>${detail}</small>` : ""}`;
  ui.message.classList.toggle("shop-message", state.mode === "shop" || state.mode === "reward");
  ui.message.classList.remove("hidden");
  if (duration > 0) {
    window.setTimeout(() => {
      if (token === messageToken) {
        hideMessage();
      }
    }, duration);
  }
}

function hideMessage() {
  messageToken += 1;
  ui.message.classList.add("hidden");
  ui.message.classList.remove("shop-message");
}

function updateHud() {
  ui.wave.textContent = state.wave;
  ui.time.textContent = Math.max(0, Math.ceil(state.waveTime));
  ui.scrap.textContent = state.scrap;
  ui.bag.textContent = state.unusedScrap + state.pendingBagScrap;
  ui.bag.closest(".stat").classList.toggle("hidden", state.mode === "playing" || state.mode === "menu");
  ui.hpFill.style.width = `${clamp(state.player.hp / state.player.maxHp, 0, 1) * 100}%`;
  ui.hpText.textContent = `${Math.max(0, Math.round(state.player.hp))} / ${Math.round(state.player.maxHp)}`;
  if (state.mode === "shop") {
    renderStatSheets();
  }
}

function renderStatSheets() {
  const classBonuses = weaponClassBonusStats();
  const ownedBonuses = calculateOwnedUpgradeEffects().stats;
  const derivedRows = [
    ["Avg Weapon DPS", calculateAverageWeaponDps().toFixed(1), "derived"],
    ["Damage Taken", `${Math.round(armorDamageMultiplier(effectiveStat("armor")) * 100)}%`, "derived"],
    ["Weapon Classes", formatWeaponClassBonuses() || "None", "derived"]
  ].map(([name, value, className]) => `<div class="stat-row ${className}"><span class="stat-name">${name}</span><span class="stat-value">${value}</span></div>`);

  const statRows = statDefs.map((stat) => {
    const raw = (state.player.stats[stat.key] ?? 0) + (ownedBonuses[stat.key] ?? 0);
    const bonus = classBonuses[stat.key] ?? 0;
    const value = formatStatValue(stat, raw + bonus);
    const ownedValue = ownedBonuses[stat.key] ?? 0;
    const ownedText = ownedValue ? ` <small>gear ${ownedValue > 0 ? "+" : ""}${Number(ownedValue).toFixed(stat.decimals ?? 0)}${stat.suffix ?? ""}</small>` : "";
    const bonusText = bonus ? ` <small>class +${bonus}</small>` : "";
    return `<div class="stat-row"><span class="stat-name">${stat.name}</span><span class="stat-value">${value}${ownedText}${bonusText}</span></div>`;
  });
  const html = [...derivedRows, ...statRows].join("");
  ui.shopStatList.innerHTML = html;
}

function calculateAverageWeaponDps() {
  const weapons = state.weapons.slice(0, maxWeaponSlots());
  if (!weapons.length) return 0;
  return weapons.reduce((sum, weapon) => sum + weaponShotDamage(weapon) / weaponCooldown(weapon), 0) / weapons.length;
}

function formatStatValue(stat, value) {
  const decimals = stat.decimals ?? 0;
  const rounded = Number(value).toFixed(decimals);
  const sign = stat.signed && value > 0 ? "+" : "";
  return `${sign}${rounded}${stat.suffix ?? ""}`;
}

function renderLoadout() {
  ui.weaponList.innerHTML = "";
  const weaponGrid = document.createElement("div");
  weaponGrid.className = "weapon-slot-grid";
  for (let i = 0; i < maxWeaponSlots(); i += 1) {
    const weapon = state.weapons[i];
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = `weapon-slot${weapon ? ` tier-${weapon.tier}` : " empty"}`;
    if (weapon) {
      slot.innerHTML = `
        <canvas width="96" height="96" aria-hidden="true"></canvas>
        <span class="slot-tier">${tierLabel(weapon.tier)}</span>
      `;
      slot.title = `${weapon.name} ${tierLabel(weapon.tier)}`;
      slot.addEventListener("mouseenter", () => showWeaponDetails(weapon));
      slot.addEventListener("focus", () => showWeaponDetails(weapon));
      slot.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = state.openActionMenu?.type === "weapon" && state.openActionMenu.index === i;
        state.openActionMenu = isOpen ? null : { type: "weapon", index: i };
        renderLoadout();
        showWeaponDetails(weapon);
      });
      drawWeaponIcon(slot.querySelector("canvas"), weapon.name, weapon.tier);
      if (ART_SOURCES[`weapon:${weapon.name}`] && ART_FULL_CARD.has(`weapon:${weapon.name}`)) {
        slot.classList.add("has-art-tile");
      }
      if (state.openActionMenu?.type === "weapon" && state.openActionMenu.index === i) {
        slot.classList.add("menu-open");
        appendActionDropdown(slot, getWeaponActions(weapon));
      }
    } else {
      slot.innerHTML = `<span class="empty-slot-label">+</span>`;
      slot.title = "Empty weapon slot";
    }
    weaponGrid.appendChild(slot);
  }
  ui.weaponList.appendChild(weaponGrid);

  const currentAttack = document.createElement("div");
  currentAttack.className = "current-attack";
  currentAttack.innerHTML = `<strong>Current attack:</strong> ${formatCurrentAttackStats()}`;
  ui.weaponList.appendChild(currentAttack);

  for (const mod of state.weaponMods) {
    const pill = createPill(mod, 2);
    pill.addEventListener("mouseenter", () => showModDetails(mod));
    ui.weaponList.appendChild(pill);
  }

  ui.itemList.innerHTML = "";
  if (state.items.length === 0) {
    ui.itemList.appendChild(createPill("No items yet", 1));
  } else {
    const grouped = groupItems(state.items);
    for (const group of grouped) {
      const pill = createPill(`${group.name} ${rankLabelFor(group)}${group.count > 1 ? ` x${group.count}` : ""}`, group.tier);
      const menuKey = `${group.id}:${group.tier}`;
      pill.tabIndex = 0;
      pill.setAttribute("role", "button");
      pill.addEventListener("mouseenter", () => showOwnedItemDetails(group));
      pill.addEventListener("focus", () => showOwnedItemDetails(group));
      pill.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = state.openActionMenu?.type === "item" && state.openActionMenu.key === menuKey;
        state.openActionMenu = isOpen ? null : { type: "item", key: menuKey };
        renderLoadout();
        showOwnedItemDetails(group);
      });
      if (state.openActionMenu?.type === "item" && state.openActionMenu.key === menuKey) {
        pill.classList.add("menu-open");
        appendActionDropdown(pill, getOwnedItemActions(group));
      }
      ui.itemList.appendChild(pill);
    }
  }
  drawPlayerPreview();
}

function createPill(text, tier) {
  const pill = document.createElement("span");
  pill.className = `pill tier-${tier}`;
  pill.textContent = text;
  return pill;
}

function groupItems(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.id}:${item.tier}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { ...item, count: 1 });
    }
  }
  return [...map.values()];
}

function drawPlayerPreview() {
  const preview = ui.playerPreview;
  const pctx = preview.getContext("2d");
  const cx = preview.width / 2;
  const cy = preview.height / 2 + 12;

  pctx.clearRect(0, 0, preview.width, preview.height);
  const bg = pctx.createLinearGradient(0, 0, preview.width, preview.height);
  bg.addColorStop(0, "#31475c");
  bg.addColorStop(1, "#1b2635");
  pctx.fillStyle = bg;
  pctx.fillRect(0, 0, preview.width, preview.height);

  pctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  pctx.beginPath();
  pctx.ellipse(cx, cy + 42, 56, 16, 0, 0, Math.PI * 2);
  pctx.fill();

  pctx.save();
  pctx.translate(cx, cy);
  pctx.scale(1.48 * (state.character?.scale ?? 1), 1.48 * (state.character?.scale ?? 1));
  drawSpudBody(pctx, state.character ?? characters[0]);
  drawPreviewGear(pctx);
  pctx.restore();
}

function drawCharacterPortrait(portraitCanvas, character) {
  const pctx = portraitCanvas.getContext("2d");
  const cx = portraitCanvas.width / 2;
  const cy = portraitCanvas.height / 2 + 16;
  pctx.clearRect(0, 0, portraitCanvas.width, portraitCanvas.height);
  const bg = pctx.createLinearGradient(0, 0, portraitCanvas.width, portraitCanvas.height);
  bg.addColorStop(0, "#31475c");
  bg.addColorStop(1, "#182333");
  pctx.fillStyle = bg;
  pctx.fillRect(0, 0, portraitCanvas.width, portraitCanvas.height);
  pctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  pctx.beginPath();
  pctx.ellipse(cx, cy + 44, 48, 13, 0, 0, Math.PI * 2);
  pctx.fill();
  pctx.save();
  pctx.translate(cx, cy);
  pctx.scale(1.75 * (character.scale ?? 1), 1.75 * (character.scale ?? 1));
  drawSpudBody(pctx, character);
  pctx.restore();
}

function drawPreviewGear(pctx) {
  pctx.strokeStyle = "#111722";
  pctx.lineWidth = 2.5;

  const primaryWeapon = getPrimaryWeapon();
  if (primaryWeapon) {
    pctx.save();
    pctx.translate(34, -8);
    pctx.rotate(-0.14);
    pctx.scale(0.78, 0.78);
    drawWeaponSpriteShape(pctx, primaryWeapon);
    pctx.restore();
  }

  if (effectiveStat("armor") > 0) {
    pctx.fillStyle = "#9aa7b8";
    pctx.beginPath();
    pctx.arc(0, -12, 22, Math.PI, Math.PI * 2);
    pctx.lineTo(20, -10);
    pctx.lineTo(-20, -10);
    pctx.closePath();
    pctx.fill();
    pctx.stroke();
  }

  if (effectiveStat("luck") > 0) {
    pctx.fillStyle = "#f2c45f";
    pctx.beginPath();
    pctx.arc(-21, 6, 6, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
  }

  if (effectiveStat("engineering") > 0) {
    pctx.fillStyle = "#66c7d8";
    pctx.beginPath();
    pctx.arc(21, 14, 6, 0, Math.PI * 2);
    pctx.fill();
    pctx.stroke();
  }

  if (effectiveStat("elementalDamage") > 0) {
    pctx.fillStyle = "#ff9c5b";
    pctx.beginPath();
    pctx.moveTo(-25, -2);
    pctx.lineTo(-18, -18);
    pctx.lineTo(-12, -2);
    pctx.closePath();
    pctx.fill();
    pctx.stroke();
  }
}
