"use strict";

// builds.js - the "play an older build" time machine.
//
// Every entry is a real GitHub Pages deployment of this game. Those commits are still
// hosted on GitHub, and raw.githubusercontent.com serves BOTH the code and the art for each
// one, so an old build can be played exactly as it shipped without keeping a copy of it in
// this repo. Nothing is downloaded, cached or cleaned up locally -- the browser is simply
// pointed at that commit's files.
//
// WHY these SHAs and not the changelog list: versions 0.1.0-0.8.0 were written into the
// changelog retroactively (all of them landed in the single v0.9.0 commit), so there is no
// code state for them and never was. What DOES exist is the deployment history below. Eight
// of these predate the changelog entirely, so they are labelled by date instead of version.
//
// HOW TO ADD ONE: after a deploy, add its commit SHA here with the version it shipped.
// `gh api repos/X-Leon-X/Spud_Survivors/deployments` lists them.

const BUILD_REPO = "X-Leon-X/Spud_Survivors";

// Newest first. `version` is null for builds that predate the changelog.
const PLAYABLE_BUILDS = [
  { sha: "1ca1c63", version: "0.11.1", date: "2026-08-07", label: "Cache-busted deploys, gentler scaling" },
  { sha: "9b4d61c", version: "0.11.0", date: "2026-08-07", label: "Faster kills, denser swarms, new art" },
  { sha: "85aa750", version: "0.10.0", date: "2026-08-07", label: "Readme rewrite" },
  { sha: "635101f", version: "0.9.0", date: "2026-08-07", label: "Balance overhaul, run stats, gravestone" },
  { sha: "1680bee", version: null, date: "2026-07-31", label: "Click-to-start audio gate" },
  { sha: "5dd5203", version: null, date: "2026-07-30", label: "Eye coverage + vine boom fixes" },
  { sha: "70b7e47", version: null, date: "2026-07-30", label: "Animated slit-eyes, mutation art" },
  { sha: "5fff116", version: null, date: "2026-07-26", label: "Intro cinematic + vine boom" },
  { sha: "e75acf5", version: null, date: "2026-07-26", label: "Animated portraits, faster ramp" },
  { sha: "a4bb8b6", version: null, date: "2026-07-26", label: "Brotato-inspired title screen" },
  { sha: "a2ef97e", version: null, date: "2026-07-25", label: "Better crops, replaced old art" },
  { sha: "1c6c1be", version: null, date: "2026-07-25", label: "Player sprites + muzzle flash" }
];

// The current build is always playable and is what you are running right now.
function currentBuildLabel() {
  return `v${GAME_VERSION} (current)`;
}

// Human label for a build button.
function buildDisplayName(build) {
  if (build.version) return `v${build.version}`;
  // Pre-changelog builds have no version, so show the date they shipped.
  const [, month, day] = build.date.split("-");
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return `${monthName} ${Number(day)}`;
}

// Base URL for a build's files. jsDelivr is used rather than raw.githubusercontent.com:
// raw serves EVERYTHING as text/plain with X-Content-Type-Options: nosniff, so the browser
// refuses to execute the scripts. Verified content types from jsDelivr:
//   js  -> application/javascript      css -> text/css      png -> image/png
// Only index.html comes back as text/plain, which is why we don't navigate straight to it
// (see time-machine.html: we host our own loader page and pull that build's files into it).
function buildBaseUrl(build) {
  return `https://cdn.jsdelivr.net/gh/${BUILD_REPO}@${build.sha}`;
}

// The local loader page, with the target commit in the query string.
function buildUrl(build) {
  return `time-machine.html?sha=${encodeURIComponent(build.sha)}`;
}
