"use strict";

// changelog.js - the version number and patch notes shown on the title screen.
//
// HOW TO UPDATE (do this on EVERY commit):
//   1. Bump GAME_VERSION below.
//   2. Add a new entry at the TOP of CHANGELOG with the same version string.
// The title screen reads GAME_VERSION straight from the first changelog entry's version,
// so the badge and the notes can never disagree.
//
// IMPORTANT: index.html appends ?v=<version> to every script/stylesheet tag. GitHub Pages
// serves JS with Cache-Control: max-age=600, so WITHOUT that query string a returning
// player keeps running old code for 10 minutes after a deploy (this bit us: index.html
// updated while 08-render.js stayed stale, so new art silently never appeared). Bump the
// ?v= in index.html to match whenever you bump GAME_VERSION.
//
// Versioning: 0.MINOR.PATCH while pre-1.0.
//   PATCH - fixes, tuning, art swaps.
//   MINOR - new systems, content or screens.

const CHANGELOG = [
  {
    version: "0.12.0",
    date: "2026-08-07",
    title: "New things to fight, and new things to fight them with",
    notes: [
      "Five new enemies join the arena.",
      "Husk splits into two Nibblers when it dies, so clearing it is never quite the end of it.",
      "Thistle takes root inside the arena and warns you in red before it starts firing.",
      "Blight Sac bursts into a lingering poison pool. Do not stand in it.",
      "Gravebloom summons reinforcements, but hitting it hard enough interrupts the summon.",
      "Clown implodes into smaller clowns, twice over. Seven of them, all told.",
      "Five new weapons: Potato Masher, Seed Shotgun, Thorn Lasher, Frost Bow and Shuriken.",
      "Frost Bow slows what it hits, which is the only way to buy yourself space.",
      "Three new items: Fun Hat, Flint and Steel, and the famously lensless Useful Glasses.",
      "Every new enemy moves in its own way, from the Husk's dry rattle to the Clown's manic bounce.",
      "Weapons animate when they fire. The slingshot snaps, the Frost Bow re-cocks, the shotgun lurches.",
      "Weapons hit slightly harder across the board, and shop prices went up to match.",
      "Late game enemy health still compounds, just more slowly, instead of flattening out.",
      "Spitter shots travel slower, so they are easier to see coming and step around.",
      "Around 15% fewer Spitters and Ember Globs. Waves are the same size, just less ranged fire.",
      "Big performance fix: late waves with hundreds of enemies no longer chug.",
      "Another one: the Drummer's buff links were eating a whole frame on their own in big crowds.",
      "You are no longer shoved around when something hits you. Where you stand is entirely your call.",
      "Poison finally hurts. Blight Sac pools and touch poison were being reduced to almost nothing by armour and invulnerability frames.",
      "Standing in a poison pool is no longer shrugged off just because something else hit you a moment earlier.",
      "The compendium opens in the top right instead of blacking out the whole screen, so you can still see your loadout.",
      "Shrank the Flint and Steel card art, which was covering its own text.",
      "The Monster Compendium is open for business. Every enemy gets a full field entry with art, stats and field notes.",
      "Entries unlock the first time you meet a creature, and the book remembers what you have found between runs.",
      "Ember Glob fireballs set you alight properly. The burn now grows with the wave instead of ticking for a flat 3 forever.",
      "The Husk now bursts into three Nibblers instead of two, so killing one really does make things worse.",
      "The Thistle is a lot sturdier. It is a woody, rooted plant that cannot dodge, so it should take some clearing.",
      "Touching a Blight Sac now poisons you, not just standing in the pool it leaves behind.",
      "Every enemy projectile looks different now. The Thistle fires a spinning green thorn instead of reusing the Spitter's glob.",
      "Time machine: the patch notes now have Play buttons that launch older builds of the game, art and all.",
      "Enemies now push each other apart instead of piling into the same spot, so a crowd looks and behaves like a crowd of bodies.",
      "Big enemies shoulder through the swarm; small ones get jostled aside.",
      "Getting shot at makes sense now. Bullets that hit you during your brief invulnerability are no longer swallowed whole.",
      "A wall of incoming fire costs you several hits instead of one, but still cannot delete you in an instant.",
      "The shop is far less repetitive. Items you have not been offered in a while push their way to the front.",
      "Rare items actually turn up now. The Tin Dragon Flamethrower could previously go an entire run without ever appearing.",
      "Luck matters much more for what the shop offers you.",
      "The Slot Machine gets ONE spin, ever. No rerolls, so the result is the result.",
      "Its effects are about three times bigger to match. A good spin can carry a run, a bad one really hurts.",
      "The reels now actually spin and land one at a time before showing you the damage.",
      "More performance work: the Drummer buff links were still eating a huge chunk of every frame in big crowds.",
      "The Shuriken is now really thrown. Your hand is empty while it is in the air, and it cannot be thrown again until you catch it.",
      "It also sheds mini stars at the far end of its arc. Extra projectiles add more of those instead of duplicating the weapon.",
      "The scrap count now looks like a brass plate riveted to the bin instead of a sticker floating on it.",
      "Moved the compendium button to the top right, under the scrap counter.",
      "The arena has a real ground texture now instead of a flat gradient.",
      "New scrap bin art, and its lid actually opens when you bag your leftover scrap.",
      "Nimble Socks are now Nimble Boots, which is what they were always drawn as.",
      "Waves 2 and 3 are a lot busier, so the opening is less of a slow crawl.",
      "That means more scrap early, and a real build by the time wave 4 arrives. Every other wave is untouched.",
      "The Slot Machine is a real gamble now. You do not know what it does until you spin it.",
      "Every spin rolls two effects, and each one can be good or bad. Spin again, or pay to throw it away.",
      "The Shuriken is thrown instead of fired. It pierces, then loops back to your hand, cutting through everything again on the way."
    ]
  },
  {
    version: "0.11.1",
    date: "2026-08-07",
    title: "Updates show up, and the run stays winnable",
    notes: [
      "Fixed the game serving stale code after an update, so new art and fixes appear right away.",
      "The berry bush and health apple are now actually visible.",
      "Enemy health grows far more slowly, and stops compounding entirely in the late game.",
      "Late waves no longer outrun a maxed-out build. The swarm gets bigger instead of spongier.",
      "Cleaned up the character portrait in the Field Market.",
      "The shop now shows only your current build. Run totals moved to the end-of-run summary."
    ]
  },
  {
    version: "0.11.0",
    date: "2026-08-07",
    title: "Carve through the swarm",
    notes: [
      "Enemies die faster. For more dopamine, obviously.",
      "Way more of them, too: roughly triple the spawn rate, and the arena holds far more at once.",
      "Nibblers, Skitters and Orbiters now make up the bulk of a wave.",
      "Bruisers are leaner but shrug off knockback, so they still plant their feet and walk at you.",
      "Bruisers drop a lot more scrap, since killing one is a real commitment.",
      "New art: seven enemies, five weapons and three items are drawn and ready to be built.",
      "New berry bush and health apple sprites in the arena.",
      "Bigger character portrait in the shop, and Items is now a proper Inventory of icons.",
      "Hover over any inventory item to see what it is.",
      "Melee weapons stop standing idle and break nearby crates when no enemy is in reach.",
      "Every wave now has at least three bushes.",
      "Cleaned the leftover glow and drop shadows off the older weapon art."
    ]
  },
  {
    version: "0.10.1",
    date: "2026-08-07",
    title: "Character fixes & title screen revamp",
    notes: [
      "Fixed the character descriptions. Zip is a fast, lucky scavenger, not a heavy hitter.",
      "Zip leans further into what it is actually good at: more speed, more luck.",
      "Title screen revamp: the little blobs crowding the potato are gone.",
      "Slimes now have the run of the whole screen, and there is room for a LOT of them.",
      "Rapid clicking now spreads shots across different targets instead of stacking them."
    ]
  },
  {
    version: "0.10.0",
    date: "2026-08-06",
    title: "Readme refresh",
    notes: [
      "Rewrote the readme with a proper rundown of how the game actually plays."
    ]
  },
  {
    version: "0.9.0",
    date: "2026-08-06",
    title: "Balance, stats & the send-off",
    notes: [
      "Enemy health now compounds every wave, so late runs stop being a walkover.",
      "Bruiser is the toughest enemy again, with the highest health AND the highest damage.",
      "Drummer shrunk so the Bruiser reads as the heavyweight.",
      "New Damage Taken breakdown on the run summary, plus 11 more stats in the shop.",
      "Fortune cookie: a rare 1% drop from any enemy (its effect is still a secret).",
      "Death and Quit now get a bong and a gravestone. You even leave a headstone behind.",
      "Title screen: enemies roam it, and the potato pulses when clicked.",
      "Added a very secret easter egg...",
      "Actually, make that two secret easter eggs...",
      "Slimes now drift across the whole title screen instead of hugging the potato.",
      "Every shop price rebuilt so stronger gear actually costs more.",
      "Weapon sprites no longer squashed, so they keep their real proportions.",
      "Bigger arena, gentler knockback, and far fewer Darters.",
      "New items and enemies are on the way. Their art is still being drawn."
    ]
  },
  {
    version: "0.8.0",
    date: "2026-07-31",
    title: "Click to start",
    notes: [
      "Added a click-to-start gate so the intro's audio is never swallowed by the browser.",
      "The vine boom now lands exactly on cue."
    ]
  },
  {
    version: "0.7.1",
    date: "2026-07-30",
    title: "Eyes, properly this time",
    notes: [
      "Measured every character's eye position from the source art instead of guessing.",
      "Fixed the recurring four-eyes bug for good.",
      "Vine boom autoplay fixed."
    ]
  },
  {
    version: "0.7.0",
    date: "2026-07-29",
    title: "Mutations & expressions",
    notes: [
      "Full mutation art set, so all 14 body parts have real art.",
      "Animated slit-eyes, then restored the open cartoon eyes that cover them."
    ]
  },
  {
    version: "0.6.0",
    date: "2026-07-26",
    title: "Lights, camera, potato",
    notes: [
      "Added the intro cinematic and the vine boom.",
      "Brotato-inspired title screen.",
      "Animated character-select portraits and open animated player eyes.",
      "Faster difficulty ramp, enemy tuning, and defringed weapon cutouts.",
      "Gilded Bulwark renamed to Gilded Chestplate."
    ]
  },
  {
    version: "0.5.0",
    date: "2026-07-25",
    title: "The great art swap",
    notes: [
      "Wired up the final 8 item cutouts.",
      "Real player sprites plus muzzle-flash shooting effects.",
      "Better crop quality, with area-averaged 512px art across the board."
    ]
  },
  {
    version: "0.1.0",
    date: "2026-07-24",
    title: "First playable",
    notes: [
      "Spud Survivors exists! A playable web build with simple placeholder art and mechanics."
    ]
  }
];

