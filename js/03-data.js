"use strict";

// data.js - upgrade pool, lore profiles, weapon stat tables

const upgrades = [
  {
    id: "spark_weapon",
    name: "Spark Peashooter",
    badge: "W",
    description: "A basic ranged weapon with steady auto-fire.",
    baseCost: 24,
    tier: 1,
    loadoutType: "weapon",
    weaponName: "Spark Peashooter",
    apply: () => {
      addStat("rangedDamage", 1);
    }
  },
  {
    id: "twig_wand",
    name: "Twig Wand",
    badge: "W",
    description: "Elemental weapon that adds burn pressure.",
    baseCost: 22,
    tier: 1,
    loadoutType: "weapon",
    weaponName: "Twig Wand",
    apply: () => {
      addStat("elementalDamage", 1);
    }
  },
  {
    id: "stub_club",
    name: "Stub Club",
    badge: "W",
    description: "Melee weapon that supports close-range damage.",
    baseCost: 25,
    tier: 1,
    loadoutType: "weapon",
    weaponName: "Stub Club",
    apply: () => {
      addStat("meleeDamage", 1);
    }
  },
  {
    id: "rusty_pistol",
    name: "Rusty Pistol",
    badge: "W",
    description: "A practical ranged weapon with quick metal shots.",
    baseCost: 28,
    tier: 1,
    loadoutType: "weapon",
    weaponName: "Rusty Pistol",
    apply: () => {
      addStat("rangedDamage", 1);
    }
  },
  {
    id: "forked_slingshot",
    name: "Slingshot",
    badge: "W",
    description: "A garden slingshot that fires heavy stones.",
    baseCost: 26,
    tier: 1,
    loadoutType: "weapon",
    weaponName: "Slingshot",
    apply: () => {
      addStat("rangedDamage", 1);
      addStat("critChance", 1);
    }
  },
  {
    id: "scrap_revolver",
    name: "Scrap Revolver",
    badge: "W",
    description: "A chunky six-shooter with high crit pressure.",
    baseCost: 46,
    tier: 2,
    loadoutType: "weapon",
    weaponName: "Scrap Revolver",
    apply: () => {
      addStat("rangedDamage", 2);
      addStat("critChance", 2);
    }
  },
  {
    id: "flamethrower",
    name: "Tin Dragon Flamethrower",
    badge: "W",
    description: "A legendary close-range burner.",
    // Strongest weapon in the game and priced accordingly: raw single-target DPS badly
    // understates it, because it fires two projectiles that each pierce up to 8 targets,
    // so its real crowd output dwarfs every other legendary.
    baseCost: 150,
    tier: 5,
    loadoutType: "weapon",
    weaponName: "Tin Dragon Flamethrower",
    apply: () => {
      addStat("elementalDamage", 3);
      addStat("damagePercent", 4);
    }
  },
  {
    id: "grenade_launcher",
    name: "Grenade Launcher",
    badge: "W",
    description: "A slow mid-game explosive weapon that becomes terrifying at high ranks.",
    // Cheap for a rare on purpose: its single-target DPS is the worst in the game until
    // high ranks, so the cost buys the explosion radius and late-rank payoff, not damage now.
    baseCost: 40,
    tier: 3,
    minWave: 6,
    loadoutType: "weapon",
    weaponName: "Grenade Launcher",
    apply: () => {
      addStat("rangedDamage", 1);
    }
  },
  {
    id: "potato_masher",
    name: "Potato Masher",
    badge: "W",
    description: "A heavy melee club that hits hard and slow with brutal knockback.",
    baseCost: 42,
    tier: 2,
    loadoutType: "weapon",
    weaponName: "Potato Masher",
    apply: () => {
      addStat("meleeDamage", 2);
    }
  },
  {
    id: "seed_shotgun",
    name: "Seed Shotgun",
    badge: "W",
    description: "A short-range spread weapon devastating up close, weak at distance.",
    baseCost: 58,
    tier: 3,
    loadoutType: "weapon",
    weaponName: "Seed Shotgun",
    apply: () => {
      addStat("rangedDamage", 2);
    }
  },
  {
    id: "thorn_lasher",
    name: "Thorn Lasher",
    badge: "W",
    description: "A long-reaching thorned whip that leaves enemies bleeding.",
    baseCost: 60,
    tier: 3,
    loadoutType: "weapon",
    weaponName: "Thorn Lasher",
    apply: () => {
      addStat("meleeDamage", 2);
    }
  },
  {
    id: "frost_bow",
    name: "Frost Bow",
    badge: "W",
    description: "A slow-firing crossbow that chills enemies and slows their advance.",
    baseCost: 95,
    tier: 4,
    loadoutType: "weapon",
    weaponName: "Frost Bow",
    apply: () => {
      addStat("rangedDamage", 2);
    }
  },
  {
    id: "shuriken",
    name: "Shuriken",
    badge: "W",
    description: "A cheap, fast throwing star with light damage but relentless pace.",
    baseCost: 30,
    tier: 2,
    minWave: 3,
    loadoutType: "weapon",
    weaponName: "Shuriken",
    apply: () => {
      addStat("rangedDamage", 1);
      addStat("critChance", 2);
    }
  },
  {
    id: "damage",
    name: "Bigger Sparks",
    badge: "D",
    description: "+8% Damage.",
    baseCost: 26,
    tier: 1,
    loadoutType: "item",
    apply: () => {
      addStat("damagePercent", 8);
    }
  },
  {
    id: "speed",
    name: "Fresh Sneakers",
    badge: "S",
    description: "+8% Speed.",
    baseCost: 20,
    tier: 1,
    loadoutType: "item",
    apply: () => {
      addStat("speed", 8);
    }
  },
  {
    id: "rate",
    name: "Fidget Trigger",
    badge: "R",
    description: "+12% Attack Speed.",
    baseCost: 34,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      addStat("attackSpeed", 12);
    }
  },
  {
    id: "heart",
    name: "Lunchbox Heart",
    badge: "H",
    description: "+10 Max HP and heal 18.",
    baseCost: 28,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      addStat("maxHp", 10);
      heal(18);
    }
  },
  {
    id: "magnet",
    name: "Pocket Magnet",
    badge: "M",
    description: "+40 Pickup Range.",
    baseCost: 16,
    tier: 1,
    loadoutType: "item",
    apply: () => {
      addStat("pickupRange", 40);
    }
  },
  {
    id: "split",
    name: "Forked Barrel",
    badge: "F",
    description: "+1 projectile, -5% Damage. Legendary-only.",
    baseCost: 130,
    tier: 5,
    minWave: 13,
    loadoutType: "item",
    apply: () => {
      state.player.projectiles += 1;
      addStat("damagePercent", -5);
    }
  },
  {
    id: "range",
    name: "Long Straw",
    badge: "L",
    description: "+55 Range.",
    baseCost: 17,
    tier: 1,
    loadoutType: "item",
    apply: () => {
      addStat("range", 55);
    }
  },
  {
    id: "ranged",
    name: "Bent Nail",
    badge: "N",
    description: "+2 Ranged Damage.",
    baseCost: 22,
    tier: 1,
    loadoutType: "item",
    apply: () => {
      addStat("rangedDamage", 2);
    }
  },
  {
    id: "regen",
    name: "Bandage Sprout",
    badge: "B",
    description: "+2 HP Regen.",
    baseCost: 18,
    tier: 1,
    loadoutType: "item",
    apply: () => {
      addStat("hpRegen", 2);
    }
  },
  {
    id: "lifesteal",
    name: "Vampiric Straw",
    badge: "V",
    description: "+3% Life Steal.",
    baseCost: 30,
    tier: 3,
    loadoutType: "item",
    apply: () => {
      addStat("lifeSteal", 3);
    }
  },
  {
    id: "crit",
    name: "Sharpened Tooth",
    badge: "C",
    description: "+5% Crit Chance.",
    baseCost: 24,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      addStat("critChance", 5);
    }
  },
  {
    id: "armor",
    name: "Gilded Chestplate",
    badge: "A",
    description: "+3 Armor.",
    baseCost: 24,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      addStat("armor", 3);
    }
  },
  {
    id: "dodge",
    name: "Nimble Boots",
    badge: "E",
    description: "+4% Dodge.",
    baseCost: 34,
    tier: 3,
    loadoutType: "item",
    apply: () => {
      addStat("dodge", 4);
    }
  },
  {
    id: "luck",
    name: "Lucky Button",
    badge: "K",
    description: "+10 Luck.",
    baseCost: 24,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      addStat("luck", 10);
    }
  },
  {
    id: "harvesting",
    name: "Compost Kit",
    badge: "G",
    description: "+6 Harvesting.",
    baseCost: 20,
    tier: 1,
    loadoutType: "item",
    apply: () => {
      addStat("harvesting", 6);
    }
  },
  {
    id: "coupon_leaf",
    name: "Coupon Leaf",
    badge: "$",
    description: "-6% shop prices. Stacks softly with Luck.",
    baseCost: 26,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      state.shopDiscount += 0.06;
    }
  },
  {
    id: "recycling_clamp",
    name: "Recycling Clamp",
    badge: "R",
    description: "+12% crate recycle value.",
    baseCost: 20,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      state.recycleRate = Math.min(0.75, state.recycleRate + 0.12);
    }
  },
  {
    id: "garden_shears",
    name: "Garden Shears",
    badge: "T",
    description: "Trees break in one hit. Crate items skew rarer.",
    baseCost: 30,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      state.treeOneShot = true;
      addStat("luck", 4);
      addStat("damagePercent", 4);
    }
  },
  {
    id: "engineering",
    name: "Toolbox Charm",
    badge: "T",
    description: "+3 Engineering. Zaps nearby enemies.",
    baseCost: 26,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      addStat("engineering", 3);
    }
  },
  {
    id: "melee",
    name: "Training Gloves",
    badge: "P",
    description: "+2 Melee Damage. Improves point-blank melee damage.",
    baseCost: 21,
    tier: 1,
    loadoutType: "item",
    apply: () => {
      addStat("meleeDamage", 2);
    }
  },
  {
    id: "elemental",
    name: "Static Seed",
    badge: "Z",
    description: "+2 Elemental Damage. Shots burn targets.",
    baseCost: 24,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      addStat("elementalDamage", 2);
    }
  },
  {
    id: "fun_hat",
    name: "Fun Hat",
    badge: "K",
    description: "+16 Luck.",
    baseCost: 40,
    tier: 3,
    loadoutType: "item",
    apply: () => {
      addStat("luck", 16);
    }
  },
  {
    id: "flint_steel",
    name: "Flint & Steel",
    badge: "Z",
    description: "+4 Elemental Damage. Sparks fly with every burn.",
    baseCost: 38,
    tier: 3,
    loadoutType: "item",
    apply: () => {
      addStat("elementalDamage", 4);
    }
  },
  {
    id: "useful_glasses",
    name: "Useful Glasses",
    badge: "L",
    description: "+80 Range. The frames have no lenses.",
    baseCost: 26,
    tier: 2,
    loadoutType: "item",
    apply: () => {
      addStat("range", 80);
    }
  },
  {
    id: "pet_alien",
    name: "Pet Alien",
    badge: "A",
    description: "+12 Max HP, +8 Luck, -6% Speed, +1 enemy per wave.",
    baseCost: 34,
    tier: 3,
    loadoutType: "item",
    apply: () => {
      addStat("maxHp", 12);
      addStat("luck", 8);
      addStat("speed", -6);
    }
  },
  {
    id: "glass_charm",
    name: "Glass Charm",
    badge: "G",
    description: "+18% Damage, -8 Max HP, -2 Armor.",
    baseCost: 42,
    tier: 3,
    loadoutType: "item",
    apply: () => {
      addStat("damagePercent", 18);
      addStat("maxHp", -8);
      addStat("armor", -2);
    }
  },
  {
    id: "slot_machine",
    name: "Slot Machine",
    badge: "$",
    description: "Unique. ONE spin, two big random effects. They might both be good. They might not. I know you want it.",
    baseCost: 90,
    tier: UNIQUE_TIER,
    unique: true,
    loadoutType: "item",
    apply: () => {}
  },
  {
    id: "extra_arm",
    name: "Extra Arm",
    badge: "V",
    description: "+1 weapon slot. Legendary-only.",
    baseCost: 140,
    tier: 5,
    loadoutType: "item",
    apply: () => {
      state.extraWeaponSlots += 1;
      addStat("damagePercent", 6);
    }
  },
  {
    id: "royal_whetstone",
    name: "Royal Whetstone",
    badge: "V",
    description: "A legendary damage item for expensive late shops.",
    baseCost: 125,
    tier: 5,
    loadoutType: "item",
    apply: () => {
      addStat("damagePercent", 28);
      addStat("critChance", 8);
    }
  }
];

