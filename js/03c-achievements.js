"use strict";

// achievements.js - a checklist of little goals to chase across a run. Persists across runs
// (localStorage, its own key, same idiom as the compendium) so unlocking is permanent even
// though the stats that drive most of it (kills, scrap, wave) are reset every run.
//
// checkAchievements() is meant to be called cheaply and often from a few hook points
// (kill, wave end, game over) rather than on a dedicated timer, so every field read in it
// is guarded - state can be mid-init or a run can be over when it fires.

const ACHIEVEMENTS = [
  { id: "first_blood", name: "First Blood", description: "Landed your first kill.", hint: "Kill an enemy." },
  { id: "kills_100", name: "Culling", description: "Reached 100 kills in a single run.", hint: "Rack up kills in one run." },
  { id: "kills_500", name: "Harvest Season", description: "Reached 500 kills in a single run.", hint: "Rack up a LOT of kills in one run." },
  { id: "wave_5", name: "Getting Warm", description: "Reached wave 5.", hint: "Survive to wave 5." },
  { id: "wave_10", name: "Double Digits", description: "Reached wave 10.", hint: "Survive to wave 10." },
  { id: "wave_15", name: "Deep Run", description: "Reached wave 15.", hint: "Survive to wave 15." },
  { id: "scrap_500", name: "Scrapper", description: "Earned 500 scrap in a single run.", hint: "Earn a good pile of scrap in one run." },
  { id: "scrap_2000", name: "Tycoon", description: "Earned 2000 scrap in a single run.", hint: "Earn a huge pile of scrap in one run." },
  { id: "survive_5min", name: "Endurance", description: "Survived 5 minutes in a single run.", hint: "Stay alive for a while." },
  { id: "untouched_wave", name: "Untouchable", description: "Cleared a wave without taking any damage.", hint: "Clear a wave unscathed." },
  { id: "full_arsenal", name: "Fully Loaded", description: "Filled every weapon slot.", hint: "Fill out your loadout." },
  { id: "compendium_all", name: "Field Researcher", description: "Discovered every enemy in the compendium.", hint: "Meet every kind of enemy." }
];

const ACHIEVEMENTS_KEY = "spud-survivors-achievements";
let unlockedAchievements = loadAchievements();

function loadAchievements() {
  try {
    const stored = JSON.parse(localStorage.getItem(ACHIEVEMENTS_KEY));
    // Guard the shape: a corrupt or hand-edited value must not break the panel.
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}

function saveAchievements() {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlockedAchievements));
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
    unlockedAt: unlockedAchievements[a.id] ?? null
  }));
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
    if (stats.kills >= 100) unlockAchievement("kills_100");
    if (stats.kills >= 500) unlockAchievement("kills_500");
    if (stats.scrapEarned >= 500) unlockAchievement("scrap_500");
    if (stats.scrapEarned >= 2000) unlockAchievement("scrap_2000");
    if (stats.timePlayed >= 300) unlockAchievement("survive_5min");
  }

  if (typeof state?.wave === "number") {
    if (state.wave >= 5) unlockAchievement("wave_5");
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

  // untouched_wave is NOT decided here: "no damage taken" is only meaningful at the moment
  // a wave actually ends (endWave), not on every cheap poll in between, so that unlock is
  // fired explicitly from js/04-flow.js right where the wave is confirmed clear.
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
