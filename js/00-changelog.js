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
    version: "0.16.0",
    date: "2026-08-11",
    title: "The King's Court",
    notes: [
      "The Nibbler King now shows up as its own fight AFTER wave 10 finishes, instead of replacing it, so wave 10 always plays out normally first.",
      "The King is a lot tougher now and scales itself to how strong your build actually is, so it stays a real fight whether you are stacked or still scrapping by.",
      "Touching the King directly now actually hurts, so charging straight into it is a real risk, not a free ride.",
      "Many new attacks: a three-hit club combo, a spinning sweep that punishes standing too close, a heavy overhead smash that telegraphs exactly where it will land, plus new ranged attacks including a spray of seeds, lobbed shots, and a bursting ring of projectiles.",
      "Every attack still shows a clear red warning first, so you always get a chance to read it and react.",
      "Nibblers now trickle in from the edges of the arena throughout the fight, on top of anything the King summons itself, so you can never fully stop moving."
    ]
  },
  {
    version: "0.15.1",
    date: "2026-08-10",
    title: "Buckshot",
    notes: [
      "Seed Shotgun was never really a shotgun. It fired a single bullet at a random wide angle and hoped you would not notice.",
      "It now fires 4 real pellets in a proper cone, so it finally works the way its name promises.",
      "Total damage per shot has not changed. The same damage is split across the pellets instead of being multiplied by them.",
      "Extra +projectile items add more pellets to the spread the same way as before."
    ]
  },
  {
    version: "0.15.0",
    date: "2026-08-10",
    title: "The Nibbler King",
    notes: [
      "Wave 10's first boss fight has arrived: the Nibbler King, a massive crowned Nibbler with an aura of its own.",
      "The fight happens right after wave 10's rewards and shop, before wave 11 begins. It does not use up a wave, so you keep your normal progress either way.",
      "The King does not run on a clock. The fight only ends when it goes down.",
      "Every attack shows a clear red warning first, so you always get a chance to react before it lands.",
      "It swings, it charges, it slams the ground, and it calls in regular Nibblers to back it up.",
      "Push it past half health and it gets angry: faster attacks, harder hits, and it starts flinging Nibblers out in every direction.",
      "Beat it for a big pile of scrap on top of the usual post-wave rewards.",
      "A dedicated health bar tracks the fight so you always know how close it is to going down."
    ]
  },
  {
    version: "0.14.4",
    date: "2026-08-10",
    title: "Truly white paper",
    notes: [
      "Fixed the fortune slip sometimes rendering with a dark, hard-to-read background instead of clean white paper. It is now solid white with crisp black text every time."
    ]
  },
  {
    version: "0.14.3",
    date: "2026-08-10",
    title: "A readable fortune",
    notes: [
      "The fortune cookie screen now uses the whole panel, with a much bigger cookie front and center.",
      "The fortune itself is now a proper slip: a long thin white strip with clear black text, like the real thing. The rarity keeps its own color in the corner.",
      "The crack got another pass: the cookie visibly strains with two little jolts before it gives, a crack flashes across the seam at the moment it breaks, the halves tip outward in 3D instead of swinging flat, and a few bigger chunks fall with the crumbs.",
      "The slip now unrolls sideways from between the halves instead of growing upward."
    ]
  },
  {
    version: "0.14.2",
    date: "2026-08-10",
    title: "Crack with feeling",
    notes: [
      "Cracking a fortune cookie now feels like breaking a real one. It squeezes under pressure, snaps with a crunch, throws crumbs, and the halves tumble apart before settling.",
      "The paper slip unrolls between the halves instead of just appearing.",
      "The fortune cookie screen got its own warm look, with a proper glow behind the cookie and clearer buttons. Cracking is the big gold one. Eating it whole is the quiet one, and it now says plainly what it will cost you.",
      "Nothing about the cookie hints at what rarity is inside until you crack it. That would spoil the fun."
    ]
  },
  {
    version: "0.14.1",
    date: "2026-08-10",
    title: "A proper crack",
    notes: [
      "Cracking a fortune cookie now shows the actual cookie. It shakes, splits into two halves, and the paper slip rises up between them.",
      "The two halves stay either side of your fortune while you read it.",
      "The unopened cookie bobs gently while it waits for your decision."
    ]
  },
  {
    version: "0.14.0",
    date: "2026-08-10",
    title: "Fortune cookies",
    notes: [
      "Fortune cookies you pick up during a wave are now saved instead of doing nothing. They open after the wave, in their own screen just before the shop.",
      "Crack one open to read your fortune. The slip tells you whether something good or bad is coming and roughly when, but never what it actually is. You find that out when it happens.",
      "Or eat the whole thing without looking. You will choke on it and lose 1 max HP, and you will never know what the fortune said. Once a cookie is cracked open you cannot eat it.",
      "Fortunes come in Common, Uncommon, Rare, Epic, Legendary, Unique and something else. The rarity is printed in the corner of the slip. Rarer slips hit harder.",
      "Whatever a fortune does, it lasts for one wave only, and the game tells you outright when it kicks in.",
      "Pick up several cookies in a wave and you open them one after another. Every fortune you crack will play out.",
      "Unique items are now gold everywhere instead of sharing Legendary orange."
    ]
  },
  {
    version: "0.13.2",
    date: "2026-08-10",
    title: "Staying signed in",
    notes: [
      "Fixed syncing failing with a JWT expired error about an hour after logging in. Your login now renews itself quietly in the background instead of going stale.",
      "If a sync is refused because the login has aged out, it renews and retries once on its own, so you should never have to log in again just to sync."
    ]
  },
  {
    version: "0.13.1",
    date: "2026-08-10",
    title: "Log in from the title screen, progress codes retired",
    notes: [
      "Log in and Sign up now sit in the top right of the title screen, and open a popup rather than sending you somewhere else.",
      "Once you are signed in those two are replaced by a single Account button, with your email shown next to it.",
      "New achievement: Abort Mission, for abandoning a run.",
      "Progress codes are gone. Your achievements and compendium now save on your device automatically, so closing the tab no longer costs you anything.",
      "An account is now purely about carrying that progress to your other devices, and keeping it safe if you clear your browser data."
    ]
  },
  {
    version: "0.13.0",
    date: "2026-08-09",
    title: "Accounts, luck that finally works, and achievements you can actually earn",
    notes: [
      "You can now make an account. It is completely optional, and the game plays exactly the same without one.",
      "An account keeps your achievements and compendium across devices, and remembers your finished runs.",
      "Sign up with an email and a password from the character select screen. You will get a confirmation email before you can log in.",
      "Forgot your password? There is a recovery link on the same screen that emails you a reset.",
      "Logging in merges your cloud progress with whatever you have on this device, so signing in can never wipe what you just earned.",
      "The account panel says plainly what an account stores and how to have it deleted. Play without one and nothing ever leaves your device.",
      "Luck was doing almost nothing past a certain point. Every rarity chance hit a ceiling at around 150 luck, so 900 luck rolled exactly the same as 150.",
      "Rare tiers were also locked behind wave numbers that luck could not touch at all. Epic mutations were flatly impossible before wave 6 and Legendary before wave 9, no matter how lucky you were.",
      "Luck now pulls those gates earlier, so a big luck build starts seeing Epic and Legendary well before it used to instead of waiting for the wave counter.",
      "The rarity ceilings are much higher, and the Legendary ceiling itself climbs with luck, so stacking luck keeps paying off instead of flatlining.",
      "Fixed rarity chances adding up to more than 100%, which was quietly eating the lower tiers and making the real odds different from the intended ones.",
      "Fruit heals a lot more, and keeps up as the waves go on. It used to grow so slowly that it was worth less and less of your health bar the longer a run went.",
      "\"Squal Wipe\" was a typo and is now \"Squad Wipe\". If you already earned it, it stays earned.",
      "Achievements and the compendium now last for your current session. Refreshing the page keeps them, but closing the tab or coming back later starts you fresh.",
      "Copy code and Paste code buttons now sit on the character select screen. Copy your code before you leave to carry your progress into the next session, or onto another device.",
      "Pasting a code still only ever adds to what you have, so bringing progress in can never wipe what you just earned.",
      "Screen shake calms down in late waves. Killing hundreds of enemies a second was keeping the screen permanently rattling, which was exhausting to look at.",
      "Getting hit, dying and explosions still shake the screen properly, so the moments that matter stand out from the noise instead of blending into it.",
      "Your progress code is now shown as text you can actually see and select, on both the character select and the run summary screens. Before it only ever went to the clipboard, so if copying quietly failed there was no way to tell.",
      "The run summary now shows your code straight after a run ends, which is the moment you are most likely to want it.",
      "Clicking the code selects all of it, so you can copy it by hand if the button does not work in your browser.",
      "Merging two weapons now counts for Merger. Only merging items did, so the most obvious way to merge something was the one way that never registered it.",
      "Getting a Legendary weapon now unlocks Legendary right away, whether you bought it, found it in a crate or merged your way up to it. It used to wait for your next kill, and if the run ended first you never got it at all.",
      "Flint and Steel and Tanky had the same delay and now unlock the moment you earn them."
    ]
  },
  {
    version: "0.12.3",
    date: "2026-08-09",
    title: "Scrap drops show what they are worth, and a look at the beginning",
    notes: [
      "Enemies that drop several scrap now scatter it as a small pile of coins instead of one, so a big kill looks like a big payout.",
      "The total is exactly the same, it is just easier to see at a glance which kills were worth the most.",
      "Added Primeval to the time machine, under the oldest version. It runs the very first build with its art switched off, so you get the hand-drawn shapes the game was made of before any of the art existed."
    ]
  },
  {
    version: "0.12.2",
    date: "2026-08-09",
    title: "A much bigger achievement list, progress bars, and a fixed Shuriken",
    notes: [
      "\"Culling\" is now \"Squal Wipe\", and \"Getting Warm\" is now \"Locking In\". Same achievements, new names.",
      "Removed the Endurance achievement, it overlapped too much with the wave-based ones to earn its own slot.",
      "The achievement list is far longer now, with new goals covering eating, dying, mutating, merging, gambling, character choice, rare gear and more.",
      "Locked achievements now hide their name behind ??? and show you the exact requirement instead, so the list reads as a to-do list rather than a spoiler.",
      "Locked achievements that track a number (kills, waves, scrap, max HP) now show a progress bar with your current total.",
      "Added two hidden secrets to discover. They give nothing away until you find them.",
      "Added Copy progress code and Paste progress code buttons to the achievements panel, so you can back up or move your achievements and compendium progress to another browser or device.",
      "Pasting a code only ever adds to what you already have, so importing can never wipe your own progress.",
      "The thrown Shuriken is now the same size as the one in your hand. It was being drawn at about half size.",
      "The Shuriken is no longer a boomerang. It flies out, cuts through what it can, then vanishes at the end of its range while the weapon reloads and a fresh star appears in your hand.",
      "Fixed the Shuriken sometimes never coming back at all. Throwing it into a tree or a crate left that weapon slot empty for the rest of the run.",
      "Time machine buttons are smaller and tuck out of the way, and older builds now sit next to the version they most likely were instead of in a separate list of dates."
    ]
  },
  {
    version: "0.12.1",
    date: "2026-08-09",
    title: "Grenade Launcher rework, achievements, and a time machine that tells the truth",
    notes: [
      "Grenade Launcher explosions are much bigger, with a far larger blast radius at every rank.",
      "Explosion damage multiplier is up substantially, so the blast itself hits a lot harder.",
      "Fire rate is slower to compensate, cooldown is longer at every rank.",
      "Shop cost is up to match the stronger payoff.",
      "Time machine now shows old builds with their own art instead of today's, fixing older builds looking wrong when replayed.",
      "Older time machine builds are now labelled with the version they most likely were, marked with a tilde where that had to be worked out from the date.",
      "Added an Achievements panel with a dozen things to chase across a run, from your first kill to clearing a wave without taking a scratch.",
      "Achievements pop a toast the moment you earn them and stay unlocked across runs."
    ]
  },
  {
    version: "0.12.0",
    date: "2026-08-08",
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
        ? `<a class="changelog-play changelog-play-small" href="${buildUrl(build)}" title="Play v${escapeChangelogText(entry.version)} as it shipped">Play</a>`
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

  // The eight builds that predate the changelog carry an inferred approxVersion (matched
  // from their commit date). They are grouped under the version they most likely were, so
  // a date sits next to the closest version number instead of in a separate date-only list.
  const older = typeof PLAYABLE_BUILDS !== "undefined"
    ? PLAYABLE_BUILDS.filter((b) => !b.version)
    : [];
  const grouped = new Map();
  for (const b of older) {
    // Primeval is not a version and is not dated alongside the others -- it gets its own row
    // at the bottom rather than being grouped under an inferred version number.
    if (b.primeval) continue;
    const key = b.approxVersion ?? "";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(b);
  }
  const primevalBuilds = older.filter((b) => b.primeval);
  const olderHtml = older.length
    ? `
      <div class="changelog-entry changelog-archive">
        <div class="changelog-head">
          <span class="changelog-version">Earlier</span>
          <span class="changelog-title">Builds from before the patch notes existed</span>
        </div>
        ${Array.from(grouped.entries()).map(([approx, builds]) => `
          <div class="changelog-archive-group">
            <span class="changelog-archive-version">${approx ? `~v${escapeChangelogText(approx)}` : "unknown"}</span>
            <div class="changelog-archive-list">
              ${builds.map((b) => `
                <a class="changelog-play changelog-play-small" href="${buildUrl(b)}" title="${escapeChangelogText(b.label)}">
                  ${escapeChangelogText(buildDateLabel(b))}
                </a>`).join("")}
            </div>
          </div>`).join("")}
        ${primevalBuilds.map((b) => `
          <div class="changelog-archive-group changelog-primeval-row">
            <span class="changelog-archive-version">Primeval</span>
            <div class="changelog-archive-list">
              <a class="changelog-play changelog-play-small" href="${buildUrl(b)}" title="${escapeChangelogText(b.label)}">
                Play
              </a>
            </div>
          </div>`).join("")}
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
