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
  "item:fortune_cookie": "assets/items/fortune_cookie.png",
  "item:fun_hat": "assets/items/fun_hat.png",
  "item:flint_steel": "assets/items/flint_steel.png",
  "item:useful_glasses": "assets/items/useful_glasses.png",

  // Weapon shop-card icons, keyed by upgrade id (underscore filenames).
  "item:flamethrower": "assets/items/flamethrower.png",
  "item:forked_slingshot": "assets/items/forked_slingshot.png",
  "item:grenade_launcher": "assets/items/grenade_launcher.png",
  "item:rusty_pistol": "assets/items/rusty_pistol.png",
  "item:scrap_revolver": "assets/items/scrap_revolver.png",
  "item:spark_weapon": "assets/items/spark_weapon.png",
  "item:stub_club": "assets/items/stub_club.png",
  "item:twig_wand": "assets/items/twig_wand.png",
  "item:potato_masher": "assets/items/potato_masher.png",
  "item:seed_shotgun": "assets/items/seed_shotgun.png",
  "item:thorn_lasher": "assets/items/thorn_lasher.png",
  "item:frost_bow": "assets/items/frost_bow.png",
  "item:shuriken": "assets/items/shuriken.png",

  // Weapons by display name. itemArt() prefers these over the item: key above, so a
  // weapon's card uses this art. EVERY weapon now points at an improved tile-less cutout in
  // assets/items/<id>.png. The original hyphen-named sprites they replaced are archived in
  // "assets/Old assets/" and are no longer loaded by anything -- this table is the single
  // source of truth for which files the game actually uses.
  "weapon:Spark Peashooter": "assets/items/spark_weapon.png",
  "weapon:Twig Wand": "assets/items/twig_wand.png",
  "weapon:Stub Club": "assets/items/stub_club.png",
  "weapon:Rusty Pistol": "assets/items/rusty_pistol.png",
  "weapon:Slingshot": "assets/items/forked_slingshot.png",
  "weapon:Scrap Revolver": "assets/items/scrap_revolver.png",
  "weapon:Tin Dragon Flamethrower": "assets/items/flamethrower.png",
  "weapon:Grenade Launcher": "assets/items/grenade_launcher.png",
  "weapon:Potato Masher": "assets/items/potato_masher.png",
  "weapon:Seed Shotgun": "assets/items/seed_shotgun.png",
  "weapon:Thorn Lasher": "assets/items/thorn_lasher.png",
  "weapon:Frost Bow": "assets/items/frost_bow.png",
  "weapon:Shuriken": "assets/items/shuriken.png",

  "mutation:eye": "assets/mutations/steady_eye.png",
  "mutation:reinforced heart": "assets/mutations/heart_reinforced.png",
  "mutation:steady heartbeat": "assets/mutations/heart_steady.png",
  "mutation:veins": "assets/mutations/veins.png",
  "mutation:muscles": "assets/mutations/muscles.png",
  "mutation:hands": "assets/mutations/hands.png",
  "mutation:nerves": "assets/mutations/nerves.png",
  "mutation:tendons": "assets/mutations/tendons.png",
  "mutation:brain": "assets/mutations/brain.png",
  "mutation:fingers": "assets/mutations/fingers.png",
  "mutation:arms": "assets/mutations/arms.png",
  "mutation:skin": "assets/mutations/skin.png",
  "mutation:ankles": "assets/mutations/ankles.png",
  "mutation:legs": "assets/mutations/legs.png",
  "mutation:mole": "assets/mutations/mole.png",
  "mutation:thumb": "assets/mutations/thumb.png",

  // Player characters - drawn as the player body in-arena and in the select/preview.
  "character:sprout": "assets/characters/sprout.png",
  "character:chunk": "assets/characters/chunk.png",
  "character:zip": "assets/characters/zip.png",

  // Environment objects drawn in the arena.
  "env:crate": "assets/environment/crate.png",
  "env:crate_broken": "assets/environment/crate_broken.png",
  "env:bush": "assets/environment/bush.png",
  "env:apple": "assets/environment/apple.png",
  // Seamlessly tileable arena floor, drawn under everything else (see drawArena).
  "env:ground": "assets/environment/arena_ground.png",
  // Two frames of the same bin. Cropped so the BODY is identically sized and sits on the
  // same baseline in both, with the open frame's lid overhanging upward, so swapping frames
  // animates the lid instead of making the whole bin jump.
  "env:scrap_bin": "assets/environment/scrap_bin_closed.png",
  "env:scrap_bin_open": "assets/environment/scrap_bin_open.png",

  // Enemies - drawn in the arena as the creature body. Overlays (health bar, hit
  // flash, burn, buff aura, wind-up telegraph) are still drawn by the game on top.
  "enemy:Nibbler": "assets/enemies/nibbler.png",
  "enemy:Skitter": "assets/enemies/skitter.png",
  "enemy:Bruiser": "assets/enemies/bruiser.png",
  "enemy:Darter": "assets/enemies/darter.png",
  "enemy:Ember Glob": "assets/enemies/ember-glob.png",
  "enemy:Spitter": "assets/enemies/spitter.png",
  "enemy:Orbiter": "assets/enemies/orbiter.png",
  "enemy:Drummer": "assets/enemies/drummer.png",
  "enemy:Husk": "assets/enemies/husk.png",
  "enemy:Thistle": "assets/enemies/thistle.png",
  "enemy:Blight Sac": "assets/enemies/blight-sac.png",
  "enemy:Gravebloom": "assets/enemies/gravebloom.png",
  "enemy:Clown": "assets/enemies/clown.png",
  "enemy:Clown Mid": "assets/enemies/clown-mid.png",
  "enemy:Clown Small": "assets/enemies/clown-small.png",

  // BOSS SYSTEM -- Nibbler King. Reuses the regular Nibbler sprite, scaled way up (see
  // ENEMY_ART_CONFIG below), since there is no dedicated boss sprite yet. When real art
  // exists, point this at it (e.g. "assets/enemies/nibbler-king.png") -- everything else
  // (scale, crown/aura hook) keeps working unchanged. See the ART HOOK comment in
  // js/08-render.js (drawNibblerKingCrownAndAura) for the procedural crown/aura placeholder
  // that should be retired once real boss art (crown baked into the sprite, or its own aura
  // art) exists.
  "enemy:Nibbler King": "assets/enemies/nibbler.png",

  // UI chrome icons (buttons, placeholders).
  "ui:compendium": "assets/ui/compendium.png",
  "ui:gravestone": "assets/ui/gravestone.png"
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
  // Drummer sits on a bigger collision radius than the Bruiser (30 vs 28), so at the old
  // 2.1 scale it drew ~15% larger and read as the biggest thing on screen. The Bruiser is
  // meant to be the visual heavyweight, so the Drummer is scaled down under it here. Purely
  // cosmetic — scale never touches the hitbox.
  Drummer: { scale: 1.62, yOffset: -0.06 },        // drums flank the body

  // New cast. Gravebloom and Clown are big, but both stay under the Bruiser's effective
  // drawn size so the Bruiser remains the visual heavyweight (see ART_BRIEF.md).
  Husk: { scale: 1.85, yOffset: -0.05 },
  Thistle: { scale: 1.9, yOffset: -0.02 },          // rooted: sits low, on its base
  "Blight Sac": { scale: 2.0, yOffset: -0.07 },     // bloated, slightly overhangs
  Gravebloom: { scale: 1.72, yOffset: -0.1 },       // tall drooping flower head
  Clown: { scale: 1.78, yOffset: -0.06 },
  "Clown Mid": { scale: 1.9, yOffset: -0.05 },
  "Clown Small": { scale: 2.0, yOffset: -0.04 },

  // BOSS SYSTEM -- Nibbler King: the same nibbler.png art blown up to ~3.7x a normal
  // Nibbler's rendered size (normal Nibbler is scale 1.9 on a radius-16 body -> drawn size
  // ~30.4; boss is radius 52, so scale 4.0 here draws at 52*2*4.0=416, vs the normal
  // Nibbler's 16*2*1.9=60.8 -- a ~6.8x LINEAR size jump driven mostly by the bigger hitbox,
  // matching "massive". yOffset unchanged from the base Nibbler entry (no such entry exists
  // above; using the Bruiser-ish default feel) so the sprite still plants on its shadow.
  "Nibbler King": { scale: 4.0, yOffset: -0.05 }
};