// Single source of truth: the badge and the notes always match.
const GAME_VERSION = CHANGELOG[0].version;

// Escapes note text so a stray < or & in a patch note can't break the panel markup.
function escapeChangelogText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderChangelog() {
  const list = document.getElementById("changelogList");
  if (!list) return;
  const entries = CHANGELOG.map((entry, index) => {
    const notes = entry.notes.map((note) => `<li>${escapeChangelogText(note)}</li>`).join("");
    // A "Play" button appears only on versions that were actually DEPLOYED and are still
    // hosted (see PLAYABLE_BUILDS). Versions 0.1.0-0.8.0 were written into this changelog
    // retroactively and never existed as their own build, so they get no button rather than
    // a dead one.
    const build = typeof PLAYABLE_BUILDS !== "undefined"
      ? PLAYABLE_BUILDS.find((b) => b.version === entry.version)
      : null;
    const playBtn = index === 0
      ? `<span class="changelog-current">playing now</span>`
      : build
        ? `<a class="changelog-play" href="${buildUrl(build)}" title="Play v${escapeChangelogText(entry.version)} as it shipped">Play</a>`
        : "";
    return `
      <div class="changelog-entry${index === 0 ? " latest" : ""}">
        <div class="changelog-head">
          <span class="changelog-version">v${escapeChangelogText(entry.version)}</span>
          <span class="changelog-title">${escapeChangelogText(entry.title)}</span>
          <span class="changelog-date">${escapeChangelogText(entry.date)}</span>
          ${playBtn}
        </div>
        <ul>${notes}</ul>
      </div>
    `;
  }).join("");

  // The eight builds that predate the changelog have no version number, so they are listed
  // separately by date rather than being faked into the version history.
  const older = typeof PLAYABLE_BUILDS !== "undefined"
    ? PLAYABLE_BUILDS.filter((b) => !b.version)
    : [];
  const olderHtml = older.length
    ? `
      <div class="changelog-entry changelog-archive">
        <div class="changelog-head">
          <span class="changelog-version">Earlier</span>
          <span class="changelog-title">Builds from before the patch notes existed</span>
        </div>
        <div class="changelog-archive-list">
          ${older.map((b) => `
            <a class="changelog-play" href="${buildUrl(b)}" title="${escapeChangelogText(b.label)}">
              ${escapeChangelogText(buildDisplayName(b))}
            </a>`).join("")}
        </div>
      </div>
    `
    : "";

  list.innerHTML = entries + olderHtml;
}

function initChangelogControls() {
  const button = document.getElementById("titleVersionButton");
  const panel = document.getElementById("titleChangelog");
  const back = document.getElementById("changelogBack");
  if (!button || !panel) return;

  button.textContent = `v${GAME_VERSION}`;
  renderChangelog();

  button.addEventListener("click", () => {
    playSfx("click");
    panel.classList.remove("hidden");
  });
  button.addEventListener("pointerenter", () => playSfx("hover"));
  back?.addEventListener("click", () => {
    playSfx("click");
    panel.classList.add("hidden");
  });
  // Clicking the dimmed backdrop closes it too, matching how the options overlay feels.
  panel.addEventListener("click", (event) => {
    if (event.target === panel) panel.classList.add("hidden");
  });
}
