/* VFL — small progressive-enhancement layer. No dependencies. */
(function () {
  "use strict";

  /* ---------------------------------------------------------- mobile nav */
  var toggle = document.querySelector("[data-nav-toggle]");
  var panel = document.querySelector("[data-nav-panel]");

  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      var open = panel.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });

    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        panel.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) {
        panel.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ------------------------------------------------------ reveal on scroll */
  var revealables = document.querySelectorAll("[data-reveal]");
  if (revealables.length) {
    if (!("IntersectionObserver" in window)) {
      revealables.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
      );
      revealables.forEach(function (el) { io.observe(el); });
    }
  }

  /* --------------------------------------------- Sofascore widget switcher */
  // Any [data-widget-switch] group drives the iframe named by data-target.
  document.querySelectorAll("[data-widget-switch]").forEach(function (group) {
    var frame = document.getElementById(group.getAttribute("data-target"));
    if (!frame) return;

    group.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-src]");
      if (!btn) return;
      group.querySelectorAll("button[data-src]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      frame.src = btn.getAttribute("data-src");
      var label = btn.getAttribute("data-label");
      var title = document.querySelector('[data-widget-label="' + group.getAttribute("data-target") + '"]');
      if (title && label) title.textContent = label;
    });
  });

  // Round <select> on the fixtures page.
  document.querySelectorAll("[data-round-select]").forEach(function (sel) {
    var frame = document.getElementById(sel.getAttribute("data-target"));
    if (!frame) return;
    sel.addEventListener("change", function () {
      var tmpl = sel.getAttribute("data-src-template");
      frame.src = tmpl.split("__ROUND__").join(sel.value);
      var lbl = document.querySelector('[data-widget-label="' + sel.getAttribute("data-target") + '"]');
      if (lbl) lbl.textContent = sel.options[sel.selectedIndex].getAttribute("data-label") || sel.options[sel.selectedIndex].text;
    });
  });

  /* --------------------------------------------------------- contact form */
  var form = document.querySelector("[data-ajax-form]");
  if (form) {
    var status = form.querySelector("[data-form-status]");
    var submit = form.querySelector("[type=submit]");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.querySelector(".hp") && form.querySelector(".hp").value) return; // honeypot

      var originalLabel = submit ? submit.textContent : "";
      if (submit) { submit.disabled = true; submit.textContent = "Sending…"; }
      if (status) { status.className = "form-status"; status.textContent = ""; }

      fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new FormData(form),
      })
        .then(function (r) { return r.json().catch(function () { return { success: r.ok }; }); })
        .then(function (data) {
          var ok = data.success === true || data.ok === true || data.success === "true";
          if (ok) {
            form.reset();
            if (status) {
              status.className = "form-status form-status--ok is-visible";
              status.textContent = "Thanks — message sent. We'll come back to you by email.";
            }
          } else {
            throw new Error(data.message || "Send failed");
          }
        })
        .catch(function () {
          if (status) {
            status.className = "form-status form-status--err is-visible";
            status.innerHTML =
              'Something went wrong. Please email us directly at <a href="mailto:' +
              form.getAttribute("data-fallback-email") + '">' +
              form.getAttribute("data-fallback-email") + "</a>.";
          }
        })
        .finally(function () {
          if (submit) { submit.disabled = false; submit.textContent = originalLabel; }
        });
    });
  }

  /* ------------------------------------------------------------ footer year */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