const upgradeProfiles = {
  spark_weapon: {
    lore: "A small seed tube built from scrap metal and garden parts.",
    properties: "A reliable projectile weapon for steady single-target pressure. It fires seed shots from range and benefits most from Ranged Damage, Damage %, Attack Speed, and extra projectiles.",
    stats: ["Adds Spark Peashooter", "+1 Ranged Damage"]
  },
  twig_wand: {
    lore: "A sturdy twig taken from a garden and wrapped with wire.",
    properties: "A slower projectile weapon with burn damage after impact. It is best when you want enemies to keep taking damage while you move away.",
    stats: ["Adds Twig Wand", "+1 Elemental Damage", "Burn is carried by your bullets"]
  },
  stub_club: {
    lore: "A short table-leg club with a taped handle.",
    properties: "A short melee swing weapon. It hits a small arc near the player, knocks enemies back, and scales strongly with Melee Damage.",
    stats: ["Adds Stub Club", "+1 Melee Damage", "Raises weapon tier power"]
  },
  rusty_pistol: {
    lore: "An old sidearm patched with garden wire and a mismatched grip.",
    properties: "A quick projectile weapon with clean straight shots. It is stronger than the starter peashooter per hit, but has less natural crowd control.",
    stats: ["Adds Rusty Pistol", "+1 Ranged Damage"]
  },
  forked_slingshot: {
    lore: "A forked branch, rubber strip, and pouch of smooth stones.",
    properties: "Fires slower stones with heavy knockback and better crit chance. Good for holding small enemies back while you reposition.",
    stats: ["Adds Slingshot", "+1 Ranged Damage", "+1% Crit Chance"]
  },
  scrap_revolver: {
    lore: "A bulky revolver rebuilt from workshop scraps and a stubborn cylinder.",
    properties: "A slower, harder-hitting ranged weapon with strong crit scaling and light pierce at higher ranks.",
    stats: ["Adds Scrap Revolver", "+2 Ranged Damage", "+2% Crit Chance"]
  },
  flamethrower: {
    lore: "A tin fuel tank, hose, and pilot flame strapped together with worrying confidence.",
    properties: "A short-range legendary elemental weapon. It sprays burning flame puffs that pierce crowds and leave burn damage behind.",
    stats: ["Adds Tin Dragon Flamethrower", "+3 Elemental Damage", "+4% Damage"]
  },
  grenade_launcher: {
    lore: "A chunky tube launcher made from crate hinges and a scavenged firing pin.",
    properties: "Launches slow grenades that explode in an area. It belongs in mid and late game shops, not the starter weapon pool.",
    stats: ["Adds Grenade Launcher", "+1 Ranged Damage", "Explodes in an area", "Mid-game weapon"]
  },
  potato_masher: {
    lore: "A dense mash-tool head bolted to a scrap-pipe handle.",
    properties: "A heavy melee club with a slow swing but massive knockback and top-tier Melee Damage scaling. It hits far harder than Stub Club, but leaves you exposed between swings.",
    stats: ["Adds Potato Masher", "+2 Melee Damage", "Very high knockback"]
  },
  seed_shotgun: {
    lore: "A stubby launcher tube packed tight with dried garden seeds.",
    properties: "Fires a wide spread of seeds that devastates enemies at point-blank range but falls off hard at distance. Best used to clear tight crowds pressed against you.",
    stats: ["Adds Seed Shotgun", "+2 Ranged Damage", "Wide spread, short range", "Damage drops off fast at range"]
  },
  thorn_lasher: {
    lore: "A braided vine whip studded with sharpened thorns.",
    properties: "A melee whip with far longer reach than any other close-range weapon. Its thorns tear a bleeding wound that keeps draining health after the hit lands.",
    stats: ["Adds Thorn Lasher", "+2 Melee Damage", "Longest melee range", "Applies Bleed"]
  },
  frost_bow: {
    lore: "A crossbow carved from cold ironwood, its string frosted over.",
    properties: "A slow-firing ranged weapon that chills whatever it hits, dulling their advance. The only weapon in the game built around crowd control instead of raw damage.",
    stats: ["Adds Frost Bow", "+2 Ranged Damage", "Slows enemies on hit", "Slow fire rate"]
  },
  shuriken: {
    lore: "A flat little throwing star stamped out of scrap tin.",
    properties: "Thrown rather than fired. It pierces through a few enemies, then boomerangs back to your hand and damages them again on the return trip. Range matters more than usual, since a longer throw sweeps more of the arena on both passes.",
    stats: ["Adds Shuriken", "+1 Ranged Damage", "+2% Crit Chance", "Pierces, then returns", "Hits again on the way back"]
  },
  damage: {
    lore: "A pouch of extra-hot spark dust with a warning label drawn in crayon.",
    properties: "Raises final damage after flat weapon scaling is calculated. This improves projectile hits, melee swings, burn ticks, electric zaps, and most damage effects.",
    stats: ["+8% Damage"]
  },
  speed: {
    lore: "Tiny canvas sneakers with fat rubber soles and bright laces.",
    properties: "Increases movement speed. This helps you kite crowds, reach scrap before the wave ends, and step around large enemies before they connect.",
    stats: ["+8% Speed"]
  },
  rate: {
    lore: "A fidgety trigger spring pulled from an old toy blaster.",
    properties: "Shortens weapon cooldowns, so every equipped weapon attacks more often. Faster weapons also retarget destructibles sooner when no enemies are nearby.",
    stats: ["+12% Attack Speed"]
  },
  heart: {
    lore: "A warm lunchbox packed with bandages, snacks, and emergency courage.",
    properties: "Raises maximum health and gives an immediate heal. Strong early when enemy contact damage starts becoming risky.",
    stats: ["+10 Max HP", "Heal 18 HP"]
  },
  magnet: {
    lore: "A pocket magnet tied to a loop of string, still dusty from the floor.",
    properties: "Expands the pickup radius for scrap. It does not increase drop value, but it makes more scrap realistic to collect before time runs out.",
    stats: ["+40 Pickup Range"]
  },
  split: {
    lore: "A forked barrel hammered together on a kitchen counter.",
    properties: "Adds one projectile to projectile weapons, which improves coverage and crowd control. It is legendary, rare, and expensive because extra projectiles are one of the strongest scaling effects.",
    stats: ["+1 Projectile", "-5% Damage", "Legendary", "Very rare"]
  },
  range: {
    lore: "A long plastic straw taped straight enough to call it equipment.",
    properties: "Increases attack range for most ranged weapons and targeting range for destructibles. It helps weapons start firing sooner while you reposition.",
    stats: ["+55 Range"]
  },
  ranged: {
    lore: "A bent nail filed down until it looks almost intentional.",
    properties: "Adds flat damage to ranged-scaling weapons before Damage % is applied. Strongest on weapons with high Ranged Damage scaling.",
    stats: ["+2 Ranged Damage"]
  },
  regen: {
    lore: "A soft sprout wrapped in a clean bandage.",
    properties: "Restores health during waves while you are below max HP. It is steady safety, especially for slower characters that take chip damage.",
    stats: ["+2 HP Regen"]
  },
  lifesteal: {
    lore: "A red-striped straw connected to a small healing flask.",
    properties: "Gives damaging hits a chance to heal 1 HP. It works better with fast weapons, extra projectiles, and weapons that hit several enemies.",
    stats: ["+3% Life Steal"]
  },
  crit: {
    lore: "A sharpened tooth tied to the grip for luck.",
    properties: "Raises critical hit chance. Crits use each weapon's crit multiplier, so heavy weapons usually gain bigger burst from crits than light weapons.",
    stats: ["+5% Crit Chance"]
  },
  armor: {
    lore: "A solid gilded chestplate, polished and ready for a fight.",
    properties: "Reduces damage taken from enemy contact and enemy projectiles. Reliable, well-rounded protection that keeps you standing when the swarm closes in.",
    stats: ["+3 Armor"]
  },
  dodge: {
    lore: "Padded ankle boots with springy soles and a little too much bounce.",
    properties: "Adds a chance to completely ignore an incoming hit. Dodge is capped so it cannot replace health and armor forever.",
    stats: ["+4% Dodge"]
  },
  luck: {
    lore: "A bright button kept as a cheap lucky charm. It looks important enough.",
    properties: "Improves rare shop offers, body-part upgrades, crate reward rarity, and small scrap drop bonuses. It also gives a small shop price reduction.",
    stats: ["+10 Luck"]
  },
  harvesting: {
    lore: "A compost kit full of rich, weirdly cheerful soil.",
    properties: "Pays bonus scrap after each wave and grows slightly when it pays out. This is an economy stat: it is weaker in the moment, stronger if bought early.",
    stats: ["+6 Harvesting"]
  },
  coupon_leaf: {
    lore: "A pressed leaf with a shopkeeper's scribbled mark.",
    properties: "Reduces future shop prices. It is best before expensive waves because every later buy and reroll benefits from the discount.",
    stats: ["-6% Shop Prices"]
  },
  recycling_clamp: {
    lore: "A clamp that squeezes useful parts out of broken gear.",
    properties: "Raises scrap gained when recycling crate rewards and owned inventory items. Good when you often take scrap instead of keeping rewards.",
    stats: ["+12% Recycle Value", "Recycle rate caps at 75%"]
  },
  garden_shears: {
    lore: "Bright shears made for crate-hunting more than gardening.",
    properties: "Cuts trees in one hit, no matter how much HP they have. It also slightly increases damage and nudges crate rewards toward better rarity through Luck.",
    stats: ["Trees break in 1 hit", "+4 Luck", "+4% Damage"]
  },
  engineering: {
    lore: "A small toolbox charm with a battery and loose copper wire.",
    properties: "Adds periodic electric zaps against nearby enemies. Zaps are slower than weapon attacks, but now show a clear lightning bolt and leave a smoldering ash mark.",
    stats: ["+3 Engineering", "Zap Damage: 5 + Engineering x3", "Zap Cooldown: 4.25s - Engineering x0.07"]
  },
  melee: {
    lore: "Training gloves stuffed with stubborn padding.",
    properties: "Adds flat damage to melee-scaling weapons before Damage % is applied. It also improves the point-blank melee damage dealt when enemies crowd your body.",
    stats: ["+2 Melee Damage"]
  },
  elemental: {
    lore: "A dry seed wrapped with wire and a warm metal cap.",
    properties: "Adds flat damage to elemental-scaling weapons and increases burn damage. Strongest on weapons that keep enemies burning while you kite.",
    stats: ["+2 Elemental Damage"]
  },
  fun_hat: {
    lore: "A floppy party hat kept in a drawer for exactly this kind of occasion.",
    properties: "A stronger, pricier upgrade on the Lucky Button. Improves rare shop offers, body-part upgrades, crate reward rarity, and small scrap drop bonuses more than its cheaper cousin.",
    stats: ["+16 Luck"]
  },
  flint_steel: {
    lore: "A striking stone and a scrap of steel, still warm from the last spark.",
    properties: "A stronger, pricier upgrade on the Static Seed. Adds flat damage to elemental-scaling weapons and increases burn damage by more than the early-game version.",
    stats: ["+4 Elemental Damage"]
  },
  useful_glasses: {
    lore: "A sturdy pair of frames rescued from a junk drawer. The lenses fell out ages ago.",
    properties: "A stronger upgrade on the Long Straw. Increases attack range for most ranged weapons and targeting range for destructibles, even though the glasses themselves do nothing for your eyesight.",
    stats: ["+80 Range"]
  },
  pet_alien: {
    lore: "A bright little alien perched on your head, or eating your backpack. Possibly both.",
    properties: "Gives survivability and better luck at the cost of movement speed, and its noise pulls an extra enemy into every wave. The luck and the bigger crowd both mean more scrap, so it pays for itself if you can handle slower dodging.",
    stats: ["+12 Max HP", "+8 Luck", "-6% Speed", "+1 enemy per wave"]
  },
  glass_charm: {
    lore: "A shiny charm made from cracked glass and a very bad idea.",
    properties: "A risky damage item. It increases damage a lot, but lowers maximum health and armor, so mistakes hurt more.",
    stats: ["+18% Damage", "-8 Max HP", "-2 Armor"]
  },
  slot_machine: {
    lore: "I know you want it.",
    properties: "Unique item. You do not find out what it gives until you spin it, and you only ever get ONE spin. That spin rolls two large random effects, each independently a buff or a downside, so you can walk away with two big buffs, two big downsides, or one of each. There is no reroll. It cannot be recycled; throwing it away costs scrap.",
    stats: ["Unique", "ONE spin only, no rerolls", "Two large random effects, good or bad", "14 to 32 per effect", "Throw Away costs scrap"]
  },
  extra_arm: {
    lore: "A spare field arm with straps, buckles, and a surprisingly steady grip.",
    properties: "Adds one more weapon slot. This is legendary-only, very expensive, and rare enough that seeing it should feel like a major run moment.",
    stats: ["+1 Weapon Slot", "+6% Damage", "Appears only as Legendary"]
  },
  royal_whetstone: {
    lore: "A polished sharpening stone in a little orange velvet case.",
    properties: "A late-run legendary damage spike. It is expensive because it improves every weapon and makes crit builds sharper.",
    stats: ["+28% Damage", "+8% Crit Chance", "Appears only as Legendary"]
  }
};

