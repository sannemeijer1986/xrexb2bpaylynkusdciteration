/**
 * PayLynk static prototype — local state + floating controls (no backend).
 */
(() => {
  const STORAGE_PREFIX = "xrex.paylynk.prototype.";
  const EMPTY_KEY = `${STORAGE_PREFIX}empty.v1`;
  const LOGGED_IN_KEY = `${STORAGE_PREFIX}loggedIn.v1`;
  const ACCOUNT_CREATED_KEY = `${STORAGE_PREFIX}accountCreated.v1`;
  const CONSENT_AT_KEY = `${STORAGE_PREFIX}consentCompletedAtIso.v1`;
  const EMAIL_VERIFIED_AT_KEY = `${STORAGE_PREFIX}emailVerifiedAtIso.v1`;
  const PASSCODE_SET_AT_KEY = `${STORAGE_PREFIX}passcodeSetAtIso.v1`;
  const LOGGED_IN_SESSION_END_KEY = `${STORAGE_PREFIX}loggedInSessionEndsAtIso.v1`;
  const LOGGED_IN_SESSION_MS = 5 * 60 * 1000;

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

  let loggedInTickId = null;

  function stopLoggedInTimerTick() {
    if (loggedInTickId != null) {
      window.clearInterval(loggedInTickId);
      loggedInTickId = null;
    }
  }

  function updateLoggedInTimerDisplay() {
    const els = document.querySelectorAll("[data-prototype-logged-in-timer]");
    let isTrue = false;
    try {
      isTrue = window.localStorage?.getItem(LOGGED_IN_KEY) === "true";
    } catch (_) {
      /* ignore */
    }
    if (!isTrue) {
      els.forEach((el) => {
        el.textContent = "0:00";
      });
      return;
    }
    let endMs = NaN;
    try {
      const iso = window.localStorage?.getItem(LOGGED_IN_SESSION_END_KEY);
      if (iso) endMs = new Date(iso).getTime();
    } catch (_) {
      /* ignore */
    }
    if (!Number.isFinite(endMs)) {
      els.forEach((el) => {
        el.textContent = "0:00";
      });
      return;
    }
    const remain = Math.max(0, endMs - Date.now());
    const totalSec = Math.floor(remain / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const text = `${m}:${String(s).padStart(2, "0")}`;
    els.forEach((el) => {
      el.textContent = text;
    });
    if (remain <= 0 && loggedInTickId != null) {
      window.clearInterval(loggedInTickId);
      loggedInTickId = null;
    }
  }

  function startLoggedInTimerTick() {
    stopLoggedInTimerTick();
    updateLoggedInTimerDisplay();
    let endMs = NaN;
    try {
      const iso = window.localStorage?.getItem(LOGGED_IN_SESSION_END_KEY);
      if (iso) endMs = new Date(iso).getTime();
    } catch (_) {
      /* ignore */
    }
    if (!Number.isFinite(endMs)) return;
    const remain = Math.max(0, endMs - Date.now());
    if (remain <= 0) return;
    loggedInTickId = window.setInterval(updateLoggedInTimerDisplay, 1000);
  }

  /** Persist logged-in, sync all selects, and run or clear the 5:00 session timer. */
  function setLoggedInValue(isTrue) {
    const v = isTrue ? "true" : "false";
    try {
      window.localStorage?.setItem(LOGGED_IN_KEY, v);
    } catch (_) {
      /* ignore */
    }
    document.querySelectorAll("[data-prototype-logged-in]").forEach((sel) => {
      sel.value = v;
    });
    if (isTrue) {
      const end = new Date(Date.now() + LOGGED_IN_SESSION_MS).toISOString();
      try {
        window.localStorage?.setItem(LOGGED_IN_SESSION_END_KEY, end);
      } catch (_) {
        /* ignore */
      }
      startLoggedInTimerTick();
    } else {
      try {
        window.localStorage?.removeItem(LOGGED_IN_SESSION_END_KEY);
      } catch (_) {
        /* ignore */
      }
      stopLoggedInTimerTick();
      updateLoggedInTimerDisplay();
    }
  }

  /** Account created (prototype): persisted; auto-true when verify-email loader finishes. */
  function setAccountCreatedValue(isTrue) {
    const v = isTrue ? "true" : "false";
    try {
      window.localStorage?.setItem(ACCOUNT_CREATED_KEY, v);
    } catch (_) {
      /* ignore */
    }
    document.querySelectorAll("[data-prototype-account-created]").forEach((sel) => {
      sel.value = v;
    });
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

  function syncEmailVerifiedTimestamp() {
    const el = document.querySelector("[data-email-verified-at]");
    if (!el) return;
    const p = states.setupProgress;
    if (p < 3) {
      el.textContent = "";
      return;
    }
    let iso = null;
    try {
      iso = window.localStorage?.getItem(EMAIL_VERIFIED_AT_KEY);
    } catch (_) {
      /* ignore */
    }
    if (!iso) {
      iso = new Date().toISOString();
      try {
        window.localStorage?.setItem(EMAIL_VERIFIED_AT_KEY, iso);
      } catch (_) {
        /* ignore */
      }
    }
    const d = new Date(iso);
    el.textContent = Number.isFinite(d.getTime()) ? formatConsentDate(d) : "";
  }

  function syncPasscodeTimestamp() {
    const el = document.querySelector("[data-passcode-set-at]");
    if (!el) return;
    const p = states.setupProgress;
    if (p < 4) {
      el.textContent = "";
      return;
    }
    let iso = null;
    try {
      iso = window.localStorage?.getItem(PASSCODE_SET_AT_KEY);
    } catch (_) {
      /* ignore */
    }
    if (!iso) {
      iso = new Date().toISOString();
      try {
        window.localStorage?.setItem(PASSCODE_SET_AT_KEY, iso);
      } catch (_) {
        /* ignore */
      }
    }
    const d = new Date(iso);
    el.textContent = Number.isFinite(d.getTime()) ? formatConsentDate(d) : "";
  }

  function syncWalletContinueButton() {
    const btn = document.querySelector(".setup-actions--wallet .setup-button--primary");
    if (!btn || btn.tagName !== "BUTTON") return;
    btn.disabled = states.setupProgress < 4;
  }

  function applySetupProgressToUi() {
    const p = states.setupProgress;
    document.documentElement.dataset.prototypeSetupProgress = String(p);
    syncWalletTimelineFromProgress(p);
    syncConsentTimestamp();
    syncEmailVerifiedTimestamp();
    syncPasscodeTimestamp();
    syncWalletContinueButton();
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
    const prev = states[group];
    const clamped = clamp(parseInt(String(next), 10), config.min, config.max);
    if (!opts.force && prev === clamped) return clamped;
    states[group] = clamped;
    try {
      window.localStorage?.setItem(config.storageKey, String(clamped));
    } catch (_) {
      /* ignore */
    }
    updateGroupUI(group);
    if (group === "setupProgress") {
      if (prev === 3 && clamped === 2) {
        setLoggedInValue(false);
        setAccountCreatedValue(false);
      }
      if (prev === 2 && clamped === 3) {
        setLoggedInValue(true);
        setAccountCreatedValue(true);
      }
      applySetupProgressToUi();
    }
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

  /** Logged-in dropdown + 5 min session timer (prototype controls). */
  function initLoggedInSelect() {
    const selects = document.querySelectorAll("[data-prototype-logged-in]");
    if (!selects.length) return;

    let stored = "false";
    try {
      stored = window.localStorage?.getItem(LOGGED_IN_KEY) === "true" ? "true" : "false";
    } catch (_) {
      /* ignore */
    }
    selects.forEach((sel) => {
      sel.value = stored;
    });

    if (stored === "true") {
      let endIso = null;
      try {
        endIso = window.localStorage?.getItem(LOGGED_IN_SESSION_END_KEY);
      } catch (_) {
        /* ignore */
      }
      if (!endIso) {
        try {
          window.localStorage?.setItem(
            LOGGED_IN_SESSION_END_KEY,
            new Date(Date.now() + LOGGED_IN_SESSION_MS).toISOString(),
          );
        } catch (_) {
          /* ignore */
        }
      }
      startLoggedInTimerTick();
    } else {
      updateLoggedInTimerDisplay();
    }

    selects.forEach((select) => {
      select.addEventListener("change", () => {
        setLoggedInValue(select.value === "true");
      });
    });
  }

  /** Account created dropdown (prototype controls). */
  function initAccountCreatedSelect() {
    const selects = document.querySelectorAll("[data-prototype-account-created]");
    if (!selects.length) return;

    let stored = "false";
    try {
      stored = window.localStorage?.getItem(ACCOUNT_CREATED_KEY) === "true" ? "true" : "false";
    } catch (_) {
      /* ignore */
    }
    selects.forEach((sel) => {
      sel.value = stored;
    });

    selects.forEach((select) => {
      select.addEventListener("change", () => {
        setAccountCreatedValue(select.value === "true");
      });
    });
  }

  function initTimelineAgreeButton() {
    document.querySelectorAll(".setup-timeline-agree").forEach((btn) => {
      btn.addEventListener("click", () => {
        setState("setupProgress", 2, { force: true });
      });
    });
  }

  function initWalletModals() {
    const walletModals = document.getElementById("wallet-modals");
    if (!walletModals) return;

    const verifyDialog = document.getElementById("verify-email-dialog");
    const passcodeModal = document.getElementById("set-passcode-modal");
    const input = walletModals.querySelector("#verify-email-code-input");
    const emailDest = walletModals.querySelector(".verify-email-modal__email");
    const loader = document.getElementById("verify-email-loader");
    const toast = document.getElementById("wallet-toast");

    let lastFocus = null;
    let otpTimer = null;
    let otpPending = false;
    let toastHideTimer = null;

    function syncModalEmail() {
      const src =
        document.querySelector(
          ".setup-timeline__desc--verify .setup-timeline__email",
        ) || document.querySelector(".setup-timeline__email");
      if (src && emailDest) emailDest.textContent = src.textContent.trim();
    }

    function hideLoader() {
      if (!loader) return;
      loader.hidden = true;
      loader.setAttribute("aria-hidden", "true");
    }

    function showLoader() {
      if (!loader) return;
      loader.hidden = false;
      loader.setAttribute("aria-hidden", "false");
    }

    function clearOtpTimerOnly() {
      if (otpTimer) clearTimeout(otpTimer);
      otpTimer = null;
    }

    function abortOtpVerification() {
      clearOtpTimerOnly();
      otpPending = false;
      hideLoader();
    }

    function hideToast() {
      if (!toast) return;
      clearTimeout(toastHideTimer);
      toastHideTimer = null;
      toast.classList.remove("is-visible");
      const fallback = window.setTimeout(() => {
        if (!toast.classList.contains("is-visible")) toast.hidden = true;
      }, 400);
      const onEnd = () => {
        window.clearTimeout(fallback);
        if (!toast.classList.contains("is-visible")) toast.hidden = true;
        toast.removeEventListener("transitionend", onEnd);
      };
      toast.addEventListener("transitionend", onEnd);
    }

    function hideToastImmediate() {
      if (!toast) return;
      clearTimeout(toastHideTimer);
      toastHideTimer = null;
      toast.classList.remove("is-visible");
      toast.hidden = true;
    }

    function showToast() {
      if (!toast) return;
      clearTimeout(toastHideTimer);
      toast.hidden = false;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => toast.classList.add("is-visible"));
      });
      toastHideTimer = window.setTimeout(() => hideToast(), 4500);
    }

    function completeEmailVerification() {
      clearOtpTimerOnly();
      otpPending = false;
      hideLoader();
      setAccountCreatedValue(true);
      if (input) input.value = "";
      if (verifyDialog) verifyDialog.hidden = true;
      setState("setupProgress", 3, { force: true });
      setLoggedInValue(true);
      showToast();
      if (passcodeModal) {
        passcodeModal.hidden = false;
        window.requestAnimationFrame(() => {
          passcodeModal.querySelector(".set-passcode-modal__close")?.focus();
        });
      }
    }

    function updateLoaderFromInput() {
      if (!input || !loader) return;
      if (input.value.length === 6) {
        showLoader();
        if (!otpPending) {
          otpPending = true;
          otpTimer = window.setTimeout(completeEmailVerification, 3000);
        }
      } else {
        abortOtpVerification();
      }
    }

    function openVerifyModal() {
      syncModalEmail();
      lastFocus = document.activeElement;
      walletModals.hidden = false;
      if (verifyDialog) verifyDialog.hidden = false;
      if (passcodeModal) passcodeModal.hidden = true;
      document.body.classList.add("wallet-modals-is-open");
      abortOtpVerification();
      if (input) input.value = "";
      window.requestAnimationFrame(() => input?.focus());
    }

    function closeWalletModals() {
      abortOtpVerification();
      if (input) input.value = "";
      if (verifyDialog) verifyDialog.hidden = false;
      if (passcodeModal) passcodeModal.hidden = true;
      walletModals.hidden = true;
      document.body.classList.remove("wallet-modals-is-open");
      hideToastImmediate();
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus();
      }
      lastFocus = null;
    }

    document.querySelectorAll(".setup-timeline-verify").forEach((btn) => {
      btn.addEventListener("click", () => openVerifyModal());
    });

    input?.addEventListener("input", () => updateLoaderFromInput());

    walletModals.addEventListener("click", (e) => {
      if (loader && !loader.hidden) return;
      if (e.target.closest("[data-wallet-modals-dismiss]")) closeWalletModals();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || walletModals.hidden) return;
      if (loader && !loader.hidden) {
        abortOtpVerification();
        if (input) input.value = "";
        e.preventDefault();
        return;
      }
      closeWalletModals();
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

      setLoggedInValue(false);
      setAccountCreatedValue(false);

      try {
        window.localStorage?.removeItem(CONSENT_AT_KEY);
      } catch (_) {
        /* ignore */
      }
      try {
        window.localStorage?.removeItem(EMAIL_VERIFIED_AT_KEY);
      } catch (_) {
        /* ignore */
      }
      try {
        window.localStorage?.removeItem(PASSCODE_SET_AT_KEY);
      } catch (_) {
        /* ignore */
      }
      syncConsentTimestamp();
      syncEmailVerifiedTimestamp();
      syncPasscodeTimestamp();

      const wm = document.getElementById("wallet-modals");
      if (wm) {
        wm.hidden = true;
        document.body.classList.remove("wallet-modals-is-open");
        const v = document.getElementById("verify-email-dialog");
        const p = document.getElementById("set-passcode-modal");
        const inp = wm.querySelector("#verify-email-code-input");
        const ld = document.getElementById("verify-email-loader");
        const toastEl = document.getElementById("wallet-toast");
        if (v) v.hidden = false;
        if (p) p.hidden = true;
        if (inp) inp.value = "";
        if (ld) {
          ld.hidden = true;
          ld.setAttribute("aria-hidden", "true");
        }
        if (toastEl) {
          toastEl.hidden = true;
          toastEl.classList.remove("is-visible");
        }
      }
    });
  }

  function init() {
    initStates();
    initBadgeControls();
    initTimelineAgreeButton();
    initWalletModals();
    initEmptyCheckbox();
    initLoggedInSelect();
    initAccountCreatedSelect();
    initPrototypeReset();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
