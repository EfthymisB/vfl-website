// VFL team portal — the page captains (team contacts) use.
import {
  startPage, signOut, html, raw, esc, toast, friendly, config,
  fmtDate, fmtDateTime, ageOn, adultMaxDob, countryOptions, countryName,
  positions, positionLabel, validatePlayer,
  logoUrl, LOGO_TYPES, LOGO_MAX, initials,
  KIT_COLOURS, KIT_MAX, KIT_ROLES, normHex, colourName, kitLabel, shirtSvg,
  FEET, footLabel, shrinkPhoto, photoUrls, uploadPhoto, removePhotos, fmtBytes, isRetryableUpload,
} from "./lib.js";
import { agentPage, poolSection, poolAction, pendingSignings, loanedOutBlock, joinedBadge } from "./agents.js";

const root = document.getElementById("portal");

// /portal/?join=free-agent starts the free-agent sign-up. The emailed sign-in
// link always lands on plain /portal/, so remember the intent across it.
const qs0 = new URLSearchParams(location.search);
const JOIN_KEY = "vfl-join-free-agent";
const joining = qs0.get("join") === "free-agent" || qs0.get("view") === "agent";
try {
  if (qs0.get("join") === "free-agent") localStorage.setItem(JOIN_KEY, "1");
} catch { /* private mode: the code route still works */ }

// The page header says "Team portal"; free agents get their own.
function retitleForAgents() {
  const hero = document.querySelector(".page-hero");
  if (!hero || hero.dataset.agent) return;
  hero.dataset.agent = "1";
  const eyebrow = hero.querySelector(".eyebrow"), h1 = hero.querySelector("h1"), p = hero.querySelector("p");
  if (eyebrow) eyebrow.textContent = "Looking for a team";
  if (h1) h1.textContent = "Free agents";
  if (p) p.textContent = "Your free-agent profile, and the teams that are interested in you.";
  document.title = document.title.replace("Team portal", "Free agents");
}
if (joining) retitleForAgents();

startPage(root, joining ? {
  title: "Free agents",
  intro: "Sign in with your email address to join the free-agent pool or check your offers. We'll email you a code: no password needed.",
  onReady: (sb, user) => load(sb, user),
} : {
  title: "Team portal",
  intro: "Register your squad for the new season. Use the email address the organisers invited.",
  onReady: (sb, user) => load(sb, user),
});

// ---------------------------------------------------------------- state
let S = null;

