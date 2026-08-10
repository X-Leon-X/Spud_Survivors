"use strict";

// account.js - optional cloud accounts: sign up, log in, password recovery, and syncing
// achievements/compendium/run history to Supabase.
//
// WHY NO SDK: the Supabase JS library is a large dependency for the four endpoints this
// actually uses (sign up, sign in, recover, and a REST upsert). Everything here is plain
// fetch against the documented HTTP API, so the game keeps loading zero external scripts
// and still runs completely offline with accounts simply unavailable.
//
// WHAT IS SAFE TO SHIP: ACCOUNT_KEY below is Supabase's PUBLISHABLE key. It is designed to
// live in client code and identifies the project, not the user. It grants nothing on its
// own -- every table has Row Level Security requiring auth.uid() to match the row's
// user_id, so a caller holding only this key cannot read or write anyone's data. The
// service_role key, which WOULD bypass all of that, must never appear in this repo.
//
// ACCOUNTS ARE OPTIONAL. The game is fully playable logged out; progress then lives in
// session storage and moves via progress codes exactly as before. Nothing here may ever
// block play, so every network path fails soft.

const ACCOUNT_URL = "https://pirppogtzrgrisovvifg.supabase.co";
const ACCOUNT_KEY = "sb_publishable_Z7OBxHpC0pebCKkefgkdmw_z2Wg2FUG";

// The login token persists in localStorage, NOT sessionStorage: staying logged in across
// sessions is the entire point of an account. Session-scoped progress (see 03c-achievements)
// is a separate concern and stays session-scoped.
const ACCOUNT_SESSION_KEY = "spud-survivors-session";

let accountSession = loadAccountSession();

function loadAccountSession() {
  try {
    const stored = JSON.parse(localStorage.getItem(ACCOUNT_SESSION_KEY));
    if (!stored || typeof stored !== "object" || !stored.access_token) return null;
    return stored;
  } catch {
    return null;
  }
}

function saveAccountSession(session) {
  // Supabase returns expires_in (seconds from now). Convert it to an absolute timestamp on
  // the way in, because a relative value is meaningless once it has been sat in storage.
  if (session && session.expires_in && !session.expires_at) {
    session.expires_at = Date.now() + session.expires_in * 1000;
  }
  accountSession = session;
  try {
    if (session) localStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(ACCOUNT_SESSION_KEY);
  } catch {
    // Storage unavailable: the player simply logs in again next time.
  }
}

// Access tokens last about an hour. Without this, the first sync after that hour failed with
// "JWT expired" and stayed broken until the player logged in again by hand -- the refresh
// token was being stored and then never used. Refreshed a minute early so a request cannot
// set off with a token that expires mid-flight.
const ACCOUNT_TOKEN_SKEW_MS = 60 * 1000;

function accountTokenExpired() {
  if (!accountSession?.expires_at) return false;   // unknown expiry: let the request decide
  return Date.now() >= accountSession.expires_at - ACCOUNT_TOKEN_SKEW_MS;
}

let accountRefreshInFlight = null;

