"use strict";

// account-ui.js - the account panel, opened from the title screen menu.
//
// Deliberately separate from js/00-account.js (which is the transport) and from 09-main.js
// (which is the game). Accounts are OPTIONAL: every path here fails soft and nothing in this
// file may ever prevent someone pressing play. If the network is down, the project is asleep,
// or the tables do not exist yet, the player sees a message and carries on as a guest.

const accountUi = {
  status: document.getElementById("accountStatus"),
  form: document.getElementById("accountForm"),
  signedIn: document.getElementById("accountSignedIn"),
  email: document.getElementById("accountEmail"),
  password: document.getElementById("accountPassword"),
  message: document.getElementById("accountMessage")
};

let accountBusy = false;

function setAccountMessage(text, kind = "info") {
  if (!accountUi.message) return;
  accountUi.message.textContent = text ?? "";
  accountUi.message.classList.toggle("is-error", kind === "error");
  accountUi.message.classList.toggle("is-good", kind === "good");
}

// Log in and Sign up open the SAME panel; the mode only changes the heading and which button
// is emphasised, because the two forms need identical fields. Keeping one form avoids two
// copies of the email/password inputs drifting apart.
let accountPanelMode = "login";

function setAccountPanelMode(mode) {
  accountPanelMode = mode;
  const title = document.getElementById("accountPanelTitle");
  if (title) {
    title.textContent = mode === "signup" ? "Create an account" : mode === "account" ? "Your account" : "Sign in";
  }
  const signUp = document.getElementById("accountSignUp");
  const logIn = document.getElementById("accountLogIn");
  // The mode's action becomes the primary button so the panel opens ready for what was asked
  // for, without hiding the other route entirely.
  signUp?.classList.toggle("is-primary", mode === "signup");
  logIn?.classList.toggle("is-primary", mode !== "signup");
  setAccountMessage("");
}

function refreshAccountUi() {
  const loggedIn = typeof isLoggedIn === "function" && isLoggedIn();
  accountUi.form?.classList.toggle("hidden", loggedIn);
  accountUi.signedIn?.classList.toggle("hidden", !loggedIn);

  // Corner buttons: Log in / Sign up while signed out, a single Account button once signed
  // in. Doing this here means every path that changes login state updates the corner.
  document.getElementById("titleLogInButton")?.classList.toggle("hidden", loggedIn);
  document.getElementById("titleSignUpButton")?.classList.toggle("hidden", loggedIn);
  document.getElementById("titleAccountButton")?.classList.toggle("hidden", !loggedIn);

  if (!accountUi.status) return;
  const email = typeof accountEmail === "function" ? accountEmail() : null;
  accountUi.status.textContent = loggedIn ? (email ? `Signed in as ${email}` : "Signed in") : "Playing as a guest";
  accountUi.status.classList.toggle("is-signed-in", loggedIn);
}

// Every button routes through this: it blocks double-submits, shows progress, and guarantees
// the busy flag is cleared even if the action throws.
async function runAccountAction(label, action) {
  if (accountBusy) return;
  accountBusy = true;
  setAccountMessage(label);
  try {
    await action();
  } catch {
    setAccountMessage("Something went wrong. You can keep playing as a guest.", "error");
  } finally {
    accountBusy = false;
    refreshAccountUi();
  }
}

function readAccountCredentials() {
  const email = (accountUi.email?.value ?? "").trim();
  const password = accountUi.password?.value ?? "";
  if (!email || !password) {
    setAccountMessage("Enter an email and a password first.", "error");
    return null;
  }
  return { email, password };
}

