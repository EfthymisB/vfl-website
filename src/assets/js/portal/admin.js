// VFL organiser board.
import {
  startPage, signOut, html, raw, toast, friendly, config,
  fmtDate, fmtDateTime, countryName, positionLabel,
  logoUrl, initials, toCsv, download, kitLabel, shirtSvg,
  footLabel, photoUrls, removePhotos, makeZip, safeFileName, fmtBytes,
} from "./lib.js";
import { positionsLong, availabilityLabel, styleLabel } from "./agents.js";

const root = document.getElementById("admin");

startPage(root, {
  title: "Organiser board",
  intro: "Sign in with an organiser email address.",
  onReady: (sb, user) => load(sb, user),
});

let S = null;

async function load(sb, user, seasonId) {
  root.innerHTML = `<div class="portal-loading" aria-busy="true">Loading…</div>`;
  try {
    const email = (user.email || "").toLowerCase();
    const { data: isAdmin, error } = await sb.rpc("am_i_admin");
    if (error) throw error;
    if (!isAdmin) return renderNotAdmin(sb, email);

    const { data: seasons, error: e2 } = await sb.from("seasons").select("*").order("id", { ascending: false });
    if (e2) throw e2;
    S = { sb, user, email, seasons, season: null, teams: [], players: [], agents: [], interest: [] };
    const pick = seasonId || seasons.find((s) => s.is_current)?.id || seasons[0]?.id;
    if (!pick) return renderNoSeason();
    await openSeason(pick);
  } catch (err) {
    root.innerHTML = html`<div class="panel portal-auth"><h2>Couldn't load the board</h2><p class="muted">${friendly(err)}</p></div>`;
  }
}

async function openSeason(id) {
  const { sb } = S;
  const { data: teams, error } = await sb.from("teams").select("*").eq("season_id", id).order("name");
  if (error) throw error;
  let players = [];
  if (teams.length) {
    const { data, error: e2 } = await sb.from("players").select("*").in("team_id", teams.map((t) => t.id));
    if (e2) throw e2;
    players = data;
  }
  const { data: agents, error: e3 } = await sb.from("free_agents").select("*").eq("season_id", id).order("created_at");
  if (e3) throw e3;
  let interest = [];
  if (agents.length) {
    const { data, error: e4 } = await sb.from("free_agent_interest").select("*").in("agent_id", agents.map((a) => a.id));
    if (e4) throw e4;
    interest = data;
  }
  S.season = S.seasons.find((s) => s.id === id);
  S.teams = teams;
  S.players = players;
  S.agents = agents;
  S.interest = interest;
  render();
}

// "FC ILM London/09 Leo Wing.jpg": the same name in the zip and in the CSV.
function photoFileNames() {
  const byId = Object.fromEntries(S.teams.map((t) => [t.id, t]));
  const used = new Set();
  const names = {};
  for (const p of S.players.filter((x) => x.photo_path)) {
    const team = safeFileName(byId[p.team_id]?.name);
    const num = p.shirt_number != null ? String(p.shirt_number).padStart(2, "0") + " " : "";
    let base = `${team}/${num}${safeFileName(p.full_name)}`, name = `${base}.jpg`, i = 2;
    while (used.has(name.toLowerCase())) name = `${base} (${i++}).jpg`;
    used.add(name.toLowerCase());
    names[p.id] = name;
  }
  return names;
}

const portalUrl = () => `${(config.siteUrl || location.origin).replace(/\/$/, "")}/portal/`;
const squadOf = (teamId) => S.players.filter((p) => p.team_id === teamId);

// ---------------------------------------------------------------- views
function bar() {
  return html`
    <div class="portal-bar">
      <span class="portal-bar__who">Organiser · <strong>${S.email}</strong></span>
      <span class="portal-bar__actions">
        <button class="btn btn--ghost btn--sm" type="button" data-signout>Sign out</button>
      </span>
    </div>`;
}

function renderNotAdmin(sb, email) {
  S = { sb, email };
  root.innerHTML = html`
    ${raw(bar())}
    <div class="panel portal-auth">
      <div class="eyebrow eyebrow--plain">Organisers only</div>
      <h2>This page is for the organisers</h2>
      <p class="muted"><strong>${email}</strong> isn't on the organiser list. If you run a team, your squad is in the team portal.</p>
      <div class="btn-row"><a class="btn" href="/portal/">Go to the team portal</a></div>
    </div>`;
  wire();
}

