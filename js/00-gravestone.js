"use strict";

// gravestone.js - the shared "you're done" flourish: a taco-bell bong followed by a short
// gravestone card. Used by BOTH the death path (before the run summary) and the title
// screen's Quit button, so the two can't drift apart.

const TACO_BELL_BONG_SRC = "assets/audio/taco_bell_bong.mp3";

// Mirrors playBoomOrArm in 09b-title.js: browsers block audio until a real user gesture,
// so if the context is still suspended we arm the clip to fire on the first unlock rather
// than letting it get silently swallowed.
function playBongOrArm() {
  if (gameSettings.muted) return;
  const attempt = () => {
    playClip(TACO_BELL_BONG_SRC, { gain: 1.8 });
  };
  if (typeof audioCtx !== "undefined" && audioCtx && audioCtx.state !== "suspended") {
    attempt();
  } else if (typeof onAudioUnlocked === "function") {
    onAudioUnlocked(attempt);
  }
}

// Builds the overlay lazily so index.html doesn't need markup for it. Returns the element.
function ensureGravestoneOverlay() {
  let overlay = document.getElementById("gravestoneOverlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "gravestoneOverlay";
  overlay.className = "gravestone-overlay hidden";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="gravestone-card">
      <img class="gravestone-img" src="assets/ui/gravestone.png" alt="">
      <p class="gravestone-epitaph"></p>
    </div>
  `;
  const stage = document.querySelector(".stage") ?? document.body;
  stage.appendChild(overlay);
  return overlay;
}

// Plays bong -> gravestone -> onDone(). Kept short (~2.2s) so it never gets annoying on a
// death streak. onDone always fires exactly once, even if called while already running.
let gravestoneRunning = false;
function playGravestone(epitaph, onDone) {
  const finish = () => {
    gravestoneRunning = false;
    if (typeof onDone === "function") onDone();
  };
  if (gravestoneRunning) {
    finish();
    return;
  }
  gravestoneRunning = true;

  const overlay = ensureGravestoneOverlay();
  const text = overlay.querySelector(".gravestone-epitaph");
  if (text) text.textContent = epitaph ?? "";

  playBongOrArm();

  overlay.classList.remove("hidden");
  // Force a reflow so removing .hidden and adding .show in the same tick still animates.
  void overlay.offsetWidth;
  overlay.classList.add("gravestone-show");

  setTimeout(() => {
    overlay.classList.remove("gravestone-show");
    setTimeout(() => {
      overlay.classList.add("hidden");
      finish();
    }, 380);
  }, 1800);
}
