"use strict";

// compendium.js - the monster compendium: lore written by LEON, stats read live from
// enemyTypes so an entry can never drift out of sync with the actual game balance.
//
// Entries are keyed by the enemy's exact `name` in js/01-core.js. Anything in enemyTypes
// without an entry here still shows up in the book with its stats and art, just without
// flavour text, so adding an enemy never silently drops it from the compendium.

// `tagline` is the enemy's ROLE, not a second description -- a short classification the
// player can scan ("Summoner", "Stationary Turret") rather than a rephrasing of the story
// sitting directly underneath it.
const COMPENDIUM_LORE = {
  Nibbler: {
    tagline: "Common Swarm",
    body: [
      "A weak, simple red slime distinguished by its pointy incisors. Extremely bouncy and seemingly blessed with limitless energy, Nibblers can be found almost anywhere there is soil.",
      "The Nibbler is the softest and most gelatinous of the known slimes. Its favorite foods are leafy greens, though calling it a picky eater would be wildly inaccurate. Plants, scraps, boots, unattended equipment - if a Nibbler can get its teeth around something, it will probably try to eat it.",
      "Fortunately, they aren't particularly clever. Unfortunately, there are always more of them."
    ]
  },
  Skitter: {
    tagline: "Fast Swarm",
    body: [
      "Small, green, and alarmingly fast, the Skitter spends most of its life with its belly close to the ground and its legs moving considerably faster than seems necessary.",
      "Skitter colonies prefer dense vegetation, where their coloring and low profile help conceal them from predators. At the slightest disturbance, however, they burst from cover at tremendous speed. This has led some researchers to suggest that Skitters are naturally nervous creatures.",
      "This would be more reassuring if they weren't always running directly toward you."
    ]
  },
  Bruiser: {
    tagline: "Heavy Bruiser",
    body: [
      "A Bruiser is what happens when a creature invests almost everything in being enormous.",
      "These hulking purple beasts are exceptionally tough, remarkably strong and almost impossible to shove around. Blows that send smaller creatures tumbling tend to make a Bruiser look mildly inconvenienced. They are also capable of delivering some of the heaviest hits of any commonly encountered creature.",
      "Thankfully, all that mass has consequences. Bruisers move at a ponderous pace and are not particularly common.",
      "Their bodies also contain an impressive amount of usable scrap, making the discovery of a dead Bruiser considerably more pleasant than the discovery of a live one."
    ]
  },
  Darter: {
    tagline: "Charger",
    body: [
      "The Darter is a compact orange predator with a peculiar approach to movement. Most of the time, it is rather slow. Then, very suddenly, it isn't.",
      "Before attacking, a Darter lowers its body and coils tightly against the ground. Nearly all of its muscular strength is released in a single explosive lunge, carrying it a surprising distance. Its body is considerably sturdier than the small creatures found in ordinary swarms, so it can survive quite a beating while lunging.",
      "Fortunately, Darters give a very noticeable moment of preparation before they lunge, giving you enough time to move before it lunges."
    ]
  },
  "Ember Glob": {
    tagline: "Fire Artillery",
    body: [
      "The Ember Glob is a small, smoldering creature that prefers solving disagreements from a respectable distance.",
      "Its body is fairly delicate, and in close quarters it is much less terrifying than its fiery appearance suggests. The danger comes from the glowing mass it periodically launches into the air. These fireballs drift slowly, but a direct impact packs quite a punch. On top of that, it also burns targets hit by the fireball.",
      "Ember Globs seem happiest around warm stones, old fire pits and other places where the ground retains heat. They are rarely found in large numbers, though whole nests have been found in volcanoes.",
      "Ember Globs prefer cooking their food before eating it, though even if they didn't want to, they couldn't really change that."
    ]
  },
  Spitter: {
    tagline: "Ranged Attacker",
    body: [
      "The cyan Spitter possesses several glands capable of producing a sticky, pressurized fluid. It uses these primarily to spit at things it dislikes.",
      "It is not especially fast or especially durable, so it avoids close contact whenever possible. Instead, it keeps its distance and fires frequently. An individual shot is not very powerful, but Spitters are more common than most ranged creatures and enjoy spitting in groups. Primarily against enemies, but they are perfectly happy spitting at anyone unfortunate enough to stumble into their territory."
    ]
  },
  Orbiter: {
    tagline: "Fast Orbiter",
    body: [
      "The Orbiter is a small floating creature that refuses to travel in a normal way and no one is entirely sure why they glide.",
      "These small yellow creatures hover effortlessly above the ground and never travel toward something in a straight line. Instead, they circle their target in tightening spirals.",
      "It also has quite a cheery expression all the time, unlike most other blobs, who either grin menacingly or just don't smile at all."
    ]
  },
  Drummer: {
    tagline: "Support Buffer",
    body: [
      "Unlike most hostile creatures, the pink Drummer seems more interested in conducting the fight than winning it personally. This should not be mistaken for harmlessness: a Drummer is large, sturdy, and hits hard enough to be taken seriously. It is simply too slow to catch anything that keeps moving.",
      "Its real contribution is the deep rhythmic beat it produces, which nearby creatures find strangely invigorating. Enemies within range move noticeably faster and hit much harder, despite the dispute on whether the rhythm is a form of communication, magic, or simply an exceptionally motivating drum solo.",
      "Drummers are rarely seen alone and for some reason, have never been seen eating, with the exception of the time one drummer was seen eating his drum (see: Uncanny and Odd Observations of Drummers by Eggest Eugene)."
    ]
  },
  Husk: {
    tagline: "Splitter",
    body: [
      "At first glance, a Husk resembles a dried-out, unhealthy creature wrapped in a brittle brown shell. This is partially correct.",
      "Husks are unusually stiff and make a distinctive rattling sound as they move. More odd is what happens when the outer body is destroyed: the shell cracks open and releases three fully formed Nibblers.",
      "How three Nibblers fit inside one Husk remains one of the most mystifying mysteries in the Compendium."
    ]
  },
  Thistle: {
    tagline: "Stationary Turret",
    body: [
      "The Thistle is less an animal than a very angry (and evil-looking) plant.",
      "It takes root directly in open soil and, once established, becomes completely immobile. For several seconds after sprouting it gathers energy beneath its thick outer leaves. When mature, the plant begins launching hardened projectiles at anything moving nearby.",
      "Thistles have never been observed pursuing prey, but they don't need to. A mature specimen simply claims a patch of ground and makes occupying it increasingly inconvenient, like real estate.",
      "If you see a young Thistle beginning to wake up, you only have a few seconds before it starts firing."
    ]
  },
  "Blight Sac": {
    tagline: "Poison Carrier",
    body: [
      "The Blight Sac is a swollen, sickly-green creature whose thin outer membrane contains a remarkable quantity of toxic fluid. It moves carefully, perhaps because it is aware of what happens if it doesn't.",
      "When killed, the sac ruptures and saturates the surrounding ground with poison. For several seconds afterward, the remains can be more dangerous than the living creature ever was, though it still can inflict poison damage while alive. This has led to the unusual recommendation that Blight Sacs should indeed be killed, just preferably somewhere else.",
      "The smell has not been included in this Compendium. You're welcome."
    ]
  },
  Gravebloom: {
    tagline: "Summoner",
    body: [
      "Graveblooms are ancient purple creatures believed to emerge where unusually rich soil has been left undisturbed for many years. They are typically found in graveyards.",
      "They move slowly and appear almost frail, but a mature Gravebloom can produce something far more troublesome than roots.",
      "When threatened, it plants itself, gathers energy, and begins forming a new creature beside it. Given enough time, a single Gravebloom can turn a manageable infestation into a small army.",
      "Fortunately, the process requires concentration. Hurting the Gravebloom badly enough while it is casting causes the new creature to collapse before it can fully form."
    ]
  },
  Clown: {
    tagline: "Multi-Splitter",
    body: [
      "The Clown is a large, unusually springy creature whose name hints at the insanity it could unleash.",
      "A full sized Clown is fairly sturdy and not especially fast, but when its body is destroyed, however, it does not die in a normal way. It collapses inward and separates into two smaller Clowns. These are weaker and quicker than the original. Destroying either one causes the process to repeat again, producing two more tiny Clowns that are much more fragile and considerably faster.",
      "The smallest generation is the last and once those are gone, they stay gone.",
      "Thus one Clown can eventually produce two medium offspring, followed by four small ones.",
      "Clowns have been seen trying to merge with other full sized clowns, though they have rarely succeeded in making a mega Clown."
    ]
  }
};