function renderNoSeason() {
  root.innerHTML = html`${raw(bar())}<div class="panel">${raw(newSeasonForm(true))}</div>`;
  wire();
}

function newSeasonForm(first) {
  return html`
    <form class="form form--inline" data-form="season">
      <h2 class="portal-h">${first ? "Create the first season" : "New season"}</h2>
      <div class="field--3">
        <div class="field"><label for="s-id">Season id</label><input id="s-id" name="id" required pattern="[A-Za-z0-9_-]{1,20}" placeholder="2028"></div>
        <div class="field"><label for="s-name">Name</label><input id="s-name" name="name" required placeholder="Season 2028"></div>
        <div class="field field--end"><label class="check"><input type="checkbox" name="current" checked><span>Make it the current season</span></label></div>
      </div>
      <div class="btn-row"><button class="btn btn--sm" type="submit">Create season</button></div>
    </form>`;
}

function stats() {
  const t = S.teams;
  const complete = t.filter((x) => { const sq = squadOf(x.id); return sq.length && sq.filter((p) => p.is_captain).length === 1; }).length;
  return [
    ["Teams", t.length],
    ["Paid", `${t.filter((x) => x.paid).length}/${t.length}`],
    ["Logos", `${t.filter((x) => x.logo_path).length}/${t.length}`],
    ["Squads complete", `${complete}/${t.length}`],
    ["Signed off", `${t.filter((x) => x.signed_off_at).length}/${t.length}`],
    ["Players", S.players.length],
  ];
}

function render() {
  const s = S.season;
  root.innerHTML = html`
    ${raw(bar())}

    <section class="admin-season">
      <div>
        <div class="eyebrow">Season</div>
        <div class="admin-season__row">
          <select data-season aria-label="Season">
            ${S.seasons.map((x) => raw(html`<option value="${x.id}" ${x.id === s.id ? "selected" : ""}>${x.name}${x.is_current ? " (current)" : ""}</option>`))}
          </select>
          ${s.locked ? raw(`<span class="pill pill--warn">Locked</span>`) : raw(`<span class="pill pill--ok">Open for edits</span>`)}
        </div>
      </div>
      <div class="btn-row">
        ${!s.is_current ? raw(`<button class="btn btn--ghost btn--sm" type="button" data-make-current>Make current</button>`) : ""}
        <button class="btn btn--sm ${s.locked ? "" : "btn--ghost"}" type="button" data-lock>${s.locked ? "Unlock squads" : "Lock squads"}</button>
      </div>
    </section>

    <div class="stat-strip stat-strip--6">
      ${stats().map(([l, v]) => raw(html`<div class="stat"><div class="stat__num">${v}</div><div class="stat__label">${l}</div></div>`))}
    </div>

    <section class="panel">
      <div class="portal-section-head">
        <h2 class="portal-h">Teams</h2>
        <div class="btn-row">
          <button class="btn btn--ghost btn--sm" type="button" data-export="teams" ${S.teams.length ? "" : "disabled"}>Export teams CSV</button>
          <button class="btn btn--ghost btn--sm" type="button" data-photos-zip ${S.players.some((p) => p.photo_path) ? "" : "disabled"}>Download photos (.zip)</button>
          <button class="btn btn--sm" type="button" data-export="players" ${S.players.length ? "" : "disabled"}>Export players CSV</button>
        </div>
      </div>
      ${S.teams.length ? raw(teamTable()) : raw(`<p class="muted empty">No teams invited for this season yet.</p>`)}
    </section>

    <section class="panel" id="board-free-agents">
      <div class="portal-section-head">
        <h2 class="portal-h">Free agents <span class="count">${S.agents.length}</span></h2>
        <div class="btn-row">
          <a class="btn btn--ghost btn--sm" href="/free-agents/" target="_blank" rel="noopener">Public page</a>
          <button class="btn btn--ghost btn--sm" type="button" data-export="agents" ${S.agents.length ? "" : "disabled"}>Export free agents CSV</button>
        </div>
      </div>
      ${S.agents.length ? raw(agentTable()) : raw(`<p class="muted empty">Nobody has signed up yet. Players join from the free agents page; share it in studio channels.</p>`)}
    </section>

    <section class="panel">
      <form class="form" data-form="invite">
        <h2 class="portal-h">Add a team</h2>
        <p class="muted">Adds the team and lets that email address sign in to the portal. <strong>It doesn't email them</strong> — you'll get a message to send them yourself.</p>
        <div class="field--3">
          <div class="field"><label for="i-name">Team name</label><input id="i-name" name="name" required maxlength="80" placeholder="FC Studio London"></div>
          <div class="field"><label for="i-email">Contact email</label><input id="i-email" name="email" type="email" required placeholder="captain@studio.com"></div>
          <div class="field"><label for="i-contact">Contact name <span class="opt">optional</span></label><input id="i-contact" name="contact_name" maxlength="80"></div>
        </div>
        <div class="btn-row"><button class="btn btn--sm" type="submit">Add team</button></div>
        <div data-invite-result></div>
      </form>
    </section>

    <details class="panel admin-more">
      <summary>Seasons and data retention</summary>
      ${raw(newSeasonForm(false))}
      <hr>
      <form class="form" data-form="purge">
        <h2 class="portal-h">Delete this season's players</h2>
        <p class="muted">Once the season is over and exported, remove every player's personal details and photo for <strong>${s.name}</strong>, and every free-agent profile. Teams, logos and payment records stay. This can't be undone.</p>
        <div class="field"><label for="purge">Type <strong>${s.id}</strong> to confirm</label><input id="purge" name="confirm" autocomplete="off"></div>
        <div class="btn-row"><button class="btn btn--sm btn--danger" type="submit">Delete ${S.players.length} players${S.agents.length ? ` and ${S.agents.length} free agents` : ""}</button></div>
      </form>
    </details>

    <dialog class="player-dialog" data-dialog></dialog>`;
  wire();
}

