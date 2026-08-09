"use strict";

// achievements.js - a checklist of little goals to chase across a run. Persists across runs
// (session storage, its own key, same idiom as the compendium) so unlocks survive a refresh even
// though the stats that drive most of it (kills, scrap, wave) are reset every run.
//
// checkAchievements() is meant to be called cheaply and often from a few hook points
// (kill, wave end, game over) rather than on a dedicated timer, so every field read in it
// is guarded - state can be mid-init or a run can be over when it fires.

const ACHIEVEMENTS = [
  { id: "first_blood", name: "First Blood", description: "Landed your first kill.", hint: "First kill", goal: 1, progressKey: "kills" },
  // id stays `squal_wipe` despite the display name changing to "Squad Wipe": the id is the
  // storage key, so renaming it would silently re-lock this for anyone who has it.
  { id: "squal_wipe", name: "Squad Wipe", description: "Reached 100 kills in a single run.", hint: "Reach 100 kills in one run", goal: 100, progressKey: "kills" },
  { id: "harvest_season", name: "Harvest Season", description: "Reached 500 kills in a single run.", hint: "Reach 500 kills in one run", goal: 500, progressKey: "kills" },
  { id: "locking_in", name: "Locking In", description: "Reached wave 5.", hint: "Reach wave 5", goal: 5, progressKey: "wave" },
  { id: "wave_10", name: "Double Digits", description: "Reached wave 10.", hint: "Reach wave 10", goal: 10, progressKey: "wave" },
  { id: "wave_15", name: "Deep Run", description: "Reached wave 15.", hint: "Reach wave 15", goal: 15, progressKey: "wave" },
  { id: "scrap_500", name: "Scrapper", description: "Earned 500 scrap in a single run.", hint: "Earn 500 scrap in one run", goal: 500, progressKey: "scrap" },
  { id: "scrap_2000", name: "Tycoon", description: "Earned 2000 scrap in a single run.", hint: "Earn 2000 scrap in one run", goal: 2000, progressKey: "scrap" },
  { id: "untouched_wave", name: "Untouchable", description: "Cleared a wave without taking any damage.", hint: "Clear a wave without taking damage", goal: 1, progressKey: null },
  { id: "full_arsenal", name: "Fully Loaded", description: "Filled every weapon slot.", hint: "Fill every weapon slot", goal: 1, progressKey: null },
  { id: "compendium_all", name: "Field Researcher", description: "Discovered every enemy in the compendium.", hint: "Discover every enemy", goal: 1, progressKey: "compendium" },
  { id: "food", name: "FOOD!", description: "Ate something.", hint: "Eat something", goal: 1, progressKey: null },
  { id: "wasted", name: "Wasted.", description: "Ate 5 apples at full HP in one run.", hint: "Eat 5 apples at full HP in one run", goal: 5, progressKey: "wastedApples" },
  { id: "legendary", name: "Legendary.", description: "Obtained a Legendary weapon.", hint: "Obtain a Legendary weapon", goal: 1, progressKey: null },
  { id: "ouch", name: "Ouch!", description: "Took damage.", hint: "Take damage", goal: 1, progressKey: null },
  { id: "loot_box", name: "Loot box?", description: "Opened a crate.", hint: "Open a crate", goal: 1, progressKey: null },
  { id: "built_different", name: "Built Different", description: "Grew a Legendary body part.", hint: "Grow a Legendary body part", goal: 1, progressKey: null },
  { id: "merger", name: "Merger", description: "Merged something.", hint: "Merge something", goal: 1, progressKey: null },
  { id: "rip", name: "RIP", description: "Died.", hint: "Die", goal: 1, progressKey: null },
  { id: "mutated", name: "Mutated", description: "Mutated.", hint: "Mutate", goal: 1, progressKey: null },
  { id: "tanky", name: "Tanky", description: "Reached 125 max HP.", hint: "Reach 125 max HP", goal: 125, progressKey: "maxHp" },
  { id: "chunky", name: "Chunky", description: "Played as Chunk.", hint: "Play as Chunk", goal: 1, progressKey: null },
  { id: "zoooom", name: "Zoooom", description: "Played as Zip.", hint: "Play as Zip", goal: 1, progressKey: null },
  { id: "balanced", name: "Balanced", description: "Played as Sprout.", hint: "Play as Sprout", goal: 1, progressKey: null },
  { id: "flint_steel_ach", name: "Flint & Steel", description: "Obtained Flint and Steel.", hint: "Obtain Flint and Steel", goal: 1, progressKey: null },
  { id: "gambler", name: "Gambler", description: "Spun the slot machine.", hint: "Spin the slot machine", goal: 1, progressKey: null },
  { id: "easter_egg_1", name: "Tuff Easter Egg", description: "Discovered an easter egg.", hint: "Discover an easter egg", goal: 1, progressKey: null, secret: true },
  { id: "easter_egg_2", name: "Two Tuff Easter Eggs", description: "Discovered both easter eggs.", hint: "Discover both easter eggs", goal: 1, progressKey: null, secret: true }
];