// Enemies whose art faces the camera head-on and is left/right symmetric. These must NOT be
// horizontally flipped to "face" the player — mirroring a front-facing sprite is a no-op that
// only causes a jarring snap when the player crosses to the other side.
// Thistle is rooted and symmetric, Gravebloom is a front-facing flower, and the three
// clowns all stare straight at the camera — flipping any of them is a visual no-op that
// only produces a snap when the player crosses sides.
const ENEMY_NO_FLIP = new Set([
  "Bruiser",
  "Thistle",
  "Gravebloom",
  "Clown",
  "Clown Mid",
  "Clown Small"
]);

// The facing flip in drawEnemyArtBody assumes each sprite is drawn facing RIGHT. The Darter
// art is drawn facing LEFT (its fins trail right), so the flip ran backwards and it turned
// away from the player. List any left-facing art here instead of hand-patching the renderer.
const ENEMY_ART_FACES_LEFT = new Set(["Darter"]);

function enemyArtFacingSign(name) {
  return ENEMY_ART_FACES_LEFT.has(name) ? -1 : 1;
}

function enemyArt(name) {
  return artFor(`enemy:${name}`);
}

function characterArt(character) {
  return character && character.id ? artFor(`character:${character.id}`) : null;
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
// item:flint_steel is the one exception: its art is a deliberately photorealistic film
// still with an OPAQUE rectangular background (the joke). Drawing the engine's parchment
// tile behind it leaves a visible frame poking out around an opaque photo, which reads as
// a rendering bug rather than a gag, so it is treated as a full card and skips the tile.
const ART_FULL_CARD = new Set(["item:flint_steel"]);

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
  "weapon:Grenade Launcher",
  "weapon:Potato Masher",
  "weapon:Seed Shotgun",
  "weapon:Thorn Lasher",
  "weapon:Frost Bow",
  "weapon:Shuriken"
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
    const byName = data.name ? artFor(`mutation:${String(data.name).toLowerCase()}`) : null;
    return byName ?? artFor(`mutation:${String(data.part).toLowerCase()}`);
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
  if (data.part) {
    const nameKey = data.name ? `mutation:${String(data.name).toLowerCase()}` : null;
    return (nameKey && fullCard(nameKey)) || fullCard(`mutation:${String(data.part).toLowerCase()}`);
  }
  if (data.id) return fullCard(`item:${data.id}`) || (data.name && fullCard(`weapon:${data.name}`));
  if (data.name) return fullCard(`weapon:${data.name}`);
  return false;
}

