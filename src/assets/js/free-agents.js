// /free-agents/: highlight the phase the pool is in now.
// Asks the database (fa_current_phase(), public and read-only: it returns the
// phase and nothing else) with a plain fetch, no Supabase library. If the
// portal isn't set up, the request fails or takes too long, nothing changes:
// the page reads fine without it.
const section = document.getElementById("phases");
const url = section?.dataset.supabaseUrl;
const key = section?.dataset.supabaseKey;

async function currentPhase() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/fa_current_phase`, {
      headers: { apikey: key, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const phase = await res.json();
    return typeof phase === "string" ? phase : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

if (url && key) {
  currentPhase().then((phase) => {
    const el = phase && section.querySelector(`[data-phase="${CSS.escape(phase)}"]`);
    if (!el) return;
    el.classList.add("is-current");
    const now = document.createElement("span");
    now.className = "pill pill--ok phase-now";
    now.textContent = "Now";
    now.title = "The pool is in this phase now";
    (el.querySelector(".card__num") || el.querySelector("strong") || el).append(now);
  });
}