// sessionStorage, NOT localStorage: unlocks last for this browser session (a refresh keeps
// them, a new tab or a later visit starts clean). Moving progress forward is a deliberate
// act -- copy the code, paste it on the character select screen -- rather than something
// that happens invisibly. See exportProgressCode/importProgressCode in js/09-main.js.
const ACHIEVEMENTS_KEY = "spud-survivors-achievements";
let unlockedAchievements = loadAchievements();

function loadAchievements() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(ACHIEVEMENTS_KEY));
    // Guard the shape: a corrupt or hand-edited value must not break the panel.
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

function saveAchievements() {
  try {
    sessionStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlockedAchievements));
  } catch {
    // storage unavailable (private mode / file restrictions) - progress just won't persist
  }
}

function isAchievementUnlocked(id) {
  return Boolean(unlockedAchievements[id]);
}

function achievementUnlockedCount() {
  return ACHIEVEMENTS.filter((a) => isAchievementUnlocked(a.id)).length;
}

function achievementEntries() {
  return ACHIEVEMENTS.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    hint: a.hint,
    unlocked: isAchievementUnlocked(a.id),
    unlockedAt: unlockedAchievements[a.id] ?? null,
    secret: Boolean(a.secret),
    goal: a.goal,
    progressKey: a.progressKey ?? null
  }));
}

// Takes an entry from achievementEntries() (or anything with the same {name, hint,
// description, unlocked, secret} shape) and decides what to actually show in the panel:
// unlocked achievements always show their real name/description, locked non-secret ones
// show a "???" name with their hint as a nudge, and locked secret ones give away nothing
// at all.
function achievementDisplay(entry) {
  if (entry.unlocked) {
    return { name: entry.name, sub: entry.description };
  }
  if (entry.secret) {
    return { name: "???", sub: "???" };
  }
  return { name: "???", sub: entry.hint };
}

// Progress bars only render for LOCKED rows (see renderAchievements in js/09-main.js), so
// "already unlocked" returning null here is what that caller relies on -- it never has to
// re-check entry.unlocked itself. Takes a raw ACHIEVEMENTS record (needs .progressKey/.goal).
function achievementProgress(entry) {
  if (!entry || !entry.progressKey || isAchievementUnlocked(entry.id)) return null;

  let current = 0;
  let goal = entry.goal;
  switch (entry.progressKey) {
    case "kills":
      current = state?.runStats?.kills ?? 0;
      break;
    case "wave":
      current = state?.wave ?? 0;
      break;
    case "scrap":
      current = state?.runStats?.scrapEarned ?? 0;
      break;
    case "compendium":
      current = typeof compendiumDiscoveredCount === "function" ? compendiumDiscoveredCount() : 0;
      // Computed LIVE rather than trusting entry.goal: the compendium's size can change as
      // enemies are added, and a stale hardcoded goal would silently under/overstate progress.
      goal = typeof compendiumEntries === "function" ? compendiumEntries().length : entry.goal;
      break;
    case "maxHp":
      current = state?.player?.maxHp ?? 0;
      break;
    case "wastedApples":
      current = state?.runStats?.wastedApples ?? 0;
      break;
    default:
      return null;
  }

  if (!(goal > 0)) return null;
  const ratio = Math.max(0, Math.min(1, current / goal));
  return { current, goal, ratio };
}

function unlockAchievement(id) {
  if (!id || unlockedAchievements[id]) return;
  const entry = ACHIEVEMENTS.find((a) => a.id === id);
  if (!entry) return;
  unlockedAchievements[id] = Date.now();
  saveAchievements();
  showAchievementToast(entry);
}