async function load(sb, user) {
  root.innerHTML = `<div class="portal-loading" aria-busy="true">Loading your team…</div>`;
  try {
    const email = (user.email || "").toLowerCase();
    const wanted = new URLSearchParams(location.search).get("team");

    const [{ data: role, error: e1 }, { data: seasons, error: e2 }] = await Promise.all([
      sb.rpc("my_board_role"),   // 'admin', 'viewer' (read-only organiser) or null
      sb.from("seasons").select("*").order("id", { ascending: false }),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const isAdmin = role === "admin", isViewer = role === "viewer";

    let teams;
    if (wanted && (isAdmin || isViewer)) {
      const { data, error } = await sb.from("teams").select("*").eq("id", wanted);
      if (error) throw error;
      teams = data;
    } else {
      const { data, error } = await sb.from("teams").select("*").eq("contact_email", email).order("created_at");
      if (error) throw error;
      teams = data;
    }

    S = { sb, user, email, isAdmin, isViewer, seasons, teams, team: null, players: [],
          asAdmin: !!(wanted && isAdmin), asViewer: !!(wanted && isViewer),
          pool: [], loanedOut: [], faFilter: "", hasAgent: false };

    // A free-agent profile this season? (Organisers can read every profile, so filter to their own.)
    const currentSeason = seasons.find((s) => s.is_current);
    if (currentSeason) {
      const { data } = await sb.from("free_agents").select("id").eq("season_id", currentSeason.id).eq("email", email);
      S.hasAgent = !!(data && data.length);
    }
    let joinIntent = false;
    try { joinIntent = localStorage.getItem(JOIN_KEY) === "1"; localStorage.removeItem(JOIN_KEY); } catch { /* ignore */ }

    if (!wanted && (joining || ((joinIntent || S.hasAgent) && !teams.length))) return openAgent();
    if (!teams.length) return renderNoTeam();
    const current = currentSeason?.id;
    const preferred = teams.find((t) => t.id === wanted) || teams.find((t) => t.season_id === current) || teams[teams.length - 1];
    await openTeam(preferred.id);
  } catch (err) {
    renderFatal(err);
  }
}

async function openTeam(id) {
  const { sb } = S;
  const [{ data: t, error: e1 }, { data: players, error: e2 }] = await Promise.all([
    sb.from("teams").select("*").eq("id", id),
    sb.from("players").select("*").eq("team_id", id).order("created_at"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  S.team = t[0];
  S.players = sortPlayers(players);
  // The free-agent pool is for the current season's teams only.
  const isCurrent = S.seasons.find((s) => s.id === S.team.season_id)?.is_current;
  if (isCurrent) {
    const [pool, loans] = await Promise.all([
      sb.rpc("fa_pool", { p_team: id }),
      sb.rpc("fa_loaned_out", { p_team: id }),
    ]);
    S.pool = pool.error ? [] : pool.data || [];
    S.loanedOut = loans.error ? [] : loans.data || [];
  } else {
    S.pool = []; S.loanedOut = [];
  }
  S.poolOn = !!isCurrent;
  S.photos = await photoUrls(sb, players.map((x) => x.photo_path));
  S.kits = { primary: [...(S.team.kit_primary || [])], secondary: [...(S.team.kit_secondary || [])] };
  S.season = S.seasons.find((s) => s.id === S.team.season_id) || { id: S.team.season_id, name: S.team.season_id, locked: false };
  render();
}

const sortPlayers = (list) =>
  [...list].sort((a, b) =>
    (b.is_captain - a.is_captain) ||
    ((a.position === "goalkeeper") - (b.position === "goalkeeper")) * -1 ||
    ((a.shirt_number ?? 999) - (b.shirt_number ?? 999)) ||
    a.full_name.localeCompare(b.full_name));

// A viewer looking at another team's page never gets edit controls.
const editable = () => !S.asViewer && (S.isAdmin || !S.season.locked);

// ---------------------------------------------------------------- views
function bar(where = "team") {
  return html`
    <div class="portal-bar">
      <span class="portal-bar__who">Signed in as <strong>${S.email}</strong></span>
      <span class="portal-bar__actions">
        ${where === "team" && S.hasAgent ? raw(`<a class="btn btn--ghost btn--sm" href="/portal/?view=agent">Your free-agent profile</a>`) : ""}
        ${where === "agent" && S.teams.length ? raw(`<a class="btn btn--ghost btn--sm" href="/portal/">Your team</a>`) : ""}
        ${S.isAdmin || S.isViewer ? raw(`<a class="btn btn--ghost btn--sm" href="/admin/">Organiser board</a>`) : ""}
        <button class="btn btn--ghost btn--sm" type="button" data-signout>Sign out</button>
      </span>
    </div>`;
}

function openAgent() {
  retitleForAgents();
  if (joining) history.replaceState(null, "", location.pathname + "?view=agent" + location.hash);
  return agentPage({
    root, sb: S.sb, email: S.email,
    season: S.seasons.find((s) => s.is_current) || null,
    bar: () => bar("agent"),
    signOut: () => signOut(S.sb),
  });
}

function renderNoTeam() {
  root.innerHTML = html`
    ${raw(bar())}
    <div class="panel portal-auth">
      <div class="eyebrow eyebrow--plain">No team found</div>
      <h2>${S.isAdmin ? "You're an organiser" : S.isViewer ? "You have read-only organiser access" : "This email isn't linked to a team"}</h2>
      ${S.isAdmin || S.isViewer
        ? raw(`<p class="muted">Teams are on the organiser board. To look at a team's squad, open it from there.</p>
               <div class="btn-row"><a class="btn" href="/admin/">Go to the organiser board</a></div>`)
        : raw(html`<p class="muted">The organisers invite each team by email. Ask them to add <strong>${S.email}</strong> as your team's contact, or sign in with the address they used.</p>
               <div class="btn-row"><a class="btn btn--ghost" href="/contact/">Contact the organisers</a></div>`)}
    </div>
    ${S.isAdmin || S.isViewer ? "" : raw(`
    <div class="panel panel--accent portal-auth">
      <div class="eyebrow">Looking for a team?</div>
      <h2>Join the free-agent pool</h2>
      <p class="muted">No team this season, or not getting game time? Put yourself in the pool and teams that are short of players can get in touch.</p>
      <div class="btn-row"><a class="btn" href="/portal/?join=free-agent">Join as a free agent</a></div>
    </div>`)}`;
  wireCommon();
}

function renderFatal(err) {
  root.innerHTML = html`
    <div class="panel portal-auth">
      <div class="eyebrow eyebrow--plain">Something went wrong</div>
      <h2>We couldn't load the portal</h2>
      <p class="muted">${friendly(err)}</p>
      <div class="btn-row"><button class="btn" type="button" onclick="location.reload()">Try again</button></div>
    </div>`;
}

function steps() {
  const t = S.team, p = S.players;
  const captains = p.filter((x) => x.is_captain).length;
  const missing = [
    !t.studio && "studio", !t.short_name && "short name", !t.contact_name && "your name",
  ].filter(Boolean);
  const kp = (t.kit_primary || []).length, ks = (t.kit_secondary || []).length;
  return [
    { key: "details", label: "Team details", done: !missing.length,
      hint: missing.length ? `Add ${missing.join(", ")}` : t.studio === t.name ? t.name : t.studio },
    { key: "kits",    label: "Kits",         done: kp > 0 && ks > 0,
      hint: !kp && !ks ? "Pick your colours" : !kp ? "Add a primary kit" : !ks ? "Add a secondary kit" : kitLabel(t.kit_primary) },
    { key: "logo",    label: "Logo",         done: !!t.logo_path, hint: t.logo_path ? "" : "Upload your badge" },
    { key: "squad",   label: "Squad",        done: p.length > 0 && captains === 1,
      hint: !p.length ? "Add your players" : captains !== 1 ? "Pick a captain" : `${p.length} player${p.length === 1 ? "" : "s"}` },
    { key: "fee",     label: "Fee",          done: t.paid, hint: t.paid ? (t.paid_at ? `Received ${fmtDate(t.paid_at)}` : "Received") : "Organisers will confirm" },
    { key: "signoff", label: "Signed off",   done: !!t.signed_off_at, hint: t.signed_off_at ? fmtDate(t.signed_off_at) : "Last step" },
  ];
}

function render() {
  const t = S.team;
  const st = steps();
  const doneCount = st.filter((s) => s.done).length;
  const logo = logoUrl(S.sb, t.logo_path);
  const can = editable();
  const dis = can ? "" : "disabled";
  const sameStudio = !!t.studio && t.studio === t.name;

  root.innerHTML = html`
    ${raw(bar())}

    ${S.asAdmin ? raw(html`<div class="portal-flag portal-flag--admin"><strong>Organiser view</strong> You're editing ${t.name} as an organiser. Your changes don't clear their sign-off.</div>`) : ""}
    ${S.asViewer ? raw(html`<div class="portal-flag portal-flag--lock"><strong>Read-only</strong> You're looking at ${t.name} with read-only organiser access. Nothing here can be changed.</div>`) : ""}
    ${S.season.locked && !S.asViewer ? raw(html`<div class="portal-flag portal-flag--lock"><strong>Locked</strong> The ${S.season.name} squads are locked${S.isAdmin ? " for captains. You can still edit as an organiser." : ". Contact the organisers if something needs changing."}</div>`) : ""}
    ${S.teams.length > 1 && !S.asAdmin && !S.asViewer ? raw(teamPicker()) : ""}

    <section class="portal-hero">
      <div class="portal-hero__badge">
        ${logo ? raw(html`<img src="${logo}" alt="" width="72" height="72">`) : raw(html`<span>${initials(t.name)}</span>`)}
      </div>
      <div class="portal-hero__text">
        <div class="eyebrow">${S.season.name}</div>
        <h2 class="portal-hero__title">${t.name}</h2>
        <p class="muted">${doneCount} of ${st.length} steps done</p>
      </div>
    </section>

    <ol class="steps">
      ${st.map((s) => raw(html`
        <li class="step ${s.done ? "is-done" : ""}">
          <a href="#${s.key}">
            <span class="step__dot" aria-hidden="true">${s.done ? "✓" : ""}</span>
            <span class="step__label">${s.label}<span class="visually-hidden">${s.done ? " (done)" : " (to do)"}</span></span>
            <span class="step__hint">${s.hint}</span>
          </a>
        </li>`))}
    </ol>

    <div class="portal-grid">
      <section class="panel" id="details">
        <h2 class="portal-h">Team details</h2>
        <form class="form" data-form="details">
          <div class="field">
            <label for="t-name">Team name</label>
            <input id="t-name" name="name" required maxlength="80" value="${t.name}" ${dis}>
          </div>
          <div class="field">
            <label for="t-studio">Company / studio represented</label>
            <input id="t-studio" name="studio" maxlength="80" value="${t.studio || ""}" placeholder="e.g. Industrial Light & Magic" ${dis} ${sameStudio ? "readonly" : ""}>
            <label class="check check--sm">
              <input type="checkbox" name="studio_same" data-studio-same ${sameStudio ? "checked" : ""} ${dis}>
              <span>Same as team name</span>
            </label>
          </div>
          <div class="field">
            <label for="t-short">Short name <span class="opt">how it appears in tables, e.g. ILM</span></label>
            <input id="t-short" name="short_name" maxlength="30" value="${t.short_name || ""}" placeholder="e.g. ILM" ${dis}>
          </div>
          <div class="field">
            <label for="t-contact">Your name</label>
            <input id="t-contact" name="contact_name" maxlength="80" value="${t.contact_name || ""}" autocomplete="name" ${dis}>
          </div>
          <p class="form-note">Contact email: <strong>${t.contact_email}</strong>. To change it, ask the organisers.</p>
          ${can ? raw(`<div class="btn-row"><button class="btn" type="submit">Save details</button></div>`) : ""}
        </form>
      </section>

      <section class="panel" id="logo">
        <h2 class="portal-h">Logo</h2>
        <div class="logo-drop">
          <div class="logo-drop__preview">
            ${logo ? raw(html`<img src="${logo}" alt="Current logo">`) : raw(html`<span>${initials(t.name)}</span>`)}
          </div>
          <div>
            <p class="muted">PNG, JPG or WebP, up to 2 MB. Square works best — a transparent background is ideal.</p>
            ${can ? raw(`
              <label class="btn btn--ghost btn--sm logo-drop__btn">
                <input type="file" accept="image/png,image/jpeg,image/webp" data-logo hidden>
                ${t.logo_path ? "Replace logo" : "Upload logo"}
              </label>`) : ""}
          </div>
        </div>
      </section>
    </div>

    <section class="panel" id="kits">
      <div class="portal-section-head">
        <h2 class="portal-h">Kit colours</h2>
        <span class="form-note" data-kits-state></span>
      </div>
      <p class="muted kits-intro">Pick 1 to 3 colours for each kit, in order: shirt, then sleeves, then trim. The organisers use these to spot clashes.</p>
      <div class="kits" data-kits>${raw(kitsBody())}</div>
      ${can ? raw(`<div class="btn-row"><button class="btn btn--sm" type="button" data-kits-save>Save kit colours</button></div>`) : ""}
    </section>

    <section class="panel" id="squad">
      <div class="portal-section-head">
        <h2 class="portal-h">Squad <span class="count">${S.players.length}</span></h2>
        ${can ? raw(`<button class="btn btn--sm" type="button" data-add>Add player</button>`) : ""}
      </div>
      ${raw(signingsBanner())}
      ${S.players.length ? raw(squadList()) : raw(`<p class="muted empty">No players yet. Add your squad one player at a time — you can come back and edit until the organisers lock the season.</p>`)}
      ${raw(loanedOutBlock(S.loanedOut))}
    </section>

    ${S.poolOn ? raw(poolHtml()) : ""}

    <section class="panel" id="notes">
      <h2 class="portal-h">Notes for the organisers</h2>
      <p class="muted">Anything we should know: dates you can't play, kick-off times that suit, shirt numbers, kit clashes, questions.</p>
      <form class="form" data-form="notes">
        <div class="field">
          <label for="t-notes" class="visually-hidden">Notes for the organisers</label>
          <textarea id="t-notes" name="team_notes" rows="5" maxlength="2000" placeholder="e.g. Most of us are on a delivery until 14 March, so we'd rather not play Thursdays before then." ${dis}>${t.team_notes || ""}</textarea>
          <span class="char-count" data-count>${(t.team_notes || "").length} / 2000</span>
        </div>
        ${can ? raw(`<div class="btn-row"><button class="btn btn--sm" type="submit">Save notes</button></div>`) : ""}
      </form>
    </section>

    <section class="panel ${t.signed_off_at ? "panel--accent" : ""}" id="signoff">
      <h2 class="portal-h">Sign off the squad</h2>
      ${raw(signOffBlock())}
    </section>

    <section class="panel" id="fee">
      <h2 class="portal-h">Membership fee</h2>
      ${t.paid
        ? raw(html`<p><span class="pill pill--ok">Paid</span> Received${t.paid_at ? ` ${fmtDate(t.paid_at)}` : ""}${t.paid_note ? ` — ${t.paid_note}` : ""}. Thanks.</p>`)
        : raw(`<p><span class="pill">Not yet confirmed</span> Pay the fee as arranged with the organisers. They'll mark it here once it arrives — you don't need to do anything in the portal.</p>`)}
    </section>

    <dialog class="player-dialog" data-dialog></dialog>`;

  wireCommon();
}

// ---------------------------------------------------------------- free agents
function poolHtml() {
  return poolSection({ pool: S.pool, filter: S.faFilter, players: S.players, locked: !editable(), readOnly: S.asViewer });
}

function signingsBanner() {
  const pending = pendingSignings(S.pool, S.players);
  if (!pending.length) return "";
  return pending.map((a) => html`
    <div class="portal-flag portal-flag--new">
      <strong>New signing</strong>
      <span>${a.full_name} accepted your offer${a.is_loan ? ` (on loan from ${a.current_team})` : ""}. Add their details to put them in the squad.</span>
      ${editable() ? raw(html`<button class="btn btn--sm" type="button" data-fa-add="${a.id}">Add to squad</button>`) : ""}
    </div>`).join("");
}

function redrawPool() {
  const el = root.querySelector("#free-agents");
  if (el) el.outerHTML = poolHtml();
}

async function reloadPool() {
  const { data, error } = await S.sb.rpc("fa_pool", { p_team: S.team.id });
  if (!error) S.pool = data || [];
  // a new signing changes the squad panel and sign-off too
  if (pendingSignings(S.pool, S.players).length) return openTeam(S.team.id);
  redrawPool();
}

// ---------------------------------------------------------------- kits
function kitsBody() {
  return kitPicker("primary", "Primary kit") + kitPicker("secondary", "Secondary kit");
}

function kitPicker(which, title) {
  const kit = S.kits[which];
  const can = editable();
  const full = kit.length >= KIT_MAX;
  const chosen = kit.length
    ? kit.map((hex, i) => html`
        <li class="kit-chip">
          <span class="kit-chip__dot" style="--c:${hex}"></span>
          <span class="kit-chip__role">${KIT_ROLES[i]}</span>
          <span class="kit-chip__name">${colourName(hex)}</span>
          ${can ? raw(html`<button type="button" class="kit-chip__x" data-kit-remove="${which}" data-i="${i}" aria-label="Remove ${colourName(hex)}">×</button>`) : ""}
        </li>`).join("")
    : html`<li class="kit-chip kit-chip--empty">No colours yet</li>`;

  const palette = KIT_COLOURS.map(([hex, name]) => {
    const at = kit.indexOf(hex);
    return html`<button type="button" class="swatch" style="--c:${hex}" data-kit-toggle="${which}" data-hex="${hex}"
        aria-pressed="${at >= 0}" title="${name}" ${can ? "" : "disabled"} ${at < 0 && full ? "data-full" : ""}>
        ${at >= 0 ? raw(html`<span class="swatch__n">${at + 1}</span>`) : ""}<span class="visually-hidden">${name}</span>
      </button>`;
  }).join("");

  return html`
    <div class="kit" data-kit="${which}">
      <div class="kit__head">
        <div class="kit__shirt">${raw(shirtSvg(kit, { size: 72, label: `${title}: ${kitLabel(kit) || "no colours yet"}` }))}</div>
        <div class="kit__text">
          <h3 class="kit__title">${title}</h3>
          <ul class="kit-chips" role="list">${raw(chosen)}</ul>
        </div>
      </div>
      ${can ? raw(html`
        <div class="kit__palette" role="group" aria-label="${title} colours">
          ${raw(palette)}
          <label class="swatch swatch--custom" title="Any other colour" ${full ? "data-full" : ""}>
            <span aria-hidden="true">+</span><span class="visually-hidden">Add a custom colour to the ${title.toLowerCase()}</span>
            <input type="color" data-kit-custom="${which}" value="#7c5ce6" ${full ? "disabled" : ""}>
          </label>
        </div>
        <p class="form-note kit__hint">${full ? "That's 3 — remove one to change it." : `Tap to add, tap again to remove. ${KIT_MAX - kit.length} more allowed.`}</p>`) : ""}
    </div>`;
}

function kitsDirty() {
  const same = (a, b) => (a || []).join() === (b || []).join();
  return !same(S.kits.primary, S.team.kit_primary) || !same(S.kits.secondary, S.team.kit_secondary);
}

function redrawKits() {
  const box = root.querySelector("[data-kits]");
  if (box) box.innerHTML = kitsBody();
  const st = root.querySelector("[data-kits-state]");
  if (st) st.textContent = kitsDirty() ? "Not saved yet" : "";
}

function addKitColour(which, hex) {
  const kit = S.kits[which];
  if (!hex || kit.includes(hex)) return;
  if (kit.length >= KIT_MAX) return toast(`Up to ${KIT_MAX} colours per kit — remove one first.`, "err");
  kit.push(hex);
  redrawKits();
}

function teamPicker() {
  return html`
    <div class="portal-picker">
      <label for="team-pick" class="mono">Your teams</label>
      <select id="team-pick" data-pick>
        ${S.teams.map((t) => raw(html`<option value="${t.id}" ${t.id === S.team.id ? "selected" : ""}>${t.name} · ${t.season_id}</option>`))}
      </select>
    </div>`;
}

function squadList() {
  const can = editable();
  return html`
    <ul class="squad" role="list">
      ${S.players.map((p) => raw(html`
        <li class="squad__row">
          <span class="squad__num">${p.shirt_number ?? "–"}</span>
          <span class="squad__pic">${S.photos[p.photo_path]
            ? raw(html`<img src="${S.photos[p.photo_path]}" alt="" loading="lazy">`)
            : raw(html`<span>${initials(p.full_name)}</span>`)}</span>
          <span class="squad__name">
            ${p.full_name}
            ${p.is_captain ? raw(`<span class="pill pill--accent" title="Captain">C</span>`) : ""}
            ${raw(joinedBadge(p))}
          </span>
          <span class="squad__meta">
            <span>${positionLabel(p.position)}</span>
            <span>${countryName(p.nationality)}</span>
            <span>${fmtDate(p.date_of_birth)} <span class="dim">(${ageOn(p.date_of_birth)})</span></span>
            <span>${p.height_cm ? `${p.height_cm} cm` : raw(`<span class="dim">no height</span>`)}</span>
            ${p.preferred_foot ? raw(html`<span>${footLabel(p.preferred_foot)} foot</span>`) : ""}
          </span>
          ${can ? raw(html`
            <span class="squad__actions">
              <button class="btn btn--ghost btn--sm" type="button" data-edit="${p.id}">Edit</button>
              <button class="btn btn--ghost btn--sm btn--danger" type="button" data-delete="${p.id}" aria-label="Remove ${p.full_name}">Remove</button>
            </span>`) : ""}
        </li>`))}
    </ul>`;
}

function signOffBlock() {
  const t = S.team, p = S.players;
  const captains = p.filter((x) => x.is_captain).length;
  const blockers = [];
  if (!p.length) blockers.push("Add at least one player.");
  if (p.length && captains !== 1) blockers.push("Pick a captain — tick “Captain” on one player.");
  for (const a of pendingSignings(S.pool, p)) blockers.push(`Add ${a.full_name} to the squad: they accepted your offer.`);

  if (t.signed_off_at) {
    return html`
      <p><span class="pill pill--ok">Signed off</span> by ${t.signed_off_by} on ${fmtDateTime(t.signed_off_at)}.</p>
      <p class="muted">If you change the squad, you'll need to sign it off again.</p>`;
  }
  if (S.asViewer) {
    return html`<p class="muted">Not signed off yet. The team's contact signs off the squad.</p>`;
  }
  if (!editable()) {
    return html`<p class="muted">The season is locked, so the squad can't be signed off from here.</p>`;
  }
  return html`
    <p class="muted">When the squad is complete, confirm it here. This is what the organisers send to Sofascore, where player names, photos, dates of birth, nationality, height and preferred foot are shown publicly.</p>
    <form class="form" data-form="signoff">
      <label class="check">
        <input type="checkbox" name="attest" ${blockers.length ? "disabled" : ""}>
        <span>I confirm every player listed has agreed to their details and photo being given to the VFL and published on Sofascore. <a href="/privacy/" target="_blank" rel="noopener">How we use this information</a>.</span>
      </label>
      ${blockers.length ? raw(html`<ul class="blockers">${blockers.map((b) => raw(html`<li>${b}</li>`))}</ul>`) : ""}
      <div class="btn-row"><button class="btn" type="submit" disabled data-signoff>Sign off squad</button></div>
    </form>`;
}

// ---------------------------------------------------------------- player dialog
function openPlayer(player, fromAgent = null) {
  const dlg = root.querySelector("[data-dialog]");
  // A free agent who accepted: start from what they told us.
  const agentPos = fromAgent && (fromAgent.positions.find((v) => positions.some((x) => x.value === v)) || positions[0].value);
  const p = player || { full_name: fromAgent?.full_name || "", date_of_birth: "", shirt_number: "", position: agentPos || positions[0].value, nationality: "", height_cm: "",
    is_captain: !fromAgent && !S.players.some((x) => x.is_captain) };
  const otherCaptain = S.players.find((x) => x.is_captain && x.id !== p.id);
  const currentPhoto = p.photo_path ? S.photos[p.photo_path] : "";
  // photo edits in this dialog: a shrunk new file waiting to upload, or a removal
  const photo = { pending: null, previewUrl: "", remove: false };

  dlg.innerHTML = html`
    <form class="form" method="dialog" data-form="player" novalidate>
      <div class="player-dialog__head">
        <h2>${player ? "Edit player" : fromAgent ? "Add new signing" : "Add player"}</h2>
        <button class="dialog-close" type="button" data-close aria-label="Close">×</button>
      </div>
      ${fromAgent ? raw(html`<p class="form-note dialog-note">${fromAgent.full_name} joins from the free-agent pool${fromAgent.is_loan ? `, on loan from ${fromAgent.current_team}` : ""}. Add their date of birth and nationality (ask them if you need to). They'll be marked as ${fromAgent.is_loan ? "a loan" : "a free agent"} in the squad.</p>`) : ""}
      <div class="photo-pick">
        <div class="photo-pick__preview" data-photo-preview>${currentPhoto
          ? raw(html`<img src="${currentPhoto}" alt="">`)
          : raw(html`<span>${p.full_name ? initials(p.full_name) : "+"}</span>`)}</div>
        <div class="photo-pick__body">
          <span class="photo-pick__label">Photo <span class="opt">optional</span></span>
          <div class="btn-row">
            <label class="btn btn--ghost btn--sm">
              <input type="file" accept="image/*" data-photo-input hidden>
              <span data-photo-choose>${currentPhoto ? "Replace photo" : "Choose photo"}</span>
            </label>
            <button type="button" class="btn btn--ghost btn--sm btn--danger" data-photo-remove ${currentPhoto ? "" : "hidden"}>Remove</button>
          </div>
          <span class="form-note" data-photo-note>A head-and-shoulders shot works best. We shrink it before uploading.</span>
        </div>
      </div>
      <div class="field">
        <label for="p-name">Full name</label>
        <input id="p-name" name="full_name" required maxlength="80" value="${p.full_name}" autocomplete="off">
        <span class="field-err" data-err="full_name"></span>
      </div>
      <div class="field--2">
        <div class="field">
          <label for="p-dob">Date of birth</label>
          <input id="p-dob" name="date_of_birth" type="date" required value="${p.date_of_birth}" min="1920-01-01" max="${adultMaxDob()}">
          <span class="field-err" data-err="date_of_birth"></span>
        </div>
        <div class="field">
          <label for="p-nat">Nationality</label>
          <select id="p-nat" name="nationality" required>${raw(countryOptions(p.nationality))}</select>
          <span class="field-err" data-err="nationality"></span>
        </div>
      </div>
      <div class="field--2">
        <div class="field">
          <label for="p-pos">Position</label>
          <select id="p-pos" name="position" required>
            ${positions.map((x) => raw(html`<option value="${x.value}" ${x.value === p.position ? "selected" : ""}>${x.label}</option>`))}
          </select>
          <span class="field-err" data-err="position"></span>
        </div>
        <div class="field">
          <label for="p-foot">Preferred foot <span class="opt">optional</span></label>
          <select id="p-foot" name="preferred_foot">
            <option value="">Not given</option>
            ${FEET.map((x) => raw(html`<option value="${x.value}" ${x.value === p.preferred_foot ? "selected" : ""}>${x.label}</option>`))}
          </select>
        </div>
      </div>
      <div class="field--2">
        <div class="field">
          <label for="p-num">Shirt number <span class="opt">optional</span></label>
          <input id="p-num" name="shirt_number" type="number" inputmode="numeric" min="0" max="99" value="${p.shirt_number ?? ""}">
          <span class="field-err" data-err="shirt_number"></span>
        </div>
        <div class="field">
          <label for="p-h">Height (cm) <span class="opt">optional</span></label>
          <input id="p-h" name="height_cm" type="number" inputmode="numeric" min="120" max="230" value="${p.height_cm ?? ""}">
          <span class="field-err" data-err="height_cm"></span>
        </div>
      </div>
      <label class="check">
        <input type="checkbox" name="is_captain" ${p.is_captain ? "checked" : ""}>
        <span>Captain${otherCaptain ? raw(html` <span class="dim">— replaces ${otherCaptain.full_name}</span>`) : ""}</span>
      </label>
      <div class="form-status" data-status role="status"></div>
      <div class="btn-row">
        <button class="btn" type="submit">${player ? "Save changes" : "Add to squad"}</button>
        <button class="btn btn--ghost" type="button" data-close>Cancel</button>
      </div>
    </form>`;

  const form = dlg.querySelector("form");
  const preview = form.querySelector("[data-photo-preview]");
  const note = form.querySelector("[data-photo-note]");
  const removeBtn = form.querySelector("[data-photo-remove]");
  const chooseLabel = form.querySelector("[data-photo-choose]");
  const clearPreviewUrl = () => { if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl); photo.previewUrl = ""; };

  form.querySelector("[data-photo-input]").onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    note.textContent = "Shrinking…";
    note.classList.remove("is-err");
    try {
      const out = await shrinkPhoto(file);
      clearPreviewUrl();
      photo.pending = out.blob;
      photo.previewUrl = URL.createObjectURL(out.blob);
      photo.remove = false;
      preview.innerHTML = html`<img src="${photo.previewUrl}" alt="">`;
      note.textContent = `Ready: ${out.width}×${out.height}, ${fmtBytes(out.size)} (was ${fmtBytes(out.originalSize)}). Uploads when you save.`;
      removeBtn.hidden = false;
      chooseLabel.textContent = "Replace photo";
    } catch (err) {
      note.textContent = friendly(err);
      note.classList.add("is-err");
    }
  };
  removeBtn.onclick = () => {
    clearPreviewUrl();
    photo.pending = null;
    photo.remove = !!p.photo_path;
    preview.innerHTML = html`<span>${p.full_name ? initials(p.full_name) : "+"}</span>`;
    note.textContent = p.photo_path ? "Photo will be removed when you save." : "A head-and-shoulders shot works best. We shrink it before uploading.";
    removeBtn.hidden = true;
    chooseLabel.textContent = "Choose photo";
  };
  dlg.addEventListener("close", clearPreviewUrl, { once: true });

  dlg.onclick = (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const row = {
      full_name: String(fd.get("full_name") || "").trim().replace(/\s+/g, " "),
      date_of_birth: fd.get("date_of_birth") || "",
      nationality: fd.get("nationality") || "",
      position: fd.get("position") || "",
      shirt_number: fd.get("shirt_number") === "" ? null : Number(fd.get("shirt_number")),
      height_cm: fd.get("height_cm") === "" ? null : Number(fd.get("height_cm")),
      preferred_foot: fd.get("preferred_foot") || null,
      is_captain: fd.get("is_captain") === "on",
    };
    form.querySelectorAll("[data-err]").forEach((el) => (el.textContent = ""));
    const errs = validatePlayer({ ...row, shirt_number: row.shirt_number ?? "", height_cm: row.height_cm ?? "" });
    if (row.shirt_number != null && S.players.some((x) => x.id !== p.id && x.shirt_number === row.shirt_number)) {
      errs.shirt_number = "Another player already has that number.";
    }
    if (Object.keys(errs).length) {
      for (const [k, v] of Object.entries(errs)) { const el = form.querySelector(`[data-err="${k}"]`); if (el) el.textContent = v; }
      form.querySelector(`[name="${Object.keys(errs)[0]}"]`)?.focus();
      return;
    }

    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    const status = form.querySelector("[data-status]");
    let uploaded = null;
    let photoFailed = null;
    try {
      // Upload a new photo first, so the player row can point at it. If the
      // photo server is having a bad moment, save the player anyway and say so:
      // losing everything typed into the form over a photo would be worse.
      if (photo.pending) {
        btn.textContent = "Uploading photo…";
        try {
          uploaded = await uploadPhoto(S.sb, S.team.id, photo.pending, {
            onRetry: () => { btn.textContent = "Photo is slow, retrying…"; },
          });
          row.photo_path = uploaded;
        } catch (err) {
          if (!isRetryableUpload(err)) throw err;   // a real problem: show it, keep the dialog open
          photoFailed = err;                        // server trouble: save without the new photo
          btn.textContent = "Saving…";
        }
      } else if (photo.remove) {
        row.photo_path = null;
      }
      // Only one captain is allowed, so hand the armband over first.
      if (row.is_captain && otherCaptain) {
        const { error } = await S.sb.from("players").update({ is_captain: false }).eq("id", otherCaptain.id);
        if (error) throw error;
      }
      if (player) {
        const { error } = await S.sb.from("players").update(row).eq("id", player.id);
        if (error) throw error;
      } else {
        const { error } = await S.sb.from("players").insert({ ...row, team_id: S.team.id, ...(fromAgent ? { free_agent_id: fromAgent.id } : {}) });
        if (error) throw error;
      }
      // The old file is no longer referenced: tidy it away.
      if (player?.photo_path && (uploaded || photo.remove)) await removePhotos(S.sb, [player.photo_path]);
      dlg.close();
      if (photoFailed) {
        toast(`${player ? "Player updated" : `${row.full_name} added`}, but the photo didn't upload — the photo server isn't responding. Open the player and add it again in a few minutes.`, "err");
      } else {
        toast(player ? "Player updated." : `${row.full_name} added.`);
      }
      await openTeam(S.team.id);
    } catch (err) {
      if (uploaded) await removePhotos(S.sb, [uploaded]);   // don't leave an orphan behind
      status.className = "form-status form-status--err is-visible";
      status.textContent = friendly(err);
      btn.disabled = false;
      btn.textContent = player ? "Save changes" : "Add to squad";
    }
  };

  dlg.showModal();
  dlg.querySelector("#p-name").focus();
}

// ---------------------------------------------------------------- events
function wireCommon() {
  root.onclick = async (e) => {
    const t = e.target;
    if (t.closest("[data-signout]")) { await signOut(S.sb); return; }

    const tog = t.closest("[data-kit-toggle]");
    if (tog && !tog.disabled) {
      const which = tog.dataset.kitToggle, hex = tog.dataset.hex, kit = S.kits[which];
      if (kit.includes(hex)) { kit.splice(kit.indexOf(hex), 1); redrawKits(); }
      else addKitColour(which, hex);
      root.querySelector(`[data-kit-toggle="${which}"][data-hex="${hex}"]`)?.focus();
      return;
    }
    const rm = t.closest("[data-kit-remove]");
    if (rm) { S.kits[rm.dataset.kitRemove].splice(Number(rm.dataset.i), 1); redrawKits(); return; }
    if (t.closest("[data-kits-save]")) {
      const btn = t.closest("[data-kits-save]");
      btn.disabled = true;
      const { error } = await S.sb.from("teams").update({
        kit_primary: S.kits.primary.length ? S.kits.primary : null,
        kit_secondary: S.kits.secondary.length ? S.kits.secondary : null,
      }).eq("id", S.team.id);
      btn.disabled = false;
      if (error) return toast(friendly(error), "err");
      toast("Kit colours saved.");
      return openTeam(S.team.id);
    }
    if (t.closest("[data-add]")) return openPlayer(null);
    const faAdd = t.closest("[data-fa-add]");
    if (faAdd) return openPlayer(null, S.pool.find((a) => a.id === faAdd.dataset.faAdd));
    const faFilter = t.closest("[data-fa-filter]");
    if (faFilter) { S.faFilter = faFilter.dataset.faFilter; redrawPool(); root.querySelector(`[data-fa-filter="${S.faFilter}"]`)?.focus(); return; }
    if (await poolAction(t, { sb: S.sb, teamId: S.team?.id, pool: S.pool, reload: async (agentId) => {
      await reloadPool();
      root.querySelector(`[data-agent="${agentId}"] .agent__actions button`)?.focus();
    } })) return;
    const edit = t.closest("[data-edit]");
    if (edit) return openPlayer(S.players.find((p) => p.id === edit.dataset.edit));
    const del = t.closest("[data-delete]");
    if (del) {
      const p = S.players.find((x) => x.id === del.dataset.delete);
      if (!p || !confirm(`Remove ${p.full_name} from the squad?`)) return;
      const { error } = await S.sb.from("players").delete().eq("id", p.id);
      if (error) return toast(friendly(error), "err");
      if (p.photo_path) await removePhotos(S.sb, [p.photo_path]);
      toast(`${p.full_name} removed.`);
      await openTeam(S.team.id);
    }
  };

  root.onchange = async (e) => {
    if (e.target.matches("[data-pick]")) return openTeam(e.target.value);
    if (e.target.matches("[data-kit-custom]")) {
      addKitColour(e.target.dataset.kitCustom, normHex(e.target.value));
      return;
    }
    if (e.target.matches("[data-studio-same]")) {
      const studio = root.querySelector("#t-studio");
      if (e.target.checked) { studio.dataset.before = studio.value; studio.value = root.querySelector("#t-name").value; studio.readOnly = true; }
      else { studio.readOnly = false; studio.value = studio.dataset.before ?? ""; studio.focus(); }
      return;
    }
    if (e.target.matches("[name=attest]")) {
      const b = root.querySelector("[data-signoff]");
      if (b) b.disabled = !e.target.checked;
    }
    if (e.target.matches("[data-logo]")) return uploadLogo(e.target.files[0], e.target);
  };

  root.oninput = (e) => {
    if (e.target.id === "t-name" && root.querySelector("[data-studio-same]")?.checked) {
      root.querySelector("#t-studio").value = e.target.value;
    }
    if (e.target.id === "t-notes") {
      const c = root.querySelector("[data-count]");
      if (c) c.textContent = `${e.target.value.length} / 2000`;
    }
  };

  root.onsubmit = async (e) => {
    const form = e.target;
    if (form.dataset.form === "details") {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const patch = {
        name,
        short_name: String(fd.get("short_name") || "").trim() || null,
        studio: fd.get("studio_same") === "on" ? name : (String(fd.get("studio") || "").trim() || null),
        contact_name: String(fd.get("contact_name") || "").trim() || null,
      };
      if (patch.name.length < 2) return toast("The team needs a name.", "err");
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      const { error } = await S.sb.from("teams").update(patch).eq("id", S.team.id);
      btn.disabled = false;
      if (error) return toast(friendly(error), "err");
      toast("Details saved.");
      await openTeam(S.team.id);
    }
    if (form.dataset.form === "notes") {
      e.preventDefault();
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      const note = String(new FormData(form).get("team_notes") || "").trim();
      const { error } = await S.sb.from("teams").update({ team_notes: note || null }).eq("id", S.team.id);
      btn.disabled = false;
      if (error) return toast(friendly(error), "err");
      toast(note ? "Notes saved." : "Notes cleared.");
      return openTeam(S.team.id);
    }
    if (form.dataset.form === "signoff") {
      e.preventDefault();
      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      const { error } = await S.sb.rpc("sign_off_team", { p_team: S.team.id, p_attest: form.attest.checked });
      if (error) { btn.disabled = false; return toast(friendly(error), "err"); }
      toast("Squad signed off. Thank you!");
      await openTeam(S.team.id);
    }
  };
}

async function uploadLogo(file, input) {
  if (!file) return;
  const ext = LOGO_TYPES[file.type];
  if (!ext) { input.value = ""; return toast("Use a PNG, JPG or WebP image.", "err"); }
  if (file.size > LOGO_MAX) { input.value = ""; return toast("That image is over 2 MB. Try a smaller one.", "err"); }

  const previous = S.team.logo_path;
  const path = `${S.team.id}/${Date.now()}.${ext}`;
  toast("Uploading…");
  const bucket = S.sb.storage.from("team-logos");
  const { error: upErr } = await bucket.upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return toast(friendly(upErr), "err");
  const { error } = await S.sb.from("teams").update({ logo_path: path }).eq("id", S.team.id);
  if (error) { await bucket.remove([path]); return toast(friendly(error), "err"); }
  if (previous) await bucket.remove([previous]); // tidy up; harmless if it fails
  toast("Logo updated.");
  await openTeam(S.team.id);
}