// ---------------------------------------------------------------- free agents
const teamName = (id) => S.teams.find((t) => t.id === id)?.name || "";

function agentStatus(a) {
  if (a.status === "signed") {
    const inSquad = S.players.some((p) => p.free_agent_id === a.id);
    return { label: `Joined ${teamName(a.signed_team_id)}`, kind: "ok", inSquad,
      note: inSquad ? "In the squad" : "Not in the squad yet" };
  }
  if (a.status === "withdrawn") return { label: "On a break", kind: "warn" };
  return { label: "In the pool", kind: "" };
}

function agentTable() {
  return html`
    <div class="table-scroll">
      <table class="admin-table admin-table--agents">
        <thead><tr>
          <th scope="col">Player</th>
          <th scope="col">Plays</th>
          <th scope="col">Current team</th>
          <th scope="col">Contact</th>
          <th scope="col">Status</th>
          <th scope="col">Teams</th>
          <th scope="col"><span class="visually-hidden">Actions</span></th>
        </tr></thead>
        <tbody>
          ${S.agents.map((a) => {
            const st = agentStatus(a);
            const int = S.interest.filter((i) => i.agent_id === a.id);
            const offers = a.status === "available" ? int.filter((i) => i.offered_at) : [];
            return raw(html`
              <tr data-agent-row="${a.id}">
                <td><strong>${a.full_name}</strong><br><span class="dim nowrap">since ${fmtDate(a.created_at)}</span>
                  ${a.about ? raw(html`<span class="team-note">${a.about}</span>`) : ""}</td>
                <td>${positionsLong(a.positions)}<br><span class="dim">${styleLabel(a.play_style)} · ${availabilityLabel(a.availability)}${a.availability_note ? ` · ${a.availability_note}` : ""}</span></td>
                <td>${a.current_team_id ? raw(html`${teamName(a.current_team_id)} <span class="pill pill--loan">Loan</span>`) : a.current_team_other || raw(`<span class="dim">None</span>`)}
                  ${a.previous_teams ? raw(html`<br><span class="dim">Before: ${a.previous_teams}</span>`) : ""}</td>
                <td><a href="mailto:${a.email}">${a.email}</a>${a.phone ? raw(html`<br><a href="tel:${a.phone}" class="nowrap">${a.phone}</a>`) : ""}</td>
                <td><span class="pill ${st.kind ? `pill--${st.kind}` : ""}">${st.label}</span>${st.note ? raw(html`<br><span class="dim nowrap">${st.note}</span>`) : ""}</td>
                <td class="nowrap">${int.length} interested${offers.length ? raw(html`<br><span class="dim">${offers.length} offer${offers.length === 1 ? "" : "s"} open</span>`) : ""}
                  ${int.length ? raw(html`<span class="team-note team-note--list">${int.map((i) => teamName(i.team_id)).join(", ")}</span>`) : ""}</td>
                <td class="nowrap">
                  ${a.status === "signed" && !st.inSquad ? raw(html`<button class="btn btn--ghost btn--sm" type="button" data-agent-release="${a.id}">Return to pool</button>`) : ""}
                  <button class="btn btn--ghost btn--sm btn--danger" type="button" data-agent-remove="${a.id}" aria-label="Remove ${a.full_name}">Remove</button>
                </td>
              </tr>`);
          })}
        </tbody>
      </table>
    </div>`;
}