document.getElementById("accountSignUp")?.addEventListener("click", () => {
  const creds = readAccountCredentials();
  if (!creds) return;
  runAccountAction("Creating your account...", async () => {
    const result = await accountSignUp(creds.email, creds.password);
    if (!result.ok) { setAccountMessage(result.error, "error"); return; }
    if (!result.confirmed) {
      // Email confirmation is on, so there is no session yet. Being explicit here prevents
      // the "I signed up but cannot log in" confusion.
      setAccountMessage("Account created. Check your email for a confirmation link, then log in.", "good");
      return;
    }
    // Confirmed immediately: push whatever this session already earned so nothing is lost.
    await accountPushProgress();
    setAccountMessage("Account created and progress saved.", "good");
  });
});

document.getElementById("accountLogIn")?.addEventListener("click", () => {
  const creds = readAccountCredentials();
  if (!creds) return;
  runAccountAction("Logging in...", async () => {
    const result = await accountLogIn(creds.email, creds.password);
    if (!result.ok) { setAccountMessage(result.error, "error"); return; }
    if (accountUi.password) accountUi.password.value = "";
    // Pull first (merges the cloud into this session), then push the union back up, so
    // logging in on a second device combines both rather than either side winning.
    const pulled = await accountPullProgress();
    await accountPushProgress();
    if (typeof renderAchievements === "function") renderAchievements();
    if (typeof renderCompendium === "function") renderCompendium();
    setAccountMessage(pulled.ok && pulled.merged > 0
      ? `Signed in. ${pulled.merged} unlock(s) restored.`
      : "Signed in. Progress is syncing.", "good");
  });
});

document.getElementById("accountRecover")?.addEventListener("click", () => {
  const email = (accountUi.email?.value ?? "").trim();
  if (!email) { setAccountMessage("Enter your email first, then press Forgot password.", "error"); return; }
  runAccountAction("Sending recovery email...", async () => {
    await accountRequestRecovery(email);
    // Always the same message whether or not the address exists: saying "no such account"
    // would let anyone test which emails are registered here.
    setAccountMessage("If that email has an account, a reset link is on its way.", "good");
  });
});

document.getElementById("accountSync")?.addEventListener("click", () => {
  runAccountAction("Syncing...", async () => {
    const pulled = await accountPullProgress();
    if (!pulled.ok) { setAccountMessage(pulled.error, "error"); return; }
    const pushed = await accountPushProgress();
    if (!pushed.ok) { setAccountMessage(pushed.error, "error"); return; }
    if (typeof renderAchievements === "function") renderAchievements();
    if (typeof renderCompendium === "function") renderCompendium();
    setAccountMessage(pulled.merged > 0 ? `Synced. ${pulled.merged} unlock(s) restored.` : "Synced.", "good");
  });
});

document.getElementById("accountLogOut")?.addEventListener("click", () => {
  runAccountAction("Logging out...", async () => {
    // Push before leaving so the last few unlocks of this session are not stranded.
    await accountPushProgress();
    accountLogOut();
    setAccountMessage("Logged out. Your progress stays on this device.");
  });
});

// A password-reset link drops the player back here with a recovery token in the URL. Detect
// it on load and let them set a new password immediately.
if (typeof accountHandleRecoveryLink === "function" && accountHandleRecoveryLink()) {
  const fresh = window.prompt("Enter a new password (6+ characters):");
  if (fresh && fresh.length >= 6) {
    runAccountAction("Updating your password...", async () => {
      const result = await accountSetPassword(fresh);
      setAccountMessage(result.ok ? "Password updated. You are signed in." : result.error, result.ok ? "good" : "error");
    });
  } else if (fresh !== null) {
    setAccountMessage("Password must be at least 6 characters. Use Forgot password to try again.", "error");
  }
}

// Signed in from a previous visit: quietly pull anything new. Failure is silent by design -
// a paused project or no connection should not greet the player with an error.
if (typeof isLoggedIn === "function" && isLoggedIn()) {
  accountPullProgress().then((result) => {
    if (result.ok && result.merged > 0) {
      if (typeof renderAchievements === "function") renderAchievements();
      if (typeof renderCompendium === "function") renderCompendium();
      }
  }).catch(() => {});
}

refreshAccountUi();
