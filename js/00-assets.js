"use strict";

// assets.js - loads redesigned PNG art and maps it onto items / weapons / mutations.
// Drop matching files into assets/ and they replace the code-drawn art everywhere.
// Anything without a file keeps falling back to the original canvas drawing, so the
// game always runs even with zero images present.

// key -> file path. Keys are matched in the draw routines:
//   item:<upgradeId>       an item/weapon shop upgrade by its id
//   weapon:<Weapon Name>   a weapon by its display name (arena + icon)
//   mutation:<part>        a body-part mutation by its part name (lowercased)
const ART_SOURCES = {
  // Items - one PNG per upgrade id. Filenames match the id exactly, so adding a new
  // item only needs assets/items/<id>.png plus a line here.
  "item:armor": "assets/items/armor.png",
  "item:coupon_leaf": "assets/items/coupon_leaf.png",
  "item:crit": "assets/items/crit.png",
  "item:damage": "assets/items/damage.png",
  "item:dodge": "assets/items/dodge.png",
  "item:elemental": "assets/items/elemental.png",
  "item:engineering": "assets/items/engineering.png",
  "item:extra_arm": "assets/items/extra_arm.png",
  "item:garden_shears": "assets/items/garden_shears.png",
  "item:glass_charm": "assets/items/glass_charm.png",
  "item:harvesting": "assets/items/harvesting.png",
  "item:heart": "assets/items/heart.png",
  "item:lifesteal": "assets/items/lifesteal.png",
  "item:luck": "assets/items/luck.png",
  "item:magnet": "assets/items/magnet.png",
  "item:melee": "assets/items/melee.png",
  "item:pet_alien": "assets/items/pet_alien.png",
  "item:range": "assets/items/range.png",
  "item:ranged": "assets/items/ranged.png",
  "item:rate": "assets/items/rate.png",
  "item:recycling_clamp": "assets/items/recycling_clamp.png",
  "item:regen": "assets/items/regen.png",
  "item:royal_whetstone": "assets/items/royal_whetstone.png",
  "item:slot_machine": "assets/items/slot_machine.png",
  "item:speed": "assets/items/speed.png",
  "item:split": "assets/items/split.png",

  // Weapon shop-card icons, keyed by upgrade id (underscore filenames).
  "item:flamethrower": "assets/items/flamethrower.png",
  "item:forked_slingshot": "assets/items/forked_slingshot.png",
  "item:grenade_launcher": "assets/items/grenade_launcher.png",
  "item:rusty_pistol": "assets/items/rusty_pistol.png",
  "item:scrap_revolver": "assets/items/scrap_revolver.png",
  "item:spark_weapon": "assets/items/spark_weapon.png",
  "item:stub_club": "assets/items/stub_club.png",
  "item:twig_wand": "assets/items/twig_wand.png",

  // Weapons by display name. itemArt() prefers these over the item: key above, so a
  // weapon's card uses this art. Note the exported weapon files use hyphens.
  // Weapons point at the improved detailed cutouts (assets/items/<id>.png) where one
  // exists, so the shop card + equipped slot show the good art. The 3 without an
  // improved image yet (Stub Club, Flamethrower, Grenade Launcher) keep the old
  // assets/weapons sprite until their art is redone.
  "weapon:Spark Peashooter": "assets/items/spark_weapon.png",
  "weapon:Twig Wand": "assets/items/twig_wand.png",
  "weapon:Stub Club": "assets/items/stub_club.png",
  "weapon:Rusty Pistol": "assets/items/rusty_pistol.png",
  "weapon:Slingshot": "assets/items/forked_slingshot.png",
  "weapon:Scrap Revolver": "assets/items/scrap_revolver.png",
  "weapon:Tin Dragon Flamethrower": "assets/items/flamethrower.png",
  "weapon:Grenade Launcher": "assets/items/grenade_launcher.png",

  "mutation:eye": "assets/mutations/steady_eye.png",

  // Environment objects drawn in the arena.
  "env:crate": "assets/environment/crate.png",
  "env:crate_broken": "assets/environment/crate_broken.png",

  // Enemies - drawn in the arena as the creature body. Overlays (health bar, hit
  // flash, burn, buff aura, wind-up telegraph) are still drawn by the game on top.
  "enemy:Nibbler": "assets/enemies/nibbler.png",
  "enemy:Skitter": "assets/enemies/skitter.png",
  "enemy:Bruiser": "assets/enemies/bruiser.png",
  "enemy:Darter": "assets/enemies/darter.png",
  "enemy:Ember Glob": "assets/enemies/ember-glob.png",
  "enemy:Spitter": "assets/enemies/spitter.png",
  "enemy:Orbiter": "assets/enemies/orbiter.png",
  "enemy:Drummer": "assets/enemies/drummer.png"
};

// Per-enemy art tuning. `scale` multiplies the drawn size relative to the enemy's
// collision radius, so art with lots of empty space or effects (flames, spikes) can
// visually overhang without changing hitboxes. `yOffset` nudges the sprite so the
// creature's mass sits on its shadow.
// Tuned down ~25% for the tightly-cropped slime sprites, which fill their canvas and so
// read much larger at a given scale than the older loosely-cropped art did.
const ENEMY_ART_CONFIG = {
  "Ember Glob": { scale: 2.15, yOffset: -0.12 },  // extra size for the flame plume
  Spitter: { scale: 2.0, yOffset: -0.08 },
  Bruiser: { scale: 1.95, yOffset: -0.06 },
  Nibbler: { scale: 1.9, yOffset: -0.05 },
  Skitter: { scale: 2.05, yOffset: -0.05 },       // legs overhang the body
  Darter: { scale: 2.0, yOffset: -0.06 },
  Orbiter: { scale: 2.0, yOffset: -0.05 },         // orbital ring overhangs
  Drummer: { scale: 2.1, yOffset: -0.08 }          // drums flank the body
};