function exportAgents() {
  const cols = [
    { label: "Season", get: () => S.season.id },
    { label: "Name", get: "full_name" },
    { label: "Email", get: "email" },
    { label: "Phone", get: (a) => a.phone || "" },
    { label: "Positions", get: (a) => positionsLong(a.positions) },
    { label: "Style", get: (a) => styleLabel(a.play_style) },
    { label: "Availability", get: (a) => availabilityLabel(a.availability) },
    { label: "Availability note", get: (a) => a.availability_note || "" },
    { label: "Current team", get: (a) => (a.current_team_id ? teamName(a.current_team_id) : a.current_team_other || "") },
    { label: "Loan", get: (a) => (a.current_team_id ? "Yes" : "") },
    { label: "Previous teams", get: (a) => a.previous_teams || "" },
    { label: "About", get: (a) => a.about || "" },
    { label: "Status", get: (a) => agentStatus(a).label },
    { label: "Teams interested", get: (a) => S.interest.filter((i) => i.agent_id === a.id).map((i) => teamName(i.team_id)).join("; ") },
    { label: "Signed up", get: (a) => a.created_at.slice(0, 10) },
  ];
  download(`vfl-${S.season.id}-free-agents.csv`, toCsv(cols, S.agents));
  toast(`Exported ${S.agents.length} free agents.`);
}

function teamTable() {
  return html`
    <div class="table-scroll">
      <table class="admin-table">
        <thead><tr>
          <th scope="col"><span class="visually-hidden">Logo</span></th>
          <th scope="col">Team</th>
          <th scope="col">Kits</th>
          <th scope="col">Contact</th>
          <th scope="col">Paid</th>
          <th scope="col">Squad</th>
          <th scope="col">Signed off</th>
          <th scope="col"><span class="visually-hidden">Actions</span></th>
        </tr></thead>
        <tbody>
          ${S.teams.map((t) => {
            const sq = squadOf(t.id);
            const caps = sq.filter((p) => p.is_captain).length;
            const gks = sq.filter((p) => p.position === "goalkeeper").length;
            const pics = sq.filter((p) => p.photo_path).length;
            const logo = logoUrl(S.sb, t.logo_path);
            return raw(html`
              <tr>
                <td class="admin-table__logo">${logo ? raw(html`<a href="${logo}" target="_blank" rel="noopener" title="Open logo"><img src="${logo}" alt="" width="36" height="36" loading="lazy"></a>`) : raw(html`<span class="logo-ph">${initials(t.name)}</span>`)}</td>
                <td><strong>${t.name}</strong>${t.short_name || (t.studio && t.studio !== t.name) ? raw(html`<br><span class="dim">${[t.short_name, t.studio && t.studio !== t.name ? t.studio : ""].filter(Boolean).join(" · ")}</span>`) : ""}${t.team_notes ? raw(html`<span class="team-note" title="${t.team_notes}">${t.team_notes.slice(0, 70)}${t.team_notes.length > 70 ? "…" : ""}</span>`) : ""}${t.admin_notes ? raw(html`<br><span class="note" title="${t.admin_notes}">📝 ${t.admin_notes.slice(0, 40)}${t.admin_notes.length > 40 ? "…" : ""}</span>`) : ""}</td>
                <td><span class="admin-kits">${raw(shirtSvg(t.kit_primary, { size: 30, label: `Primary: ${kitLabel(t.kit_primary) || "not set"}` }))}${raw(shirtSvg(t.kit_secondary, { size: 30, label: `Secondary: ${kitLabel(t.kit_secondary) || "not set"}` }))}</span></td>
                <td>${t.contact_name || raw(`<span class="dim">—</span>`)}<br><span class="dim mono-sm">${t.contact_email}</span></td>
                <td>
                  <label class="check check--sm"><input type="checkbox" data-paid="${t.id}" ${t.paid ? "checked" : ""}><span>${t.paid ? "Paid" : "Unpaid"}</span></label>
                  ${t.paid && (t.paid_at || t.paid_note) ? raw(html`<br><span class="dim">${t.paid_at ? fmtDate(t.paid_at) : ""}${t.paid_note ? ` · ${t.paid_note}` : ""}</span>`) : ""}
                </td>
                <td>${sq.length} player${sq.length === 1 ? "" : "s"}<br>
                  <span class="${caps === 1 ? "ok" : "warn"}">${caps === 1 ? "Captain ✓" : caps ? "2+ captains" : "No captain"}</span>
                  <span class="dim nowrap">· ${gks} GK</span>${sq.length ? raw(html`<br><span class="dim nowrap">${pics}/${sq.length} photos</span>`) : ""}</td>
                <td>${t.signed_off_at ? raw(html`<span class="ok">✓ ${fmtDate(t.signed_off_at)}</span>`) : raw(`<span class="dim">Not yet</span>`)}</td>
                <td class="admin-table__actions">
                  <a class="btn btn--ghost btn--sm" href="/portal/?team=${t.id}">Open</a>
                  <button class="btn btn--ghost btn--sm" type="button" data-edit-team="${t.id}">Edit</button>
                </td>
              </tr>`);
          })}
        </tbody>
      </table>
    </div>`;
}

