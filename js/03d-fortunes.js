// Layer C -- Fortune Cookie data + pure logic. Loaded as a plain <script> tag; shares globals
// with the rest of the game (no import/export, no classes). This file must be safe to load on
// its own: no DOM access, no state mutation at load time, every Layer B call guarded.
//
// Pipeline (implemented by LATER passes, not here): a cookie drops mid-wave and is stashed in
// state.pendingFortunes -> after the wave, one panel per cookie offers CRACK (reveal paperText,
// arm the effect for next wave) or EAT (lose 1 max HP, no effect) -> armed effects fire via
// applyFortune() at the START of the next wave -> clearTempModifiers() tears them down at the
// end of that wave, same as every other Layer B temp bonus.

// --- Rarity ladder -----------------------------------------------------------------------
// Fortune-specific rarity, NOT the same scale as item/weapon tiers. Order matters: it is the
// display order (weakest -> CLOWN) and rollFortuneRarity() below walks it in this order.
const FORTUNE_RARITIES = [
  { key: "common", label: "Common", color: "#9aa7b8", weight: 34 },
  { key: "uncommon", label: "Uncommon", color: "#74d3a4", weight: 26 },
  { key: "rare", label: "Rare", color: "#58aaff", weight: 18 },
  { key: "epic", label: "Epic", color: "#ba7eff", weight: 11 },
  { key: "legendary", label: "Legendary", color: "#ff9c3d", weight: 6 },
  { key: "unique", label: "Unique", color: "#f2c45f", weight: 3 },
  { key: "clown", label: "CLOWN", color: "#5a1f24", weight: 2 },
];

// Weighted pick over FORTUNE_RARITIES. Written to stay correct even if the weights above are
// tuned later -- it sums live rather than assuming the total is 100.
function rollFortuneRarity() {
  const totalWeight = FORTUNE_RARITIES.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const rarity of FORTUNE_RARITIES) {
    roll -= rarity.weight;
    if (roll <= 0) return rarity;
  }
  // Floating point fallback: land on the last entry rather than returning undefined.
  return FORTUNE_RARITIES[FORTUNE_RARITIES.length - 1];
}

// Scales a magnitude by rarity so every effect's numbers live in one place instead of being
// hand-typed per rarity at every call site. `table` maps rarityKey -> magnitude; any rarity
// missing from the table (e.g. "clown" passed to a non-clown effect) falls back to the
// highest defined magnitude so a gap in the table degrades gracefully instead of returning
// undefined/NaN into a Layer B call.
function magnitudeFor(rarityKey, table) {
  if (table[rarityKey] !== undefined) return table[rarityKey];
  const values = Object.values(table);
  return values.length ? Math.max(...values) : 0;
}