// Enemies whose art faces the camera head-on and is left/right symmetric. These must NOT be
// horizontally flipped to "face" the player — mirroring a front-facing sprite is a no-op that
// only causes a jarring snap when the player crosses to the other side.
const ENEMY_NO_FLIP = new Set(["Bruiser"]);

function enemyArt(name) {
  return artFor(`enemy:${name}`);
}

function crateArt(broken) {
  return artFor(broken ? "env:crate_broken" : "env:crate");
}

function enemyArtConfig(name) {
  return ENEMY_ART_CONFIG[name] ?? { scale: 2.6, yOffset: -0.05 };
}

// Some art bakes the parchment tile + rank badge into the PNG. For those we skip the
// game's generated tile so there is no double frame. Weapon PNGs above are full cards
// too (they were exported with tiles), so they are card-style in menus.
// Verified by inspecting the PNG pixels: every item AND weapon export is a ~98%
// transparent cut-out sprite with no baked tile. Transparent sprites NEED the engine's
// parchment tile + rank badge drawn behind them, so nothing is full-card. (The four item
// keys that used to sit here were tuned for older baked-tile art these exports replaced.)
// mutation:eye has no export and falls back to code art.
const ART_FULL_CARD = new Set([]);

// Weapon art that is a full card tile does NOT read well spinning around the player in
// the arena, so those keep their code-drawn sprite in-world. List weapon keys here whose
// PNG is a tile-less transparent weapon and is safe to draw in the arena.
const ART_ARENA_WEAPON = new Set([
  // Improved tile-less weapon cutouts, safe to draw spinning in-arena.
  "weapon:Spark Peashooter",
  "weapon:Twig Wand",
  "weapon:Stub Club",
  "weapon:Rusty Pistol",
  "weapon:Slingshot",
  "weapon:Scrap Revolver",
  "weapon:Tin Dragon Flamethrower",
  "weapon:Grenade Launcher"
]);

// Per-weapon sprite rotation offset (radians) added on top of the aim rotation in-arena.
// IMPORTANT: this rotates the whole sprite AWAY from the aim direction, so any non-zero
// value makes the weapon visibly point off-target. Earlier per-weapon values (tuned by
// eye to "level" each art's diagonal pose) caused weapons to fire the wrong way when
// aiming anywhere but right — so they are all 0. The slight natural tilt of each art's
// pose is cosmetic and acceptable; the weapons aim correctly at their targets. Only set a
// value here if an art is drawn grossly sideways, and verify aim in all 4 directions.
const ARENA_WEAPON_ANGLE = {};

function arenaWeaponAngle(name) {
  return ARENA_WEAPON_ANGLE[name] ?? 0;
}

const artImages = {};

function loadArt() {
  for (const [key, src] of Object.entries(ART_SOURCES)) {
    const img = new Image();
    img.decoding = "async";
    img.dataset.key = key;
    img.addEventListener("load", () => {
      img.ready = true;
      // A card built before this image finished loading is showing code art; repaint
      // the open menu so the PNG takes over the moment it arrives.
      if (typeof onArtLoaded === "function") onArtLoaded(key);
    });
    img.addEventListener("error", () => {
      // Missing/failed file: behave exactly as if no art was declared for this key.
      img.ready = false;
      img.failed = true;
    });
    img.src = src;
    artImages[key] = img;
  }
}

function artFor(key) {
  const img = artImages[key];
  return img && img.ready ? img : null;
}

// True only when a source is declared AND has not permanently failed to load. Used to
// decide whether to route through the PNG renderer at all.
function artSourceUsable(key) {
  if (!ART_SOURCES[key]) return false;
  const img = artImages[key];
  return !img || !img.failed;
}

function itemArt(data = {}) {
  if (!data) return null;
  if (data.weaponName) {
    return artFor(`weapon:${data.weaponName}`) ?? artFor(`item:${data.id}`);
  }
  if (data.part) {
    return artFor(`mutation:${String(data.part).toLowerCase()}`);
  }
  if (data.id) {
    return artFor(`item:${data.id}`) ?? (data.name ? artFor(`weapon:${data.name}`) : null);
  }
  if (data.name) {
    return artFor(`weapon:${data.name}`);
  }
  return null;
}

// Full-card only counts when the source is also usable (declared + not failed), so a
// missing file never hides the game's own tile/badge.
function fullCard(key) {
  return ART_FULL_CARD.has(key) && artSourceUsable(key);
}

function itemArtIsFullCard(data = {}) {
  if (!data) return false;
  if (data.weaponName) return fullCard(`weapon:${data.weaponName}`) || fullCard(`item:${data.id}`);
  if (data.part) return fullCard(`mutation:${String(data.part).toLowerCase()}`);
  if (data.id) return fullCard(`item:${data.id}`) || (data.name && fullCard(`weapon:${data.name}`));
  if (data.name) return fullCard(`weapon:${data.name}`);
  return false;
}

function weaponArenaArt(name) {
  return ART_ARENA_WEAPON.has(`weapon:${name}`) ? artFor(`weapon:${name}`) : null;
}

loadArt();