const weaponProfiles = {
  "Spark Peashooter": {
    lore: "A seed-spitter made from a tube, tape, and garden scrap.",
    properties: "Reliable projectile damage with good range and quick retargeting. It is cheap to fill weapon slots with and becomes much stronger when supported by Ranged Damage.",
    role: "Steady ranged damage",
    scaling: "Scales mainly with Ranged Damage, then Damage %, Attack Speed, Crit Chance, and extra projectiles.",
    attack: "Shoots seed projectiles from its own weapon position toward the nearest target."
  },
  "Twig Wand": {
    lore: "A crooked garden twig wrapped with wire and cloth.",
    properties: "A slower projectile weapon that adds burn pressure. It is useful when enemies survive the first hit because burn keeps working while you move.",
    role: "Burn and elemental pressure",
    scaling: "Scales mainly with Elemental Damage. Burn damage also uses Damage %, so general damage still matters.",
    attack: "Shoots ember seeds that apply burn for a few seconds after impact."
  },
  "Stub Club": {
    lore: "A blunt wooden club cut from a broken chair leg.",
    properties: "A close-range swing weapon with strong knockback and limited reach. It is better against enemies that get near you than enemies far across the arena.",
    role: "Close-range support",
    scaling: "Scales mainly with Melee Damage, then Damage %, Attack Speed, Crit Chance, and knockback value.",
    attack: "Swings in a short arc from its own weapon position toward the nearest target."
  },
  "Rusty Pistol": {
    lore: "An old sidearm patched with garden wire and a mismatched grip.",
    properties: "A quick straight-shot weapon with reliable single-target damage. It has less natural crowd control than the peashooter, but its bullets land fast.",
    role: "Fast ranged sidearm",
    scaling: "Scales mainly with Ranged Damage, then Damage %, Attack Speed, Crit Chance, and Range.",
    attack: "Fires compact brass bullets from the barrel with a short muzzle flash."
  },
  "Slingshot": {
    lore: "A forked branch, rubber strip, and pouch of smooth stones.",
    properties: "A slower ranged weapon with high knockback. It is good when you want to shove enemies away instead of only racing for DPS.",
    role: "Knockback control",
    scaling: "Scales with Ranged Damage, Damage %, Attack Speed, Crit Chance, and knockback.",
    attack: "Launches arcing stone shots that hit hard and push enemies back."
  },
  "Scrap Revolver": {
    lore: "A chunky six-shooter rebuilt from workshop scraps and a stubborn cylinder.",
    properties: "A slower, heavy ranged weapon with strong crit chance. It rewards flat Ranged Damage and Crit Chance more than spammy fire rate.",
    role: "Heavy crit pistol",
    scaling: "Scales mainly with Ranged Damage and Crit Chance, then Damage %, Attack Speed, and Range.",
    attack: "Fires heavy rounds with a bright flash and a long metal streak."
  },
  "Tin Dragon Flamethrower": {
    lore: "A tin fuel tank, hose, and pilot flame strapped together with worrying confidence.",
    properties: "A legendary short-range elemental weapon. It sprays flame puffs through crowds and keeps enemies burning after impact.",
    role: "Close-range crowd burn",
    scaling: "Scales mainly with Elemental Damage and Damage %, then Attack Speed and Range.",
    attack: "Sprays short-lived flame puffs that pierce enemies and apply burn."
  },
  "Grenade Launcher": {
    lore: "A chunky tube launcher made from crate hinges and a scavenged firing pin.",
    properties: "A slow explosive weapon for mid and late game. It is clunky at lower ranks, while legendary rank becomes a massive area-damage payoff.",
    role: "Explosive crowd clear",
    scaling: "Scales with Ranged Damage, Damage %, Crit Chance, Attack Speed, and explosion radius.",
    attack: "Launches a wobbling grenade that explodes on impact or when it reaches max range."
  },
  "Potato Masher": {
    lore: "A dense mash-tool head bolted to a scrap-pipe handle.",
    properties: "A heavy melee club, slower than Stub Club but hitting far harder with much stronger knockback. It rewards standing your ground and punishing whatever gets close.",
    role: "Heavy close-range bruiser",
    scaling: "Scales heavily with Melee Damage, then Damage %, Attack Speed, Crit Chance, and knockback value.",
    attack: "Swings a wide, slow arc from its own weapon position toward the nearest target."
  },
  "Seed Shotgun": {
    lore: "A stubby launcher tube packed tight with dried garden seeds.",
    properties: "A short-range spread weapon that shreds anything pressed against you but loses most of its bite at distance. Best paired with weapons that can handle far targets.",
    role: "Point-blank burst",
    scaling: "Scales mainly with Ranged Damage, then Damage %, Attack Speed, and Crit Chance.",
    attack: "Fires a wide spread of seed pellets from its own weapon position toward the nearest target."
  },
  "Thorn Lasher": {
    lore: "A braided vine whip studded with sharpened thorns.",
    properties: "A melee whip with unusually long reach for a close-range weapon. Its thorns leave a bleeding wound that keeps draining health after the strike lands.",
    role: "Long-reach bleed melee",
    scaling: "Scales mainly with Melee Damage, then Damage %, Attack Speed, and Crit Chance.",
    attack: "Lashes out in a long arc from its own weapon position toward the nearest target, applying bleed."
  },
  "Frost Bow": {
    lore: "A crossbow carved from cold ironwood, its string frosted over.",
    properties: "A slow-firing ranged weapon built around crowd control rather than raw damage. Its bolts chill enemies, slowing their approach so the rest of your kit can work.",
    role: "Movement control",
    scaling: "Scales mainly with Ranged Damage, then Damage %, Crit Chance, and Range.",
    attack: "Fires a single frost bolt from its own weapon position toward the nearest target, slowing it on hit."
  },
  "Shuriken": {
    lore: "A flat little throwing star stamped out of scrap tin.",
    properties: "Thrown, not fired. It pierces through enemies, and once it runs out of range or targets it loops back to your hand, cutting through everything a second time on the way. Each hit is light, but a good throw connects twice.",
    role: "Piercing boomerang",
    scaling: "Scales mainly with Ranged Damage and Crit Chance, then Damage %, Attack Speed and Range.",
    attack: "Throws the star itself, leaving your hand empty until it comes back. It sheds mini stars at the far end of its arc, then returns and can be thrown again."
  }
};