// --- Effect catalogue ----------------------------------------------------------------------
// Each entry:
//   id         -- stable identifier
//   valence    -- "good" | "bad", drives the ~75/25 split and paper voice
//   rarities   -- which FORTUNE_RARITIES keys this effect can roll at (never "clown")
//   paper(r)   -- valence + timeframe only, NEVER names the effect (shown on crack, pre-reveal)
//   announce(r)-- explicit text shown when the effect actually fires next wave
//   apply(r)   -- performs the effect via Layer B helpers only
const FORTUNE_EFFECTS = [
  // ---- GOOD ----
  {
    id: "luck",
    valence: "good",
    rarities: ["common", "uncommon", "rare", "epic", "legendary", "unique"],
    paper: () => "You will gain immense luck in the next wave.",
    announce(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 5, uncommon: 8, rare: 12, epic: 18, legendary: 26, unique: 40 });
      return `Fortune smiles on you -- +${amount} Luck, this wave only!`;
    },
    apply(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 5, uncommon: 8, rare: 12, epic: 18, legendary: 26, unique: 40 });
      if (typeof grantTempStat === "function") grantTempStat("luck", amount);
    },
  },
  {
    id: "freeWeapon",
    valence: "good",
    rarities: ["uncommon", "rare", "epic", "legendary", "unique"],
    paper: () => "You will receive a mysterious gift in the next wave.",
    // announce() and apply() MUST describe the same weapon. pickFreeWeapon() is random, so
    // calling it separately in each would announce one weapon and grant a different one. The
    // roll is therefore memoised onto the fortune instance (`this` is the effect object, so it
    // is cached per-fortune by rollFortune passing the instance in) -- see resolveFreeWeapon.
    announce(rarity, fortune) {
      const { name, tier } = resolveFreeWeapon(rarity, fortune);
      return `You have gained a ${name} (tier ${tier}) for free -- this wave only!`;
    },
    apply(rarity, fortune) {
      const { name, tier } = resolveFreeWeapon(rarity, fortune);
      if (typeof grantTempWeapon === "function") grantTempWeapon(name, tier);
    },
  },
  {
    // Extra scrap is delivered as the `harvesting` STAT (not recycleRateBonus): harvesting is
    // the existing per-wave scrap-gain stat, so this reads as "you find more scrap this wave"
    // rather than touching the shop's recycle-sell-back economy, which recycleRateBonus governs.
    id: "extraScrap",
    valence: "good",
    rarities: ["common", "uncommon", "rare", "epic", "legendary"],
    paper: () => "You will find unexpected riches in the next wave.",
    announce(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 3, uncommon: 5, rare: 8, epic: 12, legendary: 18 });
      return `A pile of scrap tumbles your way -- +${amount} Harvesting, this wave only!`;
    },
    apply(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 3, uncommon: 5, rare: 8, epic: 12, legendary: 18 });
      if (typeof grantTempStat === "function") grantTempStat("harvesting", amount);
    },
  },
  {
    id: "maxHpBuff",
    valence: "good",
    rarities: ["common", "uncommon", "rare", "epic", "legendary", "unique"],
    paper: () => "You will feel invigorated in the next wave.",
    announce(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 8, uncommon: 14, rare: 22, epic: 32, legendary: 45, unique: 65 });
      return `You have gained +${amount} Max HP -- this wave only!`;
    },
    apply(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 8, uncommon: 14, rare: 22, epic: 32, legendary: 45, unique: 65 });
      if (typeof grantTempStat === "function") grantTempStat("maxHp", amount);
      // Heal by the same amount so the buff is felt immediately, not just as a raised cap.
      // PHASE 1 CO-OP: applies to every player, not just P1 -- falls back to state.player if
      // state.players is unavailable so this stays safe even loaded standalone/out of order.
      if (typeof state !== "undefined") {
        const targets = Array.isArray(state.players) ? state.players : (state.player ? [state.player] : []);
        for (const player of targets) {
          if (!player || typeof player.hp !== "number") continue;
          const cap = typeof player.maxHp === "number" ? player.maxHp : Infinity;
          player.hp = Math.min(cap, player.hp + amount);
        }
      }
    },
  },
  {
    id: "extraDamage",
    valence: "good",
    rarities: ["common", "uncommon", "rare", "epic", "legendary", "unique"],
    paper: () => "You will strike harder in the next wave.",
    announce(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 6, uncommon: 10, rare: 15, epic: 22, legendary: 32, unique: 50 });
      return `Your attacks hit harder -- +${amount}% Damage, this wave only!`;
    },
    apply(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 6, uncommon: 10, rare: 15, epic: 22, legendary: 32, unique: 50 });
      if (typeof grantTempStat === "function") grantTempStat("damagePercent", amount);
    },
  },
  {
    id: "speedBoost",
    valence: "good",
    rarities: ["common", "uncommon", "rare", "epic", "legendary"],
    paper: () => "You will move like the wind in the next wave.",
    announce(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 5, uncommon: 8, rare: 12, epic: 18, legendary: 26 });
      return `Your legs feel light -- +${amount} Speed, this wave only!`;
    },
    apply(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 5, uncommon: 8, rare: 12, epic: 18, legendary: 26 });
      if (typeof grantTempStat === "function") grantTempStat("speed", amount);
    },
  },
  {
    id: "pickupRangeBoost",
    valence: "good",
    rarities: ["common", "uncommon", "rare", "epic"],
    paper: () => "You will draw treasure to you in the next wave.",
    announce(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 10, uncommon: 18, rare: 28, epic: 40 });
      return `Loot seems to leap into your hands -- +${amount} Pickup Range, this wave only!`;
    },
    apply(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 10, uncommon: 18, rare: 28, epic: 40 });
      if (typeof grantTempStat === "function") grantTempStat("pickupRange", amount);
    },
  },

  // ---- BAD (small, mild pool) ----
  {
    id: "extraEnemies",
    valence: "bad",
    rarities: ["common", "uncommon", "rare"],
    paper: () => "You will suffer a thickening of the horde in the next wave.",
    announce(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 1, uncommon: 2, rare: 3 });
      return `The horde grows thicker -- +${amount} enemies per spawn, this wave only!`;
    },
    apply(rarity) {
      // NOT a stat -- extraEnemies is a sibling field on calculateOwnedUpgradeEffects(), read
      // directly at js/07-combat.js:483 to size the spawn batch (capped at 22 total there).
      // Keep N small (1..3) per the spec so this stays an annoyance, not a threat.
      const amount = magnitudeFor(rarity.key, { common: 1, uncommon: 2, rare: 3 });
      if (typeof grantTempEffect === "function") grantTempEffect("extraEnemies", amount);
    },
  },
  {
    id: "reducedDamage",
    valence: "bad",
    rarities: ["common", "uncommon", "rare"],
    paper: () => "You will suffer a weakness in your arm in the next wave.",
    announce(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 4, uncommon: 7, rare: 10 });
      return `Your attacks feel weaker -- -${amount}% Damage, this wave only!`;
    },
    apply(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 4, uncommon: 7, rare: 10 });
      if (typeof grantTempStat === "function") grantTempStat("damagePercent", -amount);
    },
  },
  {
    id: "slower",
    valence: "bad",
    rarities: ["common", "uncommon", "rare"],
    paper: () => "You will feel sluggish in the next wave.",
    announce(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 3, uncommon: 5, rare: 8 });
      return `Your legs feel heavy -- -${amount} Speed, this wave only!`;
    },
    apply(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 3, uncommon: 5, rare: 8 });
      if (typeof grantTempStat === "function") grantTempStat("speed", -amount);
    },
  },
  {
    id: "fragile",
    valence: "bad",
    rarities: ["common", "uncommon", "rare"],
    paper: () => "Misfortune finds a chink in your defences in the next wave.",
    announce(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 2, uncommon: 4, rare: 6 });
      return `Your defences feel thin -- -${amount} Armor, this wave only!`;
    },
    apply(rarity) {
      const amount = magnitudeFor(rarity.key, { common: 2, uncommon: 4, rare: 6 });
      if (typeof grantTempStat === "function") grantTempStat("armor", -amount);
    },
  },
];