function weaponArenaArt(name) {
  return ART_ARENA_WEAPON.has(`weapon:${name}`) ? artFor(`weapon:${name}`) : null;
}

// Normalised alpha bounding box (0..1 fractions of the PNG canvas) of each weapon's actual
// content, measured by hand so the arena/preview/title renderers can crop out the
// transparent padding instead of stretching it into a square. Without this, wide sprites
// (flamethrower, spark weapon) get squashed vertically ~1.5-1.8x to fill a square box.
const WEAPON_ARENA_FIT = {
  "weapon:Spark Peashooter": { x: 16 / 256, y: 53 / 256, w: 225 / 256, h: 147 / 256 },
  "weapon:Twig Wand": { x: 16 / 256, y: 26 / 256, w: 225 / 256, h: 203 / 256 },
  "weapon:Stub Club": { x: 56 / 512, y: 30 / 512, w: 399 / 512, h: 451 / 512 },
  "weapon:Rusty Pistol": { x: 16 / 256, y: 37 / 256, w: 224 / 256, h: 182 / 256 },
  "weapon:Slingshot": { x: 70 / 512, y: 27 / 512, w: 372 / 512, h: 458 / 512 },
  "weapon:Scrap Revolver": { x: 16 / 256, y: 34 / 256, w: 224 / 256, h: 187 / 256 },
  "weapon:Tin Dragon Flamethrower": { x: 15 / 256, y: 67 / 256, w: 225 / 256, h: 122 / 256 },
  "weapon:Grenade Launcher": { x: 30 / 512, y: 61 / 512, w: 451 / 512, h: 390 / 512 }
};

// Default to the full canvas for any weapon key without a measured bbox, so an
// unmeasured/new PNG still draws (uncropped) instead of throwing.
function weaponArenaFit(name) {
  return WEAPON_ARENA_FIT[`weapon:${name}`] ?? { x: 0, y: 0, w: 1, h: 1 };
}

// Shared aspect-correct weapon draw used by the arena, the Field Market loadout preview,
// and the title screen, so all three crop/scale identically instead of drifting out of
// sync. `boxSize` is the longest edge of the destination box (a CONTAIN fit): the content
// bbox is cropped from the source first, then scaled so its longer side equals boxSize and
// its shorter side follows the true aspect ratio, centered at the current origin. Draws
// with whatever transform (translate/rotate/scale) is already active on ctx.
// `anchorX` shifts the pivot along the weapon's own length as a fraction of the drawn
// width: 0 centres it (the orbiting/preview case), while a negative value swings the
// pivot toward the grip end so a melee swing rotates around the handle rather than the
// middle of the sprite.
function drawWeaponArtFitted(ctx, name, art, boxSize, anchorX = 0) {
  if (!art) return;
  const fit = weaponArenaFit(name);
  const sx = fit.x * art.width;
  const sy = fit.y * art.height;
  const sw = fit.w * art.width;
  const sh = fit.h * art.height;
  const longEdge = Math.max(sw, sh);
  const scale = boxSize / longEdge;
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(art, sx, sy, sw, sh, -dw / 2 + anchorX * dw, -dh / 2, dw, dh);
}

loadArt();