const weaponStatProfiles = {
  "Spark Peashooter": {
    attackType: "projectile",
    tags: ["Ranged", "Garden"],
    baseDamage: [7, 14, 27, 49, 84],
    scaling: { rangedDamage: 0.65 },
    cooldown: [0.74, 0.63, 0.54, 0.46, 0.38],
    range: [330, 355, 385, 420, 465],
    critChance: [3, 5, 7, 10, 14],
    critMultiplier: 1.75,
    knockback: [7, 9, 11, 13, 16],
    pierce: [0, 0, 1, 1, 2],
    projectileSpeed: [560, 590, 620, 660, 705],
    projectileRadius: 6,
    projectileScale: 1,
    spread: 0.13,
    damageFalloff: 0.68,
    color: "#73b7ff",
    impactColor: "#fff0a8"
  },
  "Twig Wand": {
    attackType: "projectile",
    tags: ["Elemental", "Garden"],
    baseDamage: [6, 11, 21, 38, 69],
    scaling: { elementalDamage: 0.75, rangedDamage: 0.16 },
    cooldown: [0.9, 0.76, 0.66, 0.56, 0.47],
    range: [350, 380, 410, 440, 480],
    critChance: [4, 6, 8, 11, 15],
    critMultiplier: 1.6,
    knockback: [4, 5, 6, 8, 10],
    pierce: [0, 1, 1, 2, 3],
    projectileSpeed: [500, 530, 560, 590, 630],
    projectileRadius: 5.5,
    projectileScale: 0.92,
    spread: 0.16,
    damageFalloff: 0.72,
    burnBase: [2.5, 5, 9.5, 17, 30],
    burnScaling: { elementalDamage: 0.45 },
    burnDuration: 2.8,
    color: "#ff9c5b",
    impactColor: "#ffcf5d"
  },
  "Stub Club": {
    attackType: "swing",
    tags: ["Melee", "Primitive"],
    baseDamage: [12, 22, 41, 73, 125],
    scaling: { meleeDamage: 0.9, rangedDamage: 0.12 },
    cooldown: [1.08, 0.9, 0.78, 0.66, 0.56],
    range: [56, 62, 68, 74, 82],
    critChance: [2, 4, 6, 8, 12],
    critMultiplier: 2,
    knockback: [22, 28, 36, 46, 60],
    pierce: [1, 2, 3, 4, 6],
    projectileSpeed: [390, 420, 455, 490, 530],
    projectileRadius: 10,
    projectileScale: 1.3,
    spread: 0.22,
    swingArc: [0.9, 0.98, 1.06, 1.14, 1.24],
    swingDuration: [0.14, 0.15, 0.16, 0.17, 0.18],
    damageFalloff: 0.82,
    color: "#f6d28f",
    impactColor: "#f6d28f"
  },
  "Rusty Pistol": {
    attackType: "projectile",
    tags: ["Ranged"],
    baseDamage: [9, 17, 32, 56, 95],
    scaling: { rangedDamage: 0.82 },
    cooldown: [0.62, 0.54, 0.47, 0.4, 0.33],
    range: [360, 385, 420, 455, 500],
    critChance: [4, 6, 9, 13, 18],
    critMultiplier: 1.85,
    knockback: [6, 8, 10, 12, 15],
    pierce: [0, 0, 0, 1, 2],
    projectileSpeed: [690, 730, 770, 820, 890],
    projectileRadius: 4.5,
    projectileScale: 1,
    spread: 0.08,
    damageFalloff: 0.76,
    color: "#d8dde8",
    impactColor: "#ffd15f"
  },
  "Slingshot": {
    attackType: "projectile",
    tags: ["Ranged", "Primitive"],
    baseDamage: [11, 21, 39, 67, 112],
    scaling: { rangedDamage: 0.92 },
    cooldown: [0.96, 0.84, 0.72, 0.62, 0.52],
    range: [335, 360, 390, 425, 470],
    critChance: [7, 10, 14, 19, 26],
    critMultiplier: 1.9,
    knockback: [18, 24, 32, 42, 58],
    pierce: [0, 0, 1, 1, 2],
    projectileSpeed: [500, 535, 570, 610, 660],
    projectileRadius: 7.5,
    projectileScale: 1,
    spread: 0.12,
    damageFalloff: 0.7,
    color: "#8c6a4a",
    impactColor: "#d7a363"
  },
  "Scrap Revolver": {
    attackType: "projectile",
    tags: ["Ranged"],
    baseDamage: [16, 31, 58, 102, 171],
    scaling: { rangedDamage: 1.18 },
    cooldown: [1.08, 0.95, 0.82, 0.7, 0.58],
    range: [390, 420, 455, 500, 555],
    critChance: [10, 14, 19, 26, 34],
    critMultiplier: 2.15,
    knockback: [11, 15, 20, 26, 35],
    pierce: [0, 1, 1, 2, 3],
    projectileSpeed: [740, 785, 830, 890, 960],
    projectileRadius: 5.4,
    projectileScale: 1.08,
    spread: 0.06,
    damageFalloff: 0.82,
    color: "#f2c45f",
    impactColor: "#fff0a6"
  },
  "Tin Dragon Flamethrower": {
    attackType: "projectile",
    tags: ["Elemental"],
    baseDamage: [7, 13, 24, 43, 80],
    scaling: { elementalDamage: 0.62, rangedDamage: 0.12 },
    cooldown: [0.24, 0.21, 0.18, 0.15, 0.12],
    range: [185, 210, 240, 275, 330],
    critChance: [1, 2, 3, 5, 8],
    critMultiplier: 1.35,
    knockback: [2, 3, 4, 5, 7],
    pierce: [2, 3, 4, 5, 8],
    projectiles: 2,
    projectileSpeed: [315, 340, 365, 390, 430],
    projectileRadius: 10,
    projectileScale: 1,
    spread: 0.18,
    damageFalloff: 0.9,
    burnBase: [7, 12, 20, 34, 58],
    burnScaling: { elementalDamage: 0.75 },
    burnDuration: 2.4,
    color: "#ff7d3d",
    impactColor: "#ffcf5d"
  },
  "Grenade Launcher": {
    attackType: "projectile",
    tags: ["Ranged", "Explosive"],
    baseDamage: [5, 13, 35, 81, 194],
    scaling: { rangedDamage: 0.42 },
    cooldown: [3.2, 2.75, 2.25, 1.75, 1.2],
    range: [295, 330, 375, 430, 540],
    critChance: [1, 3, 6, 10, 18],
    critMultiplier: 2.2,
    knockback: [18, 26, 38, 56, 88],
    pierce: [0, 0, 0, 0, 0],
    projectileSpeed: [285, 315, 350, 390, 460],
    projectileRadius: 8.5,
    projectileScale: 1,
    spread: 0.08,
    damageFalloff: 1,
    explosionRadius: [44, 58, 76, 98, 135],
    explosionDamageMultiplier: [0.6, 0.75, 0.9, 1.1, 1.35],
    color: "#7d4f34",
    impactColor: "#ff9c3d"
  },
  "Potato Masher": {
    attackType: "swing",
    tags: ["Melee", "Primitive"],
    baseDamage: [17, 31, 58, 104, 175],
    scaling: { meleeDamage: 1.15, rangedDamage: 0.1 },
    cooldown: [1.35, 1.14, 0.98, 0.84, 0.71],
    range: [58, 64, 70, 77, 85],
    critChance: [2, 4, 6, 8, 12],
    critMultiplier: 2.05,
    knockback: [34, 44, 56, 72, 94],
    pierce: [1, 2, 3, 4, 6],
    projectileSpeed: [390, 420, 455, 490, 530],
    projectileRadius: 12,
    projectileScale: 1.5,
    spread: 0.22,
    swingArc: [0.95, 1.03, 1.11, 1.2, 1.3],
    swingDuration: [0.18, 0.19, 0.2, 0.21, 0.22],
    damageFalloff: 0.85,
    color: "#c98f4f",
    impactColor: "#f6d28f"
  },
  "Seed Shotgun": {
    attackType: "projectile",
    tags: ["Ranged", "Garden"],
    baseDamage: [10, 18, 35, 60, 104],
    scaling: { rangedDamage: 0.7 },
    cooldown: [0.82, 0.71, 0.61, 0.52, 0.44],
    range: [175, 195, 220, 250, 285],
    critChance: [3, 5, 8, 11, 15],
    critMultiplier: 1.8,
    knockback: [10, 13, 16, 20, 25],
    pierce: [0, 1, 1, 2, 2],
    // No true multi-pellet field is fired per shot beyond `projectiles` (which is reserved
    // here for the player's own +projectile item stacking). The "spread of pellets" concept
    // is approximated with a very wide `spread` value plus aggressive `damageFalloff` and a
    // short `range`, so it reads as a shotgun (strong up close, weak far away) without the
    // engine actually simulating separate pellets.
    projectileSpeed: [520, 550, 585, 625, 670],
    projectileRadius: 6,
    projectileScale: 0.85,
    spread: 0.55,
    damageFalloff: 0.4,
    color: "#8fbf5a",
    impactColor: "#d7e79a"
  },
  "Thorn Lasher": {
    attackType: "swing",
    tags: ["Melee", "Garden"],
    baseDamage: [11, 21, 39, 69, 119],
    scaling: { meleeDamage: 0.85, rangedDamage: 0.1 },
    cooldown: [1.0, 0.86, 0.74, 0.63, 0.53],
    // Much longer reach than any other melee weapon (Stub Club tops out at 82, Potato
    // Masher at 85) to sell the "whip" concept.
    range: [140, 155, 172, 190, 212],
    critChance: [3, 5, 7, 10, 14],
    critMultiplier: 1.9,
    knockback: [8, 10, 13, 16, 20],
    pierce: [1, 2, 2, 3, 4],
    projectileSpeed: [420, 450, 485, 520, 560],
    projectileRadius: 8,
    projectileScale: 1.1,
    spread: 0.18,
    swingArc: [1.0, 1.08, 1.16, 1.25, 1.35],
    swingDuration: [0.16, 0.17, 0.18, 0.19, 0.2],
    damageFalloff: 0.78,
    // Bleed is implemented as a burn-style DoT clone: the engine (js/07-combat.js,
    // weaponBurnDps / enemy.burnDps / enemy.burnTime) only has one DoT channel, "burn",
    // with no separate bleed state. So Thorn Lasher reuses the exact burnBase/burnScaling/
    // burnDuration fields that Twig Wand and Tin Dragon Flamethrower use — it is
    // mechanically identical to burn, just reskinned as "Bleed" in name/color/lore.
    burnBase: [3, 6, 11, 19, 33],
    burnScaling: { meleeDamage: 0.35 },
    burnDuration: 3,
    color: "#8a3f4f",
    impactColor: "#c95a6a"
  },
  "Frost Bow": {
    attackType: "projectile",
    tags: ["Ranged"],
    baseDamage: [11, 21, 38, 66, 110],
    scaling: { rangedDamage: 0.7 },
    // Deliberately slow fire rate: this weapon's value is crowd control, not DPS.
    cooldown: [1.6, 1.4, 1.22, 1.05, 0.9],
    range: [400, 430, 465, 505, 555],
    critChance: [4, 6, 9, 13, 18],
    critMultiplier: 1.85,
    knockback: [9, 11, 14, 17, 21],
    pierce: [0, 1, 1, 2, 3],
    projectileSpeed: [620, 655, 690, 735, 790],
    projectileRadius: 5,
    projectileScale: 1,
    spread: 0.05,
    damageFalloff: 0.78,
    // Data-only fields for the slow effect: this weapon's actual slow logic (applying
    // slowFactor/slowDuration to an enemy on hit) lives in combat code owned by another
    // agent. These two arrays are just the balance numbers for that agent to read; no
    // slow behavior is implemented by adding them here.
    slowFactor: [0.82, 0.78, 0.74, 0.7, 0.64],
    slowDuration: [1.0, 1.2, 1.4, 1.6, 2.0],
    color: "#7fd8ff",
    impactColor: "#e3f8ff"
  },
  "Shuriken": {
    attackType: "projectile",
    // Thrown, not fired: it flies out, pierces, then boomerangs back to the player's hand,
    // damaging enemies again on the way home (see updateReturningBullet in 07-combat.js).
    returns: true,
    tags: ["Ranged"],
    baseDamage: [5, 9, 16, 29, 51],
    scaling: { rangedDamage: 0.5 },
    // Slower than a normal projectile weapon of this tier on purpose: each throw now gets
    // TWO damage passes over the same enemies (outbound + return), so the old 0.4-0.22
    // cadence would have roughly doubled its real output. The cooldown also has to cover the
    // round trip, or a second shuriken leaves before the first is caught.
    cooldown: [0.62, 0.55, 0.48, 0.42, 0.36],
    range: [300, 325, 355, 390, 430],
    critChance: [8, 12, 16, 21, 28],
    critMultiplier: 1.8,
    knockback: [3, 4, 5, 6, 8],
    pierce: [1, 2, 2, 3, 4],
    projectileSpeed: [640, 675, 715, 760, 815],
    projectileRadius: 4,
    projectileScale: 0.8,
    spread: 0.1,
    damageFalloff: 0.7,
    color: "#c8c8d8",
    impactColor: "#f0f0ff"
  }
};

const weaponClassBonuses = {
  Ranged: { stat: "rangedDamage", amounts: [0, 1, 3, 6] },
  Elemental: { stat: "elementalDamage", amounts: [0, 1, 3, 6] },
  Melee: { stat: "meleeDamage", amounts: [0, 1, 3, 6] },
  Garden: { stat: "harvesting", amounts: [0, 3, 8, 15] },
  Primitive: { stat: "maxHp", amounts: [0, 3, 8, 15] }
};