// Clown Mid and Clown Small are the same creature at smaller sizes, so they share the
// Clown's entry rather than repeating it with slightly different numbers.
const COMPENDIUM_ALIASES = {
  "Clown Mid": "Clown",
  "Clown Small": "Clown"
};

// One-line mechanical summaries. These describe what the enemy DOES, separate from the
// flavour text, so a player can read the threat at a glance without parsing the story.
const COMPENDIUM_THREAT = {
  Nibbler: "Walks straight at you. Harmless alone, dangerous in numbers.",
  Skitter: "Very fast, very fragile. Reaches you first.",
  Bruiser: "Slow, heavy hitter. Shrugs off knockback and drops a lot of scrap.",
  Darter: "Coils, then lunges a long way. Watch for the wind-up.",
  "Ember Glob": "Lobs slow fireballs that hit hard and set you alight.",
  Spitter: "Keeps its distance and fires often.",
  Orbiter: "Fastest thing here. Circles instead of charging, and floats.",
  Drummer: "Buffs every nearby enemy and hits hard up close, but is far too slow to chase you.",
  Husk: "Bursts into three Nibblers when killed.",
  Thistle: "Rooted turret. Harmless while it arms, then it shoots.",
  "Blight Sac": "Poisons on touch, and leaves a poison pool where it dies.",
  Gravebloom: "Summons reinforcements. Hit it hard to interrupt the cast.",
  Clown: "Splits into two smaller Clowns, twice. Seven bodies in total.",
  "Clown Mid": "A split from a full-size Clown. Splits once more.",
  "Clown Small": "The last generation. Fast, fragile, and stays dead."
};

