// VFL free-agent pool: the player's own page, and the pool panel on a team's page.
import { html, raw, toast, friendly, fmtDate, initials, logoUrl } from "./lib.js";

// ---------------------------------------------------------------- vocab
export const FA_POSITIONS = [
  { value: "goalkeeper", short: "GK",  label: "Goalkeeper" },
  { value: "defender",   short: "DEF", label: "Defender" },
  { value: "midfielder", short: "MID", label: "Midfielder" },
  { value: "forward",    short: "FWD", label: "Forward" },
];
export const AVAILABILITY = [
  { value: "every", label: "Every game" },
  { value: "most",  label: "Most games" },
  { value: "some",  label: "Some games" },
];
export const STYLES = [
  { value: "social",      label: "Social",      hint: "Here for the fun and the fitness" },
  { value: "competitive", label: "Competitive", hint: "Here to win, every game counts" },
];
const posShort = (v) => FA_POSITIONS.find((p) => p.value === v)?.short || v;
const posLong = (v) => FA_POSITIONS.find((p) => p.value === v)?.label || v;
export const positionsShort = (list) => (list || []).map(posShort).join(" · ");
export const positionsLong = (list) => (list || []).map(posLong).join(", ");
export const availabilityLabel = (v) => AVAILABILITY.find((x) => x.value === v)?.label || v || "";
export const styleLabel = (v) => STYLES.find((x) => x.value === v)?.label || v || "";

// Mirrors the database: spaces, brackets, dots and dashes go; 00 becomes +.
export function normPhone(v) {
  let s = String(v || "").replace(/[\s().-]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  return s;
}
// wa.me wants the full international number without "+". UK numbers are
// often typed as 07…, so treat a leading 0 as +44.
function whatsappUrl(phone) {
  let d = normPhone(phone);
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("0")) d = "44" + d.slice(1);
  return /^\d{8,15}$/.test(d) ? `https://wa.me/${d}` : "";
}

export function validateAgent(a, { isNew }) {
  const errs = {};
  const name = (a.full_name || "").trim().replace(/\s+/g, " ");
  if (name.length < 2) errs.full_name = "Enter your name.";
  else if (name.length > 80) errs.full_name = "That name is too long.";
  if (a.phone && !/^\+?\d{7,15}$/.test(a.phone)) errs.phone = "That doesn't look like a phone number.";
  if (!a.positions.length) errs.positions = "Pick at least one position.";
  if (!a.availability) errs.availability = "Pick how often you can play.";
  if (!a.play_style) errs.play_style = "Pick one.";
  if (a.wantsOther && !a.current_team_other) errs.current_team_other = "Enter the team's name, or pick another option.";
  if (isNew && !a.consent) errs.consent = "Tick this to join the pool.";
  return errs;
}

