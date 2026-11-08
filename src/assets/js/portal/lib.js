// VFL team portal — shared code for /portal/ and /admin/.
// Plain ES modules, no build step. The Supabase client is loaded from a CDN.

export const config = JSON.parse(document.getElementById("portal-config").textContent);

const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";

// ---------------------------------------------------------------- client
let client;
export async function getClient() {
  if (client) return client;
  // Test hook: the automated UI tests inject a stand-in client here.
  if (window.__VFL_TEST_CLIENT__) return (client = window.__VFL_TEST_CLIENT__);
  if (!config.supabaseUrl || !config.supabaseKey) return null;
  const { createClient } = await import(SUPABASE_JS);
  client = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

// ---------------------------------------------------------------- html
export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function html(strings, ...values) {
  return strings.reduce((out, s, i) => {
    const v = values[i - 1];
    const rendered = v && v.__raw ? v.value : Array.isArray(v) ? v.map((x) => (x && x.__raw ? x.value : esc(x))).join("") : esc(v);
    return out + rendered + s;
  });
}
export const raw = (value) => ({ __raw: true, value: String(value ?? "") });

// ---------------------------------------------------------------- toasts
let toastHost;
export function toast(message, kind = "ok") {
  if (!toastHost) {
    toastHost = document.createElement("div");
    toastHost.className = "toasts";
    toastHost.setAttribute("role", "status");
    toastHost.setAttribute("aria-live", "polite");
    document.body.appendChild(toastHost);
  }
  const el = document.createElement("div");
  el.className = `toast toast--${kind}`;
  el.textContent = message;
  toastHost.appendChild(el);
  setTimeout(() => el.classList.add("is-leaving"), kind === "err" ? 6000 : 3200);
  setTimeout(() => el.remove(), kind === "err" ? 6500 : 3700);
}

// Turn database / auth errors into something a captain can act on.
export function friendly(err) {
  const msg = String(err?.message || err || "Something went wrong.");
  const detail = `${msg} ${err?.details || ""}`;
  if (/players_unique_shirt_per_team/.test(detail)) return "Another player in the squad already has that shirt number.";
  if (/players_one_captain_per_team/.test(detail))  return "The squad already has a captain. Untick them first.";
  if (/teams_unique_name_per_season/.test(detail))  return "A team with that name already exists this season.";
  if (/free_agents_one_per_season/.test(detail))    return "You already have a free-agent profile this season. Reload the page to see it.";
  if (/free_agents_phone_check/.test(detail))       return "That doesn't look like a phone number.";
  if (/players_one_place_per_free_agent/.test(detail)) return "That player is already in your squad.";
  if (/must be 18 or over/.test(msg))                return "Players must be 18 or over.";
  if (/row-level security|permission denied/i.test(detail)) return "You can't change that. If the season is locked, contact the organisers.";
  if (/Failed to fetch|NetworkError/i.test(msg))   return "Can't reach the server. Check your connection and try again.";
  if (/rate limit|only request this after/i.test(msg)) return msg.replace(/^.*?(you can only)/i, "For security, you can only");
  if (/captcha/i.test(msg)) return "The spam check failed or expired. Complete it again and retry.";
  if (/Token has expired|invalid|otp/i.test(msg) && /token|otp|code/i.test(msg)) return "That code or link has expired or is wrong. Ask for a new one.";
  return msg;
}

// ---------------------------------------------------------------- dates
export function fmtDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return d.toLocaleDateString("en-GB", opts);
}
export function fmtDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function ageOn(dob, on = new Date()) {
  const d = new Date(dob + "T12:00:00");
  let a = on.getFullYear() - d.getFullYear();
  const m = on.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < d.getDate())) a--;
  return a;
}
// Latest date of birth for an 18-year-old today, as YYYY-MM-DD (the league is 18+).
export function adultMaxDob(on = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${on.getFullYear() - 18}-${p(on.getMonth() + 1)}-${p(on.getDate())}`;
}

// ---------------------------------------------------------------- countries
// ISO 3166-1 alpha-2, plus Kosovo (XK), which football recognises.
const ISO = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD " +
  "GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM " +
  "KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA " +
  "NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ " +
  "SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU " +
  "WF WS XK YE YT ZA ZM ZW").split(" ");

// Football counts the home nations separately, so they go first.
const HOME_NATIONS = [
  ["GB-ENG", "England"], ["GB-SCT", "Scotland"], ["GB-WLS", "Wales"], ["GB-NIR", "Northern Ireland"],
];

let countryList;
export function countries() {
  if (countryList) return countryList;
  let names;
  try { names = new Intl.DisplayNames(["en-GB"], { type: "region" }); } catch { names = null; }
  const rest = ISO.map((c) => [c, names?.of(c) || c]).sort((a, b) => a[1].localeCompare(b[1], "en-GB"));
  countryList = { home: HOME_NATIONS, rest };
  return countryList;
}
export function countryName(code) {
  if (!code) return "";
  const home = HOME_NATIONS.find(([c]) => c === code);
  if (home) return home[1];
  return countries().rest.find(([c]) => c === code)?.[1] || code;
}
export function countryOptions(selected) {
  const { home, rest } = countries();
  const opt = ([c, n]) => `<option value="${c}"${c === selected ? " selected" : ""}>${esc(n)}</option>`;
  return `<option value="" disabled${selected ? "" : " selected"}>Choose…</option>` +
    `<optgroup label="Home nations">${home.map(opt).join("")}</optgroup>` +
    `<optgroup label="All countries">${rest.map(opt).join("")}</optgroup>`;
}

export const positions = config.positions || [
  { value: "forward", label: "Forward" }, { value: "goalkeeper", label: "Goalkeeper" },
];
export const positionLabel = (v) => positions.find((p) => p.value === v)?.label || v;

// ---------------------------------------------------------------- validation
// Mirrors the database rules so people see problems before they hit Save.
export function validatePlayer(p) {
  const errs = {};
  const name = (p.full_name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2) errs.full_name = "Enter the player's name.";
  else if (name.length > 80) errs.full_name = "That name is too long.";

  if (!p.date_of_birth) errs.date_of_birth = "Enter a date of birth.";
  else {
    const d = new Date(p.date_of_birth + "T12:00:00");
    const age = ageOn(p.date_of_birth);
    if (isNaN(d)) errs.date_of_birth = "That isn't a valid date.";
    else if (d.getFullYear() < 1920) errs.date_of_birth = "That date is too early.";
    else if (age < 18) errs.date_of_birth = "Players must be 18 or over.";
  }

  if (p.shirt_number !== "" && p.shirt_number != null) {
    const n = Number(p.shirt_number);
    if (!Number.isInteger(n) || n < 0 || n > 99) errs.shirt_number = "Use a whole number from 0 to 99.";
  }
  if (!positions.some((x) => x.value === p.position)) errs.position = "Choose a position.";
  if (!/^[A-Z]{2}(-[A-Z]{3})?$/.test(p.nationality || "")) errs.nationality = "Choose a nationality.";
  if (p.height_cm !== "" && p.height_cm != null) {
    const h = Number(p.height_cm);
    if (!Number.isInteger(h) || h < 120 || h > 230) errs.height_cm = "Height in cm, between 120 and 230.";
  }
  return errs;
}

// ---------------------------------------------------------------- logos
export function logoUrl(sb, path) {
  if (!path) return "";
  if (sb?.storage?.from) return sb.storage.from("team-logos").getPublicUrl(path).data.publicUrl;
  return `${config.supabaseUrl}/storage/v1/object/public/team-logos/${path}`;
}
export const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export const LOGO_MAX = 2 * 1024 * 1024;
export const initials = (name) =>
  String(name || "?").replace(/^FC\s+/i, "").replace(/\s+London$/i, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

// ---------------------------------------------------------------- csv
// RFC 4180, with a BOM so Excel opens UTF-8 names correctly, and a guard
// against spreadsheet formula injection (a cell starting = + - @).
export function toCsv(columns, rows) {
  const cell = (v) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => cell(c.label)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(typeof c.get === "function" ? c.get(r) : r[c.get])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
export function download(filename, text, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- sign in
// Handles the link from the email (?token_hash=…&type=email). Works in any
// browser, unlike PKCE links, so opening the email on a phone is fine.
async function consumeEmailLink(sb) {
  const qs = new URLSearchParams(location.search);
  const tokenHash = qs.get("token_hash");
  const errDesc = qs.get("error_description");
  if (!tokenHash && !errDesc) return null;
  ["token_hash", "type", "error", "error_code", "error_description"].forEach((k) => qs.delete(k));
  history.replaceState(null, "", location.pathname + (qs.toString() ? "?" + qs : "") + location.hash);
  if (errDesc) return errDesc;
  const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  return error ? friendly(error) : null;
}

// ---------------------------------------------------------------- spam check
// Optional Cloudflare Turnstile. Only used when site.json has
// portal.turnstileSiteKey AND CAPTCHA protection is on in Supabase Auth
// (the secret key lives there). Supabase then refuses sign-in emails
// without a fresh token, which stops bots signing up free agents in bulk.
const CAPTCHA_KEY = config.turnstileSiteKey || "";
let turnstileLoading;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  turnstileLoading ||= new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    sc.async = true;
    sc.onload = () => resolve(window.turnstile);
    sc.onerror = () => { turnstileLoading = null; reject(new Error("The spam check didn't load. Check your connection and reload the page.")); };
    document.head.appendChild(sc);
  });
  return turnstileLoading;
}

function signInView(root, sb, { title, intro, linkError }) {
  let email = "";
  let cooldown = 0;
  let timer;
  const captcha = { token: "", id: null };

  // (Re)draws the widget into the current form; tokens are single-use.
  const mountCaptcha = () => {
    if (!CAPTCHA_KEY) return;
    const box = root.querySelector("[data-captcha]");
    if (!box) return;
    captcha.token = "";
    loadTurnstile().then((ts) => {
      if (!box.isConnected) return;
      captcha.id = ts.render(box, {
        sitekey: CAPTCHA_KEY, theme: "dark", size: "flexible",
        callback: (t) => { captcha.token = t; },
        "expired-callback": () => { captcha.token = ""; },
        "error-callback": () => { captcha.token = ""; },
      });
    }).catch((err) => { box.textContent = err.message; box.classList.add("form-status--err"); });
  };

  const renderEmail = (msg, kind = "err") => {
    root.innerHTML = html`
      <div class="portal-auth panel">
        <div class="eyebrow">Sign in</div>
        <h2>${title}</h2>
        <p class="muted">${intro}</p>
        <form class="form" data-step="email" novalidate>
          <div class="field">
            <label for="auth-email">Email address</label>
            <input id="auth-email" name="email" type="email" autocomplete="email" required value="${email}" placeholder="you@studio.com">
          </div>
          ${CAPTCHA_KEY ? raw(`<div class="captcha" data-captcha></div>`) : ""}
          <div class="form-status ${msg ? `is-visible form-status--${kind}` : ""}" role="status">${msg || ""}</div>
          <button class="btn" type="submit">Email me a sign-in link</button>
        </form>
        <p class="form-note">No password needed. We'll send a link and a code to this address.</p>
      </div>`;
    root.querySelector("input").focus();
    mountCaptcha();
  };

  const renderCode = (msg, kind = "ok") => {
    root.innerHTML = html`
      <div class="portal-auth panel">
        <div class="eyebrow">Check your inbox</div>
        <h2>We've emailed ${email}</h2>
        <p class="muted">Click the link in the email, or type the code from it here. Both work for an hour. If nothing arrives in a couple of minutes, check your spam folder.</p>
        <form class="form" data-step="code" novalidate>
          <div class="field">
            <label for="auth-code">Code from the email</label>
            <input id="auth-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" required class="code-input" placeholder="••••••">
          </div>
          <div class="form-status ${msg ? `is-visible form-status--${kind}` : ""}" role="status">${msg || ""}</div>
          ${CAPTCHA_KEY ? raw(`<details class="captcha-resend"><summary>Didn't get it?</summary><p class="form-note">Complete the check, then press Resend.</p><div class="captcha" data-captcha></div></details>`) : ""}
          <div class="btn-row">
            <button class="btn" type="submit">Sign in</button>
            <button class="btn btn--ghost" type="button" data-resend ${cooldown ? "disabled" : ""}>${cooldown ? `Resend in ${cooldown}s` : "Resend"}</button>
            <button class="btn btn--ghost" type="button" data-change>Use a different email</button>
          </div>
        </form>
      </div>`;
    root.querySelector("input").focus();
    mountCaptcha();
  };

  const startCooldown = () => {
    cooldown = 60;
    clearInterval(timer);
    timer = setInterval(() => {
      cooldown--;
      const b = root.querySelector("[data-resend]");
      if (b) { b.disabled = cooldown > 0; b.textContent = cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"; }
      if (cooldown <= 0) clearInterval(timer);
    }, 1000);
  };

  const send = async () => {
    if (CAPTCHA_KEY && !captcha.token) throw new Error("Complete the spam check first.");
    const options = { shouldCreateUser: true, emailRedirectTo: location.origin + "/portal/" };
    if (CAPTCHA_KEY) options.captchaToken = captcha.token;
    try {
      const { error } = await sb.auth.signInWithOtp({ email, options });
      if (error) throw error;
    } finally {
      // a token works once, so get a fresh one ready for a resend
      if (CAPTCHA_KEY) { captcha.token = ""; try { window.turnstile?.reset(captcha.id); } catch { /* gone */ } }
    }
    startCooldown();
  };

  root.onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      if (form.dataset.step === "email") {
        email = form.email.value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { renderEmail("Enter a valid email address."); return; }
        btn.textContent = "Sending…";
        await send();
        renderCode();
      } else {
        const token = form.code.value.replace(/\D/g, "");
        if (token.length < 6) { renderCode("Enter the code from the email.", "err"); return; }
        btn.textContent = "Checking…";
        const { error } = await sb.auth.verifyOtp({ email, token, type: "email" });
        if (error) throw error;
        // onAuthStateChange takes it from here
      }
    } catch (err) {
      form.dataset.step === "email" ? renderEmail(friendly(err)) : renderCode(friendly(err), "err");
    } finally {
      const b = root.querySelector("[type=submit]");
      if (b) b.disabled = false;
    }
  };

  root.onclick = async (e) => {
    if (e.target.closest("[data-change]")) { clearInterval(timer); renderEmail(); }
    if (e.target.closest("[data-resend]")) {
      try { await send(); renderCode("Sent again."); } catch (err) { renderCode(friendly(err), "err"); }
    }
  };

  renderEmail(linkError, "err");
}

export function notConfigured(root) {
  root.innerHTML = html`
    <div class="panel portal-auth">
      <div class="eyebrow eyebrow--plain">Not set up yet</div>
      <h2>The team portal isn't connected</h2>
      <p class="muted">Add the Supabase project URL and publishable key to <code>src/_data/site.json</code> under <code>portal</code>. The steps are in <code>supabase/README.md</code>.</p>
    </div>`;
}

// Wires up auth for a page. `onReady(sb, user)` runs whenever someone is
// signed in; the sign-in form is shown otherwise.
export async function startPage(root, { title, intro, onReady }) {
  const sb = await getClient();
  if (!sb) return notConfigured(root);

  root.innerHTML = `<div class="portal-loading" aria-busy="true">Loading…</div>`;
  const linkError = await consumeEmailLink(sb);

  let currentUser = null;
  const show = (session) => {
    const user = session?.user || null;
    if (user && currentUser && user.id === currentUser.id) return; // token refresh etc.
    currentUser = user;
    root.onsubmit = null;
    root.onclick = null;
    root.onchange = null;
    root.oninput = null;
    if (user) onReady(sb, user);
    else signInView(root, sb, { title, intro, linkError });
  };

  const { data } = await sb.auth.getSession();
  show(data.session);
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") show(session);
  });
}

export async function signOut(sb) {
  await sb.auth.signOut();
}

// ---------------------------------------------------------------- kits
// Common kit colours. Stored as lowercase hex; anything else comes in through
// the custom picker and is shown as its hex code.
export const KIT_COLOURS = [
  ["#ffffff", "White"], ["#111111", "Black"], ["#8a8d91", "Grey"],
  ["#c8102e", "Red"], ["#6d1f2c", "Claret"], ["#f26b21", "Orange"],
  ["#ffd200", "Yellow"], ["#b8902e", "Gold"], ["#128a3c", "Green"],
  ["#0b4d2c", "Dark green"], ["#0d8c8c", "Teal"], ["#6cabdd", "Sky blue"],
  ["#1d4ed8", "Royal blue"], ["#13213c", "Navy"], ["#5b2a86", "Purple"],
  ["#f08bb4", "Pink"],
];
export const KIT_MAX = 3;
export const KIT_ROLES = ["Shirt", "Sleeves", "Trim"];

export function normHex(v) {
  const s = String(v || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return "#" + s.slice(1).split("").map((c) => c + c).join("");
  return null;
}
export const colourName = (hex) => KIT_COLOURS.find(([h]) => h === hex)?.[1] || String(hex || "").toUpperCase();
export const kitLabel = (kit) => (kit && kit.length ? kit.map(colourName).join(" / ") : "");

// A small shirt drawn in the kit's colours: 1st colour is the shirt, 2nd the
// sleeves, 3rd the collar and cuffs. Outlined so white and black both show up
// on the dark page.
export function shirtSvg(kit, { size = 64, label = "" } = {}) {
  const empty = !kit || !kit.length;
  const [c1, c2 = c1, c3 = c2] = empty ? [] : kit;
  const line = "rgba(255,255,255,0.32)";
  const title = label ? `<title>${esc(label)}</title>` : "";
  if (empty) {
    return `<svg class="shirt shirt--empty" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${esc(label || "No colours chosen")}">${title}
      <path d="M21 11 L9 18 L14 29 L21 25 Z M43 11 L55 18 L50 29 L43 25 Z M21 11 L27 8 C29 11 35 11 37 8 L43 11 L43 56 C36 58 28 58 21 56 Z"
        fill="none" stroke="${line}" stroke-width="1.2" stroke-dasharray="3 2.5" stroke-linejoin="round"/></svg>`;
  }
  return `<svg class="shirt" viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${esc(label || kitLabel(kit))}">${title}
    <path d="M21 11 L9 18 L14 29 L21 25 Z" fill="${c2}" stroke="${line}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M43 11 L55 18 L50 29 L43 25 Z" fill="${c2}" stroke="${line}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M21 11 L27 8 C29 11 35 11 37 8 L43 11 L43 56 C36 58 28 58 21 56 Z" fill="${c1}" stroke="${line}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M27 8 C29 11.5 35 11.5 37 8" fill="none" stroke="${c3}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M9.6 19.3 L13.4 27.7 M54.4 19.3 L50.6 27.7" fill="none" stroke="${c3}" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`;
}

// ---------------------------------------------------------------- preferred foot
export const FEET = config.feet || [
  { value: "right", label: "Right" }, { value: "left", label: "Left" },
];
export const footLabel = (v) => ({ right: "Right", left: "Left", both: "Both" }[v] || "");

// ---------------------------------------------------------------- player photos
// Photos are shrunk in the browser before upload: longest side 640 px, JPEG.
// A typical phone photo (3–6 MB) comes out at 50–150 KB, so 200 players fit in
// about 2% of Supabase's free 1 GB. The bucket also refuses anything over 1 MB,
// so nobody can skip this step.
export const PHOTO = { maxSide: 640, quality: 0.85, maxInput: 25 * 1024 * 1024, maxOutput: 900 * 1024 };
const PHOTO_BUCKET = "player-photos";

function loadViaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image. Try a JPG or PNG.")); };
    img.src = url;
  });
}

export async function shrinkPhoto(file) {
  if (!file) throw new Error("No file chosen.");
  const looksLikeImage = /^image\//.test(file.type || "") || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name || "");
  if (!looksLikeImage) throw new Error("That file isn't an image.");
  if (file.size > PHOTO.maxInput) throw new Error("That photo is over 25 MB. Try a different one.");

  let src;
  try {
    // from-image: respect the phone's rotation flag, or portraits come out sideways
    src = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    src = await loadViaImg(file);
  }
  const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
  if (!sw || !sh) throw new Error("Couldn't read that image. Try a JPG or PNG.");
  const scale = Math.min(1, PHOTO.maxSide / Math.max(sw, sh));   // never enlarge
  const w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";                  // transparent PNGs get a white background
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  src.close?.();

  let q = PHOTO.quality, blob;
  do {
    blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
    q -= 0.1;
  } while (blob && blob.size > PHOTO.maxOutput && q > 0.4);
  if (!blob) throw new Error("Couldn't read that image. Try a JPG or PNG.");
  return { blob, width: w, height: h, size: blob.size, originalSize: file.size };
}

export const fmtBytes = (n) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

// Private bucket: photos are shown through links that expire after an hour.
export async function photoUrls(sb, paths) {
  const list = [...new Set((paths || []).filter(Boolean))];
  if (!list.length) return {};
  const { data, error } = await sb.storage.from(PHOTO_BUCKET).createSignedUrls(list, 3600);
  if (error || !data) return {};
  return Object.fromEntries(data.filter((x) => x && x.signedUrl).map((x) => [x.path, x.signedUrl]));
}

// Storage occasionally answers 502/503/504 (Supabase's side, usually brief).
// So: give each attempt 20 s, retry once on a server error or timeout, and
// let the caller save the player without the photo if it still fails.
export const PHOTO_UPLOAD = { timeout: 20000, tries: 2 };

function withTimeout(promise, ms) {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error("The photo upload timed out.");
      e.name = "TimeoutError";
      reject(e);
    }, ms);
  });
  return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}

function errStatus(err) {
  const n = Number(err?.status ?? err?.statusCode ?? err?.originalError?.status);
  return Number.isFinite(n) ? n : 0;
}

// Worth another go: timeouts, network blips and 5xx. Not: too big, wrong type, not allowed.
export function isRetryableUpload(err) {
  if (err?.name === "TimeoutError") return true;
  const s = errStatus(err);
  if (s >= 500) return true;
  if (s >= 400) return false;
  return !/row-level security|exceeded|too large|mime|not allowed|Bucket not found/i.test(String(err?.message || ""));
}

export async function uploadPhoto(sb, teamId, blob, { onRetry } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= PHOTO_UPLOAD.tries; attempt++) {
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const path = `${teamId}/${id}.jpg`;
    try {
      const { error } = await withTimeout(
        sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false }),
        Number(globalThis.__VFL_TEST_UPLOAD_TIMEOUT__) || PHOTO_UPLOAD.timeout);
      if (error) throw error;
      return path;
    } catch (err) {
      lastErr = err;
      // If it landed after all (slow, not failed), don't leave it lying around.
      Promise.resolve(sb.storage.from(PHOTO_BUCKET).remove([path])).catch(() => {});
      if (attempt >= PHOTO_UPLOAD.tries || !isRetryableUpload(err)) break;
      onRetry?.(attempt);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

export async function removePhotos(sb, paths) {
  const list = (paths || []).filter(Boolean);
  for (let i = 0; i < list.length; i += 1000) {           // the API takes up to 1,000 at a time
    await sb.storage.from(PHOTO_BUCKET).remove(list.slice(i, i + 1000));
  }
}

// ---------------------------------------------------------------- zip
// A minimal ZIP writer (no compression: JPEGs are already compressed), so the
// organiser board can hand over every photo in one download with no library.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function makeZip(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true);
    loc.setUint16(8, 0, true); loc.setUint16(10, dosTime, true); loc.setUint16(12, dosDate, true);
    loc.setUint32(14, crc, true); loc.setUint32(18, data.length, true); loc.setUint32(22, data.length, true);
    loc.setUint16(26, name.length, true); loc.setUint16(28, 0, true);
    parts.push(new Uint8Array(loc.buffer), name, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true); cen.setUint16(12, dosTime, true);
    cen.setUint16(14, dosDate, true); cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true);
    cen.setUint32(24, data.length, true); cen.setUint16(28, name.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cenSize = central.reduce((a, c) => a + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}
export const safeFileName = (s) =>
  String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "unnamed";