// The book, assembled from the LIVE enemy table so stats are never stale.
function compendiumEntries() {
  return enemyTypes.map((type) => {
    const loreKey = COMPENDIUM_ALIASES[type.name] ?? type.name;
    const lore = COMPENDIUM_LORE[loreKey] ?? null;
    return {
      name: type.name,
      type,
      lore,
      // A shared entry (the smaller Clowns) says so, rather than repeating the same story.
      sharesLoreWith: COMPENDIUM_ALIASES[type.name] ?? null,
      threat: COMPENDIUM_THREAT[type.name] ?? "",
      // Split-only enemies never appear from a wave roll, so the book flags how you meet them.
      splitOnly: type.spawnable === false
    };
  });
}

// Discovery persists across RUNS but not across SESSIONS: sessionStorage, so refreshing the
// tab keeps the book while opening a new tab (or reopening the game later) starts a clean
// slate. Carrying a book between sessions is done deliberately, by pasting a progress code
// on the character select screen, rather than silently in the background.
// Kept in its own key rather than bolted onto the settings blob so a future settings change
// can't wipe the book.
const COMPENDIUM_KEY = "spud-survivors-compendium";
let enemiesSeen = loadCompendiumProgress();

function loadCompendiumProgress() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(COMPENDIUM_KEY));
    // Guard the shape: a corrupt or hand-edited value must not break the panel.
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

function saveCompendiumProgress() {
  try {
    sessionStorage.setItem(COMPENDIUM_KEY, JSON.stringify(enemiesSeen));
  } catch {
    // storage unavailable (private mode / file restrictions) - the book just won't persist
  }
}

function isEnemyDiscovered(name) {
  return Boolean(enemiesSeen[name]);
}

// Called from spawnEnemy: seeing one is enough to unlock its page. Only writes to storage
// on an actual NEW discovery, so this isn't hitting session storage every spawn.
function markEnemyDiscovered(name) {
  if (!name || enemiesSeen[name]) return;
  enemiesSeen[name] = true;
  saveCompendiumProgress();
}

function compendiumDiscoveredCount() {
  return enemyTypes.filter((t) => isEnemyDiscovered(t.name)).length;
}

// --- Export/import accessors -----------------------------------------------------------
// Used by the achievements panel's progress-code copy/paste (js/09-main.js) so that code
// never reaches into enemiesSeen or the compendium's storage key directly.
function getCompendiumProgressForExport() {
  return enemiesSeen;
}

// Unions `obj` into enemiesSeen (only truthy keys), then persists via the normal save path.
// Returns how many entries were genuinely NEW, so the caller can report what an import
// actually did. Never removes a discovery: an import can only ever add.
function mergeCompendiumProgress(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return 0;
  let added = 0;
  for (const [name, seen] of Object.entries(obj)) {
    if (seen && !enemiesSeen[name]) {
      enemiesSeen[name] = true;
      added += 1;
    }
  }
  if (added > 0) saveCompendiumProgress();
  return added;
}