// =============================================================================
// The player's page
// =============================================================================
// ctx: { root, sb, email, season, bar() -> html string }
export async function agentPage(ctx) {
  const A = { ...ctx, profile: null, seasonTeams: [], interest: [] };
  const { root } = A;

  if (!A.season) {
    root.innerHTML = html`
      ${raw(A.bar())}
      <div class="panel portal-auth">
        <div class="eyebrow eyebrow--plain">Free agents</div>
        <h2>There's no season open yet</h2>
        <p class="muted">The pool opens when the organisers start the next season. Check back soon.</p>
      </div>`;
    return;
  }

  async function load() {
    root.innerHTML = `<div class="portal-loading" aria-busy="true">Loading your profile…</div>`;
    try {
      const [p, t, m] = await Promise.all([
        // organisers can read every profile, so filter to the caller's own
        A.sb.from("free_agents").select("*").eq("season_id", A.season.id).eq("email", A.email),
        A.sb.rpc("fa_season_teams"),
        A.sb.rpc("fa_my_teams"),
      ]);
      for (const r of [p, t, m]) if (r.error) throw r.error;
      A.profile = p.data[0] || null;
      A.seasonTeams = t.data || [];
      A.interest = A.profile ? (m.data || []) : [];
      render();
    } catch (err) {
      root.innerHTML = html`
        ${raw(A.bar())}
        <div class="panel portal-auth">
          <div class="eyebrow eyebrow--plain">Something went wrong</div>
          <h2>We couldn't load your profile</h2>
          <p class="muted">${friendly(err)}</p>
          <div class="btn-row"><button class="btn" type="button" onclick="location.reload()">Try again</button></div>
        </div>`;
    }
  }

  function render() {
    const a = A.profile;
    root.innerHTML = html`
      ${raw(A.bar())}
      ${A.season.locked ? raw(html`<div class="portal-flag portal-flag--lock"><strong>Locked</strong> The ${A.season.name} squads are locked, so offers can't be accepted right now. Contact the organisers if you need to.</div>`) : ""}
      ${a ? raw(hero()) : raw(intro())}
      ${a ? raw(teamsPanel()) : ""}
      <section class="panel" id="fa-profile">
        <h2 class="portal-h">${a ? "Your profile" : "Your details"}</h2>
        ${raw(profileForm())}
      </section>
      ${a && a.status !== "signed" ? raw(managePanel()) : ""}`;
    wire();
  }

  const signedTeam = () => A.interest.find((x) => x.team_id === A.profile?.signed_team_id);

  function intro() {
    return html`
      <section class="panel panel--accent fa-intro">
        <div class="eyebrow">${A.season.name} · Free agents</div>
        <h2 class="fa-intro__title">Join the free-agent pool</h2>
        <p class="muted">Tell the captains what you play and when you're free. Every team that's interested shows up on this page with its contact details, and you choose which offer to accept. You join one team, for the whole season.</p>
      </section>`;
  }

  function hero() {
    const a = A.profile;
    const st = a.status === "signed"
      ? html`<span class="pill pill--ok">Joined ${signedTeam()?.team_name || "a team"}</span> You're with them for the whole season.`
      : a.status === "withdrawn"
        ? html`<span class="pill pill--warn">Taking a break</span> Teams can't see you until you're back in the pool.`
        : html`<span class="pill pill--ok">In the pool</span> Captains in the league can see your profile.`;
    return html`
      <section class="portal-hero">
        <div class="portal-hero__badge portal-hero__badge--person"><span>${initials(a.full_name)}</span></div>
        <div class="portal-hero__text">
          <div class="eyebrow">${A.season.name} · Free agent</div>
          <h2 class="portal-hero__title">${a.full_name}</h2>
          <p class="muted" data-fa-status-line>${raw(st)}</p>
        </div>
      </section>`;
  }

  function teamsPanel() {
    const a = A.profile;
    const list = A.interest;
    const canAnswer = a.status === "available" && !A.season.locked;
    const offers = list.filter((x) => x.offered_at).length;
    return html`
      <section class="panel ${offers && a.status === "available" ? "panel--accent" : ""}" id="fa-teams">
        <h2 class="portal-h">Interested teams <span class="count">${list.length}</span></h2>
        ${list.length ? raw(html`
          <p class="muted">${a.status === "signed"
            ? "The other teams can see you've joined someone else."
            : offers
              ? "Accept the offer you want. You can only join one team, and the others close when you do."
              : "These teams can see your email address and phone number. They'll usually get in touch first, but you can too."}</p>
          <ul class="fa-teams" role="list">
            ${list.map((t) => raw(teamRow(t, canAnswer)))}
          </ul>`)
        : raw(`<p class="muted empty">No teams yet. When a captain marks you as interested, their team shows up here with how to reach them.</p>`)}
      </section>`;
  }

  function teamRow(t, canAnswer) {
    const a = A.profile;
    const logo = logoUrl(A.sb, t.logo_path);
    const mine = a.status === "signed" && a.signed_team_id === t.team_id;
    const state = mine
      ? html`<span class="pill pill--ok">Your team</span>`
      : t.offered_at
        ? html`<span class="pill pill--accent">Offer</span> Offered you a place on ${fmtDate(t.offered_at)}`
        : t.declined_at
          ? html`<span class="pill">Declined</span> You turned down their offer`
          : html`<span class="pill">Interested</span> Since ${fmtDate(t.created_at)}`;
    return html`
      <li class="fa-team ${t.offered_at && !mine ? "is-offer" : ""}" data-fa-team="${t.team_id}">
        <span class="fa-team__badge">${logo ? raw(html`<img src="${logo}" alt="">`) : raw(html`<span>${initials(t.team_name)}</span>`)}</span>
        <div class="fa-team__body">
          <div class="fa-team__name">${t.team_name}${t.studio && t.studio !== t.team_name ? raw(html` <span class="dim">· ${t.studio}</span>`) : ""}</div>
          <div class="fa-team__state">${raw(state)}</div>
          <div class="fa-team__contact">${t.contact_name ? `${t.contact_name} · ` : "Captain · "}<a href="mailto:${t.contact_email}">${t.contact_email}</a></div>
        </div>
        ${t.offered_at && canAnswer ? raw(html`
          <div class="fa-team__actions">
            <button class="btn btn--sm" type="button" data-fa-accept="${t.team_id}">Accept</button>
            <button class="btn btn--ghost btn--sm" type="button" data-fa-decline="${t.team_id}">Decline</button>
          </div>`) : ""}
      </li>`;
  }

  function managePanel() {
    const a = A.profile;
    return html`
      <section class="panel" id="fa-manage">
        <h2 class="portal-h">Pool status</h2>
        ${a.status === "withdrawn"
          ? raw(`<p class="muted">You're taking a break. Come back whenever you like: your profile and any interest are still here.</p>
                 <div class="btn-row"><button class="btn btn--sm" type="button" data-fa-status="available">Back in the pool</button>
                 <button class="btn btn--ghost btn--sm btn--danger" type="button" data-fa-delete>Delete my profile</button></div>`)
          : raw(`<p class="muted">Away for a while, or found a team another way? Take a break and teams won't see you. Your profile and any interest stay.</p>
                 <div class="btn-row"><button class="btn btn--ghost btn--sm" type="button" data-fa-status="withdrawn">Take a break</button>
                 <button class="btn btn--ghost btn--sm btn--danger" type="button" data-fa-delete>Delete my profile</button></div>`)}
      </section>`;
  }

  function profileForm() {
    const a = A.profile || { full_name: "", phone: "", positions: [], previous_teams: "", current_team_id: null, current_team_other: "", availability: "", availability_note: "", play_style: "", about: "" };
    const isNew = !A.profile;
    const signed = a.status === "signed";
    const sel = a.current_team_id || (a.current_team_other ? "__other" : "");
    const choice = (type, name, opts, checked, extra = "") => opts.map((o) => raw(html`
      <label class="choice">
        <input type="${type}" name="${name}" value="${o.value}" ${checked(o.value) ? "checked" : ""} ${extra}>
        <span class="choice__box"><span class="choice__main">${o.short || o.label}</span>${o.hint || o.short ? raw(html`<span class="choice__sub">${o.hint || o.label}</span>`) : ""}</span>
      </label>`));
    return html`
      <form class="form fa-form" data-form="agent" novalidate>
        <div class="field--2">
          <div class="field">
            <label for="fa-name">Full name</label>
            <input id="fa-name" name="full_name" required maxlength="80" value="${a.full_name}" autocomplete="name">
            <span class="field-err" data-err="full_name"></span>
          </div>
          <div class="field">
            <label for="fa-phone">Phone <span class="opt">optional</span></label>
            <input id="fa-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="24" value="${a.phone || ""}" placeholder="07700 900123">
            <span class="field-err" data-err="phone"></span>
          </div>
        </div>
        <p class="form-note fa-form__note">Teams reach you by email (<strong>${A.email}</strong>) or phone. A phone number is optional, but it's the quickest way to hear from a captain. Both are only shown to teams that mark you as interested.</p>

        <fieldset class="field fa-choices">
          <legend>Positions <span class="opt">pick all you'd play</span></legend>
          <div class="choices choices--4">${choice("checkbox", "positions", FA_POSITIONS, (v) => a.positions.includes(v))}</div>
          <span class="field-err" data-err="positions"></span>
        </fieldset>

        <fieldset class="field fa-choices">
          <legend>How competitive are you?</legend>
          <div class="choices choices--2">${choice("radio", "play_style", STYLES, (v) => a.play_style === v)}</div>
          <span class="field-err" data-err="play_style"></span>
        </fieldset>

        <fieldset class="field fa-choices">
          <legend>Availability</legend>
          <div class="choices choices--3">${choice("radio", "availability", AVAILABILITY, (v) => a.availability === v)}</div>
          <span class="field-err" data-err="availability"></span>
          <label for="fa-avail-note" class="visually-hidden">Anything to add about availability</label>
          <input id="fa-avail-note" name="availability_note" maxlength="200" value="${a.availability_note || ""}" placeholder="Anything to add? e.g. not Thursdays, away 3–17 March">
        </fieldset>

        <div class="field--2">
          <div class="field">
            <label for="fa-current">Current team</label>
            <select id="fa-current" name="current_team" ${signed ? "disabled" : ""}>
              <option value="" ${sel === "" ? "selected" : ""}>No team right now</option>
              ${A.seasonTeams.length ? raw(html`<optgroup label="In the league this season">
                ${A.seasonTeams.map((t) => raw(html`<option value="${t.id}" ${sel === t.id ? "selected" : ""}>${t.name}</option>`))}
              </optgroup>`) : ""}
              <option value="__other" ${sel === "__other" ? "selected" : ""}>Another team (not in the league)</option>
            </select>
            <input name="current_team_other" maxlength="80" value="${a.current_team_other || ""}" placeholder="Team name" aria-label="Team name" data-fa-other ${sel === "__other" ? "" : "hidden"} ${signed ? "disabled" : ""}>
            <span class="form-note" data-fa-loan-note ${A.seasonTeams.some((t) => t.id === sel) ? "" : "hidden"}>Your team is in the league, so joining another team would be a loan.</span>
            <span class="field-err" data-err="current_team_other"></span>
          </div>
          <div class="field">
            <label for="fa-prev">Previous teams <span class="opt">optional</span></label>
            <input id="fa-prev" name="previous_teams" maxlength="300" value="${a.previous_teams || ""}" placeholder="e.g. DNEG Dynamos (2024–25), Framestore FC">
          </div>
        </div>

        <div class="field">
          <label for="fa-about">About you <span class="opt">optional</span></label>
          <textarea id="fa-about" name="about" rows="3" maxlength="500" placeholder="Anything a captain should know: experience, fitness, which studio you're at…">${a.about || ""}</textarea>
          <span class="char-count" data-fa-count>${(a.about || "").length} / 500</span>
        </div>

        ${isNew ? raw(html`
          <label class="check">
            <input type="checkbox" name="consent">
            <span>I'm 18 or over. Show my profile to the team captains in this season's league. My email and phone go only to teams that mark me as interested. <a href="/privacy/" target="_blank" rel="noopener">How we use this</a>.</span>
          </label>
          <span class="field-err" data-err="consent"></span>`) : ""}

        <div class="form-status" data-status role="status"></div>
        <div class="btn-row"><button class="btn" type="submit">${isNew ? "Join the pool" : "Save profile"}</button></div>
      </form>`;
  }

  function wire() {
    root.oninput = (e) => {
      if (e.target.id === "fa-about") {
        const c = root.querySelector("[data-fa-count]");
        if (c) c.textContent = `${e.target.value.length} / 500`;
      }
    };
    root.onchange = (e) => {
      if (e.target.id === "fa-current") {
        const other = root.querySelector("[data-fa-other]");
        other.hidden = e.target.value !== "__other";
        if (!other.hidden) other.focus();
        root.querySelector("[data-fa-loan-note]").hidden = !A.seasonTeams.some((t) => t.id === e.target.value);
      }
    };
    root.onsubmit = async (e) => {
      if (e.target.dataset.form !== "agent") return;
      e.preventDefault();
      const form = e.target;
      const fd = new FormData(form);
      const sel = fd.get("current_team");
      const row = {
        full_name: String(fd.get("full_name") || "").trim().replace(/\s+/g, " "),
        phone: normPhone(fd.get("phone")) || null,
        positions: fd.getAll("positions"),
        play_style: fd.get("play_style") || "",
        availability: fd.get("availability") || "",
        availability_note: String(fd.get("availability_note") || "").trim() || null,
        current_team_id: sel && sel !== "__other" ? sel : null,
        current_team_other: sel === "__other" ? (String(fd.get("current_team_other") || "").trim() || null) : null,
        previous_teams: String(fd.get("previous_teams") || "").trim() || null,
        about: String(fd.get("about") || "").trim() || null,
      };
      const isNew = !A.profile;
      form.querySelectorAll("[data-err]").forEach((el) => (el.textContent = ""));
      const errs = validateAgent({ ...row, wantsOther: sel === "__other", consent: fd.get("consent") === "on" }, { isNew });
      if (Object.keys(errs).length) {
        for (const [k, v] of Object.entries(errs)) { const el = form.querySelector(`[data-err="${k}"]`); if (el) el.textContent = v; }
        form.querySelector(`[name="${Object.keys(errs)[0]}"]`)?.focus();
        return;
      }
      if (A.profile?.status === "signed") { delete row.current_team_id; delete row.current_team_other; }

      const btn = form.querySelector("[type=submit]");
      btn.disabled = true;
      const status = form.querySelector("[data-status]");
      try {
        const q = isNew
          ? A.sb.from("free_agents").insert({ ...row, season_id: A.season.id })
          : A.sb.from("free_agents").update(row).eq("id", A.profile.id);
        const { error } = await q;
        if (error) throw error;
        toast(isNew ? "You're in the pool. Teams can see your profile now." : "Profile saved.");
        await load();
        if (isNew) root.querySelector("#fa-teams")?.scrollIntoView({ block: "start" });
      } catch (err) {
        status.className = "form-status form-status--err is-visible";
        status.textContent = friendly(err);
        btn.disabled = false;
      }
    };
    root.onclick = async (e) => {
      const t = e.target;
      if (t.closest("[data-signout]")) return A.signOut();
      const acc = t.closest("[data-fa-accept]");
      const dec = t.closest("[data-fa-decline]");
      if (acc || dec) {
        const teamId = (acc || dec).dataset[acc ? "faAccept" : "faDecline"];
        const team = A.interest.find((x) => x.team_id === teamId);
        const ok = acc
          ? confirm(`Join ${team?.team_name} for the whole ${A.season.name} season?\n\nYou can only join one team. Your other offers will close.`)
          : confirm(`Turn down ${team?.team_name}'s offer?`);
        if (!ok) return;
        (acc || dec).disabled = true;
        const { error } = await A.sb.rpc("fa_respond", { p_team: teamId, p_accept: !!acc });
        if (error) { (acc || dec).disabled = false; return toast(friendly(error), "err"); }
        toast(acc ? `You've joined ${team?.team_name}. Their captain will add you to the squad.` : "Offer declined.");
        return load();
      }
      const st = t.closest("[data-fa-status]");
      if (st) {
        st.disabled = true;
        const { error } = await A.sb.from("free_agents").update({ status: st.dataset.faStatus }).eq("id", A.profile.id);
        if (error) { st.disabled = false; return toast(friendly(error), "err"); }
        toast(st.dataset.faStatus === "withdrawn" ? "You're taking a break. Teams can't see you." : "You're back in the pool.");
        return load();
      }
      if (t.closest("[data-fa-delete]")) {
        if (!confirm("Delete your free-agent profile? Teams that were interested will lose your details.")) return;
        const { error } = await A.sb.from("free_agents").delete().eq("id", A.profile.id);
        if (error) return toast(friendly(error), "err");
        toast("Profile deleted.");
        return load();
      }
    };
  }

  await load();
}