// Real weapon names, verified against js/03-data.js `weaponName` fields. Only names that exist
// are listed here so freeWeapon can never announce/grant a weapon that doesn't exist.
const FORTUNE_FREE_WEAPON_POOL = [
  "Spark Peashooter", "Twig Wand", "Stub Club", "Rusty Pistol", "Slingshot",
  "Scrap Revolver", "Tin Dragon Flamethrower", "Grenade Launcher", "Potato Masher",
  "Seed Shotgun", "Thorn Lasher", "Frost Bow", "Shuriken",
];

// Picks a random real weapon and a tier that scales with rarity (capped at MAX_WEAPON_RANK,
// which is 5 as of js/01-core.js -- read live rather than hardcoded so a future rank change is
// picked up automatically).
function pickFreeWeapon(rarity) {
  const name = FORTUNE_FREE_WEAPON_POOL[Math.floor(Math.random() * FORTUNE_FREE_WEAPON_POOL.length)];
  const maxRank = typeof MAX_WEAPON_RANK === "number" ? MAX_WEAPON_RANK : 5;
  const tier = Math.min(
    maxRank,
    magnitudeFor(rarity.key, { uncommon: 1, rare: 2, epic: 3, legendary: 4, unique: 5 })
  );
  return { name, tier };
}

// Resolves the free weapon ONCE per fortune and caches it on the fortune instance, so the text
// on the paper and the weapon actually granted next wave can never disagree. Falls back to a
// bare roll if no fortune object was threaded through (defensive: still returns a valid weapon).
function resolveFreeWeapon(rarity, fortune) {
  if (fortune) {
    if (!fortune.rolledWeapon) fortune.rolledWeapon = pickFreeWeapon(rarity);
    return fortune.rolledWeapon;
  }
  return pickFreeWeapon(rarity);
}

