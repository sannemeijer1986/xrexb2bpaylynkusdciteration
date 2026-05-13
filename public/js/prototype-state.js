/**
 * PayLynk static prototype — local state + floating controls (no backend).
 */
(() => {
  const STORAGE_PREFIX = "xrex.paylynk.prototype.";
  const EMPTY_KEY = `${STORAGE_PREFIX}empty.v1`;
  const LOGGED_IN_KEY = `${STORAGE_PREFIX}loggedIn.v1`;
  const CONSENT_AT_KEY = `${STORAGE_PREFIX}consentCompletedAtIso.v1`;

  const STATE_CONFIGS = {
    setupProgress: {
      storageKey: `${STORAGE_PREFIX}setupProgress.v1`,
      min: 1,
      max: 10,
      initial: 1,
      labels: {
        1: "Init",
        2: "Consented",
        3: "E-mail verified",
        4: "Passcode created",
        5: "Cur&Netw. selected",
        6: "...",
        7: "...",
        8: "...",
        9: "...",
        10: "...",
      },
    },
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const states = {};

  function syncSetupStepperFromProgress(p) {
    const root = document.querySelector(".setup-steps");
    if (!root) return;
    const tracks = root.querySelectorAll(".setup-steps__track");
    const items = root.querySelectorAll(".setup-steps__item");

    if (p >= 4) {
      tracks[0]?.classList.add("setup-steps__track--done");
      tracks[1]?.classList.add("setup-steps__track--done");
      items.forEach((el) => {
        el.classList.add("setup-steps__item--done");
        el.classList.remove("setup-steps__item--current");
      });
      root.setAttribute("aria-label", "Setup steps complete");
      return;
    }

    const step = clamp(p, 1, 3);
    if (tracks[0]) {
      tracks[0].classList.toggle("setup-steps__track--done", step >= 2);
    }
    if (tracks[1]) {
      tracks[1].classList.toggle("setup-steps__track--done", step >= 3);
    }
    items.forEach((el, i) => {
      const n = i + 1;
      el.classList.toggle("setup-steps__item--done", n < step);
      el.classList.toggle("setup-steps__item--current", n === step);
    });
    root.setAttribute("aria-label", `Step ${step} of 3`);
  }

  function syncWalletTimelineFromProgress(p) {
    const steps = document.querySelectorAll(".setup-timeline__step");
    if (!steps.length) return;

    if (p >= 4) {
      steps.forEach((el) => {
        el.classList.remove(
          "setup-timeline__step--active",
          "setup-timeline__step--pending",
          "setup-timeline__step--done",
        );
        el.classList.add("setup-timeline__step--done");
      });
      return;
    }

    const step = clamp(p, 1, 3);
    steps.forEach((el, i) => {
      const n = i + 1;
      el.classList.remove(
        "setup-timeline__step--active",
        "setup-timeline__step--pending",
        "setup-timeline__step--done",
      );
      if (n < step) el.classList.add("setup-timeline__step--done");
      else if (n === step) el.classList.add("setup-timeline__step--active");
      else el.classList.add("setup-timeline__step--pending");
    });
  }

  function formatConsentDate(d) {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  }

  function syncConsentTimestamp() {
    const el = document.querySelector("[data-consent-at]");
    if (!el) return;
    const p = states.setupProgress;
    if (p < 2) {
      el.textContent = "";
      return;
    }
    let iso = null;
    try {
      iso = window.localStorage?.getItem(CONSENT_AT_KEY);
    } catch (_) {
      /* ignore */
    }
    if (!iso) {
      iso = new Date().toISOString();
      try {
        window.localStorage?.setItem(CONSENT_AT_KEY, iso);
      } catch (_) {
        /* ignore */
      }
    }
    const d = new Date(iso);
    el.textContent = Number.isFinite(d.getTime()) ? formatConsentDate(d) : "";
  }

  function applySetupProgressToUi() {
    const p = states.setupProgress;
    document.documentElement.dataset.prototypeSetupProgress = String(p);
    syncSetupStepperFromProgress(p);
    syncWalletTimelineFromProgress(p);
    syncConsentTimestamp();
  }

  function getLabel(group, value) {
    const cfg = STATE_CONFIGS[group];
    return cfg?.labels?.[value] ?? "";
  }

  function updateGroupUI(group) {
    const config = STATE_CONFIGS[group];
    if (!config) return;
    const value = states[group];
    document.querySelectorAll(`[data-state-group="${group}"]`).forEach((groupEl) => {
      const valueEl = groupEl.querySelector("[data-state-value]");
      const nameEl = groupEl.querySelector("[data-state-name]");
      const downBtn = groupEl.querySelector('[data-state-action="down"]');
      const upBtn = groupEl.querySelector('[data-state-action="up"]');
      if (valueEl) valueEl.textContent = String(value);
      if (nameEl) nameEl.textContent = getLabel(group, value);
      if (downBtn) downBtn.disabled = value <= config.min;
      if (upBtn) upBtn.disabled = value >= config.max;
    });
  }

  function setState(group, next, opts = {}) {
    const config = STATE_CONFIGS[group];
    if (!config) return;
    const clamped = clamp(parseInt(String(next), 10), config.min, config.max);
    if (!opts.force && states[group] === clamped) return clamped;
    states[group] = clamped;
    try {
      window.localStorage?.setItem(config.storageKey, String(clamped));
    } catch (_) {
      /* ignore */
    }
    updateGroupUI(group);
    if (group === "setupProgress") applySetupProgressToUi();
    return clamped;
  }

  const changeState = (group, delta) =>
    setState(group, (states[group] ?? 0) + delta);

  function loadStored(group) {
    const config = STATE_CONFIGS[group];
    try {
      const raw = window.localStorage?.getItem(config.storageKey);
      if (raw == null) return null;
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) return clamp(n, config.min, config.max);
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function initStates() {
    Object.keys(STATE_CONFIGS).forEach((group) => {
      const config = STATE_CONFIGS[group];
      const stored = loadStored(group);
      const fallback =
        typeof config.initial === "number" ? config.initial : config.min;
      states[group] = stored ?? fallback;
      updateGroupUI(group);
    });
    applySetupProgressToUi();
  }

  function initBadgeControls() {
    const badge = document.querySelector(".build-badge");
    if (!badge) return;
    const header = badge.querySelector(".build-badge__header");
    const toggleCollapse = () => {
      const isCollapsed = badge.classList.toggle("is-collapsed");
      if (header) header.setAttribute("aria-expanded", String(!isCollapsed));
    };

    header?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCollapse();
    });

    badge.addEventListener("click", (e) => {
      if (!badge.classList.contains("is-collapsed")) return;
      if (e.target.closest("[data-state-action]")) return;
      toggleCollapse();
    });

    badge.addEventListener("click", (e) => {
      const button = e.target.closest("[data-state-action]");
      if (!button) return;
      const groupEl = button.closest("[data-state-group]");
      const group = groupEl?.getAttribute("data-state-group");
      if (!group || !STATE_CONFIGS[group]) return;
      const action = button.getAttribute("data-state-action");
      if (action === "down") changeState(group, -1);
      if (action === "up") changeState(group, 1);
    });
  }

  /** Reserved — persists only; wire UI later. */
  function initEmptyCheckbox() {
    const input = document.querySelector("[data-prototype-empty]");
    if (!input) return;
    try {
      input.checked = window.localStorage?.getItem(EMPTY_KEY) === "1";
    } catch (_) {
      input.checked = false;
    }
    input.addEventListener("change", () => {
      try {
        window.localStorage?.setItem(EMPTY_KEY, input.checked ? "1" : "0");
      } catch (_) {
        /* ignore */
      }
    });
  }

  /** Reserved — persists only; wire UI later. */
  function initLoggedInSelect() {
    const select = document.querySelector("[data-prototype-logged-in]");
    if (!select) return;
    try {
      const v = window.localStorage?.getItem(LOGGED_IN_KEY);
      if (v === "true") select.value = "true";
      else select.value = "false";
    } catch (_) {
      select.value = "false";
    }
    select.addEventListener("change", () => {
      try {
        window.localStorage?.setItem(LOGGED_IN_KEY, select.value);
      } catch (_) {
        /* ignore */
      }
    });
  }

  function initTimelineAgreeButton() {
    document.querySelectorAll(".setup-timeline-agree").forEach((btn) => {
      btn.addEventListener("click", () => {
        setState("setupProgress", 2, { force: true });
      });
    });
  }

  function initPrototypeReset() {
    const resetBtn = document.querySelector("[data-prototype-reset]");
    if (!resetBtn) return;
    resetBtn.addEventListener("click", () => {
      const config = STATE_CONFIGS.setupProgress;
      const base =
        typeof config.initial === "number" ? config.initial : config.min;
      setState("setupProgress", base, { force: true });

      const emptyInput = document.querySelector("[data-prototype-empty]");
      if (emptyInput) {
        emptyInput.checked = false;
        try {
          window.localStorage?.setItem(EMPTY_KEY, "0");
        } catch (_) {
          /* ignore */
        }
      }

      const loggedIn = document.querySelector("[data-prototype-logged-in]");
      if (loggedIn) {
        loggedIn.value = "false";
        try {
          window.localStorage?.setItem(LOGGED_IN_KEY, "false");
        } catch (_) {
          /* ignore */
        }
      }

      try {
        window.localStorage?.removeItem(CONSENT_AT_KEY);
      } catch (_) {
        /* ignore */
      }
      syncConsentTimestamp();
    });
  }

  function init() {
    initStates();
    initBadgeControls();
    initTimelineAgreeButton();
    initEmptyCheckbox();
    initLoggedInSelect();
    initPrototypeReset();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