// ---------------------------------------------------------------- dialogs
function dialog(inner, onSubmit) {
  const dlg = root.querySelector("[data-dialog]");
  dlg.innerHTML = inner;
  const form = dlg.querySelector("form");
  dlg.onclick = (e) => { if (e.target === dlg || e.target.closest("[data-close]")) dlg.close(); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try { await onSubmit(new FormData(form), e.submitter); dlg.close(); }
    catch (err) {
      const st = form.querySelector("[data-status]");
      st.className = "form-status form-status--err is-visible";
      st.textContent = friendly(err);
    } finally { btn.disabled = false; }
  };
  dlg.showModal();
  dlg.querySelector("input, textarea")?.focus();
}

function editTeam(t) {
  dialog(html`
    <form class="form" novalidate>
      <div class="player-dialog__head"><h2>Edit ${t.name}</h2><button class="dialog-close" type="button" data-close aria-label="Close">×</button></div>
      <div class="field"><label for="e-name">Team name</label><input id="e-name" name="name" required maxlength="80" value="${t.name}"></div>
      <div class="field--2">
        <div class="field"><label for="e-email">Contact email</label><input id="e-email" name="contact_email" type="email" required value="${t.contact_email}"></div>
        <div class="field"><label for="e-cname">Contact name</label><input id="e-cname" name="contact_name" maxlength="80" value="${t.contact_name || ""}"></div>
      </div>
      ${t.team_notes ? raw(html`<div class="field"><span class="mono dim">Their notes</span><p class="note-full">${t.team_notes}</p></div>`) : ""}
      <div class="field"><label for="e-pnote">Payment note <span class="opt">e.g. "Bank transfer 3 Dec"</span></label><input id="e-pnote" name="paid_note" maxlength="200" value="${t.paid_note || ""}"></div>
      <div class="field"><label for="e-notes">Organiser notes <span class="opt">only organisers see these</span></label><textarea id="e-notes" name="admin_notes" maxlength="2000" rows="3">${t.admin_notes || ""}</textarea></div>
      <div class="form-status" data-status role="status"></div>
      <div class="btn-row">
        <button class="btn" type="submit" value="save">Save</button>
        <button class="btn btn--ghost" type="button" data-close>Cancel</button>
        <button class="btn btn--ghost btn--danger btn--push" type="submit" value="delete" formnovalidate>Delete team</button>
      </div>
    </form>`, async (fd, submitter) => {
    if (submitter?.value === "delete") {
      const n = squadOf(t.id).length;
      if (!confirm(`Delete ${t.name}${n ? ` and its ${n} players` : ""}? This can't be undone.`)) throw new Error("Cancelled.");
      const { error } = await S.sb.from("teams").delete().eq("id", t.id);
      if (error) throw error;
      if (t.logo_path) await S.sb.storage.from("team-logos").remove([t.logo_path]);
      await removePhotos(S.sb, squadOf(t.id).map((p) => p.photo_path));
      toast(`${t.name} deleted.`);
      return openSeason(S.season.id);
    }
    const email = String(fd.get("contact_email") || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid contact email.");
    const patch = {
      name: String(fd.get("name") || "").trim(),
      contact_email: email,
      contact_name: String(fd.get("contact_name") || "").trim() || null,
      paid_note: String(fd.get("paid_note") || "").trim() || null,
      admin_notes: String(fd.get("admin_notes") || "").trim() || null,
    };
    const { error } = await S.sb.from("teams").update(patch).eq("id", t.id);
    if (error) throw error;
    toast("Team saved.");
    await openSeason(S.season.id);
  });
}

function markPaid(t, input) {
  dialog(html`
    <form class="form">
      <div class="player-dialog__head"><h2>Mark ${t.name} as paid</h2><button class="dialog-close" type="button" data-close aria-label="Close">×</button></div>
      <div class="field"><label for="m-note">Note <span class="opt">optional</span></label><input id="m-note" name="paid_note" maxlength="200" value="${t.paid_note || ""}" placeholder="e.g. Bank transfer 3 Dec"></div>
      <div class="form-status" data-status role="status"></div>
      <div class="btn-row"><button class="btn" type="submit">Mark as paid</button><button class="btn btn--ghost" type="button" data-close>Cancel</button></div>
    </form>`, async (fd) => {
    const { error } = await S.sb.from("teams").update({ paid: true, paid_note: String(fd.get("paid_note") || "").trim() || null }).eq("id", t.id);
    if (error) throw error;
    toast(`${t.name} marked as paid.`);
    await openSeason(S.season.id);
  });
  // closing without confirming leaves it unticked
  root.querySelector("[data-dialog]").addEventListener("close", () => { if (!t.paid) input.checked = false; }, { once: true });
}

// ---------------------------------------------------------------- csv
function exportPlayers() {
  const names = photoFileNames();
  const byId = Object.fromEntries(S.teams.map((t) => [t.id, t]));
  const rows = [...S.players].sort((a, b) =>
    byId[a.team_id].name.localeCompare(byId[b.team_id].name) ||
    (b.is_captain - a.is_captain) ||
    ((a.shirt_number ?? 999) - (b.shirt_number ?? 999)) ||
    a.full_name.localeCompare(b.full_name));
  const cols = [
    { label: "Season", get: () => S.season.id },
    { label: "Team", get: (p) => byId[p.team_id].name },
    { label: "Team short name", get: (p) => byId[p.team_id].short_name || "" },
    { label: "Player", get: "full_name" },
    { label: "Date of birth", get: "date_of_birth" },
    { label: "Shirt number", get: (p) => p.shirt_number ?? "" },
    { label: "Position", get: (p) => positionLabel(p.position) },
    { label: "Nationality", get: (p) => countryName(p.nationality) },
    { label: "Nationality code", get: "nationality" },
    { label: "Height (cm)", get: (p) => p.height_cm ?? "" },
    { label: "Captain", get: (p) => (p.is_captain ? "Yes" : "") },
    { label: "Preferred foot", get: (p) => footLabel(p.preferred_foot) },
    { label: "Photo file", get: (p) => names[p.id] || "" },
    { label: "Joined as", get: (p) => (p.joined_as === "loan" ? `Loan from ${p.loan_from || "another team"}` : p.joined_as === "free_agent" ? "Free agent" : "") },
  ];
  download(`vfl-${S.season.id}-players.csv`, toCsv(cols, rows));
  toast(`Exported ${rows.length} players.`);
}

function exportTeams() {
  const cols = [
    { label: "Season", get: () => S.season.id },
    { label: "Team", get: "name" },
    { label: "Short name", get: (t) => t.short_name || "" },
    { label: "Studio", get: (t) => t.studio || "" },
    { label: "Primary kit", get: (t) => kitLabel(t.kit_primary) },
    { label: "Primary kit hex", get: (t) => (t.kit_primary || []).join(" ") },
    { label: "Secondary kit", get: (t) => kitLabel(t.kit_secondary) },
    { label: "Secondary kit hex", get: (t) => (t.kit_secondary || []).join(" ") },
    { label: "Contact name", get: (t) => t.contact_name || "" },
    { label: "Contact email", get: "contact_email" },
    { label: "Paid", get: (t) => (t.paid ? "Yes" : "No") },
    { label: "Paid on", get: (t) => (t.paid_at ? t.paid_at.slice(0, 10) : "") },
    { label: "Payment note", get: (t) => t.paid_note || "" },
    { label: "Players", get: (t) => squadOf(t.id).length },
    { label: "Captain", get: (t) => squadOf(t.id).find((p) => p.is_captain)?.full_name || "" },
    { label: "Signed off", get: (t) => (t.signed_off_at ? t.signed_off_at.slice(0, 10) : "") },
    { label: "Signed off by", get: (t) => t.signed_off_by || "" },
    { label: "Logo URL", get: (t) => logoUrl(S.sb, t.logo_path) },
    { label: "Team notes", get: (t) => t.team_notes || "" },
  ];
  download(`vfl-${S.season.id}-teams.csv`, toCsv(cols, S.teams));
  toast(`Exported ${S.teams.length} teams.`);
}

// ---------------------------------------------------------------- photos zip
async function downloadPhotos(btn) {
  const names = photoFileNames();
  const withPhoto = S.players.filter((p) => p.photo_path);
  if (!withPhoto.length) return;
  btn.disabled = true;
  const label = btn.textContent;
  try {
    btn.textContent = "Preparing…";
    const urls = await photoUrls(S.sb, withPhoto.map((p) => p.photo_path));
    const files = [];
    let missing = 0, done = 0;
    // a few at a time: quick, without hammering the server
    const queue = [...withPhoto];
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const p = queue.shift();
        const url = urls[p.photo_path];
        try {
          if (!url) throw new Error("no link");
          const res = await fetch(url);
          if (!res.ok) throw new Error(String(res.status));
          files.push({ name: names[p.id], data: new Uint8Array(await res.arrayBuffer()) });
        } catch { missing++; }
        btn.textContent = `Downloading ${++done}/${withPhoto.length}…`;
      }
    }));
    files.sort((a, b) => a.name.localeCompare(b.name));
    const zip = makeZip(files);
    download(`vfl-${S.season.id}-player-photos.zip`, zip, "application/zip");
    toast(`${files.length} photos, ${fmtBytes(zip.size)}.${missing ? ` ${missing} couldn't be fetched.` : ""}`, missing ? "err" : "ok");
  } catch (err) {
    toast(friendly(err), "err");
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// ---------------------------------------------------------------- events
function wire() {
  root.onclick = async (e) => {
    const t = e.target;
    if (t.closest("[data-signout]")) return signOut(S.sb);
    const zipBtn = t.closest("[data-photos-zip]");
    if (zipBtn) return downloadPhotos(zipBtn);
    const exp = t.closest("[data-export]");
    if (exp) return exp.dataset.export === "players" ? exportPlayers() : exp.dataset.export === "agents" ? exportAgents() : exportTeams();
    const rel = t.closest("[data-agent-release]");
    if (rel) {
      const a = S.agents.find((x) => x.id === rel.dataset.agentRelease);
      if (!confirm(`Undo ${a.full_name}'s move to ${teamName(a.signed_team_id)} and put them back in the pool?`)) return;
      const { error } = await S.sb.from("free_agents").update({ status: "available" }).eq("id", a.id);
      if (error) return toast(friendly(error), "err");
      toast(`${a.full_name} is back in the pool.`);
      return openSeason(S.season.id);
    }
    const rm = t.closest("[data-agent-remove]");
    if (rm) {
      const a = S.agents.find((x) => x.id === rm.dataset.agentRemove);
      if (!confirm(`Remove ${a.full_name}'s free-agent profile? Use this for spam or if they ask. It can't be undone.`)) return;
      const { error } = await S.sb.from("free_agents").delete().eq("id", a.id);
      if (error) return toast(friendly(error), "err");
      toast(`${a.full_name}'s profile removed.`);
      return openSeason(S.season.id);
    }
    const ed = t.closest("[data-edit-team]");
    if (ed) return editTeam(S.teams.find((x) => x.id === ed.dataset.editTeam));
    if (t.closest("[data-copy]")) {
      try { await navigator.clipboard.writeText(t.closest("[data-copy]").dataset.copy); toast("Copied."); }
      catch { toast("Couldn't copy — select the text and copy it manually.", "err"); }
      return;
    }
    if (t.closest("[data-lock]")) {
      const s = S.season;
      const msg = s.locked
        ? `Unlock ${s.name}? Captains will be able to edit their squads again.`
        : `Lock ${s.name}? Captains will no longer be able to change their team or squad. Do this before you export for Sofascore.`;
      if (!confirm(msg)) return;
      const { error } = await S.sb.from("seasons").update({ locked: !s.locked }).eq("id", s.id);
      if (error) return toast(friendly(error), "err");
      s.locked = !s.locked;
      toast(s.locked ? "Squads locked." : "Squads unlocked.");
      return render();
    }
    if (t.closest("[data-make-current]")) {
      const old = S.seasons.find((x) => x.is_current);
      if (old) { const { error } = await S.sb.from("seasons").update({ is_current: false }).eq("id", old.id); if (error) return toast(friendly(error), "err"); }
      const { error } = await S.sb.from("seasons").update({ is_current: true }).eq("id", S.season.id);
      if (error) return toast(friendly(error), "err");
      toast(`${S.season.name} is now the current season.`);
      return load(S.sb, S.user, S.season.id);
    }
  };

  root.onchange = async (e) => {
    if (e.target.matches("[data-season]")) return openSeason(e.target.value);
    if (e.target.matches("[data-paid]")) {
      const team = S.teams.find((x) => x.id === e.target.dataset.paid);
      if (e.target.checked) return markPaid(team, e.target);
      if (!confirm(`Mark ${team.name} as unpaid?`)) { e.target.checked = true; return; }
      const { error } = await S.sb.from("teams").update({ paid: false }).eq("id", team.id);
      if (error) { e.target.checked = true; return toast(friendly(error), "err"); }
      toast(`${team.name} marked as unpaid.`);
      await openSeason(S.season.id);
    }
  };

  root.onsubmit = async (e) => {
    const form = e.target;
    const kind = form.dataset.form;
    if (!kind) return;
    e.preventDefault();
    const fd = new FormData(form);
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      if (kind === "invite") {
        const name = String(fd.get("name") || "").trim();
        const email = String(fd.get("email") || "").trim().toLowerCase();
        const contact = String(fd.get("contact_name") || "").trim() || null;
        if (name.length < 2) throw new Error("Enter a team name.");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Enter a valid email address.");
        const { error } = await S.sb.from("teams").insert({ season_id: S.season.id, name, contact_email: email, contact_name: contact });
        if (error) throw error;
        const msg = `Hi${contact ? " " + contact.split(" ")[0] : ""},\n\n${name} is invited to the ${S.season.name} VFX Football League. Register your team details, logo and squad here:\n\n${portalUrl()}\n\nSign in with ${email} — you'll get a link and a code by email, no password needed.\n\nThanks!`;
        await openSeason(S.season.id);
        const subject = `${name}: register for the ${S.season.name} VFL`;
        const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
        const out = root.querySelector("[data-invite-result]");
        out.innerHTML = html`
          <div class="invite-result">
            <p><span class="pill pill--ok">Added</span> <strong>No email has been sent yet.</strong> Send ${email} this message so they know to sign in:</p>
            <pre class="invite-msg">${msg}</pre>
            <div class="btn-row">
              <a class="btn btn--sm" href="${mailto}" data-mailto>Open in my email app</a>
              <button class="btn btn--ghost btn--sm" type="button" data-copy="${msg}">Copy message</button>
            </div>
          </div>`;
        out.scrollIntoView({ block: "nearest" });
        return;
      }
      if (kind === "season") {
        const id = String(fd.get("id") || "").trim();
        const name = String(fd.get("name") || "").trim();
        if (!/^[A-Za-z0-9_-]{1,20}$/.test(id)) throw new Error("Season id: letters, numbers, - or _ only.");
        if (!name) throw new Error("Give the season a name.");
        const makeCurrent = fd.get("current") === "on";
        if (makeCurrent) {
          const old = (S.seasons || []).find((x) => x.is_current);
          if (old) { const { error } = await S.sb.from("seasons").update({ is_current: false }).eq("id", old.id); if (error) throw error; }
        }
        const { error } = await S.sb.from("seasons").insert({ id, name, is_current: makeCurrent });
        if (error) throw error;
        toast(`${name} created.`);
        return load(S.sb, S.user, id);
      }
      if (kind === "purge") {
        if (String(fd.get("confirm") || "").trim() !== S.season.id) throw new Error(`Type ${S.season.id} exactly to confirm.`);
        // Files first, through the Storage API (deleting rows in SQL would
        // leave the files behind), then the player records.
        await removePhotos(S.sb, S.players.map((p) => p.photo_path));
        const { data, error } = await S.sb.rpc("purge_season_players", { p_season: S.season.id });
        if (error) throw error;
        toast(`Deleted ${data} players${S.agents.length ? ` and ${S.agents.length} free agents` : ""} from ${S.season.name}.`);
        return openSeason(S.season.id);
      }
    } catch (err) {
      toast(friendly(err), "err");
    } finally {
      const b = form.isConnected && form.querySelector("[type=submit]");
      if (b) b.disabled = false;
    }
  };
}