// --- CLOWN pool ------------------------------------------------------------------------------
// Both are wave-scoped FLAGS ONLY here. The behaviour each flag triggers (spawning clowns,
// arming enemies) is implemented by a LATER pass that reads these flags at the relevant hook
// (chooseEnemyType(), enemy attack logic). Keeping apply() flag-only means this file cannot
// accidentally destroy permanent state on its own.
const FORTUNE_CLOWN_EFFECTS = [
  {
    id: "clownWave",
    valence: "bad", // nominally chaotic, not really "good" or "bad" -- CLOWN paper text hides this anyway
    rarities: ["clown"],
    paper: () => "CHAOS!!!",
    announce: () => "Every enemy this wave... is a Clown. This wave only!",
    apply() {
      // Consumer: chooseEnemyType() (js/07-combat.js:600) should early-return the Clown
      // template while this flag is set. Flag-only here -- see file header.
      if (typeof setTempFlag === "function") setTempFlag("clownWave", true);
    },
  },
  {
    id: "armedEnemies",
    valence: "bad",
    rarities: ["clown"],
    paper: () => "CHAOS!!!",
    announce: () => "The enemies found weapons of their own. This wave only!",
    apply() {
      // Consumer: enemy attack/spawn logic should check this flag and grant enemies a mild
      // ranged/melee poke. Flag-only here -- see file header.
      if (typeof setTempFlag === "function") setTempFlag("armedEnemies", true);
    },
  },
];

// --- Rolling ---------------------------------------------------------------------------------
// Rolls a full fortune: rarity, then (clown ? clown pool : good/bad-weighted normal pool).
// Never returns undefined and never throws, even if a rarity has no matching effects -- falls
// back to the nearest non-empty pool so a cookie can never come up empty.
function rollFortune() {
  const rarity = rollFortuneRarity();

  if (rarity.key === "clown") {
    const effect = FORTUNE_CLOWN_EFFECTS[Math.floor(Math.random() * FORTUNE_CLOWN_EFFECTS.length)];
    const fortune = { rarity, effect, paperText: effect.paper(rarity), announceText: "", isClown: true };
    // Built first, then filled in, so announce() receives the instance and any per-fortune roll
    // it memoises is the same one apply() will later read back.
    fortune.announceText = effect.announce(rarity, fortune);
    return fortune;
  }

  const eligible = FORTUNE_EFFECTS.filter((e) => e.rarities.includes(rarity.key));
  const wantGood = Math.random() < 0.75; // ~75% good / ~25% bad among non-CLOWN
  let pool = eligible.filter((e) => e.valence === (wantGood ? "good" : "bad"));
  // Fall back gracefully: wrong valence at this rarity -> any eligible effect at this rarity ->
  // any effect at all, so this can never return undefined.
  if (pool.length === 0) pool = eligible;
  if (pool.length === 0) pool = FORTUNE_EFFECTS;

  const effect = pool[Math.floor(Math.random() * pool.length)];
  const fortune = { rarity, effect, paperText: effect.paper(rarity), announceText: "", isClown: false };
  // See the clown branch above: the instance is created before announce() so effects that
  // memoise a roll (freeWeapon) stay consistent between the paper text and apply().
  fortune.announceText = effect.announce(rarity, fortune);
  return fortune;
}

// --- Applying ----------------------------------------------------------------------------
// Fires the armed effect and returns the announce string for display. Safe to call even if
// Layer B helpers are missing (e.g. this file loaded standalone/out of order): apply()
// implementations already guard every Layer B call with typeof checks, so this never throws.
function applyFortune(fortune) {
  if (!fortune || !fortune.effect || typeof fortune.effect.apply !== "function") return "";
  // The fortune instance is passed through so apply() reads back the same memoised roll that
  // announce() used when the paper text was generated (see resolveFreeWeapon).
  fortune.effect.apply(fortune.rarity, fortune);
  return fortune.announceText || "";
}