// =============================================================================
// The pool, on a team's page
// =============================================================================
// Players who accepted this team's offer but aren't in the squad yet.
export const pendingSignings = (pool, players) =>
  (pool || []).filter((a) => a.signed_here && !players.some((p) => p.free_agent_id === a.id));

export function poolSection(P) {
  // P: { pool, filter, players, locked, sb }
  const all = P.pool || [];
  const counts = Object.fromEntries(FA_POSITIONS.map((p) => [p.value, all.filter((a) => a.status === "available" && a.positions.includes(p.value)).length]));
  const available = all.filter((a) => a.status === "available").length;
  const rank = (a) => (a.signed_here ? 0 : a.offered_at ? 1 : a.interested && a.status === "available" ? 2 : a.status === "available" ? 3 : 4);
  const shown = all
    .filter((a) => !P.filter || a.positions.includes(P.filter))
    .sort((x, y) => rank(x) - rank(y) || String(x.created_at).localeCompare(String(y.created_at)));
  return html`
    <section class="panel" id="free-agents">
      <div class="portal-section-head">
        <h2 class="portal-h">Free agents <span class="count">${available}</span></h2>
        <a class="form-note" href="/free-agents/" target="_blank" rel="noopener">How it works</a>
      </div>
      <p class="muted">Players looking for a team this season. Mark one as interested to see their email and phone; they'll see your team on their page too. Once you've agreed, offer them a place. When they accept, add them to your squad.</p>
      ${all.length ? raw(html`
        <div class="fa-filter" role="group" aria-label="Filter by position">
          <button type="button" class="chip" data-fa-filter="" aria-pressed="${!P.filter}">All <span>${available}</span></button>
          ${FA_POSITIONS.map((p) => raw(html`<button type="button" class="chip" data-fa-filter="${p.value}" aria-pressed="${P.filter === p.value}">${p.short} <span>${counts[p.value]}</span></button>`))}
        </div>
        ${shown.length
          ? raw(html`<div class="agents">${shown.map((a) => raw(agentCard(a, P)))}</div>`)
          : raw(`<p class="muted empty">Nobody in that position right now.</p>`)}`)
      : raw(`<p class="muted empty">Nobody in the pool yet. Players sign up on the <a href="/free-agents/">free agents page</a>; share it if you're short.</p>`)}
    </section>`;
}

function agentCard(a, P) {
  const inSquad = P.players.some((p) => p.free_agent_id === a.id);
  const gone = a.status === "signed" && !a.signed_here;
  const style = STYLES.find((s) => s.value === a.play_style);
  const others = a.interest_count - (a.interested ? 1 : 0);
  const wa = a.phone ? whatsappUrl(a.phone) : "";

  let actions;
  if (a.signed_here) {
    actions = inSquad
      ? html`<span class="pill pill--ok">In your squad</span>`
      : html`<span class="pill pill--ok">Joined your team</span><button class="btn btn--sm" type="button" data-fa-add="${a.id}">Add to squad</button>`;
  } else if (gone) {
    actions = html`<span class="pill">Joined another team</span>`;
  } else if (!a.interested) {
    actions = html`<button class="btn btn--sm" type="button" data-fa-interest="${a.id}" data-on="1">Interested</button>`;
  } else {
    actions = html`
      ${a.offered_at
        ? raw(html`<span class="pill pill--accent">Offer sent</span><button class="btn btn--ghost btn--sm" type="button" data-fa-offer="${a.id}" data-on="0">Withdraw offer</button>`)
        : raw(html`<button class="btn btn--sm" type="button" data-fa-offer="${a.id}" data-on="1" ${P.locked ? "disabled" : ""}>Offer a place</button>`)}
      <button class="btn btn--ghost btn--sm" type="button" data-fa-interest="${a.id}" data-on="0">Not interested</button>`;
  }

  return html`
    <article class="agent ${a.interested && !gone ? "is-interested" : ""} ${gone ? "is-gone" : ""}" data-agent="${a.id}">
      <header class="agent__head">
        <span class="agent__avatar">${initials(a.full_name)}</span>
        <div class="agent__who">
          <h3 class="agent__name">${a.full_name}</h3>
          <div class="agent__pos" title="${positionsLong(a.positions)}">${positionsShort(a.positions)}</div>
        </div>
        <span class="agent__style agent__style--${a.play_style}" title="${style?.hint || ""}">${style?.label || ""}</span>
      </header>
      <dl class="agent__facts">
        <div><dt>Availability</dt><dd>${availabilityLabel(a.availability)}${a.availability_note ? ` · ${a.availability_note}` : ""}</dd></div>
        <div><dt>Current team</dt><dd>${a.current_team || raw(`<span class="dim">None</span>`)}${a.is_loan ? raw(` <span class="pill">Loan</span>`) : ""}</dd></div>
        ${a.previous_teams ? raw(html`<div><dt>Previously</dt><dd>${a.previous_teams}</dd></div>`) : ""}
      </dl>
      ${a.about ? raw(html`<p class="agent__about">${a.about}</p>`) : ""}
      ${a.interested && !gone ? raw(html`
        <div class="agent__contact">
          <a href="mailto:${a.email}">${a.email}</a>
          ${a.phone
            ? raw(html`<a href="tel:${a.phone}">${a.phone}</a>${wa ? raw(html`<a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`) : ""}`)
            : raw(`<span class="dim">No phone given: use email</span>`)}
        </div>
        ${a.declined_at && !a.offered_at ? raw(html`<p class="form-note">They turned down your offer on ${fmtDate(a.declined_at)}.</p>`) : ""}`) : ""}
      <footer class="agent__foot">
        <span class="dim agent__interest">${others > 0 ? `${others} other team${others === 1 ? "" : "s"} interested` : ""}</span>
        <span class="agent__actions">${raw(actions)}</span>
      </footer>
    </article>`;
}

// The parent team's view of players it has loaned out.
export function loanedOutBlock(list) {
  if (!list || !list.length) return "";
  return html`
    <div class="loaned-out">
      <h3 class="loaned-out__title">Loaned out this season</h3>
      <ul role="list">
        ${list.map((x) => raw(html`<li><strong>${x.full_name}</strong> <span class="dim">→</span> ${x.team_name}</li>`))}
      </ul>
      <p class="form-note">They play for that team this season. Don't add them to your squad as well.</p>
    </div>`;
}

// Squad row badge for players who joined through the pool.
export function joinedBadge(p) {
  if (p.joined_as === "loan") return html`<span class="pill pill--loan" title="On loan${p.loan_from ? ` from ${p.loan_from}` : ""}">Loan${p.loan_from ? ` · ${p.loan_from}` : ""}</span>`;
  if (p.joined_as === "free_agent") return html`<span class="pill pill--loan">Free agent</span>`;
  return "";
}

// Wires the pool's buttons on a team's page. `ctx` gives the team page's state.
export async function poolAction(target, ctx) {
  const { sb, teamId, pool, reload } = ctx;
  const btn = target.closest("[data-fa-interest], [data-fa-offer]");
  if (!btn) return false;
  const agentId = btn.dataset.faInterest || btn.dataset.faOffer;
  const on = btn.dataset.on === "1";
  const a = pool.find((x) => x.id === agentId);
  const first = (a?.full_name || "").split(" ")[0] || "They";
  btn.disabled = true;
  const fn = btn.dataset.faInterest ? "fa_interest" : "fa_offer";
  if (fn === "fa_interest" && !on && a?.offered_at && !confirm(`Drop ${a.full_name}? Your offer to them is withdrawn too.`)) { btn.disabled = false; return true; }
  const { error } = await sb.rpc(fn, { p_team: teamId, p_agent: agentId, p_on: on });
  if (error) { btn.disabled = false; toast(friendly(error), "err"); return true; }
  toast(fn === "fa_interest"
    ? (on ? `Marked as interested. ${first}'s contact details are on their card.` : "Removed from your shortlist.")
    : (on ? `Offer sent. ${first} accepts it from their page: let them know.` : "Offer withdrawn."));
  await reload(agentId);
  return true;
}
