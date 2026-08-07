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
      "Enemies die much faster. Trash should pop, not soak up a full second each.",
      "Way more of them, too: roughly triple the spawn rate, and the arena holds far more at once.",
      "Nibblers, Skitters and Orbiters now make up the bulk of a wave.",
      "Bruisers are leaner but shrug off knockback, so they still plant their feet and walk at you.",
      "Bruisers drop a lot more scrap, since killing one is a real commitment.",
      "New art: seven enemies, five weapons and three items are drawn and ready to be built.",
      "New berry bush and health apple sprites in the arena.",
      "Bigger character portrait in the shop, and Items is now a proper Inventory of icons.",
      "Hover any inventory item to see what it is.",
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
  list.innerHTML = CHANGELOG.map((entry, index) => {
    const notes = entry.notes.map((note) => `<li>${escapeChangelogText(note)}</li>`).join("");
    return `
      <div class="changelog-entry${index === 0 ? " latest" : ""}">
        <div class="changelog-head">
          <span class="changelog-version">v${escapeChangelogText(entry.version)}</span>
          <span class="changelog-title">${escapeChangelogText(entry.title)}</span>
          <span class="changelog-date">${escapeChangelogText(entry.date)}</span>
        </div>
        <ul>${notes}</ul>
      </div>
    `;
  }).join("");
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
