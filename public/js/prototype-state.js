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
  const WALLET_PASSCODE_KEY = `${STORAGE_PREFIX}walletPasscode.v1`;
  const WALLET_PASSCODE_SESSION_END_KEY = `${STORAGE_PREFIX}walletPasscodeSessionEndsAtIso.v1`;
  const WALLET_PASSCODE_SESSION_MS = 15 * 60 * 1000;
  const LEGACY_WALLET_SESSION_KEY = "xrex.paylynk.ppWalletSessionExpiresAt";
  const ACTIVATING_SELECTION_KEY = `${STORAGE_PREFIX}activatingSelection.v1`;
  const PAYMENT_METHOD_ADDED_TOAST_KEY = `${STORAGE_PREFIX}showPaymentMethodAddedToast.v1`;
  const USE_DEFAULT_STABLECOIN_KEY = `${STORAGE_PREFIX}useDefaultStablecoin.v1`;
  const JOURNEY_KEY = `${STORAGE_PREFIX}journey.v1`;

  function readUseDefaultStablecoin() {
    try {
      return window.localStorage?.getItem(USE_DEFAULT_STABLECOIN_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function syncUseDefaultStablecoinCheckboxes(enabled) {
    document.querySelectorAll("[data-prototype-use-default-stablecoin]").forEach((el) => {
      el.checked = enabled;
    });
  }

  /** Only user-driven toggles; programmatic .checked updates are not trusted. */
  function onUseDefaultStablecoinCheckboxChange(e) {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.matches("[data-prototype-use-default-stablecoin]")) return;
    if (!e.isTrusted) return;
    setUseDefaultStablecoin(input.checked);
  }

  function clearPickStablecoinSelection() {
    const root = document.querySelector("[data-pick-stablecoin-root]");
    if (!root) return;
    root.querySelectorAll('input[name="stablecoin-pick"]').forEach((inp) => {
      inp.checked = false;
    });
    syncPickStablecoinExpandableDetails();
    syncPickStablecoinContinueFromSelection();
  }

  function setUseDefaultStablecoin(enabled) {
    try {
      window.localStorage?.setItem(USE_DEFAULT_STABLECOIN_KEY, enabled ? "1" : "0");
    } catch (_) {
      /* ignore */
    }
    syncUseDefaultStablecoinCheckboxes(enabled);
    if (!enabled) {
      clearPickStablecoinSelection();
    }
    syncPickStablecoinDefaultStablecoinUi();
  }

  function readJourneyFromStorage() {
    try {
      const v = window.localStorage?.getItem(JOURNEY_KEY);
      return v === "paylynk" ? "paylynk" : "setup";
    } catch (_) {
      return "setup";
    }
  }

  function journeyHref(journey) {
    return journey === "paylynk" ? "paylynk.html" : "index.html";
  }

  function readActivatingSelectionCoin() {
    let coin = "usdt";
    try {
      const raw = window.sessionStorage?.getItem(ACTIVATING_SELECTION_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.coin === "usdc" || o.coin === "usdt") coin = o.coin;
      }
    } catch (_) {
      /* ignore */
    }
    return coin;
  }

  function readActivatingSelectionCoinSym() {
    const coin = readActivatingSelectionCoin();
    return coin === "usdc" ? "USDC" : "USDT";
  }

  function readLoggedInFromStorage() {
    try {
      return window.localStorage?.getItem(LOGGED_IN_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  /** True when prototype “Logged in” is on and the 5:00 session timer has not reached 0:00. */
  function isPrototypeLoggedInSessionActive() {
    if (!readLoggedInFromStorage()) return false;
    try {
      const iso = window.localStorage?.getItem(LOGGED_IN_SESSION_END_KEY);
      if (!iso) return false;
      const endMs = new Date(iso).getTime();
      return Number.isFinite(endMs) && endMs > Date.now();
    } catch (_) {
      return false;
    }
  }

  /**
   * Resume URL for stablecoin setup from payment-setup (expects logged-in when p>=3,
   * except p<=2 which always goes to wallet creation).
   */
  function resolvePaymentSetupStablecoinResumeHref() {
    const p = states.setupProgress;
    const loggedIn = readLoggedInFromStorage();
    if (p <= 2) return "setup-wallet.html";
    if (p <= 3 && loggedIn) return "setup-wallet.html";
    if (p >= 4 && loggedIn) return "pick-stablecoin.html";
    return "setup-wallet.html";
  }

  function paymentSetupIncompleteNeedsVerifyModal() {
    return states.setupProgress >= 3 && !readLoggedInFromStorage();
  }

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
        6: "Address generated",
        7: "Authorize auto-debit",
        8: "Auto-debit approved",
        9: "Auto-debit finalized",
        10: "...",
      },
    },
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const states = {};

  /** Set by initWalletModals so payment-setup can open verify email from index. */
  let openVerifyEmailModalRef = null;

  let loggedInTickId = null;
  let walletPasscodeTickId = null;

  /** One-shot: after 7 → 8, progress bar animates 50% → 75% instead of jumping. */
  let activatingProgress7to8AnimPending = false;
  let activatingProgress7to8TimerId = null;

  function cancelActivatingProgress7to8Anim() {
    if (activatingProgress7to8TimerId != null) {
      window.clearTimeout(activatingProgress7to8TimerId);
      activatingProgress7to8TimerId = null;
    }
  }

  /** 6 → 7: animate progress 25% → 50%, then open re-auth modal (activating page only). */
  let activatingReauth6to7AnimPending = false;
  let activatingReauth6to7T1 = null;
  let activatingReauth6to7T2 = null;

  function cancelActivatingReauth6to7Timers() {
    if (activatingReauth6to7T1 != null) {
      window.clearTimeout(activatingReauth6to7T1);
      activatingReauth6to7T1 = null;
    }
    if (activatingReauth6to7T2 != null) {
      window.clearTimeout(activatingReauth6to7T2);
      activatingReauth6to7T2 = null;
    }
  }

  function cancelActivatingReauth6to7Anim() {
    cancelActivatingReauth6to7Timers();
    activatingReauth6to7AnimPending = false;
  }

  let prototypeToastHideTimer = null;

  const PROTOTYPE_TOAST_DEFAULT_ICON = "assets/icon_info_blue.svg";

  function queuePaymentMethodAddedToast() {
    try {
      window.sessionStorage?.setItem(PAYMENT_METHOD_ADDED_TOAST_KEY, "1");
    } catch (_) {
      /* ignore */
    }
  }

  function consumePaymentMethodAddedToast() {
    try {
      const queued = window.sessionStorage?.getItem(PAYMENT_METHOD_ADDED_TOAST_KEY) === "1";
      window.sessionStorage?.removeItem(PAYMENT_METHOD_ADDED_TOAST_KEY);
      return queued;
    } catch (_) {
      return false;
    }
  }

  function hidePrototypeToast() {
    const toast = document.getElementById("prototype-toast");
    if (!toast) return;
    const iconEl = toast.querySelector(".wallet-toast__icon");
    if (iconEl) iconEl.src = PROTOTYPE_TOAST_DEFAULT_ICON;
    window.clearTimeout(prototypeToastHideTimer);
    prototypeToastHideTimer = null;
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

  function showPrototypeToast(message, opts = {}) {
    const toast = document.getElementById("prototype-toast");
    if (!toast) return;
    const textEl = toast.querySelector(".wallet-toast__text");
    const iconEl = toast.querySelector(".wallet-toast__icon");
    const text =
      typeof message === "string" && message.trim() ? message.trim() : "Not in prototype";
    if (textEl) textEl.textContent = text;
    if (iconEl) {
      iconEl.src = opts.success ? "assets/icon_success.svg" : PROTOTYPE_TOAST_DEFAULT_ICON;
    }
    window.clearTimeout(prototypeToastHideTimer);
    prototypeToastHideTimer = null;
    toast.hidden = false;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => toast.classList.add("is-visible"));
    });
    prototypeToastHideTimer = window.setTimeout(() => hidePrototypeToast(), 4500);
  }

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

  function readWalletPasscodeActiveFromStorage() {
    try {
      return window.localStorage?.getItem(WALLET_PASSCODE_KEY) === "active";
    } catch (_) {
      return false;
    }
  }

  function isWalletPasscodeSessionActive() {
    if (!readWalletPasscodeActiveFromStorage()) return false;
    try {
      const iso = window.localStorage?.getItem(WALLET_PASSCODE_SESSION_END_KEY);
      if (!iso) return false;
      const endMs = new Date(iso).getTime();
      return Number.isFinite(endMs) && endMs > Date.now();
    } catch (_) {
      return false;
    }
  }

  function stopWalletPasscodeTimerTick() {
    if (walletPasscodeTickId != null) {
      window.clearInterval(walletPasscodeTickId);
      walletPasscodeTickId = null;
    }
  }

  function updateWalletPasscodeTimerDisplay() {
    const els = document.querySelectorAll("[data-prototype-wallet-passcode-timer]");
    if (!readWalletPasscodeActiveFromStorage()) {
      els.forEach((el) => {
        el.textContent = "0:00";
      });
      return;
    }
    let endMs = NaN;
    try {
      const iso = window.localStorage?.getItem(WALLET_PASSCODE_SESSION_END_KEY);
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
    if (remain <= 0) {
      if (readWalletPasscodeActiveFromStorage()) {
        setWalletPasscodeValue("inactive");
      }
      return;
    }
    const totalSec = Math.floor(remain / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const text = `${m}:${String(s).padStart(2, "0")}`;
    els.forEach((el) => {
      el.textContent = text;
    });
  }

  function startWalletPasscodeTimerTick() {
    stopWalletPasscodeTimerTick();
    updateWalletPasscodeTimerDisplay();
    let endMs = NaN;
    try {
      const iso = window.localStorage?.getItem(WALLET_PASSCODE_SESSION_END_KEY);
      if (iso) endMs = new Date(iso).getTime();
    } catch (_) {
      /* ignore */
    }
    if (!Number.isFinite(endMs)) return;
    const remain = Math.max(0, endMs - Date.now());
    if (remain <= 0) return;
    walletPasscodeTickId = window.setInterval(updateWalletPasscodeTimerDisplay, 1000);
  }

  function migrateLegacyWalletSessionStorage() {
    try {
      const legacy = parseInt(window.sessionStorage?.getItem(LEGACY_WALLET_SESSION_KEY) || "0", 10);
      if (legacy > Date.now() && !readWalletPasscodeActiveFromStorage()) {
        window.localStorage?.setItem(WALLET_PASSCODE_KEY, "active");
        window.localStorage?.setItem(
          WALLET_PASSCODE_SESSION_END_KEY,
          new Date(legacy).toISOString(),
        );
      }
      window.sessionStorage?.removeItem(LEGACY_WALLET_SESSION_KEY);
    } catch (_) {
      /* ignore */
    }
  }

  /** Wallet passcode session (prototype): Active / Inactive + 15:00 countdown in controls. */
  function setWalletPasscodeValue(value) {
    const isActive = value === "active";
    const v = isActive ? "active" : "inactive";
    try {
      window.localStorage?.setItem(WALLET_PASSCODE_KEY, v);
    } catch (_) {
      /* ignore */
    }
    document.querySelectorAll("[data-prototype-wallet-passcode]").forEach((sel) => {
      sel.value = v;
    });
    if (isActive) {
      const end = new Date(Date.now() + WALLET_PASSCODE_SESSION_MS).toISOString();
      try {
        window.localStorage?.setItem(WALLET_PASSCODE_SESSION_END_KEY, end);
      } catch (_) {
        /* ignore */
      }
      startWalletPasscodeTimerTick();
    } else {
      try {
        window.localStorage?.removeItem(WALLET_PASSCODE_SESSION_END_KEY);
        window.sessionStorage?.removeItem(LEGACY_WALLET_SESSION_KEY);
      } catch (_) {
        /* ignore */
      }
      stopWalletPasscodeTimerTick();
      updateWalletPasscodeTimerDisplay();
    }
  }

  function activateWalletPasscodeSession() {
    setWalletPasscodeValue("active");
  }

  function initWalletPasscodeSelect() {
    migrateLegacyWalletSessionStorage();

    const selects = document.querySelectorAll("[data-prototype-wallet-passcode]");
    if (!selects.length) return;

    let stored = "inactive";
    try {
      stored = readWalletPasscodeActiveFromStorage() ? "active" : "inactive";
    } catch (_) {
      /* ignore */
    }
    selects.forEach((sel) => {
      sel.value = stored;
    });

    if (stored === "active") {
      // Fresh 15:00 on every page load while wallet passcode stays active.
      try {
        window.localStorage?.setItem(
          WALLET_PASSCODE_SESSION_END_KEY,
          new Date(Date.now() + WALLET_PASSCODE_SESSION_MS).toISOString(),
        );
      } catch (_) {
        /* ignore */
      }
      startWalletPasscodeTimerTick();
    } else {
      updateWalletPasscodeTimerDisplay();
    }

    selects.forEach((select) => {
      select.addEventListener("change", () => {
        setWalletPasscodeValue(select.value === "active" ? "active" : "inactive");
      });
    });
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
      const wasDisabled = sel.disabled;
      // Must be mutable: assigning .value while disabled can throw / be ignored (breaks 3→2 setup
      // progress before applySetupProgressToUi runs).
      sel.disabled = false;
      sel.value = v;
      sel.disabled = wasDisabled;
    });
  }

  function syncWalletTimelineFromProgress(p) {
    const root =
      document.querySelector('[data-prototype-context="wallet-setup"] .setup-timeline') ||
      document.querySelector(".setup-wallet-card .setup-timeline") ||
      document.querySelector(".setup-timeline");
    if (!root) return;
    const steps = Array.from(root.children).filter((el) =>
      el.classList.contains("setup-timeline__step"),
    );
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

  function syncPickStablecoinExpandableDetails() {
    const root = document.querySelector("[data-pick-stablecoin-root]");
    if (!root) return;
    const usdtDetails = root.querySelector("[data-pick-stablecoin-usdt-details]");
    const usdcDetails = root.querySelector("[data-pick-stablecoin-usdc-details]");
    const usdt = root.querySelector('input[name="stablecoin-pick"][value="usdt"]');
    const usdc = root.querySelector('input[name="stablecoin-pick"][value="usdc"]');
    if (usdtDetails && usdt) {
      if (usdt.checked) {
        usdtDetails.removeAttribute("hidden");
      } else {
        usdtDetails.setAttribute("hidden", "");
      }
    }
    if (usdcDetails && usdc) {
      if (usdc.checked) {
        usdcDetails.removeAttribute("hidden");
      } else {
        usdcDetails.setAttribute("hidden", "");
      }
    }
  }

  function syncPickStablecoinContinueFromSelection() {
    const root = document.querySelector("[data-pick-stablecoin-root]");
    if (!root) return;

    const useDefault = readUseDefaultStablecoin();
    const continueBtnDefault = document.getElementById("pick-stablecoin-continue-default");

    if (useDefault) {
      if (continueBtnDefault && continueBtnDefault.tagName === "BUTTON") {
        continueBtnDefault.disabled = false;
        continueBtnDefault.setAttribute("aria-disabled", "false");
      }
      return;
    }

    syncPickStablecoinExpandableDetails();
    const continueBtn =
      document.getElementById("pick-stablecoin-continue") ||
      root.querySelector('[data-pick-stablecoin-continue]:not(#pick-stablecoin-continue-default)');
    if (!continueBtn || continueBtn.tagName !== "BUTTON") return;
    const checked = root.querySelector('input[name="stablecoin-pick"]:checked');
    const enabled = !!checked;
    continueBtn.disabled = !enabled;
    continueBtn.setAttribute("aria-disabled", enabled ? "false" : "true");
  }

  function syncWalletContinueButton() {
    const btn = document.querySelector(".setup-actions--wallet .setup-button--primary");
    if (!btn || btn.tagName !== "BUTTON") return;
    btn.disabled = states.setupProgress < 4;
  }

  function applySetupProgressToUi() {
    const p = states.setupProgress;
    document.documentElement.setAttribute("data-prototype-setup-progress", String(p));
    syncWalletTimelineFromProgress(p);
    syncConsentTimestamp();
    syncEmailVerifiedTimestamp();
    syncPasscodeTimestamp();
    syncWalletContinueButton();
    syncPickStablecoinContinueFromSelection();
    syncPickStablecoinDefaultStablecoinUi();
    syncActivatingStablecoinStatusFromProgress();
    syncActivatingErc20ActivatedFromProgress();
    syncPaymentSetupFromProgress();
    syncReviewSubmitFromProgress();
    syncAccountCreatedPrototypeControl();
  }

  function syncReviewSubmitFromProgress() {
    if (document.body?.getAttribute("data-prototype-context") !== "review-submit") return;
    if (states.setupProgress < 9) {
      window.location.href = "index.html";
    }
  }

  function syncPickStablecoinDefaultStablecoinUi() {
    if (document.body?.getAttribute("data-prototype-context") !== "pick-stablecoin") return;
    const root = document.querySelector("[data-pick-stablecoin-root]");
    if (!root) return;

    const useDefault = readUseDefaultStablecoin();
    root.classList.toggle("pick-stablecoin-root--default-stablecoin", useDefault);
    document.documentElement.toggleAttribute("data-prototype-use-default-stablecoin", useDefault);

    const choiceView = root.querySelector("[data-pick-stablecoin-choice]");
    const defaultView = root.querySelector("[data-pick-stablecoin-default]");
    const actionsChoice = document.querySelector("[data-pick-stablecoin-actions-choice]");
    const defaultFooter = document.querySelector("[data-pick-stablecoin-default-footer]");
    const titleChoice = document.querySelector("[data-pick-stablecoin-title-choice]");
    const titleDefault = document.querySelector("[data-pick-stablecoin-title-default]");

    if (choiceView) choiceView.hidden = useDefault;
    if (defaultView) defaultView.hidden = !useDefault;
    if (actionsChoice) actionsChoice.hidden = useDefault;
    if (defaultFooter) defaultFooter.hidden = !useDefault;
    if (titleChoice) titleChoice.hidden = useDefault;
    if (titleDefault) titleDefault.hidden = !useDefault;

    try {
      document.title = useDefault
        ? "XREX PayLynk - USD stablecoin payments"
        : "XREX PayLynk - Select a stablecoin";
    } catch (_) {
      /* ignore */
    }

    if (useDefault) {
      const usdt = root.querySelector('input[name="stablecoin-pick"][value="usdt"]');
      if (usdt && !usdt.checked) {
        usdt.checked = true;
      }
    }

    syncPickStablecoinContinueFromSelection();
  }

  /** When setup progress is 3+, account creation is implied — lock control to True. */
  function syncAccountCreatedPrototypeControl() {
    const locked = states.setupProgress >= 3;
    if (locked) {
      setAccountCreatedValue(true);
    }
    document.querySelectorAll("[data-prototype-account-created]").forEach((sel) => {
      if (locked) {
        sel.value = "true";
        sel.disabled = true;
        sel.setAttribute("aria-disabled", "true");
      } else {
        sel.disabled = false;
        sel.removeAttribute("aria-disabled");
      }
    });
  }

  function syncPaymentSetupFromProgress() {
    if (document.body?.getAttribute("data-prototype-context") !== "payment-setup") return;
    const p = states.setupProgress;
    const finalized = p >= 9;
    const nextBtn = document.querySelector("[data-payment-setup-next]");
    if (nextBtn && nextBtn.tagName === "BUTTON") {
      nextBtn.disabled = !finalized;
      nextBtn.setAttribute("aria-disabled", finalized ? "false" : "true");
    }
    const link = document.querySelector("[data-payment-setup-stablecoin-link]");
    if (link) {
      if (finalized) {
        link.setAttribute("tabindex", "-1");
        link.setAttribute("aria-disabled", "true");
      } else {
        link.removeAttribute("tabindex");
        link.removeAttribute("aria-disabled");
      }
    }
    const linked = document.querySelector("[data-payment-setup-linked]");
    if (linked) {
      linked.setAttribute("aria-hidden", finalized ? "false" : "true");
    }
  }

  function formatActivatingStepLabel(stepLabel, pct) {
    const n = Math.max(0, Math.min(100, Math.round(pct)));
    if (stepLabel === "All steps completed") return `${stepLabel} (100%)`;
    return `${stepLabel} (${n}%)`;
  }

  function setActivatingStepLabelDisplay(stepLabelEl, stepLabel, pct) {
    if (!stepLabelEl) return;
    stepLabelEl.textContent = formatActivatingStepLabel(stepLabel, pct);
  }

  function syncActivatingStablecoinStatusFromProgress() {
    if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
    const p = states.setupProgress;
    const sym = readActivatingSelectionCoinSym();
    let pct = 0;
    let stepLabel = "Step 1 of 4";
    let title = "Generating payment address";
    let desc =
      "We’re generating your auto-debit payment address for payments to Halcyon Systems Corp. This may take a few minutes.";
    let isSetupComplete = false;

    if (p <= 5) {
      pct = 0;
      stepLabel = "Step 1 of 4";
      title = "Generating payment address";
      desc =
        "We’re generating your auto-debit payment address for payments to Halcyon Systems Corp. This may take a few minutes.";
    } else if (p === 6) {
      pct = 25;
      stepLabel = "Step 2 of 4";
      title = "Preparing your wallet";
      desc =
        "We’re adding gas to your wallet to cover the fees needed to enable auto-debit. This may take a few minutes";
    } else if (p === 7) {
      pct = 50;
      stepLabel = "Step 3 of 4";
      title = "Authorize auto-debit to continue";
      desc =
        "Set up auto-debit for Halcyon Systems Corp. Approved payment requests will be automatically debited from a dedicated auto-debit wallet for this beneficiary.";
    } else if (p === 8) {
      pct = 75;
      stepLabel = "Step 4 of 4";
      title = "Enabling auto-debit";
      desc = "Your authorization is being confirmed on the blockchain. This may take a few minutes.";
    } else {
      isSetupComplete = true;
      pct = 100;
      stepLabel = "All steps completed";
      title = `${sym} activated`;
      desc = `${sym}: Ethereum network (ERC-20) is now active for payments.`;
    }

    const in6to7ReauthAnim = activatingReauth6to7AnimPending && p === 7;
    if (in6to7ReauthAnim) {
      title = "Preparing your wallet";
      desc =
        "We’re adding gas to your wallet to cover the fees needed to enable auto-debit. This may take a few minutes";
    }
    const isAuthorizeDebit = p === 7 && !in6to7ReauthAnim;
    const isContinueEnabled = isSetupComplete || isAuthorizeDebit;

    const runActivatingProgress7to8Anim = activatingProgress7to8AnimPending && p === 8;
    if (runActivatingProgress7to8Anim) {
      activatingProgress7to8AnimPending = false;
    }

    const fr = Math.max(0, Math.min(100, pct)) / 100;
    const titleEl = document.querySelector("[data-activating-status-title]");
    const descEl = document.querySelector("[data-activating-status-desc]");
    const progressEl = document.querySelector("[data-activating-progress]");
    const fillEl = progressEl?.querySelector(".activating-stablecoin-progress__fill");
    const stepLabelEl = document.querySelector("[data-activating-step-label]");
    const liveIcon = document.querySelector("[data-activating-status-live-icon]");
    const hintEl = document.querySelector("[data-activating-hint]");
    const footerEl = document.querySelector(".activating-stablecoin-status__footer");
    const statusCard = document.querySelector(".activating-stablecoin-status");
    const cardRoot = document.querySelector("[data-activating-root]");
    const ctaWrap = document.querySelector("[data-activating-status-cta]");
    const doneCtaWrap = document.querySelector("[data-activating-done-cta]");

    if (cardRoot) cardRoot.setAttribute("data-setup-progress", String(p));
    if (statusCard) {
      statusCard.classList.toggle("activating-stablecoin-status--authorize", isAuthorizeDebit);
      statusCard.classList.toggle("activating-stablecoin-status--complete", isSetupComplete);
    }

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;
    if (stepLabelEl) {
      if (in6to7ReauthAnim && activatingReauth6to7T1 == null && activatingReauth6to7T2 == null) {
        setActivatingStepLabelDisplay(stepLabelEl, stepLabel, 25);
      } else if (!in6to7ReauthAnim) {
        setActivatingStepLabelDisplay(stepLabelEl, stepLabel, runActivatingProgress7to8Anim ? 50 : pct);
      }
    }
    if (progressEl) {
      progressEl.hidden = isAuthorizeDebit;
      progressEl.setAttribute("aria-hidden", isAuthorizeDebit ? "true" : "false");
      if (in6to7ReauthAnim && activatingReauth6to7T1 == null && activatingReauth6to7T2 == null) {
        const delayMs = 140;
        const transitionMs = 600;
        progressEl.style.setProperty("--activating-progress-fr", "0.25");
        progressEl.setAttribute("aria-valuenow", "25");
        void progressEl.offsetWidth;
        cancelActivatingReauth6to7Timers();
        activatingReauth6to7T1 = window.setTimeout(() => {
          activatingReauth6to7T1 = null;
          if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
          if (states.setupProgress !== 7 || !activatingReauth6to7AnimPending) return;
          const pe = document.querySelector("[data-activating-progress]");
          const sle = document.querySelector("[data-activating-step-label]");
          if (pe) {
            pe.style.setProperty("--activating-progress-fr", "0.5");
            pe.setAttribute("aria-valuenow", "50");
          }
          if (sle) setActivatingStepLabelDisplay(sle, "Step 3 of 4", 50);
          activatingReauth6to7T2 = window.setTimeout(() => {
            activatingReauth6to7T2 = null;
            if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
            if (states.setupProgress !== 7) return;
            activatingReauth6to7AnimPending = false;
            openActivatingReauthModal();
            applySetupProgressToUi();
          }, transitionMs);
        }, delayMs);
      } else if (runActivatingProgress7to8Anim) {
        const frStart = 0.5;
        const frEnd = 0.75;
        const pctEnd = 75;
        const delayMs = 140;
        progressEl.style.setProperty("--activating-progress-fr", String(frStart));
        progressEl.setAttribute("aria-valuenow", "50");
        void progressEl.offsetWidth;
        cancelActivatingProgress7to8Anim();
        activatingProgress7to8TimerId = window.setTimeout(() => {
          activatingProgress7to8TimerId = null;
          if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
          if (states.setupProgress !== 8) return;
          const pe = document.querySelector("[data-activating-progress]");
          const sle = document.querySelector("[data-activating-step-label]");
          if (pe) {
            pe.style.setProperty("--activating-progress-fr", String(frEnd));
            pe.setAttribute("aria-valuenow", String(pctEnd));
          }
          if (sle) setActivatingStepLabelDisplay(sle, "Step 4 of 4", pctEnd);
        }, delayMs);
      } else {
        progressEl.style.setProperty("--activating-progress-fr", String(fr));
        progressEl.setAttribute("aria-valuenow", String(pct));
      }
    }
    if (fillEl) {
      fillEl.classList.toggle("activating-stablecoin-progress__fill--full", pct >= 100);
      fillEl.classList.toggle("activating-stablecoin-progress__fill--empty", pct <= 0 && !isSetupComplete);
      fillEl.classList.toggle("activating-stablecoin-progress__fill--success", isSetupComplete);
    }
    if (liveIcon) {
      if (isAuthorizeDebit) {
        liveIcon.hidden = true;
        liveIcon.setAttribute("aria-hidden", "true");
      } else {
        liveIcon.hidden = false;
        liveIcon.setAttribute("aria-hidden", "true");
      }
      if (isSetupComplete) {
        liveIcon.src = "assets/icon_success.svg";
        liveIcon.classList.add("activating-stablecoin-status__live-icon--success");
      } else if (!isAuthorizeDebit) {
        liveIcon.src = "assets/icon_loader_lightblue.svg";
        liveIcon.classList.remove("activating-stablecoin-status__live-icon--success");
      }
    }
    if (footerEl) {
      const hideFooter = isAuthorizeDebit || isSetupComplete;
      footerEl.hidden = hideFooter;
      footerEl.setAttribute("aria-hidden", hideFooter ? "true" : "false");
    }
    if (ctaWrap) {
      ctaWrap.hidden = !isAuthorizeDebit;
      ctaWrap.setAttribute("aria-hidden", isAuthorizeDebit ? "false" : "true");
    }
    if (doneCtaWrap) {
      doneCtaWrap.hidden = !isSetupComplete;
      doneCtaWrap.setAttribute("aria-hidden", isSetupComplete ? "false" : "true");
    }
    if (hintEl) {
      hintEl.hidden = isSetupComplete;
      hintEl.setAttribute("aria-hidden", isSetupComplete ? "true" : "false");
    }
    const cardContinue = document.querySelector("[data-activating-continue-card]");
    if (cardContinue && cardContinue.tagName === "BUTTON") {
      if (isContinueEnabled) {
        cardContinue.disabled = false;
        cardContinue.removeAttribute("aria-disabled");
      } else {
        cardContinue.disabled = true;
        cardContinue.setAttribute("aria-disabled", "true");
      }
    }
    const footerContinue = document.querySelector("[data-activating-continue-footer]");
    if (footerContinue && footerContinue.tagName === "BUTTON") {
      if (isSetupComplete) {
        footerContinue.disabled = false;
        footerContinue.removeAttribute("aria-disabled");
      } else {
        footerContinue.disabled = true;
        footerContinue.setAttribute("aria-disabled", "true");
      }
    }
    const stepCancel = document.querySelector("[data-activating-step-cancel]");
    if (stepCancel) {
      const hideCancel = p >= 9;
      stepCancel.hidden = hideCancel;
      stepCancel.setAttribute("aria-hidden", hideCancel ? "true" : "false");
    }
  }

  function getActivatingReauthModalsRoot() {
    return document.getElementById("activating-reauth-modals");
  }

  function openActivatingReauthModal() {
    const root = getActivatingReauthModalsRoot();
    if (!root || root.hidden === false) return;
    root.hidden = false;
    document.body.classList.add("wallet-modals-is-open");
    const panel = root.querySelector(".verify-email-modal__panel");
    window.requestAnimationFrame(() => {
      panel?.focus({ preventScroll: true });
    });
  }

  function closeActivatingReauthModal() {
    const root = getActivatingReauthModalsRoot();
    if (!root || root.hidden) return;
    root.hidden = true;
    document.body.classList.remove("wallet-modals-is-open");
  }

  function getSetupLeaveDialog() {
    return document.getElementById("setup-leave-dialog");
  }

  function openSetupLeaveDialog() {
    const dialog = getSetupLeaveDialog();
    if (!dialog || !dialog.hidden) return;
    dialog.hidden = false;
    document.body.classList.add("setup-dialog-is-open");
    const panel = dialog.querySelector(".setup-dialog__panel");
    window.requestAnimationFrame(() => {
      panel?.focus({ preventScroll: true });
    });
  }

  function closeSetupLeaveDialog() {
    const dialog = getSetupLeaveDialog();
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    document.body.classList.remove("setup-dialog-is-open");
  }

  function initSetupLeaveCancelDialog() {
    const dialog = getSetupLeaveDialog();
    if (!dialog) return;

    document.querySelectorAll("[data-setup-leave-cancel]").forEach((trigger) => {
      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        openSetupLeaveDialog();
      });
    });

    dialog.querySelectorAll("[data-setup-leave-dialog-dismiss]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        closeSetupLeaveDialog();
      });
    });

    dialog.querySelector("[data-setup-leave-dialog-continue]")?.addEventListener("click", (e) => {
      e.preventDefault();
      closeSetupLeaveDialog();
    });

    dialog.querySelector("[data-setup-leave-dialog-leave]")?.addEventListener("click", (e) => {
      e.preventDefault();
      const journey = readJourneyFromStorage();
      if (
        journey === "paylynk" &&
        document.body?.getAttribute("data-prototype-context") === "activating-stablecoin"
      ) {
        navigatePaylynkToNetworkSelect();
        return;
      }
      window.location.href = journeyHref(journey);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!dialog || dialog.hidden) return;
      closeSetupLeaveDialog();
    });
  }

  function initActivatingReauthModal() {
    const root = getActivatingReauthModalsRoot();
    if (!root) return;

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-wallet-modals-dismiss]")) {
        e.preventDefault();
        closeActivatingReauthModal();
      }
    });

    const authorizeBtn = root.querySelector("[data-activating-reauth-authorize]");
    authorizeBtn?.addEventListener("click", () => {
      closeActivatingReauthModal();
      setState("setupProgress", 8);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!root || root.hidden) return;
      closeActivatingReauthModal();
    });
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
      cancelActivatingProgress7to8Anim();
      cancelActivatingReauth6to7Anim();
      activatingProgress7to8AnimPending = prev === 7 && clamped === 8;
      if (prev === 6 && clamped === 7) {
        activatingReauth6to7AnimPending = true;
      }
      const openReauthFromControls =
        document.body?.getAttribute("data-prototype-context") === "activating-stablecoin" &&
        ((prev === 6 && clamped === 7) || (prev === 8 && clamped === 7));
      if (prev === 3 && clamped === 2) {
        setLoggedInValue(false);
        setAccountCreatedValue(false);
      }
      if (prev === 2 && clamped === 3) {
        setLoggedInValue(true);
        setAccountCreatedValue(true);
      }
      applySetupProgressToUi();
      if (openReauthFromControls && prev === 8 && clamped === 7) {
        window.queueMicrotask(() => openActivatingReauthModal());
      }
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
      // Fresh 5:00 on every page load while logged in stays true.
      try {
        window.localStorage?.setItem(
          LOGGED_IN_SESSION_END_KEY,
          new Date(Date.now() + LOGGED_IN_SESSION_MS).toISOString(),
        );
      } catch (_) {
        /* ignore */
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

  function initUseDefaultStablecoinCheckbox() {
    if (!document.querySelector("[data-prototype-use-default-stablecoin]")) return;

    try {
      const raw = window.localStorage?.getItem(USE_DEFAULT_STABLECOIN_KEY);
      if (raw !== "1" && raw !== "0") {
        window.localStorage?.setItem(USE_DEFAULT_STABLECOIN_KEY, "0");
      }
    } catch (_) {
      /* ignore */
    }

    syncUseDefaultStablecoinCheckboxes(readUseDefaultStablecoin());

    if (document.documentElement.hasAttribute("data-prototype-use-default-stablecoin-bound")) {
      return;
    }
    document.documentElement.setAttribute("data-prototype-use-default-stablecoin-bound", "");
    document.addEventListener("change", onUseDefaultStablecoinCheckboxChange);
  }

  function initJourneySelect() {
    const selects = document.querySelectorAll("[data-prototype-journey]");
    if (!selects.length) return;

    const stored = readJourneyFromStorage();
    selects.forEach((sel) => {
      sel.value = stored;
    });

    selects.forEach((select) => {
      select.addEventListener("change", () => {
        const journey = select.value === "paylynk" ? "paylynk" : "setup";
        try {
          window.localStorage?.setItem(JOURNEY_KEY, journey);
        } catch (_) {
          /* ignore */
        }
        document.querySelectorAll("[data-prototype-journey]").forEach((el) => {
          if (el !== select) el.value = journey;
        });
        const target = journeyHref(journey);
        const current = window.location.pathname.split("/").pop() || "index.html";
        if (current !== target) window.location.href = target;
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
        if (states.setupProgress >= 3) {
          setAccountCreatedValue(true);
          select.value = "true";
          return;
        }
        setAccountCreatedValue(select.value === "true");
      });
    });

    syncAccountCreatedPrototypeControl();
  }

  function initTimelineAgreeButton() {
    document.querySelectorAll(".setup-timeline-agree").forEach((btn) => {
      btn.addEventListener("click", () => {
        setState("setupProgress", 2, { force: true });
      });
    });
  }

  function initWalletModals() {
    openVerifyEmailModalRef = null;
    const walletModals = document.getElementById("wallet-modals");
    if (!walletModals) return;

    const verifyDialog = document.getElementById("verify-email-dialog");
    const passcodeModal = document.getElementById("set-passcode-modal");
    const input = walletModals.querySelector("#verify-email-code-input");
    const emailDest = walletModals.querySelector(".verify-email-modal__email");
    const loader = document.getElementById("verify-email-loader");
    const loaderOtp = loader?.querySelector("[data-verify-email-loader-otp]");
    const walletLoadingModal = document.getElementById("walletLoadingModal");
    const walletLoadingMessage = document.getElementById("walletLoadingMessage");
    const toast = document.getElementById("wallet-toast");
    const toastTextEl = toast?.querySelector(".wallet-toast__text");
    const passcodeWalletInput = document.getElementById("set-passcode-wallet-input");
    const passcodeConfirmInput = document.getElementById("set-passcode-confirm-input");
    const passcodeAck = document.getElementById("set-passcode-ack");
    const passcodeSubmit = document.getElementById("set-passcode-submit");
    let passcodePrototypeDemoApplied = false;
    let verifyEmailPrototypeDemoApplied = false;
    let passcodeSubmitTimer = null;
    let passcodeSubmitPending = false;

    let lastFocus = null;
    let otpTimer = null;
    let otpPending = false;
    let toastHideTimer = null;

    function syncModalEmail() {
      const src =
        document.querySelector(
          ".setup-timeline__desc--verify .setup-timeline__email",
        ) ||
        document.querySelector("[data-payment-setup-verify-email-source] .setup-timeline__email") ||
        document.querySelector(".setup-timeline__email");
      if (src && emailDest) emailDest.textContent = src.textContent.trim();
    }

    function isPrototypeLoaderVisible() {
      return (
        (loader && !loader.hidden) ||
        walletLoadingModal?.getAttribute("aria-hidden") === "false"
      );
    }

    function hideLoader() {
      if (loader) {
        loader.hidden = true;
        loader.setAttribute("aria-hidden", "true");
        if (loaderOtp) loaderOtp.hidden = false;
      }
      walletLoadingModal?.setAttribute("aria-hidden", "true");
    }

    function showLoader(mode = "otp") {
      if (mode === "passcode") {
        if (loader) {
          loader.hidden = true;
          loader.setAttribute("aria-hidden", "true");
        }
        if (walletLoadingMessage) {
          walletLoadingMessage.textContent = "Preparing your wallet...";
        }
        walletLoadingModal?.setAttribute("aria-hidden", "false");
        return;
      }
      walletLoadingModal?.setAttribute("aria-hidden", "true");
      if (!loader) return;
      if (loaderOtp) loaderOtp.hidden = false;
      loader.hidden = false;
      loader.setAttribute("aria-hidden", "false");
    }

    function clearOtpTimerOnly() {
      if (otpTimer) clearTimeout(otpTimer);
      otpTimer = null;
    }

    function abortPasscodeSubmit() {
      if (passcodeSubmitTimer) window.clearTimeout(passcodeSubmitTimer);
      passcodeSubmitTimer = null;
      passcodeSubmitPending = false;
      hideLoader();
      updatePasscodeSubmitState();
    }

    function abortOtpVerification() {
      clearOtpTimerOnly();
      otpPending = false;
      hideLoader();
      resetVerifyEmailInput();
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

    function updatePasscodeSubmitState() {
      if (!passcodeSubmit) return;
      if (passcodeSubmitPending) {
        passcodeSubmit.disabled = true;
        return;
      }
      const w = passcodeWalletInput?.value ?? "";
      const c = passcodeConfirmInput?.value ?? "";
      const ok =
        !!passcodeAck?.checked &&
        w.length >= 8 &&
        w.length <= 25 &&
        c.length >= 8 &&
        c.length <= 25 &&
        w === c;
      passcodeSubmit.disabled = !ok;
    }

    function resetPasscodeForm() {
      passcodePrototypeDemoApplied = false;
      passcodeModal?.querySelector(".set-passcode-modal__rules")?.classList.remove("is-complete");
      if (passcodeWalletInput) {
        passcodeWalletInput.value = "";
        passcodeWalletInput.type = "password";
        passcodeWalletInput.readOnly = false;
      }
      if (passcodeConfirmInput) {
        passcodeConfirmInput.value = "";
        passcodeConfirmInput.type = "password";
        passcodeConfirmInput.readOnly = false;
      }
      if (passcodeAck) passcodeAck.checked = false;
      document.querySelectorAll("[data-passcode-visibility]").forEach((btn) => {
        btn.setAttribute("aria-pressed", "false");
        const tid = btn.getAttribute("data-passcode-target");
        const isConfirm = tid === "set-passcode-confirm-input";
        btn.setAttribute("aria-label", `Show ${isConfirm ? "confirm passcode" : "wallet passcode"}`);
      });
      updatePasscodeSubmitState();
    }

    function resetVerifyEmailInput() {
      verifyEmailPrototypeDemoApplied = false;
      if (input) {
        input.value = "";
        input.readOnly = false;
      }
    }

    function applyVerifyEmailPrototypeDemo() {
      if (!input || verifyEmailPrototypeDemoApplied || otpPending) return;
      verifyEmailPrototypeDemoApplied = true;
      const len = Math.max(1, parseInt(input.getAttribute("maxlength") || "6", 10) || 6);
      const demoDigits = "1234567890";
      input.value = demoDigits.slice(0, len);
      input.readOnly = true;
      updateLoaderFromInput();
    }

    function applyPasscodePrototypeDemo() {
      if (passcodePrototypeDemoApplied) return;
      passcodePrototypeDemoApplied = true;
      const demo = "Aa1!aaaa";
      if (passcodeWalletInput) {
        passcodeWalletInput.value = demo;
        passcodeWalletInput.readOnly = true;
      }
      if (passcodeConfirmInput) {
        passcodeConfirmInput.value = demo;
        passcodeConfirmInput.readOnly = true;
      }
      passcodeModal?.querySelector(".set-passcode-modal__rules")?.classList.add("is-complete");
      updatePasscodeSubmitState();
    }

    function showToast(message) {
      if (!toast) return;
      const text =
        typeof message === "string" && message.trim()
          ? message.trim()
          : "E-mail verified";
      if (toastTextEl) toastTextEl.textContent = text;
      clearTimeout(toastHideTimer);
      toast.hidden = false;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => toast.classList.add("is-visible"));
      });
      toastHideTimer = window.setTimeout(() => hideToast(), 4500);
    }

    function completeEmailVerification() {
      abortPasscodeSubmit();
      clearOtpTimerOnly();
      otpPending = false;
      hideLoader();

      const isPaymentSetup = document.body?.getAttribute("data-prototype-context") === "payment-setup";
      if (isPaymentSetup) {
        setLoggedInValue(true);
        resetVerifyEmailInput();
        if (verifyDialog) verifyDialog.hidden = true;
        walletModals.hidden = true;
        document.body.classList.remove("wallet-modals-is-open");
        hideToastImmediate();
        window.location.href = resolvePaymentSetupStablecoinResumeHref();
        return;
      }

      setAccountCreatedValue(true);
      resetVerifyEmailInput();
      if (verifyDialog) verifyDialog.hidden = true;
      setState("setupProgress", 3, { force: true });
      setLoggedInValue(true);
      walletModals.hidden = false;
      document.body.classList.add("wallet-modals-is-open");
      if (passcodeModal) {
        window.requestAnimationFrame(() => {
          if (document.body?.getAttribute("data-prototype-context") !== "wallet-setup") return;
          walletModals.hidden = false;
          if (verifyDialog) verifyDialog.hidden = true;
          passcodeModal.hidden = false;
          document.body.classList.add("wallet-modals-is-open");
          resetPasscodeForm();
        });
      }
      showToast();
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
      abortPasscodeSubmit();
      abortOtpVerification();
      resetVerifyEmailInput();
      window.requestAnimationFrame(() => input?.focus());
    }

    function openPasscodeModal() {
      lastFocus = document.activeElement;
      walletModals.hidden = false;
      if (verifyDialog) verifyDialog.hidden = true;
      if (passcodeModal) {
        passcodeModal.hidden = false;
        resetPasscodeForm();
      }
      document.body.classList.add("wallet-modals-is-open");
      abortPasscodeSubmit();
      abortOtpVerification();
    }

    function closeWalletModals() {
      abortOtpVerification();
      abortPasscodeSubmit();
      resetVerifyEmailInput();
      if (verifyDialog) verifyDialog.hidden = false;
      if (passcodeModal) passcodeModal.hidden = true;
      walletModals.hidden = true;
      document.body.classList.remove("wallet-modals-is-open");
      hideToastImmediate();
      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus();
      }
      lastFocus = null;
      resetPasscodeForm();
    }

    document.querySelectorAll(".setup-timeline-verify").forEach((btn) => {
      btn.addEventListener("click", () => openVerifyModal());
    });

    document.querySelectorAll(".setup-timeline-set-passcode").forEach((btn) => {
      btn.addEventListener("click", () => openPasscodeModal());
    });

    input?.addEventListener("input", () => updateLoaderFromInput());
    input?.addEventListener("click", applyVerifyEmailPrototypeDemo);

    walletModals.addEventListener("click", (e) => {
      if (isPrototypeLoaderVisible()) return;
      if (e.target.closest("[data-wallet-modals-dismiss]")) closeWalletModals();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || walletModals.hidden) return;
      if (isPrototypeLoaderVisible()) {
        if (otpPending) {
          abortOtpVerification();
          e.preventDefault();
          return;
        }
        if (passcodeSubmitPending) {
          abortPasscodeSubmit();
          e.preventDefault();
          return;
        }
      }
      closeWalletModals();
    });

    document.querySelectorAll("[data-passcode-visibility]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tid = btn.getAttribute("data-passcode-target");
        const el = tid ? document.getElementById(tid) : null;
        if (!el || el.tagName !== "INPUT") return;
        const show = el.type === "password";
        el.type = show ? "text" : "password";
        btn.setAttribute("aria-pressed", show ? "true" : "false");
        const isConfirm = tid === "set-passcode-confirm-input";
        btn.setAttribute(
          "aria-label",
          show
            ? `Hide ${isConfirm ? "confirm passcode" : "wallet passcode"}`
            : `Show ${isConfirm ? "confirm passcode" : "wallet passcode"}`,
        );
      });
    });

    function onPasscodeFieldInput() {
      if (passcodePrototypeDemoApplied) return;
      const w = passcodeWalletInput?.value ?? "";
      const c = passcodeConfirmInput?.value ?? "";
      if (!w && !c) {
        passcodePrototypeDemoApplied = false;
        passcodeModal?.querySelector(".set-passcode-modal__rules")?.classList.remove("is-complete");
      }
      updatePasscodeSubmitState();
    }

    passcodeWalletInput?.addEventListener("focusin", applyPasscodePrototypeDemo);
    passcodeConfirmInput?.addEventListener("focusin", applyPasscodePrototypeDemo);

    passcodeWalletInput?.addEventListener("input", onPasscodeFieldInput);
    passcodeConfirmInput?.addEventListener("input", onPasscodeFieldInput);
    passcodeAck?.addEventListener("change", updatePasscodeSubmitState);

    passcodeSubmit?.addEventListener("click", () => {
      if (passcodeSubmit.disabled || passcodeSubmitPending) return;
      passcodeSubmitPending = true;
      updatePasscodeSubmitState();
      showLoader("passcode");
      passcodeSubmitTimer = window.setTimeout(() => {
        passcodeSubmitTimer = null;
        passcodeSubmitPending = false;
        hideLoader();
        setState("setupProgress", 4, { force: true });
        closeWalletModals();
        showToast("Wallet account ready");
      }, 3000);
    });

    openVerifyEmailModalRef = openVerifyModal;
  }

  function initWalletContinueToPickStablecoin() {
    const btn = document.querySelector("[data-wallet-continue-next]");
    if (!btn || btn.tagName !== "BUTTON") return;
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const href = btn.getAttribute("data-wallet-continue-next");
      if (href) window.location.href = href;
    });
  }

  function initPaymentSetupPage() {
    if (document.body?.getAttribute("data-prototype-context") !== "payment-setup") return;
    if (consumePaymentMethodAddedToast()) {
      window.requestAnimationFrame(() => {
        showPrototypeToast("Payment method added", { success: true });
      });
    }
    const nextBtn = document.querySelector("[data-payment-setup-next]");
    nextBtn?.addEventListener("click", () => {
      if (nextBtn.disabled) return;
      window.location.href = "review-submit.html";
    });
    const link = document.querySelector("[data-payment-setup-stablecoin-link]");
    link?.addEventListener("click", (e) => {
      if (e.target.closest("[data-pp-wallet-entry]")) return;
      if (states.setupProgress >= 9) {
        e.preventDefault();
        return;
      }
      if (e.target.closest(".setup-option__incomplete")) {
        e.preventDefault();
        if (paymentSetupIncompleteNeedsVerifyModal()) {
          if (typeof openVerifyEmailModalRef === "function") {
            openVerifyEmailModalRef();
          } else {
            window.location.href = "setup-wallet.html";
          }
          return;
        }
        window.location.href = resolvePaymentSetupStablecoinResumeHref();
        return;
      }
      e.preventDefault();
      const href =
        link.getAttribute("href") ||
        link.getAttribute("data-payment-setup-stablecoin-href") ||
        "setup-wallet.html";
      window.location.href = href;
    });
  }

  function initReviewSubmitPage() {
    if (document.body?.getAttribute("data-prototype-context") !== "review-submit") return;

    const showStubToast = () => showPrototypeToast("Not in prototype");

    document.querySelector("[data-review-submit-back]")?.addEventListener("click", () => {
      window.location.href = "index.html";
    });
    document.querySelector("[data-review-submit-submit]")?.addEventListener("click", showStubToast);
    document.querySelectorAll("[data-review-submit-edit]").forEach((btn) => {
      btn.addEventListener("click", showStubToast);
    });
  }

  function initPickStablecoinPage() {
    const root = document.querySelector("[data-pick-stablecoin-root]");
    if (!root) return;
    const sync = () => {
      syncPickStablecoinContinueFromSelection();
    };
    root.querySelectorAll('input[name="stablecoin-pick"]').forEach((inp) => {
      inp.addEventListener("change", sync);
      inp.addEventListener("input", sync);
    });
    root.querySelectorAll("[data-pick-stablecoin-network-help]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
      });
    });
    root.addEventListener("click", (e) => {
      if (e.target.closest(".pick-stablecoin-option")) {
        window.requestAnimationFrame(sync);
      }
    });
    sync();
    syncPickStablecoinDefaultStablecoinUi();

    const goToActivating = () => {
      const useDefault = readUseDefaultStablecoin();
      let coin = "usdt";
      if (!useDefault) {
        const checked = root.querySelector('input[name="stablecoin-pick"]:checked');
        if (checked && (checked.value === "usdc" || checked.value === "usdt")) {
          coin = checked.value;
        }
      }
      const previousCoin = readActivatingSelectionCoin();
      const sameSelection = coin === previousCoin;
      const preserveProgress = states.setupProgress > 5 && sameSelection;
      try {
        window.sessionStorage?.setItem(
          ACTIVATING_SELECTION_KEY,
          JSON.stringify({ coin }),
        );
      } catch (_) {
        /* ignore */
      }
      if (!preserveProgress) {
        setState("setupProgress", 5, { force: true });
      }
      window.location.href = "activating-stablecoin.html";
    };

    document.querySelectorAll("[data-pick-stablecoin-continue]").forEach((btn) => {
      if (btn.tagName !== "BUTTON") return;
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        goToActivating();
      });
    });

    document.querySelectorAll("[data-pick-stablecoin-change]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setUseDefaultStablecoin(false);
      });
    });
  }

  function initActivatingStablecoinPage() {
    if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
    const coin = readActivatingSelectionCoin();
    const sym = coin === "usdc" ? "USDC" : "USDT";
    const iconSrc = coin === "usdc" ? "assets/icon_usdc.svg" : "assets/icon_usdt.svg";
    const titleEl = document.querySelector("[data-activating-page-title]");
    const iconEl = document.querySelector("[data-activating-coin-icon]");
    const ledeEl = document.querySelector("[data-activating-lede]");
    if (titleEl) titleEl.textContent = `Activating ${sym}`;
    if (iconEl) {
      iconEl.src = iconSrc;
    }
    if (ledeEl) {
      ledeEl.textContent = `Setting up ${sym}: Ethereum network (ERC-20) for payments to Halcyon Systems Corp.`;
    }
    try {
      document.title = `XREX PayLynk - Activating ${sym}`;
    } catch (_) {
      /* ignore */
    }

    syncActivatingStablecoinStatusFromProgress();
    syncActivatingErc20ActivatedFromProgress();

    const goToPaymentSetupFromActivating = () => {
      if (states.setupProgress < 9) return;
      if (readJourneyFromStorage() === "paylynk") {
        navigatePaylynkToNetworkSelect();
        return;
      }
      window.location.href = "index.html";
    };

    document.querySelectorAll("[data-activating-continue-card]").forEach((btn) => {
      if (btn.tagName !== "BUTTON") return;
      btn.addEventListener("click", () => {
        if (states.setupProgress === 7) {
          openActivatingReauthModal();
          return;
        }
        goToPaymentSetupFromActivating();
      });
    });

    document.querySelectorAll("[data-activating-continue-footer]").forEach((btn) => {
      if (btn.tagName !== "BUTTON") return;
      btn.addEventListener("click", () => {
        if (states.setupProgress < 9) return;
        if (readJourneyFromStorage() === "paylynk") {
          const coin = readActivatingSelectionCoin() === "usdc" ? "usdc" : "usdt";
          setPaylynkErc20Activated(coin, true);
          queuePaymentMethodAddedToast();
          navigatePaylynkToNetworkSelect();
          return;
        }
        queuePaymentMethodAddedToast();
        goToPaymentSetupFromActivating();
      });
    });

    const ACTIVATING_WAIT_SLIDES = [
      {
        img: "assets/placeholder-wait-1.svg",
        headline: "Placeholder title number one",
        body:
          "Nullam finibus, orci ac mollis sodales, magna lorem mollis nisl, et mattis eros metus nec orci.\n\nVestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; donec velit neque, auctor sit amet aliquam vel.",
      },
      {
        img: "assets/placeholder-wait-2.svg",
        headline: "Placeholder title number two",
        body:
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio praesent libero sed cursus ante dapibus diam.\n\nSuspendisse potenti. Cras dapibus vivamus elementum semper nisi aenean vulputate eleifend tellus aenean leo ligula, porttitor eu consequat vitae.",
      },
      {
        img: "assets/placeholder-wait-3.svg",
        headline: "Placeholder title number three",
        body:
          "Curabitur ullamcorper ultricies nisi nam eget dui etiam rhoncus maecenas tempus, tellus eget condimentum rhoncus, sem quam semper libero.\n\nEtiam sit amet orci eget eros faucibus tincidunt duis leo sed fringilla mauris sit amet nibh donec sodales sagittis magna.",
      },
      {
        img: "assets/placeholder-wait-4.svg",
        headline: "Placeholder title number four",
        body:
          "Phasellus viverra nulla ut metus varius laoreet quisque rutrum aenean imperdiet etiam ultricies nisi vel augue curabitur ullamcorper.\n\nNam quam nunc, blandit vel luctus pulvinar hendrerit id lorem maecenas nec odio et ante tincidunt tempus donec vitae sapien.",
      },
    ];

    let idx = 1;
    const max = ACTIVATING_WAIT_SLIDES.length;
    const idxEl = document.querySelector("[data-activating-carousel-index]");
    const prevBtn = document.querySelector("[data-activating-carousel-prev]");
    const nextBtn = document.querySelector("[data-activating-carousel-next]");
    const carouselImg = document.querySelector("[data-activating-carousel-img]");
    const carouselHeadline = document.querySelector("[data-activating-carousel-headline]");
    const carouselBody = document.querySelector("[data-activating-carousel-body]");
    const syncCarousel = () => {
      if (idxEl) idxEl.textContent = `${idx}/${max}`;
      if (prevBtn) prevBtn.disabled = idx <= 1;
      if (nextBtn) nextBtn.disabled = idx >= max;
      const slide = ACTIVATING_WAIT_SLIDES[idx - 1];
      if (slide) {
        if (carouselImg) carouselImg.src = slide.img;
        if (carouselHeadline) carouselHeadline.textContent = slide.headline;
        if (carouselBody) carouselBody.textContent = slide.body;
      }
    };
    prevBtn?.addEventListener("click", () => {
      if (idx > 1) idx -= 1;
      syncCarousel();
    });
    nextBtn?.addEventListener("click", () => {
      if (idx < max) idx += 1;
      syncCarousel();
    });
    syncCarousel();
  }

  const PAYLYNK_STABLECOIN_KEY = `${STORAGE_PREFIX}selectedStablecoin.v1`;
  const PAYLYNK_RETURN_VIEW_KEY = `${STORAGE_PREFIX}returnView.v1`;
  const PAYLYNK_USDT_ERC20_ACTIVATED_KEY = `${STORAGE_PREFIX}usdtErc20Activated.v1`;
  const PAYLYNK_USDC_ERC20_ACTIVATED_KEY = `${STORAGE_PREFIX}usdcErc20Activated.v1`;

  const PAYLYNK_STABLECOIN_COPY = {
    usdt: {
      title: "Which network will you use to pay USDT?",
      methodLabel: "USDT stablecoin network",
      rate: "1 USDT = 1 USD",
      total: "251,125.00 USDT",
      icon: "assets/icon_usdt.svg",
    },
    usdc: {
      title: "Which network will you use to pay USDC?",
      methodLabel: "USDC stablecoin network",
      rate: "1 USDC = 1 USD",
      total: "251,125.00 USDC",
      icon: "assets/icon_usdc.svg",
    },
  };

  function paylynkErc20ActivatedStorageKey(coin) {
    return coin === "usdc" ? PAYLYNK_USDC_ERC20_ACTIVATED_KEY : PAYLYNK_USDT_ERC20_ACTIVATED_KEY;
  }

  function readPaylynkErc20Activated(coin) {
    try {
      return window.localStorage?.getItem(paylynkErc20ActivatedStorageKey(coin)) === "1";
    } catch (_) {
      return false;
    }
  }

  function readPaylynkSelectedStablecoin() {
    try {
      const v = window.localStorage?.getItem(PAYLYNK_STABLECOIN_KEY);
      if (v === "usdc" || v === "usdt") return v;
    } catch (_) {
      /* ignore */
    }
    return "usdt";
  }

  function syncPaylynkErc20ActivatedCheckboxes() {
    document.querySelectorAll("[data-prototype-usdt-erc20-activated]").forEach((el) => {
      if (el instanceof HTMLInputElement) el.checked = readPaylynkErc20Activated("usdt");
    });
    document.querySelectorAll("[data-prototype-usdc-erc20-activated]").forEach((el) => {
      if (el instanceof HTMLInputElement) el.checked = readPaylynkErc20Activated("usdc");
    });
  }

  /** Activating page at progress 9+: reflect pick-stablecoin choice in ERC-20 prototype checkboxes. */
  function syncActivatingErc20ActivatedFromProgress() {
    if (document.body?.getAttribute("data-prototype-context") !== "activating-stablecoin") return;
    if (states.setupProgress < 9) {
      setPaylynkErc20Activated("usdt", false);
      setPaylynkErc20Activated("usdc", false);
      return;
    }
    const coin = readActivatingSelectionCoin() === "usdc" ? "usdc" : "usdt";
    const other = coin === "usdc" ? "usdt" : "usdc";
    setPaylynkErc20Activated(coin, true);
    setPaylynkErc20Activated(other, false);
  }

  function setPaylynkErc20Activated(coin, enabled) {
    try {
      window.localStorage?.setItem(paylynkErc20ActivatedStorageKey(coin), enabled ? "1" : "0");
    } catch (_) {
      /* ignore */
    }
    syncPaylynkErc20ActivatedCheckboxes();
    syncPaylynkEthereumNetworkCard();
    document.dispatchEvent(
      new CustomEvent("paylynk:erc20-activated-changed", { detail: { coin, enabled } }),
    );
  }

  function syncPaylynkNetworkContinue() {
    const continueBtn = document.querySelector("[data-paylynk-network-continue]");
    const networkView = document.querySelector('[data-paylynk-view="network"]');
    if (!continueBtn || !networkView) return;

    const coin = networkView.getAttribute("data-paylynk-coin") || readPaylynkSelectedStablecoin();
    const activated = readPaylynkErc20Activated(coin);
    const consentInput = document.querySelector("[data-paylynk-network-consent-input]");
    const radio = document.querySelector("[data-paylynk-network-radio]");

    if (activated) {
      const consentOk = consentInput instanceof HTMLInputElement && consentInput.checked;
      continueBtn.disabled = !consentOk;
    } else {
      continueBtn.disabled = true;
      if (radio instanceof HTMLInputElement) radio.checked = false;
      if (consentInput instanceof HTMLInputElement) consentInput.checked = false;
    }
  }

  function syncPaylynkEthereumNetworkCard() {
    const networkView = document.querySelector('[data-paylynk-view="network"]');
    const card = document.querySelector("[data-paylynk-network-ethereum]");
    if (!networkView || !card) return;

    const coin = networkView.getAttribute("data-paylynk-coin") || readPaylynkSelectedStablecoin();
    const activated = readPaylynkErc20Activated(coin);

    card.classList.toggle("paylynk-network-card--activated", activated);

    card.querySelectorAll("[data-paylynk-network-when-inactive]").forEach((el) => {
      if (activated) el.setAttribute("hidden", "");
      else el.removeAttribute("hidden");
    });

    card.querySelectorAll("[data-paylynk-network-when-active]").forEach((el) => {
      if (activated) el.removeAttribute("hidden");
      else {
        el.setAttribute("hidden", "");
        if (el instanceof HTMLInputElement && el.matches("[data-paylynk-network-radio]")) {
          el.checked = false;
        }
      }
    });

    const consentBlock = document.querySelector("[data-paylynk-network-consent-block]");
    const consentInput = document.querySelector("[data-paylynk-network-consent-input]");
    const radio = document.querySelector("[data-paylynk-network-radio]");

    if (activated) {
      if (radio instanceof HTMLInputElement) radio.checked = true;
      consentBlock?.removeAttribute("hidden");
    } else {
      consentBlock?.setAttribute("hidden", "");
      if (consentInput instanceof HTMLInputElement) consentInput.checked = false;
    }

    syncPaylynkNetworkContinue();
  }

  function navigatePaylynkToActivatingStablecoin(coin) {
    const resolved = coin === "usdc" ? "usdc" : "usdt";
    try {
      window.sessionStorage?.setItem(ACTIVATING_SELECTION_KEY, JSON.stringify({ coin: resolved }));
    } catch (_) {
      /* ignore */
    }
    setState("setupProgress", 5, { force: true });
    window.location.href = "activating-stablecoin.html";
  }

  function syncPaylynkNetworkCopy(coin) {
    const copy = PAYLYNK_STABLECOIN_COPY[coin];
    if (!copy) return;

    const networkView = document.querySelector('[data-paylynk-view="network"]');
    networkView?.setAttribute("data-paylynk-coin", coin);

    const titleEl = document.querySelector("[data-paylynk-network-title]");
    if (titleEl) titleEl.textContent = copy.title;

    const methodEl = document.querySelector("[data-paylynk-summary-method]");
    if (methodEl) methodEl.textContent = copy.methodLabel;

    const rateEl = document.querySelector("[data-paylynk-summary-rate]");
    if (rateEl) rateEl.textContent = copy.rate;

    const totalEl = document.querySelector("[data-paylynk-summary-total]");
    if (totalEl) totalEl.textContent = copy.total;

    document.querySelectorAll("[data-paylynk-summary-coin], [data-paylynk-sticky-coin]").forEach((img) => {
      if (img instanceof HTMLImageElement) img.src = copy.icon;
    });

    const stickyTotal = document.querySelector("[data-paylynk-sticky-total]");
    if (stickyTotal) stickyTotal.textContent = copy.total;

    syncPaylynkEthereumNetworkCard();
  }

  function setPaylynkView(view) {
    document.querySelectorAll("[data-paylynk-view]").forEach((el) => {
      const name = el.getAttribute("data-paylynk-view");
      const active = name === view;
      if (active) {
        el.removeAttribute("hidden");
        el.classList.add("paylynk-view--active");
      } else {
        el.setAttribute("hidden", "");
        el.classList.remove("paylynk-view--active");
      }
    });
    document.querySelectorAll("[data-paylynk-sticky-view]").forEach((el) => {
      const name = el.getAttribute("data-paylynk-sticky-view");
      if (name === view) el.removeAttribute("hidden");
      else el.setAttribute("hidden", "");
    });
  }

  function navigatePaylynkToNetworkSelect() {
    try {
      window.sessionStorage?.setItem(PAYLYNK_RETURN_VIEW_KEY, "network");
    } catch (_) {
      /* ignore */
    }
    window.location.href = "paylynk.html";
  }

  function consumePaylynkReturnView() {
    try {
      const v = window.sessionStorage?.getItem(PAYLYNK_RETURN_VIEW_KEY);
      if (v === "network") {
        window.sessionStorage?.removeItem(PAYLYNK_RETURN_VIEW_KEY);
        return "network";
      }
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function showPaylynkNetworkStep(coin) {
    syncPaylynkNetworkCopy(coin);
    try {
      window.localStorage?.setItem(PAYLYNK_STABLECOIN_KEY, coin);
    } catch (_) {
      /* ignore */
    }
    setPaylynkView("network");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function syncPaylynkMethodExpandableDetails() {
    const root = document.querySelector("[data-paylynk-methods]");
    if (!root) return;

    const usdtDetails = root.querySelector("[data-paylynk-method-usdt-details]");
    const usdcDetails = root.querySelector("[data-paylynk-method-usdc-details]");
    const usdt = root.querySelector('input[name="paylynk-payment-method"][value="usdt"]');
    const usdc = root.querySelector('input[name="paylynk-payment-method"][value="usdc"]');

    if (usdtDetails && usdt) {
      if (usdt.checked) usdtDetails.removeAttribute("hidden");
      else usdtDetails.setAttribute("hidden", "");
    }
    if (usdcDetails && usdc) {
      if (usdc.checked) usdcDetails.removeAttribute("hidden");
      else usdcDetails.setAttribute("hidden", "");
    }
  }

  function injectErc20ActivatedPrototypeControls() {
    if (document.querySelector("[data-prototype-usdt-erc20-activated]")) return;
    const body = document.querySelector(".build-badge__body");
    if (!body) return;

    const stack = document.createElement("div");
    stack.className = "build-badge__checkbox-stack";
    stack.innerHTML = `
        <div class="build-badge__section-row">
          <label class="build-badge__checkbox">
            <input type="checkbox" data-prototype-usdt-erc20-activated aria-label="USDT ERC-20 activated" />
            <span>USDT/ERC-20 activated</span>
          </label>
        </div>
        <div class="build-badge__section-row">
          <label class="build-badge__checkbox">
            <input type="checkbox" data-prototype-usdc-erc20-activated aria-label="USDC ERC-20 activated" />
            <span>USDC/ERC-20 activated</span>
          </label>
        </div>`;

    const journeyRow = body.querySelector("[data-prototype-journey]")?.closest(".build-badge__section-row");
    if (journeyRow) journeyRow.before(stack);
    else body.appendChild(stack);
  }

  function initPaylynkErc20ActivatedCheckboxes() {
    injectErc20ActivatedPrototypeControls();
    if (document.documentElement.hasAttribute("data-prototype-erc20-activated-bound")) {
      syncPaylynkErc20ActivatedCheckboxes();
      return;
    }
    document.documentElement.setAttribute("data-prototype-erc20-activated-bound", "");
    const onChange = (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || !e.isTrusted) return;
      if (input.matches("[data-prototype-usdt-erc20-activated]")) {
        setPaylynkErc20Activated("usdt", input.checked);
      }
      if (input.matches("[data-prototype-usdc-erc20-activated]")) {
        setPaylynkErc20Activated("usdc", input.checked);
      }
    };
    document.addEventListener("change", onChange);
    syncPaylynkErc20ActivatedCheckboxes();
    syncPaylynkEthereumNetworkCard();
  }

  function initPaylynkPage() {
    if (document.body?.getAttribute("data-prototype-context") !== "paylynk") return;

    if (consumePaymentMethodAddedToast()) {
      window.requestAnimationFrame(() => {
        showPrototypeToast("Payment method added", { success: true });
      });
    }

    const methodsRoot = document.querySelector("[data-paylynk-methods]");
    if (methodsRoot) {
      const syncExpandables = () => syncPaylynkMethodExpandableDetails();
      methodsRoot.addEventListener("change", syncExpandables);
      syncExpandables();

      methodsRoot.querySelectorAll("[data-paylynk-fee-details]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showPrototypeToast("Not in prototype");
        });
      });

      methodsRoot.querySelectorAll("[data-paylynk-method-select]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const expandable = btn.closest("[data-paylynk-method-expandable]");
          const coin = expandable?.getAttribute("data-paylynk-method-expandable");
          if (coin === "usdt" || coin === "usdc") showPaylynkNetworkStep(coin);
        });
      });
    }

    document.querySelector("[data-paylynk-network-back]")?.addEventListener("click", () => {
      setPaylynkView("method");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.querySelector("[data-paylynk-network-help]")?.addEventListener("click", (e) => {
      e.preventDefault();
      showPrototypeToast("Not in prototype");
    });

    document.querySelector("[data-paylynk-network-setup]")?.addEventListener("click", (e) => {
      e.preventDefault();
      const networkView = document.querySelector('[data-paylynk-view="network"]');
      const coin = networkView?.getAttribute("data-paylynk-coin") || readPaylynkSelectedStablecoin();
      navigatePaylynkToActivatingStablecoin(coin);
    });

    document.querySelector("[data-paylynk-network-radio]")?.addEventListener("change", () => {
      syncPaylynkNetworkContinue();
    });

    document.querySelector("[data-paylynk-network-consent-input]")?.addEventListener("change", () => {
      syncPaylynkNetworkContinue();
    });

    document.querySelector("[data-paylynk-network-continue]")?.addEventListener("click", (e) => {
      e.preventDefault();
      showPrototypeToast("Not in prototype");
    });

    document
      .querySelector('[data-paylynk-view="network"]')
      ?.querySelectorAll("[data-paylynk-fee-details]")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showPrototypeToast("Not in prototype");
        });
      });

    const swiftLabel = document.querySelector("[data-paylynk-method-swift]");
    swiftLabel?.addEventListener("click", (e) => {
      e.preventDefault();
      showPrototypeToast("Not in prototype");
    });

    if (consumePaylynkReturnView() === "network") {
      const coin = readActivatingSelectionCoin();
      showPaylynkNetworkStep(coin === "usdc" ? "usdc" : "usdt");
    }
  }

  function resetPrototypeControlsState() {
    setUseDefaultStablecoin(false);
    setPaylynkErc20Activated("usdt", false);
    setPaylynkErc20Activated("usdc", false);

    document.querySelectorAll("[data-prototype-journey]").forEach((sel) => {
      sel.value = "setup";
    });
    try {
      window.localStorage?.setItem(JOURNEY_KEY, "setup");
    } catch (_) {
      /* ignore */
    }

    setLoggedInValue(false);
    setWalletPasscodeValue("inactive");
    setAccountCreatedValue(false);

    setState("setupProgress", 1, { force: true });

    document.querySelectorAll("[data-prototype-account-created]").forEach((sel) => {
      sel.disabled = false;
      sel.removeAttribute("aria-disabled");
      sel.value = "false";
    });
    try {
      window.localStorage?.setItem(ACCOUNT_CREATED_KEY, "false");
    } catch (_) {
      /* ignore */
    }
  }

  function initPrototypeReset() {
    const resetBtn = document.querySelector("[data-prototype-reset]");
    if (!resetBtn) return;
    resetBtn.addEventListener("click", () => {
      const emptyInput = document.querySelector("[data-prototype-empty]");
      if (emptyInput) {
        emptyInput.checked = false;
        try {
          window.localStorage?.setItem(EMPTY_KEY, "0");
        } catch (_) {
          /* ignore */
        }
      }

      resetPrototypeControlsState();

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
        if (inp) {
          inp.value = "";
          inp.readOnly = false;
        }
        if (ld) {
          ld.hidden = true;
          ld.setAttribute("aria-hidden", "true");
        }
        document.getElementById("walletLoadingModal")?.setAttribute("aria-hidden", "true");
        if (toastEl) {
          toastEl.hidden = true;
          toastEl.classList.remove("is-visible");
        }
      }

      if (prototypeToastHideTimer != null) {
        window.clearTimeout(prototypeToastHideTimer);
        prototypeToastHideTimer = null;
      }
      const protoToast = document.getElementById("prototype-toast");
      if (protoToast) {
        protoToast.hidden = true;
        protoToast.classList.remove("is-visible");
      }

      if (document.body?.getAttribute("data-prototype-context") === "pick-stablecoin") {
        window.location.href = "setup-wallet.html";
      }
      if (document.body?.getAttribute("data-prototype-context") === "activating-stablecoin") {
        window.location.href = "setup-wallet.html";
      }
      if (document.body?.getAttribute("data-prototype-context") === "paylynk") {
        window.location.href = "index.html";
      }
    });
  }

  function init() {
    initStates();
    initBadgeControls();
    initTimelineAgreeButton();
    initWalletModals();
    initWalletContinueToPickStablecoin();
    initPaymentSetupPage();
    initReviewSubmitPage();
    initPickStablecoinPage();
    initActivatingStablecoinPage();
    initPaylynkPage();
    initActivatingReauthModal();
    initSetupLeaveCancelDialog();
    initUseDefaultStablecoinCheckbox();
    initPaylynkErc20ActivatedCheckboxes();
    initJourneySelect();
    initEmptyCheckbox();
    initLoggedInSelect();
    initWalletPasscodeSelect();
    initAccountCreatedSelect();
    initPrototypeReset();
  }

  window.PaylynkPrototype = Object.assign(window.PaylynkPrototype || {}, {
    isLoggedInSessionActive: isPrototypeLoggedInSessionActive,
    isWalletPasscodeSessionActive,
    setWalletPasscodeValue,
    activateWalletPasscodeSession,
    clearWalletSession: () => setWalletPasscodeValue("inactive"),
    isPaylynkErc20Activated: readPaylynkErc20Activated,
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