async function accountRefreshSession() {
  const refreshToken = accountSession?.refresh_token;
  if (!refreshToken) return false;
  // Collapse concurrent refreshes: pull and push fire together on login, and two refreshes
  // racing would spend the single-use refresh token twice and log the player out.
  if (accountRefreshInFlight) return accountRefreshInFlight;

  accountRefreshInFlight = (async () => {
    try {
      const response = await fetch(`${ACCOUNT_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: ACCOUNT_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      if (!response.ok || !data?.access_token) {
        // The refresh token itself is dead (revoked, or too long since the last visit).
        // Clear the session so the UI honestly shows a logged-out state.
        saveAccountSession(null);
        return false;
      }
      saveAccountSession({ ...accountSession, ...data });
      return true;
    } catch {
      return false;                                 // offline: keep the session, try later
    } finally {
      accountRefreshInFlight = null;
    }
  })();

  return accountRefreshInFlight;
}

function isLoggedIn() {
  return Boolean(accountSession?.access_token);
}

function accountEmail() {
  return accountSession?.user?.email ?? null;
}

// Shared fetch wrapper. Returns { ok, data, error } instead of throwing, because every
// caller here has to degrade gracefully rather than interrupt a run.
async function accountRequest(path, { method = "GET", body, auth = false, headers = {}, _retried = false } = {}) {
  // Refresh BEFORE sending if the token is known to be expired, so the common case costs one
  // round trip instead of failing and retrying.
  if (auth && accountTokenExpired()) {
    await accountRefreshSession();
  }

  const finalHeaders = {
    apikey: ACCOUNT_KEY,
    "Content-Type": "application/json",
    ...headers
  };
  if (auth && accountSession?.access_token) {
    finalHeaders.Authorization = `Bearer ${accountSession.access_token}`;
  }
  try {
    const response = await fetch(`${ACCOUNT_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    // Belt and braces: a token can still be rejected even when the clock said it was fine
    // (clock skew, or a session revoked server-side). Refresh once and replay the request.
    // _retried stops this recursing if the refreshed token is rejected too.
    if (!response.ok && auth && !_retried && (response.status === 401 || data?.code === "PGRST301")) {
      if (await accountRefreshSession()) {
        return accountRequest(path, { method, body, auth, headers, _retried: true });
      }
    }

    if (!response.ok) {
      return { ok: false, data, error: data?.msg || data?.error_description || data?.message || `Request failed (${response.status})` };
    }
    return { ok: true, data, error: null };
  } catch {
    // Offline, blocked, or the project is paused (free tier sleeps after 7 quiet days).
    return { ok: false, data: null, error: "Could not reach the server. Check your connection." };
  }
}

// --- Auth ------------------------------------------------------------------------------

async function accountSignUp(email, password) {
  const result = await accountRequest("/auth/v1/signup", {
    method: "POST",
    body: { email, password }
  });
  if (!result.ok) return result;
  // With email confirmation on, signup returns a user but NO session: the account does not
  // exist as far as logging in goes until the emailed link is clicked. Say so plainly
  // rather than pretending the player is logged in.
  if (result.data?.access_token) {
    saveAccountSession(result.data);
    return { ok: true, confirmed: true, error: null };
  }
  return { ok: true, confirmed: false, error: null };
}

async function accountLogIn(email, password) {
  const result = await accountRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password }
  });
  if (!result.ok) return result;
  saveAccountSession(result.data);
  return { ok: true, error: null };
}

function accountLogOut() {
  saveAccountSession(null);
}

// Password recovery: Supabase emails a reset link. The redirect lands back on the game with
// a recovery token in the URL fragment, which accountHandleRecoveryLink() below picks up.
async function accountRequestRecovery(email) {
  return accountRequest("/auth/v1/recover", {
    method: "POST",
    body: { email, gotrue_meta_security: {} },
    headers: { redirect_to: location.href.split("#")[0] }
  });
}

// Supabase returns the recovery session in the URL FRAGMENT (#access_token=...), which never
// reaches a server. If one is present, adopt it so the player is logged in and can set a new
// password, then strip it from the address bar so the token is not left sitting in history.
function accountHandleRecoveryLink() {
  if (!location.hash || location.hash.length < 2) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("access_token");
  const type = params.get("type");
  if (!token || type !== "recovery") return false;
  // Carry expires_in through as well, or this session would have no known expiry and would
  // only ever refresh reactively after a failed request.
  const expiresIn = Number(params.get("expires_in"));
  saveAccountSession({
    access_token: token,
    refresh_token: params.get("refresh_token"),
    expires_in: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : undefined,
    user: { email: null }
  });
  history.replaceState(null, "", location.pathname + location.search);
  return true;
}

async function accountSetPassword(password) {
  const result = await accountRequest("/auth/v1/user", {
    method: "PUT",
    auth: true,
    body: { password }
  });
  if (result.ok && result.data) {
    saveAccountSession({ ...accountSession, user: result.data });
  }
  return result;
}

// --- Progress sync ---------------------------------------------------------------------

// Pull the account's saved progress and MERGE it into whatever this session already has.
// Merge, never replace: a player who earned something before logging in must not lose it,
// which is the same rule the progress codes follow.
async function accountPullProgress() {
  if (!isLoggedIn()) return { ok: false, error: "Not logged in." };
  const result = await accountRequest("/rest/v1/profiles?select=achievements,compendium", { auth: true });
  if (!result.ok) return result;
  const row = Array.isArray(result.data) ? result.data[0] : null;
  if (!row) return { ok: true, merged: 0, error: null };

  let merged = 0;
  if (row.achievements && typeof row.achievements === "object") {
    for (const [id, value] of Object.entries(row.achievements)) {
      if (id === "_eggs") {
        if (value && typeof value === "object") {
          const eggs = (unlockedAchievements._eggs && typeof unlockedAchievements._eggs === "object")
            ? unlockedAchievements._eggs
            : {};
          for (const [egg, found] of Object.entries(value)) {
            if (found && !eggs[egg]) { eggs[egg] = true; merged += 1; }
          }
          unlockedAchievements._eggs = eggs;
        }
        continue;
      }
      if (value && !unlockedAchievements[id]) {
        unlockedAchievements[id] = value;
        merged += 1;
      }
    }
    saveAchievements();
  }
  if (typeof mergeCompendiumProgress === "function") {
    merged += mergeCompendiumProgress(row.compendium);
  }
  return { ok: true, merged, error: null };
}

// Push this session's progress up. Upsert on user_id so it works for a brand new account and
// an existing one alike.
async function accountPushProgress() {
  if (!isLoggedIn()) return { ok: false, error: "Not logged in." };
  const userId = accountSession?.user?.id;
  if (!userId) return { ok: false, error: "Session is missing a user id. Log in again." };
  return accountRequest("/rest/v1/profiles?on_conflict=user_id", {
    method: "POST",
    auth: true,
    headers: { Prefer: "resolution=merge-duplicates" },
    body: [{
      user_id: userId,
      achievements: unlockedAchievements,
      compendium: typeof getCompendiumProgressForExport === "function" ? getCompendiumProgressForExport() : {},
      updated_at: new Date().toISOString()
    }]
  });
}

// Record a finished run. Fire-and-forget: a failure here must never interrupt the summary
// screen, so the caller does not await it and nothing is shown if it fails.
async function accountRecordRun(summary) {
  if (!isLoggedIn()) return { ok: false, error: "Not logged in." };
  const userId = accountSession?.user?.id;
  if (!userId) return { ok: false, error: "No user id." };
  return accountRequest("/rest/v1/runs", {
    method: "POST",
    auth: true,
    headers: { Prefer: "return=minimal" },
    body: [{
      user_id: userId,
      character: summary?.character ?? null,
      wave: Math.max(1, Math.round(summary?.wave ?? 1)),
      kills: Math.max(0, Math.round(summary?.kills ?? 0)),
      scrap: Math.max(0, Math.round(summary?.scrap ?? 0)),
      time_played: Math.max(0, summary?.timePlayed ?? 0)
    }]
  });
}