// Cheap and safe to call often. Every field read here is guarded since state can be
// mid-init (menu screen) or the run can already be over when a caller fires this.
function checkAchievements() {
  const stats = state?.runStats;
  if (stats) {
    if (stats.kills >= 1) unlockAchievement("first_blood");
    if (stats.kills >= 100) unlockAchievement("squal_wipe");
    if (stats.kills >= 500) unlockAchievement("harvest_season");
    if (stats.scrapEarned >= 500) unlockAchievement("scrap_500");
    if (stats.scrapEarned >= 2000) unlockAchievement("scrap_2000");
  }

  if (typeof state?.wave === "number") {
    if (state.wave >= 5) unlockAchievement("locking_in");
    if (state.wave >= 10) unlockAchievement("wave_10");
    if (state.wave >= 15) unlockAchievement("wave_15");
  }

  if (Array.isArray(state?.weapons) && typeof maxWeaponSlots === "function") {
    if (state.weapons.length >= maxWeaponSlots()) unlockAchievement("full_arsenal");
  }

  if (typeof compendiumDiscoveredCount === "function" && typeof compendiumEntries === "function") {
    const total = compendiumEntries().length;
    if (total > 0 && compendiumDiscoveredCount() >= total) unlockAchievement("compendium_all");
  }

  if (Array.isArray(state?.weapons) && state.weapons.some((w) => w.tier === 5)) {
    unlockAchievement("legendary");
  }

  if (Array.isArray(state?.items) && state.items.some((i) => i.id === "flint_steel")) {
    unlockAchievement("flint_steel_ach");
  }

  if (state?.player && state.player.maxHp >= 125) {
    unlockAchievement("tanky");
  }

  // untouched_wave is NOT decided here: "no damage taken" is only meaningful at the moment
  // a wave actually ends (endWave), not on every cheap poll in between, so that unlock is
  // fired explicitly from js/04-flow.js right where the wave is confirmed clear.
}

// --- Easter eggs -----------------------------------------------------------------------
// Discovered eggs live in the SAME unlockedAchievements object/storage key, under the
// reserved "_eggs" sub-key ({titleO: true, footerO: true}). This is NOT an achievement id
// and must never be iterated as one -- achievementUnlockedCount()/achievementEntries() only
// ever walk the ACHIEVEMENTS array, so they are safe by construction, but any future code
// that does Object.keys(unlockedAchievements) must explicitly skip "_eggs".
function markEasterEgg(which) {
  if (!which) return;
  const eggs = unlockedAchievements._eggs && typeof unlockedAchievements._eggs === "object"
    ? unlockedAchievements._eggs
    : {};
  if (eggs[which]) return; // already found - no re-toast
  eggs[which] = true;
  unlockedAchievements._eggs = eggs;
  saveAchievements();

  const foundCount = Object.values(eggs).filter(Boolean).length;
  if (foundCount >= 1) unlockAchievement("easter_egg_1");
  if (foundCount >= 2) unlockAchievement("easter_egg_2");
}

// --- Toast ---------------------------------------------------------------------------

let achievementToastContainer = null;

function getAchievementToastContainer() {
  if (achievementToastContainer && document.body.contains(achievementToastContainer)) {
    return achievementToastContainer;
  }
  achievementToastContainer = document.getElementById("achievementToastContainer");
  if (!achievementToastContainer) {
    achievementToastContainer = document.createElement("div");
    achievementToastContainer.id = "achievementToastContainer";
    document.body.appendChild(achievementToastContainer);
  }
  return achievementToastContainer;
}

function showAchievementToast(entry) {
  const container = getAchievementToastContainer();
  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.innerHTML = `
    <span class="achievement-toast-label">Achievement Unlocked</span>
    <strong class="achievement-toast-name">${escapeChangelogText(entry.name)}</strong>
    <span class="achievement-toast-desc">${escapeChangelogText(entry.description)}</span>
  `;
  container.appendChild(toast);
  if (typeof playSfx === "function") playSfx("merge");

  // Two rAFs so the initial state paints before the transition class flips (a single rAF
  // can still land in the same style-recalc batch and skip the transition entirely).
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add("achievement-toast-show");
    });
  });

  setTimeout(() => {
    toast.classList.remove("achievement-toast-show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
